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
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { readBlueprintDrag } from "@/components/blueprint-configurator/blueprint-palette";
import { StageFieldOptionsPanel } from "@/components/blueprint-configurator/stage-field-options-panel";
import { useBlueprintWorkspace } from "@/components/blueprint-configurator/blueprint-workspace-context";
import { StageInspector } from "@/components/blueprint-configurator/stage-inspector";
import { BlueprintLabeledEdge } from "@/components/blueprint-configurator/blueprint-labeled-edge";
import { StageNode } from "@/components/blueprint-configurator/stage-node";
import { SubstageGroupNode } from "@/components/blueprint-configurator/substage-group-node";
import { SubstageNode } from "@/components/blueprint-configurator/substage-node";
import { TransitionInspector } from "@/components/blueprint-configurator/transition-inspector";
import {
  applyCanvasEdgeChrome,
  BLUEPRINT_LABELED_EDGE_TYPE,
  blueprintToFlow,
  computeSubstageGroupBox,
  resolveSubstageGroupSize,
  DEFAULT_STAGE_NODE_SIZE,
  DEFAULT_SUBSTAGE_NODE_SIZE,
  flowToBlueprint,
  parseSubstageGroupId,
  parseSubstageNodeId,
  SUBSTAGE_GROUP_NODE_TYPE,
  SUBSTAGE_NODE_TYPE,
  STAGE_NODE_TYPE,
  substageGroupId,
  substageNodeId,
  type CanvasEdgeData,
  type CanvasEdgeKind,
  type StageNodeData,
  type SubstageGroupNodeData,
  type SubstageNodeData,
} from "@/lib/blueprint/flow-bridge";
import {
  FIELDS_SCHEMA_CHANGED_EVENT,
  FIELDS_SCHEMA_STORAGE_KEY,
  fieldsToLeadFieldOptions,
  listFieldsWithOptionChoices,
  resolveFieldDefinitions,
  resolveStageField,
} from "@/lib/blueprint/from-fields-schema";
import {
  addStagePicklistOption,
  patchStageFieldOptions,
  pruneBlueprintGraphForStageLabel,
  canvasLabelForPicklistOption,
  renameStageLabelOnCanvas,
  removeStagePicklistOption,
  updateStagePicklistOptionLabel,
} from "@/lib/blueprint/stage-field-sync";
import {
  BLUEPRINT_CHANGED_EVENT,
  loadBlueprintById,
  saveBlueprint,
} from "@/lib/blueprint/storage";
import { defaultBlueprintDocument } from "@/lib/blueprint/standard-blueprint";
import {
  createDefaultSubstageExit,
  createDefaultSubstageTransition,
  createDefaultTransition,
  newEntityId,
  type BlueprintDocument,
  type BlueprintSubstage,
  type BlueprintTransition,
  type TransitionAutomation,
} from "@/lib/blueprint/types";
import { saveFieldsSchema } from "@/lib/fields-config/schema-storage";
import type { FieldDefinition } from "@/lib/fields-config/types";

const nodeTypes = {
  [STAGE_NODE_TYPE]: StageNode,
  [SUBSTAGE_NODE_TYPE]: SubstageNode,
  [SUBSTAGE_GROUP_NODE_TYPE]: SubstageGroupNode,
};

const edgeTypes = {
  [BLUEPRINT_LABELED_EDGE_TYPE]: BlueprintLabeledEdge,
};

type PanelTab = "info" | "transition";

function BlueprintFlow({ blueprintId }: { blueprintId: string }) {
  const { setSaveBanner, registerSaveHandler } = useBlueprintWorkspace();
  const pathname = usePathname();
  const initialDoc = useMemo(
    () => loadBlueprintById(blueprintId) ?? defaultBlueprintDocument(),
    [blueprintId],
  );
  const [docMeta, setDocMeta] = useState<
    Pick<BlueprintDocument, "id" | "name" | "module" | "stageField" | "substageField">
  >(() => ({
    id: initialDoc.id,
    name: initialDoc.name,
    module: initialDoc.module,
    stageField: initialDoc.stageField,
    substageField: initialDoc.substageField,
  }));
  const initialFlow = useMemo(() => {
    const { nodes, edges } = blueprintToFlow(initialDoc);
    return { nodes, edges: applyCanvasEdgeChrome(edges, null) };
  }, [initialDoc]);
  const [nodes, setNodes, onNodesChange] = useNodesState<
    FlowNode<StageNodeData | SubstageNodeData | SubstageGroupNodeData>
  >(initialFlow.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge<CanvasEdgeData>>(initialFlow.edges);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [panelTab, setPanelTab] = useState<PanelTab>("info");
  const [dropHighlight, setDropHighlight] = useState(false);
  const draggingPaletteRef = useRef(false);
  const { screenToFlowPosition } = useReactFlow();

  const [fieldRows, setFieldRows] = useState<FieldDefinition[]>(() => resolveFieldDefinitions());
  const leadFieldOptions = useMemo(() => fieldsToLeadFieldOptions(fieldRows), [fieldRows]);
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
      substageField: loaded.substageField,
    });
    setNodes(n);
    setEdges(applyCanvasEdgeChrome(e, null));
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
    (id: string) => {
      const n = nodes.find((node) => node.id === id);
      if (!n?.data) return "";
      if ("label" in n.data && typeof n.data.label === "string") return n.data.label;
      if ("stageLabel" in n.data && typeof n.data.stageLabel === "string") return n.data.stageLabel;
      return "";
    },
    [nodes],
  );

  /** So Backspace/Delete reach React Flow: it skips keys while focus is in inputs (`actInsideInputWithModifier: false`). */
  const persistFieldRows = useCallback(
    (next: FieldDefinition[]) => {
      if (!saveFieldsSchema(next)) {
        setSaveBanner("Could not save stage field");
        window.setTimeout(() => setSaveBanner(null), 3200);
        return false;
      }
      setFieldRows(next);
      return true;
    },
    [setSaveBanner],
  );

  const handleAddStageOption = useCallback(
    (label: string) => {
      const next = patchStageFieldOptions(fieldRows, docMeta.stageField, (f) => addStagePicklistOption(f, label));
      if (!next || !persistFieldRows(next)) return;
      setSaveBanner("Stage added — drag it onto the canvas");
      window.setTimeout(() => setSaveBanner(null), 2800);
    },
    [fieldRows, docMeta.stageField, persistFieldRows, setSaveBanner],
  );

  const handleRemoveStageOption = useCallback(
    (optionId: string, label: string) => {
      const sf = resolveStageField(fieldRows, docMeta.stageField);
      if (!sf) return;
      const updatedField = removeStagePicklistOption(sf, optionId);
      if (!updatedField) {
        setSaveBanner("Keep at least one stage on the field");
        window.setTimeout(() => setSaveBanner(null), 2800);
        return;
      }
      const nextFields = fieldRows.map((f) => (f.id === sf.id ? updatedField : f));
      const pruned = pruneBlueprintGraphForStageLabel(nodes, edges, label);
      setNodes(pruned.nodes);
      setEdges(applyCanvasEdgeChrome(pruned.edges, selectedEdgeId));
      if (selectedNodeId) {
        const sn = pruned.nodes.find((n) => n.id === selectedNodeId);
        if (!sn) setSelectedNodeId(null);
      }
      if (!persistFieldRows(nextFields)) return;
      setSaveBanner("Stage removed from field and canvas");
      window.setTimeout(() => setSaveBanner(null), 2800);
    },
    [fieldRows, docMeta.stageField, nodes, edges, selectedEdgeId, selectedNodeId, persistFieldRows, setNodes, setEdges, setSaveBanner],
  );

  const handleRenameStageOption = useCallback(
    (optionId: string, label: string) => {
      let previousLabel = "";
      const nextFields = patchStageFieldOptions(fieldRows, docMeta.stageField, (f) => {
        const updated = updateStagePicklistOptionLabel(f, optionId, label);
        if (!updated) return f;
        previousLabel = updated.previousLabel;
        return updated.field;
      });
      if (!nextFields) return;
      const trimmed = label.trim();
      if (trimmed) {
        const sf = resolveStageField(nextFields, docMeta.stageField);
        const opt = sf?.options.find((o) => o.id === optionId);
        const canvasOld =
          previousLabel.trim() || (opt ? canvasLabelForPicklistOption(nodes, opt) : null) || previousLabel;
        if (canvasOld.trim()) {
          setNodes((nds) => renameStageLabelOnCanvas(nds, canvasOld, trimmed));
        }
      }
      persistFieldRows(nextFields);
    },
    [fieldRows, docMeta.stageField, nodes, persistFieldRows, setNodes],
  );

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
      if (parseSubstageGroupId(params.source) || parseSubstageGroupId(params.target)) return;
      blurBlockingFocus();

      const srcSs = parseSubstageNodeId(params.source);
      const tgtSs = parseSubstageNodeId(params.target);

      if (!srcSs && tgtSs) {
        const parentLabel = labelByNodeId(tgtSs.parentStateId);
        const ssLabel = labelByNodeId(params.target);
        const tr: BlueprintTransition = {
          ...createDefaultTransition(
            params.source,
            tgtSs.parentStateId,
            labelByNodeId(params.source),
            parentLabel,
          ),
          targetSubstageId: tgtSs.substageId,
          name: `${parentLabel} · ${ssLabel}`,
        };
        setEdges((eds) => {
          const next = addEdge(
            {
              ...params,
              id: tr.id,
              animated: true,
              data: { kind: "stage", transition: tr },
            },
            eds,
          ) as Edge<CanvasEdgeData>[];
          return applyCanvasEdgeChrome(next, tr.id);
        });
        setSelectedNodeId(null);
        setSelectedEdgeId(tr.id);
        setPanelTab("transition");
        return;
      }

      const edgeKind: CanvasEdgeKind =
        srcSs && tgtSs && srcSs.parentStateId === tgtSs.parentStateId
          ? "substage"
          : srcSs && !tgtSs
            ? "substage_exit"
            : "stage";

      if (edgeKind === "stage") {
        if (srcSs || tgtSs) return;
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
              animated: true,
              data: { kind: "stage", transition: tr },
            },
            eds,
          ) as Edge<CanvasEdgeData>[];
          return applyCanvasEdgeChrome(next, tr.id);
        });
        setSelectedNodeId(null);
        setSelectedEdgeId(tr.id);
        setPanelTab("transition");
        return;
      }

      if (edgeKind === "substage") {
        if (!srcSs || !tgtSs) return;
        const parentStateId = srcSs.parentStateId;
        const tr = createDefaultSubstageTransition(
          srcSs.substageId,
          tgtSs.substageId,
          labelByNodeId(params.source),
          labelByNodeId(params.target),
        );
        setEdges((eds) => {
          const next = addEdge(
            {
              ...params,
              id: tr.id,
              animated: true,
              data: { kind: "substage", parentStateId, substageTransition: tr },
            },
            eds,
          ) as Edge<CanvasEdgeData>[];
          return applyCanvasEdgeChrome(next, tr.id);
        });
        setSelectedNodeId(null);
        setSelectedEdgeId(tr.id);
        setPanelTab("transition");
        return;
      }

      if (edgeKind === "substage_exit") {
        if (!srcSs || tgtSs) return;
        if (params.target === srcSs.parentStateId) return;
        const parentStateId = srcSs.parentStateId;
        const ex = createDefaultSubstageExit(
          srcSs.substageId,
          params.target,
          labelByNodeId(params.source),
          labelByNodeId(params.target),
        );
        setEdges((eds) => {
          const next = addEdge(
            {
              ...params,
              id: ex.id,
              animated: true,
              data: { kind: "substage_exit", parentStateId, substageExit: ex },
            },
            eds,
          ) as Edge<CanvasEdgeData>[];
          return applyCanvasEdgeChrome(next, ex.id);
        });
        setSelectedNodeId(null);
        setSelectedEdgeId(ex.id);
        setPanelTab("transition");
      }
    },
    [blurBlockingFocus, labelByNodeId, setEdges],
  );

  const selectedEdge = useMemo(
    () => edges.find((e) => e.id === selectedEdgeId) ?? null,
    [edges, selectedEdgeId],
  );

  const selectedTransition: TransitionAutomation | null =
    selectedEdge?.data?.transition ??
    selectedEdge?.data?.substageTransition ??
    selectedEdge?.data?.substageExit ??
    null;

  const updateSelectedTransition = useCallback(
    (next: TransitionAutomation) => {
      if (!selectedEdgeId || !selectedTransition || !selectedEdge) return;
      const kind = selectedEdge.data?.kind ?? "stage";
      setEdges((eds) =>
        eds.map((e) =>
          e.id === selectedEdgeId
            ? kind === "stage"
              ? {
                  ...e,
                  label: undefined,
                  data: { ...(e.data ?? {}), kind: "stage", transition: { ...(e.data?.transition as BlueprintTransition), ...next } },
                }
              : kind === "substage"
                ? {
                    ...e,
                    label: undefined,
                    data: {
                      ...(e.data ?? {}),
                      kind: "substage",
                      substageTransition: { ...(e.data?.substageTransition as any), ...next },
                    },
                  }
                : kind === "substage_exit"
                  ? {
                      ...e,
                      label: undefined,
                      data: {
                        ...(e.data ?? {}),
                        kind: "substage_exit",
                        substageExit: { ...(e.data?.substageExit as any), ...next },
                      },
                    }
                  : e
            : e,
        ),
      );
    },
    [selectedEdgeId, selectedTransition, selectedEdge, setEdges],
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
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      style: DEFAULT_STAGE_NODE_SIZE,
      data: { label: payload.label, substages: [], defaultSubstageId: "", substageTransitions: [], substageExits: [] },
    };
    blurBlockingFocus();
    setSelectedNodeId(id);
    setSelectedEdgeId(null);
    setPanelTab("info");
    setNodes((nds) => [...nds, n]);
  };

  useEffect(() => {
    setEdges((eds) => applyCanvasEdgeChrome(eds, selectedEdgeId));
  }, [selectedEdgeId, setEdges]);

  useEffect(() => {
    if (selectedEdgeId && !edges.some((e) => e.id === selectedEdgeId)) {
      setSelectedEdgeId(null);
    }
  }, [edges, selectedEdgeId]);

  useEffect(() => {
    if (selectedNodeId && !nodes.some((n) => n.id === selectedNodeId)) {
      setSelectedNodeId(null);
    }
  }, [nodes, selectedNodeId]);

  const selectedNode = useMemo(() => nodes.find((n) => n.id === selectedNodeId) ?? null, [nodes, selectedNodeId]);
  const selectedStageNode = useMemo(() => {
    if (!selectedNodeId) return null;
    const direct = nodes.find((n) => n.id === selectedNodeId && n.type === STAGE_NODE_TYPE);
    if (direct) return direct as FlowNode<StageNodeData>;
    const group = parseSubstageGroupId(selectedNodeId);
    if (group) {
      const parent = nodes.find((n) => n.id === group.parentStateId && n.type === STAGE_NODE_TYPE);
      return (parent as FlowNode<StageNodeData> | undefined) ?? null;
    }
    const ss = parseSubstageNodeId(selectedNodeId);
    if (ss) {
      const parent = nodes.find((n) => n.id === ss.parentStateId && n.type === STAGE_NODE_TYPE);
      return (parent as FlowNode<StageNodeData> | undefined) ?? null;
    }
    return null;
  }, [nodes, selectedNodeId]);

  const syncSubstageNodesForStage = useCallback(
    (
      nds: FlowNode<StageNodeData | SubstageNodeData | SubstageGroupNodeData>[],
      stageId: string,
      substages: BlueprintSubstage[],
      stageLabel: string,
      parentPosition: { x: number; y: number },
    ) => {
      const groupId = substageGroupId(stageId);
      const keep = new Set(substages.map((ss) => substageNodeId(stageId, ss.id)));

      let next = nds.filter((n) => {
        if (n.id === groupId) return substages.length > 0;
        const parsed = parseSubstageNodeId(n.id);
        if (parsed?.parentStateId === stageId) return keep.has(n.id);
        return true;
      });

      if (substages.length === 0) return next;

      const box = computeSubstageGroupBox(substages.length);
      const existingGroup = next.find((n) => n.id === groupId);
      const groupPos = existingGroup?.position ?? {
        x: parentPosition.x - box.width - 42,
        y: parentPosition.y + 18,
      };

      const prevSize =
        existingGroup?.style?.width != null && existingGroup?.style?.height != null
          ? {
              width: Number(existingGroup.style.width) || box.width,
              height: Number(existingGroup.style.height) || box.height,
            }
          : undefined;
      const groupSize = resolveSubstageGroupSize(substages.length, prevSize);
      const groupNode: FlowNode<SubstageGroupNodeData> = {
        id: groupId,
        type: SUBSTAGE_GROUP_NODE_TYPE,
        position: groupPos,
        style: { width: groupSize.width, height: groupSize.height },
        zIndex: -1,
        selectable: true,
        draggable: true,
        data: {
          parentStateId: stageId,
          stageLabel,
          minWidth: box.width,
          minHeight: box.height,
        },
      };

      if (existingGroup) {
        next = next.map((n) => (n.id === groupId ? groupNode : n));
      } else {
        next = [...next, groupNode];
      }

      for (let i = 0; i < substages.length; i++) {
        const ss = substages[i]!;
        const nodeId = substageNodeId(stageId, ss.id);
        const defaultRel = { x: box.innerPadX, y: box.innerPadTop + i * box.rowHeight };
        const existing = next.find((n) => n.id === nodeId);
        const position = ss.position ?? existing?.position ?? defaultRel;
        const style = existing?.style ?? DEFAULT_SUBSTAGE_NODE_SIZE;
        const data: SubstageNodeData = {
          label: ss.label,
          substageId: ss.id,
          parentStateId: stageId,
          parentLabel: stageLabel,
        };
        if (existing) {
          next = next.map((n) =>
            n.id === nodeId
              ? {
                  ...n,
                  parentId: groupId,
                  extent: "parent" as const,
                  position,
                  style,
                  sourcePosition: Position.Right,
                  targetPosition: Position.Left,
                  data,
                }
              : n,
          );
        } else {
          next.push({
            id: nodeId,
            type: SUBSTAGE_NODE_TYPE,
            parentId: groupId,
            extent: "parent",
            position,
            sourcePosition: Position.Right,
            targetPosition: Position.Left,
            style,
            data,
          });
        }
      }
      return next;
    },
    [],
  );

  const updateSelectedNodeData = useCallback(
    (patch: Partial<StageNodeData>) => {
      if (!selectedNodeId) return;
      setNodes((nds) => {
        const stageNode = nds.find((n) => n.id === selectedNodeId && n.type === STAGE_NODE_TYPE) as
          | FlowNode<StageNodeData>
          | undefined;
        if (!stageNode) return nds;
        const merged: StageNodeData = {
          label: stageNode.data?.label ?? "Stage",
          substages: stageNode.data?.substages ?? [],
          defaultSubstageId: stageNode.data?.defaultSubstageId ?? stageNode.data?.substages?.[0]?.id ?? "",
          substageTransitions: stageNode.data?.substageTransitions ?? [],
          substageExits: stageNode.data?.substageExits ?? [],
          ...patch,
        };
        let next = nds.map((n) =>
          n.id === selectedNodeId ? { ...n, data: merged } : n,
        ) as FlowNode<StageNodeData | SubstageNodeData | SubstageGroupNodeData>[];
        if (patch.substages) {
          next = syncSubstageNodesForStage(
            next,
            selectedNodeId,
            patch.substages,
            merged.label,
            stageNode.position,
          );
        } else if (patch.label) {
          const gid = substageGroupId(selectedNodeId);
          next = next.map((n) => {
            if (n.id === gid && n.type === SUBSTAGE_GROUP_NODE_TYPE) {
              const gData = n.data as SubstageGroupNodeData;
              return { ...n, data: { ...gData, stageLabel: merged.label } };
            }
            const parsed = parseSubstageNodeId(n.id);
            if (parsed?.parentStateId === selectedNodeId && n.type === SUBSTAGE_NODE_TYPE) {
              return { ...n, data: { ...(n.data as SubstageNodeData), parentLabel: merged.label } };
            }
            return n;
          });
        }
        return next;
      });
    },
    [selectedNodeId, setNodes, syncSubstageNodesForStage],
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: FlowNode<StageNodeData | SubstageNodeData | SubstageGroupNodeData>) => {
      blurBlockingFocus();
      setSelectedEdgeId(null);
      const group = parseSubstageGroupId(node.id);
      if (group) {
        setSelectedNodeId(node.id);
        setPanelTab("info");
        return;
      }
      const ss = parseSubstageNodeId(node.id);
      if (ss) {
        setSelectedNodeId(ss.parentStateId);
        setPanelTab("info");
        return;
      }
      setSelectedNodeId(node.id);
      setPanelTab("info");
    },
    [blurBlockingFocus],
  );

  const onEdgesDelete = useCallback(() => {
    setSelectedEdgeId(null);
  }, []);

  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge<CanvasEdgeData>) => {
      blurBlockingFocus();
      setSelectedNodeId(null);
      setSelectedEdgeId(edge.id);
      setPanelTab("transition");
    },
    [blurBlockingFocus],
  );

  const onPaneClick = useCallback(() => {
    blurBlockingFocus();
    setSelectedEdgeId(null);
    setSelectedNodeId(null);
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
            edgeTypes={edgeTypes}
            fitView
            proOptions={{ hideAttribution: true }}
            deleteKeyCode={["Backspace", "Delete"]}
            defaultEdgeOptions={{ type: BLUEPRINT_LABELED_EDGE_TYPE, interactionWidth: 28 }}
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
                  More field settings →
                </Link>
              </div>

              <StageFieldOptionsPanel
                stageField={stagePickSource}
                onAddStage={handleAddStageOption}
                onRemoveStage={handleRemoveStageOption}
                onRenameStage={handleRenameStageOption}
                onDragSessionStart={() => {
                  draggingPaletteRef.current = true;
                }}
                onDragSessionEnd={() => {
                  draggingPaletteRef.current = false;
                  setDropHighlight(false);
                }}
              />
              {selectedStageNode ? (
                <StageInspector
                  stageLabel={selectedStageNode.data?.label ?? "Stage"}
                  substages={selectedStageNode.data?.substages ?? []}
                  defaultSubstageId={selectedStageNode.data?.defaultSubstageId ?? ""}
                  substageTransitions={selectedStageNode.data?.substageTransitions ?? []}
                  substageExits={selectedStageNode.data?.substageExits ?? []}
                  onSubstagesChange={(substages) => updateSelectedNodeData({ substages })}
                  onDefaultSubstageChange={(defaultSubstageId) => updateSelectedNodeData({ defaultSubstageId })}
                  onSubstageTransitionsChange={(substageTransitions) => updateSelectedNodeData({ substageTransitions })}
                  onSubstageExitsChange={(substageExits) => updateSelectedNodeData({ substageExits })}
                  onClose={() => setSelectedNodeId(null)}
                />
              ) : (
                <p className="shrink-0 rounded-lg border border-dashed border-border-soft bg-zinc-50 px-3 py-3 text-[10px] leading-relaxed text-muted">
                  <strong className="text-ink">Tip:</strong> click a main stage to add sub-stages — they appear in the dashed violet group linked to that stage.
                </p>
              )}
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
