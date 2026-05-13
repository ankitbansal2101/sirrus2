import type {
  AfterAutoTask,
  AfterCreateRecord,
  AfterCreateRecordFieldBinding,
  AfterCreateRecordTargetModule,
  AfterTransitionTaskDueAnchor,
  BlueprintTransition,
} from "@/lib/blueprint/types";
import { fieldsForConnectedModule } from "@/lib/leads/connected-module-fields";
import type { FieldDefinition } from "@/lib/fields-config/types";
import { optionsSorted, usesOptions } from "@/lib/fields-config/types";
import type { LeadRecord } from "@/lib/leads/types";

export function transitionCreateRecordDraftKey(
  transitionId: string,
  createRecordId: string,
  targetFieldApiKey: string,
): string {
  return `${transitionId}:cr:${createRecordId}:${targetFieldApiKey}`;
}

export function leadDateTimeFieldApiKeys(fields: FieldDefinition[]): { apiKey: string; label: string }[] {
  return fields
    .filter((f) => f.dataType === "date" || f.dataType === "date_time")
    .map((f) => ({ apiKey: f.apiKey, label: f.label }));
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function parseHm(hm: string): { h: number; m: number } | null {
  const t = hm.trim();
  if (!t) return null;
  const m = /^(\d{2}):(\d{2})$/.exec(t);
  if (!m) return null;
  return { h: Number(m[1]), m: Number(m[2]) };
}

function anchorBaseDate(lead: LeadRecord, executedAt: Date, anchor: AfterTransitionTaskDueAnchor): Date | null {
  if (anchor === "execution") return startOfLocalDay(executedAt);
  if (anchor === "created") {
    const d = new Date(lead.createdAt);
    return Number.isNaN(d.getTime()) ? null : startOfLocalDay(d);
  }
  if (anchor === "updated") {
    const d = new Date(lead.updatedAt);
    return Number.isNaN(d.getTime()) ? null : startOfLocalDay(d);
  }
  const raw = (lead.values[anchor.fieldApiKey] ?? "").trim();
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : startOfLocalDay(d);
}

/** Computes due date/time (ISO) for an auto-task. */
export function computeAutoTaskDueIso(lead: LeadRecord, executedAt: Date, task: AfterAutoTask): string | null {
  if (task.dueKind === "custom_datetime") {
    const raw = (task.customDueDatetime ?? "").trim();
    if (!raw) return null;
    const n = new Date(raw);
    return Number.isNaN(n.getTime()) ? null : n.toISOString();
  }
  const anchor: AfterTransitionTaskDueAnchor =
    task.dueKind === "execution_plus_days" ? "execution" : "created";
  const base = anchorBaseDate(lead, executedAt, anchor);
  if (!base) return null;
  const due = new Date(base);
  due.setDate(due.getDate() + (Number.isFinite(task.offsetDays) ? task.offsetDays : 0));
  const hm = parseHm(task.dueTimeHm);
  if (hm) due.setHours(hm.h, hm.m, 0, 0);
  else due.setHours(18, 0, 0, 0);
  return due.toISOString();
}

export function resolveBindingValue(binding: AfterCreateRecordFieldBinding, leadValues: Record<string, string>): string {
  if (binding.valueMode === "literal") return binding.literalValue.trim();
  return (leadValues[binding.sourceFieldApiKey] ?? "").trim();
}

export type CreateRecordRepFieldNeed = {
  createRecordId: string;
  targetModule: AfterCreateRecordTargetModule;
  targetFieldApiKey: string;
  label: string;
  fieldDef?: FieldDefinition;
};

function targetDefsForModule(m: AfterCreateRecordTargetModule, leadFields: FieldDefinition[]): FieldDefinition[] {
  if (m === "leads") return leadFields;
  return fieldsForConnectedModule("channel_partner");
}

function needsRepForBinding(
  binding: AfterCreateRecordFieldBinding,
  resolved: string,
  def: FieldDefinition | undefined,
): boolean {
  if (binding.valueMode === "literal" && !binding.literalValue.trim()) return true;
  if (binding.valueMode === "map" && !resolved && def?.required) return true;
  if (binding.valueMode === "map" && !resolved && !def?.required) return false;
  return false;
}

export function collectCreateRecordRepNeeds(
  rec: AfterCreateRecord,
  leadValues: Record<string, string>,
  leadFields: FieldDefinition[],
): CreateRecordRepFieldNeed[] {
  const defs = targetDefsForModule(rec.targetModule, leadFields);
  const needs: CreateRecordRepFieldNeed[] = [];
  for (const b of rec.fieldBindings) {
    const resolved = resolveBindingValue(b, leadValues);
    const def = defs.find((d) => d.apiKey === b.targetFieldApiKey);
    if (!needsRepForBinding(b, resolved, def)) continue;
    needs.push({
      createRecordId: rec.id,
      targetModule: rec.targetModule,
      targetFieldApiKey: b.targetFieldApiKey,
      label: def?.label ?? b.targetFieldApiKey,
      fieldDef: def,
    });
  }
  return needs;
}

export function collectAllCreateRecordRepNeeds(
  t: BlueprintTransition,
  lead: LeadRecord,
  leadFields: FieldDefinition[],
): CreateRecordRepFieldNeed[] {
  const out: CreateRecordRepFieldNeed[] = [];
  for (const rec of t.after.createRecords) {
    out.push(...collectCreateRecordRepNeeds(rec, lead.values, leadFields));
  }
  return out;
}

export function buildDemoTaskRow(task: AfterAutoTask, dueIso: string): Record<string, string> {
  const tf = fieldsForConnectedModule("tasks");
  const row: Record<string, string> = {};
  for (const f of tf) row[f.apiKey] = "";
  row.task_type = task.taskTypeOptionId;
  row.due_date = dueIso;
  const st = tf.find((f) => f.apiKey === "task_status");
  if (st && usesOptions(st.dataType)) {
    const opts = optionsSorted(st);
    const open = opts.find((o) => /open/i.test(o.label)) ?? opts[0];
    if (open) row.task_status = open.id;
  }
  return row;
}

export function buildCreateRecordRowValues(
  rec: AfterCreateRecord,
  leadValues: Record<string, string>,
  leadFields: FieldDefinition[],
  transitionId: string,
  draft: Record<string, string>,
): Record<string, string> {
  const defs = targetDefsForModule(rec.targetModule, leadFields);
  const row: Record<string, string> = {};
  for (const f of defs) row[f.apiKey] = "";
  for (const b of rec.fieldBindings) {
    let v = resolveBindingValue(b, leadValues);
    const dk = transitionCreateRecordDraftKey(transitionId, rec.id, b.targetFieldApiKey);
    const override = (draft[dk] ?? "").trim();
    if (!v && override) v = override;
    row[b.targetFieldApiKey] = v;
  }
  return row;
}
