import { createFieldFromDataType, type FieldDataType } from "@/lib/fields-config/types";
import { newCrmId, nextDisplayId, slugifyCrm } from "@/lib/crm/ids";
import { emptyCustomModule } from "@/lib/crm/module-factory";
import { emptyCustomAgent } from "@/lib/crm/custom-agent";
import { industryById } from "@/lib/crm/templates";
import type {
  AgentWorkflow,
  CrmAgentKind,
  CrmCustomAgent,
  CrmModule,
  CrmRecord,
  CrmWorkspace,
  OverviewLayout,
  OverviewWidget,
  MarketplaceWidget,
  MarketplaceWidgetField,
  OverviewWidgetType,
  WorkspaceChart,
  ChartType,
  ChartDimension,
  ChartMeasure,
  ChartFilter,
} from "@/lib/crm/types";
import type { OverviewCanvasDocument, OverviewCustomWidgetDef } from "@/lib/crm/overview-canvas";
import type { LeadFormLayoutV1 } from "@/lib/lead-form-layout/types";
function clone<T>(x: T): T {
  return structuredClone(x);
}

export function createWorkspace(input: {
  orgName: string;
  industryId: string;
  includeModuleApiKeys?: string[];
}): CrmWorkspace {
  const industry = industryById(input.industryId);
  if (!industry) {
    throw new Error(`Unknown industry "${input.industryId}".`);
  }
  let modules = industry.build();
  if (input.includeModuleApiKeys?.length) {
    const allow = new Set(input.includeModuleApiKeys);
    modules = modules.filter((m) => allow.has(m.apiKey));
  }
  return {
    version: 1,
    orgName: input.orgName.trim() || "My organization",
    industryId: industry.id,
    industryLabel: industry.label,
    onboardedAt: new Date().toISOString(),
    modules,
    agents: [],
    workspaceAgentId: null,
    workflows: [],
    marketplaceWidgets: [],
    charts: [],
  };
}

export function findModule(ws: CrmWorkspace, moduleId: string): CrmModule | undefined {
  return ws.modules.find((m) => m.id === moduleId || m.apiKey === moduleId);
}

export function addModule(ws: CrmWorkspace, label: string, description?: string): { workspace: CrmWorkspace; module: CrmModule } {
  const next = clone(ws);
  const mod = emptyCustomModule(label.trim() || "Module");
  if (description?.trim()) mod.description = description.trim();
  const existing = new Set(next.modules.map((m) => m.apiKey));
  let key = mod.apiKey;
  let n = 2;
  while (existing.has(key)) {
    key = `${mod.apiKey}_${n}`;
    n += 1;
  }
  mod.apiKey = key;
  next.modules.push(mod);
  return { workspace: next, module: mod };
}

export function updateModuleMeta(
  ws: CrmWorkspace,
  moduleId: string,
  patch: Partial<Pick<CrmModule, "label" | "pluralLabel" | "description" | "icon">>,
): CrmWorkspace {
  const next = clone(ws);
  const mod = findModule(next, moduleId);
  if (!mod) throw new Error(`Module "${moduleId}" not found.`);
  Object.assign(mod, patch);
  return next;
}

export function addField(
  ws: CrmWorkspace,
  moduleId: string,
  input: { label: string; dataType: FieldDataType; apiKey?: string; required?: boolean; options?: string[] },
): CrmWorkspace {
  const next = clone(ws);
  const mod = findModule(next, moduleId);
  if (!mod) throw new Error(`Module "${moduleId}" not found.`);
  const field = createFieldFromDataType(input.dataType);
  field.label = input.label.trim() || field.label;
  field.apiKey = slugifyCrm(input.apiKey || field.label);
  field.required = Boolean(input.required);
  if (input.options?.length && (input.dataType === "picklist" || input.dataType === "multi_select" || input.dataType === "radio")) {
    field.options = input.options.map((label) => ({
      id: newCrmId("opt"),
      label,
      value: slugifyCrm(label),
    }));
    field.defaultOptionId = field.options[0]?.id;
  }
  if (mod.fields.some((f) => f.apiKey === field.apiKey)) {
    field.apiKey = `${field.apiKey}_${field.id.slice(0, 6)}`;
  }
  mod.fields.push(field);
  const firstSection = mod.formLayout.sections[0];
  if (firstSection && !firstSection.fieldIds.includes(field.id)) {
    firstSection.fieldIds.push(field.id);
  }
  if (mod.listColumnFieldIds.length < 6) mod.listColumnFieldIds.push(field.id);
  return next;
}

export function setFormLayout(ws: CrmWorkspace, moduleId: string, layout: LeadFormLayoutV1): CrmWorkspace {
  const next = clone(ws);
  const mod = findModule(next, moduleId);
  if (!mod) throw new Error(`Module "${moduleId}" not found.`);
  mod.formLayout = layout;
  return next;
}

export function setBlueprintStages(ws: CrmWorkspace, moduleId: string, stageLabels: string[]): CrmWorkspace {
  const next = clone(ws);
  const mod = findModule(next, moduleId);
  if (!mod) throw new Error(`Module "${moduleId}" not found.`);
  const labels = stageLabels.map((s) => s.trim()).filter(Boolean);
  if (labels.length < 2) throw new Error("A blueprint needs at least two stages.");
  const stages = labels.map((label) => ({ id: newCrmId("st"), label }));
  const transitions = stages.slice(0, -1).map((from, i) => ({
    id: newCrmId("tr"),
    fromStageId: from.id,
    toStageId: stages[i + 1]!.id,
  }));
  mod.blueprint = { stages, transitions };
  const stageField = mod.fields.find((f) => f.apiKey === (mod.stageFieldApiKey ?? "stage"));
  if (stageField) {
    stageField.options = labels.map((label) => ({ id: newCrmId("opt"), label, value: slugifyCrm(label) }));
    stageField.defaultOptionId = stageField.options[0]?.id;
  }
  return next;
}

export function setOverviewLayout(ws: CrmWorkspace, moduleId: string, layout: OverviewLayout): CrmWorkspace {
  const next = clone(ws);
  const mod = findModule(next, moduleId);
  if (!mod) throw new Error(`Module "${moduleId}" not found.`);
  mod.overviewLayout = layout;
  return next;
}

export function setOverviewCanvas(ws: CrmWorkspace, moduleId: string, canvas: OverviewCanvasDocument): CrmWorkspace {
  const next = clone(ws);
  const mod = findModule(next, moduleId);
  if (!mod) throw new Error(`Module "${moduleId}" not found.`);
  mod.overviewCanvas = canvas;
  return next;
}

export function setCustomOverviewWidgets(
  ws: CrmWorkspace,
  moduleId: string,
  widgets: OverviewCustomWidgetDef[],
): CrmWorkspace {
  const next = clone(ws);
  const mod = findModule(next, moduleId);
  if (!mod) throw new Error(`Module "${moduleId}" not found.`);
  mod.customOverviewWidgets = widgets;
  return next;
}

export function saveOverviewBuilder(
  ws: CrmWorkspace,
  moduleId: string,
  canvas: OverviewCanvasDocument,
  customWidgets: OverviewCustomWidgetDef[],
): CrmWorkspace {
  const next = setOverviewCanvas(ws, moduleId, canvas);
  return setCustomOverviewWidgets(next, moduleId, customWidgets);
}

export function addOverviewWidget(
  ws: CrmWorkspace,
  moduleId: string,
  input: { type: OverviewWidgetType; title: string; fieldIds?: string[] },
): CrmWorkspace {
  const next = clone(ws);
  const mod = findModule(next, moduleId);
  if (!mod) throw new Error(`Module "${moduleId}" not found.`);
  const widget: OverviewWidget = {
    id: newCrmId("wg"),
    type: input.type,
    title: input.title.trim() || "Widget",
    fieldIds: input.fieldIds ?? [],
  };
  mod.overviewLayout.widgets.push(widget);
  return next;
}

export function setListColumns(ws: CrmWorkspace, moduleId: string, fieldIds: string[]): CrmWorkspace {
  const next = clone(ws);
  const mod = findModule(next, moduleId);
  if (!mod) throw new Error(`Module "${moduleId}" not found.`);
  const valid = new Set(mod.fields.map((f) => f.id));
  mod.listColumnFieldIds = fieldIds.filter((id) => valid.has(id));
  return next;
}

export function createRecord(
  ws: CrmWorkspace,
  moduleId: string,
  values: Record<string, string>,
): { workspace: CrmWorkspace; record: CrmRecord } {
  const next = clone(ws);
  const mod = findModule(next, moduleId);
  if (!mod) throw new Error(`Module "${moduleId}" not found.`);
  const prefix = mod.apiKey.slice(0, 1).toUpperCase();
  const rec: CrmRecord = {
    id: newCrmId("rec"),
    displayId: nextDisplayId(mod.records, prefix),
    values,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  mod.records.unshift(rec);
  return { workspace: next, record: rec };
}

export function updateRecord(
  ws: CrmWorkspace,
  moduleId: string,
  recordId: string,
  values: Record<string, string>,
): CrmWorkspace {
  const next = clone(ws);
  const mod = findModule(next, moduleId);
  if (!mod) throw new Error(`Module "${moduleId}" not found.`);
  const rec = mod.records.find((r) => r.id === recordId || r.displayId === recordId);
  if (!rec) throw new Error(`Record "${recordId}" not found.`);
  rec.values = { ...rec.values, ...values };
  rec.updatedAt = new Date().toISOString();
  return next;
}

export function listRecordsCompact(mod: CrmModule, limit = 25) {
  return mod.records.slice(0, limit).map((r) => ({
    id: r.id,
    displayId: r.displayId,
    name: r.values[mod.nameFieldApiKey] ?? "",
    values: r.values,
  }));
}

export function blankWorkspace(orgName = "My organization"): CrmWorkspace {
  return {
    version: 1,
    orgName,
    industryId: "blank",
    industryLabel: "Custom",
    onboardedAt: new Date().toISOString(),
    modules: [],
    agents: [],
    workspaceAgentId: null,
    workflows: [],
    marketplaceWidgets: [],
    charts: [],
  };
}

export function chartsOf(ws: CrmWorkspace): WorkspaceChart[] {
  return ws.charts ?? [];
}

export function findChart(ws: CrmWorkspace, chartId: string): WorkspaceChart | undefined {
  return chartsOf(ws).find((c) => c.id === chartId);
}

export function addChart(
  ws: CrmWorkspace,
  input: {
    name?: string;
    description?: string;
    prompt?: string;
    moduleId?: string;
    chartType?: ChartType;
    dimensions?: ChartDimension[];
    measures?: ChartMeasure[];
    filters?: ChartFilter[];
  },
): { workspace: CrmWorkspace; chart: WorkspaceChart } {
  const next = clone(ws);
  const now = new Date().toISOString();
  const firstModule = next.modules[0];
  const chart: WorkspaceChart = {
    id: newCrmId("cht"),
    name: input.name?.trim() || "Untitled chart",
    description: input.description?.trim() ?? "",
    prompt: input.prompt?.trim() || undefined,
    moduleId: input.moduleId || firstModule?.id || "",
    chartType: input.chartType ?? "bar",
    dimensions: input.dimensions ?? [{ field: "__created_at", timeGrain: "month" }],
    measures: input.measures ?? [{ id: newCrmId("ms"), fn: "count", label: "Count" }],
    filters: input.filters ?? [],
    createdAt: now,
    updatedAt: now,
  };
  next.charts = [...chartsOf(next), chart];
  return { workspace: next, chart };
}

export function updateChart(ws: CrmWorkspace, chartId: string, patch: Partial<WorkspaceChart>): CrmWorkspace {
  const next = clone(ws);
  const chart = findChart(next, chartId);
  if (!chart) throw new Error(`Chart "${chartId}" not found.`);
  Object.assign(chart, patch, { updatedAt: new Date().toISOString() });
  return next;
}

export function removeChart(ws: CrmWorkspace, chartId: string): CrmWorkspace {
  const next = clone(ws);
  next.charts = chartsOf(next).filter((c) => c.id !== chartId);
  return next;
}

export function widgetsOf(ws: CrmWorkspace): MarketplaceWidget[] {
  return ws.marketplaceWidgets ?? [];
}

export function findWidget(ws: CrmWorkspace, widgetId: string): MarketplaceWidget | undefined {
  return widgetsOf(ws).find((w) => w.id === widgetId);
}

export function addMarketplaceWidget(
  ws: CrmWorkspace,
  input: { name: string; description?: string; fields?: MarketplaceWidgetField[]; uiBrief?: string },
): { workspace: CrmWorkspace; widget: MarketplaceWidget } {
  const next = clone(ws);
  const now = new Date().toISOString();
  const widget: MarketplaceWidget = {
    id: newCrmId("wgt"),
    name: input.name.trim() || "Untitled widget",
    description: input.description?.trim() ?? "",
    fields: input.fields ?? [],
    uiBrief: input.uiBrief?.trim() ?? "",
    html: "",
    published: false,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
  next.marketplaceWidgets = [...widgetsOf(next), widget];
  return { workspace: next, widget };
}

export function updateMarketplaceWidget(
  ws: CrmWorkspace,
  widgetId: string,
  patch: Partial<MarketplaceWidget>,
): CrmWorkspace {
  const next = clone(ws);
  const widget = findWidget(next, widgetId);
  if (!widget) throw new Error(`Widget "${widgetId}" not found.`);
  const htmlChanged = patch.html !== undefined && patch.html !== widget.html;
  Object.assign(widget, patch, { updatedAt: new Date().toISOString() });
  if (htmlChanged) widget.version = (widget.version || 1) + 1;
  return next;
}

export function removeMarketplaceWidget(ws: CrmWorkspace, widgetId: string): CrmWorkspace {
  const next = clone(ws);
  next.marketplaceWidgets = widgetsOf(next).filter((w) => w.id !== widgetId);
  return next;
}

export function removeModule(ws: CrmWorkspace, moduleId: string): CrmWorkspace {
  const next = clone(ws);
  next.modules = next.modules.filter((m) => m.id !== moduleId && m.apiKey !== moduleId);
  return next;
}

export function setModuleFields(ws: CrmWorkspace, moduleId: string, fields: CrmModule["fields"]): CrmWorkspace {
  const next = clone(ws);
  const mod = findModule(next, moduleId);
  if (!mod) throw new Error(`Module "${moduleId}" not found.`);
  const valid = new Set(fields.map((f) => f.id));
  mod.fields = fields;
  mod.formLayout = {
    version: 1,
    sections: mod.formLayout.sections.map((s) => ({
      ...s,
      fieldIds: s.fieldIds.filter((id) => valid.has(id)),
    })),
  };
  mod.listColumnFieldIds = mod.listColumnFieldIds.filter((id) => valid.has(id));
  return next;
}

export function blueprintIdForModule(moduleId: string): string {
  return `bp_mod_${moduleId}`;
}

export function agentsOf(ws: CrmWorkspace): CrmCustomAgent[] {
  return ws.agents ?? [];
}

export function findAgent(ws: CrmWorkspace, agentId: string): CrmCustomAgent | undefined {
  return agentsOf(ws).find((a) => a.id === agentId);
}

export function addAgent(
  ws: CrmWorkspace,
  name: string,
  instructions: string,
  kind: CrmAgentKind = "on_call",
): { workspace: CrmWorkspace; agent: CrmCustomAgent } {
  const next = clone(ws);
  const agent = emptyCustomAgent(name, instructions, kind);
  next.agents = [...agentsOf(next), agent];
  return { workspace: next, agent };
}

export function updateAgent(ws: CrmWorkspace, agentId: string, patch: Partial<CrmCustomAgent>): CrmWorkspace {
  const next = clone(ws);
  const agent = findAgent(next, agentId);
  if (!agent) throw new Error(`Agent "${agentId}" not found.`);
  Object.assign(agent, patch, { updatedAt: new Date().toISOString() });
  return next;
}

function clearAgentPlacements(ws: CrmWorkspace, agentId: string): CrmWorkspace {
  const next = clone(ws);
  const placements = { ...(next.agentPlacements ?? {}) };
  for (const key of Object.keys(placements)) {
    if (placements[key] === agentId) placements[key] = null;
  }
  next.agentPlacements = placements;
  if (next.workspaceAgentId === agentId) next.workspaceAgentId = null;
  for (const mod of next.modules) {
    if (mod.listingAgentId === agentId) mod.listingAgentId = null;
    if (mod.recordAgentId === agentId) mod.recordAgentId = null;
  }
  return next;
}

export function removeAgent(ws: CrmWorkspace, agentId: string): CrmWorkspace {
  let next = clone(ws);
  next.agents = agentsOf(next).filter((a) => a.id !== agentId);
  next = clearAgentPlacements(next, agentId);
  for (const agent of agentsOf(next)) {
    agent.handoffAgentIds = agent.handoffAgentIds.filter((id) => id !== agentId);
  }
  for (const wf of next.workflows ?? []) {
    wf.steps = wf.steps.map((s) => (s.type === "run_agent" && s.agentId === agentId ? { ...s, agentId: undefined } : s));
  }
  return next;
}

export function setWorkspaceAgent(ws: CrmWorkspace, agentId: string | null): CrmWorkspace {
  const next = clone(ws);
  next.workspaceAgentId = agentId && findAgent(next, agentId) ? agentId : null;
  return next;
}

export function setModuleListingAgent(ws: CrmWorkspace, moduleId: string, agentId: string | null): CrmWorkspace {
  const next = clone(ws);
  const mod = findModule(next, moduleId);
  if (!mod) throw new Error(`Module "${moduleId}" not found.`);
  mod.listingAgentId = agentId && findAgent(next, agentId) ? agentId : null;
  return next;
}

export function setModuleRecordAgent(ws: CrmWorkspace, moduleId: string, agentId: string | null): CrmWorkspace {
  const next = clone(ws);
  const mod = findModule(next, moduleId);
  if (!mod) throw new Error(`Module "${moduleId}" not found.`);
  mod.recordAgentId = agentId && findAgent(next, agentId) ? agentId : null;
  return next;
}

export function workflowsOfWs(ws: CrmWorkspace): AgentWorkflow[] {
  return ws.workflows ?? [];
}

export function findWorkflow(ws: CrmWorkspace, workflowId: string): AgentWorkflow | undefined {
  return workflowsOfWs(ws).find((w) => w.id === workflowId);
}

export function addWorkflow(ws: CrmWorkspace, workflow: AgentWorkflow): CrmWorkspace {
  const next = clone(ws);
  next.workflows = [...workflowsOfWs(next), workflow];
  return next;
}

export function updateWorkflow(ws: CrmWorkspace, workflowId: string, patch: Partial<AgentWorkflow>): CrmWorkspace {
  const next = clone(ws);
  const wf = findWorkflow(next, workflowId);
  if (!wf) throw new Error(`Workflow "${workflowId}" not found.`);
  Object.assign(wf, patch, { updatedAt: new Date().toISOString() });
  return next;
}

export function removeWorkflow(ws: CrmWorkspace, workflowId: string): CrmWorkspace {
  const next = clone(ws);
  next.workflows = workflowsOfWs(next).filter((w) => w.id !== workflowId);
  return next;
}
