import type { LeadFieldOption } from "@/lib/blueprint/types";
import { loadFieldsSchema } from "@/lib/fields-config/schema-storage";
import type { FieldDefinition } from "@/lib/fields-config/types";
import { createDefaultLeadFields, optionsSorted, usesOptions } from "@/lib/fields-config/types";

/** Same storage key / event as Fields configurator — keep in sync. */
export {
  FIELDS_SCHEMA_CHANGED_EVENT,
  FIELDS_SCHEMA_STORAGE_KEY,
} from "@/lib/fields-config/schema-storage";

export function resolveFieldDefinitions(): FieldDefinition[] {
  if (typeof window === "undefined") {
    return createDefaultLeadFields();
  }
  return loadFieldsSchema() ?? createDefaultLeadFields();
}

/** Picklists / radios / multi-selects that have at least one option (candidate “stage” columns). */
export function listFieldsWithOptionChoices(fields: FieldDefinition[]): FieldDefinition[] {
  return fields.filter((f) => usesOptions(f.dataType) && f.options.length > 0);
}

/**
 * Which field’s picklist options drive the blueprint “Available stages” palette.
 * `hint` is usually `BlueprintDocument.stageField` — may be apiKey, field id, or visible label.
 */
export function resolveStageField(fields: FieldDefinition[], hint?: string | null): FieldDefinition | undefined {
  const h = hint?.trim();
  if (h) {
    const byApi = fields.find((f) => f.apiKey === h || f.apiKey.toLowerCase() === h.toLowerCase());
    if (byApi && usesOptions(byApi.dataType) && byApi.options.length > 0) return byApi;

    const byLabel = fields.find((f) => f.label.trim().toLowerCase() === h.toLowerCase());
    if (byLabel && usesOptions(byLabel.dataType) && byLabel.options.length > 0) return byLabel;

    const byId = fields.find((f) => f.id === h);
    if (byId && usesOptions(byId.dataType) && byId.options.length > 0) return byId;
  }

  return (
    fields.find((f) => f.apiKey.toLowerCase() === "stage" && usesOptions(f.dataType) && f.options.length > 0) ??
    fields.find((f) => usesOptions(f.dataType) && /^stage$/i.test(f.label.trim()) && f.options.length > 0) ??
    fields.find((f) => usesOptions(f.dataType) && /stage/i.test(f.label) && f.options.length > 0)
  );
}

/** Stage names for the blueprint palette, in Fields configurator order (manual / alphabetical). */
export function fieldsToStagePaletteLabels(fields: FieldDefinition[], hint?: string | null): string[] {
  const sf = resolveStageField(fields, hint);
  if (sf && usesOptions(sf.dataType) && sf.options.length > 0) {
    return optionsSorted(sf).map((o) => o.label);
  }
  return [];
}

/** All lead fields for transition pickers — `id` is `apiKey` from the schema. */
export function fieldsToLeadFieldOptions(fields: FieldDefinition[]): LeadFieldOption[] {
  return fields.map((f) => ({ id: f.apiKey, label: f.label }));
}

export function buildFieldLabelLookup(fields: FieldDefinition[]): (apiKey: string) => string {
  const m = new Map(fields.map((f) => [f.apiKey, f.label]));
  return (apiKey) => m.get(apiKey) ?? apiKey;
}
