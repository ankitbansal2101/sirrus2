import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;

export function IconLeadForm({ className, ...p }: P) {
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" {...p}>
      <rect x="8" y="6" width="24" height="28" rx="3" stroke="currentColor" strokeWidth="1.75" />
      <path d="M12 14h16M12 19h10M12 24h14" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="m26 8 6 6M26 8v4M26 8h4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

export function IconRules({ className, ...p }: P) {
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" {...p}>
      <path d="M8 12h24M8 20h24M8 28h24" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <circle cx="26" cy="12" r="3" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="14" cy="20" r="3" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="22" cy="28" r="3" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

export function IconReports({ className, ...p }: P) {
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" {...p}>
      <rect x="9" y="6" width="22" height="28" rx="3" stroke="currentColor" strokeWidth="1.75" />
      <path d="M13 14h14M13 19h10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <circle cx="20" cy="26" r="5" stroke="currentColor" strokeWidth="1.75" />
      <path d="M18 26l1.5 1.5L23 24" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconConnectors({ className, ...p }: P) {
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" {...p}>
      <path d="M6 12h8M6 20h8M6 28h8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <circle cx="22" cy="12" r="4" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="28" cy="20" r="4" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="22" cy="28" r="4" stroke="currentColor" strokeWidth="1.75" />
      <path d="M14 12h4M18 20h6M14 28h4" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

export function IconWhatsapp({ className, ...p }: P) {
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" {...p}>
      <path
        d="M20 6c-7.18 0-13 5.38-13 12 0 2.1.58 4.08 1.6 5.8L7 34l6.5-1.7A12.8 12.8 0 0 0 20 30c7.18 0 13-5.38 13-12S27.18 6 20 6Z"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path d="M14 18h2M18 22h6M14 26h8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

export function IconWorkflow({ className, ...p }: P) {
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" {...p}>
      <circle cx="20" cy="14" r="5" stroke="currentColor" strokeWidth="1.75" />
      <path d="M12 32v-2a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <circle cx="28" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M26 26h6M29 23v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function IconManageLeads({ className, ...p }: P) {
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" {...p}>
      <rect x="7" y="8" width="26" height="26" rx="3" stroke="currentColor" strokeWidth="1.75" />
      <path d="M11 14h18M11 20h18M11 26h12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <circle cx="28" cy="26" r="2.5" fill="currentColor" />
    </svg>
  );
}

export function IconFieldsConfigurator({ className, ...p }: P) {
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" {...p}>
      <rect x="7" y="8" width="26" height="24" rx="3" stroke="currentColor" strokeWidth="1.75" />
      <path d="M7 15h26" stroke="currentColor" strokeWidth="1.75" />
      <path d="M16 8v24M27 8v24" stroke="currentColor" strokeWidth="1.5" />
      <path d="M11 20h3M11 25h3M20 20h4M20 25h5M29 20h2M29 25h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** Stages on a canvas with connectors — blueprint / pipeline designer. */
export function IconBlueprint({ className, ...p }: P) {
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" {...p}>
      <rect x="14" y="7" width="12" height="8" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M20 15v4" stroke="currentColor" strokeWidth="1.5" />
      <rect x="14" y="19" width="12" height="8" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M20 27v4" stroke="currentColor" strokeWidth="1.5" />
      <rect x="14" y="31" width="12" height="6" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M28 11h4M28 23h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="34" cy="11" r="2" fill="currentColor" />
      <circle cx="34" cy="23" r="2" fill="currentColor" />
    </svg>
  );
}
