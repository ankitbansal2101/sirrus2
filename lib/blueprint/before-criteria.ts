import type { BlueprintCriterion, BlueprintCriterionOperator } from "@/lib/blueprint/types";
import type { FieldDefinition } from "@/lib/fields-config/types";

export function operatorsForField(field?: FieldDefinition): BlueprintCriterionOperator[] {
  if (!field) return ["is_empty", "is_not_empty", "equals", "not_equals"];
  switch (field.dataType) {
    case "number":
    case "decimal":
    case "date":
    case "date_time":
    case "formula":
      return ["is_empty", "is_not_empty", "equals", "not_equals", "greater_than", "greater_or_equal", "less_than", "less_or_equal"];
    case "multi_select":
      return ["is_empty", "is_not_empty", "includes", "does_not_include"];
    case "text":
    case "paragraph":
    case "email":
    case "phone":
    case "url":
      return ["is_empty", "is_not_empty", "equals", "not_equals", "contains", "not_contains"];
    default:
      return ["is_empty", "is_not_empty", "equals", "not_equals"];
  }
}

export const CRITERION_OPERATOR_LABELS: Record<BlueprintCriterionOperator, string> = {
  is_empty: "is empty", is_not_empty: "is not empty", equals: "is", not_equals: "is not",
  contains: "contains", not_contains: "does not contain", greater_than: "greater than",
  greater_or_equal: "greater than or equal to", less_than: "less than",
  less_or_equal: "less than or equal to", includes: "includes", does_not_include: "does not include",
};

export function criterionMatches(criterion: BlueprintCriterion, values: Record<string, string>, fields: FieldDefinition[]): boolean {
  const raw = values[criterion.fieldId] ?? "";
  const value = criterion.value;
  const field = fields.find((f) => f.apiKey === criterion.fieldId);
  const empty = raw.trim() === "";
  switch (criterion.operator) {
    case "is_empty": return empty;
    case "is_not_empty": return !empty;
    case "equals": return raw === value;
    case "not_equals": return raw !== value;
    case "contains": return raw.toLocaleLowerCase().includes(value.toLocaleLowerCase());
    case "not_contains": return !raw.toLocaleLowerCase().includes(value.toLocaleLowerCase());
    case "includes": return raw.split(",").map((x) => x.trim()).includes(value);
    case "does_not_include": return !raw.split(",").map((x) => x.trim()).includes(value);
    case "greater_than":
    case "greater_or_equal":
    case "less_than":
    case "less_or_equal": {
      if (empty || value === "") return false;
      const a = field?.dataType === "date" || field?.dataType === "date_time" ? Date.parse(raw) : Number(raw);
      const b = field?.dataType === "date" || field?.dataType === "date_time" ? Date.parse(value) : Number(value);
      if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
      if (criterion.operator === "greater_than") return a > b;
      if (criterion.operator === "greater_or_equal") return a >= b;
      if (criterion.operator === "less_than") return a < b;
      return a <= b;
    }
  }
}

export function transitionCriteriaMatch(criteria: BlueprintCriterion[] | undefined, values: Record<string, string>, fields: FieldDefinition[]): boolean {
  return (criteria ?? []).every((criterion) => criterionMatches(criterion, values, fields));
}
