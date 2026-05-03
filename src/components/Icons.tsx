import type { SVGProps } from "react";

export function IconHome(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M3 9.5L12 3l9 6.5V21a1 1 0 0 1-1 1h-5v-8H9v8H4a1 1 0 0 1-1-1V9.5z" />
    </svg>
  );
}

export function IconFlow(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M7 16V4M7 4L3 8M7 4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
    </svg>
  );
}

export function IconWallet(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M19 7V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1M19 7H9a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h10m0-6v6" />
      <circle cx="17" cy="12" r="1" fill="currentColor" />
    </svg>
  );
}

export function IconCart(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <circle cx="9" cy="20" r="1" />
      <circle cx="17" cy="20" r="1" />
      <path d="M3 3h2l.4 2M7 13h10l3-8H5.4M7 13L5.4 5M7 13l-1.3 5M17 13l1.3 5" />
    </svg>
  );
}

export function IconFuel(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M3 22V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M3 22h12M3 22H1M19 10V6a2 2 0 0 0-2-2h-2M19 10v8a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2z" />
    </svg>
  );
}

/** Entradas futuras (valores a receber). */
export function IconFutureIncome(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 3v7" />
      <path d="M8 8l4-4 4 4" />
      <rect x="3" y="14" width="18" height="7" rx="2" />
      <path d="M7 17h2M15 17h2" />
    </svg>
  );
}

export function IconEdit(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

export function IconTrash(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14zM10 11v6M14 11v6" />
    </svg>
  );
}

export function IconPlus(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" {...props}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconCalendar(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

/** Agenda / lembretes (distinto do ícone de escolher mês). */
export function IconAgenda(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="4" y="3" width="14" height="18" rx="2" />
      <path d="M8 7h8M8 11h8M8 15h5M8 19h6" />
      <path d="M17 3v3M17 6h2" opacity="0.65" />
    </svg>
  );
}

export function IconChevronDown(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function IconChevronLeft(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

export function IconChevronRight(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

export function IconX(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...props}>
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

export function IconSearch(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

export function IconSettings(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
