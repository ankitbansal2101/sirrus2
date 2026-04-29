import type { FieldDefinition } from "@/lib/fields-config/types";
import { fieldsForConnectedModule } from "@/lib/leads/connected-module-fields";
import { normalizeLeadFilterConfig } from "@/lib/leads/lead-filter-config-normalize";
import {
  defaultOperatorForKind,
  filterFieldKind,
  isRelativeNDateOperator,
  operatorMeta,
} from "@/lib/leads/lead-filter-operators";
import type { ConnectedModuleFilterBlock, LeadFilterCondition, LeadFilterConfig } from "@/lib/leads/lead-filter-types";
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

function addMonths(d: Date, n: number): Date {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

function startOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 0, 1, 0, 0, 0, 0);
}

function endOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999);
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

/** `datetime-local` style or ISO fragment with `T` — parsed as local time. */
function parseFilterInstantLocal(val: string): number | null {
  const v = val.trim();
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}T/.test(v) || /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(v)) {
    const normalized = v.replace(" ", "T");
    const d = new Date(normalized);
    return Number.isNaN(d.getTime()) ? null : d.getTime();
  }
  return null;
}

/** Lower bound for “before” / “on or after”: datetime instant, else start of calendar day. */
function parseFilterLowerBound(val: string): number | null {
  const inst = parseFilterInstantLocal(val);
  if (inst !== null) return inst;
  return parseYmdToStart(val);
}

/** Upper bound for “after” / “on or before”: datetime instant, else end of calendar day. */
function parseFilterUpperBound(val: string): number | null {
  const inst = parseFilterInstantLocal(val);
  if (inst !== null) return inst;
  return parseYmdToEnd(val);
}

function isValidDateFilterInput(val: string, dataType: FieldDefinition["dataType"]): boolean {
  const t = val.trim();
  if (!t) return false;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return true;
  if (dataType !== "date_time") return false;
  if (/^\d{4}-\d{2}-\d{2}T/.test(t) || /^\d{4}-\d{2}-\d{2} \d/.test(t)) {
    const d = new Date(t.replace(" ", "T"));
    return !Number.isNaN(d.getTime());
  }
  return false;
}

/** `on` + date_time: optional same-day window encoded as `HH:mm|HH:mm` (either side may be empty). */
export function isValidOnDayTimePipe(val2: string): boolean {
  const t = val2.trim();
  if (!t) return true;
  const parts = t.split("|");
  if (parts.length !== 2) return false;
  const re = /^(\d{2}:\d{2})?$/;
  return re.test(parts[0]!.trim()) && re.test(parts[1]!.trim());
}

function extractYmdPrefix(val: string): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(val.trim());
  return m ? m[1]! : null;
}

function millisAtHmOnYmd(ymd: string, hhmm: string): number | null {
  const hm = /^(\d{2}):(\d{2})$/.exec(hhmm.trim());
  if (!hm) return null;
  const day0 = parseYmdToStart(ymd);
  if (day0 === null) return null;
  const d = new Date(day0);
  d.setHours(Number(hm[1]), Number(hm[2]), 0, 0);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

/** Same-day bounds from `ymd` + `start|end` times (empty = start/end of local day). */
function boundsFromYmdAndPipeTimes(ymd: string, val2: string): { lo: number; hi: number } | null {
  const dayStart = parseYmdToStart(ymd);
  const dayEnd = parseYmdToEnd(ymd);
  if (dayStart === null || dayEnd === null) return null;
  const t = val2.trim();
  if (!t) return { lo: dayStart, hi: dayEnd };
  const [aRaw, bRaw] = t.split("|").map((x) => x.trim());
  let lo = dayStart;
  let hi = dayEnd;
  if (aRaw) {
    const x = millisAtHmOnYmd(ymd, aRaw);
    if (x !== null) lo = x;
  }
  if (bRaw) {
    const x = millisAtHmOnYmd(ymd, bRaw);
    if (x !== null) hi = x;
  }
  return { lo: Math.min(lo, hi), hi: Math.max(lo, hi) };
}

/** Milliseconds for stored value; date-only fields use noon local to reduce TZ drift. */
function recordToMillis(raw: string | undefined, dataType: FieldDefinition["dataType"]): number | null {
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

function recordLocalYmd(raw: string | undefined, dataType: FieldDefinition["dataType"]): string | null {
  const ms = recordToMillis(raw, dataType);
  if (ms === null) return null;
  return localYmd(new Date(ms));
}

function rollingInclusiveDaysEndToday(now: Date, n: number): { start: number; end: number } | null {
  if (!Number.isFinite(n) || n < 1) return null;
  const start = startOfLocalDay(addDays(now, -(n - 1)));
  return { start: start.getTime(), end: endOfLocalDay(now).getTime() };
}

function rollingInclusiveDaysFromToday(now: Date, n: number): { start: number; end: number } | null {
  if (!Number.isFinite(n) || n < 1) return null;
  const end = endOfLocalDay(addDays(now, n - 1));
  return { start: startOfLocalDay(now).getTime(), end: end.getTime() };
}

function parsePositiveInt(s: string): number | null {
  const n = Number.parseInt(s.trim(), 10);
  if (!Number.isFinite(n) || n < 1) return null;
  return n;
}

function presetRange(id: string, valueForN: string): { start: number; end: number } | null {
  const now = new Date();
  switch (id) {
    case "today":
      return { start: startOfLocalDay(now).getTime(), end: endOfLocalDay(now).getTime() };
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
    case "this_month":
      return { start: startOfMonth(now).getTime(), end: endOfMonth(now).getTime() };
    case "next_month": {
      const nm = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      return { start: startOfMonth(nm).getTime(), end: endOfMonth(nm).getTime() };
    }
    case "prev_month":
    case "last_month": {
      const pm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return { start: startOfMonth(pm).getTime(), end: endOfMonth(pm).getTime() };
    }
    case "last_7_days":
      return rollingInclusiveDaysEndToday(now, 7);
    case "last_30_days":
      return rollingInclusiveDaysEndToday(now, 30);
    case "next_7_days":
      return rollingInclusiveDaysFromToday(now, 7);
    case "next_30_days":
      return rollingInclusiveDaysFromToday(now, 30);
    case "this_year":
      return { start: startOfYear(now).getTime(), end: endOfYear(now).getTime() };
    case "last_year": {
      const y = new Date(now.getFullYear() - 1, 6, 1);
      return { start: startOfYear(y).getTime(), end: endOfYear(y).getTime() };
    }
    case "last_n_days": {
      const n = parsePositiveInt(valueForN);
      return n ? rollingInclusiveDaysEndToday(now, n) : null;
    }
    case "last_n_weeks": {
      const n = parsePositiveInt(valueForN);
      return n ? rollingInclusiveDaysEndToday(now, n * 7) : null;
    }
    case "last_n_months": {
      const n = parsePositiveInt(valueForN);
      if (!n) return null;
      const start = startOfLocalDay(addMonths(now, -n));
      return { start: start.getTime(), end: endOfLocalDay(now).getTime() };
    }
    case "next_n_days": {
      const n = parsePositiveInt(valueForN);
      return n ? rollingInclusiveDaysFromToday(now, n) : null;
    }
    case "next_n_weeks": {
      const n = parsePositiveInt(valueForN);
      return n ? rollingInclusiveDaysFromToday(now, n * 7) : null;
    }
    case "next_n_months": {
      const n = parsePositiveInt(valueForN);
      if (!n) return null;
      return { start: startOfLocalDay(now).getTime(), end: endOfLocalDay(addMonths(now, n)).getTime() };
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

/** Single-value picklist / radio: `eq` / `neq` use comma-separated option ids (multi-select in UI). */
function evalPicklist(raw: string, op: string, val: string): boolean {
  const r = raw ?? "";
  const ids = new Set(parseIds(val));
  switch (op) {
    case "empty":
      return r.trim() === "";
    case "not_empty":
      return r.trim() !== "";
    case "eq": {
      if (ids.size === 0) return false;
      return ids.has(r);
    }
    case "neq": {
      if (ids.size === 0) return false;
      return !ids.has(r);
    }
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
  const ms = recordToMillis(raw, dataType);
  const ymdLead = recordLocalYmd(raw, dataType);

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
    case "prev_month":
    case "last_month":
    case "last_7_days":
    case "last_30_days":
    case "next_7_days":
    case "next_30_days":
    case "this_year":
    case "last_year":
    case "last_n_days":
    case "last_n_weeks":
    case "last_n_months":
    case "next_n_days":
    case "next_n_weeks":
    case "next_n_months": {
      if (ms === null) return false;
      const pr = presetRange(op, val);
      if (!pr) return false;
      return ms >= pr.start && ms <= pr.end;
    }
    case "on": {
      if (ms === null) return false;
      const v = val.trim();
      const v2 = val2.trim();
      const instant = parseFilterInstantLocal(v);
      if (instant !== null && !v2) {
        return Math.abs(ms - instant) < 60_000;
      }
      if (dataType === "date_time" && v2) {
        const ymd = extractYmdPrefix(v);
        if (!ymd || ymdLead !== ymd) return false;
        const b = boundsFromYmdAndPipeTimes(ymd, v2);
        if (!b) return false;
        return ms >= b.lo && ms <= b.hi;
      }
      if (dataType === "date_time" && !v2) {
        const ymd = extractYmdPrefix(v);
        if (!ymd || ymdLead !== ymd) return false;
        const ds = parseYmdToStart(ymd);
        const de = parseYmdToEnd(ymd);
        if (ds === null || de === null) return false;
        return ms >= ds && ms <= de;
      }
      if (!ymdLead) return false;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
      return ymdLead === v;
    }
    case "before": {
      if (ms === null) return false;
      const t0 = parseFilterLowerBound(val);
      if (t0 === null) return false;
      return ms < t0;
    }
    case "after": {
      if (ms === null) return false;
      const t1 = parseFilterUpperBound(val);
      if (t1 === null) return false;
      return ms > t1;
    }
    case "on_or_before": {
      if (ms === null) return false;
      const t1 = parseFilterUpperBound(val);
      if (t1 === null) return false;
      return ms <= t1;
    }
    case "on_or_after": {
      if (ms === null) return false;
      const t0 = parseFilterLowerBound(val);
      if (t0 === null) return false;
      return ms >= t0;
    }
    case "between": {
      if (ms === null) return false;
      const s = parseFilterLowerBound(val);
      const e = parseFilterUpperBound(val2);
      if (s === null || e === null) return false;
      const lo = Math.min(s, e);
      const hi = Math.max(s, e);
      return ms >= lo && ms <= hi;
    }
    case "not_between": {
      if (ms === null) return false;
      const s = parseFilterLowerBound(val);
      const e = parseFilterUpperBound(val2);
      if (s === null || e === null) return false;
      const lo = Math.min(s, e);
      const hi = Math.max(s, e);
      return ms < lo || ms > hi;
    }
    default:
      return false;
  }
}

export function fieldByApiKey(fields: FieldDefinition[], apiKey: string): FieldDefinition | undefined {
  return fields.find((f) => f.apiKey === apiKey);
}

export function isLeadFilterConditionReady(c: LeadFilterCondition, fields: FieldDefinition[]): boolean {
  const def = fieldByApiKey(fields, c.fieldApiKey);
  if (!def || def.includeInFilters === false) return false;
  if (!c.operator) return false;
  const kind = filterFieldKind(def);
  const meta = operatorMeta(kind, c.operator);
  if (!meta) return false;
  if (isRelativeNDateOperator(c.operator)) {
    return parsePositiveInt(c.value) !== null;
  }
  if (meta.needsValue && !c.value.trim()) return false;
  if (kind === "date" && meta.needsValue && !isValidDateFilterInput(c.value, def.dataType)) return false;
  if (kind === "date" && meta.needsValue2 && !isValidDateFilterInput(c.value2, def.dataType)) return false;
  if (kind === "date" && c.operator === "on" && def.dataType === "date_time" && c.value2.trim() && !isValidOnDayTimePipe(c.value2)) {
    return false;
  }
  if (kind === "picklist" && (c.operator === "eq" || c.operator === "neq") && parseIds(c.value).length === 0) {
    return false;
  }
  if (kind === "multi_select" && meta.needsValue && parseIds(c.value).length === 0) {
    return false;
  }
  if (meta.needsValue2 && !c.value2.trim()) {
    if (!(c.operator === "on" && def.dataType === "date_time")) return false;
  }
  return true;
}

function evalConditionOnValues(
  values: Record<string, string>,
  c: LeadFilterCondition,
  fields: FieldDefinition[],
): boolean {
  if (!isLeadFilterConditionReady(c, fields)) return true;
  const def = fieldByApiKey(fields, c.fieldApiKey)!;
  const raw = values[c.fieldApiKey] ?? "";
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

function connectedRows(lead: LeadRecord, moduleId: ConnectedModuleFilterBlock["moduleId"]) {
  return lead.relatedDemo?.[moduleId] ?? [];
}

function connectedBlockParticipates(block: ConnectedModuleFilterBlock, moduleFields: FieldDefinition[]): boolean {
  if (block.presence === "without") return true;
  const ready = block.conditions.filter((c) => isLeadFilterConditionReady(c, moduleFields));
  if (block.conditions.length === 0) return true;
  return ready.length > 0;
}

function leadMatchesConnectedBlock(lead: LeadRecord, block: ConnectedModuleFilterBlock): boolean {
  const moduleFields = fieldsForConnectedModule(block.moduleId);
  if (!connectedBlockParticipates(block, moduleFields)) return true;

  const rows = connectedRows(lead, block.moduleId);
  if (block.presence === "without") return rows.length === 0;

  if (block.conditions.length === 0) return rows.length > 0;

  const ready = block.conditions.filter((c) => isLeadFilterConditionReady(c, moduleFields));
  if (ready.length === 0) return true;

  if (rows.length === 0) return false;
  return rows.some((row) => ready.every((c) => evalConditionOnValues(row, c, moduleFields)));
}

export function leadMatchesFilterConfig(lead: LeadRecord, config: LeadFilterConfig, fields: FieldDefinition[]): boolean {
  const cfg = normalizeLeadFilterConfig(config);
  const readyLead = cfg.conditions.filter((c) => isLeadFilterConditionReady(c, fields));
  for (const c of readyLead) {
    if (!evalConditionOnValues(lead.values, c, fields)) return false;
  }
  for (const block of cfg.connected ?? []) {
    if (!leadMatchesConnectedBlock(lead, block)) return false;
  }
  return true;
}

export function filterConfigHasActiveClauses(config: LeadFilterConfig | null, leadFields: FieldDefinition[]): boolean {
  if (!config) return false;
  const cfg = normalizeLeadFilterConfig(config);
  if (cfg.conditions.some((c) => isLeadFilterConditionReady(c, leadFields))) return true;
  for (const b of cfg.connected ?? []) {
    const mf = fieldsForConnectedModule(b.moduleId);
    if (connectedBlockParticipates(b, mf)) return true;
  }
  return false;
}

export function activeFilterClauseCount(config: LeadFilterConfig, leadFields: FieldDefinition[]): number {
  const cfg = normalizeLeadFilterConfig(config);
  let n = cfg.conditions.filter((c) => isLeadFilterConditionReady(c, leadFields)).length;
  for (const b of cfg.connected ?? []) {
    const mf = fieldsForConnectedModule(b.moduleId);
    if (!connectedBlockParticipates(b, mf)) continue;
    if (b.presence === "without") {
      n += 1;
      continue;
    }
    const ready = b.conditions.filter((c) => isLeadFilterConditionReady(c, mf));
    if (b.conditions.length === 0) n += 1;
    else n += ready.length;
  }
  return n;
}

export function syncConditionShape(c: LeadFilterCondition, field: FieldDefinition | undefined): LeadFilterCondition {
  if (!field) return { ...c, operator: "", value: "", value2: "" };
  const kind = filterFieldKind(field);
  const ops = operatorMeta(kind, c.operator) ? c.operator : defaultOperatorForKind(kind);
  const meta = operatorMeta(kind, ops);
  let value = c.value;
  let value2 = c.value2;
  if (!meta?.needsValue) value = "";
  const keepOnDayTimeRange = ops === "on" && field.dataType === "date_time";
  if (!meta?.needsValue2 && !keepOnDayTimeRange) value2 = "";
  return { ...c, operator: ops, value, value2 };
}
