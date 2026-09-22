"use client";

import type { FieldDefinition } from "@/lib/fields-config/types";
import { usesOptions } from "@/lib/fields-config/types";

export function RecordFieldInput({
  field,
  value,
  onChange,
}: {
  field: FieldDefinition;
  value: string;
  onChange: (next: string) => void;
}) {
  const base =
    "w-full rounded-xl border border-border-soft bg-white px-3 py-2 text-sm text-ink outline-none focus:border-accent";

  if (field.dataType === "formula") {
    return <p className="rounded-xl bg-surface px-3 py-2 text-sm text-muted">{value || "Calculated"}</p>;
  }

  if (field.dataType === "paragraph") {
    return <textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} className={base} />;
  }

  if (field.dataType === "date" || field.dataType === "date_time") {
    return (
      <input
        type={field.dataType === "date" ? "date" : "datetime-local"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={base}
      />
    );
  }

  if (field.dataType === "number" || field.dataType === "decimal") {
    return <input type="number" step={field.dataType === "decimal" ? "0.01" : "1"} value={value} onChange={(e) => onChange(e.target.value)} className={base} />;
  }

  if (field.dataType === "multi_select" && usesOptions(field.dataType)) {
    const selected = new Set(value.split(",").filter(Boolean));
    return (
      <div className="flex flex-wrap gap-2">
        {field.options.map((o) => {
          const on = selected.has(o.id);
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => {
                const next = new Set(selected);
                if (on) next.delete(o.id);
                else next.add(o.id);
                onChange([...next].join(","));
              }}
              className={`rounded-full px-2.5 py-1 text-xs ${on ? "bg-accent text-white" : "bg-rail-inactive text-accent"}`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    );
  }

  if (usesOptions(field.dataType)) {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} className={base}>
        <option value="">Select…</option>
        {field.options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }

  const type =
    field.dataType === "email" ? "email" : field.dataType === "phone" ? "tel" : field.dataType === "url" ? "url" : "text";
  return <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className={base} />;
}
