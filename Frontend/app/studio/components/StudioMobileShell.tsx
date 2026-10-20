"use client";

import type { ReactNode } from "react";

export function StudioMobileHeader({
  title,
  subtitle,
  onBack,
}: {
  title: string;
  subtitle: string;
  onBack?: () => void;
}) {
  return (
    <div className="sticky top-0 z-20 border-b border-line bg-bg px-4 py-3">
      <div className="flex items-center gap-3">
        {onBack ? (
          <button
            onClick={onBack}
            aria-label="กลับ"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-fill text-ink-2 transition hover:bg-raised hover:text-ink"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        ) : null}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{title}</p>
          <p className="truncate text-[11px] text-ink-3">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

export function StudioMobileHero({
  title,
  description,
  aside,
}: {
  title: string;
  description: string;
  aside?: ReactNode;
}) {
  return (
    <div className="rounded-[1.75rem] border border-line bg-fill px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="mt-2 text-[1.65rem] font-semibold leading-tight text-ink">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-ink-3">{description}</p>
        </div>
        {aside ? <div className="shrink-0">{aside}</div> : null}
      </div>
    </div>
  );
}

export function StudioMobileMenuCard({
  icon,
  title,
  description,
  value,
  tone = "default",
  onClick,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  value?: string;
  tone?: "default" | "indigo" | "emerald" | "amber" | "rose";
  onClick: () => void;
}) {
  const toneStyles = {
    default: "border-line bg-fill text-ink",
    indigo: "border-accent/20 bg-fill text-accent",
    emerald: "border-ok/20 bg-ok/10 text-ok",
    amber: "border-coin/20 bg-coin/10 text-coin",
    rose: "border-danger/20 bg-danger/10 text-danger",
  } as const;

  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-[1.4rem] border px-4 py-4 text-left transition active:scale-[0.99] ${toneStyles[tone]}`}
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-fill">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-ink">{title}</p>
          {value ? (
            <span className="rounded-full bg-fill px-2 py-0.5 text-[10px] font-medium text-ink-2">
              {value}
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-xs leading-5 text-ink-3">{description}</p>
      </div>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 shrink-0 text-ink-3">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}

export function StudioMobileSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[1.5rem] border border-line bg-fill p-4">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {subtitle ? <p className="mt-1 text-xs leading-5 text-ink-3">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}
