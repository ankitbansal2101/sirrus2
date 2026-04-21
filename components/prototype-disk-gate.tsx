"use client";

import { useEffect, useState } from "react";
import { applyPrototypeSnapshotToLocalStorage } from "@/lib/prototype-persist/browser-sync";
import type { PrototypeStateFile } from "@/lib/prototype-persist/types";

type GetPayload = {
  snapshot: PrototypeStateFile | null;
  disk?: boolean;
  error?: string;
};

/**
 * Loads prototype disk snapshot metadata. By default it does **not** write into localStorage
 * (so clearing site data shows in-code defaults and the latest Standard blueprint).
 * Set `NEXT_PUBLIC_PROTOTYPE_BOOTSTRAP_FROM_DISK=1` to restore fields/blueprint/leads from
 * `data/prototype-state.json` on every load (legacy dev convenience).
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
        const hydrate =
          typeof process !== "undefined" &&
          process.env.NEXT_PUBLIC_PROTOTYPE_BOOTSTRAP_FROM_DISK === "1";
        if (hydrate && res.ok && data?.snapshot && data.snapshot.version === 1) {
          applyPrototypeSnapshotToLocalStorage(data.snapshot);
        }
      } catch {
        /* ignore — prototype convenience only */
      } finally {
        if (!cancelled) setReady(true);
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
