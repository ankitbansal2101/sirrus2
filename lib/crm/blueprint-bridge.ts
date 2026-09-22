import { createDefaultTransition, type BlueprintDocument } from "@/lib/blueprint/types";
import type { CrmBlueprint, CrmModule } from "@/lib/crm/types";
import { blueprintIdForModule } from "@/lib/crm/ops";
import { newCrmId } from "@/lib/crm/ids";

export function documentFromModule(mod: CrmModule): BlueprintDocument {
  const states = mod.blueprint.stages.map((s, i) => ({
    id: s.id,
    label: s.label,
    position: { x: 40 + i * 180, y: 80 },
  }));
  const byId = new Map(states.map((s) => [s.id, s]));
  const transitions = mod.blueprint.transitions.map((t) => {
    const from = byId.get(t.fromStageId)?.label ?? "";
    const to = byId.get(t.toStageId)?.label ?? "";
    return {
      ...createDefaultTransition(t.fromStageId, t.toStageId, from, to),
      id: t.id,
    };
  });
  return {
    id: blueprintIdForModule(mod.id),
    name: `${mod.pluralLabel} pipeline`,
    module: mod.apiKey,
    stageField: mod.stageFieldApiKey ?? "stage",
    states,
    transitions,
    status: "draft",
  };
}

export function crmBlueprintFromDocument(doc: BlueprintDocument): CrmBlueprint {
  return {
    stages: doc.states.map((s) => ({ id: s.id, label: s.label })),
    transitions: doc.transitions.map((t) => ({
      id: t.id || newCrmId("tr"),
      fromStageId: t.sourceStateId,
      toStageId: t.targetStateId,
      label: t.name,
    })),
  };
}
