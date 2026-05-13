import type { BlueprintTransition } from "@/lib/blueprint/types";
import {
  buildCreateRecordRowValues,
  buildDemoTaskRow,
  computeAutoTaskDueIso,
} from "@/lib/blueprint/after-transition-runtime";
import type { FieldDefinition } from "@/lib/fields-config/types";
import type { LeadRecord, LeadRelatedDemoRow } from "@/lib/leads/types";

export type ApplyTransitionAutomationArgs = {
  lead: LeadRecord;
  transition: BlueprintTransition;
  leadFields: FieldDefinition[];
  formDraft: Record<string, string>;
  executedAt: Date;
  newLeadUuid: () => string;
  /** Mutated when new leads are created so sequential display ids stay unique. */
  scratchLeads: LeadRecord[];
  nextDisplayIdForLeads: (list: LeadRecord[]) => string;
  seedRelatedDemo: (index: number) => LeadRecord["relatedDemo"];
};

export function applyTransitionAutomation(args: ApplyTransitionAutomationArgs): { lead: LeadRecord; extraLeads: LeadRecord[] } {
  const {
    lead: src,
    transition,
    leadFields,
    formDraft,
    executedAt,
    newLeadUuid,
    scratchLeads,
    nextDisplayIdForLeads,
    seedRelatedDemo,
  } = args;
  const extraLeads: LeadRecord[] = [];
  let lead: LeadRecord = {
    ...src,
    relatedDemo: { ...src.relatedDemo },
  };

  const tasks = [...(lead.relatedDemo?.tasks ?? [])];
  for (const task of transition.after.autoTasks) {
    const due = computeAutoTaskDueIso(lead, executedAt, task);
    if (!due) continue;
    tasks.push(buildDemoTaskRow(task, due));
  }
  lead.relatedDemo = { ...lead.relatedDemo, tasks };

  for (const rec of transition.after.createRecords) {
    const row = buildCreateRecordRowValues(rec, lead.values, leadFields, transition.id, formDraft);
    if (rec.targetModule === "channel_partner") {
      const nextCp: LeadRelatedDemoRow[] = [...(lead.relatedDemo?.channel_partner ?? [])];
      nextCp.push(row);
      lead.relatedDemo = { ...lead.relatedDemo, channel_partner: nextCp };
    } else {
      const values: Record<string, string> = {};
      for (const f of leadFields) values[f.apiKey] = "";
      for (const [k, v] of Object.entries(row)) {
        if (v !== undefined && v !== "") values[k] = v;
      }
      const displayId = nextDisplayIdForLeads(scratchLeads);
      const newLead: LeadRecord = {
        id: newLeadUuid(),
        displayId,
        values,
        createdAt: executedAt.toISOString(),
        updatedAt: executedAt.toISOString(),
        relatedDemo: seedRelatedDemo(scratchLeads.length),
      };
      scratchLeads.push(newLead);
      extraLeads.push(newLead);
    }
  }

  return { lead, extraLeads };
}
