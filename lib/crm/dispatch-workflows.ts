import type { CrmWorkspace } from "@/lib/crm/types";
import type { CrmAutomationEvent } from "@/lib/crm/workflows";
import { matchingWorkflows } from "@/lib/crm/workflows";

export async function dispatchCrmEvent(
  workspace: CrmWorkspace,
  event: CrmAutomationEvent,
  save: (next: CrmWorkspace) => void,
): Promise<string[]> {
  if (!matchingWorkflows(workspace, event).length) return [];
  const res = await fetch("/api/crm-workflows/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workspace, event }),
  });
  const data = (await res.json()) as { workspace?: CrmWorkspace; summaries?: string[]; error?: string };
  if (!res.ok) throw new Error(data.error || "Automation failed.");
  if (data.workspace) save(data.workspace);
  return data.summaries ?? [];
}
