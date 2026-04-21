import { syncConditionShape } from "@/lib/leads/evaluate-lead-filters";
import {
  defaultOperatorForKind,
  filterFieldKind,
  filterableFields,
} from "@/lib/leads/lead-filter-operators";
import type { LeadFilterCondition, LeadFilterConfig } from "@/lib/leads/lead-filter-types";
import type { FieldDefinition } from "@/lib/fields-config/types";

/** UI state for one schema field in the Zoho-style filter panel. */
export type PerFieldFilterRow = {
  enabled: boolean;
  operator: string;
  value: string;
  value2: string;
};

export type PerFieldFilterStateMap = Record<string, PerFieldFilterRow>;

function stableCondId(apiKey: string): string {
  return `cond_${apiKey}`;
}

export function emptyRowForField(field: FieldDefinition): PerFieldFilterRow {
  const kind = filterFieldKind(field);
  return {
    enabled: false,
    operator: defaultOperatorForKind(kind),
    value: "",
    value2: "",
  };
}

export function buildEmptyPerFieldState(filterableFieldList: FieldDefinition[]): PerFieldFilterStateMap {
  const m: PerFieldFilterStateMap = {};
  for (const f of filterableFieldList) {
    m[f.apiKey] = emptyRowForField(f);
  }
  return m;
}

/** Hydrate checkbox map from persisted/applied `LeadFilterConfig`. */
export function perFieldStateFromConfig(
  config: LeadFilterConfig | null,
  filterableFieldList: FieldDefinition[],
  allFields: FieldDefinition[],
): PerFieldFilterStateMap {
  const m = buildEmptyPerFieldState(filterableFieldList);
  if (!config) return m;
  for (const c of config.conditions) {
    if (!m[c.fieldApiKey]) continue;
    const def = allFields.find((f) => f.apiKey === c.fieldApiKey);
    const base: LeadFilterCondition = {
      id: stableCondId(c.fieldApiKey),
      fieldApiKey: c.fieldApiKey,
      operator: c.operator,
      value: c.value ?? "",
      value2: c.value2 ?? "",
    };
    const synced = def ? syncConditionShape(base, def) : base;
    m[c.fieldApiKey] = {
      enabled: true,
      operator: synced.operator,
      value: synced.value,
      value2: synced.value2,
    };
  }
  return m;
}

/** Build `LeadFilterConfig` from the per-field map (only checked fields). */
export function configFromPerFieldState(
  states: PerFieldFilterStateMap,
  filterableFieldList: FieldDefinition[],
): LeadFilterConfig {
  const conditions: LeadFilterCondition[] = [];
  for (const f of filterableFieldList) {
    const s = states[f.apiKey];
    if (!s?.enabled) continue;
    const base: LeadFilterCondition = {
      id: stableCondId(f.apiKey),
      fieldApiKey: f.apiKey,
      operator: s.operator,
      value: s.value,
      value2: s.value2,
    };
    const synced = syncConditionShape(base, f);
    conditions.push(synced);
  }
  return { conditions };
}

export function filterableFieldsSorted(fields: FieldDefinition[]): FieldDefinition[] {
  const ff = filterableFields(fields);
  return [...ff].sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
}
