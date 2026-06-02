"use client";

import { Handle, NodeResizer, Position, type Node, type NodeProps } from "@xyflow/react";
import type { StageNodeData } from "@/lib/blueprint/flow-bridge";
import { STAGE_NODE_TYPE } from "@/lib/blueprint/flow-bridge";

type StageRfNode = Node<StageNodeData, typeof STAGE_NODE_TYPE>;

export function StageNode({ data, selected }: NodeProps<StageRfNode>) {
  const hasSubstages = data.substages.length > 0;
  return (
    <div className="relative h-full w-full">
      <NodeResizer
        isVisible={selected}
        minWidth={56}
        minHeight={24}
        lineClassName="!border-accent"
        handleClassName="!size-1.5 !border !border-white !bg-accent"
      />
      <div
        className={`flex h-full w-full flex-col items-center justify-center rounded-md border bg-white px-1.5 py-0.5 text-center shadow-sm transition-colors ${
          selected ? "border-accent shadow-lg" : hasSubstages ? "border-accent/50 ring-1 ring-violet-100" : "border-[#c5d6eb]"
        }`}
      >
        <Handle type="target" position={Position.Left} className="!size-1.5 !border !border-white !bg-accent" />
        <p className="max-w-full truncate text-[10px] font-semibold leading-tight text-ink" title={data.label}>
          {data.label}
        </p>
        {hasSubstages ? <span className="mt-0.5 h-0.5 w-5 rounded-full bg-violet-300" aria-hidden /> : null}
        <Handle type="source" position={Position.Right} className="!size-1.5 !border !border-white !bg-accent" />
      </div>
    </div>
  );
}
