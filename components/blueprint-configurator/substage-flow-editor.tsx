"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  type Connection,
  type Edge,
  type Node as FlowNode,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { SubstageNode, SUBSTAGE_NODE_TYPE } from "@/components/blueprint-configurator/substage-node";
import { TransitionInspector } from "@/components/blueprint-configurator/transition-inspector";
import type { BlueprintSubstage, BlueprintSubstageTransition, LeadFieldOption } from "@/lib/blueprint/types";
import { createDefaultSubstageTransition } from "@/lib/blueprint/types";
import type { FieldDefinition } from "@/lib/fields-config/types";

const nodeTypes = { [SUBSTAGE_NODE_TYPE]: SubstageNode };

export type SubstageTransitionEdgeData = {
  transition: BlueprintSubstageTransition;
};

function substagesToNodes(substages: BlueprintSubstage[]): FlowNode[] {
  return substages.map((s, i) => ({
    id: s.id,
    type: SUBSTAGE_NODE_TYPE,
    position: { x: i * 130 + 20, y: 24 },
    data: { label: s.label },
  }));
}

function transitionsToEdges(transitions: BlueprintSubstageTransition[]): Edge<SubstageTransitionEdgeData>[] {
  return transitions.map((t) => ({
    id: t.id,
    source: t.sourceSubstageId,
    target: t.targetSubstageId,
    animated: true,
    data: { transition: t },
  }));
}

function applySubstageEdgeChrome(eds: Edge<SubstageTransitionEdgeData>[], selectedId: string | null) {
  return eds.map((e) => ({
    ...e,
    selected: e.id === selectedId,
    style: {
      stroke: e.id === selectedId ? "#2563eb" : "#64748b",
      strokeWidth: e.id === selectedId ? 2.5 : 1.5,
    },
  }));
}

function SubstageFlowInner({
  substages,
  transitions,
  onTransitionsChange,
  fieldOptions,
  fieldDefinitions,
}: {
  substages: BlueprintSubstage[];
  transitions: BlueprintSubstageTransition[];
  onTransitionsChange: (next: BlueprintSubstageTransition[]) => void;
  fieldOptions: LeadFieldOption[];
  fieldDefinitions: FieldDefinition[];
}) {
  const initialNodes = useMemo(() => substagesToNodes(substages), [substages]);
  const initialEdges = useMemo(
    () => applySubstageEdgeChrome(transitionsToEdges(transitions), null),
    [transitions],
  );
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge<SubstageTransitionEdgeData>>(initialEdges);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  useEffect(() => {
    setNodes(substagesToNodes(substages));
  }, [substages, setNodes]);

  useEffect(() => {
    setEdges(applySubstageEdgeChrome(transitionsToEdges(transitions), selectedEdgeId));
  }, [transitions, selectedEdgeId, setEdges]);

  useEffect(() => {
    if (selectedEdgeId && !transitions.some((t) => t.id === selectedEdgeId)) {
      setSelectedEdgeId(null);
    }
  }, [transitions, selectedEdgeId]);

  const labelById = useCallback(
    (id: string) => substages.find((s) => s.id === id)?.label ?? "",
    [substages],
  );

  const onConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target || params.source === params.target) return;
      const tr = createDefaultSubstageTransition(
        params.source,
        params.target,
        labelById(params.source),
        labelById(params.target),
      );
      const next = [...transitions, tr];
      onTransitionsChange(next);
      setSelectedEdgeId(tr.id);
    },
    [labelById, onTransitionsChange, transitions],
  );

  const selectedTransition = useMemo(
    () => transitions.find((t) => t.id === selectedEdgeId) ?? null,
    [transitions, selectedEdgeId],
  );

  const updateSelectedTransition = useCallback(
    (next: BlueprintSubstageTransition) => {
      onTransitionsChange(transitions.map((t) => (t.id === next.id ? next : t)));
    },
    [onTransitionsChange, transitions],
  );

  const deleteSelectedTransition = useCallback(() => {
    if (!selectedEdgeId) return;
    onTransitionsChange(transitions.filter((t) => t.id !== selectedEdgeId));
    setSelectedEdgeId(null);
  }, [onTransitionsChange, selectedEdgeId, transitions]);

  if (substages.length < 2) {
    return (
      <p className="mt-2 rounded-lg border border-dashed border-border-soft bg-white px-3 py-3 text-[10px] text-muted">
        Add at least two sub-stages to draw flows between them.
      </p>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      <p className="text-[10px] leading-relaxed text-muted">
        Draw arrows between sub-stages (left → right). Click a line to configure <strong className="text-ink">During</strong>{" "}
        and <strong className="text-ink">After</strong> actions.
      </p>
      <div className="h-[200px] overflow-hidden rounded-lg border border-border-soft bg-[#eef0f3]">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          nodesDraggable={false}
          nodesConnectable
          elementsSelectable
          fitView
          fitViewOptions={{ padding: 0.35 }}
          proOptions={{ hideAttribution: true }}
          deleteKeyCode={["Backspace", "Delete"]}
          onEdgeClick={(_, edge) => setSelectedEdgeId(edge.id)}
          onPaneClick={() => setSelectedEdgeId(null)}
          onEdgesDelete={(deleted) => {
            const ids = new Set(deleted.map((e) => e.id));
            onTransitionsChange(transitions.filter((t) => !ids.has(t.id)));
            setSelectedEdgeId(null);
          }}
        >
          <Background variant={BackgroundVariant.Dots} gap={10} size={1} color="#c4c9d1" />
          <Controls className="!scale-75 !rounded-lg !border-border-soft" showInteractive={false} />
        </ReactFlow>
      </div>
      {selectedTransition ? (
        <div className="max-h-[min(50vh,28rem)] overflow-hidden rounded-lg border border-border-soft bg-white">
          <TransitionInspector
            key={selectedTransition.id}
            transition={selectedTransition}
            fieldOptions={fieldOptions}
            fieldDefinitions={fieldDefinitions}
            onChange={(next) => updateSelectedTransition({ ...selectedTransition, ...next })}
            onDelete={deleteSelectedTransition}
            onClose={() => setSelectedEdgeId(null)}
            embedded
          />
        </div>
      ) : (
        <p className="text-[10px] text-muted">Select a connection to edit during / after automation.</p>
      )}
    </div>
  );
}

export function SubstageFlowEditor(props: {
  substages: BlueprintSubstage[];
  transitions: BlueprintSubstageTransition[];
  onTransitionsChange: (next: BlueprintSubstageTransition[]) => void;
  fieldOptions: LeadFieldOption[];
  fieldDefinitions: FieldDefinition[];
}) {
  return (
    <ReactFlowProvider>
      <SubstageFlowInner {...props} />
    </ReactFlowProvider>
  );
}
