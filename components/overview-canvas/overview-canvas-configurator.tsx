"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { DetailsPageStylePanel } from "@/components/overview-canvas/details-page-style-panel";
import { OverviewNodeBody } from "@/components/overview-canvas/overview-node-body";
import { PageAgentBar } from "@/components/crm/page-agent-bar";
import { useCrm } from "@/components/crm/crm-provider";
import { moduleSlot } from "@/lib/crm/agent-slots";
import {
  IconChevronDown,
  IconClose,
  IconPencil,
  IconPlus,
  IconSave,
  IconTrash,
} from "@/components/icons";
import { findModule, saveOverviewBuilder } from "@/lib/crm/ops";
import {
  CUSTOM_WIDGET_DISPLAYS,
  canvasNodeChromeTitle,
  canvasNodeIsCompactLayout,
  canvasNodeMinBounds,
  canvasNodeOmitsChromeHeader,
  emptyCustomWidgetSpec,
  hitTestSection,
  newCustomWidgetDefId,
  newOverviewNodeId,
  normalizeWidgetKind,
  OVERVIEW_WIDGET_PALETTE,
  resolveOverviewCanvas,
  type CustomWidgetDisplay,
  type CustomWidgetSpec,
  type OverviewCanvasDocument,
  type OverviewCanvasNode,
  type OverviewCustomWidgetDef,
} from "@/lib/crm/overview-canvas";
import type { CrmModule, CrmWorkspace } from "@/lib/crm/types";

const DND_WIDGET = "application/x-sirrus-overview-widget";
const DND_CUSTOM = "application/x-sirrus-overview-custom";
const DND_FIELD = "application/x-sirrus-overview-field";
const DND_ELEMENT = "application/x-sirrus-overview-element";

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

type RailTab = "data" | "elements" | "style";
type ResizeEdgeKind = "se" | "e" | "s";

export function OverviewCanvasConfigurator({ moduleId }: { moduleId: string }) {
  const { workspace, save } = useCrm();
  const mod = workspace ? findModule(workspace, moduleId) : undefined;
  const [doc, setDoc] = useState<OverviewCanvasDocument | null>(null);
  const [customWidgets, setCustomWidgets] = useState<OverviewCustomWidgetDef[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [railTab, setRailTab] = useState<RailTab>("data");
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [openPaletteId, setOpenPaletteId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mod) return;
    setDoc(resolveOverviewCanvas(mod.overviewLayout, mod.overviewCanvas));
    setCustomWidgets(mod.customOverviewWidgets ?? []);
    setSelectedId(null);
    setDirty(false);
  }, [mod?.id]);

  const apply = useCallback((fn: (d: OverviewCanvasDocument) => OverviewCanvasDocument) => {
    setDoc((cur) => (cur ? fn(cur) : cur));
    setDirty(true);
  }, []);

  const persist = () => {
    if (!workspace || !mod || !doc) return;
    save(saveOverviewBuilder(workspace, mod.id, doc, customWidgets));
    setDirty(false);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2600);
  };

  const activeTab = doc?.tabs.find((t) => t.id === doc.activeTabId) ?? doc?.tabs[0];
  const nodes = activeTab?.nodes ?? [];
  const selected = selectedId ? nodes.find((n) => n.id === selectedId) ?? null : null;
  const previewRecord = mod?.records[0] ?? null;

  if (!workspace || !mod || !doc) {
    return <div className="flex flex-1 items-center justify-center text-sm text-[#8b87a8]">Loading overview canvas…</div>;
  }

  const patchNode = (id: string, patch: Partial<OverviewCanvasNode>) => {
    apply((d) => ({
      ...d,
      tabs: d.tabs.map((t) =>
        t.id !== d.activeTabId ? t : { ...t, nodes: t.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)) },
      ),
    }));
  };

  const addFieldToSection = (sectionId: string, fieldId: string) => {
    const section = nodes.find((n) => n.id === sectionId);
    if (!section || section.type !== "section") return;
    const ids = section.fieldIds ?? [];
    if (ids.includes(fieldId)) return;
    patchNode(sectionId, { fieldIds: [...ids, fieldId] });
    setSelectedId(sectionId);
    setRailTab("style");
  };

  const placeCustom = (def: OverviewCustomWidgetDef) => {
    apply((d) => {
      const tab = d.tabs.find((t) => t.id === d.activeTabId);
      const z = (tab?.nodes.length ?? 0) + 1;
      const node: OverviewCanvasNode = {
        id: newOverviewNodeId(),
        type: "custom",
        title: def.title,
        spec: def.spec,
        widgetDefId: def.id,
        x: 0.08,
        y: 0.08,
        w: def.spec.display === "fields" ? 0.55 : 0.42,
        h: 0.32,
        z,
      };
      return {
        ...d,
        tabs: d.tabs.map((t) => (t.id === d.activeTabId ? { ...t, nodes: [...t.nodes, node] } : t)),
      };
    });
  };

  const selectTab = (tabId: string) => {
    apply((d) => (d.tabs.some((t) => t.id === tabId) ? { ...d, activeTabId: tabId } : d));
    setSelectedId(null);
  };

  const addCustomTab = () => {
    const label = window.prompt("New tab name", "New tab")?.trim();
    if (!label) return;
    const id = `custom-${newOverviewNodeId()}`;
    apply((d) => ({ ...d, tabs: [...d.tabs, { id, label, nodes: [] }], activeTabId: id }));
    setSelectedId(null);
  };

  const removeTab = (tabId: string) => {
    if (!tabId.startsWith("custom-")) return;
    apply((d) => {
      if (d.tabs.length <= 1) return d;
      const tabs = d.tabs.filter((t) => t.id !== tabId);
      return { ...d, tabs, activeTabId: d.activeTabId === tabId ? tabs[0]!.id : d.activeTabId };
    });
    setSelectedId(null);
  };

  const renameTab = (tabId: string, currentLabel: string) => {
    const next = window.prompt("Tab name", currentLabel)?.trim();
    if (!next || next === currentLabel) return;
    apply((d) => ({ ...d, tabs: d.tabs.map((t) => (t.id === tabId ? { ...t, label: next } : t)) }));
  };

  const railTabBtn = (id: RailTab, label: string) => (
    <button
      key={id}
      type="button"
      onClick={() => setRailTab(id)}
      className={`rounded-lg px-2 py-1 text-[10px] font-semibold ${
        railTab === id ? "bg-[#0f6b5c] text-white" : "bg-white/80 text-[#5c5878] hover:bg-white"
      }`}
    >
      {label}
    </button>
  );

  const recordListHref = `/crm/modules/${mod.id}`;
  const settingsHref = `/developer/lead-settings/modules-configurator?module=${encodeURIComponent(mod.id)}&pane=overview`;

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-[min(100%,1920px)] flex-1 flex-col gap-2 px-3 pb-4 pt-2">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <Link
            href={`/developer/lead-settings/modules-configurator?module=${encodeURIComponent(mod.id)}`}
            className="w-fit text-[10px] font-semibold text-[#0f6b5c] hover:underline"
          >
            ← {mod.pluralLabel}
          </Link>
          <h1 className="text-base font-semibold tracking-tight text-[#16140f]">Details Page Builder</h1>
          <p className="max-w-xl text-[10px] leading-snug text-[#8b87a8]">
            Optional extra widgets for this module’s record page. PAIR, AI Summary, and fields already show by default.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <PageAgentBar slotKey={moduleSlot(mod.id, "overview")} moduleLabel={mod.pluralLabel} compact />
          <span className="flex items-center gap-1 text-[10px] font-semibold text-[#5c5878]">
            Module
            <span className="rounded-md border border-slate-200/90 bg-white px-1.5 py-1 text-[11px] text-[#16140f]">
              {mod.pluralLabel}
            </span>
          </span>
          <Link
            href={recordListHref}
            className="rounded-md px-2 py-1 text-[10px] font-semibold text-[#0f6b5c] hover:bg-[#0f6b5c]/10"
          >
            Lead detail
          </Link>
          <Link href={settingsHref} className="rounded-md px-2 py-1 text-[10px] font-semibold text-[#0f6b5c] hover:bg-[#0f6b5c]/10">
            Settings URL
          </Link>
          <button
            type="button"
            onClick={persist}
            className="inline-flex items-center gap-1 rounded-lg bg-[#0f6b5c] px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:opacity-95"
          >
            <IconSave className="size-[15px]" aria-hidden />
            Save
          </button>
          {saved ? (
            <span
              role="status"
              className="inline-flex items-center rounded-lg border border-emerald-200/90 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-800"
            >
              Saved — preview updated
            </span>
          ) : null}
          {dirty && !saved ? <span className="text-[11px] text-[#8b87a8]">Unsaved changes</span> : null}
          <button
            type="button"
            onClick={() => {
              apply((d) => ({
                ...d,
                tabs: d.tabs.map((t) => (t.id === d.activeTabId ? { ...t, nodes: [] } : t)),
              }));
              setSelectedId(null);
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#5c5878] hover:bg-slate-50"
          >
            <IconTrash className="size-[15px]" aria-hidden />
            Clear tab
          </button>
        </div>
      </div>

      <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 gap-2 lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:gap-3">
        <aside className="flex max-h-[min(48vh,380px)] min-h-0 shrink-0 flex-col rounded-xl border border-[#0f6b5c]/20 bg-gradient-to-br from-[#f4f5ff] to-white p-2 shadow-sm lg:max-h-none lg:justify-self-stretch">
          <div className="mb-2 flex shrink-0 flex-wrap gap-1">
            {railTabBtn("data", "Data")}
            {railTabBtn("elements", "Elements")}
            {railTabBtn("style", "Style")}
          </div>

          {railTab === "style" ? (
            <div className="min-h-0 flex-1 overflow-y-auto pr-0.5 [scrollbar-width:thin]">
              <DetailsPageStylePanel
                node={selected}
                onPatch={(patch) => selected && patchNode(selected.id, patch)}
                extra={
                  selected ? (
                    <StyleExtras
                      module={mod}
                      workspaceModules={workspace.modules}
                      node={selected}
                      onPatch={(patch) => patchNode(selected.id, patch)}
                      onDelete={() => {
                        apply((d) => ({
                          ...d,
                          tabs: d.tabs.map((t) =>
                            t.id === d.activeTabId ? { ...t, nodes: t.nodes.filter((n) => n.id !== selected.id) } : t,
                          ),
                        }));
                        setSelectedId(null);
                      }}
                    />
                  ) : null
                }
              />
            </div>
          ) : railTab === "elements" ? (
            <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-0.5 [scrollbar-width:thin]" role="list">
              {(
                [
                  { element: "section" as const, title: "Section" },
                  { element: "text" as const, title: "Text" },
                  { element: "line" as const, title: "Line" },
                  { element: "icon" as const, title: "Icon" },
                ] as const
              ).map((row) => (
                <li key={row.element}>
                  <div
                    draggable
                    role="button"
                    tabIndex={0}
                    onDragStart={(e) => {
                      e.dataTransfer.setData(DND_ELEMENT, JSON.stringify({ element: row.element }));
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    className="cursor-grab rounded-lg border border-slate-200/90 bg-white px-2 py-1.5 text-[11px] font-semibold text-[#16140f] shadow-sm active:cursor-grabbing"
                  >
                    {row.title}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <DataRail
              module={mod}
              customWidgets={customWidgets}
              selected={selected}
              openPaletteId={openPaletteId}
              setOpenPaletteId={setOpenPaletteId}
              onCreate={() => setCreateOpen(true)}
              onPlaceCustom={placeCustom}
              onPatchDetailsFields={(ids) => {
                if (selected && selected.type === "widget" && normalizeWidgetKind(selected.kind) === "lead-details") {
                  patchNode(selected.id, { fieldIds: ids });
                }
              }}
            />
          )}
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-slate-200/80 pb-1.5" role="tablist" aria-label="Detail tabs">
            {doc.tabs.map((t) => {
              const active = doc.activeTabId === t.id;
              const removable = t.id.startsWith("custom-") && doc.tabs.length > 1;
              const activeSeg = active ? "bg-[#0f6b5c] text-white" : "bg-white text-[#16140f]";
              const borderBetween = active ? "border-l border-white/25" : "border-l border-slate-200/90";
              return (
                <div
                  key={t.id}
                  className={`inline-flex items-stretch overflow-hidden rounded-lg border shadow-sm ${
                    active ? "border-[#0f6b5c]/45 ring-1 ring-[#0f6b5c]/15" : "border-slate-200/90"
                  }`}
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => selectTab(t.id)}
                    onDoubleClick={(ev) => {
                      ev.preventDefault();
                      renameTab(t.id, t.label);
                    }}
                    title="Select tab · double-click to rename"
                    className={`max-w-[8.25rem] truncate px-2 py-1 text-left text-[10px] font-semibold transition-colors hover:opacity-95 ${activeSeg} ${
                      active ? "hover:bg-[#2f318f]" : "hover:bg-slate-50"
                    }`}
                  >
                    {t.label}
                  </button>
                  <button
                    type="button"
                    aria-label={`Rename ${t.label}`}
                    title="Rename tab"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      renameTab(t.id, t.label);
                    }}
                    className={`inline-flex items-center justify-center px-1.5 py-1 ${activeSeg} ${borderBetween} ${
                      active ? "hover:bg-[#2f318f]" : "bg-slate-50 text-[#0f6b5c] hover:bg-[#eef0ff]"
                    }`}
                  >
                    <IconPencil className="size-[11px]" aria-hidden />
                  </button>
                  {removable ? (
                    <button
                      type="button"
                      title={`Remove tab "${t.label}"`}
                      aria-label={`Remove tab ${t.label}`}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        removeTab(t.id);
                      }}
                      className={`inline-flex items-center justify-center px-1.5 py-1 ${borderBetween} ${
                        active
                          ? "bg-[#0f6b5c] text-white hover:bg-red-600 hover:text-white"
                          : "bg-slate-50 text-[#5c5878] hover:bg-red-50 hover:text-red-700"
                      }`}
                    >
                      <IconClose className="size-3" aria-hidden />
                    </button>
                  ) : null}
                </div>
              );
            })}
            <button
              type="button"
              onClick={addCustomTab}
              className="inline-flex items-center gap-0.5 rounded-lg border border-dashed border-[#0f6b5c]/35 bg-white px-2 py-1 text-[10px] font-semibold text-[#0f6b5c] hover:bg-[#f4f5ff]"
              title="Add a custom tab"
            >
              <IconPlus className="size-3" aria-hidden />
              Tab
            </button>
          </div>

          <OverviewBuilderCanvas
            module={mod}
            workspace={workspace}
            nodes={nodes}
            selectedId={selectedId}
            previewRecord={previewRecord}
            canvasRef={canvasRef}
            activeTabLabel={activeTab?.label ?? "this tab"}
            onSelect={(id) => {
              setSelectedId(id);
              if (id) setRailTab("style");
            }}
            onAddFieldToSection={addFieldToSection}
            onDrop={(node) => {
              apply((d) => ({
                ...d,
                tabs: d.tabs.map((t) =>
                  t.id === d.activeTabId ? { ...t, nodes: [...t.nodes, { ...node, z: t.nodes.length + 1 }] } : t,
                ),
              }));
              setSelectedId(node.id);
              if (node.type === "section" || node.type === "custom" || node.type === "widget") setRailTab("style");
            }}
            onChange={(id, patch) => patchNode(id, patch)}
            onDelete={(id) => {
              apply((d) => ({
                ...d,
                tabs: d.tabs.map((t) =>
                  t.id === d.activeTabId ? { ...t, nodes: t.nodes.filter((n) => n.id !== id) } : t,
                ),
              }));
              setSelectedId((cur) => (cur === id ? null : cur));
            }}
          />
        </div>
      </div>

      {createOpen ? (
        <CreateWidgetDialog
          module={mod}
          workspaceModules={workspace.modules}
          onClose={() => setCreateOpen(false)}
          onCreate={(def) => {
            setCustomWidgets((cur) => [...cur, def]);
            setDirty(true);
            placeCustom(def);
            setCreateOpen(false);
            setRailTab("data");
          }}
        />
      ) : null}
    </div>
  );
}

function DataRail({
  module: mod,
  customWidgets,
  selected,
  openPaletteId,
  setOpenPaletteId,
  onCreate,
  onPlaceCustom,
  onPatchDetailsFields,
}: {
  module: CrmModule;
  customWidgets: OverviewCustomWidgetDef[];
  selected: OverviewCanvasNode | null;
  openPaletteId: string | null;
  setOpenPaletteId: (id: string | null) => void;
  onCreate: () => void;
  onPlaceCustom: (def: OverviewCustomWidgetDef) => void;
  onPatchDetailsFields: (ids: string[]) => void;
}) {
  const selectedDetails =
    selected && selected.type === "widget" && normalizeWidgetKind(selected.kind) === "lead-details" ? selected : null;
  const detailsIds = selectedDetails?.fieldIds?.length ? selectedDetails.fieldIds : mod.fields.map((f) => f.id);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-[9px] font-semibold uppercase tracking-wide text-[#6b6578]">Your widgets</h3>
          <button type="button" onClick={onCreate} className="text-[10px] font-semibold text-[#0f6b5c]">
            + Create
          </button>
        </div>
        {customWidgets.length === 0 ? (
          <p className="mt-1 text-[10px] leading-relaxed text-[#8b87a8]">
            Build a widget from fields — e.g. note date + note content as a timeline.
          </p>
        ) : (
          <ul className="mt-1 space-y-1">
            {customWidgets.map((w) => (
              <li key={w.id}>
                <div
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(DND_CUSTOM, JSON.stringify(w));
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                  onDoubleClick={() => onPlaceCustom(w)}
                  className="cursor-grab rounded-lg border border-[#0f6b5c]/30 bg-white px-2 py-1.5 text-[11px] font-semibold text-[#16140f] shadow-sm active:cursor-grabbing"
                >
                  {w.title}
                  <span className="ml-1 text-[10px] font-normal capitalize text-[#8b87a8]">{w.spec.display}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="text-[9px] font-semibold uppercase tracking-wide text-[#6b6578]">Fields</h3>
        <ul className="mt-1 max-h-40 space-y-0.5 overflow-y-auto pr-0.5 [scrollbar-width:thin]">
          {mod.fields.map((f) => (
            <li key={f.id}>
              <div
                draggable
                role="button"
                tabIndex={0}
                onDragStart={(e) => {
                  e.dataTransfer.setData(DND_FIELD, JSON.stringify({ fieldId: f.id }));
                  e.dataTransfer.effectAllowed = "copy";
                }}
                className="cursor-grab rounded-md border border-slate-200/80 bg-white px-1.5 py-1 text-[10px] font-semibold text-[#16140f] active:cursor-grabbing"
              >
                {f.label}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="min-h-0 flex-1">
        <h3 className="text-[9px] font-semibold uppercase tracking-wide text-[#6b6578]">Widgets</h3>
        <ul className="mt-1 min-h-0 flex-1 space-y-1 overflow-y-auto pr-0.5 [scrollbar-width:thin]" role="list">
          {OVERVIEW_WIDGET_PALETTE.map((item) => {
            const dndPayload = JSON.stringify({
              id: item.id,
              title: item.title,
              defaultW: item.defaultW,
              defaultH: item.defaultH,
            });
            const chipClass =
              "cursor-grab rounded-lg border border-slate-200/90 bg-white px-2 py-1.5 text-[11px] font-semibold text-[#16140f] shadow-sm active:cursor-grabbing min-w-0 flex-1";

            if (item.id !== "lead-details") {
              return (
                <li key={item.id}>
                  <div
                    draggable
                    role="button"
                    tabIndex={0}
                    onDragStart={(e) => {
                      e.dataTransfer.setData(DND_WIDGET, dndPayload);
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    className={chipClass}
                  >
                    {item.title}
                  </div>
                </li>
              );
            }

            const isOpen = openPaletteId === item.id;
            return (
              <li
                key={item.id}
                className={`overflow-hidden rounded-lg border shadow-[0_1px_0_rgba(15,23,42,0.04)] ${
                  isOpen ? "border-[#0f6b5c]/35 bg-white" : "border-slate-200/90 bg-[#f8f9fc]"
                }`}
              >
                <div className="flex items-stretch gap-0.5">
                  <div
                    draggable
                    role="button"
                    tabIndex={0}
                    onDragStart={(e) => {
                      e.dataTransfer.setData(DND_WIDGET, dndPayload);
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    className={chipClass}
                  >
                    {item.title}
                  </div>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    title="Configure left rail"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenPaletteId(isOpen ? null : item.id);
                    }}
                    className="inline-flex w-7 shrink-0 flex-col items-center justify-center rounded-md border border-transparent text-[#0f6b5c] hover:bg-white/90"
                  >
                    <span className="sr-only">Configure</span>
                    <IconChevronDown className={`size-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden />
                  </button>
                </div>
                {isOpen ? (
                  <div className="border-t border-slate-200/80 bg-white px-1.5 pb-2 pt-1.5">
                    <p className="mb-1 text-[9px] text-[#8b87a8]">
                      Fields shown in Lead Details. Select the widget on the canvas, then toggle.
                    </p>
                    <ul className="max-h-40 space-y-0.5 overflow-y-auto [scrollbar-width:thin]">
                      {mod.fields.map((f) => {
                        const checked = detailsIds.includes(f.id);
                        return (
                          <li key={f.id}>
                            <label className="flex cursor-pointer items-center gap-1.5 text-[10px] text-[#16140f]">
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={!selectedDetails}
                                onChange={() => {
                                  const next = checked
                                    ? detailsIds.filter((x) => x !== f.id)
                                    : [...detailsIds, f.id];
                                  onPatchDetailsFields(next);
                                }}
                              />
                              {f.label}
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function StyleExtras({
  module: mod,
  workspaceModules,
  node,
  onPatch,
  onDelete,
}: {
  module: CrmModule;
  workspaceModules: CrmModule[];
  node: OverviewCanvasNode;
  onPatch: (patch: Partial<OverviewCanvasNode>) => void;
  onDelete: () => void;
}) {
  return (
    <div className="mt-3 space-y-3 border-t border-slate-200/80 pt-3">
      {node.type === "section" ? (
        <SectionFieldEditor module={mod} node={node} onPatch={onPatch} />
      ) : null}
      {node.type === "custom" ? (
        <WidgetSpecFields
          currentModule={mod}
          fieldSource={
            node.spec?.sourceModuleId
              ? workspaceModules.find((m) => m.id === node.spec?.sourceModuleId) ?? mod
              : mod
          }
          workspaceModules={workspaceModules}
          spec={node.spec ?? emptyCustomWidgetSpec()}
          onChange={(spec) => onPatch({ spec })}
        />
      ) : null}
      {node.type === "widget" && normalizeWidgetKind(node.kind) === "lead-details" ? (
        <SectionFieldEditor module={mod} node={node} onPatch={onPatch} heading="Fields in Lead Details" />
      ) : null}
      <button
        type="button"
        onClick={onDelete}
        className="rounded-lg px-2 py-1 text-[11px] font-medium text-red-600 ring-1 ring-red-200"
      >
        Delete
      </button>
    </div>
  );
}

function SectionFieldEditor({
  module: mod,
  node,
  onPatch,
  heading = "Fields in section",
}: {
  module: CrmModule;
  node: OverviewCanvasNode;
  onPatch: (patch: Partial<OverviewCanvasNode>) => void;
  heading?: string;
}) {
  const ids = node.fieldIds ?? [];
  return (
    <div className="space-y-2">
      <p className="text-[9px] font-semibold uppercase tracking-wide text-[#8b87a8]">{heading}</p>
      {ids.length === 0 ? (
        <p className="text-[11px] text-[#8b87a8]">Drag any field from Data onto this section.</p>
      ) : (
        <ul className="space-y-1">
          {ids.map((id, idx) => {
            const f = mod.fields.find((x) => x.id === id);
            return (
              <li key={id} className="flex items-center gap-1 rounded-md border border-slate-200/80 bg-white px-1.5 py-1 text-[11px]">
                <span className="min-w-0 flex-1 truncate text-[#16140f]">{f?.label ?? id}</span>
                <button
                  type="button"
                  className="px-1 text-[#8b87a8]"
                  onClick={() => {
                    if (idx === 0) return;
                    const next = [...ids];
                    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                    onPatch({ fieldIds: next });
                  }}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="px-1 text-[#8b87a8]"
                  onClick={() => {
                    if (idx >= ids.length - 1) return;
                    const next = [...ids];
                    [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
                    onPatch({ fieldIds: next });
                  }}
                >
                  ↓
                </button>
                <button type="button" className="px-1 text-red-600" onClick={() => onPatch({ fieldIds: ids.filter((x) => x !== id) })}>
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <label className="block text-[11px] text-[#8b87a8]">
        Add field
        <select
          value=""
          onChange={(e) => {
            const id = e.target.value;
            if (!id || ids.includes(id)) return;
            onPatch({ fieldIds: [...ids, id] });
          }}
          className="mt-1 w-full rounded-lg border border-slate-200/90 bg-white px-2 py-1 text-sm"
        >
          <option value="">Choose…</option>
          {mod.fields
            .filter((f) => !ids.includes(f.id))
            .map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
        </select>
      </label>
    </div>
  );
}

function WidgetSpecFields({
  currentModule,
  fieldSource,
  workspaceModules,
  spec,
  onChange,
}: {
  currentModule: CrmModule;
  fieldSource: CrmModule;
  workspaceModules: CrmModule[];
  spec: CustomWidgetSpec;
  onChange: (spec: CustomWidgetSpec) => void;
}) {
  const toggleField = (id: string) => {
    const has = spec.fieldIds.includes(id);
    onChange({ ...spec, fieldIds: has ? spec.fieldIds.filter((x) => x !== id) : [...spec.fieldIds, id] });
  };
  return (
    <>
      <label className="block text-[11px] text-[#8b87a8]">
        Layout
        <select
          value={spec.display}
          onChange={(e) => onChange({ ...spec, display: e.target.value as CustomWidgetDisplay })}
          className="mt-1 w-full rounded-lg border border-slate-200/90 bg-white px-2 py-1 text-sm"
        >
          {CUSTOM_WIDGET_DISPLAYS.map((d) => (
            <option key={d} value={d}>
              {d === "fields" ? "Field group" : d === "timeline" ? "Timeline" : d === "table" ? "Table" : "List"}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-[11px] text-[#8b87a8]">
        Data from
        <select
          value={spec.sourceModuleId ?? ""}
          onChange={(e) => onChange({ ...spec, sourceModuleId: e.target.value || null, linkFieldId: null, fieldIds: [] })}
          className="mt-1 w-full rounded-lg border border-slate-200/90 bg-white px-2 py-1 text-sm"
        >
          <option value="">This record</option>
          {workspaceModules
            .filter((m) => m.id !== currentModule.id)
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.pluralLabel} (related list)
              </option>
            ))}
        </select>
      </label>
      {spec.sourceModuleId ? (
        <label className="block text-[11px] text-[#8b87a8]">
          Link field (matches this record’s id)
          <select
            value={spec.linkFieldId ?? ""}
            onChange={(e) => onChange({ ...spec, linkFieldId: e.target.value || null })}
            className="mt-1 w-full rounded-lg border border-slate-200/90 bg-white px-2 py-1 text-sm"
          >
            <option value="">Show all rows</option>
            {fieldSource.fields.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#8b87a8]">Fields</p>
      <ul className="max-h-40 space-y-1 overflow-y-auto">
        {fieldSource.fields.map((f) => (
          <li key={f.id}>
            <label className="flex items-center gap-2 text-[12px] text-[#16140f]">
              <input type="checkbox" checked={spec.fieldIds.includes(f.id)} onChange={() => toggleField(f.id)} />
              {f.label}
            </label>
          </li>
        ))}
      </ul>
      {spec.display === "timeline" ? (
        <>
          <RoleSelect label="Date field" fields={fieldSource.fields} value={spec.dateFieldId} onChange={(v) => onChange({ ...spec, dateFieldId: v })} />
          <RoleSelect label="Title field" fields={fieldSource.fields} value={spec.titleFieldId} onChange={(v) => onChange({ ...spec, titleFieldId: v })} />
          <RoleSelect label="Content field" fields={fieldSource.fields} value={spec.bodyFieldId} onChange={(v) => onChange({ ...spec, bodyFieldId: v })} />
        </>
      ) : null}
    </>
  );
}

function RoleSelect({
  label,
  fields,
  value,
  onChange,
}: {
  label: string;
  fields: { id: string; label: string }[];
  value?: string;
  onChange: (v: string | undefined) => void;
}) {
  return (
    <label className="block text-[11px] text-[#8b87a8]">
      {label}
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="mt-1 w-full rounded-lg border border-slate-200/90 bg-white px-2 py-1 text-sm"
      >
        <option value="">None</option>
        {fields.map((f) => (
          <option key={f.id} value={f.id}>
            {f.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function CreateWidgetDialog({
  module: mod,
  workspaceModules,
  onClose,
  onCreate,
}: {
  module: CrmModule;
  workspaceModules: CrmModule[];
  onClose: () => void;
  onCreate: (def: OverviewCustomWidgetDef) => void;
}) {
  const [title, setTitle] = useState("Old notes");
  const [spec, setSpec] = useState<CustomWidgetSpec>({ ...emptyCustomWidgetSpec(), display: "timeline" });
  const fieldSource = spec.sourceModuleId
    ? workspaceModules.find((m) => m.id === spec.sourceModuleId) ?? mod
    : mod;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#16140f]/25 p-4"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[24px] border border-slate-200/90 bg-white p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-[#16140f]">Create widget</h2>
        <p className="mt-1 text-sm text-[#8b87a8]">
          Pick fields from Fields configurator. Timeline maps a date and content field — e.g. note date + note content.
        </p>
        <label className="mt-4 block text-xs font-medium text-[#8b87a8]">
          Name
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-sm text-[#16140f]"
          />
        </label>
        <div className="mt-3 space-y-3">
          <WidgetSpecFields
            currentModule={mod}
            fieldSource={fieldSource}
            workspaceModules={workspaceModules}
            spec={spec}
            onChange={setSpec}
          />
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-full px-3.5 py-1.5 text-xs font-medium text-[#16140f] ring-1 ring-slate-200">
            Cancel
          </button>
          <button
            type="button"
            disabled={!title.trim() || spec.fieldIds.length === 0}
            onClick={() =>
              onCreate({
                id: newCustomWidgetDefId(),
                title: title.trim(),
                spec,
              })
            }
            className="rounded-full bg-[#0f6b5c] px-3.5 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
          >
            Add to canvas
          </button>
        </div>
      </div>
    </div>
  );
}

function OverviewBuilderCanvas({
  module: mod,
  workspace,
  nodes,
  selectedId,
  previewRecord,
  canvasRef,
  activeTabLabel,
  onSelect,
  onAddFieldToSection,
  onDrop,
  onChange,
  onDelete,
}: {
  module: CrmModule;
  workspace: CrmWorkspace;
  nodes: OverviewCanvasNode[];
  selectedId: string | null;
  previewRecord: CrmModule["records"][number] | null;
  canvasRef: RefObject<HTMLDivElement | null>;
  activeTabLabel: string;
  onSelect: (id: string | null) => void;
  onAddFieldToSection: (sectionId: string, fieldId: string) => void;
  onDrop: (node: OverviewCanvasNode) => void;
  onChange: (id: string, patch: Partial<OverviewCanvasNode>) => void;
  onDelete: (id: string) => void;
}) {
  const placeRect = useCallback((px: number, py: number, w: number, h: number) => {
    const nw = clamp(w, 0.04, 1);
    const nh = clamp(h, 0.015, 1);
    return { x: clamp(px - nw / 2, 0, 1 - nw), y: clamp(py - nh / 2, 0, 1 - nh), w: nw, h: nh };
  }, []);

  return (
    <div
      ref={canvasRef}
      className="relative min-h-0 w-full flex-1 overflow-hidden rounded-2xl border-2 border-dashed border-slate-400/50 bg-[#e2e6ef] shadow-[inset_0_2px_12px_rgba(255,255,255,0.45)] lg:min-h-[calc(100dvh-8.25rem)]"
      style={{
        backgroundImage:
          "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
        backgroundSize: "24px 24px",
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }}
      onClick={() => onSelect(null)}
      onDrop={(e) => {
        e.preventDefault();
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width;
        const py = (e.clientY - rect.top) / rect.height;

        const rawF = e.dataTransfer.getData(DND_FIELD);
        if (rawF) {
          const { fieldId } = JSON.parse(rawF) as { fieldId: string };
          const section = hitTestSection(nodes, px, py);
          if (section) {
            onAddFieldToSection(section.id, fieldId);
            return;
          }
          const box = placeRect(px, py, 0.22, 0.055);
          onDrop({ id: newOverviewNodeId(), type: "field", fieldId, z: 1, ...box });
          return;
        }

        const rawW = e.dataTransfer.getData(DND_WIDGET);
        if (rawW) {
          const payload = JSON.parse(rawW) as { id: string; title: string; defaultW: number; defaultH: number };
          const box = placeRect(px, py, payload.defaultW, payload.defaultH);
          const extras =
            payload.id === "lead-details" ? { fieldIds: mod.fields.map((f) => f.id) } : {};
          onDrop({ id: newOverviewNodeId(), type: "widget", kind: payload.id, title: payload.title, z: 1, ...box, ...extras });
          return;
        }

        const rawC = e.dataTransfer.getData(DND_CUSTOM);
        if (rawC) {
          const def = JSON.parse(rawC) as OverviewCustomWidgetDef;
          const box = placeRect(px, py, 0.46, 0.32);
          onDrop({
            id: newOverviewNodeId(),
            type: "custom",
            title: def.title,
            spec: def.spec,
            widgetDefId: def.id,
            z: 1,
            ...box,
          });
          return;
        }

        const rawE = e.dataTransfer.getData(DND_ELEMENT);
        if (rawE) {
          const { element } = JSON.parse(rawE) as { element: "section" | "text" | "line" | "icon" };
          if (element === "section") {
            const box = placeRect(px, py, 0.38, 0.16);
            onDrop({ id: newOverviewNodeId(), type: "section", label: "Section", fieldIds: [], z: 1, ...box });
          } else if (element === "text") {
            const box = placeRect(px, py, 0.28, 0.065);
            onDrop({
              id: newOverviewNodeId(),
              type: "text",
              z: 1,
              textStyle: { content: "Text block", fontSizePx: 13, color: "#334155" },
              content: "Text block",
              ...box,
            });
          } else if (element === "line") {
            const box = placeRect(px, py, 0.32, 0.028);
            onDrop({
              id: newOverviewNodeId(),
              type: "line",
              z: 1,
              lineStyle: { orientation: "horizontal", thicknessPx: 1, color: "#cbd5e1" },
              ...box,
            });
          } else {
            const box = placeRect(px, py, 0.055, 0.065);
            onDrop({
              id: newOverviewNodeId(),
              type: "icon",
              z: 1,
              iconStyle: { glyph: "star", iconColor: "#0f6b5c" },
              ...box,
            });
          }
        }
      }}
    >
      {nodes.length === 0 ? (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 px-6 text-center text-sm text-[#8b87a8]">
          <span>
            Drop <span className="font-semibold text-[#5c5878]">fields</span>,{" "}
            <span className="font-semibold text-[#5c5878]">widgets</span>, or{" "}
            <span className="font-semibold text-[#5c5878]">elements</span> on{" "}
            <span className="font-semibold text-[#5c5878]">{activeTabLabel}</span>.
          </span>
          <span className="text-[10px] text-[#a8a4b8]">Use the Style tab after selecting an item.</span>
        </div>
      ) : null}

      {[...nodes]
        .sort((a, b) => a.z - b.z)
        .map((n) => (
          <PlacedNode
            key={n.id}
            node={n}
            module={mod}
            workspace={workspace}
            record={previewRecord}
            selected={n.id === selectedId}
            canvasRef={canvasRef}
            onSelect={() => onSelect(n.id)}
            onChange={(patch) => onChange(n.id, patch)}
            onDelete={() => onDelete(n.id)}
          />
        ))}
    </div>
  );
}

function PlacedNode({
  node,
  module: mod,
  workspace,
  record,
  selected,
  canvasRef,
  onSelect,
  onChange,
  onDelete,
}: {
  node: OverviewCanvasNode;
  module: CrmModule;
  workspace: CrmWorkspace;
  record: CrmModule["records"][number] | null;
  selected: boolean;
  canvasRef: RefObject<HTMLDivElement | null>;
  onSelect: () => void;
  onChange: (patch: Partial<OverviewCanvasNode>) => void;
  onDelete: () => void;
}) {
  const nodeRef = useRef(node);
  nodeRef.current = node;
  const changeRef = useRef(onChange);
  changeRef.current = onChange;
  const interaction = useRef<{
    mode: "move" | "resize";
    kind?: ResizeEdgeKind;
    px: number;
    py: number;
    x0: number;
    y0: number;
    w0: number;
    h0: number;
  } | null>(null);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const canvas = canvasRef.current;
      const state = interaction.current;
      if (!canvas || !state) return;
      const n = nodeRef.current;
      const rect = canvas.getBoundingClientRect();
      const fx = (e.clientX - rect.left) / rect.width;
      const fy = (e.clientY - rect.top) / rect.height;
      const { minW, minH } = canvasNodeMinBounds(n);
      if (state.mode === "move") {
        const dx = fx - state.px;
        const dy = fy - state.py;
        changeRef.current({ x: clamp(state.x0 + dx, 0, 1 - n.w), y: clamp(state.y0 + dy, 0, 1 - n.h) });
      } else {
        const dw = fx - state.px;
        const dh = fy - state.py;
        const patch: Partial<OverviewCanvasNode> = {};
        if (state.kind === "se" || state.kind === "e") {
          patch.w = clamp(state.w0 + dw, minW, 1 - state.x0);
        }
        if (state.kind === "se" || state.kind === "s") {
          patch.h = clamp(state.h0 + dh, minH, 1 - state.y0);
        }
        changeRef.current(patch);
      }
    };
    const up = () => {
      interaction.current = null;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [canvasRef]);

  const compact = canvasNodeIsCompactLayout(node);
  const omitChromeHeader = canvasNodeOmitsChromeHeader(node);
  const resizeInset = omitChromeHeader ? "top-1" : compact ? "top-7" : "top-9";
  const resizeBottom = omitChromeHeader ? "bottom-5" : "bottom-9";

  const startMove = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    interaction.current = {
      mode: "move",
      px: (e.clientX - rect.left) / rect.width,
      py: (e.clientY - rect.top) / rect.height,
      x0: node.x,
      y0: node.y,
      w0: node.w,
      h0: node.h,
    };
  };

  const startResize = (kind: ResizeEdgeKind) => (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    interaction.current = {
      mode: "resize",
      kind,
      px: (e.clientX - rect.left) / rect.width,
      py: (e.clientY - rect.top) / rect.height,
      w0: node.w,
      h0: node.h,
      x0: node.x,
      y0: node.y,
    };
  };

  return (
    <div
      role="presentation"
      className={`isolate absolute flex h-full select-none flex-col bg-white/95 backdrop-blur-sm transition-shadow ${
        omitChromeHeader
          ? `overflow-hidden rounded-lg border shadow-sm ${
              selected ? "border-[#0f6b5c] ring-1 ring-[#0f6b5c]/25" : "border-slate-200/90"
            }`
          : compact
            ? `rounded-lg border shadow-sm ${
                selected ? "border-[#0f6b5c] ring-1 ring-[#0f6b5c]/25" : "border-slate-200/90"
              }`
            : `rounded-xl border-2 shadow-lg ${
                selected ? "border-[#0f6b5c] shadow-[0_8px_28px_-8px_rgba(52,54,156,0.35)]" : "border-slate-300/80"
              }`
      }`}
      style={{
        left: `${node.x * 100}%`,
        top: `${node.y * 100}%`,
        width: `${node.w * 100}%`,
        height: `${node.h * 100}%`,
        zIndex: node.z,
        touchAction: "none",
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      {!omitChromeHeader ? (
        <div
          className={`relative z-30 flex shrink-0 touch-none items-center gap-0.5 border-b border-slate-200/80 ${
            compact ? "h-6 min-h-[1.5rem] rounded-t-md bg-slate-50/95 px-1 py-0" : "rounded-t-[10px] bg-gradient-to-r from-[#f4f5ff] to-white px-1.5 py-0.5"
          }`}
          style={
            node.type === "widget" || node.type === "custom"
              ? {
                  background: node.headerStyle?.backgroundColor ?? "linear-gradient(to right, #f4f5ff, white)",
                  color: node.headerStyle?.color,
                }
              : compact
                ? undefined
                : { background: "linear-gradient(to right, #f4f5ff, white)" }
          }
        >
          <div
            onPointerDown={startMove}
            className={`flex min-w-0 flex-1 cursor-grab items-center active:cursor-grabbing ${compact ? "py-0" : "gap-1 py-0.5"}`}
          >
            <span
              className={`min-w-0 truncate font-semibold text-[#16140f] ${compact ? "text-[9px]" : "text-[10px]"}`}
              style={
                (node.type === "widget" || node.type === "custom") && node.headerStyle?.color
                  ? { color: node.headerStyle.color }
                  : undefined
              }
            >
              {canvasNodeChromeTitle(node)}
            </span>
            {!compact ? <span className="shrink-0 text-[9px] font-medium text-[#8b87a8]">{node.type}</span> : null}
          </div>
          {selected ? (
            <button
              type="button"
              aria-label="Remove item"
              title="Remove"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className={`inline-flex shrink-0 rounded-md border border-red-200/90 bg-white text-red-600 shadow-sm hover:bg-red-50 ${compact ? "p-0.5" : "p-1"}`}
            >
              <IconTrash className={compact ? "size-3" : "size-3.5"} aria-hidden />
            </button>
          ) : null}
        </div>
      ) : null}
      <div
        onPointerDown={omitChromeHeader ? startMove : undefined}
        className={`relative z-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden touch-none ${
          omitChromeHeader ? "cursor-grab rounded-lg active:cursor-grabbing" : compact ? "rounded-b-md" : "rounded-b-[10px]"
        }`}
        style={{ backgroundColor: node.bodyBackgroundColor }}
      >
        <OverviewNodeBody node={node} module={mod} record={record} workspace={workspace} demoInsight />
        {omitChromeHeader && selected ? (
          <button
            type="button"
            aria-label="Remove field"
            title="Remove"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute bottom-1 right-1 z-40 inline-flex rounded-md border border-red-200/90 bg-white/95 p-0.5 text-red-600 shadow-sm backdrop-blur-sm hover:bg-red-50"
          >
            <IconTrash className="size-3" aria-hidden />
          </button>
        ) : null}
      </div>
      <button
        type="button"
        aria-label="Resize width"
        onPointerDown={startResize("e")}
        className={`pointer-events-auto absolute right-0 ${resizeInset} ${resizeBottom} z-20 w-2 cursor-ew-resize touch-none border-0 bg-transparent p-0 outline-none`}
      />
      <button
        type="button"
        aria-label="Resize height"
        onPointerDown={startResize("s")}
        className={`pointer-events-auto absolute bottom-0 left-2 z-20 h-2 cursor-ns-resize touch-none border-0 bg-transparent p-0 outline-none ${omitChromeHeader ? "right-6" : "right-9"}`}
      />
      <button
        type="button"
        aria-label="Resize"
        onPointerDown={startResize("se")}
        className={`pointer-events-auto absolute right-0 bottom-0 z-30 flex cursor-nwse-resize touch-none items-end justify-end border-0 bg-transparent p-0 outline-none ${compact ? "h-7 w-7" : "h-9 w-9"}`}
      >
        <span
          className={`mb-0.5 mr-0.5 block rounded-sm border-2 border-[#0f6b5c]/50 bg-white shadow-md ring-1 ring-white/90 ${compact ? "h-2.5 w-2.5" : "h-3.5 w-3.5"}`}
          aria-hidden
        />
      </button>
    </div>
  );
}
