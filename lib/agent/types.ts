import type { BlueprintDocument } from "@/lib/blueprint/types";
import type { BlueprintValidationResult } from "@/lib/blueprint/validator/validate-blueprint";
import type { SirrusMetadata } from "@/lib/blueprint/metadata/sirrus-metadata";
import type { FieldDefinition } from "@/lib/fields-config/types";

export type AgentChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AgentTraceStep = {
  id: string;
  label: string;
  detail?: string;
  status: "ok" | "warn" | "error";
};

export type BuilderAgentRequest = {
  messages: AgentChatMessage[];
  currentBlueprint: BlueprintDocument | null;
  metadata: SirrusMetadata;
  fieldDefinitions?: FieldDefinition[];
};

export type BuilderAgentResult = {
  assistantMessage: string;
  traces: AgentTraceStep[];
  blueprint: BlueprintDocument | null;
  validation: BlueprintValidationResult | null;
  changed: boolean;
  summary?: string;
};

/** Future Sirrus configuration tools — only `blueprint_builder` is registered in this prototype. */
export type FutureToolName =
  | "blueprint_builder"
  | "module_builder"
  | "field_builder"
  | "relationship_builder"
  | "automation_builder"
  | "form_builder"
  | "dashboard_builder"
  | "agent_builder";
