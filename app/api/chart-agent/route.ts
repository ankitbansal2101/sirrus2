import { chartFromPromptFallback, createChartAgentClient, runChartAgent } from "@/lib/agent/chart-agent";
import type { AgentChatMessage, ChartAgentRequest } from "@/lib/agent/types";
import type { CrmWorkspace } from "@/lib/crm/types";

export const runtime = "nodejs";
export const maxDuration = 60;

function isRecord(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

function parseMessages(raw: unknown): AgentChatMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m): m is Record<string, unknown> => isRecord(m))
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content as string }))
    .slice(-16);
}

function parseWorkspace(raw: unknown): CrmWorkspace | null {
  if (!isRecord(raw)) return null;
  if (raw.version !== 1 || typeof raw.orgName !== "string" || !Array.isArray(raw.modules)) return null;
  return raw as unknown as CrmWorkspace;
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!isRecord(body)) {
    return Response.json({ error: "Expected a JSON object." }, { status: 400 });
  }

  const messages = parseMessages(body.messages);
  if (!messages.length || messages[messages.length - 1]?.role !== "user") {
    return Response.json({ error: "Send at least one user message." }, { status: 400 });
  }

  const workspace = parseWorkspace(body.workspace);
  if (!workspace) {
    return Response.json({ error: "A valid CRM workspace is required." }, { status: 400 });
  }

  const request: ChartAgentRequest = {
    messages,
    current: isRecord(body.current) ? (body.current as ChartAgentRequest["current"]) : null,
  };

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return Response.json(chartFromPromptFallback(messages[messages.length - 1]!.content, workspace));
  }

  try {
    const client = createChartAgentClient(apiKey);
    const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o";
    const result = await runChartAgent(request, workspace, client, model);
    return Response.json(result);
  } catch (err) {
    const fallback = chartFromPromptFallback(messages[messages.length - 1]!.content, workspace);
    fallback.traces.push({
      id: "tr_fallback",
      label: "OpenAI unavailable",
      detail: err instanceof Error ? err.message : "Request failed.",
      status: "warn",
    });
    return Response.json(fallback);
  }
}
