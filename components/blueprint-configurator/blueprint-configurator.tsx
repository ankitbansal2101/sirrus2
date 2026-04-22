"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
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
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { AvailableStagesDragList, readBlueprintDrag } from "@/components/blueprint-configurator/blueprint-palette";
import { useBlueprintWorkspace } from "@/components/blueprint-configurator/blueprint-workspace-context";
import { StageNode } from "@/components/blueprint-configurator/stage-node";
import { TransitionInspector } from "@/components/blueprint-configurator/transition-inspector";
import {
  blueprintToFlow,
  flowToBlueprint,
  STAGE_NODE_TYPE,
  type StageNodeData,
  type TransitionEdgeData,
} from "@/lib/blueprint/flow-bridge";
import {
  FIELDS_SCHEMA_CHANGED_EVENT,
  FIELDS_SCHEMA_STORAGE_KEY,
  fieldsToLeadFieldOptions,
  fieldsToStagePaletteLabels,
  listFieldsWithOptionChoices,
  resolveFieldDefinitions,
  resolveStageField,
} from "@/lib/blueprint/from-fields-schema";
import {
  BLUEPRINT_CHANGED_EVENT,
  loadBlueprintById,
  saveBlueprint,
} from "@/lib/blueprint/storage";
import { defaultBlueprintDocument } from "@/lib/blueprint/standard-blueprint";
import {
  createDefaultTransition,
  newEntityId,
  type BlueprintDocument,
  type BlueprintTransition,
} from "@/lib/blueprint/types";
import type { FieldDefinition } from "@/lib/fields-config/types";

const nodeTypes = { [STAGE_NODE_TYPE]: StageNode };

function applyEdgeChrome(eds: Edge<TransitionEdgeData>[], selectedId: string | null): Edge<TransitionEdgeData>[] {
  return eds.map((e) => ({
    ...e,
    selected: e.id === selectedId,
    style: {
      ...e.style,
      stroke: e.id === selectedId ? "#2563eb" : "#374151",
      strokeWidth: e.id === selectedId ? 2.5 : 1.5,
    },
  }));
}

type PanelTab = "info" | "transition";

function BlueprintFlow({ blueprintId }: { blueprintId: string }) {
  const { setSaveBanner, registerSaveHandler } = useBlueprintWorkspace();
  const pathname = usePathname();
  const initialDoc = useMemo(
    () => loadBlueprintById(blueprintId) ?? defaultBlueprintDocument(),
    [blueprintId],
  );
  const [docMeta, setDocMeta] = useState<Pick<BlueprintDocument, "id" | "name" | "module" | "stageField">>(() => ({
    id: initialDoc.id,
    name: initialDoc.name,
    module: initialDoc.module,
    stageField: initialDoc.stageField,
  }));
  const initialFlow = useMemo(() => {
    const { nodes, edges } = blueprintToFlow(initialDoc);
    return { nodes, edges: applyEdgeChrome(edges, null) };
  }, [initialDoc]);
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode<StageNodeData>>(initialFlow.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge<TransitionEdgeData>>(initialFlow.edges);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [panelTab, setPanelTab] = useState<PanelTab>("info");
  const [dropHighlight, setDropHighlight] = useState(false);
  const draggingPaletteRef = useRef(false);
  const { screenToFlowPosition } = useReactFlow();

  const [fieldRows, setFieldRows] = useState<FieldDefinition[]>(() => resolveFieldDefinitions());
  const leadFieldOptions = useMemo(() => fieldsToLeadFieldOptions(fieldRows), [fieldRows]);
  const stagePaletteLabels = useMemo(
    () => fieldsToStagePaletteLabels(fieldRows, docMeta.stageField),
    [fieldRows, docMeta.stageField],
  );
  const picklistDrivers = useMemo(() => listFieldsWithOptionChoices(fieldRows), [fieldRows]);
  const stagePickSource = useMemo(
    () => resolveStageField(fieldRows, docMeta.stageField),
    [fieldRows, docMeta.stageField],
  );
  const stageSelectValue = stagePickSource?.apiKey ?? picklistDrivers[0]?.apiKey ?? "";

  useLayoutEffect(() => {
    setFieldRows(resolveFieldDefinitions());
  }, [pathname]);

  useEffect(() => {
    const refreshFields = () => setFieldRows(resolveFieldDefinitions());
    refreshFields();
    const onStorage = (e: StorageEvent) => {
      if (e.key === FIELDS_SCHEMA_STORAGE_KEY || e.key === null) refreshFields();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", refreshFields);
    window.addEventListener(FIELDS_SCHEMA_CHANGED_EVENT, refreshFields);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", refreshFields);
      window.removeEventListener(FIELDS_SCHEMA_CHANGED_EVENT, refreshFields);
    };
  }, []);

  const reloadBlueprintFromStorage = useCallback(() => {
    const loaded = loadBlueprintById(blueprintId);
    if (!loaded) return;
    const { nodes: n, edges: e } = blueprintToFlow(loaded);
    setDocMeta({
      id: loaded.id,
      name: loaded.name,
      module: loaded.module,
      stageField: loaded.stageField,
    });
    setNodes(n);
    setEdges(applyEdgeChrome(e, null));
  }, [blueprintId, setEdges, setNodes]);

  useEffect(() => {
    reloadBlueprintFromStorage();
  }, [reloadBlueprintFromStorage]);

  useEffect(() => {
    const onBlueprint = () => reloadBlueprintFromStorage();
    window.addEventListener(BLUEPRINT_CHANGED_EVENT, onBlueprint);
    return () => window.removeEventListener(BLUEPRINT_CHANGED_EVENT, onBlueprint);
  }, [reloadBlueprintFromStorage]);

  const labelByNodeId = useCallback(
    (id: string) => nodes.find((n) => n.id === id)?.data?.label ?? "",
    [nodes],
  );

  /** So Backspace/Delete reach React Flow: it skips keys while focus is in inputs (`actInsideInputWithModifier: false`). */
  const blurBlockingFocus = useCallback(() => {
    const el = document.activeElement;
    if (!el || !(el instanceof HTMLElement)) return;
    if (el.matches("input, textarea, select, [contenteditable='true']")) {
      el.blur();
    }
  }, []);

  const onConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target) return;
      blurBlockingFocus();
      const tr = createDefaultTransition(
        params.source,
        params.target,
        labelByNodeId(params.source),
        labelByNodeId(params.target),
      );
      setEdges((eds) => {
        const next = addEdge(
          {
            ...params,
            id: tr.id,
            label: tr.name,
            animated: true,
            data: { transition: tr },
          },
          eds,
        ) as Edge<TransitionEdgeData>[];
        return applyEdgeChrome(next, tr.id);
      });
      setSelectedEdgeId(tr.id);
      setPanelTab("transition");
    },
    [blurBlockingFocus, labelByNodeId, setEdges],
  );

  const selectedEdge = useMemo(
    () => edges.find((e) => e.id === selectedEdgeId) ?? null,
    [edges, selectedEdgeId],
  );

  const selectedTransition = selectedEdge?.data?.transition ?? null;

  const updateSelectedTransition = useCallback(
    (next: BlueprintTransition) => {
      if (!selectedEdgeId) return;
      setEdges((eds) =>
        eds.map((e) =>
          e.id === selectedEdgeId
            ? { ...e, label: next.name, data: { transition: next } }
            : e,
        ),
      );
    },
    [selectedEdgeId, setEdges],
  );

  const deleteSelectedTransition = useCallback(() => {
    if (!selectedEdgeId) return;
    setEdges((eds) => eds.filter((e) => e.id !== selectedEdgeId));
    setSelectedEdgeId(null);
  }, [selectedEdgeId, setEdges]);

  const handleSaveBlueprint = useCallback(() => {
    const doc = flowToBlueprint(docMeta, nodes, edges);
    if (saveBlueprint(doc)) {
      setSaveBanner("Saved to this browser");
    } else {
      setSaveBanner("Could not save (storage unavailable)");
    }
    window.setTimeout(() => setSaveBanner(null), 2800);
  }, [docMeta, nodes, edges, setSaveBanner]);

  useEffect(() => {
    registerSaveHandler(() => handleSaveBlueprint());
    return () => registerSaveHandler(null);
  }, [registerSaveHandler, handleSaveBlueprint]);

  const onDragOver = (e: React.DragEvent) => {
    if (!draggingPaletteRef.current) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDropHighlight(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    const related = e.relatedTarget as Node | null;
    if (related && (e.currentTarget as Node).contains(related)) return;
    setDropHighlight(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDropHighlight(false);
    draggingPaletteRef.current = false;
    const payload = readBlueprintDrag(e.dataTransfer);
    if (!payload || payload.kind !== "stage") return;
    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const id = newEntityId("st");
    const n: FlowNode<StageNodeData> = {
      id,
      type: STAGE_NODE_TYPE,
      position,
      data: { label: payload.label },
    };
    blurBlockingFocus();
    setNodes((nds) => [...nds, n]);
  };

  useEffect(() => {
    setEdges((eds) => applyEdgeChrome(eds, selectedEdgeId));
  }, [selectedEdgeId, setEdges]);

  useEffect(() => {
    if (selectedEdgeId && !edges.some((e) => e.id === selectedEdgeId)) {
      setSelectedEdgeId(null);
    }
  }, [edges, selectedEdgeId]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, _node: FlowNode<StageNodeData>) => {
      blurBlockingFocus();
      /** Avoid edge + node both marked selected — Delete would remove both. */
      setSelectedEdgeId(null);
    },
    [blurBlockingFocus],
  );

  const onEdgesDelete = useCallback(() => {
    setSelectedEdgeId(null);
  }, []);

  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge<TransitionEdgeData>) => {
      blurBlockingFocus();
      setSelectedEdgeId(edge.id);
      setPanelTab("transition");
    },
    [blurBlockingFocus],
  );

  const onPaneClick = useCallback(() => {
    blurBlockingFocus();
    setSelectedEdgeId(null);
  }, [blurBlockingFocus]);

  const tabBtn = (id: PanelTab, label: string) => (
    <button
      key={id}
      type="button"
      onClick={() => setPanelTab(id)}
      className={`min-w-0 flex-1 px-2 py-2.5 text-center text-[11px] font-semibold transition ${
        panelTab === id
          ? "border-b-2 border-accent bg-white/80 text-accent"
          : "border-b-2 border-transparent text-muted hover:text-ink"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-canvas">
      <div className="flex min-h-0 min-w-0 flex-1 items-stretch overflow-hidden">
        <div
          className={`relative z-0 min-h-0 min-w-0 flex-1 self-stretch ${dropHighlight ? "ring-2 ring-accent ring-inset" : ""}`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onEdgesDelete={onEdgesDelete}
            nodeTypes={nodeTypes}
            fitView
            proOptions={{ hideAttribution: true }}
            deleteKeyCode={["Backspace", "Delete"]}
            defaultEdgeOptions={{ interactionWidth: 28 }}
            onEdgeClick={onEdgeClick}
            onPaneClick={onPaneClick}
            className="bg-[#eef0f3]"
          >
            <Background variant={BackgroundVariant.Dots} gap={14} size={1} color="#c4c9d1" />
            <Controls className="!rounded-xl !border-border-soft !shadow-md" />
          </ReactFlow>
        </div>

        <aside className="flex w-[min(100%,20rem)] shrink-0 flex-col self-stretch border-l border-border-soft bg-surface shadow-[inset_1px_0_0_rgba(0,0,0,0.02)] sm:w-[22rem]">
          <div className="flex shrink-0 border-b border-border-soft bg-surface">
            {tabBtn("info", "Info & states")}
            {tabBtn("transition", "Transition")}
          </div>

          {panelTab === "info" ? (
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-3">
              <div className="shrink-0">
                <label className="block text-[10px] font-medium uppercase tracking-wide text-muted">Blueprint name</label>
                <input
                  type="text"
                  value={docMeta.name}
                  onChange={(e) => setDocMeta((m) => ({ ...m, name: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-border-soft bg-white px-2.5 py-2 text-sm font-semibold text-ink shadow-sm outline-none ring-accent focus:ring-2"
                />
                <p className="mt-2 text-[10px] leading-relaxed text-muted">
                  <span className="text-ink/80">Module:</span>{" "}
                  <input
                    type="text"
                    value={docMeta.module}
                    onChange={(e) => setDocMeta((m) => ({ ...m, module: e.target.value }))}
                    className="inline-block w-[min(7rem,40%)] rounded border border-border-soft bg-white px-1 py-0.5 text-[10px] text-ink"
                    aria-label="Module"
                  />{" "}
                  <span className="text-border-soft">|</span>{" "}
                  <span className="text-ink/80">Field:</span>{" "}
                  <select
                    value={stageSelectValue}
                    onChange={(e) => setDocMeta((m) => ({ ...m, stageField: e.target.value }))}
                    className="max-w-[10rem] rounded border border-border-soft bg-white px-1 py-0.5 text-[10px] text-ink"
                    title="Picklist used for stages"
                  >
                    {picklistDrivers.length === 0 ? (
                      <option value="">No picklists</option>
                    ) : (
                      picklistDrivers.map((f) => (
                        <option key={f.id} value={f.apiKey}>
                          {f.label}
                        </option>
                      ))
                    )}
                  </select>
                </p>
                <Link
                  href="/developer/lead-settings/fields-configurator"
                  className="mt-2 inline-block text-[10px] font-semibold text-accent underline-offset-2 hover:underline"
                >
                  Edit stage options in Fields configurator →
                </Link>
              </div>

              <AvailableStagesDragList
                stageLabels={stagePaletteLabels}
                stageSourceLabel={stagePickSource?.label}
                onDragSessionStart={() => {
                  draggingPaletteRef.current = true;
                }}
                onDragSessionEnd={() => {
                  draggingPaletteRef.current = false;
                  setDropHighlight(false);
                }}
              />
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {selectedTransition && selectedEdgeId ? (
                <TransitionInspector
                  key={selectedEdgeId}
                  transition={selectedTransition}
                  fieldOptions={leadFieldOptions}
                  fieldDefinitions={fieldRows}
                  onChange={updateSelectedTransition}
                  onDelete={deleteSelectedTransition}
                  onClose={() => setSelectedEdgeId(null)}
                  embedded
                />
              ) : (
                <div className="space-y-2 p-4 text-center">
                  <p className="text-xs leading-relaxed text-muted">
                    Click a <strong className="text-ink">line between stages</strong> to select that connection. Open{" "}
                    <strong className="text-ink">Transition</strong> (above) to edit it or remove only that arrow — stages
                    stay on the canvas. With a line selected, <kbd className="rounded border border-border-soft bg-zinc-100 px-1 py-px font-mono text-[10px]">Del</kbd> removes just the connection.
                  </p>
                  <button
                    type="button"
                    onClick={() => setPanelTab("info")}
                    className="text-[11px] font-semibold text-accent underline-offset-2 hover:underline"
                  >
                    Back to Info & states
                  </button>
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

export default function BlueprintConfigurator({ blueprintId }: { blueprintId: string }) {
  return (
    <ReactFlowProvider>
      <div className="flex min-h-0 flex-1 flex-col">
        <BlueprintFlow blueprintId={blueprintId} />
      </div>
    </ReactFlowProvider>
  );
}
