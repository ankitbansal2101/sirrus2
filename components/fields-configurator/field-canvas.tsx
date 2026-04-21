"use client";

import { useMemo, useState } from "react";
import type { FieldDataType, FieldDefinition } from "@/lib/fields-config/types";

/** Type hint shown like Zoho’s secondary label (lighter, right side). */
const TYPE_COMPACT: Record<FieldDataType, string> = {
  text: "Single line",
  paragraph: "Multi line",
  email: "Email",
  phone: "Phone",
  url: "URL",
  picklist: "Pick list",
  multi_select: "Multi-select",
  date: "Date",
  date_time: "Date/time",
  number: "Number",
  decimal: "Decimal",
  formula: "Calculated",
  radio: "Radio",
};

type Props = {
  fields: FieldDefinition[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  isDropTarget: boolean;
  onDragOverCanvas: (e: React.DragEvent) => void;
  onDropCanvas: (e: React.DragEvent) => void;
  onDragLeaveCanvas: (e: React.DragEvent) => void;
};

export function FieldCanvas({
  fields,
  selectedId,
  onSelect,
  onRemove,
  isDropTarget,
  onDragOverCanvas,
  onDropCanvas,
  onDragLeaveCanvas,
}: Props) {
  const [query, setQuery] = useState("");
  const visibleFields = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return fields;
    return fields.filter(
      (f) =>
        f.label.toLowerCase().includes(q) ||
        f.apiKey.toLowerCase().includes(q) ||
        TYPE_COMPACT[f.dataType].toLowerCase().includes(q),
    );
  }, [fields, query]);

  return (
    <section
      className={`flex min-h-0 flex-1 flex-col rounded-xl border border-dashed p-2 transition-colors sm:p-2.5 ${
        isDropTarget
          ? "border-accent/50 bg-field-surface shadow-inner"
          : "border-field-outer bg-field-surface/90"
      }`}
      onDragOver={onDragOverCanvas}
      onDrop={onDropCanvas}
      onDragLeave={onDragLeaveCanvas}
    >
      <div className="mb-1.5 flex shrink-0 flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
            <h2 className="text-xs font-semibold text-ink">Lead fields</h2>
            <span className="text-[10px] text-muted">
              {fields.length} total
              {query.trim() && visibleFields.length !== fields.length
                ? ` · ${visibleFields.length} shown`
                : ""}
            </span>
          </div>
          <p className="text-[10px] leading-snug text-muted">Select a row to edit. List scrolls for large schemas.</p>
        </div>
        <label className="relative shrink-0 sm:max-w-[14rem] sm:flex-1">
          <span className="sr-only">Filter fields by label or API key</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter…"
            className="w-full rounded-md border border-border-soft bg-white py-1 pl-2 pr-7 text-xs text-ink placeholder:text-muted/70 outline-none focus:border-accent"
            autoComplete="off"
          />
          {query ? (
            <button
              type="button"
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded px-1 text-[11px] text-muted hover:bg-zinc-100 hover:text-ink"
              onClick={() => setQuery("")}
              aria-label="Clear filter"
            >
              ×
            </button>
          ) : null}
        </label>
      </div>

      {fields.length === 0 ? (
        <p className="flex flex-1 items-center justify-center py-8 text-center text-xs text-muted">
          Drop a field type here to start.
        </p>
      ) : visibleFields.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
          <p className="text-xs text-muted">No fields match this filter.</p>
          <button
            type="button"
            onClick={() => setQuery("")}
            className="rounded-md border border-border-soft bg-white px-2 py-1 text-[11px] font-medium text-ink hover:bg-zinc-50"
          >
            Clear filter
          </button>
        </div>
      ) : (
        <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-y-contain py-0.5">
          {visibleFields.map((f) => {
            const active = f.id === selectedId;
            return (
              <li key={f.id} className="list-none">
                <div
                  role="button"
                  tabIndex={0}
                  title={`${f.label} (${TYPE_COMPACT[f.dataType]})`}
                  onClick={() => onSelect(f.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect(f.id);
                    }
                  }}
                  className={[
                    "relative grid min-h-[2rem] w-full cursor-pointer grid-cols-[1fr_auto_auto] items-center gap-2 rounded-md border bg-field-surface px-2 py-1 text-left text-xs shadow-sm outline-none transition",
                    "border-field-outer hover:border-field-outer-hover hover:shadow-sm",
                    active
                      ? "border-accent bg-field-selected-bg shadow-[0_0_0_1px_rgba(52,54,156,0.18)]"
                      : "",
                  ].join(" ")}
                >
                  <span className="min-w-0 truncate font-medium text-ink">
                    {f.label}
                  </span>
                  <span
                    className="min-w-0 max-w-[5.5rem] truncate text-right text-[11px] text-muted sm:max-w-[7rem]"
                    title={TYPE_COMPACT[f.dataType]}
                  >
                    {TYPE_COMPACT[f.dataType]}
                  </span>
                  <div className="flex shrink-0 items-center justify-end gap-1">
                    {f.isSystem && (
                      <span
                        className="rounded border border-border-soft bg-surface px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-accent"
                        title="Included by default on new orgs"
                      >
                        Default
                      </span>
                    )}
                    {!f.locked && (
                      <button
                        type="button"
                        title="Remove field"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemove(f.id);
                        }}
                        className="rounded border border-transparent px-1 py-0.5 text-[13px] leading-none text-muted hover:border-field-outer hover:bg-zinc-50 hover:text-red-600"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
