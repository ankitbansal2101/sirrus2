import type { LeadFilterConfig } from "@/lib/leads/lead-filter-types";

export type SavedListFilter = {
  id: string;
  name: string;
  config: LeadFilterConfig;
};

const prefix = "sirrus2_list_filters_v1_";

function key(moduleId: string) {
  return `${prefix}${moduleId}`;
}

export function loadSavedListFilters(moduleId: string): SavedListFilter[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key(moduleId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is SavedListFilter => !!x && typeof x.id === "string" && typeof x.name === "string" && x.config);
  } catch {
    return [];
  }
}

export function saveSavedListFilters(moduleId: string, list: SavedListFilter[]) {
  window.localStorage.setItem(key(moduleId), JSON.stringify(list));
  window.dispatchEvent(new Event("sirrus2-list-filters-changed"));
}

export function upsertSavedListFilter(moduleId: string, name: string, config: LeadFilterConfig): SavedListFilter {
  const list = loadSavedListFilters(moduleId);
  const row: SavedListFilter = {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `sf-${Date.now()}`,
    name: name.trim() || "Untitled filter",
    config,
  };
  saveSavedListFilters(moduleId, [...list, row]);
  return row;
}

export function deleteSavedListFilter(moduleId: string, id: string) {
  saveSavedListFilters(
    moduleId,
    loadSavedListFilters(moduleId).filter((f) => f.id !== id),
  );
}
