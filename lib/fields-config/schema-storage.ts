import type { FieldDefinition } from "@/lib/fields-config/types";

export const FIELDS_SCHEMA_STORAGE_KEY = "sirrus2_fields_schema_v1";

/** Fired on `window` after a successful same-tab save so other screens (e.g. blueprint) can refresh. */
export const FIELDS_SCHEMA_CHANGED_EVENT = "sirrus2-fields-schema-changed";

function isFieldRow(x: unknown): x is FieldDefinition {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.label === "string" &&
    typeof o.dataType === "string" &&
    typeof o.apiKey === "string" &&
    Array.isArray(o.options)
  );
}

export function saveFieldsSchema(fields: FieldDefinition[]): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(FIELDS_SCHEMA_STORAGE_KEY, JSON.stringify(fields));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(FIELDS_SCHEMA_CHANGED_EVENT));
    }
    return true;
  } catch {
    return false;
  }
}

export function normalizeLoadedFields(rows: FieldDefinition[]): FieldDefinition[] {
  return rows.map((f) => ({
    ...f,
    options: Array.isArray(f.options) ? f.options : [],
    defaultOptionIds: Array.isArray(f.defaultOptionIds) ? f.defaultOptionIds : [],
    orderPreference: f.orderPreference ?? "manual",
    formulaExpression: typeof f.formulaExpression === "string" ? f.formulaExpression : "",
  }));
}

export function loadFieldsSchema(): FieldDefinition[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(FIELDS_SCHEMA_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    if (!parsed.every(isFieldRow)) return null;
    return normalizeLoadedFields(parsed as FieldDefinition[]);
  } catch {
    return null;
  }
}
