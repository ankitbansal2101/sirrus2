"use client";

import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import {
  connectedModulePresenceLabel,
  CONNECTED_MODULE_LABELS,
  fieldsForConnectedModule,
} from "@/lib/leads/connected-module-fields";
import { normalizeFilterConfigForCompare } from "@/lib/leads/lead-filter-compare";
import { normalizeLeadFilterConfig } from "@/lib/leads/lead-filter-config-normalize";
import {
  activeFilterClauseCount,
  fieldByApiKey,
  isLeadFilterConditionReady,
  isValidOnDayTimePipe,
  syncConditionShape,
} from "@/lib/leads/evaluate-lead-filters";
import {
  buildEmptyPerFieldState,
  configFromPerFieldState,
  emptyRowForField,
  filterableFieldsSorted,
  perFieldStateFromConfig,
  type PerFieldFilterRow,
  type PerFieldFilterStateMap,
} from "@/lib/leads/lead-filter-field-state";
import { defaultOperatorForKind, filterFieldKind, isRelativeNDateOperator, operatorMeta, operatorsForKind } from "@/lib/leads/lead-filter-operators";
import type { ConnectedModuleFilterBlock, LeadFilterCondition, LeadFilterConfig } from "@/lib/leads/lead-filter-types";
import { emptyLeadFilterConfig, newEmptyCondition, type ConnectedModuleId } from "@/lib/leads/lead-filter-types";
import { loadSavedLeadFilters, upsertSavedLeadFilter } from "@/lib/leads/saved-lead-filters-storage";
import type { FieldDefinition } from "@/lib/fields-config/types";
import { optionsSorted } from "@/lib/fields-config/types";

type Props = {
  open: boolean;
  onClose: () => void;
  fields: FieldDefinition[];
  applied: LeadFilterConfig | null;
  /** Set when the user last applied a filter from the saved bar — enables “Update saved filter”. */
  appliedSavedFilterSourceId: string | null;
  onApply: (config: LeadFilterConfig) => void;
  onClearApplied: () => void;
};

function connectedBlockParticipatesDraft(block: ConnectedModuleFilterBlock): boolean {
  const mf = fieldsForConnectedModule(block.moduleId);
  if (block.presence === "without") return true;
  const ready = block.conditions.filter((c) => isLeadFilterConditionReady(c, mf));
  if (block.conditions.length === 0) return true;
  return ready.length > 0;
}

function stripAppliedConfig(
  leadConditions: LeadFilterCondition[],
  connected: ConnectedModuleFilterBlock[],
  leadFields: FieldDefinition[],
): LeadFilterConfig {
  const leadReady = leadConditions.filter((c) => isLeadFilterConditionReady(c, leadFields));
  const conn = connected
    .filter((b) => connectedBlockParticipatesDraft(b))
    .map((b) => {
      const mf = fieldsForConnectedModule(b.moduleId);
      if (b.presence === "without") return { ...b, conditions: [] as LeadFilterCondition[] };
      const conds = b.conditions.filter((c) => isLeadFilterConditionReady(c, mf));
      return { ...b, conditions: conds };
    });
  const out: LeadFilterConfig = { logic: "AND", conditions: leadReady };
  if (conn.length) out.connected = conn;
  return out;
}

export function LeadFiltersDrawer({
  open,
  onClose,
  fields,
  applied,
  appliedSavedFilterSourceId,
  onApply,
  onClearApplied,
}: Props) {
  const ff = useMemo(() => filterableFieldsSorted(fields), [fields]);
  const [states, setStates] = useState<PerFieldFilterStateMap>({});
  const [connected, setConnected] = useState<ConnectedModuleFilterBlock[]>([]);
  const [connectedOpen, setConnectedOpen] = useState(false);
  const [leadFieldsOpen, setLeadFieldsOpen] = useState(true);
  const [fieldSearch, setFieldSearch] = useState("");
  const [saveName, setSaveName] = useState("");
  const [saveOpen, setSaveOpen] = useState(false);
  const [savedVersion, bumpSavedList] = useReducer((x: number) => x + 1, 0);

  const resetFromApplied = useCallback(() => {
    const cfg = normalizeLeadFilterConfig(applied ?? emptyLeadFilterConfig());
    setStates(perFieldStateFromConfig(cfg, ff, fields));
    setConnected((cfg.connected ?? []).map((b) => ({ ...b, conditions: b.conditions.map((c) => ({ ...c })) })));
    setFieldSearch("");
    setLeadFieldsOpen(true);
    setConnectedOpen((cfg.connected?.length ?? 0) > 0);
    setSaveOpen(false);
    setSaveName("");
  }, [applied, ff, fields]);

  /** Whenever the panel opens or the applied list filter changes, reload the draft from `applied`. */
  useEffect(() => {
    if (!open) return;
    resetFromApplied();
  }, [open, applied, resetFromApplied]);

  useEffect(() => {
    const on = () => bumpSavedList();
    window.addEventListener("sirrus2-saved-lead-filters-changed", on);
    return () => window.removeEventListener("sirrus2-saved-lead-filters-changed", on);
  }, []);

  /** Keep rows when schema adds fields while panel is open. */
  useEffect(() => {
    if (!open) return;
    setStates((prev) => {
      const next: PerFieldFilterStateMap = { ...prev };
      for (const f of ff) {
        if (!(f.apiKey in next)) next[f.apiKey] = emptyRowForField(f);
      }
      for (const k of Object.keys(next)) {
        if (!ff.some((f) => f.apiKey === k)) delete next[k];
      }
      return next;
    });
  }, [ff, open]);

  const filteredFields = useMemo(() => {
    const q = fieldSearch.trim().toLowerCase();
    if (!q) return ff;
    return ff.filter((f) => f.label.toLowerCase().includes(q) || f.apiKey.toLowerCase().includes(q));
  }, [ff, fieldSearch]);

  const draftLeadConditions = useMemo(() => configFromPerFieldState(states, ff).conditions, [states, ff]);

  const appliedStrip = useMemo(() => stripAppliedConfig(draftLeadConditions, connected, fields), [draftLeadConditions, connected, fields]);

  const readyCount = useMemo(() => activeFilterClauseCount(appliedStrip, fields), [appliedStrip, fields]);

  /** Saved row to overwrite — from bar source id, or the saved entry that matches the filter currently applied to the list. */
  const savedEntryToUpdate = useMemo(() => {
    const list = loadSavedLeadFilters();
    if (appliedSavedFilterSourceId) {
      const byId = list.find((s) => s.id === appliedSavedFilterSourceId);
      if (byId) return byId;
    }
    if (!applied) return undefined;
    const appliedKey = normalizeFilterConfigForCompare(applied);
    return list.find((s) => normalizeFilterConfigForCompare(s.config) === appliedKey);
  }, [appliedSavedFilterSourceId, applied, savedVersion]);

  const patchLeadField = (apiKey: string, patch: Partial<PerFieldFilterRow>) => {
    const def = fieldByApiKey(fields, apiKey);
    if (!def) return;
    setStates((prev) => {
      const cur = prev[apiKey] ?? emptyRowForField(def);
      let next = { ...cur, ...patch };
      if (patch.operator !== undefined) {
        const kind = filterFieldKind(def);
        const m = operatorMeta(kind, next.operator);
        if (!m?.needsValue) next.value = "";
        if (!m?.needsValue2) {
          const keepOnDayTimeRange = next.operator === "on" && def.dataType === "date_time";
          if (!keepOnDayTimeRange) next.value2 = "";
          else {
            const v2 = next.value2.trim();
            if (v2 && !isValidOnDayTimePipe(v2)) next.value2 = "";
          }
        }
      }
      return { ...prev, [apiKey]: next };
    });
  };

  const setLeadFieldEnabled = (apiKey: string, enabled: boolean) => {
    const def = fieldByApiKey(fields, apiKey);
    if (!def) return;
    if (!enabled) {
      setStates((prev) => ({ ...prev, [apiKey]: emptyRowForField(def) }));
      return;
    }
    setStates((prev) => ({
      ...prev,
      [apiKey]: {
        enabled: true,
        operator: defaultOperatorForKind(filterFieldKind(def)),
        value: "",
        value2: "",
      },
    }));
  };

  const addConnectedModule = (moduleId: ConnectedModuleId) => {
    if (connected.some((b) => b.moduleId === moduleId)) return;
    setConnected((prev) => [...prev, { moduleId, presence: "with", conditions: [] }]);
    setConnectedOpen(true);
  };

  const removeConnectedBlock = (moduleId: ConnectedModuleId) => {
    setConnected((prev) => prev.filter((b) => b.moduleId !== moduleId));
  };

  const patchConnectedBlock = (moduleId: ConnectedModuleId, patch: Partial<ConnectedModuleFilterBlock>) => {
    setConnected((prev) =>
      prev.map((b) => {
        if (b.moduleId !== moduleId) return b;
        const next = { ...b, ...patch };
        if (patch.presence === "without") next.conditions = [];
        return next;
      }),
    );
  };

  const addModuleCondition = (moduleId: ConnectedModuleId) => {
    setConnected((prev) =>
      prev.map((b) => (b.moduleId === moduleId ? { ...b, conditions: [...b.conditions, newEmptyCondition()] } : b)),
    );
  };

  const patchModuleCond = (moduleId: ConnectedModuleId, condId: string, patch: Partial<LeadFilterCondition>) => {
    const mf = fieldsForConnectedModule(moduleId);
    setConnected((prev) =>
      prev.map((b) => {
        if (b.moduleId !== moduleId) return b;
        return {
          ...b,
          conditions: b.conditions.map((c) => {
            if (c.id !== condId) return c;
            const merged = { ...c, ...patch };
            const def = fieldByApiKey(mf, merged.fieldApiKey);
            return syncConditionShape(merged, def);
          }),
        };
      }),
    );
  };

  const removeModuleCond = (moduleId: ConnectedModuleId, condId: string) => {
    setConnected((prev) =>
      prev.map((b) => (b.moduleId !== moduleId ? b : { ...b, conditions: b.conditions.filter((c) => c.id !== condId) })),
    );
  };

  const onSaveNamed = () => {
    const name = saveName.trim();
    if (!name) return;
    const c = globalThis.crypto;
    const id = c && "randomUUID" in c && typeof c.randomUUID === "function" ? c.randomUUID() : `sf_${Date.now()}`;
    upsertSavedLeadFilter({
      id,
      name,
      entity: "lead",
      config: JSON.parse(JSON.stringify(appliedStrip)) as LeadFilterConfig,
      createdAt: new Date().toISOString(),
    });
    setSaveOpen(false);
    setSaveName("");
    window.dispatchEvent(new Event("sirrus2-saved-lead-filters-changed"));
  };

  const onUpdateSavedEntry = () => {
    if (!savedEntryToUpdate) return;
    upsertSavedLeadFilter({
      ...savedEntryToUpdate,
      config: JSON.parse(JSON.stringify(appliedStrip)) as LeadFilterConfig,
    });
    setSaveOpen(false);
    setSaveName("");
    window.dispatchEvent(new Event("sirrus2-saved-lead-filters-changed"));
  };

  const onApplyClick = () => {
    onApply(JSON.parse(JSON.stringify(appliedStrip)) as LeadFilterConfig);
    onClose();
  };

  const onClearClick = () => {
    onClearApplied();
    setStates(buildEmptyPerFieldState(ff));
    setConnected([]);
    setConnectedOpen(false);
  };

  if (!open) return null;

  const inputBase =
    "w-full min-w-0 rounded-md border border-[#d8dbe8] bg-white px-2.5 py-2 text-sm text-ink shadow-sm outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20";
  const selectBase =
    "w-full min-w-0 rounded-md border border-[#d8dbe8] bg-white px-2.5 py-2 text-sm text-ink shadow-sm outline-none focus:border-accent/50";

  /** Spec order: Channel Partner, Calls, Tasks. */
  const modulePickerOrder: ConnectedModuleId[] = ["channel_partner", "calls", "tasks"];

  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-black/40" role="dialog" aria-modal aria-labelledby="lead-filters-title">
      <button type="button" className="h-full min-w-0 flex-1 cursor-default border-0 bg-transparent" aria-label="Close filters" onClick={onClose} />
      <aside className="flex h-full w-[min(100%,32rem)] max-w-[480px] flex-col border-l border-[#dce0ea] bg-[#eef1f8] shadow-2xl sm:w-[32rem]">
        <div className="flex shrink-0 items-start justify-between gap-2 border-b border-[#dce0ea] bg-[#eef1f8] px-4 py-3">
          <div>
            <h2 id="lead-filters-title" className="text-base font-semibold tracking-tight text-[#1f1750]">
              Filter leads
            </h2>
            <p className="mt-0.5 text-[11px] text-[#6b6889]">
              All filterable lead fields are listed below. Tick a field, set operator and value. Everything combines with{" "}
              <span className="font-medium">AND</span>. When a filter is already applied to the list, opening this panel loads that configuration so
              you can edit, apply, or save.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-[#dce0ea] bg-white px-2.5 py-1.5 text-xs font-medium text-[#1f1750] shadow-sm hover:bg-zinc-50"
          >
            Close
          </button>
        </div>

        <div className="shrink-0 space-y-3 border-b border-[#dce0ea] bg-[#e8ebf4] px-4 py-3">
          {saveOpen ? (
            <div className="rounded-lg border border-[#dce0ea] bg-white p-3 shadow-sm">
              {savedEntryToUpdate ? (
                <div className="mb-3 space-y-2">
                  <p className="text-[11px] leading-snug text-[#6b6889]">
                    Update the existing saved entry with your current settings, or use a new name below to keep both.
                  </p>
                  <button
                    type="button"
                    onClick={onUpdateSavedEntry}
                    className="w-full rounded-lg border border-[#c4b8f3] bg-[#f5f3ff] px-3 py-2.5 text-left text-sm font-semibold text-[#4338a8] shadow-sm hover:bg-[#ebe8ff]"
                    title={savedEntryToUpdate.name}
                  >
                    Update saved: <span className="line-clamp-2 break-words font-bold">{savedEntryToUpdate.name}</span>
                  </button>
                  <div className="relative py-1 text-center text-[10px] font-medium uppercase tracking-wide text-[#9c99b5]">
                    <span className="relative z-[1] bg-white px-2">or save as new</span>
                    <span className="absolute left-0 right-0 top-1/2 z-0 h-px -translate-y-1/2 bg-[#e4e7f0]" aria-hidden />
                  </div>
                </div>
              ) : null}
              <label className="text-[11px] font-medium text-[#6b6889]">{savedEntryToUpdate ? "New saved filter name" : "Name this filter"}</label>
              <input
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="e.g. High budget, Site visit done"
                className={`${inputBase} mt-1.5`}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onSaveNamed}
                  disabled={!saveName.trim()}
                  className="rounded-lg bg-[#5c4dbe] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#4d3faf] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savedEntryToUpdate ? "Save as new" : "Save filter"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSaveOpen(false);
                    setSaveName("");
                  }}
                  className="rounded-lg border border-[#dce0ea] bg-white px-3 py-2 text-xs font-medium text-[#1f1750]"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setSaveOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#c9c5e8] bg-[#f5f3ff] py-2.5 text-sm font-semibold text-[#4338a8] shadow-sm transition hover:bg-[#ebe8ff]"
            >
              <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2zm0 15l-5-2.18L7 18V5h10v13z" />
              </svg>
              Save this filter
            </button>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {ff.length === 0 ? (
            <p className="text-sm text-[#6b6889]">
              No filterable fields. Enable “Include in dynamic lead filters” on fields in the configurator.
            </p>
          ) : (
            <>
              <div className="mb-2 space-y-2">
                <div className="relative">
                  <svg
                    className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[#9c99b5]"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden
                  >
                    <circle cx="11" cy="11" r="8" />
                    <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
                  </svg>
                  <input
                    type="search"
                    value={fieldSearch}
                    onChange={(e) => setFieldSearch(e.target.value)}
                    placeholder="Search fields…"
                    className={`${inputBase} pl-9`}
                    aria-label="Search fields"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => setLeadFieldsOpen((v) => !v)}
                className="flex w-full items-center gap-2 border-b border-[#dce0ea] bg-[#e4e7f0] px-3 py-2.5 text-left text-sm font-semibold text-[#1f1750] hover:bg-[#dde1ec]"
              >
                <span className="w-4 shrink-0 text-center text-xs text-[#6b6889]" aria-hidden>
                  {leadFieldsOpen ? "▼" : "▶"}
                </span>
                Filter by lead fields
                <span className="ml-auto text-xs font-normal text-[#6b6889]">{filteredFields.length}</span>
              </button>

              {leadFieldsOpen ? (
                <ul className="divide-y divide-[#dce0ea] border-x border-b border-[#dce0ea] bg-[#f7f8fc]">
                  {filteredFields.map((f) => {
                    const s = states[f.apiKey] ?? emptyRowForField(f);
                    const kind = filterFieldKind(f);
                    const ops = operatorsForKind(kind);
                    const cond: LeadFilterCondition = {
                      id: `cond_${f.apiKey}`,
                      fieldApiKey: f.apiKey,
                      operator: s.operator,
                      value: s.value,
                      value2: s.value2,
                    };
                    return (
                      <li key={f.id} className="px-3 py-3 sm:px-4">
                        <label className="flex cursor-pointer items-start gap-3">
                          <input
                            type="checkbox"
                            checked={s.enabled}
                            onChange={(e) => setLeadFieldEnabled(f.apiKey, e.target.checked)}
                            className="mt-1 size-4 shrink-0 rounded border-[#b7b6ca] text-accent focus:ring-accent"
                          />
                          <span className="min-w-0 flex-1 pt-0.5 text-sm font-medium leading-snug text-[#1f1750]">{f.label}</span>
                        </label>
                        {s.enabled ? (
                          <div className="ml-7 mt-3 space-y-2.5 border-l-2 border-[#dcd7f0] pl-3">
                            <ConditionOperatorValue
                              field={f}
                              condition={cond}
                              onPatch={(patch) => {
                                const row: Partial<PerFieldFilterRow> = {};
                                if (patch.operator !== undefined) row.operator = patch.operator;
                                if (patch.value !== undefined) row.value = patch.value;
                                if (patch.value2 !== undefined) row.value2 = patch.value2;
                                if (Object.keys(row).length) patchLeadField(f.apiKey, row);
                              }}
                              inputBase={inputBase}
                              selectBase={selectBase}
                            />
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              ) : null}

              <div className="mt-6 border-t border-[#dce0ea] pt-4">
                <button
                  type="button"
                  onClick={() => setConnectedOpen((v) => !v)}
                  className="flex w-full items-center gap-2 rounded-lg border border-[#dce0ea] bg-[#e4e7f0] px-3 py-2.5 text-left text-sm font-semibold text-[#1f1750] hover:bg-[#dde1ec]"
                >
                  <span className="w-4 shrink-0 text-center text-xs text-[#6b6889]" aria-hidden>
                    {connectedOpen ? "▼" : "▶"}
                  </span>
                  Connected modules
                  {connected.length ? (
                    <span className="ml-auto text-xs font-normal text-[#6b6889]">{connected.length} linked</span>
                  ) : null}
                </button>

                {connectedOpen ? (
                  <div className="mt-3 space-y-3">
                    <p className="text-[11px] leading-snug text-[#6b6889]">
                      Narrow leads by related Calls, Tasks, or Channel Partner records. Module fields mirror each module’s
                      configurator (sample data in this prototype).
                    </p>

                    <div className="flex flex-wrap gap-2" role="list" aria-label="Connected modules">
                      {modulePickerOrder.map((id) => {
                        const isAdded = connected.some((b) => b.moduleId === id);
                        return (
                          <button
                            key={id}
                            type="button"
                            role="listitem"
                            disabled={isAdded}
                            onClick={() => addConnectedModule(id)}
                            className={[
                              "min-h-[2.75rem] min-w-[7.5rem] flex-1 rounded-lg border px-3 py-2 text-left text-sm font-semibold transition sm:min-w-0 sm:flex-none",
                              isAdded
                                ? "cursor-default border-[#c9c5e8] bg-[#ede9fe] text-[#4338a8]"
                                : "cursor-pointer border-[#dce0ea] bg-white text-[#1f1750] shadow-sm hover:border-[#5c4dbe]/40 hover:bg-[#f5f3ff]",
                            ].join(" ")}
                            aria-pressed={isAdded}
                            aria-label={
                              isAdded
                                ? `${CONNECTED_MODULE_LABELS[id]} — added, configure below`
                                : `Add ${CONNECTED_MODULE_LABELS[id]} filter`
                            }
                          >
                            <span className="block leading-tight">{CONNECTED_MODULE_LABELS[id]}</span>
                            {isAdded ? (
                              <span className="mt-0.5 block text-[10px] font-medium text-[#6b6889]">Added — see below</span>
                            ) : (
                              <span className="mt-0.5 block text-[10px] font-normal text-[#6b6889]">Click to add</span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {connected.map((block) => (
                      <ConnectedBlockCard
                        key={block.moduleId}
                        block={block}
                        onPresence={(presence) => patchConnectedBlock(block.moduleId, { presence })}
                        onRemove={() => removeConnectedBlock(block.moduleId)}
                        onAddField={() => addModuleCondition(block.moduleId)}
                        onPatchCond={(condId, patch) => patchModuleCond(block.moduleId, condId, patch)}
                        onRemoveCond={(condId) => removeModuleCond(block.moduleId, condId)}
                        inputBase={inputBase}
                        selectBase={selectBase}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            </>
          )}
        </div>

        <div className="shrink-0 border-t border-[#dce0ea] bg-white px-4 py-3 shadow-[0_-4px_12px_rgba(31,23,80,0.06)]">
          <p className="mb-2 text-[11px] text-[#6b6889]">
            {readyCount} active clause{readyCount === 1 ? "" : "s"} will apply. Ticked fields with incomplete values are ignored.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onClearClick}
              className="rounded-lg border border-[#dce0ea] bg-white px-4 py-2.5 text-sm font-medium text-[#1f1750] shadow-sm hover:bg-[#f7f8fc]"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={onApplyClick}
              className="rounded-lg bg-[#5c4dbe] px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-[#4d3faf]"
            >
              Apply filter
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

function ConnectedBlockCard({
  block,
  onPresence,
  onRemove,
  onAddField,
  onPatchCond,
  onRemoveCond,
  inputBase,
  selectBase,
}: {
  block: ConnectedModuleFilterBlock;
  onPresence: (p: "with" | "without") => void;
  onRemove: () => void;
  onAddField: () => void;
  onPatchCond: (condId: string, patch: Partial<LeadFilterCondition>) => void;
  onRemoveCond: (condId: string) => void;
  inputBase: string;
  selectBase: string;
}) {
  const mf = fieldsForConnectedModule(block.moduleId);
  const label = CONNECTED_MODULE_LABELS[block.moduleId];
  const anyLabel = connectedModulePresenceLabel(block.moduleId);

  return (
    <div className="rounded-lg border border-[#c9c5e8] bg-[#faf9ff] p-3 shadow-sm">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-[#1f1750]">{label}</span>
        <button type="button" onClick={onRemove} className="text-xs font-medium text-[#8b86a8] hover:text-red-600">
          Remove module
        </button>
      </div>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <span className="text-xs text-[#6b6889]">Leads</span>
        <select
          value={block.presence}
          onChange={(e) => onPresence(e.target.value === "without" ? "without" : "with")}
          className={`${selectBase} sm:max-w-[11rem]`}
          aria-label={`${label} presence`}
        >
          <option value="with">with {anyLabel}</option>
          <option value="without">without {anyLabel}</option>
        </select>
      </div>

      {block.presence === "with" ? (
        <>
          <ul className="space-y-2">
            {block.conditions.map((c, i) => (
              <li key={c.id} className="rounded-md border border-[#e4e2f5] bg-white p-2">
                <div className="mb-1 flex justify-between gap-2">
                  <span className="text-[10px] font-medium text-[#6b6889]">{label} field {i + 1}</span>
                  <button type="button" onClick={() => onRemoveCond(c.id)} className="text-[10px] text-[#8b86a8] hover:text-red-600">
                    Remove
                  </button>
                </div>
                <div className="flex flex-col gap-2 lg:flex-row">
                  <div className="min-w-0 flex-1">
                    <select
                      value={c.fieldApiKey}
                      onChange={(e) => onPatchCond(c.id, { fieldApiKey: e.target.value })}
                      className={selectBase}
                      aria-label={`${label} field`}
                    >
                      <option value="">Select field…</option>
                      {[...mf]
                        .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }))
                        .map((f) => (
                          <option key={f.id} value={f.apiKey}>
                            {f.label}
                          </option>
                        ))}
                    </select>
                  </div>
                  <ConditionOperatorValue
                    field={fieldByApiKey(mf, c.fieldApiKey)}
                    condition={c}
                    onPatch={(patch) => onPatchCond(c.id, patch)}
                    inputBase={inputBase}
                    selectBase={selectBase}
                  />
                </div>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={onAddField}
            className="mt-2 w-full rounded border border-dashed border-[#c9c5e8] py-1.5 text-xs font-semibold text-[#4338a8] hover:bg-white"
          >
            + Add field
          </button>
        </>
      ) : (
        <p className="text-[11px] text-[#6b6889]">No field pickers — leads must have no {label.toLowerCase()} records.</p>
      )}
    </div>
  );
}

function ConditionOperatorValue({
  field,
  condition,
  onPatch,
  inputBase,
  selectBase,
}: {
  field: FieldDefinition | undefined;
  condition: LeadFilterCondition;
  onPatch: (patch: Partial<LeadFilterCondition>) => void;
  inputBase: string;
  selectBase: string;
}) {
  if (!field) {
    return (
      <div className="min-w-0 flex-[1.2] text-[11px] text-[#9c99b5] lg:pt-6">
        Select a field to choose an operator and value.
      </div>
    );
  }
  const kind = filterFieldKind(field);
  const ops = operatorsForKind(kind);
  const fallbackOp = ops[0]?.id ?? "";
  const effectiveOp = condition.operator || fallbackOp;
  const meta = operatorMeta(kind, effectiveOp) ?? ops[0]!;
  const legacyOption =
    condition.operator && !ops.some((o) => o.id === condition.operator) ? operatorMeta(kind, condition.operator) : null;

  return (
    <>
      <div className="min-w-0 flex-1">
        <label className="text-[10px] font-medium text-[#6b6889]">Operator</label>
        <select
          value={effectiveOp}
          onChange={(e) => onPatch({ operator: e.target.value })}
          className={`${selectBase} mt-0.5`}
          aria-label={`Operator for ${field.label}`}
        >
          {legacyOption ? (
            <option value={legacyOption.id}>
              {legacyOption.label}
            </option>
          ) : null}
          {ops.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="min-w-0 flex-[1.2]">
        <label className="text-[10px] font-medium text-[#6b6889]">Value</label>
        {field.dataType === "date_time" && meta.needsValue ? (
          field.apiKey === "contacted_date" ? (
            <p className="mt-1 text-[10px] leading-snug text-[#6b6889]">
              <span className="font-medium text-[#1f1750]">Contacted date</span>: pick the day. For <span className="font-medium text-[#1f1750]">On</span>, the whole day matches unless you set an optional time range below. For other operators, add a time only when you need a specific moment.
            </p>
          ) : (
            <p className="mt-1 text-[10px] leading-snug text-[#6b6889]">
              <span className="font-medium text-[#1f1750]">On</span> uses the date plus an optional same-day range below. Other operators: time next to the date is optional (whole day if omitted).
            </p>
          )
        ) : null}
        <div className="mt-0.5">
          <FieldValueEditor
            kind={kind}
            operator={effectiveOp}
            meta={meta}
            field={field}
            value={condition.value}
            value2={condition.value2}
            onChange={(v, v2) => onPatch({ value: v, value2: v2 })}
            inputBase={inputBase}
          />
        </div>
      </div>
    </>
  );
}

function parseIds(s: string): Set<string> {
  return new Set(s.split(",").map((x) => x.trim()).filter(Boolean));
}

/** Stored filter value → separate date and optional time (`YYYY-MM-DD` or `YYYY-MM-DDTHH:mm`). */
function splitFilterDateTime(raw: string): { date: string; time: string } {
  const t = raw.trim();
  if (!t) return { date: "", time: "" };
  const m = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?/.exec(t);
  if (m) return { date: m[1]!, time: m[2] ?? "" };
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return { date: "", time: "" };
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return { date: `${y}-${mo}-${day}`, time: `${h}:${min}` };
}

function mergeFilterDateTime(date: string, time: string): string {
  const d = date.trim();
  const tm = time.trim();
  if (!d) return "";
  if (!tm) return d;
  const norm = tm.length >= 5 ? tm.slice(0, 5) : tm;
  if (!/^\d{2}:\d{2}$/.test(norm)) return d;
  return `${d}T${norm}`;
}

/** `on` + date_time: optional same-day window `HH:mm|HH:mm`. */
function splitOnDayTimePipe(raw: string): { start: string; end: string } {
  const t = raw.trim();
  if (!t) return { start: "", end: "" };
  const parts = t.split("|");
  return { start: (parts[0] ?? "").trim(), end: (parts[1] ?? "").trim() };
}

function mergeOnDayTimePipe(start: string, end: string): string {
  const a = start.trim();
  const b = end.trim();
  if (!a && !b) return "";
  return `${a}|${b}`;
}

function FieldValueEditor({
  kind,
  operator,
  meta,
  field,
  value,
  value2,
  onChange,
  inputBase,
}: {
  kind: ReturnType<typeof filterFieldKind>;
  operator: string;
  meta: { id: string; needsValue: boolean; needsValue2: boolean };
  field: FieldDefinition;
  value: string;
  value2: string;
  onChange: (v: string, v2: string) => void;
  inputBase: string;
}) {
  if (!meta.needsValue && !meta.needsValue2) return <span className="text-[11px] text-[#9c99b5]">No value needed</span>;

  if (kind === "text") {
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value, value2)}
        placeholder="Value"
        className={inputBase}
      />
    );
  }

  if (kind === "picklist") {
    const selected = parseIds(value);
    return (
      <div className="max-h-36 space-y-1.5 overflow-y-auto rounded-md border border-[#d8dbe8] bg-white p-2 shadow-sm">
        {optionsSorted(field).map((o) => (
          <label key={o.id} className="flex cursor-pointer items-center gap-2 text-sm text-[#1f1750]">
            <input
              type="checkbox"
              checked={selected.has(o.id)}
              onChange={() => {
                const next = new Set(selected);
                if (next.has(o.id)) next.delete(o.id);
                else next.add(o.id);
                onChange([...next].join(","), value2);
              }}
              className="size-4 rounded border-[#b7b6ca] text-accent"
            />
            {o.label}
          </label>
        ))}
      </div>
    );
  }

  if (kind === "multi_select" && meta.needsValue) {
    const selected = parseIds(value);
    return (
      <div className="max-h-36 space-y-1.5 overflow-y-auto rounded-md border border-[#d8dbe8] bg-white p-2 shadow-sm">
        {optionsSorted(field).map((o) => (
          <label key={o.id} className="flex cursor-pointer items-center gap-2 text-sm text-[#1f1750]">
            <input
              type="checkbox"
              checked={selected.has(o.id)}
              onChange={() => {
                const next = new Set(selected);
                if (next.has(o.id)) next.delete(o.id);
                else next.add(o.id);
                onChange([...next].join(","), value2);
              }}
              className="size-4 rounded border-[#b7b6ca] text-accent"
            />
            {o.label}
          </label>
        ))}
      </div>
    );
  }

  if (kind === "number") {
    if (meta.needsValue2) {
      return (
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="number"
            value={value}
            onChange={(e) => onChange(e.target.value, value2)}
            placeholder="Min"
            className={inputBase}
          />
          <input
            type="number"
            value={value2}
            onChange={(e) => onChange(value, e.target.value)}
            placeholder="Max"
            className={inputBase}
          />
        </div>
      );
    }
    return <input type="number" value={value} onChange={(e) => onChange(e.target.value, value2)} placeholder="Number" className={inputBase} />;
  }

  if (kind === "date") {
    const isDateTime = field.dataType === "date_time";
    const d1 = splitFilterDateTime(value);
    const d2 = splitFilterDateTime(value2);
    const onPipe = operator === "on" && isDateTime ? splitOnDayTimePipe(value2) : { start: "", end: "" };

    if (isRelativeNDateOperator(operator)) {
      return (
        <input
          type="number"
          min={1}
          value={value}
          onChange={(e) => onChange(e.target.value, value2)}
          placeholder="n"
          className={inputBase}
        />
      );
    }
    if (meta.needsValue2) {
      if (isDateTime) {
        return (
          <div className="flex flex-col gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-[10px] font-medium text-[#6b6889]">From</span>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center">
                <input
                  type="date"
                  value={d1.date}
                  onChange={(e) => onChange(mergeFilterDateTime(e.target.value, d1.time), value2)}
                  className={inputBase}
                />
                <input
                  type="time"
                  step={60}
                  value={d1.time}
                  onChange={(e) => onChange(mergeFilterDateTime(d1.date, e.target.value), value2)}
                  className={`${inputBase} sm:max-w-[8.5rem]`}
                />
              </div>
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-[10px] font-medium text-[#6b6889]">To</span>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center">
                <input
                  type="date"
                  value={d2.date}
                  onChange={(e) => onChange(value, mergeFilterDateTime(e.target.value, d2.time))}
                  className={inputBase}
                />
                <input
                  type="time"
                  step={60}
                  value={d2.time}
                  onChange={(e) => onChange(value, mergeFilterDateTime(d2.date, e.target.value))}
                  className={`${inputBase} sm:max-w-[8.5rem]`}
                />
              </div>
            </div>
          </div>
        );
      }
      return (
        <div className="flex flex-col gap-2 sm:flex-row">
          <input type="date" value={value} onChange={(e) => onChange(e.target.value, value2)} className={inputBase} />
          <input type="date" value={value2} onChange={(e) => onChange(value, e.target.value)} className={inputBase} />
        </div>
      );
    }
    if (meta.needsValue) {
      if (!isDateTime) {
        return <input type="date" value={value} onChange={(e) => onChange(e.target.value, value2)} className={inputBase} />;
      }
      return (
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center">
            <input
              type="date"
              value={d1.date}
              onChange={(e) =>
                operator === "on"
                  ? onChange(e.target.value, value2)
                  : onChange(mergeFilterDateTime(e.target.value, d1.time), "")
              }
              className={inputBase}
            />
            {operator === "on" ? null : (
              <input
                type="time"
                step={60}
                value={d1.time}
                onChange={(e) => onChange(mergeFilterDateTime(d1.date, e.target.value), "")}
                className={`${inputBase} sm:max-w-[8.5rem]`}
              />
            )}
          </div>
          {operator === "on" ? (
            <div className="border-t border-[#ecebf4] pt-2">
              <span className="text-[10px] font-medium text-[#6b6889]">Optional same-day time range</span>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <input
                  type="time"
                  step={60}
                  value={onPipe.start}
                  onChange={(e) => onChange(value, mergeOnDayTimePipe(e.target.value, onPipe.end))}
                  className={`${inputBase} max-w-[8.5rem]`}
                />
                <span className="text-[11px] text-[#9c99b5]">to</span>
                <input
                  type="time"
                  step={60}
                  value={onPipe.end}
                  onChange={(e) => onChange(value, mergeOnDayTimePipe(onPipe.start, e.target.value))}
                  className={`${inputBase} max-w-[8.5rem]`}
                />
              </div>
            </div>
          ) : null}
        </div>
      );
    }
  }

  return null;
}
