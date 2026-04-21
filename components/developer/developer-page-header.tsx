import Link from "next/link";
import type { ReactNode } from "react";
import { IconChevronLeft } from "@/components/icons";

const backBtnClass =
  "flex size-8 shrink-0 items-center justify-center rounded-full border border-border-soft bg-white text-accent shadow-sm transition hover:border-accent/30 hover:bg-white";

type DeveloperPageHeaderProps = {
  backHref: string;
  backAriaLabel?: string;
  title: string;
  description?: ReactNode;
  /** Right side: primary actions, toolbar, etc. */
  actions?: ReactNode;
  /** Narrow content column (e.g. blueprint list). */
  narrow?: boolean;
};

export function DeveloperPageHeader({
  backHref,
  backAriaLabel = "Back",
  title,
  description,
  actions,
  narrow,
}: DeveloperPageHeaderProps) {
  const max = narrow ? "max-w-[960px]" : "max-w-[1600px]";
  return (
    <header className="shrink-0 border-b border-border-soft bg-surface">
      <div className={`mx-auto flex flex-wrap items-center justify-between gap-2 px-3 py-2 sm:gap-3 sm:px-4 ${max}`}>
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <Link href={backHref} className={backBtnClass} aria-label={backAriaLabel}>
            <IconChevronLeft className="size-3.5 sm:size-4" />
          </Link>
          <div className="min-w-0 py-0.5">
            <h1 className="text-sm font-semibold leading-tight tracking-tight text-ink sm:text-[15px]">{title}</h1>
            {description ? (
              <div className="mt-0.5 max-w-[44rem] text-[11px] leading-snug text-muted sm:text-xs">{description}</div>
            ) : null}
          </div>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
