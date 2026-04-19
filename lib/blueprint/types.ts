/** References a lead field — `id` matches Fields configurator `apiKey`. */
export type LeadFieldOption = {
  id: string;
  label: string;
};

export type BlueprintState = {
  id: string;
  label: string;
  position: { x: number; y: number };
};

export type TransitionFieldKind = "text" | "textarea" | "picklist" | "remark";

/** One row on the transition confirmation form (mandatory or optional per row). */
export type TransitionFormField = {
  id: string;
  fieldId: string;
  label: string;
  kind: TransitionFieldKind;
  mandatory: boolean;
  picklistOptions: string[];
};

/** How to set the lead field after the transition succeeds. */
export type AfterFieldUpdateKind =
  | "clear"
  | "literal"
  /** For `date` fields: set to the calendar date when the transition runs. */
  | "execution_date"
  /** For `date_time` fields: set to the instant when the transition runs. */
  | "execution_date_time";

export type AfterFieldUpdate = {
  id: string;
  /** Lead field `apiKey` (same id as Fields configurator pickers). */
  fieldId: string;
  fieldLabel: string;
  valueKind: AfterFieldUpdateKind;
  /** Fixed value: text/number, one option id (picklist/radio), comma-separated option ids (multi_select), `yyyy-mm-dd` or `yyyy-mm-ddThh:mm` for date literals. */
  literalValue: string;
};

export type BlueprintTransition = {
  id: string;
  sourceStateId: string;
  targetStateId: string;
  name: string;
  enabled: boolean;
  /**
   * Admin configures what the rep *sees* on the move confirmation screen (not creating records here).
   */
  form: {
    message: string;
    fields: TransitionFormField[];
    /** Show remarks box for this transition. */
    includeRemark: boolean;
    /** When remarks are shown, require the rep to fill them. */
    remarkMandatory: boolean;
    /** Show the task block for this transition. */
    includeTasks: boolean;
    /** Label/pattern for the task the rep sees (e.g. follow-up vs site visit). */
    taskPresetType: string;
    /** When the task block is shown, require the rep to complete it. */
    taskMandatory: boolean;
  };
  /** After the move succeeds: auto-set field values (dates, literals, clear). */
  after: {
    fieldUpdates: AfterFieldUpdate[];
  };
};

export type BlueprintDocument = {
  id: string;
  name: string;
  module: string;
  stageField: string;
  states: BlueprintState[];
  transitions: BlueprintTransition[];
};

export function newEntityId(prefix: string): string {
  const c = globalThis.crypto;
  if (c && "randomUUID" in c && typeof c.randomUUID === "function") {
    return `${prefix}_${c.randomUUID().slice(0, 10)}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createDefaultTransition(
  sourceId: string,
  targetId: string,
  sourceLabel: string,
  targetLabel: string,
): BlueprintTransition {
  return {
    id: newEntityId("tr"),
    sourceStateId: sourceId,
    targetStateId: targetId,
    name: `${sourceLabel} → ${targetLabel}`,
    enabled: true,
    form: {
      message: "",
      fields: [],
      includeRemark: true,
      remarkMandatory: false,
      includeTasks: false,
      taskPresetType: "Follow up",
      taskMandatory: false,
    },
    after: {
      fieldUpdates: [],
    },
  };
}

export function defaultBlueprintDocument(): BlueprintDocument {
  const sNone = { id: "st_none", label: "-None-", position: { x: 220, y: 40 } };
  const sNew = { id: "st_new", label: "New", position: { x: 220, y: 180 } };
  const sContacted = { id: "st_contacted", label: "Contacted", position: { x: 220, y: 320 } };
  const t1 = createDefaultTransition(sNone.id, sNew.id, sNone.label, sNew.label);
  const t2 = createDefaultTransition(sNew.id, sContacted.id, sNew.label, sContacted.label);
  return {
    id: "bp_default",
    name: "Lead pipeline",
    module: "Leads",
    stageField: "stage",
    states: [sNone, sNew, sContacted],
    transitions: [t1, t2],
  };
}
