import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { className?: string };

export function IconHome(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" strokeLinejoin="round" />
    </svg>
  );
}

export function IconOrg(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <rect x="4" y="4" width="6" height="6" rx="1" />
      <rect x="14" y="4" width="6" height="6" rx="1" />
      <rect x="4" y="14" width="6" height="6" rx="1" />
      <rect x="14" y="14" width="6" height="6" rx="1" />
    </svg>
  );
}

export function IconMegaphone(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path d="M4 11v4a2 2 0 0 0 2 2h2l4 3v-14l-4 3H6a2 2 0 0 0-2 2Z" strokeLinejoin="round" />
      <path d="M18 9a4 4 0 0 1 0 6" />
    </svg>
  );
}

export function IconHandshake(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path d="M8 11 6 9a2 2 0 0 1 0-3l1-1a2 2 0 0 1 3 0l1 1M16 11l2-2a2 2 0 0 0 0-3l-1-1a2 2 0 0 0-3 0l-1 1" />
      <path d="m9 14 2 2 2-2M7 12l-2 2 4 4 3-3M17 12l2 2-4 4-3-3" strokeLinejoin="round" />
    </svg>
  );
}

export function IconChart(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path d="M4 19V5M4 19h16M8 15v-4M12 15V8M16 15v-6" strokeLinecap="round" />
    </svg>
  );
}

export function IconUsers(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 19v-1a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v1" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M21 19v-1a3 3 0 0 0-2.4-2.94" />
    </svg>
  );
}

export function IconSettings(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" strokeLinecap="round" />
    </svg>
  );
}

export function IconChevronLeft(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M15 6 9 12l6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconChevronDown(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconArrowUpRight(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M7 17 17 7M9 7h8v8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconBell(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 7 3 7H3s3 0 3-7" strokeLinejoin="round" />
      <path d="M10 21a2 2 0 0 0 4 0" strokeLinecap="round" />
    </svg>
  );
}

export function IconPlus(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

export function IconSparkle(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path d="M12 3.5 13.4 8.2 18 9.5 13.4 10.8 12 15.5 10.6 10.8 6 9.5 10.6 8.2 12 3.5Z" strokeLinejoin="round" />
      <path d="M18.5 14.5 19.2 16.6 21.5 17.2 19.2 17.8 18.5 20 17.8 17.8 15.5 17.2 17.8 16.6 18.5 14.5Z" strokeLinejoin="round" />
    </svg>
  );
}

export function IconSend(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path d="M4.5 12 19 5l-4.2 14-3.3-4.8L4.5 12Z" strokeLinejoin="round" />
      <path d="m11.5 14.2 3.3-4.2" strokeLinecap="round" />
    </svg>
  );
}

export function IconEye(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path d="M2.8 12s3.2-6 9.2-6 9.2 6 9.2 6-3.2 6-9.2 6-9.2-6-9.2-6Z" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="2.4" />
    </svg>
  );
}

export function IconShieldCheck(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path d="M12 3.5 19 6.2v5.3c0 4.3-2.8 7.4-7 9-4.2-1.6-7-4.7-7-9V6.2L12 3.5Z" strokeLinejoin="round" />
      <path d="m8.8 12 2.2 2.2 4.2-4.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconCheckCircle(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <circle cx="12" cy="12" r="8.25" />
      <path d="m8.7 12.2 2.2 2.2 4.4-4.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconClose(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M7 7 17 17M17 7 7 17" strokeLinecap="round" />
    </svg>
  );
}

export function IconUser(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <circle cx="12" cy="8.5" r="3" />
      <path d="M6 18.5v-.6A4.4 4.4 0 0 1 10.4 13.5h3.2A4.4 4.4 0 0 1 18 17.9v.6" strokeLinecap="round" />
    </svg>
  );
}

export function IconTool(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path d="M14.2 6.2a3.6 3.6 0 0 0-5 4.9L5 15.3a1.8 1.8 0 0 0 2.5 2.5l4.2-4.2a3.6 3.6 0 0 0 4.9-5l-2.2 2.2-2.2-2.2 2-2.4Z" strokeLinejoin="round" />
    </svg>
  );
}

export function IconBraces(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path d="M9 5.5H8.2A2.2 2.2 0 0 0 6 7.7v2.1c0 .9-.6 1.7-1.5 1.7.9 0 1.5.8 1.5 1.7v2.1A2.2 2.2 0 0 0 8.2 18.5H9" strokeLinecap="round" />
      <path d="M15 5.5h.8A2.2 2.2 0 0 1 18 7.7v2.1c0 .9.6 1.7 1.5 1.7-.9 0-1.5.8-1.5 1.7v2.1a2.2 2.2 0 0 1-2.2 2.2H15" strokeLinecap="round" />
    </svg>
  );
}

export function IconFlow(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <rect x="3.5" y="4.5" width="6.5" height="4.5" rx="1.2" />
      <rect x="14" y="9.75" width="6.5" height="4.5" rx="1.2" />
      <rect x="3.5" y="15" width="6.5" height="4.5" rx="1.2" />
      <path d="M10 6.75h2.2A2.3 2.3 0 0 1 14.5 9v3M10 17.25h2.2A2.3 2.3 0 0 0 14.5 15v-1.2" strokeLinecap="round" />
    </svg>
  );
}

export function IconTrash(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M10 11v6M14 11v6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 7l1 14a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-14" strokeLinejoin="round" />
    </svg>
  );
}
