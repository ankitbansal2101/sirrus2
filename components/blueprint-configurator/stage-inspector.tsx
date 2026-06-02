"use client";

import { IconPlus, IconTrash } from "@/components/icons";
import type { BlueprintSubstage, BlueprintSubstageExit, BlueprintSubstageTransition } from "@/lib/blueprint/types";
import { newEntityId } from "@/lib/blueprint/types";

function pruneSubstageTransitions(
  substages: BlueprintSubstage[],
  transitions: BlueprintSubstageTransition[],
): BlueprintSubstageTransition[] {
  const ids = new Set(substages.map((s) => s.id));
  return transitions.filter((t) => ids.has(t.sourceSubstageId) && ids.has(t.targetSubstageId));
}

export function StageInspector({
  stageLabel,
  substages,
  defaultSubstageId,
  substageTransitions,
  substageExits,
  onSubstagesChange,
  onDefaultSubstageChange,
  onSubstageTransitionsChange,
  onSubstageExitsChange,
  onClose,
}: {
  stageLabel: string;
  substages: BlueprintSubstage[];
  defaultSubstageId: string;
  substageTransitions: BlueprintSubstageTransition[];
  substageExits: BlueprintSubstageExit[];
  onSubstagesChange: (next: BlueprintSubstage[]) => void;
  onDefaultSubstageChange: (substageId: string) => void;
  onSubstageTransitionsChange: (next: BlueprintSubstageTransition[]) => void;
  onSubstageExitsChange: (next: BlueprintSubstageExit[]) => void;
  onClose: () => void;
}) {
  function setSubstages(next: BlueprintSubstage[]) {
    onSubstagesChange(next);
    if (next.length === 0) {
      onDefaultSubstageChange("");
    } else if (!next.some((s) => s.id === defaultSubstageId)) {
      onDefaultSubstageChange(next[0]?.id ?? "");
    }
    onSubstageTransitionsChange(pruneSubstageTransitions(next, substageTransitions));
    const ids = new Set(next.map((s) => s.id));
    onSubstageExitsChange(substageExits.filter((x) => ids.has(x.sourceSubstageId)));
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-t border-border-soft bg-zinc-50/80">
      <div className="flex shrink-0 items-start justify-between gap-2 border-b border-border-soft bg-white px-3 py-2">
        <div className="min-w-0">
          <h3 className="text-[11px] font-bold uppercase tracking-wide text-muted">Sub-stages</h3>
          <p className="truncate text-sm font-semibold text-ink">{stageLabel}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 text-[10px] font-semibold text-accent hover:underline"
        >
          Done
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <p className="text-[10px] leading-relaxed text-muted">
          Draw arrows from other main stages into specific sub-stages (entry), between sub-stages, or from a sub-stage to
          the next main stage. Default sub-stage is only a fallback when no entry or picker applies.
        </p>
        {substages.length > 0 ? (
          <p className="mt-2 text-[10px] leading-relaxed text-violet-800/90">
            Click the dashed violet box on the canvas and drag its corners to make the sub-stage area larger.
          </p>
        ) : null}
        <ul className="mt-3 space-y-2">
          {substages.map((ss, index) => (
            <li key={ss.id} className="flex items-center gap-2 rounded-lg border border-border-soft bg-white p-2 shadow-sm">
              <span className="w-5 shrink-0 text-center text-[10px] font-medium text-muted">{index + 1}</span>
              <input
                type="text"
                value={ss.label}
                onChange={(e) =>
                  setSubstages(substages.map((x) => (x.id === ss.id ? { ...x, label: e.target.value } : x)))
                }
                placeholder="Sub-stage name"
                className="min-w-0 flex-1 rounded-md border border-border-soft px-2 py-1 text-[11px] text-ink outline-none ring-accent focus:ring-2"
              />
              <button
                type="button"
                className={`rounded-full border px-2 py-1 text-[9px] font-semibold ${
                  defaultSubstageId === ss.id
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border-soft bg-zinc-50 text-muted hover:text-ink"
                }`}
                onClick={() => onDefaultSubstageChange(ss.id)}
                title="Selected automatically when lead enters this stage"
              >
                Default
              </button>
              <button
                type="button"
                aria-label="Remove sub-stage"
                className="rounded p-1 text-red-600 hover:bg-red-50"
                onClick={() => setSubstages(substages.filter((x) => x.id !== ss.id))}
              >
                <IconTrash className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
        {substages.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-border-soft bg-white px-3 py-4 text-center text-[10px] text-muted">
            No sub-stages yet. Add rows below, then open sub-stage flow on canvas.
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => {
            const id = newEntityId("ss");
            const next = [...substages, { id, label: "" }];
            setSubstages(next);
            if (substages.length === 0) onDefaultSubstageChange(id);
          }}
          className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-accent/40 bg-white py-2 text-[11px] font-semibold text-accent hover:bg-accent/5"
        >
          <IconPlus className="size-3.5" />
          Add sub-stage
        </button>
      </div>
    </div>
  );
}
