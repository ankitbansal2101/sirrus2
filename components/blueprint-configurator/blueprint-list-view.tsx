"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DeveloperPageHeader } from "@/components/developer/developer-page-header";
import {
  BLUEPRINT_CHANGED_EVENT,
  addBlueprint,
  deleteBlueprint,
  duplicateBlueprint,
  getActiveBlueprintId,
  loadBlueprintLibrary,
  setActiveBlueprint,
} from "@/lib/blueprint/storage";

export function BlueprintListView() {
  const router = useRouter();
  const [version, setVersion] = useState(0);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    const on = () => refresh();
    window.addEventListener(BLUEPRINT_CHANGED_EVENT, on);
    return () => window.removeEventListener(BLUEPRINT_CHANGED_EVENT, on);
  }, [refresh]);

  const lib = useMemo(() => loadBlueprintLibrary(), [version]);
  const activeId = getActiveBlueprintId();

  const onNew = () => {
    const doc = addBlueprint();
    router.push(`/developer/lead-settings/blueprint-configurator?edit=${encodeURIComponent(doc.id)}`);
  };

  const onDuplicate = (id: string) => {
    const doc = duplicateBlueprint(id);
    if (doc) router.push(`/developer/lead-settings/blueprint-configurator?edit=${encodeURIComponent(doc.id)}`);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-canvas">
      <DeveloperPageHeader
        narrow
        backHref="/"
        backAriaLabel="Back to settings"
        title="Blueprint management"
        description={
          <>
            Use the <strong className="font-medium text-ink">Active</strong> switch on a row so exactly one blueprint
            drives Manage leads and seeding.
          </>
        }
        actions={
          <button
            type="button"
            onClick={onNew}
            className="shrink-0 rounded-lg bg-accent px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:opacity-95 sm:px-3 sm:text-xs"
          >
            New blueprint
          </button>
        }
      />

      <div className="min-h-0 flex-1 overflow-auto p-2.5 sm:p-3">
        <ul className="mx-auto flex max-w-[960px] flex-col gap-1.5">
          {lib.blueprints.map((bp) => {
            const isActive = bp.id === activeId;
            return (
              <li
                key={bp.id}
                className="flex flex-col gap-2 rounded-lg border border-border-soft bg-surface p-2.5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3"
              >
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-xs font-semibold text-ink sm:text-sm">{bp.name}</h2>
                  <p className="mt-0.5 text-[10px] leading-snug text-muted sm:text-[11px]">
                    {bp.module} · stage field: <span className="font-mono text-ink/80">{bp.stageField}</span> ·{" "}
                    {bp.states.length} states, {bp.transitions.length} transitions
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
                  <label className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border-soft bg-white px-2 py-1 shadow-sm">
                    <span className="text-[10px] font-medium text-ink sm:text-[11px]">Active</span>
                    <span className="relative h-6 w-11 shrink-0">
                      <input
                        type="checkbox"
                        role="switch"
                        aria-checked={isActive}
                        aria-label={`${isActive ? "Active blueprint" : "Set as active blueprint"}: ${bp.name}`}
                        checked={isActive}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setActiveBlueprint(bp.id);
                            refresh();
                          }
                        }}
                        className="peer absolute inset-0 z-10 cursor-pointer opacity-0"
                      />
                      <span
                        aria-hidden
                        className="pointer-events-none absolute inset-x-0 top-1/2 h-5 w-full max-w-[2.5rem] -translate-y-1/2 rounded-full bg-[#d1d5db] transition-colors peer-checked:bg-accent"
                      />
                      <span
                        aria-hidden
                        className="pointer-events-none absolute left-0.5 top-1/2 size-4 -translate-y-1/2 rounded-full bg-white shadow transition-transform peer-checked:translate-x-[1.25rem]"
                      />
                    </span>
                  </label>
                  <Link
                    href={`/developer/lead-settings/blueprint-configurator?edit=${encodeURIComponent(bp.id)}`}
                    className="inline-flex items-center justify-center rounded-lg bg-accent px-2.5 py-1 text-[10px] font-semibold text-white transition hover:opacity-95 sm:px-3 sm:text-[11px]"
                  >
                    Edit
                  </Link>
                  <button
                    type="button"
                    onClick={() => onDuplicate(bp.id)}
                    className="rounded-lg border border-border-soft bg-white px-2.5 py-1 text-[10px] font-medium text-ink transition hover:border-accent/40 sm:text-[11px]"
                  >
                    Duplicate
                  </button>
                  <button
                    type="button"
                    disabled={lib.blueprints.length <= 1}
                    onClick={() => {
                      if (deleteBlueprint(bp.id)) refresh();
                    }}
                    className="rounded-lg border border-border-soft px-2.5 py-1 text-[10px] font-medium text-red-700 transition enabled:hover:border-red-300 enabled:hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 sm:text-[11px]"
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
