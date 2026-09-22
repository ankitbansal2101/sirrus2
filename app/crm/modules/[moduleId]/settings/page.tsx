"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { ModuleSettingsClient } from "@/components/crm/module-settings-client";

function SettingsInner() {
  const params = useParams<{ moduleId: string }>();
  return <ModuleSettingsClient moduleId={String(params.moduleId ?? "")} />;
}

export default function ModuleSettingsPage() {
  return (
    <Suspense fallback={<div className="flex flex-1 items-center justify-center bg-canvas text-sm text-muted">Loading settings…</div>}>
      <SettingsInner />
    </Suspense>
  );
}
