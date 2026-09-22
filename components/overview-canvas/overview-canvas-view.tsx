"use client";

import { OverviewNodeBody } from "@/components/overview-canvas/overview-node-body";
import {
  canvasNodeChromeTitle,
  canvasNodeIsCompactLayout,
  canvasNodeOmitsChromeHeader,
  type OverviewCanvasDocument,
  type OverviewCanvasNode,
} from "@/lib/crm/overview-canvas";
import type { CrmModule, CrmRecord, CrmWorkspace } from "@/lib/crm/types";

export function OverviewCanvasView({
  doc,
  module: mod,
  record,
  tabId,
  onStage,
  workspace,
  className,
  minHeightClass = "min-h-[28rem]",
  demoInsight = false,
}: {
  doc: OverviewCanvasDocument;
  module: CrmModule;
  record: CrmRecord | null;
  tabId?: string;
  onStage?: (optionId: string) => void;
  workspace?: CrmWorkspace | null;
  className?: string;
  minHeightClass?: string;
  demoInsight?: boolean;
}) {
  const tab = doc.tabs.find((t) => t.id === (tabId ?? doc.activeTabId)) ?? doc.tabs[0];
  const nodes = [...(tab?.nodes ?? [])].sort((a, b) => a.z - b.z);

  return (
    <div
      className={`relative w-full overflow-hidden bg-[#e2e6ef] shadow-[inset_0_2px_10px_rgba(255,255,255,0.35)] ${className ?? `rounded-xl border border-slate-200/80 ${minHeightClass}`}`}
      style={{
        backgroundImage:
          "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
        backgroundSize: "24px 24px",
      }}
    >
      {nodes.length === 0 ? (
        <p className="absolute inset-0 flex items-center justify-center text-sm text-[#8b87a8]">No widgets on this tab yet.</p>
      ) : null}
      {nodes.map((n) => (
        <ViewPlacedNode
          key={n.id}
          node={n}
          module={mod}
          record={record}
          workspace={workspace}
          onStage={onStage}
          demoInsight={demoInsight}
        />
      ))}
    </div>
  );
}

function ViewPlacedNode({
  node,
  module: mod,
  record,
  workspace,
  onStage,
  demoInsight,
}: {
  node: OverviewCanvasNode;
  module: CrmModule;
  record: CrmRecord | null;
  workspace?: CrmWorkspace | null;
  onStage?: (optionId: string) => void;
  demoInsight?: boolean;
}) {
  const compact = canvasNodeIsCompactLayout(node);
  const omitHeader = canvasNodeOmitsChromeHeader(node);
  const headerStyle =
    node.type === "widget" || node.type === "custom"
      ? {
          background: node.headerStyle?.backgroundColor ?? "linear-gradient(to right, #f4f5ff, white)",
          color: node.headerStyle?.color,
        }
      : compact
        ? undefined
        : { background: "linear-gradient(to right, #f4f5ff, white)" };
  const headerMuted = (node.type === "widget" || node.type === "custom") && node.headerStyle?.color;

  if (omitHeader) {
    return (
      <div
        className="absolute flex flex-col overflow-hidden rounded-lg border border-slate-200/90 bg-white/95 shadow-sm"
        style={{
          left: `${node.x * 100}%`,
          top: `${node.y * 100}%`,
          width: `${node.w * 100}%`,
          height: `${node.h * 100}%`,
          zIndex: node.z,
        }}
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg">
          <OverviewNodeBody node={node} module={mod} record={record} workspace={workspace} onStage={onStage} demoInsight={demoInsight} />
        </div>
      </div>
    );
  }

  const title = canvasNodeChromeTitle(node);
  return (
    <div
      className={`absolute flex flex-col overflow-hidden bg-white/95 ${
        compact
          ? "rounded-lg border border-slate-200/90 shadow-sm"
          : "rounded-xl border-2 border-slate-300/80 shadow-[0_8px_28px_-10px_rgba(31,23,80,0.2)]"
      }`}
      style={{
        left: `${node.x * 100}%`,
        top: `${node.y * 100}%`,
        width: `${node.w * 100}%`,
        height: `${node.h * 100}%`,
        zIndex: node.z,
      }}
    >
      <div
        className={`flex shrink-0 items-center gap-1 border-b border-slate-200/80 font-semibold ${
          compact
            ? "h-6 min-h-[1.5rem] rounded-t-md bg-slate-50/95 px-1 py-0 text-[9px]"
            : `rounded-t-[10px] px-1.5 py-0.5 text-[10px] ${headerMuted ? "" : "text-[#1F1750]"}`
        }`}
        style={headerStyle}
      >
        <span className={`min-w-0 truncate ${compact && !headerMuted ? "text-[#334155]" : ""}`}>{title}</span>
        {!compact ? <span className="shrink-0 text-[9px] font-medium text-[#8b87a8]">{node.type}</span> : null}
      </div>
      <div
        className={`relative z-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden ${compact ? "rounded-b-md" : "rounded-b-[10px]"}`}
        style={{
          backgroundColor: node.bodyBackgroundColor,
          gap: node.rowGapPx != null ? `${node.rowGapPx}px` : undefined,
        }}
      >
        <OverviewNodeBody node={node} module={mod} record={record} workspace={workspace} onStage={onStage} demoInsight={demoInsight} />
      </div>
    </div>
  );
}
