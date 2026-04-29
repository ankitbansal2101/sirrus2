import { normalizeLeadFilterConfig } from "@/lib/leads/lead-filter-config-normalize";
import type { LeadFilterConfig } from "@/lib/leads/lead-filter-types";
import { schedulePrototypeDiskPush } from "@/lib/prototype-persist/push";

export const SAVED_LEAD_FILTERS_STORAGE_KEY = "sirrus2_saved_lead_filters_v1";

export const SAVED_LEAD_FILTERS_CHANGED_EVENT = "sirrus2-saved-lead-filters-changed";

export type SavedLeadFilter = {
  id: string;
  name: string;
  entity: "lead";
  config: LeadFilterConfig;
  createdAt: string;
};

function isSavedRow(x: unknown): x is SavedLeadFilter {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.name !== "string" || o.entity !== "lead" || typeof o.createdAt !== "string") {
    return false;
  }
  if (!o.config || typeof o.config !== "object") return false;
  return true;
}

function normalizeConfig(raw: unknown): LeadFilterConfig {
  return normalizeLeadFilterConfig(raw);
}

export function loadSavedLeadFilters(): SavedLeadFilter[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SAVED_LEAD_FILTERS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSavedRow).map((x) => ({
      ...x,
      config: normalizeConfig(x.config),
    }));
  } catch {
    return [];
  }
}

export function saveSavedLeadFilters(list: SavedLeadFilter[]): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(SAVED_LEAD_FILTERS_STORAGE_KEY, JSON.stringify(list));
    window.dispatchEvent(new Event(SAVED_LEAD_FILTERS_CHANGED_EVENT));
    schedulePrototypeDiskPush();
    return true;
  } catch {
    return false;
  }
}

export function upsertSavedLeadFilter(entry: SavedLeadFilter): SavedLeadFilter[] {
  const list = loadSavedLeadFilters();
  const i = list.findIndex((x) => x.id === entry.id);
  if (i >= 0) {
    const next = [...list];
    next[i] = entry;
    saveSavedLeadFilters(next);
    return next;
  }
  const next = [entry, ...list];
  saveSavedLeadFilters(next);
  return next;
}

export function deleteSavedLeadFilter(id: string): SavedLeadFilter[] {
  const next = loadSavedLeadFilters().filter((x) => x.id !== id);
  saveSavedLeadFilters(next);
  return next;
}
