import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { AgentsConfigurator } from "@/components/agents-configurator/agents-configurator";

export const metadata = {
  title: "Agents — sirrus.ai",
  description: "Create AI agents with name, instructions, tools, and model settings",
};

export default function AgentsPage() {
  return (
    <AppShell>
      <Suspense fallback={<div className="flex flex-1 items-center justify-center text-xs text-muted">Loading agents…</div>}>
        <AgentsConfigurator />
      </Suspense>
    </AppShell>
  );
}
