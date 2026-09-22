import { displayFieldValue } from "@/lib/crm/display";
import { findModule } from "@/lib/crm/ops";
import {
  CHART_CREATED_AT,
  CHART_UPDATED_AT,
  type ChartDimension,
  type ChartMeasure,
  type ChartMeasureFn,
  type ChartTimeGrain,
  type CrmModule,
  type CrmRecord,
  type CrmWorkspace,
  type WorkspaceChart,
} from "@/lib/crm/types";
import type { FieldDefinition } from "@/lib/fields-config/types";

export type ChartSeries = {
  name: string;
  values: number[];
};

export type ChartResult = {
  title: string;
  moduleLabel: string;
  recordCount: number;
  matched: number;
  labels: string[];
  series: ChartSeries[];
  rows: Array<{ label: string; values: Record<string, number> }>;
  dimensionLabel: string;
  error?: string;
};

const NUMERIC_TYPES = new Set(["number", "decimal", "formula"]);
const DATE_TYPES = new Set(["date", "date_time"]);

export function isNumericField(field: FieldDefinition | undefined): boolean {
  return !!field && NUMERIC_TYPES.has(field.dataType);
}

export function isDateField(field: FieldDefinition | undefined): boolean {
  return !!field && DATE_TYPES.has(field.dataType);
}

export function isSpecialDateField(ref: string): boolean {
  return ref === CHART_CREATED_AT || ref === CHART_UPDATED_AT;
}

export function resolveChartField(mod: CrmModule, ref: string): FieldDefinition | undefined {
  const needle = ref.trim().toLowerCase();
  return mod.fields.find(
    (f) => f.id === ref || f.apiKey.toLowerCase() === needle || f.label.toLowerCase() === needle,
  );
}

export function fieldOptionsForCharts(mod: CrmModule): Array<{ value: string; label: string; kind: "date" | "category" | "number" | "system" }> {
  const rows: Array<{ value: string; label: string; kind: "date" | "category" | "number" | "system" }> = [
    { value: CHART_CREATED_AT, label: "Created time", kind: "system" },
    { value: CHART_UPDATED_AT, label: "Updated time", kind: "system" },
  ];
  for (const f of mod.fields) {
    const kind = isDateField(f) ? "date" : isNumericField(f) ? "number" : "category";
    rows.push({ value: f.apiKey, label: f.label, kind });
  }
  return rows;
}

function parseNumber(raw: string | undefined): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(String(raw).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function parseDate(raw: string | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isoWeekKey(d: Date): string {
  const utc = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function bucketKey(d: Date, grain: ChartTimeGrain): string {
  const y = d.getFullYear();
  const m = d.getMonth();
  if (grain === "year") return `${y}`;
  if (grain === "quarter") return `${y}-Q${Math.floor(m / 3) + 1}`;
  if (grain === "month") return `${y}-${String(m + 1).padStart(2, "0")}`;
  if (grain === "week") return isoWeekKey(d);
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function nextBucket(key: string, grain: ChartTimeGrain): string {
  if (grain === "year") return String(Number(key) + 1);
  if (grain === "quarter") {
    const [y, q] = key.split("-Q");
    const next = Number(q) + 1;
    return next > 4 ? `${Number(y) + 1}-Q1` : `${y}-Q${next}`;
  }
  if (grain === "month") {
    const [y, m] = key.split("-").map(Number);
    const d = new Date(y, m, 1);
    return bucketKey(d, "month");
  }
  if (grain === "week") {
    const [y, w] = key.split("-W");
    const week = Number(w) + 1;
    if (week > 53) return `${Number(y) + 1}-W01`;
    return `${y}-W${String(week).padStart(2, "0")}`;
  }
  const d = new Date(`${key}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return bucketKey(d, "day");
}

function fillKeys(keys: string[], grain: ChartTimeGrain | undefined): string[] {
  if (!grain || keys.length < 2) return keys;
  const sorted = [...keys].sort();
  const out: string[] = [];
  let cur = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  let guard = 0;
  while (cur <= last && guard < 240) {
    out.push(cur);
    cur = nextBucket(cur, grain);
    guard += 1;
  }
  return out;
}

export function formatBucketLabel(key: string, grain?: ChartTimeGrain): string {
  if (!grain) return key;
  if (grain === "month") {
    const [y, m] = key.split("-");
    if (!y || !m) return key;
    return new Date(Number(y), Number(m) - 1, 1).toLocaleString("en", { month: "short", year: "numeric" });
  }
  if (grain === "day") {
    const d = new Date(`${key}T00:00:00`);
    if (Number.isNaN(d.getTime())) return key;
    return d.toLocaleString("en", { month: "short", day: "numeric" });
  }
  if (grain === "week") return key.replace("-", " ");
  return key;
}

function dimensionValue(mod: CrmModule, rec: CrmRecord, dim: ChartDimension): string {
  if (dim.field === CHART_CREATED_AT || dim.field === CHART_UPDATED_AT) {
    const d = parseDate(dim.field === CHART_CREATED_AT ? rec.createdAt : rec.updatedAt);
    if (!d) return "(none)";
    return dim.timeGrain ? bucketKey(d, dim.timeGrain) : d.toISOString().slice(0, 10);
  }
  const field = resolveChartField(mod, dim.field);
  if (!field) return "(none)";
  const raw = rec.values[field.apiKey];
  if (dim.timeGrain && (isDateField(field) || parseDate(raw))) {
    const d = parseDate(raw);
    if (!d) return "(none)";
    return bucketKey(d, dim.timeGrain);
  }
  const label = displayFieldValue(field, raw);
  return label === "—" || !label.trim() ? "(none)" : label;
}

function measureValue(mod: CrmModule, rec: CrmRecord, measure: ChartMeasure): number | string | null {
  if (measure.fn === "count") return 1;
  const field = measure.field ? resolveChartField(mod, measure.field) : undefined;
  if (!field) return measure.fn === "count_distinct" ? rec.id : null;
  const raw = rec.values[field.apiKey];
  if (measure.fn === "count_distinct") return displayFieldValue(field, raw) || rec.id;
  return parseNumber(raw);
}

function aggregate(fn: ChartMeasureFn, values: Array<number | string>): number {
  if (fn === "count") return values.length;
  if (fn === "count_distinct") return new Set(values.map(String)).size;
  const nums = values.filter((v): v is number => typeof v === "number");
  if (!nums.length) return 0;
  if (fn === "sum") return nums.reduce((a, b) => a + b, 0);
  if (fn === "avg") return nums.reduce((a, b) => a + b, 0) / nums.length;
  if (fn === "min") return Math.min(...nums);
  if (fn === "max") return Math.max(...nums);
  return nums.length;
}

function measureLabel(mod: CrmModule, measure: ChartMeasure): string {
  if (measure.label?.trim()) return measure.label.trim();
  if (measure.fn === "count") return "Count";
  const field = measure.field ? resolveChartField(mod, measure.field) : undefined;
  const noun = field?.label ?? measure.field ?? "value";
  const prefix: Record<ChartMeasureFn, string> = {
    count: "Count",
    count_distinct: "Unique",
    sum: "Sum of",
    avg: "Avg",
    min: "Min",
    max: "Max",
  };
  return `${prefix[measure.fn]} ${noun}`.trim();
}

function recordMatchesFilters(mod: CrmModule, rec: CrmRecord, filters: WorkspaceChart["filters"]): boolean {
  if (!filters?.length) return true;
  return filters.every((f) => {
    const needle = f.value.trim().toLowerCase();
    if (!needle) return true;
    if (f.field === CHART_CREATED_AT) return rec.createdAt.toLowerCase().includes(needle);
    if (f.field === CHART_UPDATED_AT) return rec.updatedAt.toLowerCase().includes(needle);
    const field = resolveChartField(mod, f.field);
    if (!field) return false;
    const display = displayFieldValue(field, rec.values[field.apiKey]).toLowerCase();
    const raw = (rec.values[field.apiKey] ?? "").toLowerCase();
    return display === needle || raw === needle || display.includes(needle);
  });
}

export function runChart(ws: CrmWorkspace, chart: WorkspaceChart): ChartResult {
  const mod = chart.moduleId ? findModule(ws, chart.moduleId) : ws.modules[0];
  if (!mod) {
    return {
      title: chart.name,
      moduleLabel: "",
      recordCount: 0,
      matched: 0,
      labels: [],
      series: [],
      rows: [],
      dimensionLabel: "",
      error: "Pick a module for this chart.",
    };
  }

  const matched = mod.records.filter((r) => recordMatchesFilters(mod, r, chart.filters));
  const dim0 = chart.dimensions[0] ?? { field: CHART_CREATED_AT, timeGrain: "month" as const };
  const dim1 = chart.dimensions[1];
  const measures = chart.measures.length ? chart.measures : [{ id: "count", fn: "count" as const, label: "Count" }];

  const groups = new Map<string, Map<string, CrmRecord[]>>();
  for (const rec of matched) {
    const x = dimensionValue(mod, rec, dim0);
    if (!groups.has(x)) groups.set(x, new Map());
    const seriesKey = dim1 ? dimensionValue(mod, rec, dim1) : "__single";
    const bucket = groups.get(x)!;
    if (!bucket.has(seriesKey)) bucket.set(seriesKey, []);
    bucket.get(seriesKey)!.push(rec);
  }

  const rawKeys = [...groups.keys()];
  const labels = dim0.timeGrain ? fillKeys(rawKeys, dim0.timeGrain) : rawKeys;
  const displayLabels = labels.map((k) => formatBucketLabel(k, dim0.timeGrain));

  let seriesNames: string[];
  if (dim1) {
    const names = new Set<string>();
    for (const bucket of groups.values()) for (const k of bucket.keys()) names.add(k);
    seriesNames = [...names];
  } else {
    seriesNames = measures.map((m) => measureLabel(mod, m));
  }

  const series: ChartSeries[] = seriesNames.map((name) => ({ name, values: labels.map(() => 0) }));

  labels.forEach((key, i) => {
    const bucket = groups.get(key);
    if (dim1) {
      const measure = measures[0]!;
      series.forEach((s) => {
        const recs = bucket?.get(s.name) ?? [];
        const vals = recs.map((r) => measureValue(mod, r, measure)).filter((v) => v != null) as Array<number | string>;
        s.values[i] = aggregate(measure.fn, vals);
      });
    } else {
      const recs: CrmRecord[] = [];
      if (bucket) {
        for (const list of bucket.values()) recs.push(...list);
      }
      measures.forEach((measure, mi) => {
        const vals = recs.map((r) => measureValue(mod, r, measure)).filter((v) => v != null) as Array<number | string>;
        series[mi]!.values[i] = aggregate(measure.fn, vals);
      });
    }
  });

  const dimField = isSpecialDateField(dim0.field)
    ? dim0.field === CHART_CREATED_AT
      ? "Created time"
      : "Updated time"
    : resolveChartField(mod, dim0.field)?.label ?? dim0.field;

  const rows = displayLabels.map((label, i) => {
    const values: Record<string, number> = {};
    for (const s of series) values[s.name] = s.values[i] ?? 0;
    return { label, values };
  });

  return {
    title: chart.name,
    moduleLabel: mod.pluralLabel,
    recordCount: mod.records.length,
    matched: matched.length,
    labels: displayLabels,
    series,
    rows,
    dimensionLabel: dim0.timeGrain ? `${dimField} (${dim0.timeGrain})` : dimField,
  };
}

export function compactModulesForAgent(ws: CrmWorkspace) {
  return ws.modules.map((m) => ({
    id: m.id,
    apiKey: m.apiKey,
    label: m.label,
    pluralLabel: m.pluralLabel,
    recordCount: m.records.length,
    fields: m.fields.map((f) => ({
      apiKey: f.apiKey,
      label: f.label,
      dataType: f.dataType,
      options: f.options.slice(0, 12).map((o) => o.label),
    })),
    specialFields: [
      { apiKey: CHART_CREATED_AT, label: "Created time", dataType: "date_time" },
      { apiKey: CHART_UPDATED_AT, label: "Updated time", dataType: "date_time" },
    ],
  }));
}
