"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { useCrm } from "@/components/crm/crm-provider";

export default function ManageLeadsRedirect() {
  const { workspace, ready } = useCrm();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    const leads = workspace?.modules.find((m) => m.apiKey === "leads") ?? workspace?.modules[0];
    router.replace(leads ? `/crm/modules/${leads.id}` : "/developer/lead-settings/modules-configurator");
  }, [ready, workspace, router]);

  return (
    <AppShell>
      <div className="flex flex-1 items-center justify-center bg-canvas text-sm text-muted">Opening listing…</div>
    </AppShell>
  );
}
