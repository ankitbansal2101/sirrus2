import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { FieldsConfigurator } from "@/components/fields-configurator/fields-configurator";
import { IconChevronLeft } from "@/components/icons";

export const metadata = {
  title: "Fields configurator — sirus.ai",
  description: "Define lead fields, types, and validation",
};

export default function FieldsConfiguratorPage() {
  return (
    <AppShell>
      <div className="flex min-h-0 flex-1 flex-col">
        <header className="shrink-0 border-b border-border-soft bg-surface px-6 py-4">
          <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-4">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="flex size-9 items-center justify-center rounded-full border border-border-soft bg-white text-accent shadow-sm transition hover:shadow-md"
                aria-label="Back to settings"
              >
                <IconChevronLeft className="size-4" />
              </Link>
              <div>
                <h1 className="text-lg font-semibold text-ink">Fields configurator</h1>
                <p className="text-sm text-muted">
                  Model your lead object: default fields stay on the canvas; drag types in to extend the schema.
                </p>
              </div>
            </div>
          </div>
        </header>
        <FieldsConfigurator />
      </div>
    </AppShell>
  );
}
