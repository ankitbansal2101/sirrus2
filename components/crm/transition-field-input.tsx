"use client";

import type { TransitionFormField } from "@/lib/blueprint/types";
import type { FieldDefinition } from "@/lib/fields-config/types";
import { optionsSorted, usesOptions } from "@/lib/fields-config/types";

function parseMultiIds(s: string): string[] {
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}

function toggleMultiId(current: string, optId: string): string {
  const set = new Set(parseMultiIds(current));
  if (set.has(optId)) set.delete(optId);
  else set.add(optId);
  return [...set].join(",");
}

function picklistOptionsForTransition(
  field: TransitionFormField,
  def: FieldDefinition | undefined,
): ReturnType<typeof optionsSorted> | null {
  if (!def || (def.dataType !== "picklist" && def.dataType !== "radio")) return null;
  const all = optionsSorted(def);
  if (field.kind === "picklist" && field.picklistOptions.length > 0) {
    const filtered = all.filter((o) => field.picklistOptions.includes(o.label));
    return filtered.length > 0 ? filtered : all;
  }
  return all;
}

export function TransitionFieldInput({
  field,
  definitions,
  value,
  onChange,
  variant = "default",
}: {
  field: TransitionFormField;
  definitions: FieldDefinition[];
  value: string;
  onChange: (v: string) => void;
  variant?: "default" | "drawer";
}) {
  const def = definitions.find((d) => d.apiKey === field.fieldId);
  const d = variant === "drawer";
  const lb = d ? "mb-2 block text-sm font-medium text-[#1f1750]" : "mb-1 block text-sm font-medium text-ink";
  const ast = d ? "text-[#ff6678]" : "text-red-500";
  const inp = d
    ? "w-full rounded-full border-0 bg-[#e4e5e6] px-5 py-2.5 text-base text-[#1f1750] outline-none focus:ring-2 focus:ring-[#34369c]/25"
    : "w-full rounded-full border border-border-soft bg-[#e4e5e6] px-3 py-2 text-sm outline-none focus:border-accent";
  const txa = d
    ? "w-full resize-y rounded-lg border-0 bg-[#efeff1] p-4 text-sm text-[#1f1750] outline-none focus:ring-2 focus:ring-[#34369c]/25"
    : "w-full resize-y rounded-lg border border-border-soft bg-field-surface px-3 py-2 text-sm outline-none focus:border-accent";
  const box = d
    ? "max-h-40 space-y-2 overflow-y-auto rounded-lg border-0 bg-[#efeff1] px-3 py-2"
    : "max-h-40 space-y-2 overflow-y-auto rounded-lg border border-border-soft bg-field-surface px-3 py-2";
  const rowLabel = d ? "flex cursor-pointer items-center gap-2 text-sm text-[#1f1750]" : "flex cursor-pointer items-center gap-2 text-sm text-ink";
  const roInp = d
    ? "w-full cursor-not-allowed rounded-full border-0 bg-[#e4e5e6]/70 px-5 py-2.5 text-sm text-[#7e7a95]"
    : "w-full cursor-not-allowed rounded-full border border-border-soft bg-muted/30 px-3 py-2 text-sm text-muted";

  const label = (
    <label className={lb}>
      {def?.label ?? field.label}
      {field.mandatory ? <span className={ast}> *</span> : null}
    </label>
  );

  if (field.kind === "remark" || field.kind === "textarea") {
    return (
      <div>
        {label}
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          className={txa}
        />
      </div>
    );
  }

  if (field.kind === "picklist") {
    const opts = picklistOptionsForTransition(field, def);
    if (opts) {
      return (
        <div>
          {label}
          <select value={value} onChange={(e) => onChange(e.target.value)} className={inp}>
            <option value="">— Select —</option>
            {opts.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      );
    }
    if (field.picklistOptions.length > 0) {
      return (
        <div>
          {label}
          <select value={value} onChange={(e) => onChange(e.target.value)} className={inp}>
            <option value="">— Select —</option>
            {field.picklistOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      );
    }
  }

  if (field.kind === "multi_select") {
    if (def?.dataType === "multi_select") {
      const opts = optionsSorted(def);
      return (
        <div>
          {label}
          <div className={box}>
            {opts.map((opt) => {
              const on = parseMultiIds(value).includes(opt.id);
              return (
                <label key={opt.id} className={rowLabel}>
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => onChange(toggleMultiId(value, opt.id))}
                    className="size-4 shrink-0 rounded border-border-soft text-accent"
                  />
                  {opt.label}
                </label>
              );
            })}
          </div>
        </div>
      );
    }
    return (
      <div>
        {label}
        <p className="text-xs text-muted">
          This transition uses multi-select, but field <code className="rounded bg-black/5 px-0.5">{field.fieldId}</code>{" "}
          is not multi-select in Fields. Update the field or the transition row.
        </p>
      </div>
    );
  }

  if (def) {
    if (def.dataType === "paragraph") {
      return (
        <div>
          {label}
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={4}
            className={txa}
          />
        </div>
      );
    }
    if (def.dataType === "picklist" || def.dataType === "radio") {
      const opts = picklistOptionsForTransition(field, def) ?? optionsSorted(def);
      return (
        <div>
          {label}
          <select value={value} onChange={(e) => onChange(e.target.value)} className={inp}>
            <option value="">— Select —</option>
            {opts.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      );
    }
    if (def.dataType === "multi_select") {
      const opts = optionsSorted(def);
      return (
        <div>
          {label}
          <div className={box}>
            {opts.map((opt) => {
              const on = parseMultiIds(value).includes(opt.id);
              return (
                <label key={opt.id} className={rowLabel}>
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => onChange(toggleMultiId(value, opt.id))}
                    className="size-4 shrink-0 rounded border-border-soft text-accent"
                  />
                  {opt.label}
                </label>
              );
            })}
          </div>
        </div>
      );
    }
    if (def.dataType === "url") {
      return (
        <div>
          {label}
          <input
            type="url"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://"
            className={inp}
          />
        </div>
      );
    }
    if (def.dataType === "email") {
      return (
        <div>
          {label}
          <input
            type="email"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={inp}
          />
        </div>
      );
    }
    if (def.dataType === "phone") {
      return (
        <div>
          {label}
          <input
            type="tel"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={inp}
          />
        </div>
      );
    }
    if (def.dataType === "number") {
      return (
        <div>
          {label}
          <input
            type="number"
            step={1}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={inp}
          />
        </div>
      );
    }
    if (def.dataType === "decimal") {
      return (
        <div>
          {label}
          <input
            type="number"
            step="any"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={inp}
          />
        </div>
      );
    }
    if (def.dataType === "date") {
      return (
        <div>
          {label}
          <input
            type="date"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={inp}
          />
        </div>
      );
    }
    if (def.dataType === "date_time") {
      return (
        <div>
          {label}
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="ISO or yyyy-mm-ddThh:mm"
            className={inp}
          />
        </div>
      );
    }
    if (def.dataType === "formula") {
      return (
        <div>
          {label}
          <input
            type="text"
            readOnly
            value={value}
            className={roInp}
            title="Formula fields are computed; not edited on transitions."
          />
        </div>
      );
    }

    return (
      <div>
        {label}
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inp}
        />
      </div>
    );
  }

  return (
    <div>
      {label}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inp}
      />
    </div>
  );
}
