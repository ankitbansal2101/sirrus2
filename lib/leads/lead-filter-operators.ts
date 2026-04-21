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

const PICKLIST_OPS: OperatorMeta[] = [
  { id: "eq", label: "is", needsValue: true, needsValue2: false },
  { id: "neq", label: "is not", needsValue: true, needsValue2: false },
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
  { id: "num_eq", label: "=", needsValue: true, needsValue2: false },
  { id: "num_neq", label: "≠", needsValue: true, needsValue2: false },
  { id: "lt", label: "<", needsValue: true, needsValue2: false },
  { id: "lte", label: "≤", needsValue: true, needsValue2: false },
  { id: "gt", label: ">", needsValue: true, needsValue2: false },
  { id: "gte", label: "≥", needsValue: true, needsValue2: false },
  { id: "between", label: "between", needsValue: true, needsValue2: true },
  { id: "not_between", label: "not between", needsValue: true, needsValue2: true },
  { id: "empty", label: "is empty", needsValue: false, needsValue2: false },
  { id: "not_empty", label: "is not empty", needsValue: false, needsValue2: false },
];

const DATE_OPS: OperatorMeta[] = [
  { id: "on", label: "on", needsValue: true, needsValue2: false },
  { id: "before", label: "before", needsValue: true, needsValue2: false },
  { id: "after", label: "after", needsValue: true, needsValue2: false },
  { id: "between", label: "between", needsValue: true, needsValue2: true },
  { id: "not_between", label: "not between", needsValue: true, needsValue2: true },
  { id: "today", label: "today", needsValue: false, needsValue2: false },
  { id: "yesterday", label: "yesterday", needsValue: false, needsValue2: false },
  { id: "tomorrow", label: "tomorrow", needsValue: false, needsValue2: false },
  { id: "this_week", label: "this week", needsValue: false, needsValue2: false },
  { id: "this_month", label: "this month", needsValue: false, needsValue2: false },
  { id: "next_week", label: "next week", needsValue: false, needsValue2: false },
  { id: "next_month", label: "next month", needsValue: false, needsValue2: false },
  { id: "prev_week", label: "previous week", needsValue: false, needsValue2: false },
  { id: "prev_month", label: "previous month", needsValue: false, needsValue2: false },
  { id: "empty", label: "is empty", needsValue: false, needsValue2: false },
  { id: "not_empty", label: "is not empty", needsValue: false, needsValue2: false },
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
  return operatorsForKind(kind).find((o) => o.id === operatorId);
}

export function defaultOperatorForKind(kind: LeadFilterFieldKind): string {
  const list = operatorsForKind(kind);
  return list[0]?.id ?? "eq";
}

/** Fields that can appear in the filter builder (schema flag + supported kind). */
export function filterableFields(fields: FieldDefinition[]): FieldDefinition[] {
  return fields.filter((f) => f.includeInFilters !== false);
}
