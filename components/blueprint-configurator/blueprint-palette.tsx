"use client";

import Link from "next/link";

export const BLUEPRINT_DRAG_MIME = "application/reactflow";

export type BlueprintDragPayload = { kind: "stage"; label: string };

export function encodeBlueprintDrag(payload: BlueprintDragPayload): string {
  return JSON.stringify(payload);
}

export function readBlueprintDrag(dt: DataTransfer): BlueprintDragPayload | null {
  try {
    const raw = dt.getData(BLUEPRINT_DRAG_MIME);
    if (!raw) return null;
    const v = JSON.parse(raw) as BlueprintDragPayload;
    if (v?.kind === "stage" && typeof v.label === "string") return v;
    return null;
  } catch {
    return null;
  }
}

type DragListProps = {
  stageLabels: string[];
  stageSourceLabel?: string;
  onDragSessionStart: () => void;
  onDragSessionEnd: () => void;
};

/** Draggable stage list for embedding in the right “Info & states” panel (Zoho-style). */
export function AvailableStagesDragList({
  stageLabels,
  stageSourceLabel,
  onDragSessionStart,
  onDragSessionEnd,
}: DragListProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-1 pb-2">
        <h2 className="text-xs font-semibold text-ink">Available states</h2>
        <p className="mt-0.5 text-[10px] leading-snug text-muted">
          Drag onto the canvas. Options from{" "}
          {stageSourceLabel ? (
            <span className="font-medium text-ink">{stageSourceLabel}</span>
          ) : (
            <span className="text-ink">picklist</span>
          )}
          .
        </p>
      </div>
      <ul className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-auto pr-0.5">
        {stageLabels.length === 0 ? (
          <li className="rounded-lg border border-dashed border-border-soft bg-white/80 px-2 py-2 text-[10px] leading-snug text-muted">
            No options.{" "}
            <Link href="/developer/lead-settings/fields-configurator" className="font-semibold text-accent underline-offset-2 hover:underline">
              Fields
            </Link>
          </li>
        ) : (
          stageLabels.map((label, idx) => (
            <li key={`${label}-${idx}`}>
              <button
                type="button"
                draggable
                onDragStart={(e) => {
                  onDragSessionStart();
                  e.dataTransfer.setData(BLUEPRINT_DRAG_MIME, encodeBlueprintDrag({ kind: "stage", label }));
                  e.dataTransfer.effectAllowed = "copy";
                }}
                onDragEnd={() => {
                  onDragSessionEnd();
                }}
                className="flex w-full cursor-grab items-center gap-1.5 rounded-lg border border-border-soft bg-white px-2 py-1.5 text-left text-xs font-medium text-ink shadow-sm transition active:cursor-grabbing hover:border-accent/40 hover:shadow"
              >
                <span className="text-[10px] text-muted select-none" aria-hidden>
                  ⋮⋮
                </span>
                <span className="min-w-0 truncate">{label}</span>
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
