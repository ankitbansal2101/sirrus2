"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isLeadFilterConditionReady } from "@/lib/leads/evaluate-lead-filters";
import {
  buildEmptyPerFieldState,
  configFromPerFieldState,
  emptyRowForField,
  filterableFieldsSorted,
  perFieldStateFromConfig,
  type PerFieldFilterRow,
  type PerFieldFilterStateMap,
} from "@/lib/leads/lead-filter-field-state";
import {
  defaultOperatorForKind,
  filterFieldKind,
  operatorMeta,
  operatorsForKind,
} from "@/lib/leads/lead-filter-operators";
import type { LeadFilterConfig } from "@/lib/leads/lead-filter-types";
import { upsertSavedLeadFilter } from "@/lib/leads/saved-lead-filters-storage";
import type { FieldDefinition } from "@/lib/fields-config/types";
import { optionsSorted } from "@/lib/fields-config/types";

type Props = {
  open: boolean;
  onClose: () => void;
  fields: FieldDefinition[];
  applied: LeadFilterConfig | null;
  onApply: (config: LeadFilterConfig) => void;
  onClearApplied: () => void;
};

function fieldByApiKey(fields: FieldDefinition[], apiKey: string): FieldDefinition | undefined {
  return fields.find((f) => f.apiKey === apiKey);
}

export function LeadFiltersDrawer({ open, onClose, fields, applied, onApply, onClearApplied }: Props) {
  const ff = useMemo(() => filterableFieldsSorted(fields), [fields]);
  const [states, setStates] = useState<PerFieldFilterStateMap>({});
  const [fieldSearch, setFieldSearch] = useState("");
  const [sectionOpen, setSectionOpen] = useState(true);
  const [saveName, setSaveName] = useState("");
  const [saveOpen, setSaveOpen] = useState(false);
  const prevOpen = useRef(false);

  const resetFromApplied = useCallback(() => {
    setStates(perFieldStateFromConfig(applied, ff, fields));
    setFieldSearch("");
    setSectionOpen(true);
    setSaveOpen(false);
    setSaveName("");
  }, [applied, ff, fields]);

  useEffect(() => {
    if (open && !prevOpen.current) {
      resetFromApplied();
    }
    prevOpen.current = open;
  }, [open, resetFromApplied]);

  /** Keep rows when schema adds fields while panel is closed. */
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

  const draftConfig = useMemo(() => configFromPerFieldState(states, ff), [states, ff]);

  const readyCount = useMemo(
    () => draftConfig.conditions.filter((c) => isLeadFilterConditionReady(c, fields)).length,
    [draftConfig.conditions, fields],
  );

  const patchField = (apiKey: string, patch: Partial<PerFieldFilterRow>) => {
    const def = fieldByApiKey(fields, apiKey);
    if (!def) return;
    setStates((prev) => {
      const cur = prev[apiKey] ?? emptyRowForField(def);
      let next = { ...cur, ...patch };
      if (patch.operator !== undefined) {
        const kind = filterFieldKind(def);
        const m = operatorMeta(kind, next.operator);
        if (!m?.needsValue) next.value = "";
        if (!m?.needsValue2) next.value2 = "";
      }
      return { ...prev, [apiKey]: next };
    });
  };

  const setEnabled = (apiKey: string, enabled: boolean) => {
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

  const onSaveNamed = () => {
    const name = saveName.trim();
    if (!name) return;
    const c = globalThis.crypto;
    const id = c && "randomUUID" in c && typeof c.randomUUID === "function" ? c.randomUUID() : `sf_${Date.now()}`;
    upsertSavedLeadFilter({
      id,
      name,
      entity: "lead",
      config: JSON.parse(JSON.stringify(draftConfig)) as LeadFilterConfig,
      createdAt: new Date().toISOString(),
    });
    setSaveOpen(false);
    setSaveName("");
    window.dispatchEvent(new Event("sirrus2-saved-lead-filters-changed"));
  };

  if (!open) return null;

  const inputBase =
    "w-full rounded-md border border-[#d8dbe8] bg-white px-2.5 py-2 text-sm text-ink shadow-sm outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20";
  const selectBase =
    "w-full rounded-md border border-[#d8dbe8] bg-white px-2.5 py-2 text-sm text-ink shadow-sm outline-none focus:border-accent/50";

  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-black/40" role="dialog" aria-modal aria-labelledby="lead-filters-title">
      <button type="button" className="h-full min-w-0 flex-1 cursor-default border-0 bg-transparent" aria-label="Close filters" onClick={onClose} />
      <aside className="flex h-full w-[min(100%,26rem)] max-w-[420px] flex-col border-l border-[#dce0ea] bg-[#eef1f8] shadow-2xl sm:w-[26rem]">
        <div className="flex shrink-0 items-start justify-between gap-2 border-b border-[#dce0ea] bg-[#eef1f8] px-4 py-3">
          <div>
            <h2 id="lead-filters-title" className="text-base font-semibold tracking-tight text-[#1f1750]">
              Filter leads by
            </h2>
            <p className="mt-0.5 text-[11px] text-[#6b6889]">Tick fields, set operators, then apply.</p>
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
              <label className="text-[11px] font-medium text-[#6b6889]">Name this filter</label>
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
                  Save filter
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
              placeholder="Search fields"
              className={`${inputBase} pl-9`}
              aria-label="Search fields"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {ff.length === 0 ? (
            <p className="px-4 py-6 text-sm text-[#6b6889]">No filterable fields. Enable “Include in dynamic lead filters” on fields in the configurator.</p>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setSectionOpen((v) => !v)}
                className="flex w-full items-center gap-2 border-b border-[#dce0ea] bg-[#e4e7f0] px-4 py-2.5 text-left text-sm font-semibold text-[#1f1750] hover:bg-[#dde1ec]"
              >
                <span className="w-4 shrink-0 text-center text-xs text-[#6b6889]" aria-hidden>
                  {sectionOpen ? "▼" : "▶"}
                </span>
                Filter by fields
                <span className="ml-auto text-xs font-normal text-[#6b6889]">{filteredFields.length}</span>
              </button>
              {sectionOpen ? (
                <ul className="divide-y divide-[#dce0ea] bg-[#f7f8fc]">
                  {filteredFields.map((f) => {
                    const s = states[f.apiKey] ?? emptyRowForField(f);
                    const kind = filterFieldKind(f);
                    const ops = operatorsForKind(kind);
                    const meta = operatorMeta(kind, s.operator) ?? ops[0]!;
                    return (
                      <li key={f.id} className="px-4 py-3">
                        <label className="flex cursor-pointer items-start gap-3">
                          <input
                            type="checkbox"
                            checked={s.enabled}
                            onChange={(e) => setEnabled(f.apiKey, e.target.checked)}
                            className="mt-1 size-4 shrink-0 rounded border-[#b7b6ca] text-accent focus:ring-accent"
                          />
                          <span className="min-w-0 flex-1 pt-0.5 text-sm font-medium leading-snug text-[#1f1750]">{f.label}</span>
                        </label>
                        {s.enabled ? (
                          <div className="ml-7 mt-3 space-y-2.5 border-l-2 border-[#dcd7f0] pl-3">
                            <select
                              value={s.operator}
                              onChange={(e) => patchField(f.apiKey, { operator: e.target.value })}
                              className={selectBase}
                              aria-label={`Operator for ${f.label}`}
                            >
                              {ops.map((o) => (
                                <option key={o.id} value={o.id}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                            <FieldValueEditor kind={kind} meta={meta} field={f} value={s.value} value2={s.value2} onChange={(v, v2) => patchField(f.apiKey, { value: v, value2: v2 })} />
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </>
          )}
        </div>

        <div className="shrink-0 border-t border-[#dce0ea] bg-white px-4 py-3 shadow-[0_-4px_12px_rgba(31,23,80,0.06)]">
          <p className="mb-2 text-[11px] text-[#6b6889]">
            {readyCount} field filter{readyCount === 1 ? "" : "s"} active. Empty value rows are ignored until completed.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                onClearApplied();
                setStates(buildEmptyPerFieldState(ff));
              }}
              className="rounded-lg border border-[#dce0ea] bg-white px-4 py-2.5 text-sm font-medium text-[#1f1750] shadow-sm hover:bg-[#f7f8fc]"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => {
                onApply(JSON.parse(JSON.stringify(draftConfig)) as LeadFilterConfig);
                onClose();
              }}
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

function parseIds(s: string): Set<string> {
  return new Set(s.split(",").map((x) => x.trim()).filter(Boolean));
}

function FieldValueEditor({
  kind,
  meta,
  field,
  value,
  value2,
  onChange,
}: {
  kind: ReturnType<typeof filterFieldKind>;
  meta: { needsValue: boolean; needsValue2: boolean };
  field: FieldDefinition;
  value: string;
  value2: string;
  onChange: (v: string, v2: string) => void;
}) {
  if (!meta.needsValue && !meta.needsValue2) return null;

  const inputBase =
    "w-full rounded-md border border-[#d8dbe8] bg-white px-2.5 py-2 text-sm text-ink shadow-sm outline-none focus:border-accent/50";

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
    return (
      <select value={value} onChange={(e) => onChange(e.target.value, value2)} className={inputBase}>
        <option value="">Select…</option>
        {optionsSorted(field).map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }

  if (kind === "multi_select" && meta.needsValue) {
    const selected = parseIds(value);
    return (
      <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-md border border-[#d8dbe8] bg-white p-2 shadow-sm">
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
    if (meta.needsValue2) {
      return (
        <div className="flex flex-col gap-2 sm:flex-row">
          <input type="date" value={value} onChange={(e) => onChange(e.target.value, value2)} className={inputBase} />
          <input type="date" value={value2} onChange={(e) => onChange(value, e.target.value)} className={inputBase} />
        </div>
      );
    }
    if (meta.needsValue) {
      return <input type="date" value={value} onChange={(e) => onChange(e.target.value, value2)} className={inputBase} />;
    }
  }

  return null;
}
