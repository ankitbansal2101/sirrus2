"use client";

import Link from "next/link";
import { useState } from "react";
import type { AfterFieldUpdate, BlueprintTransition, LeadFieldOption, TransitionFieldKind } from "@/lib/blueprint/types";
import { newEntityId } from "@/lib/blueprint/types";
import { IconPlus, IconTrash } from "@/components/icons";
import type { FieldDefinition } from "@/lib/fields-config/types";
import { optionsSorted } from "@/lib/fields-config/types";

type PhaseTab = "during" | "after";

const TASK_TYPE_PRESETS = ["Follow up", "Site visit"] as const;

type Props = {
  transition: BlueprintTransition;
  /** Lead fields from Fields configurator (`apiKey` → label). */
  fieldOptions: LeadFieldOption[];
  /** Full field schema from Fields configurator — drives After auto-value editors. */
  fieldDefinitions: FieldDefinition[];
  onChange: (next: BlueprintTransition) => void;
  onDelete: () => void;
  onClose: () => void;
  /** When true, panel chrome (width, left border) is provided by the parent column. */
  embedded?: boolean;
};

function labelForFieldId(fieldOptions: LeadFieldOption[], fieldId: string, storedLabel: string): string {
  return fieldOptions.find((f) => f.id === fieldId)?.label ?? storedLabel;
}

function coerceTaskPresetType(t: string): (typeof TASK_TYPE_PRESETS)[number] {
  return t.trim() === "Site visit" ? "Site visit" : "Follow up";
}

function fieldDefByApiKey(defs: FieldDefinition[], apiKey: string): FieldDefinition | undefined {
  return defs.find((f) => f.apiKey === apiKey);
}

function allowedAfterKinds(dataType: FieldDefinition["dataType"] | undefined): AfterFieldUpdate["valueKind"][] {
  if (dataType === "date") return ["clear", "literal", "execution_date"];
  if (dataType === "date_time") return ["clear", "literal", "execution_date_time"];
  return ["clear", "literal"];
}

function defaultAfterKind(dataType: FieldDefinition["dataType"] | undefined): AfterFieldUpdate["valueKind"] {
  if (dataType === "date") return "execution_date";
  if (dataType === "date_time") return "execution_date_time";
  return "literal";
}

function coerceAfterUpdate(defn: FieldDefinition | undefined, u: AfterFieldUpdate): AfterFieldUpdate {
  const allowed = allowedAfterKinds(defn?.dataType);
  let valueKind = u.valueKind;
  if (!allowed.includes(valueKind)) valueKind = defaultAfterKind(defn?.dataType);
  const literalValue = valueKind === "literal" ? u.literalValue : "";
  return { ...u, valueKind, literalValue, fieldLabel: defn?.label ?? u.fieldLabel };
}

function parseMultiIds(s: string): string[] {
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}

function toggleMultiId(current: string, optId: string): string {
  const set = new Set(parseMultiIds(current));
  if (set.has(optId)) set.delete(optId);
  else set.add(optId);
  return [...set].join(",");
}

type AfterRowProps = {
  u: AfterFieldUpdate;
  fieldOptions: LeadFieldOption[];
  fieldDefinitions: FieldDefinition[];
  onPatch: (partial: Partial<AfterFieldUpdate>) => void;
  onRemove: () => void;
};

function AfterAutoValueRow({ u, fieldOptions, fieldDefinitions, onPatch, onRemove }: AfterRowProps) {
  const defn = fieldDefByApiKey(fieldDefinitions, u.fieldId);
  const dt = defn?.dataType;
  const sortedOpts = defn ? optionsSorted(defn) : [];
  const isClear = u.valueKind === "clear";

  function renderNonDateLiteral() {
    if (!defn) {
      return (
        <input
          type="text"
          value={u.literalValue}
          onChange={(e) => onPatch({ literalValue: e.target.value })}
          className="w-full rounded-md border border-border-soft bg-white px-1.5 py-1 text-xs"
          placeholder="Value"
        />
      );
    }
    return (
      <div className="space-y-1">
        {dt === "text" || dt === "paragraph" || dt === "formula" ? (
          dt === "paragraph" ? (
            <textarea
              value={u.literalValue}
              onChange={(e) => onPatch({ literalValue: e.target.value })}
              rows={2}
              className="w-full rounded-md border border-border-soft bg-white px-1.5 py-1 text-xs"
              placeholder="Value"
            />
          ) : (
            <input
              type="text"
              value={u.literalValue}
              onChange={(e) => onPatch({ literalValue: e.target.value })}
              className="w-full rounded-md border border-border-soft bg-white px-1.5 py-1 text-xs"
              placeholder="Value"
            />
          )
        ) : null}
        {dt === "email" ? (
          <input
            type="email"
            value={u.literalValue}
            onChange={(e) => onPatch({ literalValue: e.target.value })}
            className="w-full rounded-md border border-border-soft bg-white px-1.5 py-1 text-xs"
            placeholder="email@example.com"
          />
        ) : null}
        {dt === "phone" ? (
          <input
            type="tel"
            value={u.literalValue}
            onChange={(e) => onPatch({ literalValue: e.target.value })}
            className="w-full rounded-md border border-border-soft bg-white px-1.5 py-1 text-xs"
            placeholder="Phone"
          />
        ) : null}
        {dt === "number" ? (
          <input
            type="number"
            value={u.literalValue}
            onChange={(e) => onPatch({ literalValue: e.target.value })}
            className="w-full rounded-md border border-border-soft bg-white px-1.5 py-1 text-xs"
            placeholder="Number"
          />
        ) : null}
        {dt === "decimal" ? (
          <input
            type="number"
            step="any"
            value={u.literalValue}
            onChange={(e) => onPatch({ literalValue: e.target.value })}
            className="w-full rounded-md border border-border-soft bg-white px-1.5 py-1 text-xs"
            placeholder="Decimal"
          />
        ) : null}
        {dt === "picklist" || dt === "radio" ? (
          <select
            value={u.literalValue}
            onChange={(e) => onPatch({ literalValue: e.target.value })}
            className="w-full rounded-md border border-border-soft bg-white px-1.5 py-1 text-xs"
          >
            <option value="">Select…</option>
            {sortedOpts.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : null}
        {dt === "multi_select" ? (
          <div className="max-h-28 space-y-1 overflow-y-auto rounded-md border border-border-soft bg-surface/60 px-2 py-1.5">
            {sortedOpts.map((opt) => {
              const on = parseMultiIds(u.literalValue).includes(opt.id);
              return (
                <label key={opt.id} className="flex cursor-pointer items-center gap-2 text-[11px] text-ink">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => onPatch({ literalValue: toggleMultiId(u.literalValue, opt.id) })}
                    className="size-3.5 rounded border-border-soft text-accent"
                  />
                  {opt.label}
                </label>
              );
            })}
          </div>
        ) : null}
        {dt &&
        dt !== "text" &&
        dt !== "paragraph" &&
        dt !== "email" &&
        dt !== "phone" &&
        dt !== "number" &&
        dt !== "decimal" &&
        dt !== "picklist" &&
        dt !== "radio" &&
        dt !== "multi_select" &&
        dt !== "formula" ? (
          <input
            type="text"
            value={u.literalValue}
            onChange={(e) => onPatch({ literalValue: e.target.value })}
            className="w-full rounded-md border border-border-soft bg-white px-1.5 py-1 text-xs"
            placeholder="Value"
          />
        ) : null}
      </div>
    );
  }

  function valueBlock() {
    if (isClear) {
      return (
        <div className="rounded-md border border-dashed border-border-soft bg-surface/40 px-2 py-2 text-center">
          <p className="text-[10px] text-muted">Cleared when this transition runs.</p>
          <button
            type="button"
            className="mt-1 text-[10px] font-semibold text-accent hover:underline"
            onClick={() => onPatch(coerceAfterUpdate(defn, { ...u, valueKind: defaultAfterKind(dt), literalValue: "" }))}
          >
            Set a value
          </button>
        </div>
      );
    }

    if (dt === "date") {
      return (
        <div className="space-y-1.5">
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-ink">
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="radio"
                name={`date-${u.id}`}
                className="size-3.5 border-border-soft text-accent"
                checked={u.valueKind === "literal"}
                onChange={() => onPatch({ valueKind: "literal", literalValue: u.literalValue })}
              />
              Pick date
            </label>
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="radio"
                name={`date-${u.id}`}
                className="size-3.5 border-border-soft text-accent"
                checked={u.valueKind === "execution_date"}
                onChange={() => onPatch({ valueKind: "execution_date", literalValue: "" })}
              />
              When transition runs
            </label>
          </div>
          {u.valueKind === "literal" ? (
            <input
              type="date"
              value={u.literalValue}
              onChange={(e) => onPatch({ literalValue: e.target.value })}
              className="w-full rounded-md border border-border-soft bg-white px-1.5 py-1 text-xs"
            />
          ) : (
            <p className="text-[9px] leading-snug text-muted">Uses the calendar date when the rep completes this move.</p>
          )}
        </div>
      );
    }

    if (dt === "date_time") {
      return (
        <div className="space-y-1.5">
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-ink">
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="radio"
                name={`dt-${u.id}`}
                className="size-3.5 border-border-soft text-accent"
                checked={u.valueKind === "literal"}
                onChange={() => onPatch({ valueKind: "literal", literalValue: u.literalValue })}
              />
              Pick date and time
            </label>
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="radio"
                name={`dt-${u.id}`}
                className="size-3.5 border-border-soft text-accent"
                checked={u.valueKind === "execution_date_time"}
                onChange={() => onPatch({ valueKind: "execution_date_time", literalValue: "" })}
              />
              When transition runs
            </label>
          </div>
          {u.valueKind === "literal" ? (
            <input
              type="datetime-local"
              value={u.literalValue}
              onChange={(e) => onPatch({ literalValue: e.target.value })}
              className="w-full rounded-md border border-border-soft bg-white px-1.5 py-1 text-xs"
            />
          ) : (
            <p className="text-[9px] leading-snug text-muted">Uses the date and time when the rep completes this move.</p>
          )}
        </div>
      );
    }

    return renderNonDateLiteral();
  }

  return (
    <li className="rounded-lg border border-border-soft bg-white p-2 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label className="text-[10px] text-muted">Field</label>
          <select
            value={u.fieldId}
            onChange={(e) => {
              const fieldId = e.target.value;
              const nextDefn = fieldDefByApiKey(fieldDefinitions, fieldId);
              const merged: AfterFieldUpdate = {
                ...u,
                fieldId,
                fieldLabel: fieldOptions.find((f) => f.id === fieldId)?.label ?? u.fieldLabel,
              };
              onPatch(coerceAfterUpdate(nextDefn, merged));
            }}
            className="mt-0.5 w-full rounded-md border border-border-soft bg-white px-1.5 py-1 text-xs"
          >
            {!fieldOptions.some((f) => f.id === u.fieldId) ? (
              <option value={u.fieldId}>
                {u.fieldLabel} (not in schema)
              </option>
            ) : null}
            {fieldOptions.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
        <span className="hidden shrink-0 self-center pb-1 text-xs font-medium text-muted sm:inline" aria-hidden>
          =
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1">
            <label className="text-[10px] text-muted">Value</label>
            <button
              type="button"
              onClick={onRemove}
              className="rounded p-0.5 text-red-600 transition hover:bg-red-50"
              aria-label="Remove field update"
            >
              <IconTrash className="size-3.5" />
            </button>
          </div>
          <div className="mt-0.5">{valueBlock()}</div>
          {!isClear ? (
            <button
              type="button"
              className="mt-1 text-[10px] text-muted underline decoration-border-soft underline-offset-2 hover:text-ink"
              onClick={() => onPatch({ valueKind: "clear", literalValue: "" })}
            >
              Clear this field
            </button>
          ) : null}
        </div>
      </div>
    </li>
  );
}

export function TransitionInspector({
  transition,
  fieldOptions,
  fieldDefinitions,
  onChange,
  onDelete,
  onClose,
  embedded,
}: Props) {
  const [phase, setPhase] = useState<PhaseTab>("during");

  const defaultNewField = (): { fieldId: string; label: string } => {
    const pick =
      fieldOptions.find((o) => o.id === "lost_reason") ??
      fieldOptions.find((o) => /reason|remark/i.test(o.id)) ??
      fieldOptions[0];
    if (!pick) return { fieldId: "remarks", label: "Remarks" };
    return { fieldId: pick.id, label: pick.label };
  };

  const rootClass = embedded
    ? "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
    : "flex w-[min(100%,300px)] shrink-0 flex-col border-l border-border-soft bg-surface shadow-[inset_1px_0_0_rgba(0,0,0,0.02)]";

  return (
    <div className={rootClass}>
      <div className="shrink-0 border-b border-border-soft px-3 py-2">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted">Transition</p>
        <input
          type="text"
          value={transition.name}
          onChange={(e) => onChange({ ...transition, name: e.target.value })}
          className="mt-1 w-full rounded-lg border border-border-soft bg-white px-2 py-1.5 text-xs font-semibold text-ink shadow-sm outline-none ring-accent focus:ring-2"
          aria-label="Transition name"
        />
        <label className="mt-2 flex cursor-pointer items-center gap-2 text-[11px] text-ink">
          <input
            type="checkbox"
            checked={transition.enabled}
            onChange={(e) => onChange({ ...transition, enabled: e.target.checked })}
            className="size-3.5 rounded border-border-soft text-accent"
          />
          Enabled
        </label>
        <p className="mt-1.5 text-[10px] leading-snug text-muted">
          Pickers from{" "}
          <Link href="/developer/lead-settings/fields-configurator" className="font-semibold text-accent underline-offset-2 hover:underline">
            Fields
          </Link>
          .
        </p>
      </div>

      <div className="flex shrink-0 border-b border-border-soft px-1 pt-1">
        {(
          [
            ["during", "During"],
            ["after", "After"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setPhase(id)}
            className={`flex-1 rounded-t-lg px-1 py-1.5 text-[10px] font-semibold uppercase tracking-wide transition ${
              phase === id ? "bg-white text-accent shadow-sm" : "text-muted hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-2.5 text-xs">
        {phase === "during" ? (
          <div className="space-y-4">
            <p className="text-[11px] font-semibold text-ink">Add actions and fields</p>

            <section className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-[10px] font-bold uppercase tracking-wide text-muted">Fields</h3>
                <button
                  type="button"
                  className="rounded-md bg-accent px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm transition hover:opacity-95"
                  onClick={() => {
                    const seed = defaultNewField();
                    onChange({
                      ...transition,
                      form: {
                        ...transition.form,
                        fields: [
                          ...transition.form.fields,
                          {
                            id: newEntityId("df"),
                            fieldId: seed.fieldId,
                            label: seed.label,
                            kind: (seed.fieldId === "lost_reason" ? "picklist" : "text") as TransitionFieldKind,
                            mandatory: false,
                            picklistOptions:
                              seed.fieldId === "lost_reason" ? ["Price", "Fit", "Timing", "Other"] : [],
                          },
                        ],
                      },
                    });
                  }}
                >
                  + Add field
                </button>
              </div>
              {fieldOptions.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border-soft bg-white/80 px-2 py-2 text-[10px] text-muted">
                  No fields. Open{" "}
                  <Link href="/developer/lead-settings/fields-configurator" className="font-semibold text-accent underline-offset-2 hover:underline">
                    Fields
                  </Link>
                  .
                </p>
              ) : null}
              <ul className="space-y-2">
                {transition.form.fields.map((row, idx) => (
                  <li key={row.id} className="rounded-lg border border-border-soft bg-white p-2 shadow-sm">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-[10px] font-medium text-muted">Field {idx + 1}</span>
                      <button
                        type="button"
                        className="text-[10px] font-semibold text-red-600 hover:underline"
                        onClick={() =>
                          onChange({
                            ...transition,
                            form: {
                              ...transition.form,
                              fields: transition.form.fields.filter((x) => x.id !== row.id),
                            },
                          })
                        }
                      >
                        Remove
                      </button>
                    </div>
                    <label className="block text-[10px] text-muted">Lead field</label>
                    <select
                      value={row.fieldId}
                      onChange={(e) => {
                        const fieldId = e.target.value;
                        onChange({
                          ...transition,
                          form: {
                            ...transition.form,
                            fields: transition.form.fields.map((x) =>
                              x.id === row.id
                                ? {
                                    ...x,
                                    fieldId,
                                    label: labelForFieldId(fieldOptions, fieldId, x.label),
                                  }
                                : x,
                            ),
                          },
                        });
                      }}
                      className="mt-0.5 w-full rounded-md border border-border-soft bg-white px-1.5 py-1 text-xs"
                    >
                      {!fieldOptions.some((f) => f.id === row.fieldId) ? (
                        <option value={row.fieldId}>
                          {row.label} (not in current schema)
                        </option>
                      ) : null}
                      {fieldOptions.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                    <label className="mt-2 block text-[10px] text-muted">Mark as</label>
                    <select
                      value={row.mandatory ? "mandatory" : "optional"}
                      onChange={(e) =>
                        onChange({
                          ...transition,
                          form: {
                            ...transition.form,
                            fields: transition.form.fields.map((x) =>
                              x.id === row.id ? { ...x, mandatory: e.target.value === "mandatory" } : x,
                            ),
                          },
                        })
                      }
                      className="mt-0.5 w-full rounded-md border border-border-soft bg-white px-1.5 py-1 text-xs"
                    >
                      <option value="mandatory">Mandatory</option>
                      <option value="optional">Non-mandatory</option>
                    </select>
                    {row.kind === "picklist" && row.picklistOptions.length > 0 ? (
                      <div className="mt-2">
                        <label className="text-[10px] text-muted">Picklist options</label>
                        <input
                          type="text"
                          value={row.picklistOptions.join(", ")}
                          onChange={(e) =>
                            onChange({
                              ...transition,
                              form: {
                                ...transition.form,
                                fields: transition.form.fields.map((x) =>
                                  x.id === row.id
                                    ? {
                                        ...x,
                                        picklistOptions: e.target.value
                                          .split(",")
                                          .map((s) => s.trim())
                                          .filter(Boolean),
                                      }
                                    : x,
                                ),
                              },
                            })
                          }
                          className="mt-0.5 w-full rounded-md border border-border-soft bg-white px-1.5 py-1 text-xs"
                          placeholder="Comma-separated"
                        />
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>

            <section className="space-y-3 border-t border-border-soft pt-3">
              <h3 className="text-[10px] font-bold uppercase tracking-wide text-muted">Actions</h3>

              <div className="rounded-lg border border-border-soft bg-white p-2 shadow-sm">
                <label className="flex cursor-pointer items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold text-ink">Notes</span>
                  <input
                    type="checkbox"
                    checked={transition.form.includeRemark}
                    onChange={(e) =>
                      onChange({
                        ...transition,
                        form: {
                          ...transition.form,
                          includeRemark: e.target.checked,
                          remarkMandatory: e.target.checked ? transition.form.remarkMandatory : false,
                        },
                      })
                    }
                    className="size-3.5 shrink-0 rounded border-border-soft text-accent"
                    aria-label="Show notes on this transition"
                  />
                </label>
                {transition.form.includeRemark ? (
                  <select
                    aria-label="Notes mandatory or optional"
                    value={transition.form.remarkMandatory ? "mandatory" : "optional"}
                    onChange={(e) =>
                      onChange({
                        ...transition,
                        form: {
                          ...transition.form,
                          remarkMandatory: e.target.value === "mandatory",
                        },
                      })
                    }
                    className="mt-1.5 w-full rounded-md border border-border-soft bg-white px-1.5 py-1 text-[11px]"
                  >
                    <option value="mandatory">Mandatory</option>
                    <option value="optional">Non-mandatory</option>
                  </select>
                ) : null}
              </div>

              <div className="rounded-lg border border-border-soft bg-white p-2 shadow-sm">
                <label className="flex cursor-pointer items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold text-ink">Tasks</span>
                  <input
                    type="checkbox"
                    checked={transition.form.includeTasks}
                    onChange={(e) =>
                      onChange({
                        ...transition,
                        form: {
                          ...transition.form,
                          includeTasks: e.target.checked,
                          taskMandatory: e.target.checked ? transition.form.taskMandatory : false,
                        },
                      })
                    }
                    className="size-3.5 shrink-0 rounded border-border-soft text-accent"
                    aria-label="Show tasks on this transition"
                  />
                </label>
                {transition.form.includeTasks ? (
                  <div className="mt-1.5 space-y-1.5">
                    <select
                      aria-label="Task type"
                      value={coerceTaskPresetType(transition.form.taskPresetType)}
                      onChange={(e) => {
                        const v = e.target.value as (typeof TASK_TYPE_PRESETS)[number];
                        onChange({
                          ...transition,
                          form: {
                            ...transition.form,
                            taskPresetType: v,
                          },
                        });
                      }}
                      className="w-full rounded-md border border-border-soft bg-white px-1.5 py-1 text-[11px]"
                    >
                      {TASK_TYPE_PRESETS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="Task mandatory or optional"
                      value={transition.form.taskMandatory ? "mandatory" : "optional"}
                      onChange={(e) =>
                        onChange({
                          ...transition,
                          form: {
                            ...transition.form,
                            taskMandatory: e.target.value === "mandatory",
                          },
                        })
                      }
                      className="w-full rounded-md border border-border-soft bg-white px-1.5 py-1 text-[11px]"
                    >
                      <option value="mandatory">Mandatory</option>
                      <option value="optional">Non-mandatory</option>
                    </select>
                  </div>
                ) : null}
              </div>
            </section>
          </div>
        ) : null}

        {phase === "after" ? (
          <div className="space-y-3">
            <p className="text-[10px] leading-snug text-muted">
              Uses field types from{" "}
              <Link href="/developer/lead-settings/fields-configurator" className="font-semibold text-accent underline-offset-2 hover:underline">
                Fields
              </Link>
              . Add as many updates as you need.
            </p>
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold text-muted">Field updates</span>
                <button
                  type="button"
                  className="flex size-7 items-center justify-center rounded-md border border-border-soft bg-white text-accent shadow-sm transition hover:bg-zinc-50"
                  aria-label="Add field update"
                  onClick={() => {
                    const firstDef = fieldDefinitions[0];
                    const firstOpt = fieldOptions[0];
                    const fieldId = firstDef?.apiKey ?? firstOpt?.id ?? "stage";
                    const fieldLabel = firstDef?.label ?? firstOpt?.label ?? fieldId;
                    const valueKind = defaultAfterKind(firstDef?.dataType);
                    onChange({
                      ...transition,
                      after: {
                        fieldUpdates: [
                          ...transition.after.fieldUpdates,
                          {
                            id: newEntityId("fu"),
                            fieldId,
                            fieldLabel,
                            valueKind,
                            literalValue: "",
                          },
                        ],
                      },
                    });
                  }}
                >
                  <IconPlus className="size-4" />
                </button>
              </div>
              <ul className="space-y-2">
                {transition.after.fieldUpdates.map((u) => (
                  <AfterAutoValueRow
                    key={u.id}
                    u={u}
                    fieldOptions={fieldOptions}
                    fieldDefinitions={fieldDefinitions}
                    onPatch={(partial) =>
                      onChange({
                        ...transition,
                        after: {
                          fieldUpdates: transition.after.fieldUpdates.map((x) => {
                            if (x.id !== u.id) return x;
                            const merged = { ...x, ...partial };
                            const defn = fieldDefByApiKey(fieldDefinitions, merged.fieldId);
                            return coerceAfterUpdate(defn, merged);
                          }),
                        },
                      })
                    }
                    onRemove={() =>
                      onChange({
                        ...transition,
                        after: { fieldUpdates: transition.after.fieldUpdates.filter((x) => x.id !== u.id) },
                      })
                    }
                  />
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 border-t border-border-soft bg-white/80 px-2 py-1.5">
        <button
          type="button"
          onClick={onDelete}
          className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-semibold text-red-800 transition hover:bg-red-100"
        >
          Delete
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-border-soft bg-white px-2 py-1 text-[10px] font-semibold text-ink shadow-sm transition hover:bg-zinc-50"
        >
          Close
        </button>
      </div>
    </div>
  );
}
