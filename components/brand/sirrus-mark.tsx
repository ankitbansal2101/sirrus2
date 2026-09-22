export function SirrusMark({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="9" fill="#16140f" />
      <path
        d="M9.2 20.4c0-4.6 3.2-6.4 7.1-7.2 2.2-.45 3.5-1.1 3.5-2.3 0-1.35-1.3-2.2-3.3-2.2-2.2 0-3.6 1-4.1 2.6l-2.5-.7C10.6 8.1 13.1 6.4 16.6 6.4c3.9 0 6.3 2.1 6.3 5.1 0 3.3-2.4 4.8-6.3 5.6-2.5.5-4 1.25-4 2.6 0 1.5 1.5 2.4 3.7 2.4 2.4 0 4-1.15 4.6-3l2.5.7c-.8 2.9-3.6 4.8-7.2 4.8-4.1 0-6.9-2.2-6.9-5.2Z"
        fill="#f4efe6"
      />
    </svg>
  );
}

export function SirrusWordmark({ inverted = false }: { inverted?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 ${inverted ? "text-rail-ink" : "text-ink"}`}>
      <SirrusMark className="size-7" />
      <span className="font-display text-[19px] leading-none tracking-tight">
        sirrus
        <span className={inverted ? "text-gold" : "text-accent"}>.ai</span>
      </span>
    </span>
  );
}
