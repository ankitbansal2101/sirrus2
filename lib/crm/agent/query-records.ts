import { displayFieldValue, recordTitle } from "@/lib/crm/display";
import type { CrmModule, CrmRecord, CrmWorkspace } from "@/lib/crm/types";

export type RecordQueryOperation = "count" | "list" | "aggregate";

export type RecordQueryFilter = {
  field: string;
  value: string;
};

export type CompactRecord = {
  module: string;
  id: string;
  displayId: string;
  name: string;
  values: Record<string, string>;
};

function resolveField(mod: CrmModule, ref: string) {
  const needle = ref.trim().toLowerCase();
  return mod.fields.find((f) => f.id === ref || f.apiKey.toLowerCase() === needle || f.label.toLowerCase() === needle);
}

export function compactRecord(mod: CrmModule, rec: CrmRecord): CompactRecord {
  const values: Record<string, string> = {};
  for (const f of mod.fields) {
    values[f.apiKey] = displayFieldValue(f, rec.values[f.apiKey]);
  }
  return {
    module: mod.apiKey,
    id: rec.id,
    displayId: rec.displayId,
    name: recordTitle(mod, rec),
    values,
  };
}

function fieldMatches(mod: CrmModule, rec: CrmRecord, fieldRef: string, value: string): boolean {
  const field = resolveField(mod, fieldRef);
  if (!field) return false;
  const needle = value.trim().toLowerCase();
  if (!needle) return true;
  const raw = (rec.values[field.apiKey] ?? "").toLowerCase();
  const display = displayFieldValue(field, rec.values[field.apiKey]).toLowerCase();
  return raw === needle || display === needle || display.includes(needle) || raw.includes(needle);
}

function recordContains(mod: CrmModule, rec: CrmRecord, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  if (rec.displayId.toLowerCase().includes(needle)) return true;
  if (recordTitle(mod, rec).toLowerCase().includes(needle)) return true;
  return mod.fields.some((f) => displayFieldValue(f, rec.values[f.apiKey]).toLowerCase().includes(needle));
}

function matches(mod: CrmModule, rec: CrmRecord, contains: string, filters: RecordQueryFilter[]): boolean {
  if (contains && !recordContains(mod, rec, contains)) return false;
  return filters.every((f) => fieldMatches(mod, rec, f.field, f.value));
}

export function queryModuleRecords(
  mod: CrmModule,
  input: {
    operation: RecordQueryOperation;
    contains?: string;
    filters?: RecordQueryFilter[];
    groupBy?: string;
    limit?: number;
  },
) {
  const contains = input.contains?.trim() ?? "";
  const filters = input.filters ?? [];
  const matched = mod.records.filter((r) => matches(mod, r, contains, filters));
  const limit = Math.min(Math.max(input.limit ?? 25, 1), 100);
  const operation = input.operation;

  if (operation === "aggregate") {
    const groupRef = input.groupBy?.trim() || mod.stageFieldApiKey || mod.nameFieldApiKey;
    const field = resolveField(mod, groupRef || "") ?? mod.fields.find((f) => f.apiKey === mod.stageFieldApiKey);
    const groups = new Map<string, number>();
    for (const rec of matched) {
      const label = field ? displayFieldValue(field, rec.values[field.apiKey]) : "(none)";
      groups.set(label, (groups.get(label) ?? 0) + 1);
    }
    const groupRows = [...groups.entries()].map(([value, count]) => ({ value, count }));
    return {
      success: true as const,
      operation,
      module: mod.apiKey,
      total: mod.records.length,
      matched: matched.length,
      groupBy: field?.label ?? groupRef,
      groups: groupRows,
      summary: `${matched.length} of ${mod.records.length} ${mod.pluralLabel.toLowerCase()}${field ? ` grouped by ${field.label}` : ""}.`,
    };
  }

  if (operation === "count") {
    return {
      success: true as const,
      operation,
      module: mod.apiKey,
      total: mod.records.length,
      matched: matched.length,
      summary: contains || filters.length
        ? `${matched.length} of ${mod.records.length} ${mod.pluralLabel.toLowerCase()} match.`
        : `${mod.records.length} ${mod.pluralLabel.toLowerCase()}.`,
    };
  }

  const records = matched.slice(0, limit).map((r) => compactRecord(mod, r));
  return {
    success: true as const,
    operation,
    module: mod.apiKey,
    total: mod.records.length,
    matched: matched.length,
    truncated: matched.length > records.length,
    records,
    summary: `Showing ${records.length} of ${matched.length} matching ${mod.pluralLabel.toLowerCase()} (${mod.records.length} total).`,
  };
}

export function queryWorkspaceRecords(
  ws: CrmWorkspace,
  input: {
    operation: RecordQueryOperation;
    contains?: string;
    filters?: RecordQueryFilter[];
    groupBy?: string;
    limit?: number;
  },
) {
  const byModule = ws.modules.map((mod) => {
    const result = queryModuleRecords(mod, { ...input, limit: input.limit ?? 8 });
    return {
      module: mod.apiKey,
      label: mod.pluralLabel,
      total: result.total,
      matched: result.matched,
      records: "records" in result ? result.records : undefined,
      groups: "groups" in result ? result.groups : undefined,
    };
  });
  const matched = byModule.reduce((n, row) => n + row.matched, 0);
  const total = byModule.reduce((n, row) => n + row.total, 0);
  return {
    success: true as const,
    operation: input.operation,
    total,
    matched,
    modules: byModule,
    summary: `${matched} matching records across ${ws.modules.length} module(s) (${total} total).`,
  };
}
