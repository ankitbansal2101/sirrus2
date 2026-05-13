import { buildFieldLabelLookup } from "@/lib/blueprint/from-fields-schema";
import type {
  AfterAutoTask,
  AfterAutoTaskDueKind,
  AfterCreateRecord,
  AfterCreateRecordFieldBinding,
  AfterFieldUpdate,
  AfterTransitionTaskDueAnchor,
  BlueprintAfterBlock,
  BlueprintDocument,
  BlueprintTransition,
  TransitionFormField,
} from "@/lib/blueprint/types";
import { newEntityId } from "@/lib/blueprint/types";
import { shapeTransitionFormFieldStorage } from "@/lib/blueprint/transition-form-shape";
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

function normalizeDueAnchor(raw: unknown): AfterTransitionTaskDueAnchor {
  if (raw === "execution" || raw === "created" || raw === "updated") return raw;
  if (raw && typeof raw === "object" && (raw as { kind?: unknown }).kind === "field") {
    const fk = (raw as { fieldApiKey?: unknown }).fieldApiKey;
    if (typeof fk === "string" && fk.trim()) return { kind: "field", fieldApiKey: fk.trim() };
  }
  return "execution";
}

function normalizeAutoTask(raw: unknown): AfterAutoTask {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const days = o.offsetDays;
  const offsetDays = typeof days === "number" && Number.isFinite(days) ? Math.trunc(days) : 0;
  let dueKind = o.dueKind;
  if (dueKind !== "execution_plus_days" && dueKind !== "anchor_plus_days" && dueKind !== "custom_datetime") {
    dueKind = "anchor_plus_days";
  }
  const kind = dueKind as AfterAutoTaskDueKind;
  let dueAnchor = normalizeDueAnchor(o.dueAnchor);
  if (kind === "anchor_plus_days") dueAnchor = "created";
  if (kind === "execution_plus_days") dueAnchor = "execution";
  return {
    id: typeof o.id === "string" ? o.id : newEntityId("at"),
    taskTypeOptionId: typeof o.taskTypeOptionId === "string" ? o.taskTypeOptionId : "tt_fu",
    dueKind: kind,
    dueAnchor,
    offsetDays,
    dueTimeHm: typeof o.dueTimeHm === "string" ? o.dueTimeHm : "",
    customDueDatetime: typeof o.customDueDatetime === "string" ? o.customDueDatetime : "",
  };
}

function normalizeFieldBinding(raw: unknown): AfterCreateRecordFieldBinding {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const mode = o.valueMode === "map" ? "map" : "literal";
  return {
    id: typeof o.id === "string" ? o.id : newEntityId("fb"),
    targetFieldApiKey: typeof o.targetFieldApiKey === "string" ? o.targetFieldApiKey : "",
    valueMode: mode,
    literalValue: typeof o.literalValue === "string" ? o.literalValue : "",
    sourceModule: "leads",
    sourceFieldApiKey: typeof o.sourceFieldApiKey === "string" ? o.sourceFieldApiKey : "",
  };
}

function normalizeCreateRecord(raw: unknown): AfterCreateRecord {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const tm = o.targetModule === "leads" || o.targetModule === "channel_partner" ? o.targetModule : "channel_partner";
  const rawBindings = o.fieldBindings ?? o.fields;
  const arr = Array.isArray(rawBindings) ? rawBindings : [];
  return {
    id: typeof o.id === "string" ? o.id : newEntityId("cr"),
    targetModule: tm,
    fieldBindings: arr.map(normalizeFieldBinding),
  };
}

/** Ensures `after` has `fieldUpdates`, `autoTasks`, and `createRecords` arrays (for persisted blueprints). */
export function normalizeBlueprintAfterBlock(raw: unknown): BlueprintAfterBlock {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    fieldUpdates: Array.isArray(o.fieldUpdates) ? o.fieldUpdates.map(normalizeAfterFieldUpdate) : [],
    autoTasks: Array.isArray(o.autoTasks) ? o.autoTasks.map(normalizeAutoTask) : [],
    createRecords: Array.isArray(o.createRecords) ? o.createRecords.map(normalizeCreateRecord) : [],
  };
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
      after: normalizeBlueprintAfterBlock(tr.after),
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
    after: normalizeBlueprintAfterBlock({
      fieldUpdates: Array.isArray(legacyAfter?.fieldUpdates)
        ? legacyAfter.fieldUpdates.map((x) => normalizeAfterFieldUpdate(x as unknown))
        : [],
    }),
  };
}

function syncTransitionFormFieldsWithSchema(
  transitions: BlueprintTransition[],
  rows: FieldDefinition[],
): BlueprintTransition[] {
  return transitions.map((t) => ({
    ...t,
    form: {
      ...t.form,
      fields: t.form.fields.map((row) => {
        const def = rows.find((f) => f.apiKey === row.fieldId);
        const label = def?.label ?? row.label;
        if (!def) return { ...row, label };

        const shaped = shapeTransitionFormFieldStorage(def);

        if (def.dataType === "picklist" || def.dataType === "radio") {
          const allLabels = shaped.picklistOptions;
          const labelSet = new Set(allLabels);
          const filtered = row.picklistOptions.filter((l) => labelSet.has(l));
          const useSubset =
            row.kind === "picklist" &&
            filtered.length > 0 &&
            filtered.length < allLabels.length;
          return {
            ...row,
            kind: "picklist",
            label,
            picklistOptions: useSubset ? filtered : allLabels,
          };
        }

        if (def.dataType === "multi_select" || def.dataType === "paragraph") {
          return { ...row, ...shaped, label };
        }

        if (
          (row.kind === "picklist" || row.kind === "textarea" || row.kind === "remark") &&
          (def.dataType === "text" || def.dataType === "url")
        ) {
          return { ...row, label };
        }

        return { ...row, ...shaped, label };
      }),
    },
  }));
}

export function migrateBlueprintDocument(doc: BlueprintDocument, fieldRows?: FieldDefinition[]): BlueprintDocument {
  const rows = fieldRows ?? createDefaultLeadFields();
  const labelOf = buildFieldLabelLookup(rows);
  const migrated = doc.transitions.map((t) => migrateTransition({ ...(t as unknown as Record<string, unknown>) }, labelOf));
  return {
    ...doc,
    transitions: syncTransitionFormFieldsWithSchema(migrated, rows).map((t) => ({
      ...t,
      after: normalizeBlueprintAfterBlock(t.after),
    })),
  };
}
