"use client";

import type { FormulaPlan } from "@/lib/fields-config/formula-types";
import {
  FORMULA_KIND_LABELS,
  describeFormulaPlan,
  isDateLike,
  isNumericLike,
  referenceableFields,
  resolveFormulaPlan,
  serializeFormulaExpression,
} from "@/lib/fields-config/formula-plan";
import type { FieldDefinition } from "@/lib/fields-config/types";

type Props = {
  field: FieldDefinition;
  allFields: FieldDefinition[];
  onChange: (next: FieldDefinition) => void;
};

function commit(field: FieldDefinition, plan: FormulaPlan, list: FieldDefinition[], onChange: (n: FieldDefinition) => void) {
  onChange({
    ...field,
    formulaPlan: plan,
    formulaExpression: serializeFormulaExpression(plan, list),
  });
}

export function CalculatedFieldEditor({ field, allFields, onChange }: Props) {
  const list = Array.isArray(allFields) ? allFields : [];
  const others = referenceableFields(list, field.id);
  const dateFields = others.filter((f) => isDateLike(f.dataType));
  const numberFields = others.filter((f) => isNumericLike(f.dataType));
  const plan = resolveFormulaPlan(field);
  const rightNumberCandidates =
    plan.kind === "number_binary"
      ? numberFields.filter((f) => f.id !== plan.leftFieldId)
      : numberFields;

  const setPlan = (next: FormulaPlan) => commit(field, next, list, onChange);

  const setKind = (kind: FormulaPlan["kind"]) => {
    switch (kind) {
      case "date_offset":
        setPlan({
          kind: "date_offset",
          sourceFieldId: dateFields[0]?.id ?? "",
          daysDelta: -2,
        });
        break;
      case "days_between":
        setPlan({
          kind: "days_between",
          startFieldId: dateFields[0]?.id ?? "",
          endFieldId: dateFields[1]?.id ?? dateFields[0]?.id ?? "",
        });
        break;
      case "number_binary":
        setPlan({
          kind: "number_binary",
          leftFieldId: numberFields[0]?.id ?? "",
          op: "*",
          rightMode: "constant",
          rightFieldId: "",
          rightConstant: 1,
        });
        break;
      case "custom":
        setPlan({ kind: "custom", expression: field.formulaExpression });
        break;
      default:
        break;
    }
  };

  const selectClass =
    "w-full rounded-lg border border-field-outer bg-white px-2 py-1.5 text-xs text-ink outline-none focus:border-accent sm:text-sm";

  return (
    <div className="space-y-3 rounded-md border border-border-soft bg-white/90 p-2.5">
      <div>
        <h3 className="text-xs font-semibold text-ink">Calculated value</h3>
        <p className="mt-0.5 text-[10px] leading-snug text-muted">
          Pattern, preview, and stored expression for your runtime.
        </p>
      </div>

      <div className="flex flex-col gap-1">
        {(Object.keys(FORMULA_KIND_LABELS) as FormulaPlan["kind"][]).map((kind) => (
          <label
            key={kind}
            className={`flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-[11px] has-[:checked]:border-accent/50 has-[:checked]:bg-field-selected-bg ${
              plan.kind === kind ? "border-accent/40 bg-field-selected-bg" : "border-field-outer"
            }`}
          >
            <input
              type="radio"
              name={`calc-kind-${field.id}`}
              checked={plan.kind === kind}
              onChange={() => setKind(kind)}
              className="size-3.5 border-field-outer text-accent focus:ring-accent"
            />
            {FORMULA_KIND_LABELS[kind]}
          </label>
        ))}
      </div>

      {plan.kind === "date_offset" && dateFields.length === 0 && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-950">
          Add at least one <strong>Date</strong> or <strong>Date &amp; time</strong> field to the canvas, then you can offset it here.
        </p>
      )}

      {plan.kind === "date_offset" && (
        <div className="space-y-2 rounded-md border border-field-outer bg-field-surface p-2">
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted">Start from</span>
            <select
              className={selectClass}
              value={plan.sourceFieldId}
              onChange={(e) => setPlan({ ...plan, sourceFieldId: e.target.value })}
            >
              <option value="">Choose a date field…</option>
              {dateFields.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[7rem] flex-1 space-y-1">
              <span className="text-xs font-medium text-muted">Days</span>
              <input
                type="number"
                step={1}
                className={selectClass}
                value={Number.isNaN(plan.daysDelta) ? 0 : plan.daysDelta}
                onChange={(e) => setPlan({ ...plan, daysDelta: Number.parseInt(e.target.value, 10) || 0 })}
              />
            </div>
            <p className="pb-1 text-[11px] text-muted">
              Negative = earlier (e.g. <strong className="text-ink">-2</strong> is two days before).
            </p>
          </div>
        </div>
      )}

      {plan.kind === "days_between" && dateFields.length < 2 && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-950">
          Add <strong>two</strong> date (or date/time) fields to compare, then pick them below.
        </p>
      )}

      {plan.kind === "days_between" && (
        <div className="space-y-2 rounded-md border border-field-outer bg-field-surface p-2">
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted">From</span>
            <select
              className={selectClass}
              value={plan.startFieldId}
              onChange={(e) => setPlan({ ...plan, startFieldId: e.target.value })}
            >
              <option value="">Earlier date…</option>
              {dateFields.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted">To</span>
            <select
              className={selectClass}
              value={plan.endFieldId}
              onChange={(e) => setPlan({ ...plan, endFieldId: e.target.value })}
            >
              <option value="">Later date…</option>
              {dateFields.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {plan.kind === "number_binary" && numberFields.length === 0 && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-950">
          Add <strong>Number</strong>, <strong>Decimal</strong>, or another <strong>Calculated</strong> field first to use number math.
        </p>
      )}

      {plan.kind === "number_binary" && (
        <div className="space-y-2 rounded-md border border-field-outer bg-field-surface p-2">
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted">First value</span>
            <select
              className={selectClass}
              value={plan.leftFieldId}
              onChange={(e) => setPlan({ ...plan, leftFieldId: e.target.value })}
            >
              <option value="">Choose a number field…</option>
              {numberFields.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted">Operator</span>
            <select
              className={`${selectClass} w-auto min-w-[3.5rem]`}
              value={plan.op}
              onChange={(e) =>
                setPlan({ ...plan, op: e.target.value as "+" | "-" | "*" | "/" })
              }
            >
              {(["+", "-", "*", "/"] as const).map((op) => (
                <option key={op} value={op}>
                  {op}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="flex items-center gap-2 text-xs text-ink">
              <input
                type="radio"
                name={`calc-right-${field.id}`}
                checked={plan.rightMode === "constant"}
                onChange={() => setPlan({ ...plan, rightMode: "constant" })}
                className="size-4 text-accent"
              />
              Fixed number
            </label>
            <label className="flex items-center gap-2 text-xs text-ink">
              <input
                type="radio"
                name={`calc-right-${field.id}`}
                checked={plan.rightMode === "field"}
                onChange={() => setPlan({ ...plan, rightMode: "field", rightFieldId: numberFields[0]?.id ?? "" })}
                className="size-4 text-accent"
              />
              Another field
            </label>
          </div>
          {plan.rightMode === "constant" ? (
            <input
              type="number"
              step="any"
              className={selectClass}
              value={plan.rightConstant}
              onChange={(e) => setPlan({ ...plan, rightConstant: Number.parseFloat(e.target.value) || 0 })}
            />
          ) : (
            <select
              className={selectClass}
              value={plan.rightFieldId}
              onChange={(e) => setPlan({ ...plan, rightFieldId: e.target.value })}
            >
              <option value="">Second number field…</option>
              {rightNumberCandidates.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {plan.kind === "custom" && (
        <div className="space-y-1">
          <span className="text-xs font-medium text-muted">Expression</span>
          <textarea
            value={plan.expression}
            onChange={(e) => setPlan({ kind: "custom", expression: e.target.value })}
            rows={4}
            placeholder="e.g. combine functions when the builder is not enough"
            className="w-full resize-y rounded-lg border border-field-outer bg-white px-2 py-2 font-mono text-[11px] text-ink outline-none focus:border-accent sm:text-xs"
          />
        </div>
      )}

      <div className="rounded-md border border-dashed border-accent/30 bg-field-selected-bg/40 px-2 py-1.5">
        <p className="text-[10px] font-medium text-ink">Preview</p>
        <p className="mt-0.5 text-[11px] text-muted">{describeFormulaPlan(plan, list)}</p>
      </div>

      <div className="space-y-0.5">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted">Stored expression (v1)</span>
        <pre className="max-h-20 overflow-auto whitespace-pre-wrap break-all rounded-md border border-field-outer bg-zinc-50 px-1.5 py-1.5 font-mono text-[10px] text-ink/90">
          {serializeFormulaExpression(plan, list) || "— complete the fields above —"}
        </pre>
      </div>
    </div>
  );
}
