"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
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
} from "@/components/icons";
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
  return `flex size-9 items-center justify-center rounded-lg transition sm:size-10 ${
    active ? "bg-rail-active text-accent shadow-sm" : "bg-rail-inactive text-accent/80 hover:bg-white"
  }`;
}

export function CrmShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { workspace } = useCrm();
  const modules = workspace?.modules ?? [];

  return (
    <div className="flex h-svh min-h-0 flex-col overflow-hidden">
      <header className="shrink-0 border-b border-border-soft bg-surface px-3 py-1.5 sm:px-4">
        <div className="mx-auto flex h-10 max-w-[1600px] items-center justify-between gap-2 sm:h-11 sm:gap-3">
          <Link href="/crm" className="shrink-0 text-base font-semibold tracking-tight text-ink sm:text-[17px]">
            sirus.ai
          </Link>
          <div className="hidden min-w-0 flex-1 items-center justify-center sm:flex">
            {workspace ? (
              <p className="truncate text-xs text-muted">
                {workspace.orgName}
                <span className="mx-1.5 text-border-soft">·</span>
                {workspace.industryLabel}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <Link
              href="/crm/studio"
              className="hidden items-center gap-1.5 rounded-lg border border-border-soft bg-white px-2.5 py-1.5 text-xs font-medium text-accent shadow-sm sm:inline-flex"
            >
              <IconSparkle className="size-3.5" />
              Configure
            </Link>
            <button type="button" className="relative rounded-lg p-1.5 text-accent transition hover:bg-white/80" aria-label="Notifications">
              <IconBell className="size-[1.125rem] sm:size-5" />
            </button>
            <div className="flex max-w-[11rem] items-center gap-1.5 rounded-lg border border-border-soft bg-white/90 py-1 pl-1 pr-2 shadow-sm sm:max-w-[13rem]">
              <div className="size-7 shrink-0 rounded-full bg-[#E4E5E6] sm:size-8" aria-hidden />
              <div className="min-w-0 text-left leading-tight">
                <p className="truncate text-[11px] font-semibold text-ink sm:text-xs">{workspace?.orgName ?? "Workspace"}</p>
                <p className="truncate text-[10px] text-muted sm:text-[11px]">Admin</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 items-stretch">
        <aside className="flex w-16 shrink-0 flex-col items-center gap-1 self-stretch overflow-y-auto border-r border-border-soft bg-surface py-2 sm:w-[4.25rem] sm:py-3">
          <Link href="/crm" title="Home" className={railClass(pathname === "/crm")}>
            <IconHome className="size-[1.125rem] sm:size-5" />
          </Link>
          {modules.map((m) => {
            const Icon = iconMap[m.icon] ?? IconTable;
            const href = `/crm/modules/${m.id}`;
            const active = pathname.startsWith(href);
            return (
              <Link key={m.id} href={href} title={m.pluralLabel} className={railClass(active)}>
                <Icon className="size-[1.125rem] sm:size-5" />
              </Link>
            );
          })}
          <div className="mt-auto flex flex-col items-center gap-1 pb-1">
            <Link href="/crm/studio" title="Modules" className={railClass(pathname.startsWith("/crm/studio"))}>
              <IconOrg className="size-[1.125rem] sm:size-5" />
            </Link>
            <Link href="/" title="Settings" className={railClass(pathname === "/" || pathname.startsWith("/developer"))}>
              <IconSettings className="size-[1.125rem] sm:size-5" />
            </Link>
          </div>
        </aside>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
