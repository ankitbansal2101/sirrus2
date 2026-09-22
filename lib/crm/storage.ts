import type { CrmWorkspace } from "@/lib/crm/types";
import { schedulePrototypeDiskPush } from "@/lib/prototype-persist/push";

export const CRM_WORKSPACE_KEY = "sirrus2_crm_workspace_v1";
export const CRM_CHANGED_EVENT = "sirrus2-crm-changed";

function isWorkspace(x: unknown): x is CrmWorkspace {
  if (!x || typeof x !== "object") return false;
  const o = x as CrmWorkspace;
  return o.version === 1 && typeof o.orgName === "string" && Array.isArray(o.modules);
}

export function loadCrmWorkspace(): CrmWorkspace | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CRM_WORKSPACE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CrmWorkspace;
    if (!isWorkspace(parsed)) return null;
    return {
      ...parsed,
      agents: (parsed.agents ?? []).map((a) => ({
        ...a,
        kind: a.kind === "automation" ? "automation" : "on_call",
      })),
      workspaceAgentId: parsed.workspaceAgentId ?? null,
      agentPlacements: parsed.agentPlacements ?? {},
      workflows: parsed.workflows ?? [],
      marketplaceWidgets: parsed.marketplaceWidgets ?? [],
      charts: parsed.charts ?? [],
    };
  } catch {
    return null;
  }
}

export function saveCrmWorkspace(ws: CrmWorkspace): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(CRM_WORKSPACE_KEY, JSON.stringify(ws));
    window.dispatchEvent(new Event(CRM_CHANGED_EVENT));
    schedulePrototypeDiskPush();
    return true;
  } catch {
    return false;
  }
}

export function clearCrmWorkspace(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CRM_WORKSPACE_KEY);
    window.dispatchEvent(new Event(CRM_CHANGED_EVENT));
    schedulePrototypeDiskPush();
  } catch {
    /* ignore */
  }
}
