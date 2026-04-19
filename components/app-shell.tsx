import Link from "next/link";
import {
  IconChart,
  IconHandshake,
  IconHome,
  IconMegaphone,
  IconOrg,
  IconSettings,
  IconUsers,
  IconBell,
  IconChevronDown,
} from "@/components/icons";

const railItems = [
  { href: "#", icon: IconHome, label: "Home", active: false },
  { href: "#", icon: IconOrg, label: "Organization", active: false },
  { href: "#", icon: IconMegaphone, label: "Campaigns", active: false },
  { href: "#", icon: IconHandshake, label: "Partners", active: false },
  { href: "#", icon: IconChart, label: "Analytics", active: false },
  { href: "#", icon: IconUsers, label: "Users", active: false },
  { href: "#", icon: IconSettings, label: "Settings", active: true },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-svh min-h-0 flex-col overflow-hidden">
      <header className="shrink-0 border-b border-border-soft bg-surface px-3 py-1.5 sm:px-4">
        <div className="mx-auto flex h-10 max-w-[1600px] items-center justify-between gap-2 sm:h-11 sm:gap-3">
          <Link
            href="/"
            className="shrink-0 text-base font-semibold tracking-tight text-ink sm:text-[17px]"
          >
            sirus.ai
          </Link>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              className="relative rounded-lg p-1.5 text-accent transition hover:bg-white/80"
              aria-label="Notifications"
            >
              <IconBell className="size-[1.125rem] sm:size-5" />
              <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold leading-none text-white sm:h-4 sm:min-w-4 sm:text-[10px]">
                10
              </span>
            </button>
            <div className="flex max-w-[11rem] items-center gap-1.5 rounded-lg border border-border-soft bg-white/90 py-1 pl-1 pr-2 shadow-sm sm:max-w-[13rem] sm:gap-2 sm:pr-2.5">
              <div className="size-7 shrink-0 rounded-full bg-[#E4E5E6] sm:size-8" aria-hidden />
              <div className="min-w-0 text-left leading-tight">
                <p className="truncate text-[11px] font-semibold text-ink sm:text-xs">ANKIT PICKY TES…</p>
                <p className="truncate text-[10px] text-muted sm:text-[11px]">Pre Sales Executive</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 items-stretch">
        <aside className="flex w-16 shrink-0 flex-col items-center gap-1 self-stretch border-r border-border-soft bg-surface py-2 sm:w-[4.25rem] sm:py-3">
          {railItems.map(({ href, icon: Icon, label, active }) => (
            <Link
              key={label}
              href={href}
              title={label}
              className={`flex size-9 items-center justify-center rounded-lg transition sm:size-10 ${
                active ? "bg-rail-active text-accent shadow-sm" : "bg-rail-inactive text-accent/80 hover:bg-white"
              }`}
            >
              <Icon className="size-[1.125rem] sm:size-5" />
            </Link>
          ))}
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export function ProjectSelector() {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-2 rounded-2xl border border-border-soft bg-surface px-4 py-2.5 text-sm font-medium text-ink shadow-sm transition hover:shadow-md"
    >
      ABC tower
      <IconChevronDown className="size-4 text-muted" />
    </button>
  );
}
