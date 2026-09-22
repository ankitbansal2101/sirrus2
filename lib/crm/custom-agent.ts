import { newCrmId } from "@/lib/crm/ids";
import type { CrmAgentKind, CrmCustomAgent } from "@/lib/crm/types";

export const DEFAULT_CUSTOM_AGENT_TOOLS = [
  "list_workspace",
  "query_records",
  "list_records",
  "create_record",
  "update_record",
] as const;

export const CUSTOM_AGENT_MODELS = [
  { id: "", label: "Default (server OPENAI_MODEL)" },
  { id: "gpt-4o", label: "gpt-4o" },
  { id: "gpt-4o-mini", label: "gpt-4o-mini" },
  { id: "gpt-4.1", label: "gpt-4.1" },
  { id: "gpt-4.1-mini", label: "gpt-4.1-mini" },
] as const;

export function emptyCustomAgent(name: string, instructions: string, kind: CrmAgentKind = "on_call"): CrmCustomAgent {
  const now = new Date().toISOString();
  return {
    id: newCrmId("agt"),
    name: name.trim() || "Untitled agent",
    instructions: instructions.trim(),
    handoffDescription: "",
    model: "",
    tools: [...DEFAULT_CUSTOM_AGENT_TOOLS],
    handoffAgentIds: [],
    modelSettings: {
      temperature: null,
      topP: null,
      maxTokens: null,
      toolChoice: "auto",
    },
    resetToolChoice: true,
    toolUseBehavior: "run_llm_again",
    kind,
    createdAt: now,
    updatedAt: now,
  };
}
