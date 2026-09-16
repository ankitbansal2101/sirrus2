"use client";

import { useEffect, useState } from "react";
import {
  applyPrototypeSnapshotToLocalStorage,
  pullLiveSnapshotIfNewer,
  rememberLiveSavedAt,
} from "@/lib/prototype-persist/browser-sync";
import { schedulePrototypeDiskPush } from "@/lib/prototype-persist/push";
import type { PrototypeStateFile } from "@/lib/prototype-persist/types";

type GetPayload = {
  snapshot: PrototypeStateFile | null;
  disk?: boolean;
  live?: boolean;
  error?: string;
};

/**
 * Two-way sync with the live snapshot Claude MCP uses.
 * Newer live data (Claude updates) is pulled into localStorage; otherwise the
 * current browser leads are pushed so Claude stays current.
 */
export function PrototypeDiskGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const sync = async (pushIfUnchanged: boolean) => {
      try {
        const pulled = await pullLiveSnapshotIfNewer();
        if (cancelled) return;
        if (pulled) return;
        if (!pushIfUnchanged) return;
        const res = await fetch("/api/prototype-state", { cache: "no-store" });
        const data = (await res.json()) as GetPayload;
        if (cancelled) return;
        const localLeadsRaw = (() => {
          try {
            return window.localStorage.getItem("sirrus2_leads_v1");
          } catch {
            return null;
          }
        })();
        let hasLocalLeads = false;
        try {
          const parsed = localLeadsRaw ? (JSON.parse(localLeadsRaw) as unknown) : null;
          hasLocalLeads = Array.isArray(parsed) && parsed.length > 0;
        } catch {
          hasLocalLeads = false;
        }
        const hydrateDisk =
          typeof process !== "undefined" &&
          process.env.NEXT_PUBLIC_PROTOTYPE_BOOTSTRAP_FROM_DISK === "1";
        if (!hasLocalLeads && (Boolean(data?.live) || hydrateDisk) && res.ok && data?.snapshot?.version === 1) {
          applyPrototypeSnapshotToLocalStorage(data.snapshot);
          if (data.snapshot.savedAt) rememberLiveSavedAt(data.snapshot.savedAt);
        } else {
          schedulePrototypeDiskPush();
        }
      } catch {
        if (pushIfUnchanged) schedulePrototypeDiskPush();
      }
    };

    void (async () => {
      await sync(true);
      if (!cancelled) setReady(true);
    })();

    const onVisible = () => {
      if (document.visibilityState === "visible") void sync(false);
    };
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(() => void sync(false), 4000);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
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
