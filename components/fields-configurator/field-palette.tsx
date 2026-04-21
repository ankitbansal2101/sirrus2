"use client";

import type { FieldDataType } from "@/lib/fields-config/types";
import { FIELD_DATA_TYPES } from "@/lib/fields-config/types";

const TYPE_LABELS: Record<FieldDataType, string> = {
  text: "Text",
  paragraph: "Paragraph",
  email: "Email",
  phone: "Phone",
  url: "URL",
  picklist: "Picklist",
  multi_select: "Multi select",
  date: "Date",
  date_time: "Date time",
  number: "Number",
  decimal: "Decimal",
  formula: "Calculated",
  radio: "Radio button",
};

const DRAG_MIME = "application/x-sirrus-field-type";
/** Plain-text payload so `getData` works on `drop` in all browsers. */
const PLAIN_PREFIX = "sirrus-field-type:";

export function readDraggedDataType(dt: DataTransfer): FieldDataType | null {
  const custom = dt.getData(DRAG_MIME);
  if (custom && FIELD_DATA_TYPES.includes(custom as FieldDataType)) return custom as FieldDataType;

  const plain = dt.getData("text/plain");
  if (plain.startsWith(PLAIN_PREFIX)) {
    const raw = plain.slice(PLAIN_PREFIX.length);
    if (FIELD_DATA_TYPES.includes(raw as FieldDataType)) return raw as FieldDataType;
  }
  return null;
}

type FieldPaletteProps = {
  /** Browsers do not expose `getData(customType)` during `dragover`; we track the payload here so the canvas can allow drop. */
  onDragTypeSession: (type: FieldDataType | null) => void;
};

export function FieldPalette({ onDragTypeSession }: FieldPaletteProps) {
  return (
    <aside className="flex w-40 shrink-0 flex-col border-r border-border-soft bg-surface min-h-0">
      <div className="shrink-0 border-b border-border-soft/80 px-2.5 py-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-muted">Field types</h2>
        <p className="mt-0.5 text-[10px] leading-tight text-muted/90">Drag onto canvas</p>
      </div>
      <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-y-contain p-2">
        {FIELD_DATA_TYPES.map((t) => (
          <li key={t} className="min-w-0 shrink-0">
            {/* `draggable` on <button> is unreliable in some browsers; use a div for the drag handle. */}
            <div
              draggable
              title={`Drag to add: ${TYPE_LABELS[t]}`}
              onDragStart={(e) => {
                e.dataTransfer.setData(DRAG_MIME, t);
                e.dataTransfer.setData("text/plain", `${PLAIN_PREFIX}${t}`);
                e.dataTransfer.effectAllowed = "copy";
                onDragTypeSession(t);
              }}
              onDragEnd={() => onDragTypeSession(null)}
              className="flex w-full cursor-grab select-none items-center rounded-md border border-border-soft bg-white px-2 py-1.5 text-left text-[11px] font-medium leading-snug text-ink shadow-sm active:cursor-grabbing hover:border-accent/45 hover:bg-rail-active/25"
            >
              {TYPE_LABELS[t]}
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}
