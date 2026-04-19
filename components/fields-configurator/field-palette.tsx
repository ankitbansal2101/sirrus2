"use client";

import type { FieldDataType } from "@/lib/fields-config/types";
import { FIELD_DATA_TYPES } from "@/lib/fields-config/types";

const TYPE_LABELS: Record<FieldDataType, string> = {
  text: "Text",
  paragraph: "Paragraph",
  email: "Email",
  phone: "Phone",
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
    <aside className="flex w-56 shrink-0 flex-col border-r border-border-soft bg-surface p-4">
      <h2 className="mb-1 text-sm font-semibold text-ink">Field types</h2>
      <p className="mb-4 text-xs leading-snug text-muted">Drag a type onto the canvas to add a field.</p>
      <ul className="flex flex-col gap-2">
        {FIELD_DATA_TYPES.map((t) => (
          <li key={t}>
            {/* `draggable` on <button> is unreliable in some browsers; use a div for the drag handle. */}
            <div
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(DRAG_MIME, t);
                e.dataTransfer.setData("text/plain", `${PLAIN_PREFIX}${t}`);
                e.dataTransfer.effectAllowed = "copy";
                onDragTypeSession(t);
              }}
              onDragEnd={() => onDragTypeSession(null)}
              className="flex w-full cursor-grab select-none items-center rounded-xl border border-border-soft bg-white px-3 py-2.5 text-left text-sm font-medium text-ink shadow-sm active:cursor-grabbing hover:border-accent/40 hover:shadow-md"
            >
              {TYPE_LABELS[t]}
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}
