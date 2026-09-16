import { createLeadsAgentClient, runLeadsAgent } from "@/lib/agent/leads-agent";
import type { AgentChatMessage, LeadsAgentRequest } from "@/lib/agent/types";
import type { FieldDefinition } from "@/lib/fields-config/types";
import type { LeadRecord } from "@/lib/leads/types";

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

function parseLeads(raw: unknown): LeadRecord[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((l): l is Record<string, unknown> => isRecord(l) && typeof l.id === "string")
    .map((l) => ({
      id: String(l.id),
      displayId: typeof l.displayId === "string" ? l.displayId : "",
      values: isRecord(l.values) ? (l.values as Record<string, string>) : {},
      createdAt: typeof l.createdAt === "string" ? l.createdAt : new Date().toISOString(),
      updatedAt: typeof l.updatedAt === "string" ? l.updatedAt : new Date().toISOString(),
      relatedDemo: isRecord(l.relatedDemo)
        ? (l.relatedDemo as LeadRecord["relatedDemo"])
        : undefined,
    }));
}

function parseFields(raw: unknown): FieldDefinition[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((f): f is Record<string, unknown> => isRecord(f) && typeof f.apiKey === "string" && typeof f.label === "string")
    .map((f) => ({
      ...(f as unknown as FieldDefinition),
      apiKey: String(f.apiKey),
      label: String(f.label),
      dataType: (typeof f.dataType === "string" ? f.dataType : "text") as FieldDefinition["dataType"],
      options: Array.isArray(f.options) ? (f.options as FieldDefinition["options"]) : [],
    }));
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

  const request: LeadsAgentRequest = {
    messages,
    leads: parseLeads(body.leads),
    fieldDefinitions: parseFields(body.fieldDefinitions),
    selectedLeadId: typeof body.selectedLeadId === "string" ? body.selectedLeadId : null,
  };

  try {
    const client = createLeadsAgentClient(apiKey);
    const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o";
    const result = await runLeadsAgent(request, client, model);
    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "OpenAI request failed.";
    return Response.json({ error: message }, { status: 502 });
  }
}
