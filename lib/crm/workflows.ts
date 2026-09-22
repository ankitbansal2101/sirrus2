import { newCrmId } from "@/lib/crm/ids";
import type {
  AgentWorkflow,
  AgentWorkflowStep,
  AutomationTriggerType,
  CrmModule,
  CrmWorkspace,
} from "@/lib/crm/types";

export type CrmAutomationEvent = {
  type: AutomationTriggerType;
  moduleId: string;
  recordId: string;
  previousValues?: Record<string, string>;
  nextValues?: Record<string, string>;
};

export const AUTOMATION_TRIGGER_CATALOG: {
  id: AutomationTriggerType;
  label: string;
  description: string;
  showcase?: boolean;
}[] = [
  { id: "record_created", label: "Record created", description: "Fires when someone creates a record in the selected module." },
  { id: "record_updated", label: "Record updated", description: "Fires when any field on the record is saved." },
  { id: "stage_changed", label: "Stage changed", description: "Fires when the pipeline stage field changes." },
  {
    id: "incoming_call",
    label: "Incoming call",
    description: "Showcase trigger — no telephony yet. Use Simulate on the workflow.",
    showcase: true,
  },
  {
    id: "call_completed",
    label: "Call completed",
    description: "Showcase trigger after a call ends. Use Simulate until a dialer is connected.",
    showcase: true,
  },
  {
    id: "incoming_chat",
    label: "Incoming chat",
    description: "Showcase trigger for a new chat thread. Use Simulate for demos.",
    showcase: true,
  },
  { id: "manual", label: "Manual / test", description: "Run from the workflow builder. Does not fire on live data." },
];

export function triggerMeta(id: AutomationTriggerType) {
  return AUTOMATION_TRIGGER_CATALOG.find((t) => t.id === id);
}

export function workflowsOf(ws: CrmWorkspace): AgentWorkflow[] {
  return ws.workflows ?? [];
}

export function emptyWorkflow(moduleId: string, name = "New automation"): AgentWorkflow {
  const now = new Date().toISOString();
  return {
    id: newCrmId("wf"),
    name,
    enabled: true,
    moduleId,
    triggerType: "record_created",
    triggerStageOptionId: null,
    steps: [],
    runs: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function emptyWorkflowStep(type: AgentWorkflowStep["type"]): AgentWorkflowStep {
  return { id: newCrmId("wfs"), type };
}

export function matchingWorkflows(ws: CrmWorkspace, event: CrmAutomationEvent): AgentWorkflow[] {
  const mod = ws.modules.find((m) => m.id === event.moduleId || m.apiKey === event.moduleId);
  if (!mod) return [];
  return workflowsOf(ws).filter((wf) => {
    if (!wf.enabled) return false;
    if (wf.moduleId !== mod.id && wf.moduleId !== mod.apiKey) return false;
    if (wf.triggerType !== event.type) return false;
    if (event.type === "stage_changed") {
      if (!stageChanged(mod, event.previousValues, event.nextValues)) return false;
      if (wf.triggerStageOptionId) {
        const nextStage = event.nextValues?.[mod.stageFieldApiKey ?? ""] ?? "";
        if (nextStage !== wf.triggerStageOptionId) return false;
      }
    }
    return true;
  });
}

function stageChanged(mod: CrmModule, prev?: Record<string, string>, next?: Record<string, string>) {
  if (!mod.stageFieldApiKey) return false;
  return (prev?.[mod.stageFieldApiKey] ?? "") !== (next?.[mod.stageFieldApiKey] ?? "");
}

export function stepLabel(step: AgentWorkflowStep, ws: CrmWorkspace): string {
  if (step.type === "run_agent") {
    const agent = (ws.agents ?? []).find((a) => a.id === step.agentId);
    return agent ? `Run agent · ${agent.name}` : "Run agent";
  }
  if (step.type === "change_stage") return `Change stage${step.stageLabel ? ` → ${step.stageLabel}` : ""}`;
  if (step.type === "update_field") return "Update field";
  return step.message?.trim() || "Log note";
}
