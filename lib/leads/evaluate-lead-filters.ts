import type { FieldDefinition } from "@/lib/fields-config/types";
import {
  defaultOperatorForKind,
  filterFieldKind,
  operatorMeta,
} from "@/lib/leads/lead-filter-operators";
import type { LeadFilterCondition, LeadFilterConfig } from "@/lib/leads/lead-filter-types";
import type { LeadRecord } from "@/lib/leads/types";

function localYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function endOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function mondayOfWeek(containing: Date): Date {
  const d = startOfLocalDay(containing);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const m = new Date(d);
  m.setDate(m.getDate() + diff);
  return m;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

function parseYmdToStart(ymd: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dt = new Date(y, mo, d, 0, 0, 0, 0);
  return Number.isNaN(dt.getTime()) ? null : dt.getTime();
}

function parseYmdToEnd(ymd: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dt = new Date(y, mo, d, 23, 59, 59, 999);
  return Number.isNaN(dt.getTime()) ? null : dt.getTime();
}

/** Milliseconds for lead value; date-only fields use noon local to reduce TZ drift. */
function leadToMillis(raw: string | undefined, dataType: FieldDefinition["dataType"]): number | null {
  const t = (raw ?? "").trim();
  if (!t) return null;
  if (dataType === "date" && /^\d{4}-\d{2}-\d{2}$/.test(t)) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t)!;
    const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
    return Number.isNaN(dt.getTime()) ? null : dt.getTime();
  }
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

function leadLocalYmd(raw: string | undefined, dataType: FieldDefinition["dataType"]): string | null {
  const ms = leadToMillis(raw, dataType);
  if (ms === null) return null;
  return localYmd(new Date(ms));
}

function presetRange(
  id: string,
): { start: number; end: number } | null {
  const now = new Date();
  switch (id) {
    case "today": {
      const s = startOfLocalDay(now);
      return { start: s.getTime(), end: endOfLocalDay(now).getTime() };
    }
    case "yesterday": {
      const y = addDays(now, -1);
      return { start: startOfLocalDay(y).getTime(), end: endOfLocalDay(y).getTime() };
    }
    case "tomorrow": {
      const y = addDays(now, 1);
      return { start: startOfLocalDay(y).getTime(), end: endOfLocalDay(y).getTime() };
    }
    case "this_week": {
      const mon = mondayOfWeek(now);
      const sun = endOfLocalDay(addDays(mon, 6));
      return { start: mon.getTime(), end: sun.getTime() };
    }
    case "next_week": {
      const nextMon = addDays(mondayOfWeek(now), 7);
      return { start: startOfLocalDay(nextMon).getTime(), end: endOfLocalDay(addDays(nextMon, 6)).getTime() };
    }
    case "prev_week": {
      const prevMon = addDays(mondayOfWeek(now), -7);
      return { start: startOfLocalDay(prevMon).getTime(), end: endOfLocalDay(addDays(prevMon, 6)).getTime() };
    }
    case "this_month": {
      const s = startOfMonth(now);
      return { start: s.getTime(), end: endOfMonth(now).getTime() };
    }
    case "next_month": {
      const nm = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      return { start: startOfMonth(nm).getTime(), end: endOfMonth(nm).getTime() };
    }
    case "prev_month": {
      const pm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return { start: startOfMonth(pm).getTime(), end: endOfMonth(pm).getTime() };
    }
    default:
      return null;
  }
}

function parseIds(s: string): string[] {
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}

function evalText(raw: string, op: string, val: string): boolean {
  const r = raw ?? "";
  const v = val;
  const nt = (s: string) => s.trim();
  switch (op) {
    case "empty":
      return nt(r) === "";
    case "not_empty":
      return nt(r) !== "";
    case "eq":
      return r === v;
    case "neq":
      return r !== v;
    case "contains":
      return r.toLowerCase().includes(v.toLowerCase());
    case "not_contains":
      return !r.toLowerCase().includes(v.toLowerCase());
    case "starts_with":
      return r.toLowerCase().startsWith(v.toLowerCase());
    case "ends_with":
      return r.toLowerCase().endsWith(v.toLowerCase());
    default:
      return false;
  }
}

function evalPicklist(raw: string, op: string, val: string): boolean {
  const r = raw ?? "";
  switch (op) {
    case "empty":
      return r.trim() === "";
    case "not_empty":
      return r.trim() !== "";
    case "eq":
      return r === val;
    case "neq":
      return r !== val;
    default:
      return false;
  }
}

function evalMulti(raw: string, op: string, val: string): boolean {
  const leadSet = new Set(parseIds(raw));
  const filterSet = new Set(parseIds(val));
  switch (op) {
    case "empty":
      return leadSet.size === 0;
    case "not_empty":
      return leadSet.size > 0;
    case "contains_any": {
      for (const id of filterSet) if (leadSet.has(id)) return true;
      return false;
    }
    case "contains_all": {
      if (filterSet.size === 0) return false;
      for (const id of filterSet) if (!leadSet.has(id)) return false;
      return true;
    }
    case "not_contains": {
      for (const id of filterSet) if (leadSet.has(id)) return false;
      return true;
    }
    default:
      return false;
  }
}

function num(raw: string): number | null {
  const t = raw.trim();
  if (t === "") return null;
  const n = Number(t.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function evalNumber(raw: string, op: string, val: string, val2: string): boolean {
  const n = num(raw);
  const a = num(val);
  const b = num(val2);
  switch (op) {
    case "empty":
      return raw.trim() === "";
    case "not_empty":
      return raw.trim() !== "";
    case "num_eq":
      return n !== null && a !== null && n === a;
    case "num_neq":
      return n !== null && a !== null && n !== a;
    case "lt":
      return n !== null && a !== null && n < a;
    case "lte":
      return n !== null && a !== null && n <= a;
    case "gt":
      return n !== null && a !== null && n > a;
    case "gte":
      return n !== null && a !== null && n >= a;
    case "between":
      if (n === null || a === null || b === null) return false;
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      return n >= lo && n <= hi;
    case "not_between":
      if (n === null || a === null || b === null) return false;
      const lo2 = Math.min(a, b);
      const hi2 = Math.max(a, b);
      return n < lo2 || n > hi2;
    default:
      return false;
  }
}

function evalDate(
  raw: string | undefined,
  dataType: FieldDefinition["dataType"],
  op: string,
  val: string,
  val2: string,
): boolean {
  const ms = leadToMillis(raw, dataType);
  const ymdLead = leadLocalYmd(raw, dataType);

  switch (op) {
    case "empty":
      return (raw ?? "").trim() === "";
    case "not_empty":
      return (raw ?? "").trim() !== "";
    case "today":
    case "yesterday":
    case "tomorrow":
    case "this_week":
    case "this_month":
    case "next_week":
    case "next_month":
    case "prev_week":
    case "prev_month": {
      if (ms === null) return false;
      const pr = presetRange(op);
      if (!pr) return false;
      return ms >= pr.start && ms <= pr.end;
    }
    case "on": {
      if (!ymdLead) return false;
      const v = val.trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
      return ymdLead === v;
    }
    case "before": {
      if (ms === null) return false;
      const t0 = parseYmdToStart(val);
      if (t0 === null) return false;
      return ms < t0;
    }
    case "after": {
      if (ms === null) return false;
      const t1 = parseYmdToEnd(val);
      if (t1 === null) return false;
      return ms > t1;
    }
    case "between": {
      if (ms === null) return false;
      const s = parseYmdToStart(val);
      const e = parseYmdToEnd(val2);
      if (s === null || e === null) return false;
      return ms >= s && ms <= e;
    }
    case "not_between": {
      if (ms === null) return false;
      const s = parseYmdToStart(val);
      const e = parseYmdToEnd(val2);
      if (s === null || e === null) return false;
      const lo = Math.min(s, e);
      const hi = Math.max(s, e);
      return ms < lo || ms > hi;
    }
    default:
      return false;
  }
}

function fieldByApiKey(fields: FieldDefinition[], apiKey: string): FieldDefinition | undefined {
  return fields.find((f) => f.apiKey === apiKey);
}

export function isLeadFilterConditionReady(
  c: LeadFilterCondition,
  fields: FieldDefinition[],
): boolean {
  const def = fieldByApiKey(fields, c.fieldApiKey);
  if (!def || def.includeInFilters === false) return false;
  if (!c.operator) return false;
  const kind = filterFieldKind(def);
  const meta = operatorMeta(kind, c.operator);
  if (!meta) return false;
  if (meta.needsValue && !c.value.trim()) return false;
  if (meta.needsValue2 && !c.value2.trim()) return false;
  return true;
}

function evalOne(lead: LeadRecord, c: LeadFilterCondition, fields: FieldDefinition[]): boolean {
  if (!isLeadFilterConditionReady(c, fields)) return true;
  const def = fieldByApiKey(fields, c.fieldApiKey)!;
  const raw = lead.values[c.fieldApiKey] ?? "";
  const kind = filterFieldKind(def);
  switch (kind) {
    case "text":
      return evalText(raw, c.operator, c.value);
    case "picklist":
      return evalPicklist(raw, c.operator, c.value);
    case "multi_select":
      return evalMulti(raw, c.operator, c.value);
    case "number":
      return evalNumber(raw, c.operator, c.value, c.value2);
    case "date":
      return evalDate(raw, def.dataType, c.operator, c.value, c.value2);
    default:
      return true;
  }
}

export function leadMatchesFilterConfig(
  lead: LeadRecord,
  config: LeadFilterConfig,
  fields: FieldDefinition[],
): boolean {
  const ready = config.conditions.filter((c) => isLeadFilterConditionReady(c, fields));
  if (ready.length === 0) return true;
  return ready.every((c) => evalOne(lead, c, fields));
}

/** Normalize a row when field or operator changes (caller supplies next field). */
export function syncConditionShape(
  c: LeadFilterCondition,
  field: FieldDefinition | undefined,
): LeadFilterCondition {
  if (!field) return { ...c, operator: "", value: "", value2: "" };
  const kind = filterFieldKind(field);
  const ops = operatorMeta(kind, c.operator) ? c.operator : defaultOperatorForKind(kind);
  const meta = operatorMeta(kind, ops);
  let value = c.value;
  let value2 = c.value2;
  if (!meta?.needsValue) value = "";
  if (!meta?.needsValue2) value2 = "";
  return { ...c, operator: ops, value, value2 };
}
