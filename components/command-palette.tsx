"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { IconChart, IconSettings, IconSparkle, IconTable, IconWidget } from "@/components/icons";
import { useCrm } from "@/components/crm/crm-provider";

type Dest = { href: string; title: string; hint: string; icon: typeof IconTable };

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { workspace } = useCrm();
  const [q, setQ] = useState("");

  const dests = useMemo<Dest[]>(() => {
    const modules = (workspace?.modules ?? []).map((m) => ({
      href: `/crm/modules/${m.id}`,
      title: m.pluralLabel,
      hint: `${m.records.length} records`,
      icon: IconTable,
    }));
    return [
      ...modules,
      { href: "/", title: "Settings", hint: "Workspace, modules, agents", icon: IconSettings },
      { href: "/developer/lead-settings/modules-configurator", title: "Modules studio", hint: "Fields, forms, blueprints", icon: IconTable },
      { href: "/crm/charts", title: "Charts", hint: "Ask for a chart", icon: IconChart },
      { href: "/crm/widgets", title: "Widgets", hint: "Marketplace embeds", icon: IconWidget },
      { href: "/developer/lead-settings/agents", title: "Agents", hint: "On-call and automations", icon: IconSparkle },
    ];
  }, [workspace]);

  const filtered = dests.filter((d) => {
    const hay = `${d.title} ${d.hint}`.toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  });

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  if (!open) return null;

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-[#12100c]/40 px-4 pt-[14vh] backdrop-blur-sm">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close search" onClick={onClose} />
      <div className="card relative w-full max-w-xl overflow-hidden rise">
        <div className="border-b border-border-soft px-4 py-3">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "Enter" && filtered[0]) go(filtered[0].href);
            }}
            placeholder="Jump to a module, setting, or studio…"
            className="w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-muted"
          />
        </div>
        <ul className="max-h-[22rem] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <li className="px-3 py-6 text-center text-[13px] text-muted">Nothing matches.</li>
          ) : (
            filtered.map((d) => {
              const Icon = d.icon;
              return (
                <li key={d.href + d.title}>
                  <button
                    type="button"
                    onClick={() => go(d.href)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-[#f6f0e4]"
                  >
                    <span className="avatar size-8">
                      <Icon className="size-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold text-ink">{d.title}</span>
                      <span className="block text-[11px] text-muted">{d.hint}</span>
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
        <p className="border-t border-border-soft px-4 py-2 text-[11px] text-muted">Enter to open · Esc to close · Ctrl K anytime</p>
      </div>
    </div>
  );
}
