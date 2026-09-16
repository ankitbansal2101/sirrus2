import type { FieldDefinition } from "@/lib/fields-config/types";
import { usesOptions } from "@/lib/fields-config/types";
import { formatLeadFieldValue } from "@/lib/leads/display-value";
import type { LeadRecord } from "@/lib/leads/types";

export type LeadFilterOp = "eq" | "neq" | "contains" | "starts_with" | "is_empty" | "is_not_empty";

export type LeadQueryFilter = {
  field: string;
  op?: LeadFilterOp;
  value?: string;
};

export type CompactLead = {
  id: string;
  displayId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  fields: Record<string, string>;
};

export type ResolvedField =
  | { kind: "meta"; key: "id" | "displayId" | "createdAt" | "updatedAt" }
  | { kind: "field"; field: FieldDefinition };

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function includesWord(haystack: string, needle: string): boolean {
  const n = needle.trim();
  if (!n) return false;
  const re = new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(n)}(?:$|[^a-z0-9])`, "i");
  return re.test(haystack);
}

export function compactFieldCatalog(fields: FieldDefinition[]) {
  return fields.map((f) => ({
    apiKey: f.apiKey,
    label: f.label,
    dataType: f.dataType,
    options: usesOptions(f.dataType) ? f.options.map((o) => ({ id: o.id, label: o.label })) : undefined,
  }));
}

export function compactLead(lead: LeadRecord, fields: FieldDefinition[]): CompactLead {
  const out: Record<string, string> = {};
  for (const f of fields) {
    out[f.apiKey] = formatLeadFieldValue(f, lead.values[f.apiKey]);
  }
  const nameField = fields.find((f) => f.apiKey === "lead_name");
  return {
    id: lead.id,
    displayId: lead.displayId,
    name: nameField ? formatLeadFieldValue(nameField, lead.values.lead_name) : (lead.values.lead_name ?? ""),
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,
    fields: out,
  };
}

export function resolveField(fields: FieldDefinition[], hint: string | undefined): ResolvedField | null {
  if (!hint?.trim()) return null;
  const n = norm(hint);

  if (["id", "lead_uuid", "record_id"].includes(n)) return { kind: "meta", key: "id" };
  if (["displayid", "display_id", "lead_id", "leadid", "ref", "reference"].includes(n)) {
    return { kind: "meta", key: "displayId" };
  }
  if (["createdat", "created_at", "created"].includes(n)) return { kind: "meta", key: "createdAt" };
  if (["updatedat", "updated_at", "updated"].includes(n)) return { kind: "meta", key: "updatedAt" };
  if (["name", "leadname", "lead_name"].includes(n)) {
    const name = fields.find((f) => f.apiKey === "lead_name");
    if (name) return { kind: "field", field: name };
  }

  const exact = fields.find((f) => norm(f.apiKey) === n || norm(f.label) === n || norm(f.id) === n);
  if (exact) return { kind: "field", field: exact };

  const partial = fields.find((f) => norm(f.label).includes(n) || n.includes(norm(f.label)) || norm(f.apiKey).includes(n));
  return partial ? { kind: "field", field: partial } : null;
}

function metaValue(lead: LeadRecord, key: "id" | "displayId" | "createdAt" | "updatedAt"): string {
  return lead[key] ?? "";
}

export function comparableValues(lead: LeadRecord, resolved: ResolvedField): string[] {
  if (resolved.kind === "meta") return [metaValue(lead, resolved.key)];
  const raw = lead.values[resolved.field.apiKey] ?? "";
  const display = formatLeadFieldValue(resolved.field, raw);
  const vals = [raw, display];
  if (usesOptions(resolved.field.dataType)) {
    const ids = resolved.field.dataType === "multi_select" ? raw.split(",").map((s) => s.trim()).filter(Boolean) : [raw];
    for (const id of ids) {
      const opt = (resolved.field.options ?? []).find((o) => o.id === id);
      if (opt) vals.push(opt.label, opt.value, opt.id);
    }
  }
  return [...new Set(vals.filter((v) => v && v !== "—"))];
}

export function rawFieldValue(lead: LeadRecord, resolved: ResolvedField): string {
  if (resolved.kind === "meta") return metaValue(lead, resolved.key);
  return lead.values[resolved.field.apiKey] ?? "";
}

export function leadMatchesFilter(lead: LeadRecord, fields: FieldDefinition[], filter: LeadQueryFilter): boolean {
  const resolved = resolveField(fields, filter.field);
  if (!resolved) return false;
  const op = filter.op ?? "eq";
  const raw = rawFieldValue(lead, resolved);
  if (op === "is_empty") return !raw.trim();
  if (op === "is_not_empty") return !!raw.trim();
  const needle = (filter.value ?? "").trim().toLowerCase();
  const hay = comparableValues(lead, resolved).map((v) => v.toLowerCase());
  if (op === "eq") return hay.some((v) => v === needle);
  if (op === "neq") return hay.every((v) => v !== needle);
  if (op === "contains") return hay.some((v) => v.includes(needle));
  if (op === "starts_with") return hay.some((v) => v.startsWith(needle));
  return false;
}

export function leadMatchesAll(lead: LeadRecord, fields: FieldDefinition[], filters: LeadQueryFilter[] | undefined): boolean {
  if (!filters?.length) return true;
  return filters.every((f) => leadMatchesFilter(lead, fields, f));
}

export function inferFiltersFromIntent(
  intent: string,
  fields: FieldDefinition[],
  leads: LeadRecord[],
): LeadQueryFilter[] {
  const text = intent.trim();
  if (!text) return [];
  const filters: LeadQueryFilter[] = [];
  const lower = text.toLowerCase();

  const displayMatch = text.match(/\bL\d{4,}\b/i);
  if (displayMatch) {
    filters.push({ field: "displayId", op: "eq", value: displayMatch[0] });
  }

  for (const f of fields) {
    if (!usesOptions(f.dataType)) continue;
    const hits = f.options.filter((o) => o.label.length >= 3 && includesWord(lower, o.label));
    if (hits.length === 1) {
      filters.push({ field: f.apiKey, op: "eq", value: hits[0].label });
    }
  }

  const nameField = fields.find((f) => f.apiKey === "lead_name");
  if (nameField) {
    const names = [...new Set(leads.map((l) => (l.values.lead_name ?? "").trim()).filter((n) => n.length >= 3))];
    names.sort((a, b) => b.length - a.length);
    for (const name of names) {
      if (includesWord(text, name)) {
        filters.push({ field: "lead_name", op: "contains", value: name });
        break;
      }
    }
  }

  return filters;
}

export function resolveStoredValue(
  field: FieldDefinition,
  userValue: string,
): { ok: true; value: string } | { ok: false; error: string } {
  const raw = userValue.trim();
  if (!usesOptions(field.dataType)) return { ok: true, value: raw };

  if (field.dataType === "multi_select") {
    if (!raw) return { ok: true, value: "" };
    const parts = raw.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
    const ids: string[] = [];
    for (const part of parts) {
      const opt = matchOption(field, part);
      if (!opt) {
        return {
          ok: false,
          error: `"${part}" is not a valid option for ${field.label}. Allowed: ${field.options.map((o) => o.label).join(", ")}.`,
        };
      }
      ids.push(opt.id);
    }
    return { ok: true, value: ids.join(",") };
  }

  if (!raw) return { ok: true, value: "" };
  const opt = matchOption(field, raw);
  if (!opt) {
    return {
      ok: false,
      error: `"${raw}" is not a valid option for ${field.label}. Allowed: ${field.options.map((o) => o.label).join(", ")}.`,
    };
  }
  return { ok: true, value: opt.id };
}

function matchOption(field: FieldDefinition, hint: string) {
  const n = norm(hint);
  return (
    field.options.find((o) => o.id === hint) ||
    field.options.find((o) => norm(o.label) === n || norm(o.value) === n) ||
    field.options.find((o) => norm(o.label).includes(n) || n.includes(norm(o.label)))
  );
}

export function cloneLeads(leads: LeadRecord[]): LeadRecord[] {
  return JSON.parse(JSON.stringify(leads)) as LeadRecord[];
}
