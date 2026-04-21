import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { ManageLeadsClient } from "@/components/manage-leads/manage-leads-client";

export const metadata = {
  title: "Manage leads — sirus.ai",
  description: "Lead list and blueprint-aware stage changes",
};

export default function ManageLeadsPage() {
  return (
    <AppShell>
      <Suspense
        fallback={
          <div className="flex min-h-0 flex-1 items-center justify-center bg-canvas p-6 text-xs text-muted">
            Loading manage leads…
          </div>
        }
      >
        <ManageLeadsClient />
      </Suspense>
    </AppShell>
  );
}
