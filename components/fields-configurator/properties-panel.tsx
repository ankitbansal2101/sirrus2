"use client";

import { CalculatedFieldEditor } from "@/components/fields-configurator/calculated-field-editor";
import type { FieldDefinition, PicklistOrderPreference } from "@/lib/fields-config/types";
import {
  createOption,
  dataTypePropertiesTitle,
  optionValueFromLabel,
  optionsSorted,
  showsDuplicateControl,
  usesOptions,
} from "@/lib/fields-config/types";

type Props = {
  field: FieldDefinition | null;
  allFields?: FieldDefinition[];
  onChange: (next: FieldDefinition) => void;
  onSaveSchema: () => void;
  onClosePanel: () => void;
};

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-medium text-muted">{label}</label>
      {children}
    </div>
  );
}

const inputClass =
  "w-full rounded-md border border-border-soft bg-white px-2 py-1.5 text-xs text-ink outline-none focus:border-accent disabled:cursor-not-allowed disabled:opacity-60";

const radioChoiceClass =
  "flex cursor-pointer items-center gap-2 rounded-md border border-border-soft bg-white px-2 py-1.5 text-xs text-ink has-[:checked]:border-accent/50 has-[:checked]:bg-rail-active/30";

/** Grip shown beside each option — drag affordance + reorder label per spec. */
function ReorderIcon() {
  return (
    <span
      className="inline-flex shrink-0 cursor-grab flex-col justify-center gap-0.5 px-0.5 text-muted select-none active:cursor-grabbing"
      title="Reorder"
      aria-label="Reorder"
    >
      <span className="grid grid-cols-2 gap-px">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <span key={i} className="size-0.5 rounded-full bg-current opacity-60" />
        ))}
      </span>
    </span>
  );
}

export function PropertiesPanel({ field, allFields = [], onChange, onSaveSchema, onClosePanel }: Props) {
  const widthClass = field?.dataType === "formula" ? "w-[19rem] sm:w-[20.5rem]" : "w-[17rem] sm:w-[18.5rem]";

  const footer = (
    <div className="shrink-0 border-t border-border-soft bg-surface px-3 py-2">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onSaveSchema}
          className="flex-1 rounded-md bg-accent px-2.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-accent/90"
        >
          Save layout
        </button>
        <button
          type="button"
          onClick={onClosePanel}
          className="rounded-md border border-border-soft bg-white px-2.5 py-2 text-xs font-medium text-ink shadow-sm transition hover:bg-rail-inactive/50"
        >
          Close
        </button>
      </div>
      <p className="mt-1.5 text-[10px] leading-snug text-muted">
        Save stores this schema in the browser. Close collapses the panel — select any field to edit again.
      </p>
    </div>
  );

  if (!field) {
    return (
      <aside className={`flex min-h-0 shrink-0 flex-col border-l border-border-soft bg-surface ${widthClass}`}>
        <div className="shrink-0 border-b border-border-soft px-3 py-2.5">
          <h2 className="text-xs font-semibold text-ink">Properties</h2>
          <p className="mt-1 text-[11px] leading-snug text-muted">Select a field in the list, or save the layout as-is.</p>
        </div>
        <div className="min-h-0 flex-1" />
        {footer}
      </aside>
    );
  }

  const locked = field.locked;
  const showOptions = usesOptions(field.dataType);
  const sortedOptions = optionsSorted(field);
  const patch = (partial: Partial<FieldDefinition>) => onChange({ ...field, ...partial });

  const updateOptionLabel = (optionId: string, label: string) => {
    patch({
      options: field.options.map((o) =>
        o.id === optionId ? { ...o, label, value: optionValueFromLabel(label) } : o,
      ),
    });
  };

  const addOption = () => {
    const next = createOption("New choice", `choice_${Date.now().toString(36)}`);
    patch({ options: [...field.options, next] });
  };

  const removeOption = (optionId: string) => {
    const options = field.options.filter((o) => o.id !== optionId);
    patch({
      options,
      defaultOptionId: field.defaultOptionId === optionId ? undefined : field.defaultOptionId,
      defaultOptionIds: field.defaultOptionIds.filter((id) => id !== optionId),
    });
  };

  const moveOption = (index: number, delta: -1 | 1) => {
    const opts = [...field.options];
    const ni = index + delta;
    if (ni < 0 || ni >= opts.length) return;
    const a = opts[index]!;
    const b = opts[ni]!;
    opts[index] = b;
    opts[ni] = a;
    patch({ options: opts, orderPreference: "manual" });
  };

  const toggleMultiDefault = (optionId: string, checked: boolean) => {
    const set = new Set(field.defaultOptionIds);
    if (checked) set.add(optionId);
    else set.delete(optionId);
    patch({ defaultOptionIds: [...set] });
  };

  const optionsBlockTitle =
    field.dataType === "picklist"
      ? "Picklist options"
      : field.dataType === "radio"
        ? "Options"
        : "Options";

  const sortOrderBlock = (
    <FieldRow label="Sort order preference">
      <div className="flex flex-col gap-1">
        {(
          [
            { id: "manual" as const, label: "Entered order" },
            { id: "alphabetical" as const, label: "Alphabetical order" },
          ] as const
        ).map((opt) => (
          <label key={opt.id} className={radioChoiceClass}>
            <input
              type="radio"
              name={`order-${field.id}`}
              checked={field.orderPreference === opt.id}
              onChange={() => patch({ orderPreference: opt.id as PicklistOrderPreference })}
              disabled={locked}
              className="size-3.5 border-border-soft text-accent focus:ring-accent"
            />
            {opt.label}
          </label>
        ))}
      </div>
    </FieldRow>
  );

  const picklistOrRadioDefault = (field.dataType === "picklist" || field.dataType === "radio") && (
    <FieldRow label="Select default value">
      <select
        value={field.defaultOptionId ?? ""}
        onChange={(e) => patch({ defaultOptionId: e.target.value || undefined })}
        disabled={locked}
        className={inputClass}
      >
        <option value="">— None —</option>
        {sortedOptions.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.label}
          </option>
        ))}
      </select>
    </FieldRow>
  );

  const multiDefault = field.dataType === "multi_select" && (
    <FieldRow label="Select default value">
      <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border-soft bg-white p-1.5">
        {sortedOptions.map((opt) => (
          <label key={opt.id} className="flex cursor-pointer items-center gap-2 px-1 py-0.5 text-xs text-ink">
            <input
              type="checkbox"
              checked={field.defaultOptionIds.includes(opt.id)}
              onChange={(e) => toggleMultiDefault(opt.id, e.target.checked)}
              disabled={locked}
              className="size-3.5 rounded border-border-soft text-accent focus:ring-accent"
            />
            {opt.label}
          </label>
        ))}
      </div>
    </FieldRow>
  );

  const optionsWithReorderBlock = showOptions && (
    <FieldRow
      label={
        field.dataType === "picklist"
          ? "Picklist options (reorder)"
          : "Options (reorder)"
      }
    >
      <div className="max-h-52 space-y-1 overflow-y-auto rounded-md border border-border-soft bg-white p-1.5">
        {field.options.map((opt, idx) => (
          <div key={opt.id} className="flex items-center gap-1 rounded-md bg-surface/80 px-0.5 py-0.5">
            <ReorderIcon />
            <div className="flex shrink-0 flex-col gap-0.5">
              <button
                type="button"
                title="Move up"
                disabled={locked || idx === 0}
                onClick={() => moveOption(idx, -1)}
                className="rounded border border-border-soft bg-white px-1 py-0 text-[10px] leading-none text-ink hover:bg-rail-active/30 disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                title="Move down"
                disabled={locked || idx >= field.options.length - 1}
                onClick={() => moveOption(idx, 1)}
                className="rounded border border-border-soft bg-white px-1 py-0 text-[10px] leading-none text-ink hover:bg-rail-active/30 disabled:opacity-30"
              >
                ↓
              </button>
            </div>
            <input
              type="text"
              value={opt.label}
              onChange={(e) => updateOptionLabel(opt.id, e.target.value)}
              placeholder="Option name"
              disabled={locked}
              className="min-w-0 flex-1 rounded border border-border-soft px-1.5 py-1 text-[11px] outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={() => removeOption(opt.id)}
              disabled={locked || field.options.length <= 1}
              className="shrink-0 rounded px-1.5 text-[12px] text-red-600 hover:bg-red-50 disabled:opacity-40"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addOption}
        disabled={locked}
        className="mt-1.5 w-full rounded-md border border-dashed border-accent/40 py-1.5 text-[11px] font-medium text-accent hover:bg-rail-active/40 disabled:opacity-40"
      >
        Add option
      </button>
    </FieldRow>
  );

  const duplicateBlock = showsDuplicateControl(field.dataType) && (
    <FieldRow label="Duplicate allowed / not allowed">
      <div className="flex flex-col gap-1.5 rounded-md border border-border-soft bg-white/90 p-2">
        <label className={radioChoiceClass}>
          <input
            type="radio"
            name={`dup-${field.id}`}
            checked={!field.allowDuplicate}
            onChange={() => patch({ allowDuplicate: false })}
            disabled={locked}
            className="size-3.5 border-border-soft text-accent focus:ring-accent"
          />
          Not allowed
        </label>
        <label className={radioChoiceClass}>
          <input
            type="radio"
            name={`dup-${field.id}`}
            checked={field.allowDuplicate}
            onChange={() => patch({ allowDuplicate: true })}
            disabled={locked}
            className="size-3.5 border-border-soft text-accent focus:ring-accent"
          />
          Allowed
        </label>
      </div>
    </FieldRow>
  );

  const numberMaxDigits = field.dataType === "number" && (
    <FieldRow label="Maximum digits allowed">
      <input
        type="number"
        min={1}
        max={50}
        placeholder="No limit"
        value={field.maxDigits ?? ""}
        onChange={(e) => {
          const raw = e.target.value;
          patch({
            maxDigits: raw === "" ? undefined : Math.min(50, Math.max(1, Math.floor(Number(raw)))),
          });
        }}
        disabled={locked}
        className={inputClass}
      />
      <p className="text-[10px] text-muted">Leave empty for no maximum.</p>
    </FieldRow>
  );

  const decimalBlocks = field.dataType === "decimal" && (
    <>
      <FieldRow label="Maximum digits allowed">
        <input
          type="number"
          min={1}
          max={50}
          placeholder="No limit"
          value={field.maxDigits ?? ""}
          onChange={(e) => {
            const raw = e.target.value;
            patch({
              maxDigits: raw === "" ? undefined : Math.min(50, Math.max(1, Math.floor(Number(raw)))),
            });
          }}
          disabled={locked}
          className={inputClass}
        />
        <p className="text-[10px] text-muted">Total digits including decimals, or leave empty.</p>
      </FieldRow>
      <FieldRow label="No. of decimal places allowed">
        <input
          type="number"
          min={0}
          max={20}
          placeholder="Any"
          value={field.decimalPlaces ?? ""}
          onChange={(e) => {
            const raw = e.target.value;
            patch({
              decimalPlaces: raw === "" ? undefined : Math.min(20, Math.max(0, Math.floor(Number(raw)))),
            });
          }}
          disabled={locked}
          className={inputClass}
        />
      </FieldRow>
    </>
  );

  /** Body order follows the product spec per data type. */
  const renderTypeSpecific = () => {
    const dt = field.dataType;

    if (dt === "date" || dt === "date_time") {
      return null;
    }

    if (dt === "text" || dt === "paragraph" || dt === "email" || dt === "phone") {
      return duplicateBlock;
    }

    if (dt === "url") {
      return duplicateBlock;
    }

    if (dt === "number") {
      return (
        <>
          {duplicateBlock}
          {numberMaxDigits}
        </>
      );
    }

    if (dt === "decimal") {
      return (
        <>
          {duplicateBlock}
          {decimalBlocks}
        </>
      );
    }

    if (dt === "picklist" || dt === "radio") {
      return (
        <>
          {optionsWithReorderBlock}
          {picklistOrRadioDefault}
          {sortOrderBlock}
        </>
      );
    }

    if (dt === "multi_select") {
      return (
        <>
          {optionsWithReorderBlock}
          {multiDefault}
          {sortOrderBlock}
        </>
      );
    }

    if (dt === "formula") {
      return <CalculatedFieldEditor field={field} allFields={allFields} onChange={onChange} />;
    }

    return null;
  };

  return (
    <aside className={`flex min-h-0 shrink-0 flex-col border-l border-border-soft bg-surface ${widthClass}`}>
      <div className="shrink-0 border-b border-border-soft px-3 py-2.5">
        <h2 className="text-xs font-semibold text-ink">Properties</h2>
        <p className="mt-0.5 text-[11px] text-muted">{dataTypePropertiesTitle(field.dataType)}</p>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-y-contain px-3 py-2.5">
        <FieldRow label="Field label">
          <input
            type="text"
            value={field.label}
            onChange={(e) => patch({ label: e.target.value })}
            disabled={locked}
            className={inputClass}
          />
        </FieldRow>

        <FieldRow label="Manage leads filters">
          <label className={`${radioChoiceClass} cursor-pointer`}>
            <input
              type="checkbox"
              checked={field.includeInFilters !== false}
              onChange={(e) => patch({ includeInFilters: e.target.checked })}
              disabled={locked}
              className="size-3.5 rounded border-border-soft text-accent focus:ring-accent"
            />
            <span>Include in dynamic lead filters</span>
          </label>
          <p className="text-[10px] leading-snug text-muted">
            When off, this field is hidden from the filter builder on Manage leads.
          </p>
        </FieldRow>

        {renderTypeSpecific()}
      </div>

      {footer}
    </aside>
  );
}
