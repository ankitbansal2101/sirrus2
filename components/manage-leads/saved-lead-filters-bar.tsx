"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { LeadFilterConfig } from "@/lib/leads/lead-filter-types";
import { normalizeFilterConfigForCompare } from "@/lib/leads/lead-filter-compare";
import { deleteSavedLeadFilter, loadSavedLeadFilters, type SavedLeadFilter } from "@/lib/leads/saved-lead-filters-storage";

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}

type Props = {
  applied: LeadFilterConfig | null;
  /** Second arg is the saved row id when applying from the bar (used to “update” that saved filter later). */
  onApplySaved: (config: LeadFilterConfig, sourceSavedId?: string) => void;
  /** Clears the filter applied to the list; does not delete anything from the saved list. */
  onClearApplied: () => void;
};

export function SavedLeadFiltersBar({ applied, onApplySaved, onClearApplied }: Props) {
  const [list, setList] = useState<SavedLeadFilter[]>([]);

  const reload = useCallback(() => setList(loadSavedLeadFilters()), []);

  useEffect(() => {
    reload();
    const on = () => reload();
    window.addEventListener("sirrus2-saved-lead-filters-changed", on);
    return () => window.removeEventListener("sirrus2-saved-lead-filters-changed", on);
  }, [reload]);

  const appliedKey = useMemo(() => (applied ? normalizeFilterConfigForCompare(applied) : ""), [applied]);
  const hasAppliedFilter = applied !== null;

  if (list.length === 0) {
    return (
      <div className="border-b border-border-soft bg-[#f7f8fc] px-3 py-2 sm:px-4">
        <p className="text-[11px] leading-snug text-muted">
          <span className="font-medium text-ink/80">Saved filters</span> — none yet. Open{" "}
          <span className="font-medium text-ink">Filters</span>, add conditions, then use{" "}
          <span className="font-medium text-ink">Save this filter</span> at the top of the panel.
        </p>
        {hasAppliedFilter ? (
          <button
            type="button"
            onClick={onClearApplied}
            className="mt-2 text-xs font-medium text-accent underline-offset-2 hover:underline"
          >
            Clear applied filter
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="border-b border-border-soft bg-[#f7f8fc] px-2 py-2 sm:px-3">
      <div className="mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted">Saved filters</span>
          <div className="h-px min-w-[2rem] flex-1 bg-border-soft" />
        </div>
        {hasAppliedFilter ? (
          <button
            type="button"
            onClick={onClearApplied}
            className="shrink-0 rounded-md border border-border-soft bg-white px-2.5 py-1 text-[11px] font-medium text-ink shadow-sm hover:border-accent/35 hover:bg-surface"
          >
            Clear applied filter
          </button>
        ) : null}
      </div>
      <p className="mb-2 text-[10px] leading-snug text-muted">
        Click a name to apply (active chip highlights). Click it again to unapply. Use{" "}
        <span className="font-medium text-ink/80">Clear applied filter</span> to stop filtering the table. The bin removes that entry from your
        saved list only.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-stretch">
        {list.map((s) => {
          const active = applied !== null && normalizeFilterConfigForCompare(s.config) === appliedKey;
          return (
            <div
              key={s.id}
              className={[
                "flex min-w-0 max-w-full items-stretch overflow-hidden rounded-lg border text-xs font-medium shadow-sm transition sm:max-w-[min(100%,28rem)]",
                active ? "border-accent bg-white ring-1 ring-accent/25" : "border-border-soft bg-white hover:border-accent/40",
              ].join(" ")}
            >
              <button
                type="button"
                onClick={() => {
                  if (active) {
                    onClearApplied();
                    return;
                  }
                  onApplySaved(JSON.parse(JSON.stringify(s.config)) as LeadFilterConfig, s.id);
                }}
                className={[
                  "min-h-[2.5rem] min-w-0 flex-1 px-3 py-2 text-left leading-snug",
                  active ? "text-accent" : "text-ink",
                ].join(" ")}
                title={active ? `${s.name} — click again to clear applied filter` : s.name}
              >
                <span className="line-clamp-2 break-words">{s.name}</span>
              </button>
              <button
                type="button"
                aria-label={`Delete saved filter “${s.name}” from your list`}
                title="Remove from saved filters"
                className="flex shrink-0 items-center justify-center border-l border-border-soft bg-white px-2.5 text-muted transition hover:bg-red-50 hover:text-red-600"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteSavedLeadFilter(s.id);
                  reload();
                }}
              >
                <TrashIcon className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
