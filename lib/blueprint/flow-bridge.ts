import type {
  BlueprintDocument,
  BlueprintNodeSize,
  BlueprintState,
  BlueprintSubstage,
  BlueprintSubstageExit,
  BlueprintSubstageTransition,
  BlueprintTransition,
} from "@/lib/blueprint/types";
import {
  createDefaultSubstageExit,
  createDefaultSubstageTransition,
  createDefaultTransition,
} from "@/lib/blueprint/types";
import { Position, type Edge, type Node } from "@xyflow/react";

export const STAGE_NODE_TYPE = "stage" as const;
export const SUBSTAGE_NODE_TYPE = "substage" as const;
export const SUBSTAGE_GROUP_NODE_TYPE = "substage_group" as const;
export const BLUEPRINT_LABELED_EDGE_TYPE = "blueprintLabeled" as const;
/** Compact defaults for new palette drops and nodes without a saved size. */
export const DEFAULT_STAGE_NODE_SIZE: BlueprintNodeSize = { width: 72, height: 30 };
export const DEFAULT_SUBSTAGE_NODE_SIZE: BlueprintNodeSize = { width: 84, height: 20 };

export type StageNodeData = {
  label: string;
  substages: BlueprintSubstage[];
  defaultSubstageId: string;
  substageTransitions: BlueprintSubstageTransition[];
  substageExits: BlueprintSubstageExit[];
};

export type SubstageNodeData = {
  label: string;
  substageId: string;
  parentStateId: string;
  parentLabel: string;
};

export type SubstageGroupNodeData = {
  parentStateId: string;
  stageLabel: string;
  minWidth: number;
  minHeight: number;
};

export function substageGroupId(parentStateId: string): string {
  return `sg:${parentStateId}`;
}

export function parseSubstageGroupId(nodeId: string): { parentStateId: string } | null {
  const m = /^sg:(.+)$/.exec(nodeId);
  if (!m) return null;
  return { parentStateId: m[1]! };
}

/** Layout for the dashed sub-stage container and child positions inside it. */
export function computeSubstageGroupBox(substageCount: number): {
  width: number;
  height: number;
  innerPadTop: number;
  rowHeight: number;
  innerPadX: number;
} {
  const innerPadTop = 18;
  const rowHeight = 26;
  const innerPadX = 8;
  const width = DEFAULT_SUBSTAGE_NODE_SIZE.width + innerPadX * 2;
  const height = innerPadTop + Math.max(1, substageCount) * rowHeight + 8;
  return { width, height, innerPadTop, rowHeight, innerPadX };
}

/** Saved group size clamped to fit at least `substageCount` rows. */
export function resolveSubstageGroupSize(
  substageCount: number,
  saved?: BlueprintNodeSize,
): BlueprintNodeSize {
  const min = computeSubstageGroupBox(substageCount);
  return {
    width: Math.max(saved?.width ?? min.width, min.width),
    height: Math.max(saved?.height ?? min.height, min.height),
  };
}

function defaultSubstageGroupPosition(
  stage: BlueprintState,
  box: ReturnType<typeof computeSubstageGroupBox>,
): { x: number; y: number } {
  return {
    x: stage.position.x - box.width - 42,
    y: stage.position.y + 18,
  };
}

export type CanvasEdgeKind = "stage" | "substage" | "substage_exit";

export type CanvasEdgeData = {
  kind: CanvasEdgeKind;
  parentStateId?: string;
  transition?: BlueprintTransition;
  substageTransition?: BlueprintSubstageTransition;
  substageExit?: BlueprintSubstageExit;
};

export function substageNodeId(parentStateId: string, substageId: string): string {
  return `ss:${parentStateId}:${substageId}`;
}

export function parseSubstageNodeId(nodeId: string): { parentStateId: string; substageId: string } | null {
  const m = /^ss:([^:]+):(.+)$/.exec(nodeId);
  if (!m) return null;
  return { parentStateId: m[1]!, substageId: m[2]! };
}

function edgeStyle(kind: CanvasEdgeKind, selected: boolean): { stroke: string; strokeWidth: number } {
  if (selected) return { stroke: "#2563eb", strokeWidth: 2.5 };
  if (kind === "substage") return { stroke: "#7c3aed", strokeWidth: 1.5 };
  if (kind === "substage_exit") return { stroke: "#0d9488", strokeWidth: 1.75 };
  return { stroke: "#374151", strokeWidth: 1.5 };
}

function nodeStyle(size: BlueprintNodeSize | undefined, fallback: BlueprintNodeSize): { width: number; height: number } {
  return {
    width: size?.width ?? fallback.width,
    height: size?.height ?? fallback.height,
  };
}

function numberFromStyleValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number.parseFloat(value);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function sizeFromNode(node: Node, fallback: BlueprintNodeSize): BlueprintNodeSize {
  return {
    width:
      numberFromStyleValue(node.style?.width) ??
      numberFromStyleValue(node.width) ??
      numberFromStyleValue(node.measured?.width) ??
      fallback.width,
    height:
      numberFromStyleValue(node.style?.height) ??
      numberFromStyleValue(node.height) ??
      numberFromStyleValue(node.measured?.height) ??
      fallback.height,
  };
}

export function blueprintToFlow(doc: BlueprintDocument): {
  nodes: Node<StageNodeData | SubstageNodeData | SubstageGroupNodeData>[];
  edges: Edge<CanvasEdgeData>[];
} {
  const nodes: Node<StageNodeData | SubstageNodeData | SubstageGroupNodeData>[] = [];
  const edges: Edge<CanvasEdgeData>[] = [];

  for (const s of doc.states) {
    nodes.push({
      id: s.id,
      type: STAGE_NODE_TYPE,
      position: s.position,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      style: nodeStyle(s.size, DEFAULT_STAGE_NODE_SIZE),
      data: {
        label: s.label,
        substages: s.substages ?? [],
        defaultSubstageId: s.defaultSubstageId ?? s.substages?.[0]?.id ?? "",
        substageTransitions: s.substageTransitions ?? [],
        substageExits: s.substageExits ?? [],
      },
    });

    const substages = s.substages ?? [];
    if (substages.length > 0) {
      const groupId = substageGroupId(s.id);
      const box = computeSubstageGroupBox(substages.length);
      const groupSize = resolveSubstageGroupSize(substages.length, s.substageGroupSize);
      const groupPos =
        s.substageGroupPosition ??
        defaultSubstageGroupPosition(s, { ...box, width: groupSize.width, height: groupSize.height });

      nodes.push({
        id: groupId,
        type: SUBSTAGE_GROUP_NODE_TYPE,
        position: groupPos,
        style: { width: groupSize.width, height: groupSize.height },
        zIndex: -1,
        selectable: true,
        draggable: true,
        data: {
          parentStateId: s.id,
          stageLabel: s.label,
          minWidth: box.width,
          minHeight: box.height,
        },
      });

      substages.forEach((ss, index) => {
        const defaultRel = { x: box.innerPadX, y: box.innerPadTop + index * box.rowHeight };
        nodes.push({
          id: substageNodeId(s.id, ss.id),
          type: SUBSTAGE_NODE_TYPE,
          parentId: groupId,
          extent: "parent",
          position: ss.position ?? defaultRel,
          sourcePosition: Position.Right,
          targetPosition: Position.Left,
          style: nodeStyle(ss.size, DEFAULT_SUBSTAGE_NODE_SIZE),
          data: {
            label: ss.label,
            substageId: ss.id,
            parentStateId: s.id,
            parentLabel: s.label,
          },
        });
      });
    }

    for (const tr of s.substageTransitions ?? []) {
      edges.push({
        id: tr.id,
        source: substageNodeId(s.id, tr.sourceSubstageId),
        target: substageNodeId(s.id, tr.targetSubstageId),
        animated: true,
        data: { kind: "substage", parentStateId: s.id, substageTransition: tr },
      });
    }

    for (const ex of s.substageExits ?? []) {
      if (ex.targetStateId === s.id) continue;
      edges.push({
        id: ex.id,
        source: substageNodeId(s.id, ex.sourceSubstageId),
        target: ex.targetStateId,
        animated: true,
        data: { kind: "substage_exit", parentStateId: s.id, substageExit: ex },
      });
    }
  }

  for (const t of doc.transitions) {
    const target = t.targetSubstageId
      ? substageNodeId(t.targetStateId, t.targetSubstageId)
      : t.targetStateId;
    edges.push({
      id: t.id,
      source: t.sourceStateId,
      target,
      data: { kind: "stage", transition: t },
      animated: true,
    });
  }

  return { nodes, edges };
}

export function flowToBlueprint(
  base: Pick<BlueprintDocument, "id" | "name" | "module" | "stageField" | "substageField">,
  nodes: Node<StageNodeData | SubstageNodeData | SubstageGroupNodeData>[],
  edges: Edge<CanvasEdgeData>[],
): BlueprintDocument {
  const stageNodes = nodes.filter((n) => n.type === STAGE_NODE_TYPE) as Node<StageNodeData>[];
  const substageNodes = nodes.filter((n) => n.type === SUBSTAGE_NODE_TYPE) as Node<SubstageNodeData>[];
  const groupNodes = nodes.filter((n) => n.type === SUBSTAGE_GROUP_NODE_TYPE);
  const groupMetaByParent = new Map(
    groupNodes
      .map((g) => {
        const parsed = parseSubstageGroupId(g.id);
        if (!parsed) return null;
        return [
          parsed.parentStateId,
          { position: g.position, size: sizeFromNode(g, { width: 0, height: 0 }) },
        ] as const;
      })
      .filter(Boolean) as [string, { position: { x: number; y: number }; size: BlueprintNodeSize }][],
  );

  const substagesByParent = new Map<string, BlueprintSubstage[]>();
  for (const n of substageNodes) {
    const d = n.data;
    if (!d?.parentStateId || !d.substageId) continue;
    const list = substagesByParent.get(d.parentStateId) ?? [];
    list.push({
      id: d.substageId,
      label: d.label,
      position: n.position,
      size: sizeFromNode(n, DEFAULT_SUBSTAGE_NODE_SIZE),
    });
    substagesByParent.set(d.parentStateId, list);
  }

  const states = stageNodes.map((n) => {
    const substageList = substagesByParent.get(n.id) ?? [];
    const hasSubstages = substageList.filter((s) => s.label.trim()).length > 0;
    const groupMeta = groupMetaByParent.get(n.id);
    const substageCount = substageList.filter((s) => s.label.trim()).length;
    const groupMin = computeSubstageGroupBox(Math.max(1, substageCount));
    const groupPos = groupMeta?.position;
    const groupSizeRaw = groupMeta?.size;
    const groupSize =
      hasSubstages && groupSizeRaw
        ? resolveSubstageGroupSize(Math.max(1, substageCount), groupSizeRaw)
        : undefined;
    return {
      id: n.id,
      label: n.data?.label ?? "Stage",
      position: n.position,
      size: sizeFromNode(n, DEFAULT_STAGE_NODE_SIZE),
      substages: hasSubstages ? substageList : undefined,
      defaultSubstageId: hasSubstages ? n.data?.defaultSubstageId || substageList[0]?.id : undefined,
      substageTransitions: undefined,
      substageExits: undefined,
      substageGroupPosition: hasSubstages && groupPos ? groupPos : undefined,
      substageGroupSize: hasSubstages ? groupSize : undefined,
    };
  });

  const stageIds = new Set(states.map((s) => s.id));
  const substageNodeIds = new Set(substageNodes.map((n) => n.id));
  const labelByStageId = new Map(states.map((s) => [s.id, s.label]));
  const labelBySubstageNodeId = new Map(substageNodes.map((n) => [n.id, n.data?.label ?? ""]));

  const transitions: BlueprintTransition[] = [];
  const substageTransitionsByParent = new Map<string, BlueprintSubstageTransition[]>();
  const substageExitsByParent = new Map<string, BlueprintSubstageExit[]>();

  for (const e of edges) {
    const kind = e.data?.kind ?? "stage";
    if (kind === "stage" && stageIds.has(e.source)) {
      const tgtSs = parseSubstageNodeId(e.target);
      const existing = e.data?.transition;
      if (tgtSs) {
        const parentLabel = labelByStageId.get(tgtSs.parentStateId) ?? "";
        const ssLabel = labelBySubstageNodeId.get(e.target) ?? "";
        transitions.push(
          existing?.id
            ? {
                ...existing,
                sourceStateId: e.source,
                targetStateId: tgtSs.parentStateId,
                targetSubstageId: tgtSs.substageId,
              }
            : {
                ...createDefaultTransition(e.source, tgtSs.parentStateId, labelByStageId.get(e.source) ?? "", parentLabel),
                targetSubstageId: tgtSs.substageId,
                name: `${parentLabel} · ${ssLabel}`,
              },
        );
        continue;
      }
      if (stageIds.has(e.target)) {
        transitions.push(
          existing?.id
            ? { ...existing, sourceStateId: e.source, targetStateId: e.target, targetSubstageId: undefined }
            : createDefaultTransition(
                e.source,
                e.target,
                labelByStageId.get(e.source) ?? "",
                labelByStageId.get(e.target) ?? "",
              ),
        );
        continue;
      }
    }

    const srcSs = parseSubstageNodeId(e.source);
    const tgtSs = parseSubstageNodeId(e.target);

    if (kind === "substage" && srcSs && tgtSs && srcSs.parentStateId === tgtSs.parentStateId) {
      const parentId = e.data?.parentStateId ?? srcSs.parentStateId;
      const existing = e.data?.substageTransition;
      const row =
        existing ??
        createDefaultSubstageTransition(
          srcSs.substageId,
          tgtSs.substageId,
          labelBySubstageNodeId.get(e.source) ?? "",
          labelBySubstageNodeId.get(e.target) ?? "",
        );
      const list = substageTransitionsByParent.get(parentId) ?? [];
      list.push({ ...row, sourceSubstageId: srcSs.substageId, targetSubstageId: tgtSs.substageId });
      substageTransitionsByParent.set(parentId, list);
      continue;
    }

    if (kind === "substage_exit" && srcSs && stageIds.has(e.target) && e.target !== srcSs.parentStateId) {
      const parentId = e.data?.parentStateId ?? srcSs.parentStateId;
      const existing = e.data?.substageExit;
      const list = substageExitsByParent.get(parentId) ?? [];
      const srcLabel = labelBySubstageNodeId.get(e.source) ?? "";
      const tgtLabel = labelByStageId.get(e.target) ?? "";
      list.push(
        existing ??
          createDefaultSubstageExit(srcSs.substageId, e.target, srcLabel, tgtLabel),
      );
      substageExitsByParent.set(parentId, list);
    }
  }

  const mergedStates = states.map((s) => ({
    ...s,
    substageTransitions: substageTransitionsByParent.get(s.id)?.length
      ? substageTransitionsByParent.get(s.id)
      : s.substageTransitions,
    substageExits: substageExitsByParent.get(s.id)?.length ? substageExitsByParent.get(s.id) : s.substageExits,
  }));

  return {
    ...base,
    states: mergedStates,
    transitions,
  };
}

/** Apply edge chrome for selected id. */
export function applyCanvasEdgeChrome(eds: Edge<CanvasEdgeData>[], selectedId: string | null): Edge<CanvasEdgeData>[] {
  return eds.map((e) => ({
    ...e,
    type: BLUEPRINT_LABELED_EDGE_TYPE,
    label: undefined,
    selected: e.id === selectedId,
    style: edgeStyle(e.data?.kind ?? "stage", e.id === selectedId),
    labelShowBg: false,
  }));
}
