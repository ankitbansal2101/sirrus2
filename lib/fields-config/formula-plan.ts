import type { FormulaPlan } from "@/lib/fields-config/formula-types";
import type { FieldDataType, FieldDefinition } from "@/lib/fields-config/types";
import { defaultFormulaPlan } from "@/lib/fields-config/formula-types";

/**
 * v1 serialized `formulaExpression` shapes (for a future evaluator):
 * - DATEADD(<apiKey>, <signedInt>, DAY)
 * - DAYS_BETWEEN(<apiKeyStart>, <apiKeyEnd>)
 * - NUMBIN(<leftApi>,<op>,<rightApi>|<number>)
 * - custom: free-form text
 */
export type { FormulaPlan } from "@/lib/fields-config/formula-types";

export const FORMULA_KIND_LABELS: Record<FormulaPlan["kind"], string> = {
  date_offset: "Shift a date",
  days_between: "Days between two dates",
  number_binary: "Number math",
  custom: "Write your own",
};

function apiKeyById(list: FieldDefinition[], id: string): string {
  return list.find((f) => f.id === id)?.apiKey ?? "";
}

export function serializeFormulaExpression(plan: FormulaPlan, list: FieldDefinition[]): string {
  if (!list?.length) return "";
  switch (plan.kind) {
    case "date_offset": {
      const k = apiKeyById(list, plan.sourceFieldId);
      if (!k) return "";
      return `DATEADD(${k}, ${plan.daysDelta}, DAY)`;
    }
    case "days_between": {
      const a = apiKeyById(list, plan.startFieldId);
      const b = apiKeyById(list, plan.endFieldId);
      if (!a || !b) return "";
      return `DAYS_BETWEEN(${a}, ${b})`;
    }
    case "number_binary": {
      const L = apiKeyById(list, plan.leftFieldId);
      if (!L) return "";
      if (plan.rightMode === "constant") {
        return `NUMBIN(${L},${plan.op},${plan.rightConstant})`;
      }
      const R = apiKeyById(list, plan.rightFieldId);
      if (!R) return "";
      return `NUMBIN(${L},${plan.op},${R})`;
    }
    case "custom":
      return plan.expression.trim();
    default:
      return "";
  }
}

export function describeFormulaPlan(plan: FormulaPlan, list: FieldDefinition[]): string {
  const rows = list ?? [];
  const name = (id: string) => rows.find((f) => f.id === id)?.label ?? "—";
  switch (plan.kind) {
    case "date_offset": {
      if (!plan.sourceFieldId) return "Pick a date field, then set how many days to add or subtract.";
      const n = plan.daysDelta;
      if (n === 0) return `Same day as “${name(plan.sourceFieldId)}”.`;
      if (n < 0) return `“${name(plan.sourceFieldId)}” minus ${Math.abs(n)} day(s).`;
      return `“${name(plan.sourceFieldId)}” plus ${n} day(s).`;
    }
    case "days_between":
      if (!plan.startFieldId || !plan.endFieldId) return "Pick two date fields.";
      return `Days from “${name(plan.startFieldId)}” to “${name(plan.endFieldId)}”.`;
    case "number_binary": {
      if (!plan.leftFieldId) return "Pick a number field to start from.";
      if (plan.rightMode === "constant") {
        return `“${name(plan.leftFieldId)}” ${plan.op} ${plan.rightConstant}.`;
      }
      if (!plan.rightFieldId) return "Pick a second number field.";
      return `“${name(plan.leftFieldId)}” ${plan.op} “${name(plan.rightFieldId)}”.`;
    }
    case "custom":
      return plan.expression.trim() ? "Custom expression." : "Write an expression in the box below.";
    default:
      return "";
  }
}

export { defaultFormulaPlan } from "@/lib/fields-config/formula-types";

export function resolveFormulaPlan(field: FieldDefinition): FormulaPlan {
  if (field.formulaPlan) return field.formulaPlan;
  if (field.formulaExpression.trim()) return { kind: "custom", expression: field.formulaExpression };
  return defaultFormulaPlan();
}

export function isDateLike(t: FieldDataType): boolean {
  return t === "date" || t === "date_time";
}

export function isNumericLike(t: FieldDataType): boolean {
  return t === "number" || t === "decimal" || t === "formula";
}

export function referenceableFields(list: FieldDefinition[], excludeId: string): FieldDefinition[] {
  if (!Array.isArray(list)) return [];
  return list.filter((f) => f.id !== excludeId);
}
