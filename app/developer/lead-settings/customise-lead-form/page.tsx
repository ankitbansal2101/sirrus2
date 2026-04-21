import { AppShell } from "@/components/app-shell";
import { CustomiseLeadFormClient } from "@/components/lead-form-customiser/customise-lead-form-client";
import { DeveloperPageHeader } from "@/components/developer/developer-page-header";

export const metadata = {
  title: "Customise lead form — sirus.ai",
  description: "Choose which fields appear on create lead and how they are grouped",
};

export default function CustomiseLeadFormPage() {
  return (
    <AppShell>
      <div className="flex min-h-0 flex-1 flex-col">
        <DeveloperPageHeader
          backHref="/"
          title="Customise Lead Form"
          description="All fields from the Fields configurator are listed on the left when not on the form. Drag into sections, reorder, add sections, then save. Preview updates live."
        />
        <CustomiseLeadFormClient />
      </div>
    </AppShell>
  );
}
