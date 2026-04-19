import type { BlueprintDocument, BlueprintTransition } from "@/lib/blueprint/types";
import { createDefaultTransition } from "@/lib/blueprint/types";
import type { Edge, Node } from "@xyflow/react";

export const STAGE_NODE_TYPE = "stage" as const;

export type StageNodeData = {
  label: string;
};

export type TransitionEdgeData = {
  transition: BlueprintTransition;
};

export function blueprintToFlow(doc: BlueprintDocument): { nodes: Node<StageNodeData>[]; edges: Edge<TransitionEdgeData>[] } {
  const nodes: Node<StageNodeData>[] = doc.states.map((s) => ({
    id: s.id,
    type: STAGE_NODE_TYPE,
    position: s.position,
    data: { label: s.label },
  }));
  const edges: Edge<TransitionEdgeData>[] = doc.transitions.map((t) => ({
    id: t.id,
    source: t.sourceStateId,
    target: t.targetStateId,
    label: t.name,
    data: { transition: t },
    animated: true,
  }));
  return { nodes, edges };
}

export function flowToBlueprint(
  base: Pick<BlueprintDocument, "id" | "name" | "module" | "stageField">,
  nodes: Node<StageNodeData>[],
  edges: Edge<TransitionEdgeData>[],
): BlueprintDocument {
  const states = nodes.map((n) => ({
    id: n.id,
    label: n.data?.label ?? "Stage",
    position: n.position,
  }));
  const labelById = new Map(states.map((s) => [s.id, s.label]));
  const transitions: BlueprintTransition[] = edges.map((e) => {
    const existing = e.data?.transition;
    if (existing && existing.id) {
      return {
        ...existing,
        sourceStateId: e.source,
        targetStateId: e.target,
      };
    }
    return createDefaultTransition(
      e.source,
      e.target,
      labelById.get(e.source) ?? "",
      labelById.get(e.target) ?? "",
    );
  });
  return {
    ...base,
    states,
    transitions,
  };
}
