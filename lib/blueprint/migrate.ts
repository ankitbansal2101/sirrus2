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
  BlueprintNodeSize,
  BlueprintState,
  BlueprintSubstage,
  BlueprintSubstageExit,
  BlueprintSubstageTransition,
  BlueprintTransition,
  TransitionFormField,
  TransitionFormTool,
} from "@/lib/blueprint/types";
import { labelForTransitionToolId } from "@/lib/blueprint/transition-tools";
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

function normalizeNodeSize(raw: unknown): BlueprintNodeSize | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const width = Number((raw as { width?: unknown }).width);
  const height = Number((raw as { height?: unknown }).height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return undefined;
  return { width, height };
}

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

  const tools: TransitionFormTool[] = Array.isArray(base.tools)
    ? (base.tools as unknown[])
        .map((row): TransitionFormTool | null => {
          if (!row || typeof row !== "object") return null;
          const o = row as Record<string, unknown>;
          const toolId = typeof o.toolId === "string" ? o.toolId.trim() : "";
          if (!toolId) return null;
          return {
            id: typeof o.id === "string" && o.id.trim() ? o.id.trim() : newEntityId("tl"),
            toolId,
            label:
              typeof o.label === "string" && o.label.trim()
                ? o.label.trim()
                : labelForTransitionToolId(toolId),
            mandatory: Boolean(o.mandatory),
          };
        })
        .filter((x): x is TransitionFormTool => x !== null)
    : [];

  return {
    message,
    fields,
    includeRemark,
    remarkMandatory,
    includeTasks,
    taskPresetType,
    taskMandatory,
    tools,
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

  const targetSubstageId =
    typeof raw.targetSubstageId === "string" && raw.targetSubstageId.trim()
      ? raw.targetSubstageId.trim()
      : undefined;

  return {
    id: String(raw.id),
    sourceStateId: String(raw.sourceStateId),
    targetStateId: String(raw.targetStateId),
    targetSubstageId,
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

function normalizeSubstage(raw: unknown): BlueprintSubstage {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const posRaw = o.position;
  const position =
    posRaw && typeof posRaw === "object"
      ? { x: Number((posRaw as { x?: unknown }).x) || 0, y: Number((posRaw as { y?: unknown }).y) || 0 }
      : undefined;
  return {
    id: typeof o.id === "string" ? o.id : newEntityId("ss"),
    label: typeof o.label === "string" ? o.label.trim() : "Sub-stage",
    position,
    size: normalizeNodeSize(o.size),
  };
}

function normalizeSubstageExit(raw: unknown, labelOf: (apiKey: string) => string): BlueprintSubstageExit | null {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const sourceSubstageId = typeof o.sourceSubstageId === "string" ? o.sourceSubstageId : "";
  const targetStateId = typeof o.targetStateId === "string" ? o.targetStateId : "";
  if (!sourceSubstageId || !targetStateId) return null;
  const legacy = migrateTransition(
    {
      ...o,
      sourceStateId: sourceSubstageId,
      targetStateId,
    } as Record<string, unknown>,
    labelOf,
  );
  return {
    id: legacy.id,
    name: legacy.name,
    enabled: legacy.enabled,
    form: legacy.form,
    after: legacy.after,
    sourceSubstageId,
    targetStateId,
  };
}

function normalizeSubstageTransition(raw: unknown, labelOf: (apiKey: string) => string): BlueprintSubstageTransition {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const legacy = migrateTransition(
    {
      ...o,
      sourceStateId: o.sourceSubstageId ?? o.sourceStateId,
      targetStateId: o.targetSubstageId ?? o.targetStateId,
    } as Record<string, unknown>,
    labelOf,
  );
  return {
    id: legacy.id,
    name: legacy.name,
    enabled: legacy.enabled,
    form: legacy.form,
    after: legacy.after,
    sourceSubstageId: String(o.sourceSubstageId ?? o.sourceStateId ?? ""),
    targetSubstageId: String(o.targetSubstageId ?? o.targetStateId ?? ""),
  };
}

function normalizeBlueprintState(raw: unknown, labelOf: (apiKey: string) => string): BlueprintState {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const substagesRaw = o.substages;
  const substages = Array.isArray(substagesRaw)
    ? substagesRaw.map(normalizeSubstage).filter((s) => s.label.length > 0)
    : undefined;
  const substageIds = new Set(substages?.map((s) => s.id) ?? []);
  const rawDefaultSubstageId = typeof o.defaultSubstageId === "string" ? o.defaultSubstageId : "";
  const defaultSubstageId = substageIds.has(rawDefaultSubstageId)
    ? rawDefaultSubstageId
    : substages?.[0]?.id;
  const transitionsRaw = o.substageTransitions;
  let substageTransitions = Array.isArray(transitionsRaw)
    ? transitionsRaw.map((t) => normalizeSubstageTransition(t, labelOf))
    : undefined;
  if (substageTransitions?.length) {
    substageTransitions = substageTransitions.filter(
      (t) => substageIds.has(t.sourceSubstageId) && substageIds.has(t.targetSubstageId),
    );
    if (!substageTransitions.length) substageTransitions = undefined;
  }

  const exitsRaw = o.substageExits;
  let substageExits = Array.isArray(exitsRaw)
    ? exitsRaw.map((x) => normalizeSubstageExit(x, labelOf)).filter((x): x is BlueprintSubstageExit => x !== null)
    : undefined;
  if (substageExits?.length) {
    substageExits = substageExits.filter((x) => substageIds.has(x.sourceSubstageId));
    if (!substageExits.length) substageExits = undefined;
  }

  const groupPosRaw = o.substageGroupPosition;
  const substageGroupPosition =
    groupPosRaw && typeof groupPosRaw === "object"
      ? {
          x: Number((groupPosRaw as { x?: unknown }).x) || 0,
          y: Number((groupPosRaw as { y?: unknown }).y) || 0,
        }
      : undefined;
  const substageGroupSize = normalizeNodeSize(o.substageGroupSize);

  return {
    id: typeof o.id === "string" ? o.id : newEntityId("st"),
    label: typeof o.label === "string" ? o.label : "Stage",
    position:
      o.position && typeof o.position === "object"
        ? {
            x: Number((o.position as { x?: unknown }).x) || 0,
            y: Number((o.position as { y?: unknown }).y) || 0,
          }
        : { x: 0, y: 0 },
    size: normalizeNodeSize(o.size),
    substages: substages?.length ? substages : undefined,
    defaultSubstageId: substages?.length ? defaultSubstageId : undefined,
    substageTransitions,
    substageExits,
    substageGroupPosition: substages?.length ? substageGroupPosition : undefined,
    substageGroupSize: substages?.length ? substageGroupSize : undefined,
  };
}

export function migrateBlueprintDocument(doc: BlueprintDocument, fieldRows?: FieldDefinition[]): BlueprintDocument {
  const rows = fieldRows ?? createDefaultLeadFields();
  const labelOf = buildFieldLabelLookup(rows);
  const migrated = doc.transitions.map((t) => migrateTransition({ ...(t as unknown as Record<string, unknown>) }, labelOf));
  const states = doc.states.map((s) => normalizeBlueprintState(s, labelOf));
  const substageField =
    typeof doc.substageField === "string" && doc.substageField.trim() ? doc.substageField.trim() : undefined;
  return {
    ...doc,
    substageField,
    states,
    transitions: syncTransitionFormFieldsWithSchema(migrated, rows).map((t) => ({
      ...t,
      after: normalizeBlueprintAfterBlock(t.after),
    })),
  };
}
