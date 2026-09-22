"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCrm } from "@/components/crm/crm-provider";

export function HomeRedirect() {
  const { workspace, ready } = useCrm();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    router.replace(workspace ? "/crm" : "/onboarding");
  }, [ready, workspace, router]);

  return (
    <div className="flex min-h-svh items-center justify-center bg-canvas text-sm text-muted">
      Opening workspace…
    </div>
  );
}
