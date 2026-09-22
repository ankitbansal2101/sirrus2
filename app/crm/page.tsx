"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SirusMark } from "@/components/brand/sirus-mark";
import { useCrm } from "@/components/crm/crm-provider";

export default function CrmHomePage() {
  const { workspace, ready } = useCrm();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    const first = workspace?.modules[0];
    router.replace(first ? `/crm/modules/${first.id}` : "/developer/lead-settings/modules-configurator");
  }, [ready, workspace, router]);

  return (
    <div className="sirus-splash flex flex-1 flex-col items-center justify-center gap-3">
      <SirusMark className="size-10" />
      <p className="text-sm text-muted">Opening modules…</p>
    </div>
  );
}
