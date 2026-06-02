"use client";

import { BaseEdge, getSmoothStepPath, type EdgeProps } from "@xyflow/react";
import { BLUEPRINT_LABELED_EDGE_TYPE } from "@/lib/blueprint/flow-bridge";

export { BLUEPRINT_LABELED_EDGE_TYPE };

/** Blueprint transition edge — name is edited in the inspector, not drawn on the canvas. */
export function BlueprintLabeledEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
}: EdgeProps) {
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  return <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} />;
}
