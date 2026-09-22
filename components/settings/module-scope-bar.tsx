"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCrm } from "@/components/crm/crm-provider";

export function ModuleScopeBar({ noun }: { noun: string }) {
  const { workspace } = useCrm();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const modules = workspace?.modules ?? [];
  const current = params.get("module") ?? "";

  if (!modules.length) return null;

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border-soft bg-surface px-3 py-2 sm:px-4">
      <label className="text-[11px] font-medium text-muted">Module</label>
      <select
        value={current}
        onChange={(e) => {
          const next = new URLSearchParams(params.toString());
          if (e.target.value) next.set("module", e.target.value);
          else next.delete("module");
          const q = next.toString();
          router.replace(q ? `${pathname}?${q}` : pathname);
        }}
        className="rounded-lg border border-border-soft bg-white px-2 py-1 text-xs text-ink"
      >
        <option value="">Default (Manage leads schema)</option>
        {modules.map((m) => (
          <option key={m.id} value={m.id}>
            {m.pluralLabel}
          </option>
        ))}
      </select>
      <p className="text-[11px] text-muted">
        {current ? `Editing ${noun} for this module. Same tool as Settings.` : `Editing the shared ${noun} used by Manage leads.`}
      </p>
    </div>
  );
}
