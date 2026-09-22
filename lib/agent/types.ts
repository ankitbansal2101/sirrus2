import type { BlueprintDocument } from "@/lib/blueprint/types";
import type { BlueprintValidationResult } from "@/lib/blueprint/validator/validate-blueprint";
import type { SirrusMetadata } from "@/lib/blueprint/metadata/sirrus-metadata";
import type { FieldDefinition } from "@/lib/fields-config/types";
import type { LeadRecord } from "@/lib/leads/types";
import type { CrmWorkspace } from "@/lib/crm/types";

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

export type LeadsAgentRequest = {
  messages: AgentChatMessage[];
  leads: LeadRecord[];
  fieldDefinitions: FieldDefinition[];
  selectedLeadId?: string | null;
};

export type LeadsAgentResult = {
  assistantMessage: string;
  traces: AgentTraceStep[];
  leads: LeadRecord[] | null;
  changed: boolean;
  summary?: string;
  matchedCount?: number;
};

export type CrmAgentMode = "config" | "records" | "universal" | "custom";

export type CrmAgentRequest = {
  messages: AgentChatMessage[];
  workspace: CrmWorkspace;
  focusModuleId?: string | null;
  mode?: CrmAgentMode;
  customAgentId?: string | null;
};

export type CrmAgentResult = {
  assistantMessage: string;
  traces: AgentTraceStep[];
  workspace: CrmWorkspace | null;
  changed: boolean;
  summary?: string;
};

export type WidgetAgentField = {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
};

export type WidgetAgentQuery = {
  moduleId: string;
  operation: "list" | "aggregate" | "count";
  groupBy?: string;
  filters?: Array<{ field: string; value: string }>;
  contains?: string;
  limit?: number;
  listFieldKeys?: string[];
};

export type WidgetAgentRequest = {
  messages: AgentChatMessage[];
  name: string;
  description?: string;
  uiBrief: string;
  fields: WidgetAgentField[];
  currentHtml?: string;
  workspace: import("@/lib/crm/types").CrmWorkspace;
};

export type WidgetAgentResult = {
  assistantMessage: string;
  html: string | null;
  fields?: WidgetAgentField[];
  query?: WidgetAgentQuery | null;
  name?: string;
  traces: AgentTraceStep[];
};

export type ChartAgentRequest = {
  messages: AgentChatMessage[];
  current?: {
    name?: string;
    moduleId?: string;
    chartType?: string;
    dimensions?: Array<{ field: string; timeGrain?: string }>;
    measures?: Array<{ fn: string; field?: string; label?: string }>;
  } | null;
};

export type ChartAgentChart = {
  name: string;
  description?: string;
  moduleId: string;
  chartType: string;
  dimensions: Array<{ field: string; timeGrain?: string }>;
  measures: Array<{ fn: string; field?: string; label?: string }>;
  filters?: Array<{ field: string; value: string }>;
};

export type ChartAgentResult = {
  assistantMessage: string;
  chart: ChartAgentChart | null;
  traces: AgentTraceStep[];
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
  | "agent_builder"
  | "widget_builder"
  | "chart_builder";
