import { createCrmAgentClient, runCrmAgent } from "@/lib/agent/crm-agent";
import { newCrmId } from "@/lib/crm/ids";
import { findAgent, findModule, updateRecord } from "@/lib/crm/ops";
import { recordTitle } from "@/lib/crm/display";
import type { CrmAutomationEvent } from "@/lib/crm/workflows";
import { matchingWorkflows, workflowsOf } from "@/lib/crm/workflows";
import type { AgentWorkflow, AgentWorkflowRun, AgentWorkflowStep, CrmWorkspace } from "@/lib/crm/types";
import type OpenAI from "openai";

const MAX_RUNS = 20;

export async function runMatchingWorkflows(
  workspace: CrmWorkspace,
  event: CrmAutomationEvent,
  openai: { client: OpenAI; model: string } | null,
): Promise<{ workspace: CrmWorkspace; ran: number; summaries: string[] }> {
  const matches = matchingWorkflows(workspace, event);
  let ws = workspace;
  const summaries: string[] = [];
  for (const wf of matches) {
    const result = await executeWorkflow(ws, wf.id, event, openai);
    ws = result.workspace;
    summaries.push(result.run.summary);
  }
  return { workspace: ws, ran: matches.length, summaries };
}

export async function executeWorkflow(
  workspace: CrmWorkspace,
  workflowId: string,
  event: CrmAutomationEvent,
  openai: { client: OpenAI; model: string } | null,
): Promise<{ workspace: CrmWorkspace; run: AgentWorkflowRun }> {
  const wf = workflowsOf(workspace).find((w) => w.id === workflowId);
  if (!wf) {
    const run: AgentWorkflowRun = {
      id: newCrmId("wfr"),
      at: new Date().toISOString(),
      status: "error",
      summary: "Workflow not found.",
      recordId: event.recordId,
    };
    return { workspace, run };
  }

  let ws = workspace;
  const parts: string[] = [];
  let status: AgentWorkflowRun["status"] = "ok";

  try {
    const mod = findModule(ws, event.moduleId) ?? findModule(ws, wf.moduleId);
    const rec = mod?.records.find((r) => r.id === event.recordId || r.displayId === event.recordId);
    if (!mod || !rec) {
      status = "skipped";
      parts.push("No matching record.");
    } else {
      for (const step of wf.steps) {
        const out = await runStep(ws, step, event, rec.id, openai);
        ws = out.workspace;
        parts.push(out.summary);
        if (out.status === "error") {
          status = "error";
          break;
        }
      }
      if (!wf.steps.length) parts.push("No steps configured.");
    }
  } catch (err) {
    status = "error";
    parts.push(err instanceof Error ? err.message : "Workflow failed.");
  }

  const run: AgentWorkflowRun = {
    id: newCrmId("wfr"),
    at: new Date().toISOString(),
    status,
    summary: parts.filter(Boolean).join(" → ") || "Done.",
    recordId: event.recordId,
  };

  const next: CrmWorkspace = structuredClone(ws);
  const target = (next.workflows ?? []).find((w) => w.id === workflowId);
  if (target) {
    target.runs = [run, ...target.runs].slice(0, MAX_RUNS);
    target.updatedAt = run.at;
  }
  return { workspace: next, run };
}

async function runStep(
  workspace: CrmWorkspace,
  step: AgentWorkflowStep,
  event: CrmAutomationEvent,
  recordId: string,
  openai: { client: OpenAI; model: string } | null,
): Promise<{ workspace: CrmWorkspace; summary: string; status: "ok" | "error" }> {
  if (step.type === "log") {
    return { workspace, summary: step.message?.trim() || "Logged.", status: "ok" };
  }

  if (step.type === "change_stage") {
    const mod = findModule(workspace, event.moduleId);
    if (!mod?.stageFieldApiKey) return { workspace, summary: "No stage field on this module.", status: "error" };
    const field = mod.fields.find((f) => f.apiKey === mod.stageFieldApiKey);
    const opt =
      field?.options.find((o) => o.label === step.stageLabel || o.id === step.stageLabel) ??
      field?.options.find((o) => o.label === step.stageLabel);
    if (!opt) return { workspace, summary: `Stage "${step.stageLabel ?? ""}" not found.`, status: "error" };
    const next = updateRecord(workspace, mod.id, recordId, { [mod.stageFieldApiKey]: opt.id });
    return { workspace: next, summary: `Stage → ${opt.label}`, status: "ok" };
  }

  if (step.type === "update_field") {
    const mod = findModule(workspace, event.moduleId);
    const field = mod?.fields.find((f) => f.id === step.fieldId || f.apiKey === step.fieldId);
    if (!mod || !field) return { workspace, summary: "Field not found.", status: "error" };
    const next = updateRecord(workspace, mod.id, recordId, { [field.apiKey]: step.value ?? "" });
    return { workspace: next, summary: `Set ${field.label}`, status: "ok" };
  }

  if (step.type === "run_agent") {
    const agent = step.agentId ? findAgent(workspace, step.agentId) : undefined;
    if (!agent) return { workspace, summary: "Agent not found.", status: "error" };
    if (!openai) {
      return {
        workspace,
        summary: `${agent.name} skipped (no OpenAI key).`,
        status: "ok",
      };
    }
    const mod = findModule(workspace, event.moduleId);
    const rec = mod?.records.find((r) => r.id === recordId);
    const title = mod && rec ? recordTitle(mod, rec) : recordId;
    const prompt =
      step.prompt?.trim() ||
      `Automation trigger: ${event.type} on ${mod?.pluralLabel ?? "record"} "${title}" (${rec?.displayId ?? recordId}). Review the record with tools, then take the actions in your instructions (for example update stage).`;
    const result = await runCrmAgent(
      {
        messages: [{ role: "user", content: prompt }],
        workspace,
        focusModuleId: mod?.id ?? event.moduleId,
        mode: "custom",
        customAgentId: agent.id,
      },
      openai.client,
      openai.model,
    );
    return {
      workspace: result.workspace ?? workspace,
      summary: `${agent.name}: ${result.summary || result.assistantMessage.slice(0, 140)}`,
      status: result.assistantMessage.toLowerCase().includes("not found") ? "error" : "ok",
    };
  }

  return { workspace, summary: "Unknown step.", status: "error" };
}
