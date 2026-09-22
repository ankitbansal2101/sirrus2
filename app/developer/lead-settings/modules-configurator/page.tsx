import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { ModulesConfigurator } from "@/components/modules-configurator/modules-configurator";

export const metadata = {
  title: "Modules — sirus.ai",
  description: "Browse modules and configure fields, form layout, and blueprint",
};

export default function ModulesConfiguratorPage() {
  return (
    <AppShell>
      <Suspense fallback={<div className="flex flex-1 items-center justify-center text-xs text-muted">Loading modules…</div>}>
        <ModulesConfigurator />
      </Suspense>
    </AppShell>
  );
}
