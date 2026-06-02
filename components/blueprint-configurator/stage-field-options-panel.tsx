"use client";

import { useState } from "react";
import { encodeBlueprintDrag, BLUEPRINT_DRAG_MIME } from "@/components/blueprint-configurator/blueprint-palette";
import { IconPlus } from "@/components/icons";
import type { FieldDefinition } from "@/lib/fields-config/types";
import { optionsSorted } from "@/lib/fields-config/types";

type Props = {
  stageField: FieldDefinition | undefined;
  onAddStage: (label: string) => void;
  onRemoveStage: (optionId: string, label: string) => void;
  onRenameStage: (optionId: string, label: string) => void;
  onDragSessionStart: () => void;
  onDragSessionEnd: () => void;
};

export function StageFieldOptionsPanel({
  stageField,
  onAddStage,
  onRemoveStage,
  onRenameStage,
  onDragSessionStart,
  onDragSessionEnd,
}: Props) {
  const [newStageName, setNewStageName] = useState("");

  if (!stageField) {
    return (
      <div className="rounded-lg border border-dashed border-border-soft bg-white/80 px-2 py-2 text-[10px] leading-snug text-muted">
        Select a picklist field above, or add a picklist in Fields configurator.
      </div>
    );
  }

  const sorted = optionsSorted(stageField);
  const canRemove = sorted.length > 1;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="shrink-0 px-1">
        <h2 className="text-xs font-semibold text-ink">Stage field options</h2>
        <p className="mt-0.5 text-[10px] leading-snug text-muted">
          Add or remove stages on <span className="font-medium text-ink">{stageField.label}</span>. Drag onto the
          canvas to place them in the blueprint.
        </p>
      </div>

      <div className="shrink-0 flex gap-1.5 px-1">
        <input
          type="text"
          value={newStageName}
          onChange={(e) => setNewStageName(e.target.value)}
          placeholder="New stage name"
          className="min-w-0 flex-1 rounded-md border border-border-soft bg-white px-2 py-1.5 text-xs text-ink outline-none ring-accent focus:ring-2"
          onKeyDown={(e) => {
            if (e.key === "Enter" && newStageName.trim()) {
              onAddStage(newStageName.trim());
              setNewStageName("");
            }
          }}
        />
        <button
          type="button"
          onClick={() => {
            onAddStage(newStageName.trim() || "New stage");
            setNewStageName("");
          }}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-accent/40 bg-white px-2 py-1.5 text-[10px] font-semibold text-accent shadow-sm hover:bg-rail-active/40"
          title="Add stage to field"
        >
          <IconPlus className="size-3.5" />
          Add
        </button>
      </div>

      <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-auto pr-0.5">
        {sorted.map((opt) => (
          <li
            key={opt.id}
            className="flex items-center gap-1 rounded-lg border border-border-soft bg-white px-1 py-1 shadow-sm"
          >
            <button
              type="button"
              draggable
              onDragStart={(e) => {
                onDragSessionStart();
                e.dataTransfer.setData(
                  BLUEPRINT_DRAG_MIME,
                  encodeBlueprintDrag({ kind: "stage", label: opt.label }),
                );
                e.dataTransfer.effectAllowed = "copy";
              }}
              onDragEnd={onDragSessionEnd}
              className="flex shrink-0 cursor-grab items-center px-1 text-[10px] text-muted active:cursor-grabbing"
              title="Drag to canvas"
              aria-label={`Drag ${opt.label}`}
            >
              ⋮⋮
            </button>
            <input
              type="text"
              value={opt.label}
              onChange={(e) => onRenameStage(opt.id, e.target.value)}
              className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-xs font-medium text-ink outline-none focus:border-border-soft focus:bg-zinc-50"
            />
            <button
              type="button"
              onClick={() => onRemoveStage(opt.id, opt.label)}
              disabled={!canRemove}
              className="shrink-0 rounded px-1.5 text-sm leading-none text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-30"
              title={canRemove ? "Remove stage from field" : "At least one stage is required"}
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      {sorted.length === 0 ? (
        <p className="px-1 text-[10px] text-muted">No stages yet. Add one above, then drag it onto the canvas.</p>
      ) : null}
    </div>
  );
}
