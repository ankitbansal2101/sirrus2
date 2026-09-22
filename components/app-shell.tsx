"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { SirusMark } from "@/components/brand/sirus-mark";
import { CommandPalette } from "@/components/command-palette";
import {
  IconBell,
  IconChart,
  IconHandshake,
  IconHome,
  IconMegaphone,
  IconOrg,
  IconSettings,
  IconSparkle,
  IconTable,
  IconUsers,
  IconWidget,
} from "@/components/icons";
import { CrmAgentPanel } from "@/components/crm/crm-agent-panel";
import { useCrm } from "@/components/crm/crm-provider";
import type { CrmModuleIcon } from "@/lib/crm/types";

const iconMap: Record<CrmModuleIcon, typeof IconTable> = {
  leads: IconUsers,
  deals: IconChart,
  contacts: IconHandshake,
  visits: IconOrg,
  bookings: IconMegaphone,
  tickets: IconSparkle,
  custom: IconTable,
};

function railClass(active: boolean) {
  return `rail-item ${
    active
      ? "bg-white/10 text-white shadow-[inset_0_0_0_1px_rgba(255,253,248,0.08)]"
      : "text-[#b7ae9e] hover:bg-white/10 hover:text-rail-ink"
  }`;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { workspace } = useCrm();
  const [universalOpen, setUniversalOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const modules = workspace?.modules ?? [];
  const firstModuleHref = modules[0] ? `/crm/modules/${modules[0].id}` : "/";
  const settingsActive =
    pathname === "/" ||
    pathname.startsWith("/developer") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/settings");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex h-svh min-h-0 flex-col overflow-hidden bg-canvas">
      <header className="shrink-0 border-b border-border-soft bg-surface/90 px-3 backdrop-blur-md sm:px-4">
        <div className="flex h-14 items-center justify-between gap-3">
          <Link href={firstModuleHref} className="flex shrink-0 items-center gap-2.5">
            <SirusMark className="size-8" />
            <span className="hidden font-display text-[20px] tracking-tight text-ink sm:block">
              sirus<span className="text-accent">.ai</span>
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setCommandOpen(true)}
            className="hidden h-9 min-w-[16rem] items-center justify-between rounded-full border border-border-soft bg-[#f7f1e6] px-3 text-[12px] text-muted md:flex"
          >
            <span>Search workspace…</span>
            <kbd className="rounded-md bg-white px-1.5 py-0.5 text-[10px] font-semibold text-ink ring-1 ring-border-soft">
              Ctrl K
            </kbd>
          </button>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setCommandOpen(true)}
              className="rounded-full p-2 text-ink transition hover:bg-[#f6f0e4] md:hidden"
              aria-label="Search"
            >
              <IconTable className="size-4" />
            </button>
            <button
              type="button"
              className="rounded-full p-2 text-ink transition hover:bg-[#f6f0e4]"
              aria-label="Notifications"
            >
              <IconBell className="size-5" />
            </button>
            <div className="flex max-w-[15rem] items-center gap-2 rounded-full border border-border-soft bg-[#f7f1e6] py-1 pl-1 pr-3">
              <div className="avatar size-7 bg-ink text-[10px] text-white">
                {(workspace?.orgName ?? "S").slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 text-left leading-tight">
                <p className="truncate text-[12px] font-semibold text-ink">{workspace?.orgName ?? "Workspace"}</p>
                <p className="truncate text-[10px] text-muted">{workspace?.industryLabel ?? "Admin"}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 items-stretch">
        <aside className="flex w-[4.75rem] shrink-0 flex-col items-center gap-1 self-stretch overflow-y-auto bg-rail px-1.5 py-3 text-rail-ink">
          {modules.length === 0 ? (
            <Link href="/" title="Home" className={railClass(pathname === "/")}>
              <IconHome className="size-5" />
              <span>Home</span>
            </Link>
          ) : (
            modules.map((m) => {
              const Icon = iconMap[m.icon] ?? IconTable;
              const href = `/crm/modules/${m.id}`;
              const active = pathname.startsWith(href);
              return (
                <Link key={m.id} href={href} title={m.pluralLabel} className={railClass(active)}>
                  <Icon className="size-5" />
                  <span className="max-w-full truncate">{m.pluralLabel}</span>
                </Link>
              );
            })
          )}
          {modules.length > 0 ? (
            <Link href="/crm/charts" title="Charts" className={railClass(pathname.startsWith("/crm/charts"))}>
              <IconChart className="size-5" />
              <span>Charts</span>
            </Link>
          ) : null}
          <Link
            href="/crm/widgets"
            title="Widgets"
            className={railClass(pathname.startsWith("/crm/widgets") || pathname.startsWith("/developer/lead-settings/widgets"))}
          >
            <IconWidget className="size-5" />
            <span>Widgets</span>
          </Link>
          <div className="mt-auto flex w-full flex-col items-center gap-1 pb-1">
            {modules.length > 0 ? (
              <button
                type="button"
                title="Workspace agent"
                aria-label="Workspace agent"
                onClick={() => setUniversalOpen(true)}
                className={railClass(universalOpen)}
              >
                <IconSparkle className="size-5" />
                <span>Agent</span>
              </button>
            ) : null}
            <Link
              href="/"
              title="Settings"
              className={railClass(
                settingsActive &&
                  !pathname.startsWith("/crm/modules") &&
                  !pathname.startsWith("/crm/widgets") &&
                  !pathname.startsWith("/developer/lead-settings/widgets"),
              )}
            >
              <IconSettings className="size-5" />
              <span>Settings</span>
            </Link>
          </div>
        </aside>

        <div
          className={`flex min-h-0 min-w-0 flex-1 flex-col ${
            pathname.startsWith("/crm/modules") ||
            pathname.startsWith("/crm/charts") ||
            pathname.startsWith("/crm/widgets") ||
            pathname.startsWith("/developer/lead-settings/widgets")
              ? "overflow-hidden"
              : "overflow-y-auto"
          }`}
        >
          {children}
        </div>
      </div>
      <CrmAgentPanel
        open={universalOpen}
        onClose={() => setUniversalOpen(false)}
        mode={workspace?.workspaceAgentId ? "custom" : "universal"}
        customAgentId={workspace?.workspaceAgentId ?? null}
      />
      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} />
    </div>
  );
}

export function ProjectSelector() {
  const { workspace } = useCrm();
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-border-soft bg-surface px-3 py-1.5 text-[13px] font-medium text-ink">
      {workspace?.orgName ?? "Workspace"}
    </div>
  );
}
