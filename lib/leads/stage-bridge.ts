import type {
  BlueprintDocument,
  BlueprintState,
  BlueprintSubstage,
  BlueprintSubstageExit,
  BlueprintSubstageTransition,
  BlueprintTransition,
} from "@/lib/blueprint/types";
import { DEFAULT_SUBSTAGE_FIELD_API_KEY } from "@/lib/blueprint/types";
import type { LeadRecord } from "@/lib/leads/types";
import { resolveStageField } from "@/lib/blueprint/from-fields-schema";
import type { FieldDefinition } from "@/lib/fields-config/types";

function norm(s: string) {
  return s.trim().toLowerCase();
}

export function stageFieldForBlueprint(fields: FieldDefinition[], doc: BlueprintDocument): FieldDefinition | undefined {
  return resolveStageField(fields, doc.stageField);
}

/** Map blueprint state → stage picklist option id (match by label). */
export function stateToStageOptionId(stageField: FieldDefinition | undefined, state: BlueprintState): string | undefined {
  if (!stageField?.options?.length) return undefined;
  const t = norm(state.label);
  const hit = stageField.options.find((o) => norm(o.label) === t);
  return hit?.id;
}

/** Current blueprint state from stored stage option id. */
export function stateFromStageValue(
  doc: BlueprintDocument,
  stageField: FieldDefinition | undefined,
  stageOptionId: string | undefined,
): BlueprintState | null {
  if (!stageField || !stageOptionId) return doc.states[0] ?? null;
  const opt = stageField.options.find((o) => o.id === stageOptionId);
  if (!opt) return doc.states[0] ?? null;
  const t = norm(opt.label);
  const st = doc.states.find((s) => norm(s.label) === t);
  return st ?? doc.states[0] ?? null;
}

export function outgoingTransitions(doc: BlueprintDocument, sourceStateId: string): BlueprintTransition[] {
  return doc.transitions.filter((t) => {
    if (!t.enabled || t.sourceStateId !== sourceStateId) return false;
    const target = doc.states.find((s) => s.id === t.targetStateId);
    const targetHasSubstages = (target?.substages?.length ?? 0) > 0;
    if (!targetHasSubstages) return true;
    if (t.targetSubstageId?.trim()) return true;
    const hasEntryArrows = doc.transitions.some(
      (e) =>
        e.enabled &&
        e.sourceStateId === sourceStateId &&
        e.targetStateId === t.targetStateId &&
        Boolean(e.targetSubstageId?.trim()),
    );
    return !hasEntryArrows;
  });
}

/** Sub-stage ids allowed as entry from `sourceStateId` into `targetStateId` (stage → sub-stage arrows). */
export function entrySubstageIdsForMainTransition(
  doc: BlueprintDocument,
  transition: BlueprintTransition,
): string[] {
  const ids: string[] = [];
  for (const t of doc.transitions) {
    if (!t.enabled || t.sourceStateId !== transition.sourceStateId) continue;
    if (t.targetStateId !== transition.targetStateId) continue;
    const ssId = t.targetSubstageId?.trim();
    if (ssId) ids.push(ssId);
  }
  return ids;
}

export function targetState(doc: BlueprintDocument, transition: BlueprintTransition): BlueprintState | undefined {
  return doc.states.find((s) => s.id === transition.targetStateId);
}

/** Resolved sub-stage when a main-stage transition enters at a specific sub-stage. */
export function targetSubstageForTransition(
  doc: BlueprintDocument,
  transition: BlueprintTransition,
): BlueprintSubstage | null {
  const state = targetState(doc, transition);
  if (!state || !transition.targetSubstageId?.trim()) return null;
  return substageFromId(state, transition.targetSubstageId);
}

/** Label for main-stage transition buttons (includes sub-stage when configured). */
export function transitionTargetDisplayLabel(doc: BlueprintDocument, transition: BlueprintTransition): string {
  const state = targetState(doc, transition);
  if (!state) return transition.name;
  const ss = targetSubstageForTransition(doc, transition);
  return formatStageAndSubstage(state.label, ss);
}

/** Sub-stages the rep can pick when taking a main-stage move — only those with entry arrows from this source. */
export function substagesSelectableOnTransition(
  doc: BlueprintDocument,
  state: BlueprintState | null | undefined,
  transition: BlueprintTransition,
): BlueprintSubstage[] {
  if (!state?.substages?.length) return [];
  const pinned = transition.targetSubstageId?.trim();
  if (pinned) {
    const ss = substageFromId(state, pinned);
    return ss ? [ss] : [];
  }
  const entryIds = new Set(entrySubstageIdsForMainTransition(doc, transition));
  if (entryIds.size === 0) return [];
  return state.substages.filter((s) => entryIds.has(s.id));
}

export function substageFieldApiKey(doc: BlueprintDocument): string {
  const k = doc.substageField?.trim();
  return k || DEFAULT_SUBSTAGE_FIELD_API_KEY;
}

export function substagesForState(state: BlueprintState | null | undefined): BlueprintSubstage[] {
  return state?.substages?.length ? state.substages : [];
}

export function substageFromId(state: BlueprintState | null | undefined, substageId: string | undefined): BlueprintSubstage | null {
  if (!substageId?.trim() || !state?.substages?.length) return null;
  return state.substages.find((s) => s.id === substageId) ?? null;
}

export function currentSubstageForLead(
  doc: BlueprintDocument,
  state: BlueprintState | null,
  lead: LeadRecord,
): BlueprintSubstage | null {
  const key = substageFieldApiKey(doc);
  return substageFromId(state, lead.values[key]);
}

/** Human-readable stage line for tables and headers (includes sub-stage when set). */
export function formatStageAndSubstage(
  stageLabel: string,
  substage: BlueprintSubstage | null,
): string {
  if (!substage?.label.trim()) return stageLabel;
  return `${stageLabel} · ${substage.label}`;
}

/** When entering a stage that defines sub-stages, use configured default or first (fallback only). */
export function defaultSubstageIdForState(state: BlueprintState | undefined): string {
  if (!state?.substages?.length) return "";
  if (state.defaultSubstageId && state.substages.some((s) => s.id === state.defaultSubstageId)) {
    return state.defaultSubstageId;
  }
  return state.substages[0]?.id ?? "";
}

export function outgoingSubstageTransitions(
  state: BlueprintState | null | undefined,
  sourceSubstageId: string,
): BlueprintSubstageTransition[] {
  if (!state?.substageTransitions?.length) return [];
  return state.substageTransitions.filter((t) => t.enabled && t.sourceSubstageId === sourceSubstageId);
}

export function outgoingSubstageExits(
  state: BlueprintState | null | undefined,
  sourceSubstageId: string,
): BlueprintSubstageExit[] {
  if (!state?.substageExits?.length) return [];
  return state.substageExits.filter((t) => t.enabled && t.sourceSubstageId === sourceSubstageId);
}

export function targetStateForExit(
  doc: BlueprintDocument,
  exit: BlueprintSubstageExit,
): BlueprintState | undefined {
  return doc.states.find((s) => s.id === exit.targetStateId);
}

export function targetSubstage(
  state: BlueprintState | null | undefined,
  transition: BlueprintSubstageTransition,
): BlueprintSubstage | undefined {
  return state?.substages?.find((s) => s.id === transition.targetSubstageId);
}

export function substageLabel(state: BlueprintState | null | undefined, substageId: string): string {
  return state?.substages?.find((s) => s.id === substageId)?.label ?? substageId;
}

/** Whether this stage uses configured sub-stage flows or exits (vs quick chip pick only). */
export function hasSubstageFlow(state: BlueprintState | null | undefined): boolean {
  return (state?.substageTransitions?.length ?? 0) > 0 || (state?.substageExits?.length ?? 0) > 0;
}
