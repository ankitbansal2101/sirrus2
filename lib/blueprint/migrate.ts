import { buildFieldLabelLookup } from "@/lib/blueprint/from-fields-schema";
import type { AfterFieldUpdate, BlueprintDocument, BlueprintTransition, TransitionFormField } from "@/lib/blueprint/types";
import { newEntityId } from "@/lib/blueprint/types";
import type { FieldDefinition } from "@/lib/fields-config/types";
import { createDefaultLeadFields } from "@/lib/fields-config/types";

/** Pull task label from legacy `{ taskType }`, `{ title }`, or task prompt rows. */
/** Stored task preset is only "Follow up" or "Site visit"; fold legacy labels into these. */
function normalizeTaskPresetType(label: string): "Follow up" | "Site visit" {
  const s = label.trim().toLowerCase();
  if (s === "site visit" || s.includes("site visit")) return "Site visit";
  return "Follow up";
}

const AFTER_KINDS: AfterFieldUpdate["valueKind"][] = ["clear", "literal", "execution_date", "execution_date_time"];

function normalizeAfterFieldUpdate(raw: unknown): AfterFieldUpdate {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const id = typeof o.id === "string" ? o.id : newEntityId("fu");
  const fieldId = typeof o.fieldId === "string" ? o.fieldId : "";
  const fieldLabel = typeof o.fieldLabel === "string" ? o.fieldLabel : fieldId;
  let valueKind = typeof o.valueKind === "string" ? o.valueKind : "literal";
  if (valueKind === "current_date") valueKind = "execution_date";
  if (!AFTER_KINDS.includes(valueKind as AfterFieldUpdate["valueKind"])) {
    valueKind = "literal";
  }
  const literalValue = typeof o.literalValue === "string" ? o.literalValue : "";
  return { id, fieldId, fieldLabel, valueKind: valueKind as AfterFieldUpdate["valueKind"], literalValue };
}

function legacyTaskLabel(raw: unknown): string {
  if (!raw || typeof raw !== "object") return "";
  const o = raw as Record<string, unknown>;
  let t = typeof o.taskType === "string" ? o.taskType : "";
  if (!t && typeof o.title === "string") t = o.title;
  return t.trim();
}

/**
 * Normalize `form` to the current shape: visibility + mandatory flags + single task preset.
 * Legacy `form.tasks[]`, `during.taskPrompts`, and `after.tasks` inform `includeTasks` / `taskPresetType`.
 */
function finalizeTransitionForm(
  base: Record<string, unknown>,
  extraLegacyTaskEntries: unknown[],
): BlueprintTransition["form"] {
  const fields = Array.isArray(base.fields) ? (base.fields as TransitionFormField[]) : [];
  const message = typeof base.message === "string" ? base.message : "";
  const includeRemark = base.includeRemark !== false;
  const remarkMandatory = Boolean(base.remarkMandatory);

  const legacyFormTasks = Array.isArray(base.tasks) ? base.tasks : [];
  const allRaw = [...legacyFormTasks, ...extraLegacyTaskEntries];
  const derivedLabels = allRaw.map(legacyTaskLabel).filter((s) => s.length > 0);

  let includeTasks = Boolean(base.includeTasks);
  if (derivedLabels.length > 0) includeTasks = true;

  const storedPreset = typeof base.taskPresetType === "string" ? base.taskPresetType.trim() : "";
  const fromDerived = derivedLabels[0] ?? "";
  const taskPresetType = normalizeTaskPresetType(storedPreset || fromDerived || "Follow up");
  const taskMandatory = Boolean(base.taskMandatory);

  return {
    message,
    fields,
    includeRemark,
    remarkMandatory,
    includeTasks,
    taskPresetType,
    taskMandatory,
  };
}

/** Normalize transitions saved with legacy `before` / `during` / `after.tasks` shape. */
export function migrateTransition(
  raw: Record<string, unknown>,
  labelOf: (apiKey: string) => string = buildFieldLabelLookup(createDefaultLeadFields()),
): BlueprintTransition {
  const formUnknown = raw.form as Record<string, unknown> | undefined;
  if (formUnknown && Array.isArray(formUnknown.fields)) {
    const tr = raw as unknown as BlueprintTransition;
    const formRecord = { ...(tr.form as unknown as Record<string, unknown>) };
    return {
      ...tr,
      form: finalizeTransitionForm(formRecord, []),
      after: {
        fieldUpdates: (tr.after?.fieldUpdates ?? []).map((x) => normalizeAfterFieldUpdate(x as unknown)),
      },
    };
  }

  const before = raw.before as { mandatoryFieldIds?: string[] } | undefined;
  const beforeIds = Array.isArray(before?.mandatoryFieldIds) ? before.mandatoryFieldIds : [];

  const during = raw.during as {
    message?: string;
    formFields?: TransitionFormField[];
    taskPrompts?: { id: string; title: string }[];
  } | null;

  const baseFields = (during?.formFields ?? []).map((f) => ({
    ...f,
    mandatory: Boolean(f.mandatory) || beforeIds.includes(f.fieldId),
  }));

  const fields: TransitionFormField[] = [...baseFields];
  for (const fid of beforeIds) {
    if (!fields.some((f) => f.fieldId === fid)) {
      fields.push({
        id: newEntityId("df"),
        fieldId: fid,
        label: labelOf(fid),
        kind: "text",
        mandatory: true,
        picklistOptions: [],
      });
    }
  }

  const legacyAfter = raw.after as
    | { fieldUpdates?: AfterFieldUpdate[]; tasks?: { id: string; title: string }[] }
    | undefined;

  const taskPrompts = during?.taskPrompts ?? [];
  const legacyAfterTasks = legacyAfter?.tasks ?? [];
  const extraLegacy = [...taskPrompts, ...legacyAfterTasks];

  return {
    id: String(raw.id),
    sourceStateId: String(raw.sourceStateId),
    targetStateId: String(raw.targetStateId),
    name: String(raw.name ?? ""),
    enabled: raw.enabled !== false,
    form: finalizeTransitionForm(
      {
        message: typeof during?.message === "string" ? during.message : "",
        fields,
        includeRemark: true,
        remarkMandatory: false,
        includeTasks: false,
        taskPresetType: "Follow up",
        taskMandatory: false,
      },
      extraLegacy,
    ),
    after: {
      fieldUpdates: Array.isArray(legacyAfter?.fieldUpdates)
        ? legacyAfter.fieldUpdates.map((x) => normalizeAfterFieldUpdate(x as unknown))
        : [],
    },
  };
}

export function migrateBlueprintDocument(doc: BlueprintDocument, fieldRows?: FieldDefinition[]): BlueprintDocument {
  const rows = fieldRows ?? createDefaultLeadFields();
  const labelOf = buildFieldLabelLookup(rows);
  return {
    ...doc,
    transitions: doc.transitions.map((t) => migrateTransition({ ...(t as unknown as Record<string, unknown>) }, labelOf)),
  };
}
