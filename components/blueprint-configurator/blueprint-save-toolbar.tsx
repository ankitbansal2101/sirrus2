"use client";

import { useBlueprintWorkspace } from "@/components/blueprint-configurator/blueprint-workspace-context";
import { IconSparkle } from "@/components/icons";

export function BlueprintSaveToolbar() {
  const { saveBanner, runSave, aiPanelOpen, setAiPanelOpen, pendingApproval } = useBlueprintWorkspace();

  return (
    <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2">
      {pendingApproval ? (
        <span className="max-w-[min(100%,13rem)] text-right text-[12px] font-medium text-amber-800">Draft — not active yet</span>
      ) : null}
      {saveBanner ? (
        <span
          className={`max-w-[min(100%,14rem)] text-right text-[12px] font-medium sm:max-w-[16rem] ${saveBanner.includes("Could not") || saveBanner.includes("Fix validation") ? "text-red-700" : "text-emerald-800"}`}
          role="status"
        >
          {saveBanner}
        </span>
      ) : null}
      <button
        type="button"
        onClick={() => setAiPanelOpen(!aiPanelOpen)}
        aria-pressed={aiPanelOpen}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-semibold shadow-sm transition sm:px-3 ${
          aiPanelOpen
            ? "border-accent bg-accent text-white"
            : "border-border-soft bg-white text-ink hover:border-accent/40"
        }`}
      >
        <IconSparkle className="size-3.5" />
        AI Builder
      </button>
      <button
        type="button"
        onClick={runSave}
        className="rounded-lg bg-accent px-2.5 py-1.5 text-[12px] font-semibold text-white shadow-sm transition hover:opacity-95 sm:px-3"
      >
        Save blueprint
      </button>
    </div>
  );
}
