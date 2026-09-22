import type { FieldDefinition } from "@/lib/fields-config/types";
import type { LeadFormLayoutV1 } from "@/lib/lead-form-layout/types";
import type { OverviewCanvasDocument, OverviewCustomWidgetDef } from "@/lib/crm/overview-canvas";

export const CRM_MODULE_ICONS = [
  "leads",
  "deals",
  "contacts",
  "visits",
  "bookings",
  "tickets",
  "custom",
] as const;

export type CrmModuleIcon = (typeof CRM_MODULE_ICONS)[number];

export type CrmRecord = {
  id: string;
  displayId: string;
  values: Record<string, string>;
  createdAt: string;
  updatedAt: string;
};

export type CrmBlueprintStage = {
  id: string;
  label: string;
};

export type CrmBlueprintTransition = {
  id: string;
  fromStageId: string;
  toStageId: string;
  label?: string;
};

export type CrmBlueprint = {
  stages: CrmBlueprintStage[];
  transitions: CrmBlueprintTransition[];
};

export const OVERVIEW_WIDGET_TYPES = [
  "header",
  "status",
  "details",
  "highlights",
  "activity",
] as const;

export type OverviewWidgetType = (typeof OVERVIEW_WIDGET_TYPES)[number];

export type OverviewWidget = {
  id: string;
  type: OverviewWidgetType;
  title: string;
  /** Field ids to show in this widget. */
  fieldIds: string[];
};

export type OverviewLayout = {
  widgets: OverviewWidget[];
};

export type CrmModule = {
  id: string;
  apiKey: string;
  label: string;
  pluralLabel: string;
  description: string;
  icon: CrmModuleIcon;
  nameFieldApiKey: string;
  stageFieldApiKey: string | null;
  fields: FieldDefinition[];
  formLayout: LeadFormLayoutV1;
  blueprint: CrmBlueprint;
  overviewLayout: OverviewLayout;
  /** Drag-drop details page (widgets-config-v2). Drives the record overview. */
  overviewCanvas?: OverviewCanvasDocument;
  /** Reusable custom widgets (field-mapped timeline/table/list) for this module’s overview. */
  customOverviewWidgets?: OverviewCustomWidgetDef[];
  listColumnFieldIds: string[];
  records: CrmRecord[];
  createdAt: string;
  /** Custom agent from Settings → Agents, used on this module’s listing. */
  listingAgentId?: string | null;
  /** On-call agent on the record overview (Ask agent). */
  recordAgentId?: string | null;
};

export type CrmWorkspace = {
  version: 1;
  orgName: string;
  industryId: string;
  industryLabel: string;
  onboardedAt: string;
  modules: CrmModule[];
  /** User-defined agents (OpenAI Agent-shaped: name, instructions, tools, modelSettings). */
  agents?: CrmCustomAgent[];
  /** Custom agent used by the left-rail workspace agent. */
  workspaceAgentId?: string | null;
  /** Per-screen agent overrides. Key = agent slot id; value = custom agent id or null (built-in default). */
  agentPlacements?: Record<string, string | null>;
  /** Trigger → agent → actions (HubSpot/Monday-style automations). */
  workflows?: AgentWorkflow[];
  /** AI-built iframe widgets for marketplace hosting. */
  marketplaceWidgets?: MarketplaceWidget[];
  /** Saved analytics charts (module + dimensions + measures). */
  charts?: WorkspaceChart[];
};

export const CHART_TYPES = ["bar", "line", "area", "pie", "donut", "table"] as const;
export type ChartType = (typeof CHART_TYPES)[number];

export const CHART_TIME_GRAINS = ["day", "week", "month", "quarter", "year"] as const;
export type ChartTimeGrain = (typeof CHART_TIME_GRAINS)[number];

export const CHART_MEASURE_FNS = ["count", "count_distinct", "sum", "avg", "min", "max"] as const;
export type ChartMeasureFn = (typeof CHART_MEASURE_FNS)[number];

/** Synthetic date fields available on every record. */
export const CHART_CREATED_AT = "__created_at";
export const CHART_UPDATED_AT = "__updated_at";

export type ChartDimension = {
  field: string;
  timeGrain?: ChartTimeGrain;
};

export type ChartMeasure = {
  id: string;
  fn: ChartMeasureFn;
  /** Required except for `count`. */
  field?: string;
  label?: string;
};

export type ChartFilter = {
  field: string;
  value: string;
};

export type WorkspaceChart = {
  id: string;
  name: string;
  description: string;
  prompt?: string;
  moduleId: string;
  chartType: ChartType;
  dimensions: ChartDimension[];
  measures: ChartMeasure[];
  filters?: ChartFilter[];
  createdAt: string;
  updatedAt: string;
};

export const MARKETPLACE_WIDGET_FIELD_TYPES = [
  "text",
  "number",
  "date",
  "select",
  "boolean",
  "currency",
  "image_url",
] as const;
export type MarketplaceWidgetFieldType = (typeof MARKETPLACE_WIDGET_FIELD_TYPES)[number];

export type MarketplaceWidgetField = {
  id: string;
  key: string;
  label: string;
  type: MarketplaceWidgetFieldType;
  required?: boolean;
  options?: string[];
};

export type MarketplaceWidgetQuery = {
  moduleId: string;
  operation: "list" | "aggregate" | "count";
  groupBy?: string;
  filters?: Array<{ field: string; value: string }>;
  contains?: string;
  limit?: number;
  listFieldKeys?: string[];
};

export type MarketplaceWidget = {
  id: string;
  name: string;
  description: string;
  fields: MarketplaceWidgetField[];
  uiBrief: string;
  html: string;
  published: boolean;
  version: number;
  /** Suggested iframe height in px for marketplace hosts. */
  embedHeight?: number;
  /** Live CRM query the iframe is bound to (module listing / aggregate). */
  query?: MarketplaceWidgetQuery;
  createdAt: string;
  updatedAt: string;
};

/** On-call = chat in the UI. Automation = runs from a workflow trigger. */
export const CRM_AGENT_KINDS = ["on_call", "automation"] as const;
export type CrmAgentKind = (typeof CRM_AGENT_KINDS)[number];

export const AUTOMATION_TRIGGER_TYPES = [
  "record_created",
  "record_updated",
  "stage_changed",
  "incoming_call",
  "call_completed",
  "incoming_chat",
  "manual",
] as const;
export type AutomationTriggerType = (typeof AUTOMATION_TRIGGER_TYPES)[number];

export const WORKFLOW_STEP_TYPES = ["run_agent", "change_stage", "update_field", "log"] as const;
export type WorkflowStepType = (typeof WORKFLOW_STEP_TYPES)[number];

export type AgentWorkflowStep = {
  id: string;
  type: WorkflowStepType;
  agentId?: string;
  prompt?: string;
  stageLabel?: string;
  fieldId?: string;
  value?: string;
  message?: string;
};

export type AgentWorkflowRun = {
  id: string;
  at: string;
  status: "ok" | "error" | "skipped";
  summary: string;
  recordId?: string;
};

export type AgentWorkflow = {
  id: string;
  name: string;
  enabled: boolean;
  moduleId: string;
  triggerType: AutomationTriggerType;
  /** For stage_changed: only when entering this option id. Empty = any stage change. */
  triggerStageOptionId?: string | null;
  steps: AgentWorkflowStep[];
  runs: AgentWorkflowRun[];
  createdAt: string;
  updatedAt: string;
};

/** Matches the OpenAI Agents SDK `Agent` constructor fields we persist and run. */
export const CRM_AGENT_TOOL_CHOICES = ["auto", "required", "none"] as const;
export type CrmAgentToolChoice = (typeof CRM_AGENT_TOOL_CHOICES)[number];

export const CRM_AGENT_TOOL_USE_BEHAVIORS = ["run_llm_again", "stop_on_first_tool"] as const;
export type CrmAgentToolUseBehavior = (typeof CRM_AGENT_TOOL_USE_BEHAVIORS)[number];

export type CrmCustomAgentModelSettings = {
  temperature: number | null;
  topP: number | null;
  maxTokens: number | null;
  toolChoice: CrmAgentToolChoice;
};

export type CrmCustomAgent = {
  id: string;
  name: string;
  instructions: string;
  handoffDescription: string;
  model: string;
  tools: string[];
  handoffAgentIds: string[];
  modelSettings: CrmCustomAgentModelSettings;
  resetToolChoice: boolean;
  toolUseBehavior: CrmAgentToolUseBehavior;
  /** Chat vs background automation. Missing on old data = on_call. */
  kind: CrmAgentKind;
  createdAt: string;
  updatedAt: string;
};

export type IndustryTemplate = {
  id: string;
  label: string;
  tagline: string;
  description: string;
  moduleSummaries: { label: string; description: string; icon: CrmModuleIcon }[];
  build: () => CrmModule[];
};
