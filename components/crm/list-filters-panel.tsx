"use client";

import { useEffect, useMemo, useState } from "react";
import { IconClose } from "@/components/icons";
import type { FieldDefinition } from "@/lib/fields-config/types";
import { activeFilterClauseCount, isLeadFilterConditionReady, syncConditionShape } from "@/lib/leads/evaluate-lead-filters";
import { defaultOperatorForKind, filterFieldKind, operatorMeta, operatorsForKind } from "@/lib/leads/lead-filter-operators";
import { emptyLeadFilterConfig, newEmptyCondition, type LeadFilterCondition, type LeadFilterConfig } from "@/lib/leads/lead-filter-types";

export function ListFiltersPanel({
  open,
  onClose,
  fields,
  applied,
  onApply,
  onClear,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  fields: FieldDefinition[];
  applied: LeadFilterConfig | null;
  onApply: (config: LeadFilterConfig) => void;
  onClear: () => void;
  onSave: (name: string, config: LeadFilterConfig) => void;
}) {
  const filterable = useMemo(() => fields.filter((f) => f.includeInFilters !== false && f.dataType !== "formula"), [fields]);
  const [rows, setRows] = useState<LeadFilterCondition[]>(() =>
    applied?.conditions.length ? applied.conditions : [newEmptyCondition()],
  );
  const [saveName, setSaveName] = useState("");

  useEffect(() => {
    if (!open) return;
    setRows(applied?.conditions.length ? applied.conditions : [newEmptyCondition()]);
  }, [open, applied]);

  if (!open) return null;

  const ready = rows.filter((c) => isLeadFilterConditionReady(c, fields));
  const draft: LeadFilterConfig = { logic: "AND", conditions: ready };

  const patch = (id: string, next: Partial<LeadFilterCondition>) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const merged = { ...r, ...next };
        const field = fields.find((f) => f.apiKey === merged.fieldApiKey);
        return syncConditionShape(merged, field);
      }),
    );
  };

  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-[#12100c]/35 backdrop-blur-[2px]" role="dialog" aria-modal>
      <button type="button" className="h-full flex-1 border-0 bg-transparent" aria-label="Close filters" onClick={onClose} />
      <aside className="flex h-full w-full max-w-[28rem] flex-col bg-surface shadow-[-16px_0_48px_-24px_rgba(22,20,15,0.35)]">
        <div className="flex items-start justify-between border-b border-border-soft px-5 py-4">
          <div>
            <h2 className="display text-2xl text-ink">Filters</h2>
            <p className="mt-0.5 text-[12px] text-muted">All conditions apply together (AND).</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-[#f7f8fb]" aria-label="Close">
            <IconClose className="size-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {rows.map((row, idx) => {
            const field = fields.find((f) => f.apiKey === row.fieldApiKey);
            const kind = field ? filterFieldKind(field) : "text";
            const ops = operatorsForKind(kind);
            const meta = operatorMeta(kind, row.operator);
            return (
              <div key={row.id} className="rounded-xl border border-[#e4e6ef] bg-[#fbfbfe] p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">Condition {idx + 1}</span>
                  <button
                    type="button"
                    className="text-[11px] font-medium text-red-600 hover:underline"
                    onClick={() => setRows((prev) => (prev.length === 1 ? [newEmptyCondition()] : prev.filter((r) => r.id !== row.id)))}
                  >
                    Remove
                  </button>
                </div>
                <label className="mb-2 block text-[11px] text-muted">
                  Field
                  <select
                    value={row.fieldApiKey}
                    onChange={(e) => {
                      const nextField = fields.find((f) => f.apiKey === e.target.value);
                      patch(row.id, {
                        fieldApiKey: e.target.value,
                        operator: nextField ? defaultOperatorForKind(filterFieldKind(nextField)) : "eq",
                        value: "",
                        value2: "",
                      });
                    }}
                    className="mt-1 w-full rounded-lg border border-[#e4e6ef] bg-white px-2.5 py-2 text-[13px] text-ink"
                  >
                    <option value="">Choose field…</option>
                    {filterable.map((f) => (
                      <option key={f.id} value={f.apiKey}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="mb-2 block text-[11px] text-muted">
                  Operator
                  <select
                    value={row.operator}
                    onChange={(e) => patch(row.id, { operator: e.target.value, value: "", value2: "" })}
                    className="mt-1 w-full rounded-lg border border-[#e4e6ef] bg-white px-2.5 py-2 text-[13px] text-ink"
                    disabled={!field}
                  >
                    {ops.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                {meta?.needsValue ? (
                  <FilterValue field={field} row={row} onChange={(value) => patch(row.id, { value })} />
                ) : null}
                {meta?.needsValue2 ? (
                  <label className="mt-2 block text-[11px] text-muted">
                    And
                    <input
                      value={row.value2}
                      onChange={(e) => patch(row.id, { value2: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-[#e4e6ef] bg-white px-2.5 py-2 text-[13px] text-ink"
                    />
                  </label>
                ) : null}
              </div>
            );
          })}
          <button
            type="button"
            onClick={() => setRows((prev) => [...prev, newEmptyCondition()])}
            className="text-[12px] font-semibold text-accent hover:underline"
          >
            + Add condition
          </button>
        </div>

        <div className="space-y-2 border-t border-[#eef0f5] px-5 py-4">
          <div className="flex gap-2">
            <input
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="Name this filter"
              className="min-w-0 flex-1 rounded-lg border border-[#e4e6ef] px-2.5 py-2 text-[12px] text-ink"
            />
            <button
              type="button"
              disabled={!saveName.trim() || ready.length === 0}
              onClick={() => {
                onSave(saveName.trim(), draft);
                setSaveName("");
              }}
              className="rounded-lg border border-[#e4e6ef] px-2.5 py-2 text-[12px] font-semibold text-ink disabled:opacity-40"
            >
              Save
            </button>
          </div>
          <div className="flex justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                setRows([newEmptyCondition()]);
                onClear();
              }}
              className="rounded-lg px-3 py-2 text-[12px] font-medium text-muted hover:bg-[#f7f8fb]"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => {
                onApply(draft);
                onClose();
              }}
              className="rounded-lg bg-accent px-4 py-2 text-[12px] font-semibold text-white"
            >
              Apply{ready.length ? ` · ${activeFilterClauseCount(draft, fields)}` : ""}
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

function FilterValue({
  field,
  row,
  onChange,
}: {
  field: FieldDefinition | undefined;
  row: LeadFilterCondition;
  onChange: (value: string) => void;
}) {
  if (!field) return null;
  const kind = filterFieldKind(field);
  if (kind === "picklist" || kind === "multi_select") {
    const selected = new Set(row.value.split(",").filter(Boolean));
    return (
      <div className="max-h-36 space-y-1 overflow-y-auto rounded-lg border border-[#e4e6ef] bg-white p-2">
        {field.options.map((o) => (
          <label key={o.id} className="flex items-center gap-2 text-[12px] text-ink">
            <input
              type="checkbox"
              checked={selected.has(o.id)}
              onChange={() => {
                const next = new Set(selected);
                if (next.has(o.id)) next.delete(o.id);
                else next.add(o.id);
                onChange([...next].join(","));
              }}
            />
            {o.label}
          </label>
        ))}
      </div>
    );
  }
  const type = kind === "number" ? "number" : kind === "date" ? (field.dataType === "date_time" ? "datetime-local" : "date") : "text";
  return (
    <label className="block text-[11px] text-muted">
      Value
      <input
        type={type}
        value={row.value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-[#e4e6ef] bg-white px-2.5 py-2 text-[13px] text-ink"
      />
    </label>
  );
}
