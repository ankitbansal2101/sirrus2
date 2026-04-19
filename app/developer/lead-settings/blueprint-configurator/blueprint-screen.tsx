"use client";

import Link from "next/link";
import { BlueprintConfiguratorShell } from "@/components/blueprint-configurator/blueprint-configurator-shell";
import { BlueprintSaveToolbar } from "@/components/blueprint-configurator/blueprint-save-toolbar";
import { BlueprintWorkspaceProvider } from "@/components/blueprint-configurator/blueprint-workspace-context";
import { IconChevronLeft } from "@/components/icons";

export function BlueprintScreen() {
  return (
    <BlueprintWorkspaceProvider>
      <div className="flex min-h-0 flex-1 flex-col">
        <header className="shrink-0 border-b border-border-soft bg-surface px-3 py-2 sm:px-4">
          <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-2 sm:gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
              <Link
                href="/"
                className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border-soft bg-white text-accent shadow-sm transition hover:shadow-md sm:size-9"
                aria-label="Back to settings"
              >
                <IconChevronLeft className="size-3.5 sm:size-4" />
              </Link>
              <div className="min-w-0 py-0.5">
                <h1 className="text-[15px] font-semibold leading-tight text-ink sm:text-base">Blueprint management</h1>
                <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted sm:line-clamp-1 sm:text-xs">
                  Drag stages, connect transitions, then set the form on each move and auto field values after.
                </p>
              </div>
            </div>
            <BlueprintSaveToolbar />
          </div>
        </header>
        <BlueprintConfiguratorShell />
      </div>
    </BlueprintWorkspaceProvider>
  );
}
