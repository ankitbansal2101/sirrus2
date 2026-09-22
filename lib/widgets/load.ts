import { findWidget } from "@/lib/crm/ops";
import type { CrmWorkspace, MarketplaceWidget } from "@/lib/crm/types";
import { loadLivePrototypeState, parsePrototypeState } from "@/lib/prototype-persist/live-store";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

function isWorkspace(x: unknown): x is CrmWorkspace {
  if (!x || typeof x !== "object") return false;
  const o = x as CrmWorkspace;
  return o.version === 1 && typeof o.orgName === "string" && Array.isArray(o.modules);
}

async function readDiskWorkspace(): Promise<CrmWorkspace | null> {
  if (process.env.VERCEL === "1" || process.env.VERCEL === "true") return null;
  try {
    const raw = await readFile(join(process.cwd(), "data", "prototype-state.json"), "utf8");
    const snap = parsePrototypeState(JSON.parse(raw) as unknown);
    if (snap && isWorkspace(snap.crmWorkspace)) return snap.crmWorkspace;
  } catch {
    /* ignore */
  }
  return null;
}

export async function loadWorkspaceFromSnapshot(): Promise<CrmWorkspace | null> {
  try {
    const live = await loadLivePrototypeState();
    if (live && isWorkspace(live.crmWorkspace)) return live.crmWorkspace;
  } catch {
    /* ignore */
  }
  return readDiskWorkspace();
}

export async function loadPublishedWidget(widgetId: string): Promise<MarketplaceWidget | null> {
  const ctx = await loadPublishedWidgetContext(widgetId);
  return ctx?.widget ?? null;
}

export async function loadPublishedWidgetContext(
  widgetId: string,
): Promise<{ workspace: CrmWorkspace; widget: MarketplaceWidget } | null> {
  const ws = await loadWorkspaceFromSnapshot();
  if (!ws) return null;
  const widget = findWidget(ws, widgetId);
  if (!widget || !widget.published) return null;
  return { workspace: ws, widget };
}
