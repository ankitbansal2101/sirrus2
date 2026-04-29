import type { ConnectedModuleFilterBlock, LeadFilterCondition, LeadFilterConfig } from "@/lib/leads/lead-filter-types";
import { CONNECTED_MODULE_IDS, emptyLeadFilterConfig } from "@/lib/leads/lead-filter-types";

function newCondId(): string {
  const c = globalThis.crypto;
  if (c && "randomUUID" in c && typeof c.randomUUID === "function") return c.randomUUID();
  return `fc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeConditionRow(row: unknown): LeadFilterCondition {
  if (!row || typeof row !== "object") {
    return { id: newCondId(), fieldApiKey: "", operator: "", value: "", value2: "" };
  }
  const r = row as Record<string, unknown>;
  const fieldRaw = typeof r.field === "string" ? r.field : typeof r.fieldApiKey === "string" ? r.fieldApiKey : "";
  return {
    id: typeof r.id === "string" ? r.id : newCondId(),
    fieldApiKey: fieldRaw,
    operator: typeof r.operator === "string" ? r.operator : "",
    value: typeof r.value === "string" ? r.value : "",
    value2: typeof r.value2 === "string" ? r.value2 : "",
  };
}

function isConnectedModuleId(x: string): x is (typeof CONNECTED_MODULE_IDS)[number] {
  return (CONNECTED_MODULE_IDS as readonly string[]).includes(x);
}

function normalizeConnectedBlock(row: unknown): ConnectedModuleFilterBlock | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const mid = typeof r.moduleId === "string" ? r.moduleId : "";
  if (!isConnectedModuleId(mid)) return null;
  const presence = r.presence === "without" ? "without" : "with";
  const conds = Array.isArray(r.conditions) ? r.conditions.map(normalizeConditionRow) : [];
  return { moduleId: mid, presence, conditions: conds };
}

/** Coerce unknown / partial persisted config into a valid `LeadFilterConfig`. */
export function normalizeLeadFilterConfig(raw: unknown): LeadFilterConfig {
  if (!raw || typeof raw !== "object") return emptyLeadFilterConfig();
  const o = raw as Record<string, unknown>;
  const conditions = Array.isArray(o.conditions) ? o.conditions.map(normalizeConditionRow) : [];
  const logic: "AND" = "AND";
  const connectedRaw = Array.isArray(o.connected) ? o.connected : [];
  const connected = connectedRaw.map(normalizeConnectedBlock).filter((x): x is ConnectedModuleFilterBlock => x !== null);
  const base: LeadFilterConfig = { conditions, logic };
  if (connected.length) base.connected = connected;
  return base;
}
