import Link from "next/link";
import type { ReactNode } from "react";
import { IconChevronLeft } from "@/components/icons";

type DeveloperPageHeaderProps = {
  backHref: string;
  backAriaLabel?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
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
    <header className="shrink-0 border-b border-border-soft bg-surface/90 backdrop-blur">
      <div className={`mx-auto flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:gap-3 sm:px-6 ${max}`}>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Link
            href={backHref}
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border-soft bg-surface text-ink transition hover:bg-[#f7f1e6]"
            aria-label={backAriaLabel}
          >
            <IconChevronLeft className="size-4" />
          </Link>
          <div className="min-w-0 py-0.5">
            <h1 className="display text-[22px] leading-tight text-ink">{title}</h1>
            {description ? (
              <div className="mt-0.5 max-w-[44rem] text-[12px] leading-snug text-muted">{description}</div>
            ) : null}
          </div>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
