"use client";

import { NodeResizer, type Node, type NodeProps } from "@xyflow/react";
import type { SubstageGroupNodeData } from "@/lib/blueprint/flow-bridge";
import { SUBSTAGE_GROUP_NODE_TYPE } from "@/lib/blueprint/flow-bridge";

export { SUBSTAGE_GROUP_NODE_TYPE };

type GroupRfNode = Node<SubstageGroupNodeData, typeof SUBSTAGE_GROUP_NODE_TYPE>;

/** Dashed region on the canvas — sub-stage nodes are children inside this box. */
export function SubstageGroupNode({ data, selected }: NodeProps<GroupRfNode>) {
  return (
    <div
      className={`relative h-full w-full overflow-hidden rounded-xl border border-dashed transition-shadow ${
        selected
          ? "border-violet-500 bg-violet-50/70 shadow-md ring-1 ring-violet-300/50"
          : "border-violet-300 bg-violet-50/45 shadow-sm"
      }`}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={data.minWidth}
        minHeight={data.minHeight}
        lineClassName="!border-violet-500"
        handleClassName="!size-2 !border !border-white !bg-violet-600"
      />
      <p
        className="pointer-events-none absolute left-2 top-1 max-w-[calc(100%-1rem)] truncate text-[10px] font-semibold text-violet-700/80"
        title={data.stageLabel}
      >
        {data.stageLabel}
      </p>
    </div>
  );
}
