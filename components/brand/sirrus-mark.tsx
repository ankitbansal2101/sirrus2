export function SirrusMark({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="9" fill="#16140f" />
      <path d="M7.2 23 13 9h3.6l5.9 14h-3.3l-1.3-3.3h-6.3L10.3 23Zm5.4-6h4.4l-2.2-5.6Z" fill="#f4efe6" />
      <path d="M24.8 11.3a5.1 5.1 0 1 0 0 9.4v-3.1a2.2 2.2 0 1 1 0-3.2Z" fill="#c2a875" />
    </svg>
  );
}

export function SirrusWordmark({ inverted = false }: { inverted?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 ${inverted ? "text-rail-ink" : "text-ink"}`}>
      <SirrusMark className="size-7" />
      <span className="font-display text-[19px] leading-none tracking-tight">
        Ankit <span className={inverted ? "text-gold" : "text-accent"}>CRM</span>
      </span>
    </span>
  );
}
