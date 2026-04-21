import type { BlueprintDocument, BlueprintState, BlueprintTransition } from "@/lib/blueprint/types";
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
  return doc.transitions.filter((t) => t.enabled && t.sourceStateId === sourceStateId);
}

export function targetState(doc: BlueprintDocument, transition: BlueprintTransition): BlueprintState | undefined {
  return doc.states.find((s) => s.id === transition.targetStateId);
}
