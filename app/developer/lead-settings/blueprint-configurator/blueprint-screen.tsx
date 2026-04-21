"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import { BlueprintConfiguratorShell } from "@/components/blueprint-configurator/blueprint-configurator-shell";
import { BlueprintListView } from "@/components/blueprint-configurator/blueprint-list-view";
import { BlueprintSaveToolbar } from "@/components/blueprint-configurator/blueprint-save-toolbar";
import { BlueprintWorkspaceProvider } from "@/components/blueprint-configurator/blueprint-workspace-context";
import { DeveloperPageHeader } from "@/components/developer/developer-page-header";
import { blueprintDocumentExists } from "@/lib/blueprint/storage";

function BlueprintEditorScreen({ blueprintId }: { blueprintId: string }) {
  const exists = useMemo(() => blueprintDocumentExists(blueprintId), [blueprintId]);

  if (!exists) {
    return (
      <div className="flex min-h-0 flex-1 flex-col bg-canvas">
        <DeveloperPageHeader
          narrow
          backHref="/developer/lead-settings/blueprint-configurator"
          backAriaLabel="All blueprints"
          title="Blueprint not found"
          description="This blueprint id is not in your library. It may have been deleted."
        />
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-5 text-center">
          <Link
            href="/developer/lead-settings/blueprint-configurator"
            className="text-xs font-semibold text-accent underline-offset-2 hover:underline"
          >
            Back to all blueprints
          </Link>
        </div>
      </div>
    );
  }

  return (
    <BlueprintWorkspaceProvider>
      <div className="flex min-h-0 flex-1 flex-col">
        <DeveloperPageHeader
          backHref="/developer/lead-settings/blueprint-configurator"
          backAriaLabel="All blueprints"
          title="Edit blueprint"
          description="Drag stages, connect transitions, then set the form on each move and auto field values after."
          actions={<BlueprintSaveToolbar />}
        />
        <BlueprintConfiguratorShell blueprintId={blueprintId} />
      </div>
    </BlueprintWorkspaceProvider>
  );
}

function BlueprintScreenInner() {
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");

  if (!editId) {
    return <BlueprintListView />;
  }

  return <BlueprintEditorScreen blueprintId={editId} />;
}

export function BlueprintScreen() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-0 flex-1 items-center justify-center bg-canvas text-xs text-muted">Loading…</div>
      }
    >
      <BlueprintScreenInner />
    </Suspense>
  );
}
