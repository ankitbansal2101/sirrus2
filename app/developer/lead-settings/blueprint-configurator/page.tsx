import { AppShell } from "@/components/app-shell";
import { BlueprintScreen } from "./blueprint-screen";

export const metadata = {
  title: "Blueprint management — sirus.ai",
  description: "Design lead stage flows, transitions, and automation",
};

export default function BlueprintConfiguratorPage() {
  return (
    <AppShell>
      <BlueprintScreen />
    </AppShell>
  );
}
