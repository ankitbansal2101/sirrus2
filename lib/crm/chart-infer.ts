import { findModule } from "@/lib/crm/ops";
import { isNumericField, resolveChartField } from "@/lib/crm/chart-query";
import { newCrmId } from "@/lib/crm/ids";
import {
  CHART_CREATED_AT,
  CHART_TYPES,
  CHART_TIME_GRAINS,
  type ChartMeasure,
  type ChartTimeGrain,
  type ChartType,
  type CrmModule,
  type CrmWorkspace,
  type WorkspaceChart,
} from "@/lib/crm/types";

export type InferredChart = Pick<
  WorkspaceChart,
  "name" | "description" | "moduleId" | "chartType" | "dimensions" | "measures" | "filters" | "prompt"
>;

function detectChartType(text: string): ChartType {
  const t = text.toLowerCase();
  if (/\bdonut\b/.test(t)) return "donut";
  if (/\bpie\b/.test(t)) return "pie";
  if (/\barea\b/.test(t)) return "area";
  if (/\bline\b/.test(t)) return "line";
  if (/\btable\b|\bspread\b/.test(t)) return "table";
  return "bar";
}

function detectGrain(text: string): ChartTimeGrain | undefined {
  const t = text.toLowerCase();
  if (/\b(every|per|by|each)\s+day|daily\b/.test(t)) return "day";
  if (/\b(every|per|by|each)\s+week|weekly\b/.test(t)) return "week";
  if (/\b(every|per|by|each)\s+quarter|quarterly\b/.test(t)) return "quarter";
  if (/\b(every|per|by|each)\s+year|yearly|annually\b/.test(t)) return "year";
  if (/\b(every|per|by|each)\s+month|monthly\b/.test(t)) return "month";
  return undefined;
}

function detectModule(text: string, ws: CrmWorkspace): CrmModule | undefined {
  const t = text.toLowerCase();
  const scored = ws.modules
    .map((m) => {
      const keys = [m.pluralLabel, m.label, m.apiKey].map((s) => s.toLowerCase());
      const hit = keys.some((k) => t.includes(k));
      return { m, hit, len: Math.max(...keys.map((k) => k.length)) };
    })
    .filter((x) => x.hit)
    .sort((a, b) => b.len - a.len);
  return scored[0]?.m ?? ws.modules[0];
}

function detectMeasureFn(text: string): ChartMeasure["fn"] {
  const t = text.toLowerCase();
  if (/\bunique\b|\bdistinct\b/.test(t)) return "count_distinct";
  if (/\baverage\b|\bavg\b|\bmean\b/.test(t)) return "avg";
  if (/\bsum\b|\btotal\b|\bvalue\b/.test(t)) return "sum";
  if (/\bmin(imum)?\b/.test(t)) return "min";
  if (/\bmax(imum)?\b/.test(t)) return "max";
  return "count";
}

function findFieldInText(mod: CrmModule, text: string) {
  const t = text.toLowerCase();
  return [...mod.fields]
    .sort((a, b) => b.label.length - a.label.length)
    .find((f) => t.includes(f.label.toLowerCase()) || t.includes(f.apiKey.toLowerCase()));
}

function byPhraseField(mod: CrmModule, text: string) {
  const m = text.toLowerCase().match(/\bby\s+([a-z0-9 _-]{2,40})/);
  if (!m) return undefined;
  const phrase = m[1]!.trim();
  return (
    resolveChartField(mod, phrase) ??
    mod.fields.find((f) => phrase.includes(f.label.toLowerCase()) || phrase.includes(f.apiKey.toLowerCase()))
  );
}

export function inferChartFromPrompt(prompt: string, ws: CrmWorkspace): InferredChart {
  const text = prompt.trim();
  const mod = detectModule(text, ws);
  const chartType = detectChartType(text);
  const grain = detectGrain(text);
  const created = /\bcreated\b|\bcreation\b|\bsigned\s+up\b/.test(text.toLowerCase());
  const fn = detectMeasureFn(text);
  const byField = mod ? byPhraseField(mod, text) : undefined;
  const mentioned = mod ? findFieldInText(mod, text) : undefined;
  const numeric = mentioned && isNumericField(mentioned) ? mentioned : mod?.fields.find(isNumericField);

  const usesTime = Boolean(grain) || created;
  const dimField = usesTime
    ? byField && byField.dataType.startsWith("date")
      ? byField.apiKey
      : CHART_CREATED_AT
    : byField?.apiKey ?? (chartType === "pie" || chartType === "donut" ? mod?.stageFieldApiKey : undefined) ?? CHART_CREATED_AT;

  const timeGrain = usesTime || dimField === CHART_CREATED_AT ? grain ?? (usesTime ? "month" : undefined) : undefined;

  const measures: ChartMeasure[] =
    fn === "count" && !numeric
      ? [{ id: newCrmId("ms"), fn: "count", label: "Count" }]
      : [
          {
            id: newCrmId("ms"),
            fn: fn === "count" && numeric ? "sum" : fn,
            field: numeric?.apiKey,
            label: numeric ? `${fn === "count" ? "Sum of" : fn} ${numeric.label}` : undefined,
          },
        ];

  const dimLabel = dimField === CHART_CREATED_AT ? "created time" : byField?.label ?? mentioned?.label ?? dimField;
  const grainLabel = timeGrain ? ` by ${timeGrain}` : dimField !== CHART_CREATED_AT ? ` by ${dimLabel}` : "";
  const name =
    `${mod?.pluralLabel ?? "Records"} ${measures[0]?.fn === "count" ? "count" : measures[0]?.label ?? ""}`.trim() + grainLabel;

  return {
    name: name.replace(/\s+/g, " ").trim() || "Chart",
    description: text,
    prompt: text,
    moduleId: mod?.id ?? "",
    chartType,
    dimensions: [{ field: dimField || CHART_CREATED_AT, timeGrain }],
    measures,
    filters: [],
  };
}

export function resolveInferredChart(ws: CrmWorkspace, raw: Partial<InferredChart> & { name?: string }): InferredChart {
  const mod =
    (raw.moduleId ? findModule(ws, raw.moduleId) : undefined) ??
    (raw.moduleId ? ws.modules.find((m) => m.label.toLowerCase() === raw.moduleId!.toLowerCase()) : undefined) ??
    ws.modules[0];

  const type = CHART_TYPES.includes(raw.chartType as ChartType) ? (raw.chartType as ChartType) : "bar";
  const dimensions = (raw.dimensions ?? []).map((d) => {
    const field =
      d.field === CHART_CREATED_AT || d.field === "__updated_at"
        ? d.field
        : resolveChartField(mod!, d.field)?.apiKey ?? d.field;
    const timeGrain = d.timeGrain && CHART_TIME_GRAINS.includes(d.timeGrain) ? d.timeGrain : undefined;
    return { field, timeGrain };
  });

  const measures = (raw.measures ?? []).map((m) => ({
    id: m.id || newCrmId("ms"),
    fn: m.fn,
    field: m.field ? resolveChartField(mod!, m.field)?.apiKey ?? m.field : m.field,
    label: m.label,
  }));

  return {
    name: raw.name?.trim() || "Untitled chart",
    description: raw.description ?? "",
    prompt: raw.prompt,
    moduleId: mod?.id ?? "",
    chartType: type,
    dimensions: dimensions.length ? dimensions : [{ field: CHART_CREATED_AT, timeGrain: "month" }],
    measures: measures.length ? measures : [{ id: newCrmId("ms"), fn: "count", label: "Count" }],
    filters: raw.filters ?? [],
  };
}
