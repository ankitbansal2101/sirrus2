import { createCrmAgentClient } from "@/lib/agent/crm-agent";
import { executeWorkflow, runMatchingWorkflows } from "@/lib/crm/run-workflow";
import type { CrmWorkspace } from "@/lib/crm/types";
import type { CrmAutomationEvent } from "@/lib/crm/workflows";

export const runtime = "nodejs";
export const maxDuration = 60;

function isRecord(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

function parseWorkspace(raw: unknown): CrmWorkspace | null {
  if (!isRecord(raw) || raw.version !== 1 || typeof raw.orgName !== "string" || !Array.isArray(raw.modules)) return null;
  return raw as unknown as CrmWorkspace;
}

function parseEvent(raw: unknown): CrmAutomationEvent | null {
  if (!isRecord(raw) || typeof raw.type !== "string" || typeof raw.moduleId !== "string" || typeof raw.recordId !== "string") {
    return null;
  }
  return {
    type: raw.type as CrmAutomationEvent["type"],
    moduleId: raw.moduleId,
    recordId: raw.recordId,
    previousValues: isRecord(raw.previousValues) ? (raw.previousValues as Record<string, string>) : undefined,
    nextValues: isRecord(raw.nextValues) ? (raw.nextValues as Record<string, string>) : undefined,
  };
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!isRecord(body)) return Response.json({ error: "Expected a JSON object." }, { status: 400 });

  const workspace = parseWorkspace(body.workspace);
  const event = parseEvent(body.event);
  if (!workspace || !event) {
    return Response.json({ error: "workspace and event { type, moduleId, recordId } are required." }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const openai = apiKey
    ? { client: createCrmAgentClient(apiKey), model: process.env.OPENAI_MODEL?.trim() || "gpt-4o" }
    : null;

  try {
    const workflowId = typeof body.workflowId === "string" ? body.workflowId : null;
    if (workflowId) {
      const result = await executeWorkflow(workspace, workflowId, event, openai);
      return Response.json({ workspace: result.workspace, ran: 1, summaries: [result.run.summary], run: result.run });
    }
    const result = await runMatchingWorkflows(workspace, event, openai);
    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Workflow run failed.";
    return Response.json({ error: message }, { status: 502 });
  }
}
