import { addStagePicklistOption, normStageLabel } from "@/lib/blueprint/stage-field-sync";
import { resolveStageField } from "@/lib/blueprint/from-fields-schema";
import type { BlueprintDocument } from "@/lib/blueprint/types";
import type { FieldDefinition } from "@/lib/fields-config/types";

/** Keep the stage picklist palette aligned with canvas stages after an agentic apply. */
export function ensureStageOptionsForBlueprint(
  fields: FieldDefinition[],
  doc: BlueprintDocument,
): FieldDefinition[] | null {
  const sf = resolveStageField(fields, doc.stageField);
  if (!sf) return null;
  let next = sf;
  let changed = false;
  for (const state of doc.states) {
    const label = state.label.trim();
    if (!label) continue;
    const exists = next.options.some((o) => normStageLabel(o.label) === normStageLabel(label));
    if (!exists) {
      next = addStagePicklistOption(next, label);
      changed = true;
    }
  }
  if (!changed) return null;
  return fields.map((f) => (f.id === sf.id ? next : f));
}
