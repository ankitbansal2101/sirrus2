"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CustomiseLeadFormClient } from "@/components/lead-form-customiser/customise-lead-form-client";
import { useCrm } from "@/components/crm/crm-provider";
import { ModuleScopeBar } from "@/components/settings/module-scope-bar";
import { findModule, setFormLayout } from "@/lib/crm/ops";

function FormInner() {
  const params = useSearchParams();
  const moduleId = params.get("module");
  const { workspace, save } = useCrm();
  const mod = workspace && moduleId ? findModule(workspace, moduleId) : undefined;

  return (
    <>
      <ModuleScopeBar noun="create form" />
      {mod && workspace ? (
        <CustomiseLeadFormClient
          key={mod.id}
          fields={mod.fields}
          layout={mod.formLayout}
          onSaveLayout={(layout) => {
            save(setFormLayout(workspace, mod.id, layout));
            return true;
          }}
        />
      ) : (
        <CustomiseLeadFormClient />
      )}
    </>
  );
}

export function CustomiseFormHost() {
  return (
    <Suspense fallback={<div className="flex flex-1 items-center justify-center text-xs text-muted">Loading…</div>}>
      <FormInner />
    </Suspense>
  );
}
