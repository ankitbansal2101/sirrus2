"use client";

import { CalculatedFieldEditor } from "@/components/fields-configurator/calculated-field-editor";
import type { FieldDefinition, PicklistOrderPreference } from "@/lib/fields-config/types";
import { createOption, optionValueFromLabel, optionsSorted, usesOptions } from "@/lib/fields-config/types";

type Props = {
  field: FieldDefinition | null;
  allFields?: FieldDefinition[];
  onChange: (next: FieldDefinition) => void;
  /** Persist full canvas schema (e.g. localStorage) and parent will collapse the panel. */
  onSaveSchema: () => void;
  /** Close panel without a separate persist action (changes stay in memory). */
  onClosePanel: () => void;
};

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted">{label}</label>
      {children}
    </div>
  );
}

export function PropertiesPanel({ field, allFields = [], onChange, onSaveSchema, onClosePanel }: Props) {
  const widthClass = field?.dataType === "formula" ? "w-[22rem]" : "w-80";

  const footer = (
    <div className="shrink-0 border-t border-border-soft bg-surface p-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onSaveSchema}
          className="flex-1 rounded-xl bg-accent px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-accent/90 hover:shadow-md"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onClosePanel}
          className="rounded-xl border border-border-soft bg-white px-3 py-2.5 text-sm font-medium text-ink shadow-sm transition hover:bg-rail-inactive/50"
        >
          Close
        </button>
      </div>
      <p className="mt-2 text-[10px] leading-snug text-muted">
        Save writes this layout to your browser so it survives refresh. Close hides the panel; pick a field again to
        reopen.
      </p>
    </div>
  );

  if (!field) {
    return (
      <aside className={`flex shrink-0 flex-col border-l border-border-soft bg-surface ${widthClass}`}>
        <div className="border-b border-border-soft p-4">
          <h2 className="text-sm font-semibold text-ink">Properties</h2>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            Select a field on the canvas to edit it, or save the current layout as-is.
          </p>
        </div>
        <div className="min-h-0 flex-1" />
        {footer}
      </aside>
    );
  }

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
      defaultOptionId:
        field.defaultOptionId === optionId ? undefined : field.defaultOptionId,
      defaultOptionIds: field.defaultOptionIds.filter((id) => id !== optionId),
    });
  };

  const toggleMultiDefault = (optionId: string, checked: boolean) => {
    const set = new Set(field.defaultOptionIds);
    if (checked) set.add(optionId);
    else set.delete(optionId);
    patch({ defaultOptionIds: [...set] });
  };

  return (
    <aside className={`flex shrink-0 flex-col border-l border-border-soft bg-surface ${widthClass}`}>
      <div className="shrink-0 border-b border-border-soft p-4">
        <h2 className="text-sm font-semibold text-ink">Properties</h2>
        <p className="mt-0.5 text-xs capitalize text-muted">
          {field.dataType === "formula" ? "Calculated field" : field.dataType.replace(/_/g, " ")}
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <FieldRow label="Field label">
          <input
            type="text"
            value={field.label}
            onChange={(e) => patch({ label: e.target.value })}
            className="w-full rounded-xl border border-border-soft bg-white px-3 py-2 text-sm text-ink outline-none focus:border-accent"
          />
        </FieldRow>

        <div className="flex flex-col gap-3 rounded-xl border border-border-soft bg-white/80 p-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={field.required}
              onChange={(e) => patch({ required: e.target.checked })}
              className="size-4 rounded border-border-soft text-accent focus:ring-accent"
            />
            Required
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={field.allowDuplicate}
              onChange={(e) => patch({ allowDuplicate: e.target.checked })}
              className="size-4 rounded border-border-soft text-accent focus:ring-accent"
            />
            Allow duplicate values
          </label>
        </div>

        {field.dataType === "formula" && (
          <CalculatedFieldEditor field={field} allFields={allFields} onChange={onChange} />
        )}

        {showOptions && (
          <>
            <FieldRow label="Options">
              <div className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-border-soft bg-white p-2">
                {sortedOptions.map((opt) => (
                  <div key={opt.id} className="flex gap-2 rounded-lg bg-surface/80 p-2">
                    <input
                      type="text"
                      value={opt.label}
                      onChange={(e) => updateOptionLabel(opt.id, e.target.value)}
                      placeholder="Option name"
                      className="min-w-0 flex-1 rounded-lg border border-border-soft px-2 py-1 text-xs outline-none focus:border-accent"
                    />
                    <button
                      type="button"
                      onClick={() => removeOption(opt.id)}
                      disabled={field.options.length <= 1}
                      className="shrink-0 rounded-lg px-2 text-xs text-red-600 hover:bg-red-50 disabled:opacity-40"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addOption}
                className="mt-2 w-full rounded-xl border border-dashed border-accent/40 py-2 text-xs font-medium text-accent hover:bg-rail-active/40"
              >
                Add option
              </button>
            </FieldRow>

            <FieldRow label="Order preference">
              <div className="flex flex-col gap-2">
                {(
                  [
                    { id: "manual", label: "Manual (canvas / editor order)" },
                    { id: "alphabetical", label: "Alphabetical by label" },
                  ] as const
                ).map((opt) => (
                  <label
                    key={opt.id}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-border-soft bg-white px-3 py-2 text-sm text-ink has-[:checked]:border-accent/50 has-[:checked]:bg-rail-active/30"
                  >
                    <input
                      type="radio"
                      name={`order-${field.id}`}
                      checked={field.orderPreference === opt.id}
                      onChange={() => patch({ orderPreference: opt.id as PicklistOrderPreference })}
                      className="size-4 border-border-soft text-accent focus:ring-accent"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </FieldRow>

            {(field.dataType === "picklist" || field.dataType === "radio") && (
              <FieldRow label="Default value">
                <select
                  value={field.defaultOptionId ?? ""}
                  onChange={(e) =>
                    patch({
                      defaultOptionId: e.target.value || undefined,
                    })
                  }
                  className="w-full rounded-xl border border-border-soft bg-white px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                >
                  <option value="">— None —</option>
                  {sortedOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </FieldRow>
            )}

            {field.dataType === "multi_select" && (
              <FieldRow label="Default selections">
                <div className="space-y-2 rounded-xl border border-border-soft bg-white p-2">
                  {sortedOptions.map((opt) => (
                    <label key={opt.id} className="flex cursor-pointer items-center gap-2 text-sm text-ink">
                      <input
                        type="checkbox"
                        checked={field.defaultOptionIds.includes(opt.id)}
                        onChange={(e) => toggleMultiDefault(opt.id, e.target.checked)}
                        className="size-4 rounded border-border-soft text-accent focus:ring-accent"
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </FieldRow>
            )}
          </>
        )}
      </div>

      {footer}
    </aside>
  );
}
