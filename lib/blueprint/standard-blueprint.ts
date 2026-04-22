import { STANDARD_BLUEPRINT_STATES } from "@/lib/fields-config/standard-defaults";
import type { AfterFieldUpdate, BlueprintDocument, BlueprintTransition } from "@/lib/blueprint/types";
import { createDefaultTransition, newEntityId } from "@/lib/blueprint/types";

export const STANDARD_BLUEPRINT_ID = "bp_standard";

function pos(x: number, y: number) {
  return { x, y };
}

function dtUpdate(fieldId: string, fieldLabel: string): AfterFieldUpdate {
  return {
    id: newEntityId("fu"),
    fieldId,
    fieldLabel,
    valueKind: "execution_date_time",
    literalValue: "",
  };
}

function patchTr(
  base: BlueprintTransition,
  form: Partial<BlueprintTransition["form"]>,
  after: AfterFieldUpdate[],
): BlueprintTransition {
  return {
    ...base,
    form: { ...base.form, ...form },
    after: { fieldUpdates: after },
  };
}

const droppedForm: Partial<BlueprintTransition["form"]> = {
  fields: [
    {
      id: "df-dropped-reason",
      fieldId: "dropped_reason",
      label: "Dropped Reason",
      kind: "picklist" as const,
      mandatory: false,
      picklistOptions: [] as string[],
    },
  ],
  includeRemark: true,
  remarkMandatory: false,
  includeTasks: false,
  taskPresetType: "Follow up",
  taskMandatory: false,
};

/** Form + after updates when landing on a stage (same for any valid source → this target). */
function landingForTarget(targetId: string): { form: Partial<BlueprintTransition["form"]>; after: AfterFieldUpdate[] } {
  switch (targetId) {
    case "st_contacted":
      return {
        form: {
          fields: [],
          includeRemark: true,
          remarkMandatory: true,
          includeTasks: true,
          taskPresetType: "Follow up",
          taskMandatory: true,
        },
        after: [dtUpdate("contacted_date", "Contacted date")],
      };
    case "st_qualified":
      return {
        form: {
          fields: [],
          includeRemark: true,
          remarkMandatory: true,
          includeTasks: true,
          taskPresetType: "Follow up",
          taskMandatory: true,
        },
        after: [dtUpdate("qualified_date", "Qualified date")],
      };
    case "st_sv_sched":
      return {
        form: {
          fields: [],
          includeRemark: true,
          remarkMandatory: true,
          includeTasks: true,
          taskPresetType: "Site visit",
          taskMandatory: true,
        },
        after: [dtUpdate("site_visit_scheduled_date", "Site Visit Scheduled date")],
      };
    case "st_sv_done":
      return {
        form: {
          fields: [],
          includeRemark: true,
          remarkMandatory: true,
          includeTasks: true,
          taskPresetType: "Follow up",
          taskMandatory: false,
        },
        after: [dtUpdate("site_visit_done_date", "Site visit done date")],
      };
    case "st_srv_sched":
      return {
        form: {
          fields: [],
          includeRemark: true,
          remarkMandatory: true,
          includeTasks: true,
          taskPresetType: "Site visit",
          taskMandatory: true,
        },
        after: [dtUpdate("site_revisit_scheduled_date", "Site revisit scheduled date")],
      };
    case "st_srv_done":
      return {
        form: {
          fields: [],
          includeRemark: true,
          remarkMandatory: true,
          includeTasks: true,
          taskPresetType: "Follow up",
          taskMandatory: false,
        },
        after: [dtUpdate("site_revisit_done_date", "Site revisit done date")],
      };
    case "st_sv_resched":
      return {
        form: {
          fields: [],
          includeRemark: true,
          remarkMandatory: true,
          includeTasks: true,
          taskPresetType: "Site visit",
          taskMandatory: true,
        },
        after: [dtUpdate("site_visit_rescheduled_date", "Site visit rescheduled date")],
      };
    case "st_srv_resched":
      return {
        form: {
          fields: [],
          includeRemark: true,
          remarkMandatory: true,
          includeTasks: true,
          taskPresetType: "Site visit",
          taskMandatory: true,
        },
        after: [dtUpdate("site_revisit_rescheduled_date", "Site revisit rescheduled date")],
      };
    case "st_opp":
      return {
        form: {
          fields: [],
          includeRemark: true,
          remarkMandatory: true,
          includeTasks: true,
          taskPresetType: "Site visit",
          taskMandatory: true,
        },
        after: [dtUpdate("opportunity_date", "Opportunity date")],
      };
    case "st_dropped":
      return {
        form: droppedForm,
        after: [dtUpdate("dropped_date", "Dropped date")],
      };
    case "st_booked":
      return {
        form: {
          fields: [],
          includeRemark: true,
          remarkMandatory: false,
          includeTasks: false,
          taskPresetType: "Follow up",
          taskMandatory: false,
        },
        after: [],
      };
    default:
      throw new Error(`standard-blueprint: no landing config for target ${targetId}`);
  }
}

/** Forward pipeline: any stage can move to all later stages in picklist order (no backward moves). */
export function createStandardBlueprintDocument(): BlueprintDocument {
  const positions: Record<string, { x: number; y: number }> = {
    st_new: pos(40, 40),
    st_contacted: pos(260, 40),
    st_qualified: pos(480, 40),
    st_sv_sched: pos(700, 40),
    st_sv_done: pos(920, 40),
    st_srv_sched: pos(1140, 40),
    st_srv_done: pos(1360, 40),
    st_sv_resched: pos(700, 200),
    st_srv_resched: pos(1140, 200),
    st_opp: pos(1580, 40),
    st_dropped: pos(900, 360),
    st_booked: pos(1800, 40),
  };
  const states = STANDARD_BLUEPRINT_STATES.map((s) => ({
    id: s.id,
    label: s.label,
    position: positions[s.id] ?? pos(40, 40),
  }));
  const L = (id: string) => states.find((s) => s.id === id)!.label;

  const mk = (from: string, to: string, form: Partial<BlueprintTransition["form"]>, after: AfterFieldUpdate[]) =>
    patchTr(createDefaultTransition(from, to, L(from), L(to)), form, after);

  const order = STANDARD_BLUEPRINT_STATES.map((s) => s.id);
  const transitions: BlueprintTransition[] = [];
  const edgeKey = (from: string, to: string) => `${from}|${to}`;
  const seen = new Set<string>();

  const pushEdge = (from: string, to: string) => {
    const k = edgeKey(from, to);
    if (seen.has(k)) return;
    seen.add(k);
    const { form, after } = landingForTarget(to);
    transitions.push(mk(from, to, form, after));
  };

  for (let i = 0; i < order.length; i++) {
    for (let j = i + 1; j < order.length; j++) {
      pushEdge(order[i]!, order[j]!);
    }
  }

  // Rescheduled → done: not “forward” in picklist order (rescheduled rows appear after done).
  pushEdge("st_sv_resched", "st_sv_done");
  pushEdge("st_srv_resched", "st_srv_done");

  return {
    id: STANDARD_BLUEPRINT_ID,
    name: "Standard",
    module: "Leads",
    stageField: "stage",
    states,
    transitions,
  };
}

/** Alias used when no library document exists yet. */
export function defaultBlueprintDocument(): BlueprintDocument {
  return createStandardBlueprintDocument();
}

/** Empty canvas for a user-created blueprint (not a duplicate). `id` is replaced in storage. */
export function createBlankBlueprintDocument(): BlueprintDocument {
  return {
    id: "bp_blank",
    name: "New blueprint",
    module: "Leads",
    stageField: "stage",
    states: [],
    transitions: [],
  };
}
