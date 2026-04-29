"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormulaPlan } from "@/lib/fields-config/formula-types";
import {
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

type NumOp = "+" | "-" | "*" | "/";

type PickTarget = "date_source" | "between_start" | "between_end" | "num_left" | "num_right";

const FUNCTION_ROWS: { planKind: FormulaPlan["kind"]; label: string; op?: NumOp }[] = [
  { planKind: "date_offset", label: "DATEADD" },
  { planKind: "days_between", label: "DAYS_BETWEEN" },
  { planKind: "number_binary", label: "ADD", op: "+" },
  { planKind: "number_binary", label: "SUBTRACT", op: "-" },
  { planKind: "number_binary", label: "MULTIPLY", op: "*" },
  { planKind: "number_binary", label: "DIVIDE", op: "/" },
  { planKind: "custom", label: "CUSTOM" },
];

function commit(field: FieldDefinition, plan: FormulaPlan, list: FieldDefinition[], onChange: (n: FieldDefinition) => void) {
  onChange({
    ...field,
    formulaPlan: plan,
    formulaExpression: serializeFormulaExpression(plan, list),
  });
}

function fieldBtnClass(active: boolean) {
  return `flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition ${
    active
      ? "border-accent bg-field-selected-bg text-ink shadow-sm"
      : "border-field-outer bg-white text-ink hover:border-accent/40 hover:bg-field-surface"
  }`;
}

export function CalculatedFieldEditor({ field, allFields, onChange }: Props) {
  const list = Array.isArray(allFields) ? allFields : [];
  const others = referenceableFields(list, field.id);
  const dateFields = others.filter((f) => isDateLike(f.dataType));
  const numberFields = others.filter((f) => isNumericLike(f.dataType));
  const plan = resolveFormulaPlan(field);

  const [pickTarget, setPickTarget] = useState<PickTarget>(() =>
    plan.kind === "days_between" ? "between_start" : plan.kind === "number_binary" ? "num_left" : "date_source",
  );

  const setPlan = useCallback(
    (next: FormulaPlan) => {
      commit(field, next, list, onChange);
    },
    [field, list, onChange],
  );

  const activateFunction = useCallback(
    (row: (typeof FUNCTION_ROWS)[number]) => {
      const { planKind, op } = row;
      if (planKind === "date_offset") {
        setPickTarget("date_source");
        setPlan({
          kind: "date_offset",
          sourceFieldId: dateFields[0]?.id ?? "",
          daysDelta: -2,
        });
        return;
      }
      if (planKind === "days_between") {
        setPickTarget("between_start");
        setPlan({
          kind: "days_between",
          startFieldId: dateFields[0]?.id ?? "",
          endFieldId: dateFields[1]?.id ?? dateFields[0]?.id ?? "",
        });
        return;
      }
      if (planKind === "number_binary" && op) {
        setPickTarget("num_left");
        setPlan({
          kind: "number_binary",
          leftFieldId: numberFields[0]?.id ?? "",
          op,
          rightMode: "field",
          rightFieldId: numberFields.find((f) => f.id !== numberFields[0]?.id)?.id ?? numberFields[0]?.id ?? "",
          rightConstant: 1,
        });
        return;
      }
      if (planKind === "custom") {
        setPlan({ kind: "custom", expression: field.formulaExpression });
      }
    },
    [dateFields, field.formulaExpression, numberFields, setPlan],
  );

  const onFieldRowClick = useCallback(
    (f: FieldDefinition) => {
      if (plan.kind === "date_offset") {
        if (!isDateLike(f.dataType)) return;
        setPlan({ ...plan, sourceFieldId: f.id });
        return;
      }
      if (plan.kind === "days_between") {
        if (!isDateLike(f.dataType)) return;
        if (pickTarget === "between_start") {
          setPlan({ ...plan, startFieldId: f.id });
          setPickTarget("between_end");
        } else {
          setPlan({ ...plan, endFieldId: f.id });
        }
        return;
      }
      if (plan.kind === "number_binary") {
        if (!isNumericLike(f.dataType)) return;
        if (plan.rightMode === "constant") {
          setPlan({ ...plan, leftFieldId: f.id });
          return;
        }
        if (pickTarget === "num_left") {
          setPlan({ ...plan, leftFieldId: f.id });
          setPickTarget("num_right");
          return;
        }
        if (f.id === plan.leftFieldId) return;
        setPlan({ ...plan, rightMode: "field", rightFieldId: f.id });
        return;
      }
      if (plan.kind === "custom") {
        const key = f.apiKey.trim() || f.label.trim();
        if (!key) return;
        const nextExpr = `${plan.expression}${plan.expression && !/\s$/.test(plan.expression) ? " " : ""}${key}`;
        setPlan({ kind: "custom", expression: nextExpr });
      }
    },
    [pickTarget, plan, setPlan],
  );

  const rightList: FieldDefinition[] = useMemo(() => {
    if (plan.kind === "date_offset" || plan.kind === "days_between") return dateFields;
    if (plan.kind === "number_binary") return numberFields;
    return others;
  }, [dateFields, numberFields, others, plan.kind]);

  const selectClass =
    "w-full rounded-lg border border-field-outer bg-white px-2 py-1.5 text-xs text-ink outline-none focus:border-accent sm:text-sm";

  const needsDates = plan.kind === "date_offset" || plan.kind === "days_between";
  const needsNumbers = plan.kind === "number_binary";
  const emptyRight =
    (needsDates && dateFields.length === 0) || (needsNumbers && numberFields.length === 0);

  return (
    <div className="flex min-h-[14rem] flex-col gap-2 sm:flex-row sm:gap-3">
      <div className="flex w-full shrink-0 flex-col rounded-md border border-border-soft bg-white/90 p-2 sm:max-w-[11rem] sm:p-2.5">
        <h3 className="text-[10px] font-semibold uppercase tracking-wide text-muted">Functions</h3>
        <p className="mt-0.5 text-[9px] leading-snug text-muted">Pick one. Names match the stored expression helpers.</p>
        <ul className="mt-2 flex flex-row flex-wrap gap-1 sm:mt-2 sm:flex-col sm:flex-nowrap sm:gap-1">
          {FUNCTION_ROWS.map((row) => {
            const active =
              row.planKind === "custom"
                ? plan.kind === "custom"
                : row.planKind === "number_binary"
                  ? plan.kind === "number_binary" && row.op === plan.op
                  : plan.kind === row.planKind;
            return (
              <li key={row.label} className="min-w-0 flex-1 sm:flex-none">
                <button
                  type="button"
                  onClick={() => activateFunction(row)}
                  className={`w-full rounded-md border px-2 py-1.5 font-mono text-[11px] font-semibold transition sm:py-2 sm:text-xs ${
                    active
                      ? "border-accent bg-field-selected-bg text-ink shadow-sm"
                      : "border-field-outer bg-field-surface text-ink hover:border-accent/50"
                  }`}
                >
                  {row.label}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-md border border-border-soft bg-white/90 p-2.5">
        <h3 className="text-[10px] font-semibold uppercase tracking-wide text-muted">Fields</h3>
        <p className="mt-0.5 text-[9px] leading-snug text-muted">
          {plan.kind === "custom"
            ? "Tap a field to append its API key to the expression."
            : plan.kind === "days_between"
              ? "Choose start date, then end date (use the two buttons below)."
              : plan.kind === "number_binary"
                ? "Choose first number, then second (different field)."
                : "Choose the date field to shift."}
        </p>

        {plan.kind === "date_offset" && (
          <div className="mt-2 flex flex-wrap items-end gap-2 border-b border-border-soft pb-2">
            <label className="min-w-[5rem] flex-1 space-y-0.5">
              <span className="text-[10px] font-medium text-muted">Days</span>
              <input
                type="number"
                step={1}
                className={selectClass}
                value={Number.isNaN(plan.daysDelta) ? 0 : plan.daysDelta}
                onChange={(e) => setPlan({ ...plan, daysDelta: Number.parseInt(e.target.value, 10) || 0 })}
              />
            </label>
            <p className="text-[10px] text-muted">Negative = earlier.</p>
          </div>
        )}

        {plan.kind === "days_between" && (
          <div className="mt-2 flex flex-wrap gap-1 border-b border-border-soft pb-2">
            <button
              type="button"
              onClick={() => setPickTarget("between_start")}
              className={`rounded-md border px-2 py-1 text-[10px] font-semibold ${
                pickTarget === "between_start" ? "border-accent bg-field-selected-bg" : "border-field-outer bg-white"
              }`}
            >
              From (start)
            </button>
            <button
              type="button"
              onClick={() => setPickTarget("between_end")}
              className={`rounded-md border px-2 py-1 text-[10px] font-semibold ${
                pickTarget === "between_end" ? "border-accent bg-field-selected-bg" : "border-field-outer bg-white"
              }`}
            >
              To (end)
            </button>
          </div>
        )}

        {plan.kind === "number_binary" && (
          <div className="mt-2 flex flex-wrap items-center gap-2 border-b border-border-soft pb-2">
            <span className="text-[10px] font-medium text-muted">Second value</span>
            <label className="flex items-center gap-1.5 text-[10px] text-ink">
              <input
                type="radio"
                name={`calc-right-${field.id}`}
                checked={plan.rightMode === "field"}
                onChange={() => setPlan({ ...plan, rightMode: "field" })}
                className="size-3.5 text-accent"
              />
              Field
            </label>
            <label className="flex items-center gap-1.5 text-[10px] text-ink">
              <input
                type="radio"
                name={`calc-right-${field.id}`}
                checked={plan.rightMode === "constant"}
                onChange={() => setPlan({ ...plan, rightMode: "constant" })}
                className="size-3.5 text-accent"
              />
              Number
            </label>
            {plan.rightMode === "constant" ? (
              <input
                type="number"
                step="any"
                className={`${selectClass} max-w-[6rem]`}
                value={plan.rightConstant}
                onChange={(e) => setPlan({ ...plan, rightConstant: Number.parseFloat(e.target.value) || 0 })}
              />
            ) : (
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setPickTarget("num_left")}
                  className={`rounded-md border px-2 py-1 text-[10px] font-semibold ${
                    pickTarget === "num_left" ? "border-accent bg-field-selected-bg" : "border-field-outer bg-white"
                  }`}
                >
                  First
                </button>
                <button
                  type="button"
                  onClick={() => setPickTarget("num_right")}
                  className={`rounded-md border px-2 py-1 text-[10px] font-semibold ${
                    pickTarget === "num_right" ? "border-accent bg-field-selected-bg" : "border-field-outer bg-white"
                  }`}
                >
                  Second
                </button>
              </div>
            )}
          </div>
        )}

        {plan.kind === "custom" && (
          <textarea
            value={plan.expression}
            onChange={(e) => setPlan({ kind: "custom", expression: e.target.value })}
            rows={3}
            placeholder="Expression…"
            className="mt-2 w-full resize-y rounded-lg border border-field-outer bg-white px-2 py-2 font-mono text-[11px] text-ink outline-none focus:border-accent"
          />
        )}

        {emptyRight ? (
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-2 text-[10px] text-amber-950">
            {needsDates
              ? "Add at least one Date or Date & time field on the canvas."
              : "Add Number, Decimal, or another Calculated field for math."}
          </p>
        ) : (
          <ul className="mt-2 max-h-[11rem] min-h-0 flex-1 space-y-1 overflow-y-auto pr-0.5">
            {rightList.map((f) => {
              let active = false;
              if (plan.kind === "date_offset") active = plan.sourceFieldId === f.id;
              if (plan.kind === "days_between")
                active = plan.startFieldId === f.id || plan.endFieldId === f.id;
              if (plan.kind === "number_binary")
                active = plan.leftFieldId === f.id || (plan.rightMode === "field" && plan.rightFieldId === f.id);
              return (
                <li key={f.id}>
                  <button type="button" onClick={() => onFieldRowClick(f)} className={fieldBtnClass(active)}>
                    <span className="min-w-0 truncate font-medium">{f.label}</span>
                    <span className="shrink-0 rounded bg-zinc-100 px-1 py-px font-mono text-[9px] text-muted">{f.apiKey}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-2 shrink-0 rounded-md border border-dashed border-accent/30 bg-field-selected-bg/40 px-2 py-1.5">
          <p className="text-[10px] font-medium text-ink">Preview</p>
          <p className="mt-0.5 text-[11px] text-muted">{describeFormulaPlan(plan, list)}</p>
        </div>

        <div className="mt-1 space-y-0.5">
          <span className="text-[9px] font-medium uppercase tracking-wide text-muted">Stored expression</span>
          <pre className="max-h-16 overflow-auto whitespace-pre-wrap break-all rounded-md border border-field-outer bg-zinc-50 px-1.5 py-1 font-mono text-[9px] text-ink/90">
            {serializeFormulaExpression(plan, list) || "—"}
          </pre>
        </div>
      </div>
    </div>
  );
}
