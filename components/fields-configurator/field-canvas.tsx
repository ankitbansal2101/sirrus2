"use client";

import type { FieldDataType, FieldDefinition } from "@/lib/fields-config/types";

/** Type hint shown like Zoho’s secondary label (lighter, right side). */
const TYPE_COMPACT: Record<FieldDataType, string> = {
  text: "Single line",
  paragraph: "Multi line",
  email: "Email",
  phone: "Phone",
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
  return (
    <section
      className={`flex min-h-0 flex-1 flex-col rounded-2xl border-2 border-dashed p-3 transition-colors sm:p-4 ${
        isDropTarget
          ? "border-accent/50 bg-field-surface shadow-inner"
          : "border-field-outer bg-field-surface/90"
      }`}
      onDragOver={onDragOverCanvas}
      onDrop={onDropCanvas}
      onDragLeave={onDragLeaveCanvas}
    >
      <div className="mb-2 shrink-0 sm:mb-3">
        <h2 className="text-sm font-semibold text-ink">Form canvas</h2>
        <p className="text-[11px] leading-snug text-muted sm:text-xs">
          {fields.length} field{fields.length === 1 ? "" : "s"} — each field has its own frame; list scrolls when it grows.
        </p>
      </div>

      {fields.length === 0 ? (
        <p className="flex flex-1 items-center justify-center py-10 text-center text-xs text-muted sm:text-sm">
          Drop a field type here to start.
        </p>
      ) : (
        <ul className="min-h-0 max-h-[calc(100dvh-12.5rem)] flex-1 space-y-2 overflow-y-auto overscroll-y-contain py-0.5 sm:max-h-[calc(100dvh-11rem)]">
          {fields.map((f) => {
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
                    "relative flex min-h-[40px] w-full cursor-pointer items-center gap-3 rounded-lg border bg-field-surface px-3 py-2 text-left shadow-sm outline-none transition",
                    "border-field-outer hover:border-field-outer-hover hover:shadow",
                    active
                      ? "border-accent bg-field-selected-bg shadow-[0_0_0_1px_rgba(52,54,156,0.2)]"
                      : "",
                  ].join(" ")}
                >
                  {f.required && (
                    <span
                      className="absolute bottom-2 left-0 top-2 w-[3px] rounded-r bg-red-500"
                      aria-hidden
                    />
                  )}
                  <div
                    className={`flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-3 ${f.required ? "pl-2" : ""}`}
                  >
                    <span className="min-w-0 truncate text-[13px] font-semibold text-ink sm:flex-1 sm:text-sm">
                      {f.label}
                    </span>
                    <span
                      className="shrink-0 truncate text-xs text-muted sm:max-w-[9rem] sm:text-right"
                      title={TYPE_COMPACT[f.dataType]}
                    >
                      {TYPE_COMPACT[f.dataType]}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {f.isSystem && (
                      <span className="rounded border border-border-soft bg-surface px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-accent">
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
                        className="rounded-md border border-transparent px-2 py-1 text-xs font-medium text-muted hover:border-field-outer hover:bg-zinc-50 hover:text-red-600"
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
