"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { StageNodeData } from "@/lib/blueprint/flow-bridge";
import { STAGE_NODE_TYPE } from "@/lib/blueprint/flow-bridge";

type StageRfNode = Node<StageNodeData, typeof STAGE_NODE_TYPE>;

export function StageNode({ data, selected }: NodeProps<StageRfNode>) {
  return (
    <div
      className={`min-w-[148px] rounded-2xl border-2 bg-white px-5 py-3 text-center shadow-md transition-colors ${
        selected ? "border-accent shadow-lg" : "border-[#c5d6eb]"
      }`}
    >
      <Handle type="target" position={Position.Top} className="!size-2.5 !border-2 !border-white !bg-accent" />
      <p className="text-sm font-semibold text-ink">{data.label}</p>
      <Handle type="source" position={Position.Bottom} className="!size-2.5 !border-2 !border-white !bg-accent" />
    </div>
  );
}
