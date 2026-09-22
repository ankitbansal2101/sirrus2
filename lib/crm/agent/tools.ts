import { FIELD_DATA_TYPES, type FieldDataType } from "@/lib/fields-config/types";
import {
  addField,
  addModule,
  addOverviewWidget,
  createRecord,
  setBlueprintStages,
  setFormLayout,
  setListColumns,
  setOverviewLayout,
  updateRecord,
} from "@/lib/crm/ops";
import { newCrmId } from "@/lib/crm/ids";
import { OVERVIEW_WIDGET_TYPES, type CrmModule, type CrmWorkspace, type OverviewWidgetType } from "@/lib/crm/types";
import type { RegisteredTool } from "@/lib/agent/tool-registry";
import {
  compactRecord,
  queryModuleRecords,
  queryWorkspaceRecords,
  type RecordQueryFilter,
  type RecordQueryOperation,
} from "@/lib/crm/agent/query-records";

function isRecord(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

function str(x: unknown): string {
  return typeof x === "string" ? x.trim() : "";
}

function strs(x: unknown): string[] {
  return Array.isArray(x) ? x.map((v) => String(v).trim()).filter(Boolean) : [];
}

export function resolveModule(ws: CrmWorkspace, ref: string) {
  const needle = ref.trim().toLowerCase();
  return (
    ws.modules.find(
      (m) =>
        m.id === ref ||
        m.apiKey.toLowerCase() === needle ||
        m.label.toLowerCase() === needle ||
        m.pluralLabel.toLowerCase() === needle,
    ) ?? undefined
  );
}

function resolveField(mod: CrmModule | undefined, ref: string) {
  if (!mod) return undefined;
  const needle = ref.trim().toLowerCase();
  return mod.fields.find((f) => f.id === ref || f.apiKey.toLowerCase() === needle || f.label.toLowerCase() === needle);
}

export function compactWorkspace(ws: CrmWorkspace) {
  return {
    orgName: ws.orgName,
    industryId: ws.industryId,
    industryLabel: ws.industryLabel,
    modules: ws.modules.map((m) => ({
      id: m.id,
      apiKey: m.apiKey,
      label: m.label,
      pluralLabel: m.pluralLabel,
      description: m.description,
      nameFieldApiKey: m.nameFieldApiKey,
      stageFieldApiKey: m.stageFieldApiKey,
      fields: m.fields.map((f) => ({
        apiKey: f.apiKey,
        label: f.label,
        dataType: f.dataType,
        required: f.required,
        options: f.options.map((o) => o.label),
      })),
      formSections: m.formLayout.sections.map((s) => ({
        title: s.title,
        fields: s.fieldIds.map((id) => m.fields.find((f) => f.id === id)?.label).filter(Boolean),
      })),
      blueprint: m.blueprint.stages.map((s) => s.label),
      overview: m.overviewLayout.widgets.map((w) => ({
        type: w.type,
        title: w.title,
        fields: w.fieldIds.map((id) => m.fields.find((f) => f.id === id)?.label).filter(Boolean),
      })),
      listColumns: m.listColumnFieldIds.map((id) => m.fields.find((f) => f.id === id)?.label).filter(Boolean),
      recordCount: m.records.length,
    })),
  };
}

type ToolOk = { success: true; summary: string; workspace: CrmWorkspace; extra?: unknown };
type ToolErr = { success: false; error: string; summary: string };
type ToolOut = ToolOk | ToolErr;

function ok(ws: CrmWorkspace, summary: string, extra?: unknown): ToolOk {
  return { success: true, workspace: ws, summary, extra };
}

function fail(error: string): ToolErr {
  return { success: false, error, summary: error };
}

function needWs(ws: CrmWorkspace | undefined): ws is CrmWorkspace {
  return !!ws;
}

export const crmListWorkspaceTool: RegisteredTool = {
  name: "list_workspace",
  description: "Inspect the current CRM workspace: modules, fields, forms, blueprints, overview widgets, and record counts.",
  inputSchema: { type: "object", additionalProperties: false, properties: {} },
  execute: (_input, ctx) => {
    if (!needWs(ctx.workspace)) return fail("No workspace loaded.");
    const compact = compactWorkspace(ctx.workspace);
    return {
      success: true,
      summary: `${compact.modules.length} module(s) in ${compact.orgName}.`,
      workspace: ctx.workspace,
      extra: compact,
      modules: compact.modules,
      orgName: compact.orgName,
      industryLabel: compact.industryLabel,
    };
  },
};

export const crmDescribeModuleTool: RegisteredTool = {
  name: "describe_module",
  description:
    "Look up one module by id, apiKey, label, or plural label (e.g. Enquiries, Leads). Returns fields, listing columns, stages, and sample records. Call this to find the right object and assignment field (Counsellor, Owner) before querying.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["module"],
    properties: {
      module: { type: "string", description: "Module id, apiKey, or label." },
    },
  },
  execute: (input, ctx) => {
    if (!needWs(ctx.workspace) || !isRecord(input)) return fail("No workspace loaded.");
    const ref = str(input.module);
    const mod = resolveModule(ctx.workspace, ref);
    if (!mod) {
      const names = ctx.workspace.modules.map((m) => m.pluralLabel).join(", ");
      return fail(`Module "${ref}" not found. Available: ${names || "none"}.`);
    }
    const listingColumns = mod.listColumnFieldIds
      .map((id) => mod.fields.find((f) => f.id === id))
      .filter((f): f is NonNullable<typeof f> => !!f)
      .map((f) => ({ apiKey: f.apiKey, label: f.label, dataType: f.dataType }));
    const samples = mod.records.slice(0, 8).map((r) => compactRecord(mod, r));
    return {
      success: true,
      summary: `${mod.pluralLabel}: ${mod.fields.length} fields, ${mod.records.length} records, listing [${listingColumns.map((c) => c.label).join(", ") || "none"}].`,
      workspace: ctx.workspace,
      module: {
        id: mod.id,
        apiKey: mod.apiKey,
        label: mod.label,
        pluralLabel: mod.pluralLabel,
        description: mod.description,
        nameFieldApiKey: mod.nameFieldApiKey,
        stageFieldApiKey: mod.stageFieldApiKey,
        fields: mod.fields.map((f) => ({
          apiKey: f.apiKey,
          label: f.label,
          dataType: f.dataType,
          options: f.options.map((o) => o.label),
        })),
        listingColumns,
        stages: mod.blueprint.stages.map((s) => s.label),
        recordCount: mod.records.length,
        sampleRecords: samples,
      },
    };
  },
};

export const crmCreateModuleTool: RegisteredTool = {
  name: "create_module",
  description: "Create a new industry-agnostic CRM module (object) with default name/stage/email fields.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["label"],
    properties: {
      label: { type: "string", description: "Singular label, e.g. Partner, Ticket, Listing." },
      description: { type: "string" },
    },
  },
  execute: (input, ctx) => {
    if (!needWs(ctx.workspace)) return fail("No workspace loaded.");
    const label = isRecord(input) ? str(input.label) : "";
    if (!label) return fail("Provide a module label.");
    const { workspace, module } = addModule(ctx.workspace, label, isRecord(input) ? str(input.description) : undefined);
    return ok(workspace, `Created module ${module.pluralLabel} (${module.apiKey}).`);
  },
};

export const crmAddFieldTool: RegisteredTool = {
  name: "add_field",
  description: "Add a field to a module. Use picklist/radio/multi_select with options when the user wants a dropdown.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["module", "label", "dataType"],
    properties: {
      module: { type: "string", description: "Module id, apiKey, or label." },
      label: { type: "string" },
      dataType: { type: "string", enum: [...FIELD_DATA_TYPES] },
      required: { type: "boolean" },
      options: { type: "array", items: { type: "string" }, description: "Choice labels for picklist, radio, or multi_select." },
    },
  },
  execute: (input, ctx): ToolOut => {
    if (!needWs(ctx.workspace) || !isRecord(input)) return fail("No workspace loaded.");
    const mod = resolveModule(ctx.workspace, str(input.module));
    if (!mod) return fail(`Module "${str(input.module)}" not found.`);
    const dataType = str(input.dataType) as FieldDataType;
    if (!FIELD_DATA_TYPES.includes(dataType)) return fail(`Unknown data type "${dataType}".`);
    try {
      const workspace = addField(ctx.workspace, mod.id, {
        label: str(input.label),
        dataType,
        required: Boolean(input.required),
        options: strs(input.options),
      });
      return ok(workspace, `Added field ${str(input.label)} (${dataType}) on ${mod.pluralLabel}.`);
    } catch (e) {
      return fail(e instanceof Error ? e.message : "Could not add field.");
    }
  },
};

export const crmSetBlueprintTool: RegisteredTool = {
  name: "set_blueprint",
  description: "Replace a module pipeline with ordered stage labels. Needs at least two stages.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["module", "stages"],
    properties: {
      module: { type: "string" },
      stages: { type: "array", items: { type: "string" }, description: "Happy-path stage labels in order." },
    },
  },
  execute: (input, ctx): ToolOut => {
    if (!needWs(ctx.workspace) || !isRecord(input)) return fail("No workspace loaded.");
    const mod = resolveModule(ctx.workspace, str(input.module));
    if (!mod) return fail(`Module "${str(input.module)}" not found.`);
    try {
      const workspace = setBlueprintStages(ctx.workspace, mod.id, strs(input.stages));
      return ok(workspace, `Updated ${mod.pluralLabel} pipeline: ${strs(input.stages).join(" → ")}.`);
    } catch (e) {
      return fail(e instanceof Error ? e.message : "Could not set blueprint.");
    }
  },
};

export const crmConfigureFormTool: RegisteredTool = {
  name: "configure_form",
  description: "Replace the create-record form layout: ordered sections, each with field labels already on the module.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["module", "sections"],
    properties: {
      module: { type: "string" },
      sections: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            fields: { type: "array", items: { type: "string" }, description: "Field labels or apiKeys." },
          },
          required: ["title", "fields"],
        },
      },
    },
  },
  execute: (input, ctx): ToolOut => {
    if (!needWs(ctx.workspace) || !isRecord(input)) return fail("No workspace loaded.");
    const mod = resolveModule(ctx.workspace, str(input.module));
    if (!mod) return fail(`Module "${str(input.module)}" not found.`);
    const rawSections = Array.isArray(input.sections) ? input.sections : [];
    const sections = rawSections.map((s) => {
      const rec = isRecord(s) ? s : {};
      const fieldIds = strs(rec.fields)
        .map((ref) => resolveField(mod, ref)?.id)
        .filter((id): id is string => !!id);
      return { id: newCrmId("sec"), title: str(rec.title) || "Section", fieldIds };
    });
    const workspace = setFormLayout(ctx.workspace, mod.id, { version: 1, sections });
    return ok(workspace, `Updated create form for ${mod.pluralLabel} (${sections.length} section(s)).`);
  },
};

export const crmConfigureOverviewTool: RegisteredTool = {
  name: "configure_overview",
  description: "Replace record overview widgets for a module. Widget types: header, status, details, highlights, activity.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["module", "widgets"],
    properties: {
      module: { type: "string" },
      widgets: {
        type: "array",
        items: {
          type: "object",
          required: ["type", "title"],
          properties: {
            type: { type: "string", enum: [...OVERVIEW_WIDGET_TYPES] },
            title: { type: "string" },
            fields: { type: "array", items: { type: "string" } },
          },
        },
      },
    },
  },
  execute: (input, ctx): ToolOut => {
    if (!needWs(ctx.workspace) || !isRecord(input)) return fail("No workspace loaded.");
    const mod = resolveModule(ctx.workspace, str(input.module));
    if (!mod) return fail(`Module "${str(input.module)}" not found.`);
    const raw = Array.isArray(input.widgets) ? input.widgets : [];
    const widgets = raw.map((w) => {
      const rec = isRecord(w) ? w : {};
      const type = (OVERVIEW_WIDGET_TYPES as readonly string[]).includes(str(rec.type))
        ? (str(rec.type) as OverviewWidgetType)
        : "details";
      const fieldIds = strs(rec.fields)
        .map((ref) => resolveField(mod, ref)?.id)
        .filter((id): id is string => !!id);
      return { id: newCrmId("wg"), type, title: str(rec.title) || "Widget", fieldIds };
    });
    const workspace = setOverviewLayout(ctx.workspace, mod.id, { widgets });
    return ok(workspace, `Updated overview for ${mod.pluralLabel} (${widgets.length} widget(s)).`);
  },
};

export const crmAddOverviewWidgetTool: RegisteredTool = {
  name: "add_overview_widget",
  description: "Append one widget to a module record overview and optionally map fields onto it.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["module", "type", "title"],
    properties: {
      module: { type: "string" },
      type: { type: "string", enum: [...OVERVIEW_WIDGET_TYPES] },
      title: { type: "string" },
      fields: { type: "array", items: { type: "string" } },
    },
  },
  execute: (input, ctx): ToolOut => {
    if (!needWs(ctx.workspace) || !isRecord(input)) return fail("No workspace loaded.");
    const mod = resolveModule(ctx.workspace, str(input.module));
    if (!mod) return fail(`Module "${str(input.module)}" not found.`);
    const type = str(input.type) as OverviewWidgetType;
    if (!(OVERVIEW_WIDGET_TYPES as readonly string[]).includes(type)) return fail(`Unknown widget type "${type}".`);
    const fieldIds = strs(input.fields)
      .map((ref) => resolveField(mod, ref)?.id)
      .filter((id): id is string => !!id);
    const workspace = addOverviewWidget(ctx.workspace, mod.id, { type, title: str(input.title), fieldIds });
    return ok(workspace, `Added ${type} widget "${str(input.title)}" on ${mod.pluralLabel}.`);
  },
};

export const crmSetListColumnsTool: RegisteredTool = {
  name: "set_list_columns",
  description: "Choose which fields appear as columns on the module listing screen.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["module", "fields"],
    properties: {
      module: { type: "string" },
      fields: { type: "array", items: { type: "string" } },
    },
  },
  execute: (input, ctx): ToolOut => {
    if (!needWs(ctx.workspace) || !isRecord(input)) return fail("No workspace loaded.");
    const mod = resolveModule(ctx.workspace, str(input.module));
    if (!mod) return fail(`Module "${str(input.module)}" not found.`);
    const fieldIds = strs(input.fields)
      .map((ref) => resolveField(mod, ref)?.id)
      .filter((id): id is string => !!id);
    const workspace = setListColumns(ctx.workspace, mod.id, fieldIds);
    return ok(workspace, `Updated list columns for ${mod.pluralLabel}.`);
  },
};

export const crmQueryRecordsTool: RegisteredTool = {
  name: "query_records",
  description:
    "Count, list, or group records. Pass a module (id, apiKey, or label) to stay on one object, or omit module to query every module. Use filters for stage/field equals, contains for text search, groupBy for breakdowns. Always call this instead of inventing counts or names.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      module: { type: "string", description: "Optional. Module id, apiKey, or label. Omit to search all modules." },
      operation: { type: "string", enum: ["count", "list", "aggregate"] },
      contains: { type: "string", description: "Free-text search across id, name, and field values." },
      filters: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["field", "value"],
          properties: {
            field: { type: "string", description: "Field label or apiKey, e.g. Stage." },
            value: { type: "string", description: "Value or option label to match." },
          },
        },
      },
      groupBy: { type: "string", description: "Field to group by for aggregate, e.g. Stage." },
      limit: { type: "number" },
    },
  },
  execute: (input, ctx) => {
    if (!needWs(ctx.workspace)) return fail("No workspace loaded.");
    const rec = isRecord(input) ? input : {};
    const opRaw = str(rec.operation);
    const filters: RecordQueryFilter[] = Array.isArray(rec.filters)
      ? rec.filters
          .filter((f): f is Record<string, unknown> => isRecord(f))
          .map((f) => ({ field: str(f.field), value: str(f.value) }))
          .filter((f) => f.field)
      : [];
    const operation: RecordQueryOperation =
      opRaw === "list" || opRaw === "aggregate" || opRaw === "count"
        ? opRaw
        : str(rec.contains) || filters.length
          ? "list"
          : "count";
    const payload = {
      operation,
      contains: str(rec.contains) || undefined,
      filters,
      groupBy: str(rec.groupBy) || undefined,
      limit: typeof rec.limit === "number" ? rec.limit : undefined,
    };
    const moduleRef = str(rec.module);
    if (!moduleRef) {
      const result = queryWorkspaceRecords(ctx.workspace, payload);
      return { ...result, workspace: ctx.workspace };
    }
    const mod = resolveModule(ctx.workspace, moduleRef);
    if (!mod) return fail(`Module "${moduleRef}" not found.`);
    const result = queryModuleRecords(mod, payload);
    return { ...result, workspace: ctx.workspace };
  },
};

export const crmListRecordsTool: RegisteredTool = {
  name: "list_records",
  description: "List records for a module (compact, with display labels). Prefer query_records when counting or filtering.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["module"],
    properties: {
      module: { type: "string" },
      limit: { type: "number" },
    },
  },
  execute: (input, ctx) => {
    if (!needWs(ctx.workspace) || !isRecord(input)) return fail("No workspace loaded.");
    const mod = resolveModule(ctx.workspace, str(input.module));
    if (!mod) return fail(`Module "${str(input.module)}" not found.`);
    const limit = typeof input.limit === "number" ? input.limit : 25;
    const records = mod.records.slice(0, limit).map((r) => compactRecord(mod, r));
    return {
      success: true,
      summary: `${records.length} of ${mod.records.length} ${mod.pluralLabel.toLowerCase()}.`,
      workspace: ctx.workspace,
      records,
      count: mod.records.length,
    };
  },
};

export const crmCreateRecordTool: RegisteredTool = {
  name: "create_record",
  description: "Create a record on a module. values keys must be field apiKeys (or labels). Picklist values should be option labels.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["module", "values"],
    properties: {
      module: { type: "string" },
      values: { type: "object", additionalProperties: { type: "string" } },
    },
  },
  execute: (input, ctx): ToolOut => {
    if (!needWs(ctx.workspace) || !isRecord(input)) return fail("No workspace loaded.");
    const mod = resolveModule(ctx.workspace, str(input.module));
    if (!mod) return fail(`Module "${str(input.module)}" not found.`);
    const raw = isRecord(input.values) ? input.values : {};
    const values: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      const field = resolveField(mod, k);
      if (!field) continue;
      const text = String(v ?? "");
      const opt = field.options.find((o) => o.label.toLowerCase() === text.toLowerCase() || o.id === text);
      values[field.apiKey] = opt?.id ?? text;
    }
    const { workspace, record } = createRecord(ctx.workspace, mod.id, values);
    return ok(workspace, `Created ${record.displayId} on ${mod.pluralLabel}.`);
  },
};

export const crmUpdateRecordTool: RegisteredTool = {
  name: "update_record",
  description: "Update field values on a record identified by id, displayId, or name.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["module", "record", "values"],
    properties: {
      module: { type: "string" },
      record: { type: "string", description: "Record id, displayId, or name." },
      values: { type: "object", additionalProperties: { type: "string" } },
    },
  },
  execute: (input, ctx): ToolOut => {
    if (!needWs(ctx.workspace) || !isRecord(input)) return fail("No workspace loaded.");
    const mod = resolveModule(ctx.workspace, str(input.module));
    if (!mod) return fail(`Module "${str(input.module)}" not found.`);
    const recRef = str(input.record).toLowerCase();
    const rec = mod.records.find((r) => {
      const name = (r.values[mod.nameFieldApiKey] ?? "").toLowerCase();
      return r.id === str(input.record) || r.displayId.toLowerCase() === recRef || name === recRef || name.includes(recRef);
    });
    if (!rec) return fail(`Record "${str(input.record)}" not found.`);
    const raw = isRecord(input.values) ? input.values : {};
    const values: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      const field = resolveField(mod, k);
      if (!field) continue;
      const text = String(v ?? "");
      const opt = field.options.find((o) => o.label.toLowerCase() === text.toLowerCase() || o.id === text);
      values[field.apiKey] = opt?.id ?? text;
    }
    const workspace = updateRecord(ctx.workspace, mod.id, rec.id, values);
    return ok(workspace, `Updated ${rec.displayId} on ${mod.pluralLabel}.`);
  },
};

export const CRM_RECORD_TOOLS: RegisteredTool[] = [
  crmListWorkspaceTool,
  crmQueryRecordsTool,
  crmListRecordsTool,
  crmCreateRecordTool,
  crmUpdateRecordTool,
];

export const WIDGET_AGENT_TOOLS: RegisteredTool[] = [
  crmListWorkspaceTool,
  crmDescribeModuleTool,
  crmQueryRecordsTool,
  crmListRecordsTool,
];

export const CRM_AGENT_TOOLS: RegisteredTool[] = [
  crmListWorkspaceTool,
  crmDescribeModuleTool,
  crmCreateModuleTool,
  crmAddFieldTool,
  crmSetBlueprintTool,
  crmConfigureFormTool,
  crmConfigureOverviewTool,
  crmAddOverviewWidgetTool,
  crmSetListColumnsTool,
  crmQueryRecordsTool,
  crmListRecordsTool,
  crmCreateRecordTool,
  crmUpdateRecordTool,
];

export function agentToolCatalog() {
  const recordNames = new Set(CRM_RECORD_TOOLS.map((t) => t.name));
  return [
    {
      id: "records",
      label: "Records",
      tools: CRM_RECORD_TOOLS.map((t) => ({ name: t.name, description: t.description })),
    },
    {
      id: "metadata",
      label: "Metadata (Settings)",
      tools: CRM_AGENT_TOOLS.filter((t) => !recordNames.has(t.name)).map((t) => ({
        name: t.name,
        description: t.description,
      })),
    },
  ];
}
