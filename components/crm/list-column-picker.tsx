"use client";

import { useEffect, useRef, useState } from "react";
import { IconColumns } from "@/components/icons";
import type { FieldDefinition } from "@/lib/fields-config/types";

export function ListColumnPicker({
  fields,
  selectedIds,
  onChange,
}: {
  fields: FieldDefinition[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const toggle = (id: string) => {
    if (selectedIds.includes(id)) {
      if (selectedIds.length <= 1) return;
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const move = (id: string, dir: -1 | 1) => {
    const i = selectedIds.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= selectedIds.length) return;
    const next = [...selectedIds];
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(next);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`btn ${
          open ? "border border-accent/40 bg-[#eef6f3] text-accent" : "btn-ghost"
        }`}
      >
        <IconColumns className="size-3.5" />
        Columns
        <span className="rounded-md bg-[#f4efe6] px-1.5 py-0.5 text-[10px] font-semibold text-accent">{selectedIds.length}</span>
      </button>
      {open ? (
        <div className="card absolute right-0 z-40 mt-2 w-[22rem] p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[12px] font-semibold text-ink">Visible columns</p>
            <button
              type="button"
              className="text-[11px] font-medium text-accent hover:underline"
              onClick={() => onChange(fields.slice(0, 7).map((f) => f.id))}
            >
              Reset default
            </button>
          </div>
          <p className="mb-2 text-[11px] text-muted">Tick fields to show. Reorder the ones already on the table.</p>
          {selectedIds.length ? (
            <ul className="mb-3 space-y-1 border-b border-[#eef0f5] pb-3">
              {selectedIds.map((id, idx) => {
                const f = fields.find((x) => x.id === id);
                if (!f) return null;
                return (
                  <li key={id} className="flex items-center gap-1 rounded-lg bg-[#f7f8fb] px-2 py-1">
                    <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-ink">{f.label}</span>
                    <button type="button" className="rounded px-1 text-[11px] text-muted hover:bg-white" disabled={idx === 0} onClick={() => move(id, -1)}>
                      ↑
                    </button>
                    <button
                      type="button"
                      className="rounded px-1 text-[11px] text-muted hover:bg-white"
                      disabled={idx === selectedIds.length - 1}
                      onClick={() => move(id, 1)}
                    >
                      ↓
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
          <ul className="max-h-64 space-y-0.5 overflow-y-auto [scrollbar-width:thin]">
            {fields.map((f) => (
              <li key={f.id}>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] text-ink hover:bg-[#f7f8fb]">
                  <input type="checkbox" checked={selectedIds.includes(f.id)} onChange={() => toggle(f.id)} />
                  <span className="min-w-0 flex-1 truncate">{f.label}</span>
                  <span className="text-[10px] uppercase tracking-wide text-muted">{f.dataType.replace("_", " ")}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
