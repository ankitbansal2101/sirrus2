import { STANDARD_BLUEPRINT_STATES } from "@/lib/fields-config/standard-defaults";
import type { BlueprintDocument, BlueprintState } from "@/lib/blueprint/types";

export const STANDARD_BLUEPRINT_ID = "bp_standard";

function pos(x: number, y: number) {
  return { x, y };
}

const SITE_VISIT_SUBSTAGES = [
  { id: "ss_sv_scheduled", label: "Scheduled" },
  { id: "ss_sv_in_progress", label: "In Progress" },
  { id: "ss_sv_done", label: "Done" },
  { id: "ss_sv_cancelled", label: "Cancelled" },
  { id: "ss_sv_no_show", label: "No Show" },
] as const;

/** Default stage layout — transitions are left empty for you to wire on the canvas. */
export function createStandardBlueprintDocument(): BlueprintDocument {
  const positions: Record<string, { x: number; y: number }> = {
    st_new: pos(40, 40),
    st_contacted: pos(220, 40),
    st_qualified: pos(400, 40),
    st_site_visit: pos(580, 40),
    st_opp: pos(760, 40),
    st_negotiation: pos(940, 40),
    st_booked: pos(1120, 40),
    st_dropped: pos(760, 280),
  };

  const states: BlueprintState[] = STANDARD_BLUEPRINT_STATES.map((s) => {
    const base: BlueprintState = {
      id: s.id,
      label: s.label,
      position: positions[s.id] ?? pos(40, 40),
    };
    if (s.id === "st_site_visit") {
      return {
        ...base,
        substages: SITE_VISIT_SUBSTAGES.map((ss) => ({ id: ss.id, label: ss.label })),
        defaultSubstageId: "ss_sv_scheduled",
        substageGroupPosition: pos(560, 120),
      };
    }
    return base;
  });

  return {
    id: STANDARD_BLUEPRINT_ID,
    name: "Standard",
    module: "Leads",
    stageField: "stage",
    substageField: "substage",
    states,
    transitions: [],
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
    substageField: "substage",
    states: [],
    transitions: [],
  };
}
