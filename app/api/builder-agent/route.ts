import { createBuilderAgentClient, runBuilderAgent } from "@/lib/agent/builder-agent";
import type { AgentChatMessage } from "@/lib/agent/types";
import type { BuilderAgentRequest } from "@/lib/agent/types";
import { getSirrusMetadata, type SirrusMetadata } from "@/lib/blueprint/metadata/sirrus-metadata";
import type { BlueprintDocument } from "@/lib/blueprint/types";

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

function parseBlueprint(raw: unknown): BlueprintDocument | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.id !== "string" || typeof raw.name !== "string") return null;
  if (!Array.isArray(raw.states) || !Array.isArray(raw.transitions)) return null;
  return raw as unknown as BlueprintDocument;
}

function parseMetadata(raw: unknown): SirrusMetadata {
  if (!isRecord(raw)) return getSirrusMetadata();
  if (!Array.isArray(raw.modules) || !Array.isArray(raw.fields)) return getSirrusMetadata();
  return raw as unknown as SirrusMetadata;
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

  const request = {
    messages,
    currentBlueprint: parseBlueprint(body.currentBlueprint),
    metadata: parseMetadata(body.metadata),
    fieldDefinitions: Array.isArray(body.fieldDefinitions) ? (body.fieldDefinitions as BuilderAgentRequest["fieldDefinitions"]) : undefined,
  };

  try {
    const client = createBuilderAgentClient(apiKey);
    const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o";
    const result = await runBuilderAgent(request, client, model);
    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "OpenAI request failed.";
    return Response.json({ error: message }, { status: 502 });
  }
}
