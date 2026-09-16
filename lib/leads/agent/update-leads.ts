import type { FieldDefinition } from "@/lib/fields-config/types";
import type { LeadRecord } from "@/lib/leads/types";
import {
  cloneLeads,
  compactLead,
  inferFiltersFromIntent,
  leadMatchesAll,
  resolveField,
  resolveStoredValue,
  type CompactLead,
  type LeadQueryFilter,
} from "@/lib/leads/agent/lead-match";

export type LeadFieldUpdate = {
  field: string;
  value: string;
};

export type LeadUpdateInput = {
  intent?: string;
  leadId?: string;
  displayId?: string;
  name?: string;
  filters?: LeadQueryFilter[];
  updates: LeadFieldUpdate[];
};

export type LeadUpdateResult = {
  success: boolean;
  operation: "update";
  changed: boolean;
  matched: number;
  updated: CompactLead[];
  leads: LeadRecord[] | null;
  error?: string;
  summary: string;
  warnings: string[];
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

export function parseLeadUpdateInput(raw: unknown): LeadUpdateInput {
  if (!isRecord(raw)) return { updates: [] };
  const updatesRaw = Array.isArray(raw.updates) ? raw.updates : [];
  const updates: LeadFieldUpdate[] = updatesRaw
    .filter((u): u is Record<string, unknown> => isRecord(u) && typeof u.field === "string")
    .map((u) => ({ field: String(u.field), value: typeof u.value === "string" ? u.value : String(u.value ?? "") }));
  return {
    intent: typeof raw.intent === "string" ? raw.intent : "",
    leadId: typeof raw.leadId === "string" ? raw.leadId : undefined,
    displayId: typeof raw.displayId === "string" ? raw.displayId : undefined,
    name: typeof raw.name === "string" ? raw.name : undefined,
    filters: parseFilters(raw.filters),
    updates,
  };
}

function findTargets(
  input: LeadUpdateInput,
  leads: LeadRecord[],
  fields: FieldDefinition[],
  selectedLeadId?: string | null,
): { targets: LeadRecord[]; error?: string } {
  const leadId = input.leadId?.trim();
  if (leadId) {
    const hit = leads.filter((l) => l.id === leadId);
    return hit.length ? { targets: hit } : { targets: [], error: `No lead found with id ${leadId}.` };
  }
  const displayId = input.displayId?.trim();
  if (displayId) {
    const needle = displayId.toLowerCase();
    const hit = leads.filter((l) => l.displayId.toLowerCase() === needle);
    return hit.length ? { targets: hit } : { targets: [], error: `No lead found with lead id ${displayId}.` };
  }
  const name = input.name?.trim();
  if (name) {
    const needle = name.toLowerCase();
    const hit = leads.filter((l) => (l.values.lead_name ?? "").toLowerCase().includes(needle));
    if (!hit.length) return { targets: [], error: `No lead named like "${name}".` };
    if (hit.length > 1) {
      const names = hit.map((l) => `${l.values.lead_name} (${l.displayId})`).join(", ");
      return { targets: [], error: `Multiple leads match "${name}": ${names}. Be more specific.` };
    }
    return { targets: hit };
  }

  const explicit = input.filters?.length ? input.filters : [];
  const inferred = explicit.length ? [] : inferFiltersFromIntent(input.intent ?? "", fields, leads);
  const filters = explicit.length ? explicit : inferred;

  if (filters.length) {
    const hit = leads.filter((l) => leadMatchesAll(l, fields, filters));
    if (!hit.length) return { targets: [], error: "No leads matched those filters." };
    return { targets: hit };
  }

  if (selectedLeadId) {
    const hit = leads.filter((l) => l.id === selectedLeadId);
    if (hit.length) return { targets: hit };
  }

  return {
    targets: [],
    error: "Say which lead to update (name, lead id, or filters). Open a lead in the list to update the selected one.",
  };
}

export function updateLeads(
  input: LeadUpdateInput,
  leads: LeadRecord[],
  fields: FieldDefinition[],
  selectedLeadId?: string | null,
): LeadUpdateResult {
  if (!input.updates.length) {
    return {
      success: false,
      operation: "update",
      changed: false,
      matched: 0,
      updated: [],
      leads: null,
      error: "No field updates were provided.",
      summary: "Update failed — missing field values.",
      warnings: [],
    };
  }

  const { targets, error } = findTargets(input, leads, fields, selectedLeadId);
  if (error || !targets.length) {
    return {
      success: false,
      operation: "update",
      changed: false,
      matched: 0,
      updated: [],
      leads: null,
      error: error ?? "No matching leads.",
      summary: error ?? "No matching leads.",
      warnings: [],
    };
  }

  const resolvedUpdates: { apiKey: string; label: string; value: string }[] = [];
  const warnings: string[] = [];
  for (const u of input.updates) {
    const resolved = resolveField(fields, u.field);
    if (!resolved || resolved.kind !== "field") {
      return {
        success: false,
        operation: "update",
        changed: false,
        matched: targets.length,
        updated: [],
        leads: null,
        error: `Unknown field "${u.field}". Use a field from the lead catalog.`,
        summary: `Unknown field ${u.field}.`,
        warnings,
      };
    }
    if (resolved.field.dataType === "formula" || resolved.field.locked && resolved.field.apiKey === "id") {
      return {
        success: false,
        operation: "update",
        changed: false,
        matched: targets.length,
        updated: [],
        leads: null,
        error: `${resolved.field.label} cannot be edited.`,
        summary: "That field is not editable.",
        warnings,
      };
    }
    const stored = resolveStoredValue(resolved.field, u.value);
    if (!stored.ok) {
      return {
        success: false,
        operation: "update",
        changed: false,
        matched: targets.length,
        updated: [],
        leads: null,
        error: stored.error,
        summary: stored.error,
        warnings,
      };
    }
    if (resolved.field.apiKey === "stage") {
      warnings.push("Stage was written directly. Blueprint transition automations were not run.");
    }
    resolvedUpdates.push({ apiKey: resolved.field.apiKey, label: resolved.field.label, value: stored.value });
  }

  const next = cloneLeads(leads);
  const now = new Date().toISOString();
  const targetIds = new Set(targets.map((t) => t.id));
  const updated: CompactLead[] = [];

  for (const lead of next) {
    if (!targetIds.has(lead.id)) continue;
    for (const u of resolvedUpdates) {
      lead.values[u.apiKey] = u.value;
    }
    lead.updatedAt = now;
    updated.push(compactLead(lead, fields));
  }

  const fieldLabels = resolvedUpdates.map((u) => u.label).join(", ");
  return {
    success: true,
    operation: "update",
    changed: true,
    matched: updated.length,
    updated,
    leads: next,
    summary: `Updated ${fieldLabels} on ${updated.length} lead${updated.length === 1 ? "" : "s"}.`,
    warnings,
  };
}
