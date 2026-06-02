"use client";

import { Handle, NodeResizer, Position, type Node, type NodeProps } from "@xyflow/react";
import type { SubstageNodeData } from "@/lib/blueprint/flow-bridge";
import { SUBSTAGE_NODE_TYPE } from "@/lib/blueprint/flow-bridge";

export { SUBSTAGE_NODE_TYPE };

type SubstageRfNode = Node<SubstageNodeData, typeof SUBSTAGE_NODE_TYPE>;

export function SubstageNode({ data, selected }: NodeProps<SubstageRfNode>) {
  return (
    <div
      className={`flex h-full w-full items-center justify-center rounded border bg-white px-1 py-0.5 text-center shadow-sm transition-colors ${
        selected ? "border-violet-600 shadow-md ring-1 ring-violet-400/40" : "border-violet-200"
      }`}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={48}
        minHeight={18}
        lineClassName="!border-violet-600"
        handleClassName="!size-1.5 !border !border-white !bg-violet-600"
      />
      <Handle type="target" position={Position.Left} className="!size-1.5 !border !border-white !bg-violet-600" />
      <p className="max-w-full truncate text-[8px] font-semibold leading-tight text-ink" title={data.label || "Sub-stage"}>
        {data.label || "Sub-stage"}
      </p>
      <Handle type="source" position={Position.Right} className="!size-1.5 !border !border-white !bg-violet-600" />
    </div>
  );
}
