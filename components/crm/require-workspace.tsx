"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { SirusMark } from "@/components/brand/sirus-mark";
import { useCrm } from "@/components/crm/crm-provider";

function Splash({ copy }: { copy: string }) {
  return (
    <div className="sirus-splash flex min-h-svh flex-col items-center justify-center gap-4">
      <SirusMark className="size-12" />
      <p className="display text-2xl text-ink">Sirus</p>
      <p className="text-sm text-muted">{copy}</p>
    </div>
  );
}

export function RequireWorkspace({ children }: { children: ReactNode }) {
  const { workspace, ready } = useCrm();
  const router = useRouter();

  useEffect(() => {
    if (ready && !workspace) router.replace("/onboarding");
  }, [ready, workspace, router]);

  if (!ready) return <Splash copy="Opening workspace…" />;
  if (!workspace) return <Splash copy="Redirecting to setup…" />;
  return <>{children}</>;
}
