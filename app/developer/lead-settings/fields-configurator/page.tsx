import { AppShell } from "@/components/app-shell";
import { DeveloperPageHeader } from "@/components/developer/developer-page-header";
import { FieldsConfigurator } from "@/components/fields-configurator/fields-configurator";

export const metadata = {
  title: "Fields configurator — sirus.ai",
  description: "Define lead fields, types, and validation",
};

export default function FieldsConfiguratorPage() {
  return (
    <AppShell>
      <div className="flex min-h-0 flex-1 flex-col">
        <DeveloperPageHeader
          backHref="/"
          title="Fields configurator"
          description="Lead object schema — default fields stay on canvas; drag types to add more."
        />
        <FieldsConfigurator />
      </div>
    </AppShell>
  );
}
