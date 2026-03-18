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
    <div className="sticky top-0 z-20 border-b border-white/10 bg-[#141414]/92 px-4 py-3 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        {onBack ? (
          <button
            onClick={onBack}
            aria-label="กลับ"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        ) : null}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{title}</p>
          <p className="truncate text-[11px] text-white/40">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

export function StudioMobileHero({
  eyebrow,
  title,
  description,
  aside,
}: {
  eyebrow: string;
  title: string;
  description: string;
  aside?: ReactNode;
}) {
  return (
    <div className="rounded-[1.75rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(129,140,248,0.16),transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))] px-4 py-4 shadow-[0_28px_70px_-40px_rgba(0,0,0,0.9)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.32em] text-white/35">{eyebrow}</p>
          <h1 className="mt-2 text-[1.65rem] font-semibold leading-tight text-white">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-white/45">{description}</p>
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
    default: "border-white/10 bg-white/[0.045] text-white/80",
    indigo: "border-indigo-500/20 bg-indigo-500/10 text-indigo-200",
    emerald: "border-emerald-500/20 bg-emerald-500/10 text-emerald-200",
    amber: "border-amber-500/20 bg-amber-500/10 text-amber-200",
    rose: "border-rose-500/20 bg-rose-500/10 text-rose-200",
  } as const;

  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-[1.4rem] border px-4 py-4 text-left transition active:scale-[0.99] ${toneStyles[tone]}`}
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-black/20">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-white">{title}</p>
          {value ? (
            <span className="rounded-full bg-black/20 px-2 py-0.5 text-[10px] font-medium text-white/65">
              {value}
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-xs leading-5 text-white/45">{description}</p>
      </div>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 shrink-0 text-white/30">
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
    <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-4 shadow-[0_20px_50px_-40px_rgba(0,0,0,0.9)]">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        {subtitle ? <p className="mt-1 text-xs leading-5 text-white/40">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}
