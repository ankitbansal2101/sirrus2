import type { FieldDataType, FieldDefinition } from "@/lib/fields-config/types";
import { FIELD_DATA_TYPES } from "@/lib/fields-config/types";
import { schedulePrototypeDiskPush } from "@/lib/prototype-persist/push";

/** v2: bump breaks stale short schemas in localStorage so the full default field set loads again. */
export const FIELDS_SCHEMA_STORAGE_KEY = "sirrus2_fields_schema_v2";

/** Legacy key — only used to remove old data when clearing schema. */
export const LEGACY_FIELDS_SCHEMA_STORAGE_KEY = "sirrus2_fields_schema_v1";

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
      schedulePrototypeDiskPush();
    }
    return true;
  } catch {
    return false;
  }
}

/** Clears saved layout so the app uses `createDefaultLeadFields()` until the user saves again. */
export function clearSavedFieldsSchema(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(FIELDS_SCHEMA_STORAGE_KEY);
    localStorage.removeItem(LEGACY_FIELDS_SCHEMA_STORAGE_KEY);
    window.dispatchEvent(new Event(FIELDS_SCHEMA_CHANGED_EVENT));
    schedulePrototypeDiskPush();
  } catch {
    /* ignore */
  }
}

function coerceDataType(raw: string): FieldDataType {
  return FIELD_DATA_TYPES.includes(raw as FieldDataType) ? (raw as FieldDataType) : "text";
}

export function normalizeLoadedFields(rows: FieldDefinition[]): FieldDefinition[] {
  return rows.map((f) => {
    const dataType = coerceDataType(f.dataType as string);
    const maxDigitsRaw =
      typeof f.maxDigits === "number" && Number.isFinite(f.maxDigits) && f.maxDigits > 0
        ? Math.min(50, Math.floor(f.maxDigits))
        : undefined;
    const decimalPlacesRaw =
      typeof f.decimalPlaces === "number" && Number.isFinite(f.decimalPlaces) && f.decimalPlaces >= 0
        ? Math.min(20, Math.floor(f.decimalPlaces))
        : undefined;
    const maxDigits = dataType === "number" || dataType === "decimal" ? maxDigitsRaw : undefined;
    const decimalPlaces = dataType === "decimal" ? decimalPlacesRaw : undefined;
    return {
      ...f,
      dataType,
      options: Array.isArray(f.options) ? f.options : [],
      defaultOptionIds: Array.isArray(f.defaultOptionIds) ? f.defaultOptionIds : [],
      orderPreference: f.orderPreference ?? "manual",
      formulaExpression: typeof f.formulaExpression === "string" ? f.formulaExpression : "",
      maxDigits,
      decimalPlaces,
      includeInFilters: typeof f.includeInFilters === "boolean" ? f.includeInFilters : true,
    };
  });
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
