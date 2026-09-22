"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ListColumnPicker } from "@/components/crm/list-column-picker";
import { ListFiltersPanel } from "@/components/crm/list-filters-panel";
import { RecordEditorModal } from "@/components/crm/record-editor-modal";
import { CrmAgentPanel } from "@/components/crm/crm-agent-panel";
import { useCrm } from "@/components/crm/crm-provider";
import { IconFilter, IconPlus, IconSparkle, IconTrash } from "@/components/icons";
import {
  displayFieldValue,
  fieldById,
  initialsFromName,
  recordMatchesStage,
  recordStageLabel,
  recordTitle,
  stagePillStyle,
} from "@/lib/crm/display";
import { formatRelativeTime } from "@/lib/crm/format";
import { recordMatchesListFilter, searchRecords, sortRecords, type ListSortKey } from "@/lib/crm/list-query";
import { findModule, setListColumns } from "@/lib/crm/ops";
import {
  deleteSavedListFilter,
  loadSavedListFilters,
  upsertSavedListFilter,
  type SavedListFilter,
} from "@/lib/crm/saved-list-filters";
import { activeFilterClauseCount } from "@/lib/leads/evaluate-lead-filters";
import type { LeadFilterConfig } from "@/lib/leads/lead-filter-types";

export function RecordList({ moduleId }: { moduleId: string }) {
  const { workspace, save } = useCrm();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [stageTab, setStageTab] = useState("all");
  const [sort, setSort] = useState<ListSortKey>("updated");
  const [createOpen, setCreateOpen] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [applied, setApplied] = useState<LeadFilterConfig | null>(null);
  const [saved, setSaved] = useState<SavedListFilter[]>([]);
  const mod = workspace ? findModule(workspace, moduleId) : undefined;

  useEffect(() => {
    if (!mod) return;
    const reload = () => setSaved(loadSavedListFilters(mod.id));
    reload();
    window.addEventListener("sirrus2-list-filters-changed", reload);
    return () => window.removeEventListener("sirrus2-list-filters-changed", reload);
  }, [mod?.id]);

  const columnIds = useMemo(() => {
    if (!mod) return [];
    return mod.listColumnFieldIds.length ? mod.listColumnFieldIds : mod.fields.slice(0, 6).map((f) => f.id);
  }, [mod]);

  const columns = useMemo(() => {
    if (!mod) return [];
    return columnIds.map((id) => fieldById(mod, id)).filter((f): f is NonNullable<typeof f> => !!f);
  }, [mod, columnIds]);

  const nameField = mod ? (mod.fields.find((f) => f.apiKey === mod.nameFieldApiKey) ?? columns[0]) : undefined;
  const dataCols = columns.filter((c) => c.id !== nameField?.id);

  const pipelineRows = useMemo(() => {
    if (!mod) return [];
    const afterSearch = searchRecords(mod, mod.records, q).filter((r) => recordMatchesListFilter(mod, r, applied));
    return afterSearch;
  }, [mod, q, applied]);

  const stageTabs = useMemo(() => {
    if (!mod) return [{ id: "all", label: "All", count: 0 }];
    const stages = mod.blueprint.stages.map((s) => ({
      id: s.id,
      label: s.label,
      count: pipelineRows.filter((r) => recordMatchesStage(mod, r, s.id)).length,
    }));
    return [{ id: "all", label: "All", count: pipelineRows.length }, ...stages];
  }, [mod, pipelineRows]);

  const rows = useMemo(() => {
    if (!mod) return [];
    const staged = stageTab === "all" ? pipelineRows : pipelineRows.filter((r) => recordMatchesStage(mod, r, stageTab));
    return sortRecords(mod, staged, sort);
  }, [mod, pipelineRows, stageTab, sort]);

  if (!workspace || !mod) {
    return (
      <div className="page-canvas flex flex-1 items-center justify-center text-sm text-muted">
        Module not found.{" "}
        <Link href="/developer/lead-settings/modules-configurator" className="ml-1 font-medium text-accent">
          Open Modules
        </Link>
      </div>
    );
  }

  const persistColumns = (ids: string[]) => {
    save(setListColumns(workspace, mod.id, ids));
  };

  const runAiFilter = async () => {
    const prompt = aiPrompt.trim();
    if (!prompt || aiBusy) return;
    setAiBusy(true);
    setAiNote(null);
    try {
      const res = await fetch("/api/crm-list-filter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, fields: mod.fields }),
      });
      const data = (await res.json()) as { config?: LeadFilterConfig; explanation?: string; error?: string };
      if (!res.ok || !data.config) {
        setAiNote(data.error || "Could not build that filter.");
        return;
      }
      setApplied(data.config.conditions.length ? data.config : null);
      setAiNote(data.explanation ?? "Filter applied.");
    } catch {
      setAiNote("AI filter failed. Try the Filters panel.");
    } finally {
      setAiBusy(false);
    }
  };

  const filterCount = applied ? activeFilterClauseCount(applied, mod.fields) : 0;

  return (
    <div className="page-canvas flex min-h-0 flex-1 flex-col">
      <header className="shrink-0 border-b border-border-soft bg-surface/80 px-5 py-5 backdrop-blur sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="kicker">Pipeline</p>
            <h1 className="display mt-1 text-[34px] text-ink">{mod.pluralLabel}</h1>
            <p className="mt-1 text-[13px] text-muted">
              {mod.records.length} total
              {q || filterCount || stageTab !== "all" ? ` · ${rows.length} in view` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setAgentOpen(true)} className="btn-ghost">
              <IconSparkle className="size-3.5" />
              Agent
            </button>
            <button type="button" onClick={() => setCreateOpen(true)} className="btn-primary">
              <IconPlus className="size-3.5" />
              New {mod.label.toLowerCase()}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-[1680px] flex-1 flex-col px-4 pb-5 pt-4 sm:px-6">
        {mod.blueprint.stages.length > 0 ? (
          <div className="mb-3 flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:thin]">
            {stageTabs.map((row) => {
              const active = stageTab === row.id;
              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setStageTab(row.id)}
                  className={`chip ${active ? "bg-ink text-white" : "bg-surface text-ink ring-1 ring-border-soft hover:bg-[#f7f1e6]"}`}
                >
                  {row.label}
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${active ? "bg-white/20" : "bg-[#efe8dc] text-accent"}`}>
                    {row.count}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}

        {saved.length > 0 || filterCount > 0 ? (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {saved.map((f) => {
              const on = applied && JSON.stringify(applied.conditions) === JSON.stringify(f.config.conditions);
              return (
                <span key={f.id} className="inline-flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setApplied(f.config)}
                    className={`chip ${on ? "bg-ink text-white" : "bg-surface text-ink ring-1 ring-border-soft"}`}
                  >
                    {f.name}
                  </button>
                  <button type="button" className="text-muted hover:text-red-600" onClick={() => deleteSavedListFilter(mod.id, f.id)} aria-label={`Delete ${f.name}`}>
                    <IconTrash className="size-3" />
                  </button>
                </span>
              );
            })}
            {filterCount > 0 ? (
              <button type="button" onClick={() => setApplied(null)} className="text-[11px] font-medium text-accent hover:underline">
                Clear filters
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="card flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-border-soft px-3 py-2.5">
            <div className="flex h-10 min-w-[14rem] flex-1 items-center rounded-full border border-border-soft bg-[#f7f1e6] px-3">
              <svg className="mr-2 size-4 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
              </svg>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={`Search ${mod.pluralLabel.toLowerCase()}…`}
                className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-muted"
              />
            </div>
            <form
              className="flex h-10 min-w-[min(100%,20rem)] flex-[1.2] items-center rounded-full border border-accent/20 bg-[#eef6f3] px-3"
              onSubmit={(e) => {
                e.preventDefault();
                void runAiFilter();
              }}
            >
              <IconSparkle className="mr-2 size-4 text-accent" />
              <input
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Ask AI: assigned this month, open stage…"
                className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-muted"
              />
              <button type="submit" disabled={aiBusy || !aiPrompt.trim()} className="text-[12px] font-semibold text-accent disabled:opacity-40">
                {aiBusy ? "…" : "Apply"}
              </button>
            </form>
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className={`btn ${filterCount ? "border border-accent/30 bg-[#eef6f3] text-accent" : "btn-ghost"}`}
            >
              <IconFilter className="size-3.5" />
              Filters
              {filterCount ? <span className="rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-white">{filterCount}</span> : null}
            </button>
            <ListColumnPicker fields={mod.fields} selectedIds={columnIds} onChange={persistColumns} />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as ListSortKey)}
              className="h-10 rounded-full border border-border-soft bg-surface px-3 text-[12px] font-medium text-ink"
            >
              <option value="updated">Last updated</option>
              <option value="created">Date created</option>
              <option value="name">Name</option>
              <option value="id">ID</option>
              {dataCols.map((c) => (
                <option key={c.id} value={`field:${c.apiKey}`}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          {aiNote ? <p className="border-b border-border-soft px-4 py-2 text-[12px] text-muted">{aiNote}</p> : null}

          {rows.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
              <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-[#f4efe6] text-accent">
                <IconSparkle className="size-5" />
              </div>
              <p className="display text-[28px] text-ink">
                {q || filterCount || stageTab !== "all" ? "No records match" : `No ${mod.pluralLabel.toLowerCase()} yet`}
              </p>
              <p className="mt-2 max-w-sm text-[13px] text-muted">
                {q || filterCount || stageTab !== "all"
                  ? "Clear search or filters, or ask AI for a broader view."
                  : `Create the first ${mod.label.toLowerCase()} and it lands in this pipeline.`}
              </p>
              {!q && !filterCount && stageTab === "all" ? (
                <button type="button" onClick={() => setCreateOpen(true)} className="btn-primary mt-5">
                  New {mod.label.toLowerCase()}
                </button>
              ) : null}
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full min-w-max border-separate border-spacing-0 text-left">
                <thead className="sticky top-0 z-20">
                  <tr>
                    <th className="sticky left-0 z-30 whitespace-nowrap border-b border-border-soft bg-[#f7f1e6] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
                      {nameField?.label ?? "Name"}
                    </th>
                    {dataCols.map((c) => (
                      <th
                        key={c.id}
                        className="whitespace-nowrap border-b border-border-soft bg-[#f7f1e6] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted"
                      >
                        <button type="button" className="hover:text-accent" onClick={() => setSort(`field:${c.apiKey}`)}>
                          {c.label}
                        </button>
                      </th>
                    ))}
                    <th className="whitespace-nowrap border-b border-border-soft bg-[#f7f1e6] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
                      Updated
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const title = recordTitle(mod, r);
                    const stageLabel = recordStageLabel(mod, r);
                    const href = `/crm/modules/${mod.id}/records/${r.id}`;
                    return (
                      <tr key={r.id} className="group cursor-pointer" onClick={() => router.push(href)}>
                        <td className="sticky left-0 z-10 whitespace-nowrap border-b border-[#f0e8da] bg-surface px-4 py-3 group-hover:bg-[#f7f1e6]">
                          <span className="flex items-center gap-2.5">
                            <span className="avatar size-8">{initialsFromName(title)}</span>
                            <span className="min-w-0">
                              <span className="block max-w-[16rem] truncate text-[13px] font-semibold text-ink">{title}</span>
                              <span className="block font-mono text-[11px] text-muted">{r.displayId}</span>
                            </span>
                          </span>
                        </td>
                        {dataCols.map((c) => {
                          const raw = r.values[c.apiKey] ?? "";
                          const value = displayFieldValue(c, raw);
                          const isStage = c.apiKey === mod.stageFieldApiKey;
                          return (
                            <td key={c.id} className="max-w-[14rem] truncate whitespace-nowrap border-b border-[#f0e8da] px-4 py-3 text-[13px] text-ink group-hover:bg-[#f7f1e6]">
                              {isStage ? (
                                <span className="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={stagePillStyle(stageLabel)}>
                                  {stageLabel || "—"}
                                </span>
                              ) : (
                                value
                              )}
                            </td>
                          );
                        })}
                        <td className="whitespace-nowrap border-b border-[#f0e8da] px-4 py-3 text-[12px] text-muted group-hover:bg-[#f7f1e6]">
                          {formatRelativeTime(r.updatedAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-border-soft px-4 py-2 text-[12px] text-muted">
            <span>
              {rows.length} of {mod.records.length} records
            </span>
            <span>{columns.length} columns</span>
          </div>
        </div>
      </div>

      <ListFiltersPanel
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        fields={mod.fields}
        applied={applied}
        onApply={(c) => setApplied(c.conditions.length ? c : null)}
        onClear={() => setApplied(null)}
        onSave={(name, config) => {
          upsertSavedListFilter(mod.id, name, config);
          setApplied(config);
        }}
      />
      {createOpen ? (
        <RecordEditorModal workspace={workspace} module={mod} onClose={() => setCreateOpen(false)} onSave={save} />
      ) : null}
      <CrmAgentPanel
        open={agentOpen}
        onClose={() => setAgentOpen(false)}
        mode={mod.listingAgentId ? "custom" : "records"}
        customAgentId={mod.listingAgentId ?? null}
        focusModuleId={mod.id}
        moduleLabel={mod.pluralLabel}
      />
    </div>
  );
}
