import { applyAfterFieldUpdates } from "@/lib/leads/apply-after-updates";
import { applyTransitionAutomation } from "@/lib/leads/apply-transition-effects";
import type { LeadRecord } from "@/lib/leads/types";
import {
  defaultSubstageIdForState,
  outgoingTransitions,
  stageFieldForBlueprint,
  stateFromStageValue,
  stateToStageOptionId,
  substageFieldApiKey,
  targetState,
  targetStateForExit,
  transitionTargetDisplayLabel,
} from "@/lib/leads/stage-bridge";
import { transitionCreateRecordDraftKey, collectAllCreateRecordRepNeeds } from "@/lib/blueprint/after-transition-runtime";
import { transitionToolDraftKey } from "@/lib/blueprint/transition-tools";
import { labelForCreateRecordTarget } from "@/lib/blueprint/types";
import type {
  BlueprintDocument,
  BlueprintSubstageExit,
  BlueprintSubstageTransition,
  BlueprintTransition,
  TransitionAutomation,
  TransitionFormField,
} from "@/lib/blueprint/types";
import type { FieldDefinition } from "@/lib/fields-config/types";
import type { CrmModule, CrmRecord, CrmWorkspace } from "@/lib/crm/types";
import { createRecord, findModule, updateRecord } from "@/lib/crm/ops";
import { newCrmId } from "@/lib/crm/ids";

export function transitionFormDraftKey(t: TransitionAutomation, row: TransitionFormField) {
  return `${t.id}:${row.id}`;
}

function parseMultiIds(s: string): string[] {
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}

export function asLeadShape(rec: CrmRecord): LeadRecord {
  return { ...rec, relatedDemo: {} };
}

export function validateTransitionAutomation(
  t: TransitionAutomation,
  draft: Record<string, string>,
  fieldDefs: FieldDefinition[],
  record: CrmRecord | null,
): string | null {
  const lead = record ? asLeadShape(record) : null;
  for (const f of t.form.fields) {
    const k = transitionFormDraftKey(t, f);
    const v = draft[k] ?? "";
    const def = fieldDefs.find((x) => x.apiKey === f.fieldId);
    if (def?.dataType === "multi_select") {
      if (f.mandatory && parseMultiIds(v).length === 0) return `Fill “${f.label}”.`;
      continue;
    }
    if (f.mandatory && !v.trim()) return `Fill “${f.label}”.`;
  }
  if (t.form.includeRemark && t.form.remarkMandatory) {
    const r = (draft[`${t.id}:__remark__`] ?? "").trim();
    if (!r) return "Notes are required for this move.";
  }
  if (t.form.includeTasks && t.form.taskMandatory) {
    const d = (draft[`${t.id}:__task_date__`] ?? "").trim();
    const tm = (draft[`${t.id}:__task_time__`] ?? "").trim();
    if (!d || !tm) return "Follow-up date and time are required.";
  }
  for (const tool of t.form.tools ?? []) {
    if (tool.mandatory && (draft[transitionToolDraftKey(t.id, tool.id)] ?? "") !== "1") {
      return `Complete “${tool.label}” before continuing.`;
    }
  }
  if (lead) {
    for (const need of collectAllCreateRecordRepNeeds(t, lead, fieldDefs)) {
      const k = transitionCreateRecordDraftKey(t.id, need.createRecordId, need.targetFieldApiKey);
      if (!(draft[k] ?? "").trim()) {
        return `Enter “${need.label}” for the new ${labelForCreateRecordTarget(need.targetModule)} record.`;
      }
    }
  }
  return null;
}

function applyTransitionToRecord(
  record: CrmRecord,
  t: BlueprintTransition,
  doc: BlueprintDocument,
  stageField: FieldDefinition | undefined,
  draft: Record<string, string>,
  entrySubstageId?: string,
): CrmRecord {
  const tgt = targetState(doc, t);
  if (!tgt || !stageField) return record;

  let nextValues = { ...record.values };
  for (const f of t.form.fields) {
    const key = transitionFormDraftKey(t, f);
    nextValues[f.fieldId] = draft[key] ?? "";
  }

  const opt = stateToStageOptionId(stageField, tgt);
  if (opt) nextValues[stageField.apiKey] = opt;

  const ssKey = substageFieldApiKey(doc);
  const ssId = (t.targetSubstageId?.trim() || entrySubstageId?.trim() || "").trim();
  if (ssId) nextValues[ssKey] = ssId;
  else delete nextValues[ssKey];

  nextValues = applyAfterFieldUpdates(nextValues, t.after.fieldUpdates);

  return { ...record, values: nextValues, updatedAt: new Date().toISOString() };
}

function applySubstageExitToRecord(
  record: CrmRecord,
  ex: BlueprintSubstageExit,
  doc: BlueprintDocument,
  stageField: FieldDefinition | undefined,
  draft: Record<string, string>,
): CrmRecord {
  const tgt = targetStateForExit(doc, ex);
  if (!tgt || !stageField) return record;

  let nextValues = { ...record.values };
  for (const f of ex.form.fields) {
    const key = transitionFormDraftKey(ex, f);
    nextValues[f.fieldId] = draft[key] ?? "";
  }

  const opt = stateToStageOptionId(stageField, tgt);
  if (opt) nextValues[stageField.apiKey] = opt;

  const ssKey = substageFieldApiKey(doc);
  const defaultSs = defaultSubstageIdForState(tgt);
  if (defaultSs) nextValues[ssKey] = defaultSs;
  else delete nextValues[ssKey];

  nextValues = applyAfterFieldUpdates(nextValues, ex.after.fieldUpdates);

  return { ...record, values: nextValues, updatedAt: new Date().toISOString() };
}

function applySubstageTransitionToRecord(
  record: CrmRecord,
  t: BlueprintSubstageTransition,
  doc: BlueprintDocument,
  draft: Record<string, string>,
): CrmRecord {
  let nextValues = { ...record.values };
  for (const f of t.form.fields) {
    const key = transitionFormDraftKey(t, f);
    nextValues[f.fieldId] = draft[key] ?? "";
  }
  const ssKey = substageFieldApiKey(doc);
  nextValues[ssKey] = t.targetSubstageId;
  nextValues = applyAfterFieldUpdates(nextValues, t.after.fieldUpdates);
  return { ...record, values: nextValues, updatedAt: new Date().toISOString() };
}

function nextDisplayIdForModule(mod: CrmModule): string {
  const prefix = mod.apiKey.slice(0, 1).toUpperCase();
  const nums = mod.records
    .map((r) => {
      const m = /^[A-Z]?(\d+)$/.exec(r.displayId.replace(/\s/g, ""));
      return m ? Number(m[1]) : 0;
    })
    .filter((n) => Number.isFinite(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefix}${String(next).padStart(6, "0")}`;
}

export type ApplyCrmTransitionInput = {
  workspace: CrmWorkspace;
  mod: CrmModule;
  record: CrmRecord;
  doc: BlueprintDocument;
  kind: "main" | "substage" | "exit";
  transition: BlueprintTransition | BlueprintSubstageTransition | BlueprintSubstageExit;
  formDraft: Record<string, string>;
  entrySubstageId?: string;
};

export function applyCrmTransition(input: ApplyCrmTransitionInput): CrmWorkspace {
  const { workspace, mod, record, doc, kind, transition, formDraft, entrySubstageId } = input;
  const stageField = stageFieldForBlueprint(mod.fields, doc);
  const executedAt = new Date();
  let updated: CrmRecord = record;

  if (kind === "substage") {
    updated = applySubstageTransitionToRecord(record, transition as BlueprintSubstageTransition, doc, formDraft);
  } else if (kind === "exit") {
    updated = applySubstageExitToRecord(record, transition as BlueprintSubstageExit, doc, stageField, formDraft);
  } else {
    updated = applyTransitionToRecord(
      record,
      transition as BlueprintTransition,
      doc,
      stageField,
      formDraft,
      entrySubstageId,
    );
  }

  const leadShape = asLeadShape(updated);
  const scratch = mod.records.map((r) => (r.id === updated.id ? asLeadShape(updated) : asLeadShape(r)));
  const { lead: withAuto, extraLeads } = applyTransitionAutomation({
    lead: leadShape,
    transition,
    leadFields: mod.fields,
    formDraft,
    executedAt,
    newLeadUuid: () => newCrmId("rec"),
    scratchLeads: scratch,
    nextDisplayIdForLeads: () => nextDisplayIdForModule(mod),
    seedRelatedDemo: () => ({}),
  });

  updated = { ...updated, values: withAuto.values, updatedAt: withAuto.updatedAt };

  let next = updateRecord(workspace, mod.id, record.id, updated.values);

  for (const extra of extraLeads) {
    const targetMod =
      findModule(next, mod.apiKey) ??
      findModule(next, mod.id);
    if (targetMod) {
      next = createRecord(next, targetMod.id, extra.values).workspace;
    }
  }

  return next;
}

export { outgoingTransitions, stateFromStageValue, transitionTargetDisplayLabel, stageFieldForBlueprint };
