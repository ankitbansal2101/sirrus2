import type { FieldDefinition } from "@/lib/fields-config/types";
import type { LeadRecord } from "@/lib/leads/types";
import {
  compactLead,
  inferFiltersFromIntent,
  leadMatchesAll,
  resolveField,
  type CompactLead,
  type LeadQueryFilter,
} from "@/lib/leads/agent/lead-match";

export type LeadQueryOperation = "count" | "list" | "aggregate" | "find";

export type LeadQueryInput = {
  operation: LeadQueryOperation;
  intent?: string;
  filters?: LeadQueryFilter[];
  groupBy?: string;
  limit?: number;
};

export type LeadQueryResult = {
  success: boolean;
  operation: "query";
  kind: LeadQueryOperation;
  total: number;
  matched: number;
  intent?: string;
  filtersApplied: LeadQueryFilter[];
  leads?: CompactLead[];
  truncated?: boolean;
  groupBy?: string;
  groups?: { value: string; count: number }[];
  error?: string;
  summary: string;
};

function isRecord(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

function parseFilters(raw: unknown): LeadQueryFilter[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((f): f is Record<string, unknown> => isRecord(f) && typeof f.field === "string")
    .map((f) => ({
      field: f.field as string,
      op: typeof f.op === "string" ? (f.op as LeadQueryFilter["op"]) : "eq",
      value: typeof f.value === "string" ? f.value : "",
    }));
}

export function parseLeadQueryInput(raw: unknown): LeadQueryInput {
  if (!isRecord(raw)) return { operation: "count", intent: "" };
  const op = raw.operation;
  const operation: LeadQueryOperation =
    op === "list" || op === "aggregate" || op === "find" || op === "count" ? op : "count";
  return {
    operation,
    intent: typeof raw.intent === "string" ? raw.intent : "",
    filters: parseFilters(raw.filters),
    groupBy: typeof raw.groupBy === "string" ? raw.groupBy : undefined,
    limit: typeof raw.limit === "number" ? raw.limit : undefined,
  };
}

function inferOperation(intent: string, fallback: LeadQueryOperation): LeadQueryOperation {
  const t = intent.toLowerCase();
  if (/\b(how many|count|number of|total)\b/.test(t)) return "count";
  if (/\b(breakdown|group by|by stage|per stage|distribution)\b/.test(t)) return "aggregate";
  if (/\b(who is|find|look up|show me|list|which leads)\b/.test(t)) return fallback === "count" ? "list" : fallback;
  return fallback;
}

export function queryLeads(
  input: LeadQueryInput,
  leads: LeadRecord[],
  fields: FieldDefinition[],
): LeadQueryResult {
  const intent = input.intent?.trim() ?? "";
  const operation = inferOperation(intent, input.operation);
  const explicit = input.filters?.length ? input.filters : [];
  const inferred = explicit.length ? [] : inferFiltersFromIntent(intent, fields, leads);
  const filters = explicit.length ? explicit : inferred;

  const matchedLeads = leads.filter((l) => leadMatchesAll(l, fields, filters));
  const total = leads.length;
  const matched = matchedLeads.length;

  if (operation === "aggregate") {
    const groupHint = input.groupBy || (/\bstage\b/i.test(intent) ? "stage" : "");
    const resolved = resolveField(fields, groupHint || "stage");
    if (!resolved || resolved.kind !== "field") {
      return {
        success: false,
        operation: "query",
        kind: "aggregate",
        total,
        matched,
        intent,
        filtersApplied: filters,
        error: `Cannot group by "${groupHint || "unknown"}". Use a lead field such as stage, source, or assigned_to.`,
        summary: "Aggregation failed — unknown group-by field.",
      };
    }
    const counts = new Map<string, number>();
    for (const lead of matchedLeads) {
      const label = compactLead(lead, fields).fields[resolved.field.apiKey] || "(empty)";
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    const groups = [...counts.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);
    return {
      success: true,
      operation: "query",
      kind: "aggregate",
      total,
      matched,
      intent,
      filtersApplied: filters,
      groupBy: resolved.field.apiKey,
      groups,
      summary: `Grouped ${matched} of ${total} leads by ${resolved.field.label}.`,
    };
  }

  const limit = Math.min(Math.max(input.limit ?? (operation === "find" ? 5 : 25), 1), 50);
  const slice = matchedLeads.slice(0, operation === "count" ? 0 : limit);
  const compact = slice.map((l) => compactLead(l, fields));

  if (operation === "count") {
    return {
      success: true,
      operation: "query",
      kind: "count",
      total,
      matched,
      intent,
      filtersApplied: filters,
      summary: filters.length
        ? `${matched} of ${total} leads match the filters.`
        : `There are ${total} leads.`,
    };
  }

  return {
    success: true,
    operation: "query",
    kind: operation,
    total,
    matched,
    intent,
    filtersApplied: filters,
    leads: compact,
    truncated: matched > compact.length,
    summary:
      matched === 0
        ? `No leads matched. There are ${total} leads in total.`
        : `Found ${matched} of ${total} leads${matched > compact.length ? ` (showing ${compact.length})` : ""}.`,
  };
}
