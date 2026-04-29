import type { FieldDefinition } from "@/lib/fields-config/types";

/** Internal grouping for operator + value UI. */
export type LeadFilterFieldKind = "text" | "picklist" | "multi_select" | "number" | "date";

export type OperatorMeta = {
  id: string;
  label: string;
  needsValue: boolean;
  needsValue2: boolean;
};

export function filterFieldKind(field: FieldDefinition): LeadFilterFieldKind {
  switch (field.dataType) {
    case "text":
    case "paragraph":
    case "email":
    case "phone":
    case "url":
    case "formula":
      return "text";
    case "picklist":
    case "radio":
      return "picklist";
    case "multi_select":
      return "multi_select";
    case "number":
    case "decimal":
      return "number";
    case "date":
    case "date_time":
      return "date";
    default:
      return "text";
  }
}

const TEXT_OPS: OperatorMeta[] = [
  { id: "eq", label: "is", needsValue: true, needsValue2: false },
  { id: "neq", label: "is not", needsValue: true, needsValue2: false },
  { id: "contains", label: "contains", needsValue: true, needsValue2: false },
  { id: "not_contains", label: "does not contain", needsValue: true, needsValue2: false },
  { id: "starts_with", label: "starts with", needsValue: true, needsValue2: false },
  { id: "ends_with", label: "ends with", needsValue: true, needsValue2: false },
  { id: "empty", label: "is empty", needsValue: false, needsValue2: false },
  { id: "not_empty", label: "is not empty", needsValue: false, needsValue2: false },
];

/** Picklist / radio: multi-select value (comma-separated option ids), per product spec. */
const PICKLIST_OPS: OperatorMeta[] = [
  { id: "eq", label: "is (multi-select)", needsValue: true, needsValue2: false },
  { id: "neq", label: "is not (multi-select)", needsValue: true, needsValue2: false },
  { id: "empty", label: "is empty", needsValue: false, needsValue2: false },
  { id: "not_empty", label: "is not empty", needsValue: false, needsValue2: false },
];

const MULTI_OPS: OperatorMeta[] = [
  { id: "contains_any", label: "contains any", needsValue: true, needsValue2: false },
  { id: "contains_all", label: "contains all", needsValue: true, needsValue2: false },
  { id: "not_contains", label: "does not contain", needsValue: true, needsValue2: false },
  { id: "empty", label: "is empty", needsValue: false, needsValue2: false },
  { id: "not_empty", label: "is not empty", needsValue: false, needsValue2: false },
];

const NUMBER_OPS: OperatorMeta[] = [
  { id: "num_eq", label: "equal to (=)", needsValue: true, needsValue2: false },
  { id: "num_neq", label: "not equal to (≠)", needsValue: true, needsValue2: false },
  { id: "gt", label: "greater than (>)", needsValue: true, needsValue2: false },
  { id: "gte", label: "greater than or equal to (≥)", needsValue: true, needsValue2: false },
  { id: "lt", label: "less than (<)", needsValue: true, needsValue2: false },
  { id: "lte", label: "less than or equal to (≤)", needsValue: true, needsValue2: false },
  { id: "between", label: "between", needsValue: true, needsValue2: true },
  { id: "empty", label: "is empty", needsValue: false, needsValue2: false },
  { id: "not_empty", label: "is not empty", needsValue: false, needsValue2: false },
];

const DATE_OPS: OperatorMeta[] = [
  { id: "on", label: "on", needsValue: true, needsValue2: false },
  { id: "before", label: "before", needsValue: true, needsValue2: false },
  { id: "after", label: "after", needsValue: true, needsValue2: false },
  { id: "on_or_before", label: "on or before", needsValue: true, needsValue2: false },
  { id: "on_or_after", label: "on or after", needsValue: true, needsValue2: false },
  { id: "between", label: "between", needsValue: true, needsValue2: true },
  { id: "today", label: "today", needsValue: false, needsValue2: false },
  { id: "yesterday", label: "yesterday", needsValue: false, needsValue2: false },
  { id: "last_7_days", label: "last 7 days", needsValue: false, needsValue2: false },
  { id: "last_30_days", label: "last 30 days", needsValue: false, needsValue2: false },
  { id: "next_7_days", label: "next 7 days", needsValue: false, needsValue2: false },
  { id: "next_30_days", label: "next 30 days", needsValue: false, needsValue2: false },
  { id: "this_year", label: "this year", needsValue: false, needsValue2: false },
  { id: "last_year", label: "last year", needsValue: false, needsValue2: false },
  { id: "this_month", label: "this month", needsValue: false, needsValue2: false },
  { id: "last_month", label: "last month", needsValue: false, needsValue2: false },
  { id: "last_n_days", label: "Last (n) days", needsValue: true, needsValue2: false },
  { id: "last_n_weeks", label: "Last (n) weeks", needsValue: true, needsValue2: false },
  { id: "last_n_months", label: "Last (n) months", needsValue: true, needsValue2: false },
  { id: "next_n_days", label: "Next (n) days", needsValue: true, needsValue2: false },
  { id: "next_n_weeks", label: "Next (n) weeks", needsValue: true, needsValue2: false },
  { id: "next_n_months", label: "Next (n) months", needsValue: true, needsValue2: false },
  { id: "empty", label: "is empty", needsValue: false, needsValue2: false },
  { id: "not_empty", label: "is not empty", needsValue: false, needsValue2: false },
];

/** Legacy / persisted operator ids still evaluated but not offered in the UI. */
const LEGACY_DATE_META: OperatorMeta[] = [
  { id: "not_between", label: "not between", needsValue: true, needsValue2: true },
  { id: "tomorrow", label: "tomorrow", needsValue: false, needsValue2: false },
  { id: "this_week", label: "this week", needsValue: false, needsValue2: false },
  { id: "next_week", label: "next week", needsValue: false, needsValue2: false },
  { id: "next_month", label: "next month", needsValue: false, needsValue2: false },
  { id: "prev_week", label: "previous week", needsValue: false, needsValue2: false },
  { id: "prev_month", label: "previous month", needsValue: false, needsValue2: false },
];

const LEGACY_NUMBER_META: OperatorMeta[] = [
  { id: "not_between", label: "not between", needsValue: true, needsValue2: true },
];

export function operatorsForKind(kind: LeadFilterFieldKind): OperatorMeta[] {
  switch (kind) {
    case "text":
      return TEXT_OPS;
    case "picklist":
      return PICKLIST_OPS;
    case "multi_select":
      return MULTI_OPS;
    case "number":
      return NUMBER_OPS;
    case "date":
      return DATE_OPS;
    default:
      return TEXT_OPS;
  }
}

export function operatorMeta(kind: LeadFilterFieldKind, operatorId: string): OperatorMeta | undefined {
  const primary = operatorsForKind(kind).find((o) => o.id === operatorId);
  if (primary) return primary;
  if (kind === "date") return LEGACY_DATE_META.find((o) => o.id === operatorId);
  if (kind === "number") return LEGACY_NUMBER_META.find((o) => o.id === operatorId);
  return undefined;
}

export function defaultOperatorForKind(kind: LeadFilterFieldKind): string {
  const list = operatorsForKind(kind);
  return list[0]?.id ?? "eq";
}

/** Fields that can appear in the filter builder (schema flag + supported kind). */
export function filterableFields(fields: FieldDefinition[]): FieldDefinition[] {
  return fields.filter((f) => f.includeInFilters !== false);
}

export function isRelativeNDateOperator(id: string): boolean {
  return (
    id === "last_n_days" ||
    id === "last_n_weeks" ||
    id === "last_n_months" ||
    id === "next_n_days" ||
    id === "next_n_weeks" ||
    id === "next_n_months"
  );
}
