import { createWidgetAgentClient, runWidgetAgent } from "@/lib/agent/widget-agent";
import type { AgentChatMessage, WidgetAgentRequest } from "@/lib/agent/types";
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

function parseFields(raw: unknown): WidgetAgentRequest["fields"] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((f): f is Record<string, unknown> => isRecord(f) && typeof f.key === "string" && typeof f.label === "string")
    .map((f) => ({
      key: String(f.key),
      label: String(f.label),
      type: typeof f.type === "string" ? f.type : "text",
      required: f.required === true,
      options: Array.isArray(f.options) ? f.options.map((o) => String(o)) : undefined,
    }));
}

function parseWorkspace(raw: unknown): CrmWorkspace | null {
  if (!isRecord(raw)) return null;
  if (raw.version !== 1 || typeof raw.orgName !== "string" || !Array.isArray(raw.modules)) return null;
  return raw as unknown as CrmWorkspace;
}

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return Response.json(
      {
        error:
          "OPENAI_API_KEY is not set. Add it to .env.local (see .env.example). The key stays on the server and is never sent to the browser.",
      },
      { status: 503 },
    );
  }

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
    return Response.json({ error: "A valid CRM workspace is required so the widget agent can query modules and fields." }, { status: 400 });
  }

  const request: WidgetAgentRequest = {
    messages,
    name: typeof body.name === "string" ? body.name : "Untitled widget",
    description: typeof body.description === "string" ? body.description : "",
    uiBrief: typeof body.uiBrief === "string" ? body.uiBrief : "",
    fields: parseFields(body.fields),
    currentHtml: typeof body.currentHtml === "string" ? body.currentHtml : "",
    workspace,
  };

  try {
    const client = createWidgetAgentClient(apiKey);
    const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o";
    const result = await runWidgetAgent(request, client, model);
    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "OpenAI request failed.";
    return Response.json({ error: message }, { status: 502 });
  }
}
