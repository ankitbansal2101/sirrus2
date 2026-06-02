/** References a lead field — `id` matches Fields configurator `apiKey`. */
export type LeadFieldOption = {
  id: string;
  label: string;
};

export type BlueprintNodeSize = {
  width: number;
  height: number;
};

/** Sub-stage under a parent blueprint stage (e.g. Site Visit → Scheduled). */
export type BlueprintSubstage = {
  id: string;
  label: string;
  /** Position on the unified blueprint canvas (near parent stage). */
  position?: { x: number; y: number };
  /** Custom pill size on the blueprint canvas. */
  size?: BlueprintNodeSize;
};

/** Sub-stage → another main stage (e.g. Post-qualified → Qualified) with During/After automation. */
export type BlueprintSubstageExit = TransitionAutomation & {
  sourceSubstageId: string;
  targetStateId: string;
};

export type BlueprintState = {
  id: string;
  label: string;
  position: { x: number; y: number };
  /** Custom main-stage pill size on the blueprint canvas. */
  size?: BlueprintNodeSize;
  /** Optional sub-stages within this stage; stored on leads via `BlueprintDocument.substageField`. */
  substages?: BlueprintSubstage[];
  /** Sub-stage selected automatically when a lead enters this stage. */
  defaultSubstageId?: string;
  /** Flow edges between sub-stages (during + after automation per edge). */
  substageTransitions?: BlueprintSubstageTransition[];
  /** When a sub-stage path completes, lead can move to another main stage. */
  substageExits?: BlueprintSubstageExit[];
  /** Top-left of the dashed sub-stage group box on the canvas. */
  substageGroupPosition?: { x: number; y: number };
  /** Custom width/height of the dashed sub-stage group (drag corners on canvas). */
  substageGroupSize?: BlueprintNodeSize;
};

export type TransitionFieldKind = "text" | "textarea" | "picklist" | "remark" | "multi_select";

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

/** Anchor for auto-created task due date (no rep input). */
export type AfterTransitionTaskDueAnchor =
  | "execution"
  | "created"
  | "updated"
  | { kind: "field"; fieldApiKey: string };

/** How auto-task due date is computed. */
export type AfterAutoTaskDueKind = "execution_plus_days" | "anchor_plus_days" | "custom_datetime";

/** Task row appended to related demo `tasks` when the transition completes. */
export type AfterAutoTask = {
  id: string;
  /** `task_type` picklist option id on the Tasks module row. */
  taskTypeOptionId: string;
  /** Due strategy: execution calendar day + offset, created date + offset, or fixed admin datetime. */
  dueKind: AfterAutoTaskDueKind;
  /** For `anchor_plus_days`, always the lead record’s created date (no configurable anchor). */
  dueAnchor: AfterTransitionTaskDueAnchor;
  /** Calendar days added to the anchor’s local calendar day (ignored for `custom_datetime`). */
  offsetDays: number;
  /** Optional local time `HH:mm` applied to the computed due calendar day (not used for `custom_datetime`). */
  dueTimeHm: string;
  /** When `dueKind` is `custom_datetime` — `datetime-local` string. */
  customDueDatetime: string;
};

export type AfterCreateRecordTargetModule = "leads" | "channel_partner";

export type AfterCreateRecordFieldBinding = {
  id: string;
  targetFieldApiKey: string;
  valueMode: "literal" | "map";
  /** When `valueMode` is `literal`. */
  literalValue: string;
  /** Source for mapping — blueprint module is Leads in this prototype. */
  sourceModule: "leads";
  /** Lead field `apiKey` when `valueMode` is `map`. */
  sourceFieldApiKey: string;
};

export type AfterCreateRecord = {
  id: string;
  targetModule: AfterCreateRecordTargetModule;
  fieldBindings: AfterCreateRecordFieldBinding[];
};

export type BlueprintAfterBlock = {
  fieldUpdates: AfterFieldUpdate[];
  autoTasks: AfterAutoTask[];
  createRecords: AfterCreateRecord[];
};

/** One tool on the During confirmation screen (from the global tool catalog). */
export type TransitionFormTool = {
  id: string;
  toolId: string;
  label: string;
  mandatory: boolean;
};

/** Rep form + post-move automation shared by main-stage and sub-stage transitions. */
export type TransitionDuringForm = {
  message: string;
  fields: TransitionFormField[];
  includeRemark: boolean;
  remarkMandatory: boolean;
  includeTasks: boolean;
  taskPresetType: string;
  taskMandatory: boolean;
  tools: TransitionFormTool[];
};

export type TransitionAutomation = {
  id: string;
  name: string;
  enabled: boolean;
  /** During: what the rep sees on the move confirmation screen. */
  form: TransitionDuringForm;
  /** After: field updates, auto tasks, cross-module creates. */
  after: BlueprintAfterBlock;
};

/** Transition between two sub-stages within one parent stage (main stage unchanged). */
export type BlueprintSubstageTransition = TransitionAutomation & {
  sourceSubstageId: string;
  targetSubstageId: string;
};

export type BlueprintTransition = TransitionAutomation & {
  sourceStateId: string;
  /** Parent main stage the lead lands on. */
  targetStateId: string;
  /**
   * When set, this main-stage transition enters the target at this sub-stage (drawn as stage → sub-stage on canvas).
   * When unset and the target has sub-stages, the rep picks one on the move confirmation screen.
   */
  targetSubstageId?: string;
};

export const DEFAULT_SUBSTAGE_FIELD_API_KEY = "substage";

export type BlueprintDocument = {
  id: string;
  name: string;
  module: string;
  stageField: string;
  /** Lead field apiKey holding the active sub-stage id (defaults to `substage`). */
  substageField?: string;
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

function defaultTransitionAutomation(name: string, idPrefix = "tr"): TransitionAutomation {
  return {
    id: newEntityId(idPrefix),
    name,
    enabled: true,
    form: {
      message: "",
      fields: [],
      includeRemark: true,
      remarkMandatory: false,
      includeTasks: false,
      taskPresetType: "Follow up",
      taskMandatory: false,
      tools: [],
    },
    after: {
      fieldUpdates: [],
      autoTasks: [],
      createRecords: [],
    },
  };
}

export function createDefaultTransition(
  sourceId: string,
  targetId: string,
  sourceLabel: string,
  targetLabel: string,
): BlueprintTransition {
  return {
    ...defaultTransitionAutomation(`${sourceLabel} → ${targetLabel}`),
    sourceStateId: sourceId,
    targetStateId: targetId,
  };
}

export function createDefaultSubstageTransition(
  sourceId: string,
  targetId: string,
  sourceLabel: string,
  targetLabel: string,
): BlueprintSubstageTransition {
  return {
    ...defaultTransitionAutomation(`${sourceLabel} → ${targetLabel}`, "sstr"),
    sourceSubstageId: sourceId,
    targetSubstageId: targetId,
  };
}

export function createDefaultSubstageExit(
  sourceSubstageId: string,
  targetStateId: string,
  sourceLabel: string,
  targetLabel: string,
): BlueprintSubstageExit {
  return {
    ...defaultTransitionAutomation(`${sourceLabel} → ${targetLabel}`, "sse"),
    sourceSubstageId,
    targetStateId,
  };
}

export function emptyAfterBlock(): BlueprintAfterBlock {
  return { fieldUpdates: [], autoTasks: [], createRecords: [] };
}

