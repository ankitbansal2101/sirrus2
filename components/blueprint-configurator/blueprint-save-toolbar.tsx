"use client";

import { useBlueprintWorkspace } from "@/components/blueprint-configurator/blueprint-workspace-context";

export function BlueprintSaveToolbar() {
  const { saveBanner, runSave } = useBlueprintWorkspace();

  return (
    <div className="flex shrink-0 flex-col items-end gap-0.5 sm:flex-row sm:items-center sm:gap-2">
      {saveBanner ? (
        <span
          className={`max-w-[min(100%,14rem)] text-right text-[10px] font-medium sm:max-w-[16rem] sm:text-xs ${saveBanner.includes("Could not") ? "text-red-700" : "text-emerald-800"}`}
          role="status"
        >
          {saveBanner}
        </span>
      ) : null}
      <button
        type="button"
        onClick={runSave}
        className="rounded-md bg-accent px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:opacity-95 sm:px-3 sm:text-xs"
      >
        Save blueprint
      </button>
    </div>
  );
}
