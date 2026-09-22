"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { BlueprintConfiguratorShell } from "@/components/blueprint-configurator/blueprint-configurator-shell";
import { BlueprintListView } from "@/components/blueprint-configurator/blueprint-list-view";
import { BlueprintSaveToolbar } from "@/components/blueprint-configurator/blueprint-save-toolbar";
import { BlueprintWorkspaceProvider } from "@/components/blueprint-configurator/blueprint-workspace-context";
import { DeveloperPageHeader } from "@/components/developer/developer-page-header";
import { ModuleScopeBar } from "@/components/settings/module-scope-bar";
import { useCrm } from "@/components/crm/crm-provider";
import { crmBlueprintFromDocument, documentFromModule } from "@/lib/crm/blueprint-bridge";
import { blueprintIdForModule, findModule } from "@/lib/crm/ops";
import {
  BLUEPRINT_CHANGED_EVENT,
  blueprintDocumentExists,
  loadBlueprintById,
  saveBlueprint,
} from "@/lib/blueprint/storage";

function BlueprintEditorScreen({ blueprintId, openAi }: { blueprintId: string; openAi: boolean }) {
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
    <BlueprintWorkspaceProvider initialAiPanelOpen={openAi}>
      <div className="flex min-h-0 flex-1 flex-col">
        <DeveloperPageHeader
          backHref="/developer/lead-settings/blueprint-configurator"
          backAriaLabel="All blueprints"
          title="Edit blueprint"
          description="Design stages on the canvas, or describe the process in AI Builder on the left."
          actions={<BlueprintSaveToolbar />}
        />
        <BlueprintConfiguratorShell blueprintId={blueprintId} />
      </div>
    </BlueprintWorkspaceProvider>
  );
}

function ModuleBlueprintGate({ moduleId, openAi }: { moduleId: string; openAi: boolean }) {
  const { workspace, save } = useCrm();
  const mod = workspace ? findModule(workspace, moduleId) : undefined;
  const [readyId, setReadyId] = useState<string | null>(null);

  useEffect(() => {
    if (!mod) return;
    const id = blueprintIdForModule(mod.id);
    if (!loadBlueprintById(id)) saveBlueprint(documentFromModule(mod));
    setReadyId(id);
  }, [mod]);

  useEffect(() => {
    if (!mod || !workspace) return;
    const onChange = () => {
      const doc = loadBlueprintById(blueprintIdForModule(mod.id));
      if (!doc) return;
      const next = structuredClone(workspace);
      const target = findModule(next, mod.id);
      if (!target) return;
      target.blueprint = crmBlueprintFromDocument(doc);
      save(next);
    };
    window.addEventListener(BLUEPRINT_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(BLUEPRINT_CHANGED_EVENT, onChange);
  }, [mod, workspace, save]);

  if (!mod) {
    return (
      <div className="flex flex-1 items-center justify-center bg-canvas text-sm text-muted">
        Module not found. Create one in the{" "}
        <Link href="/developer/lead-settings/modules-configurator" className="ml-1 text-accent">
          Modules configurator
        </Link>
        .
      </div>
    );
  }

  if (!readyId) {
    return <div className="flex flex-1 items-center justify-center bg-canvas text-xs text-muted">Loading blueprint…</div>;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ModuleScopeBar noun="blueprint" />
      <BlueprintEditorScreen key={readyId} blueprintId={readyId} openAi={openAi} />
    </div>
  );
}

function BlueprintScreenInner() {
  const searchParams = useSearchParams();
  const moduleId = searchParams.get("module");
  const editId = searchParams.get("edit");
  const openAi = searchParams.get("ai") === "1";

  if (moduleId) {
    return <ModuleBlueprintGate moduleId={moduleId} openAi={openAi} />;
  }

  if (!editId) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <ModuleScopeBar noun="blueprint" />
        <BlueprintListView />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ModuleScopeBar noun="blueprint" />
      <BlueprintEditorScreen blueprintId={editId} openAi={openAi} />
    </div>
  );
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
