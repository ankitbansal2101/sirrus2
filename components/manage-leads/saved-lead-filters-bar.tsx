"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { LeadFilterConfig } from "@/lib/leads/lead-filter-types";
import { deleteSavedLeadFilter, loadSavedLeadFilters, type SavedLeadFilter } from "@/lib/leads/saved-lead-filters-storage";

function normalizeForCompare(cfg: LeadFilterConfig): string {
  const sorted = [...cfg.conditions].sort((a, b) => a.fieldApiKey.localeCompare(b.fieldApiKey));
  return JSON.stringify({
    conditions: sorted.map((c) => ({
      fieldApiKey: c.fieldApiKey,
      operator: c.operator,
      value: c.value,
      value2: c.value2,
    })),
  });
}

type Props = {
  applied: LeadFilterConfig | null;
  onApplySaved: (config: LeadFilterConfig) => void;
};

export function SavedLeadFiltersBar({ applied, onApplySaved }: Props) {
  const [list, setList] = useState<SavedLeadFilter[]>([]);

  const reload = useCallback(() => setList(loadSavedLeadFilters()), []);

  useEffect(() => {
    reload();
    const on = () => reload();
    window.addEventListener("sirrus2-saved-lead-filters-changed", on);
    return () => window.removeEventListener("sirrus2-saved-lead-filters-changed", on);
  }, [reload]);

  const appliedKey = useMemo(() => (applied ? normalizeForCompare(applied) : ""), [applied]);

  if (list.length === 0) {
    return (
      <div className="border-b border-border-soft bg-[#f7f8fc] px-3 py-2 sm:px-4">
        <p className="text-[11px] leading-snug text-muted">
          <span className="font-medium text-ink/80">Saved filters</span> — none yet. Open{" "}
          <span className="font-medium text-ink">Filters</span>, tick fields and operators, then use{" "}
          <span className="font-medium text-ink">Save this filter</span> at the top of the panel.
        </p>
      </div>
    );
  }

  return (
    <div className="border-b border-border-soft bg-[#f7f8fc] px-2 py-2 sm:px-3">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted">Saved filters</span>
        <div className="h-px min-w-[2rem] flex-1 bg-border-soft" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {list.map((s) => {
          const active = applied !== null && normalizeForCompare(s.config) === appliedKey;
          return (
            <div
              key={s.id}
              className={[
                "group inline-flex max-w-full items-stretch overflow-hidden rounded-full border text-xs font-medium shadow-sm transition",
                active ? "border-accent bg-white ring-1 ring-accent/25" : "border-border-soft bg-white hover:border-accent/40",
              ].join(" ")}
            >
              <button
                type="button"
                onClick={() => onApplySaved(JSON.parse(JSON.stringify(s.config)) as LeadFilterConfig)}
                className={[
                  "max-w-[14rem] truncate px-3 py-1.5 text-left",
                  active ? "text-accent" : "text-ink",
                ].join(" ")}
                title={s.name}
              >
                {s.name}
              </button>
              <button
                type="button"
                aria-label={`Delete saved filter ${s.name}`}
                className="border-l border-border-soft px-2 text-muted hover:bg-red-50 hover:text-red-600"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteSavedLeadFilter(s.id);
                  reload();
                }}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
