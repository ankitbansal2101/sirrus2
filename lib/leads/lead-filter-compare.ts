import { normalizeLeadFilterConfig } from "@/lib/leads/lead-filter-config-normalize";
import type { LeadFilterConfig } from "@/lib/leads/lead-filter-types";

/** Stable JSON key for comparing two filter configs (saved vs applied vs draft). */
export function normalizeFilterConfigForCompare(cfg: LeadFilterConfig): string {
  const n = normalizeLeadFilterConfig(cfg);
  const sorted = [...n.conditions].sort((a, b) => a.fieldApiKey.localeCompare(b.fieldApiKey));
  const conn = [...(n.connected ?? [])].sort((a, b) => a.moduleId.localeCompare(b.moduleId));
  return JSON.stringify({
    logic: n.logic,
    conditions: sorted.map((c) => ({
      fieldApiKey: c.fieldApiKey,
      operator: c.operator,
      value: c.value,
      value2: c.value2,
    })),
    connected: conn.map((b) => ({
      moduleId: b.moduleId,
      presence: b.presence,
      conditions: [...b.conditions]
        .sort((a, b) => a.fieldApiKey.localeCompare(b.fieldApiKey))
        .map((c) => ({
          fieldApiKey: c.fieldApiKey,
          operator: c.operator,
          value: c.value,
          value2: c.value2,
        })),
    })),
  });
}
