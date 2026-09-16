"use client";

import { useEffect, useState } from "react";
import { applyPrototypeSnapshotToLocalStorage } from "@/lib/prototype-persist/browser-sync";
import { schedulePrototypeDiskPush } from "@/lib/prototype-persist/push";
import type { PrototypeStateFile } from "@/lib/prototype-persist/types";

type GetPayload = {
  snapshot: PrototypeStateFile | null;
  disk?: boolean;
  live?: boolean;
  error?: string;
};

/**
 * Loads the shared prototype snapshot. Live (Vercel Blob) snapshots hydrate localStorage
 * so the UI matches Claude MCP. Local disk restore stays opt-in via
 * `NEXT_PUBLIC_PROTOTYPE_BOOTSTRAP_FROM_DISK=1`. After load, current localStorage is
 * pushed so Claude sees frontend edits.
 */
export function PrototypeDiskGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/prototype-state", { cache: "no-store" });
        const data = (await res.json()) as GetPayload;
        if (cancelled) return;
        const hydrateDisk =
          typeof process !== "undefined" &&
          process.env.NEXT_PUBLIC_PROTOTYPE_BOOTSTRAP_FROM_DISK === "1";
        const hydrate = Boolean(data?.live) || hydrateDisk;
        if (hydrate && res.ok && data?.snapshot && data.snapshot.version === 1) {
          applyPrototypeSnapshotToLocalStorage(data.snapshot);
        }
      } catch {
        /* ignore — prototype convenience only */
      } finally {
        if (!cancelled) {
          schedulePrototypeDiskPush();
          setReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-surface text-sm text-muted">
        Loading prototype…
      </div>
    );
  }

  return <>{children}</>;
}
