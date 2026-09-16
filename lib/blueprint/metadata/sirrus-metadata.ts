/**
 * Prototype Sirrus metadata provider.
 * Later replace `getSirrusMetadata` internals with real Sirrus APIs — keep this contract stable.
 */
import { bookingPrototypeFields } from "@/lib/blueprint/after-transition-runtime";
import { TRANSITION_TOOL_PRESETS } from "@/lib/blueprint/transition-tools";
import { createDefaultLeadFields } from "@/lib/fields-config/types";
import type { FieldDefinition } from "@/lib/fields-config/types";
import { fieldsForConnectedModule } from "@/lib/leads/connected-module-fields";

export type SirrusMetadataModule = {
  id: string;
  label: string;
  lifecycleFieldApiKey?: string;
};

export type SirrusMetadataField = {
  id: string;
  apiKey: string;
  label: string;
  moduleId: string;
  dataType: string;
  required: boolean;
  options: { id: string; label: string }[];
  aliases: string[];
};

export type SirrusMetadataTaskType = {
  id: string;
  label: string;
  aliases: string[];
};

export type SirrusMetadataBlueprintRef = {
  id: string;
  name: string;
  module: string;
  stageField: string;
  stageLabels: string[];
};

export type SirrusMetadataAction = {
  id: string;
  label: string;
};

export type SirrusMetadata = {
  modules: SirrusMetadataModule[];
  fields: SirrusMetadataField[];
  taskTypes: SirrusMetadataTaskType[];
  existingBlueprints: SirrusMetadataBlueprintRef[];
  actions: SirrusMetadataAction[];
};

const FIELD_ALIASES: Record<string, string[]> = {
  stage: ["Lead Status", "Status", "Lifecycle", "Lead stage"],
  dropped_reason: ["Lost Reason", "Lost Reasons", "Drop reason", "Dropped Reason"],
  site_visit_scheduled_date: ["Site Visit Date", "Site Visit date", "SV Date"],
  source: ["Lead Source"],
  max_budget: ["Budget"],
  lead_name: ["Name", "Full Name", "Customer Name"],
};

function toMetaFields(moduleId: string, rows: FieldDefinition[]): SirrusMetadataField[] {
  return rows.map((f) => ({
    id: f.id,
    apiKey: f.apiKey,
    label: f.label,
    moduleId,
    dataType: f.dataType,
    required: f.required,
    options: f.options.map((o) => ({ id: o.id, label: o.label })),
    aliases: FIELD_ALIASES[f.apiKey] ?? [],
  }));
}

function extraModuleFields(moduleId: string, lifecycleApiKey: string, lifecycleLabel: string, stages: string[]): FieldDefinition[] {
  const options = stages.map((label, i) => ({
    id: `${moduleId}_st_${i}`,
    label,
    value: label.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
  }));
  return [
    {
      id: `${moduleId}-name`,
      apiKey: "name",
      label: "Name",
      dataType: "text",
      required: true,
      allowDuplicate: true,
      options: [],
      defaultOptionIds: [],
      orderPreference: "manual",
      formulaExpression: "",
      isSystem: true,
      locked: true,
      includeInFilters: true,
    },
    {
      id: `${moduleId}-status`,
      apiKey: lifecycleApiKey,
      label: lifecycleLabel,
      dataType: "picklist",
      required: true,
      allowDuplicate: true,
      options,
      defaultOptionIds: [],
      orderPreference: "manual",
      formulaExpression: "",
      isSystem: true,
      locked: true,
      includeInFilters: true,
    },
  ];
}

/** Static catalog plus optional live fields/blueprints from the open prototype session. */
export function getSirrusMetadata(overrides?: {
  fields?: FieldDefinition[];
  existingBlueprints?: SirrusMetadataBlueprintRef[];
}): SirrusMetadata {
  const leadFields = overrides?.fields?.length ? overrides.fields : createDefaultLeadFields();
  const taskField = fieldsForConnectedModule("tasks").find((f) => f.apiKey === "task_type");

  const modules: SirrusMetadataModule[] = [
    { id: "lead", label: "Lead", lifecycleFieldApiKey: "stage" },
    { id: "booking", label: "Booking", lifecycleFieldApiKey: "booking_status" },
    { id: "site_visit", label: "Site Visit", lifecycleFieldApiKey: "visit_status" },
    { id: "contact", label: "Contact" },
    { id: "account", label: "Account" },
    { id: "enquiry", label: "Enquiry", lifecycleFieldApiKey: "enquiry_status" },
    { id: "insurance_lead", label: "Insurance Lead", lifecycleFieldApiKey: "insurance_status" },
    { id: "application", label: "Application", lifecycleFieldApiKey: "application_status" },
    { id: "opportunity", label: "Opportunity", lifecycleFieldApiKey: "opportunity_status" },
    { id: "channel_partner", label: "Channel Partner" },
  ];

  const fields: SirrusMetadataField[] = [
    ...toMetaFields("lead", leadFields),
    ...toMetaFields("booking", bookingPrototypeFields()),
    ...toMetaFields(
      "enquiry",
      extraModuleFields("enquiry", "enquiry_status", "Enquiry Status", [
        "Enquiry",
        "Qualified",
        "Counselling",
        "Application",
        "Admission",
      ]),
    ),
    ...toMetaFields(
      "insurance_lead",
      extraModuleFields("insurance_lead", "insurance_status", "Insurance Status", [
        "Lead",
        "Requirement",
        "Quote",
        "Underwriting",
        "Approval",
        "Policy Issued",
      ]),
    ),
    ...toMetaFields(
      "application",
      extraModuleFields("application", "application_status", "Application Status", [
        "Application",
        "Screening",
        "Interview",
        "Assessment",
        "Offer",
        "Hired",
      ]),
    ),
    ...toMetaFields(
      "opportunity",
      extraModuleFields("opportunity", "opportunity_status", "Opportunity Status", [
        "Lead",
        "Qualified",
        "Demo",
        "Proposal",
        "Contract",
        "Won",
      ]),
    ),
    ...toMetaFields(
      "site_visit",
      extraModuleFields("site_visit", "visit_status", "Visit Status", ["Scheduled", "Completed", "No Show", "Cancelled"]),
    ),
    ...toMetaFields("channel_partner", fieldsForConnectedModule("channel_partner")),
  ];

  const taskTypes: SirrusMetadataTaskType[] = (taskField?.options ?? []).map((o) => ({
    id: o.id,
    label: o.label,
    aliases: o.label.toLowerCase() === "follow-up" ? ["Follow up", "Follow-up", "Follow Up"] : [],
  }));

  const actions: SirrusMetadataAction[] = [
    { id: "create_record", label: "Create record" },
    { id: "auto_task", label: "Create task" },
    { id: "field_update", label: "Update field" },
    { id: "required_field", label: "Require field on transition" },
    ...TRANSITION_TOOL_PRESETS.map((t) => ({ id: t.id, label: t.label })),
  ];

  return {
    modules,
    fields,
    taskTypes,
    existingBlueprints: overrides?.existingBlueprints ?? [],
    actions,
  };
}

export function compactMetadataForAgent(meta: SirrusMetadata): Record<string, unknown> {
  return {
    modules: meta.modules,
    fields: meta.fields.map((f) => ({
      apiKey: f.apiKey,
      label: f.label,
      moduleId: f.moduleId,
      dataType: f.dataType,
      aliases: f.aliases,
    })),
    taskTypes: meta.taskTypes,
    existingBlueprints: meta.existingBlueprints,
    actions: meta.actions.map((a) => a.id),
  };
}

export function findModule(meta: SirrusMetadata, hint?: string | null): SirrusMetadataModule | undefined {
  const h = hint?.trim().toLowerCase();
  if (!h) return meta.modules.find((m) => m.id === "lead");
  return (
    meta.modules.find((m) => m.id === h || m.label.toLowerCase() === h) ??
    meta.modules.find((m) => h.includes(m.label.toLowerCase()) || m.label.toLowerCase().includes(h)) ??
    meta.modules.find((m) => m.id === "lead")
  );
}

export function findField(
  meta: SirrusMetadata,
  hint: string | undefined,
  moduleId?: string,
): SirrusMetadataField | undefined {
  const h = hint?.trim().toLowerCase();
  if (!h) return undefined;
  const pool = moduleId ? meta.fields.filter((f) => f.moduleId === moduleId) : meta.fields;
  const search = (rows: SirrusMetadataField[]) =>
    rows.find((f) => f.apiKey.toLowerCase() === h) ??
    rows.find((f) => f.label.toLowerCase() === h) ??
    rows.find((f) => f.aliases.some((a) => a.toLowerCase() === h)) ??
    rows.find((f) => f.label.toLowerCase().includes(h) || h.includes(f.label.toLowerCase())) ??
    rows.find((f) => f.aliases.some((a) => a.toLowerCase().includes(h) || h.includes(a.toLowerCase())));
  return search(pool) ?? (moduleId ? search(meta.fields) : undefined);
}

export function findTaskType(meta: SirrusMetadata, hint?: string | null): SirrusMetadataTaskType | undefined {
  const h = hint?.trim().toLowerCase();
  if (!h) return meta.taskTypes.find((t) => /follow/i.test(t.label));
  return (
    meta.taskTypes.find((t) => t.id === h || t.label.toLowerCase() === h) ??
    meta.taskTypes.find((t) => t.aliases.some((a) => a.toLowerCase() === h)) ??
    meta.taskTypes.find((t) => t.label.toLowerCase().includes(h) || h.includes(t.label.toLowerCase()))
  );
}

export function findLifecycleField(meta: SirrusMetadata, module: SirrusMetadataModule, hint?: string | null): SirrusMetadataField | undefined {
  if (hint) {
    const direct = findField(meta, hint, module.id);
    if (direct) return direct;
  }
  if (module.lifecycleFieldApiKey) {
    const byKey = meta.fields.find((f) => f.moduleId === module.id && f.apiKey === module.lifecycleFieldApiKey);
    if (byKey) return byKey;
  }
  return meta.fields.find((f) => f.moduleId === module.id && f.dataType === "picklist");
}
