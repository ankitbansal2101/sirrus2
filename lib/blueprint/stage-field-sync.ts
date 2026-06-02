import type { Edge, Node } from "@xyflow/react";
import type { CanvasEdgeData, StageNodeData, SubstageGroupNodeData, SubstageNodeData } from "@/lib/blueprint/flow-bridge";
import {
  parseSubstageNodeId,
  STAGE_NODE_TYPE,
  SUBSTAGE_GROUP_NODE_TYPE,
  SUBSTAGE_NODE_TYPE,
  substageGroupId,
} from "@/lib/blueprint/flow-bridge";
import { resolveStageField } from "@/lib/blueprint/from-fields-schema";
import type { FieldDefinition, FieldOption } from "@/lib/fields-config/types";
import { createOption, optionValueFromLabel } from "@/lib/fields-config/types";

export function normStageLabel(label: string): string {
  return label.trim().toLowerCase();
}

export function patchStageFieldOptions(
  fields: FieldDefinition[],
  stageFieldHint: string | undefined,
  mutate: (field: FieldDefinition) => FieldDefinition,
): FieldDefinition[] | null {
  const sf = resolveStageField(fields, stageFieldHint);
  if (!sf) return null;
  return fields.map((f) => (f.id === sf.id ? mutate(f) : f));
}

/** Remove canvas nodes and edges for a stage label removed from the picklist. */
export function pruneBlueprintGraphForStageLabel<
  N extends Node<StageNodeData | SubstageNodeData | SubstageGroupNodeData>,
>(nodes: N[], edges: Edge<CanvasEdgeData>[], removedLabel: string): { nodes: N[]; edges: Edge<CanvasEdgeData>[] } {
  const target = normStageLabel(removedLabel);
  const removedStageIds = new Set(
    nodes
      .filter((n) => n.type === STAGE_NODE_TYPE && normStageLabel((n.data as StageNodeData)?.label ?? "") === target)
      .map((n) => n.id),
  );
  if (removedStageIds.size === 0) return { nodes, edges };

  const removedNodeIds = new Set<string>(removedStageIds);
  for (const sid of removedStageIds) {
    removedNodeIds.add(substageGroupId(sid));
  }
  for (const n of nodes) {
    const parsed = parseSubstageNodeId(n.id);
    if (parsed && removedStageIds.has(parsed.parentStateId)) removedNodeIds.add(n.id);
  }

  const nextNodes = nodes.filter((n) => !removedNodeIds.has(n.id));
  const nextEdges = edges.filter((e) => !removedNodeIds.has(e.source) && !removedNodeIds.has(e.target));
  return { nodes: nextNodes, edges: nextEdges };
}

/** Keep blueprint stage node labels in sync when a picklist option is renamed. */
export function renameStageLabelOnCanvas<
  N extends Node<StageNodeData | SubstageNodeData | SubstageGroupNodeData>,
>(nodes: N[], oldLabel: string, newLabel: string): N[] {
  const oldNorm = normStageLabel(oldLabel);
  const trimmed = newLabel.trim();
  if (!oldNorm || !trimmed || oldNorm === normStageLabel(trimmed)) return nodes;

  return nodes.map((n) => {
    if (n.type === STAGE_NODE_TYPE) {
      const data = n.data as StageNodeData;
      if (normStageLabel(data.label) !== oldNorm) return n;
      return { ...n, data: { ...data, label: trimmed } };
    }
    if (n.type === SUBSTAGE_GROUP_NODE_TYPE) {
      const data = n.data as SubstageGroupNodeData;
      if (normStageLabel(data.stageLabel) !== oldNorm) return n;
      return { ...n, data: { ...data, stageLabel: trimmed } };
    }
    if (n.type === SUBSTAGE_NODE_TYPE) {
      const data = n.data as SubstageNodeData;
      if (normStageLabel(data.parentLabel) !== oldNorm) return n;
      return { ...n, data: { ...data, parentLabel: trimmed } };
    }
    return n;
  });
}

export function addStagePicklistOption(field: FieldDefinition, label = "New stage"): FieldDefinition {
  const next = createOption(label);
  return {
    ...field,
    options: [...field.options, next],
    orderPreference: "manual",
  };
}

export function removeStagePicklistOption(field: FieldDefinition, optionId: string): FieldDefinition | null {
  if (field.options.length <= 1) return null;
  const removed = field.options.find((o) => o.id === optionId);
  if (!removed) return field;
  const options = field.options.filter((o) => o.id !== optionId);
  return {
    ...field,
    options,
    defaultOptionId: field.defaultOptionId === optionId ? options[0]?.id : field.defaultOptionId,
    defaultOptionIds: field.defaultOptionIds.filter((id) => id !== optionId),
  };
}

/** Canvas stage label for a picklist option (matches by stored option value slug). */
export function canvasLabelForPicklistOption<
  N extends Node<StageNodeData | SubstageNodeData | SubstageGroupNodeData>,
>(nodes: N[], option: FieldOption): string | null {
  for (const n of nodes) {
    if (n.type !== STAGE_NODE_TYPE) continue;
    const lbl = (n.data as StageNodeData)?.label ?? "";
    if (optionValueFromLabel(lbl) === option.value) return lbl;
  }
  return null;
}

export function updateStagePicklistOptionLabel(
  field: FieldDefinition,
  optionId: string,
  label: string,
): { field: FieldDefinition; previousLabel: string } | null {
  const prev = field.options.find((o) => o.id === optionId);
  if (!prev) return null;
  const trimmed = label.trim();
  const options: FieldOption[] = field.options.map((o) =>
    o.id === optionId
      ? {
          ...o,
          label,
          value: trimmed ? optionValueFromLabel(trimmed) : o.value,
        }
      : o,
  );
  return {
    field: { ...field, options },
    previousLabel: prev.label,
  };
}
