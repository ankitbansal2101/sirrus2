"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { FieldsConfigurator } from "@/components/fields-configurator/fields-configurator";
import { useCrm } from "@/components/crm/crm-provider";
import { ModuleScopeBar } from "@/components/settings/module-scope-bar";
import { findModule, setModuleFields } from "@/lib/crm/ops";

function FieldsInner() {
  const params = useSearchParams();
  const moduleId = params.get("module");
  const { workspace, save } = useCrm();
  const mod = workspace && moduleId ? findModule(workspace, moduleId) : undefined;

  return (
    <>
      <ModuleScopeBar noun="fields" />
      {mod && workspace ? (
        <FieldsConfigurator
          key={mod.id}
          initialFields={mod.fields}
          canvasTitle={`${mod.pluralLabel} fields`}
          allowResetDefaults={false}
          onSaveFields={(fields) => {
            save(setModuleFields(workspace, mod.id, fields));
            return true;
          }}
        />
      ) : (
        <FieldsConfigurator />
      )}
    </>
  );
}

export function FieldsConfiguratorHost() {
  return (
    <Suspense fallback={<div className="flex flex-1 items-center justify-center text-xs text-muted">Loading…</div>}>
      <FieldsInner />
    </Suspense>
  );
}
