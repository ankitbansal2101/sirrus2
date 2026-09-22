"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { BlueprintConfiguratorShell } from "@/components/blueprint-configurator/blueprint-configurator-shell";
import { BlueprintFieldsProvider } from "@/components/blueprint-configurator/blueprint-fields-context";
import { BlueprintWorkspaceProvider } from "@/components/blueprint-configurator/blueprint-workspace-context";
import { BlueprintSaveToolbar } from "@/components/blueprint-configurator/blueprint-save-toolbar";
import { DeveloperPageHeader } from "@/components/developer/developer-page-header";
import { useCrm } from "@/components/crm/crm-provider";
import { ModuleScopeBar } from "@/components/settings/module-scope-bar";
import { crmBlueprintFromDocument } from "@/lib/crm/blueprint-bridge";
import { ensureModuleBlueprint, moduleBlueprintId } from "@/lib/crm/module-blueprint";
import { findModule, setModuleFields } from "@/lib/crm/ops";
import { BLUEPRINT_CHANGED_EVENT, loadBlueprintById } from "@/lib/blueprint/storage";

export function ModuleBlueprintHost() {
  const params = useSearchParams();
  const moduleId = params.get("module");
  const { workspace, save } = useCrm();
  const mod = workspace && moduleId ? findModule(workspace, moduleId) : undefined;

  useEffect(() => {
    if (!mod) return;
    ensureModuleBlueprint(mod);
  }, [mod]);

  useEffect(() => {
    if (!mod || !workspace) return;
    const onChange = () => {
      const doc = loadBlueprintById(moduleBlueprintId(mod), mod.fields);
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

  if (!mod) return null;

  const blueprintId = moduleBlueprintId(mod);

  return (
    <>
      <ModuleScopeBar noun="blueprint" />
      <BlueprintFieldsProvider
        fields={mod.fields}
        onPersistFields={(next) => {
          if (!workspace) return false;
          save(setModuleFields(workspace, mod.id, next));
          return true;
        }}
      >
        <BlueprintWorkspaceProvider>
          <div className="flex min-h-0 flex-1 flex-col">
            <DeveloperPageHeader
              backHref="/"
              backAriaLabel="Settings"
              title={`${mod.pluralLabel} blueprint`}
              description="Same canvas as Settings → Blueprint management: stages, transitions, substages, and automation."
              actions={<BlueprintSaveToolbar />}
            />
            <BlueprintConfiguratorShell blueprintId={blueprintId} />
          </div>
        </BlueprintWorkspaceProvider>
      </BlueprintFieldsProvider>
    </>
  );
}
