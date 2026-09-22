import { displayFieldValue, recordTitle } from "@/lib/crm/display";
import type { CrmModule, CrmRecord } from "@/lib/crm/types";
import { isLeadFilterConditionReady, leadMatchesFilterConfig } from "@/lib/leads/evaluate-lead-filters";
import type { LeadFilterConfig } from "@/lib/leads/lead-filter-types";
import type { LeadRecord } from "@/lib/leads/types";

export type ListSortKey = "updated" | "created" | "name" | "id" | `field:${string}`;

export function filterConfigActive(config: LeadFilterConfig | null, fields: CrmModule["fields"]): boolean {
  if (!config) return false;
  return config.conditions.some((c) => isLeadFilterConditionReady(c, fields));
}

export function recordMatchesListFilter(mod: CrmModule, rec: CrmRecord, config: LeadFilterConfig | null): boolean {
  if (!config || !filterConfigActive(config, mod.fields)) return true;
  return leadMatchesFilterConfig(rec as LeadRecord, config, mod.fields);
}

export function searchRecords(mod: CrmModule, records: CrmRecord[], q: string): CrmRecord[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return records;
  return records.filter((r) => {
    if (recordTitle(mod, r).toLowerCase().includes(needle)) return true;
    if (r.displayId.toLowerCase().includes(needle)) return true;
    return Object.values(r.values).some((v) => String(v).toLowerCase().includes(needle));
  });
}

export function sortRecords(mod: CrmModule, records: CrmRecord[], sort: ListSortKey): CrmRecord[] {
  const next = [...records];
  next.sort((a, b) => {
    if (sort === "name") return recordTitle(mod, a).localeCompare(recordTitle(mod, b));
    if (sort === "id") return a.displayId.localeCompare(b.displayId);
    if (sort === "created") return b.createdAt.localeCompare(a.createdAt);
    if (sort === "updated") return b.updatedAt.localeCompare(a.updatedAt);
    if (sort.startsWith("field:")) {
      const api = sort.slice(6);
      const field = mod.fields.find((f) => f.apiKey === api);
      const av = field ? displayFieldValue(field, a.values[api]) : a.values[api] ?? "";
      const bv = field ? displayFieldValue(field, b.values[api]) : b.values[api] ?? "";
      return av.localeCompare(bv);
    }
    return 0;
  });
  return next;
}
