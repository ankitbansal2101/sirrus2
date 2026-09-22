"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChartView } from "@/components/charts/chart-view";
import { useCrm } from "@/components/crm/crm-provider";
import { DeveloperPageHeader } from "@/components/developer/developer-page-header";
import { IconPlus, IconSparkle, IconTrash } from "@/components/icons";
import { IconReports } from "@/components/settings-card-icons";
import type { AgentChatMessage } from "@/lib/agent/types";
import { inferChartFromPrompt, resolveInferredChart } from "@/lib/crm/chart-infer";
import { fieldOptionsForCharts, runChart } from "@/lib/crm/chart-query";
import { newCrmId } from "@/lib/crm/ids";
import {
  addChart,
  blankWorkspace,
  chartsOf,
  findChart,
  findModule,
  removeChart,
  updateChart,
} from "@/lib/crm/ops";
import {
  CHART_CREATED_AT,
  CHART_MEASURE_FNS,
  CHART_TIME_GRAINS,
  CHART_TYPES,
  type ChartMeasureFn,
  type ChartTimeGrain,
  type ChartType,
  type CrmWorkspace,
  type WorkspaceChart,
} from "@/lib/crm/types";

const EXAMPLES = [
  "Bar chart for leads created every month",
  "Pie of leads by source",
  "Line chart of lead budget by month",
  "Leads by stage",
];

const TYPE_LABEL: Record<ChartType, string> = {
  bar: "Bar",
  line: "Line",
  area: "Area",
  pie: "Pie",
  donut: "Donut",
  table: "Table",
};

const FN_LABEL: Record<ChartMeasureFn, string> = {
  count: "Count",
  count_distinct: "Unique",
  sum: "Sum",
  avg: "Average",
  min: "Min",
  max: "Max",
};

export function ChartStudio() {
  const { workspace, save } = useCrm();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const charts = workspace ? chartsOf(workspace) : [];
  const selectedId = params.get("chart");
  const selected = workspace && selectedId ? findChart(workspace, selectedId) : undefined;
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = (id: string | null) => {
    const qs = id ? `?chart=${encodeURIComponent(id)}` : "";
    router.replace(`${pathname}${qs}`);
  };

  const applySpec = (spec: ReturnType<typeof resolveInferredChart>, sourcePrompt: string) => {
    const base = workspace ?? blankWorkspace();
    const existing = selectedId ? findChart(base, selectedId) : undefined;
    if (existing) {
      save(updateChart(base, existing.id, { ...spec, prompt: sourcePrompt }));
      return existing.id;
    }
    const { workspace: next, chart } = addChart(base, { ...spec, prompt: sourcePrompt });
    save(next);
    return chart.id;
  };

  const build = async (text: string, refine = false) => {
    const q = text.trim();
    if (!q || !workspace) return;
    setBusy(true);
    setError(null);
    try {
      const messages: AgentChatMessage[] = [{ role: "user", content: q }];
      const res = await fetch("/api/chart-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages,
          workspace,
          current: refine && selected ? selected : null,
        }),
      });
      const json = (await res.json()) as { chart?: Parameters<typeof resolveInferredChart>[1]; error?: string; assistantMessage?: string };
      if (!res.ok && !json.chart) throw new Error(json.error || `Agent failed (${res.status})`);
      const spec = json.chart
        ? resolveInferredChart(workspace, { ...json.chart, prompt: q })
        : inferChartFromPrompt(q, workspace);
      const id = applySpec(spec, q);
      setPrompt("");
      open(id);
    } catch (e) {
      try {
        const spec = inferChartFromPrompt(q, workspace);
        const id = applySpec(spec, q);
        setPrompt("");
        open(id);
      } catch {
        setError(e instanceof Error ? e.message : "Could not build that chart.");
      }
    } finally {
      setBusy(false);
    }
  };

  if (selected && workspace) {
    return (
      <ChartEditor
        workspace={workspace}
        chart={selected}
        busy={busy}
        error={error}
        prompt={prompt}
        onPrompt={setPrompt}
        onBuild={(text) => void build(text, true)}
        onPatch={(patch) => save(updateChart(workspace, selected.id, patch))}
        onDelete={() => {
          if (!confirm(`Delete ${selected.name}?`)) return;
          save(removeChart(workspace, selected.id));
          open(null);
        }}
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <DeveloperPageHeader
        backHref="/"
        title="Charts"
        description="Ask for what you want — module, chart type, dimensions, and measures — or configure them yourself."
      />
      <main className="page-canvas min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-8">
        <div className="mx-auto max-w-[1200px] space-y-6">
          <PromptBar value={prompt} busy={busy} error={error} onChange={setPrompt} onSubmit={() => void build(prompt)} />
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => void build(ex)}
                className="rounded-full border border-border-soft bg-white px-3 py-1 text-[12px] text-muted hover:border-accent/30 hover:text-ink"
              >
                {ex}
              </button>
            ))}
          </div>

          {charts.length === 0 ? (
            <div className="card px-8 py-14 text-center">
              <IconReports className="mx-auto size-10 text-accent" />
              <p className="display mt-4 text-3xl text-ink">No charts yet</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted">
                Try “Bar chart for leads created every month”. The agent picks the module, dimension, time grain, and measure.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              {charts.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => open(c.id)}
                  className="card card-hover p-4 text-left"
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-[15px] font-semibold text-ink">{c.name}</h2>
                      <p className="text-[11px] text-muted">
                        {TYPE_LABEL[c.chartType]} · {findModule(workspace!, c.moduleId)?.pluralLabel ?? "Module"}
                      </p>
                    </div>
                    <span className="chip bg-[#f4efe6] text-muted">
                      {c.chartType}
                    </span>
                  </div>
                  <ChartView result={runChart(workspace!, c)} chartType={c.chartType} height={200} />
                </button>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function PromptBar({
  value,
  busy,
  error,
  onChange,
  onSubmit,
}: {
  value: string;
  busy: boolean;
  error: string | null;
  onChange: (v: string) => void;
  onSubmit: () => void;
}) {
  return (
    <form
      className="rounded-2xl border border-border-soft bg-white p-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <div className="flex items-center gap-2">
        <IconSparkle className="ml-2 size-4 shrink-0 text-accent" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="What do you want to build? e.g. bar chart for leads created every month"
          className="min-w-0 flex-1 bg-transparent py-2 text-sm text-ink outline-none placeholder:text-muted"
        />
        <button
          type="submit"
          disabled={busy || !value.trim()}
          className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Building…" : "Build with AI"}
        </button>
      </div>
      {error ? <p className="px-3 pb-1 text-[12px] text-red-600">{error}</p> : null}
    </form>
  );
}

function ChartEditor({
  workspace,
  chart,
  busy,
  error,
  prompt,
  onPrompt,
  onBuild,
  onPatch,
  onDelete,
}: {
  workspace: CrmWorkspace;
  chart: WorkspaceChart;
  busy: boolean;
  error: string | null;
  prompt: string;
  onPrompt: (v: string) => void;
  onBuild: (text: string) => void;
  onPatch: (patch: Partial<WorkspaceChart>) => void;
  onDelete: () => void;
}) {
  const mod = findModule(workspace, chart.moduleId) ?? workspace.modules[0];
  const fields = mod ? fieldOptionsForCharts(mod) : [];
  const result = useMemo(() => runChart(workspace, chart), [workspace, chart]);
  const dim = chart.dimensions[0] ?? { field: CHART_CREATED_AT, timeGrain: "month" as const };
  const measure = chart.measures[0] ?? { id: "count", fn: "count" as const };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <DeveloperPageHeader
        backHref="/crm/charts"
        title={chart.name}
        description={`${result.matched} of ${result.recordCount} ${result.moduleLabel || "records"} · ${result.dimensionLabel}`}
        actions={
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex items-center gap-1.5 rounded-full border border-border-soft bg-white px-3 py-1.5 text-xs font-semibold text-muted hover:text-ink"
          >
            <IconTrash className="size-3.5" />
            Delete
          </button>
        }
      />
      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="min-h-0 overflow-y-auto border-b border-border-soft bg-surface p-4 lg:border-b-0 lg:border-r">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-muted">Ask the agent</label>
          <div className="mt-1 flex gap-2">
            <input
              value={prompt}
              onChange={(e) => onPrompt(e.target.value)}
              placeholder="Switch to a pie by source…"
              className="min-w-0 flex-1 rounded-lg border border-border-soft bg-white px-2.5 py-1.5 text-sm"
            />
            <button
              type="button"
              disabled={busy || !prompt.trim()}
              onClick={() => onBuild(prompt)}
              className="rounded-lg bg-ink px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
            >
              {busy ? "…" : "Go"}
            </button>
          </div>
          {error ? <p className="mt-1 text-[12px] text-red-600">{error}</p> : null}

          <label className="mt-4 block text-[11px] font-semibold uppercase tracking-wide text-muted">Name</label>
          <input
            value={chart.name}
            onChange={(e) => onPatch({ name: e.target.value })}
            className="mt-1 w-full rounded-lg border border-border-soft bg-white px-2.5 py-1.5 text-sm"
          />

          <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wide text-muted">Module</label>
          <select
            value={chart.moduleId}
            onChange={(e) => onPatch({ moduleId: e.target.value })}
            className="mt-1 w-full rounded-lg border border-border-soft bg-white px-2.5 py-1.5 text-sm"
          >
            {workspace.modules.map((m) => (
              <option key={m.id} value={m.id}>
                {m.pluralLabel}
              </option>
            ))}
          </select>

          <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wide text-muted">Chart type</label>
          <div className="mt-1 grid grid-cols-3 gap-1.5">
            {CHART_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => onPatch({ chartType: t })}
                className={`rounded-lg px-2 py-1.5 text-[11px] font-semibold ${
                  chart.chartType === t ? "bg-accent text-white" : "border border-border-soft bg-white text-muted"
                }`}
              >
                {TYPE_LABEL[t]}
              </button>
            ))}
          </div>

          <h3 className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-muted">Dimension</h3>
          <select
            value={dim.field}
            onChange={(e) => onPatch({ dimensions: [{ ...dim, field: e.target.value }] })}
            className="mt-1 w-full rounded-lg border border-border-soft bg-white px-2.5 py-1.5 text-sm"
          >
            {fields.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
          <select
            value={dim.timeGrain ?? ""}
            onChange={(e) =>
              onPatch({
                dimensions: [{ ...dim, timeGrain: (e.target.value || undefined) as ChartTimeGrain | undefined }],
              })
            }
            className="mt-1.5 w-full rounded-lg border border-border-soft bg-white px-2.5 py-1.5 text-sm"
          >
            <option value="">No time grain</option>
            {CHART_TIME_GRAINS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>

          <div className="mt-4 flex items-center justify-between">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted">Measures</h3>
            <button
              type="button"
              onClick={() =>
                onPatch({
                  measures: [...chart.measures, { id: newCrmId("ms"), fn: "count", label: "Count" }],
                })
              }
              className="text-[11px] font-semibold text-accent"
            >
              <span className="inline-flex items-center gap-1">
                <IconPlus className="size-3" /> Add
              </span>
            </button>
          </div>
          <div className="mt-1 space-y-2">
            {chart.measures.map((m, i) => (
              <div key={m.id} className="rounded-xl border border-border-soft bg-white p-2">
                <div className="flex gap-1.5">
                  <select
                    value={m.fn}
                    onChange={(e) => {
                      const next = chart.measures.slice();
                      next[i] = { ...m, fn: e.target.value as ChartMeasureFn };
                      onPatch({ measures: next });
                    }}
                    className="flex-1 rounded border border-border-soft px-1.5 py-1 text-[11px]"
                  >
                    {CHART_MEASURE_FNS.map((fn) => (
                      <option key={fn} value={fn}>
                        {FN_LABEL[fn]}
                      </option>
                    ))}
                  </select>
                  {chart.measures.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => onPatch({ measures: chart.measures.filter((x) => x.id !== m.id) })}
                      className="text-muted"
                      aria-label="Remove measure"
                    >
                      <IconTrash className="size-3.5" />
                    </button>
                  ) : null}
                </div>
                {m.fn !== "count" ? (
                  <select
                    value={m.field ?? ""}
                    onChange={(e) => {
                      const next = chart.measures.slice();
                      next[i] = { ...m, field: e.target.value };
                      onPatch({ measures: next });
                    }}
                    className="mt-1.5 w-full rounded border border-border-soft px-1.5 py-1 text-[11px]"
                  >
                    <option value="">Select field</option>
                    {fields
                      .filter((f) => f.kind === "number" || m.fn === "count_distinct")
                      .map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                  </select>
                ) : null}
              </div>
            ))}
          </div>
        </aside>

        <section className="min-h-0 overflow-y-auto bg-[#eef0f5] p-5">
          <div className="rounded-2xl border border-dashed border-[#c9ceda] bg-white p-5">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">{TYPE_LABEL[chart.chartType]} preview</p>
            <h2 className="mb-4 text-[16px] font-semibold tracking-tight text-ink">{chart.name}</h2>
            <ChartView result={result} chartType={chart.chartType} height={320} />
          </div>
        </section>
      </div>
    </div>
  );
}
