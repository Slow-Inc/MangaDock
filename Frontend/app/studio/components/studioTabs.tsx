"use client";

import type { ReactNode } from "react";

export type StudioTabKey = "overview" | "works" | "wallet" | "account";

export type StudioTab = {
  key: StudioTabKey;
  label: string;
  href: string;
  icon: (className?: string) => ReactNode;
};

export const STUDIO_TABS: StudioTab[] = [
  {
    key: "overview",
    label: "ภาพรวม",
    href: "/studio",
    icon: (className = "h-4 w-4") => (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M3 3v18h18" />
        <path d="M7 16l4-8 4 4 4-6" />
      </svg>
    ),
  },
  {
    key: "works",
    label: "ผลงาน",
    href: "/studio/works",
    icon: (className = "h-4 w-4") => (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
        <path d="M8 7h6" />
        <path d="M8 11h4" />
      </svg>
    ),
  },
  {
    key: "wallet",
    label: "กระเป๋าเงิน",
    href: "/studio/wallet",
    icon: (className = "h-4 w-4") => (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
        <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
        <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
      </svg>
    ),
  },
  {
    key: "account",
    label: "บัญชี",
    href: "/studio/account",
    icon: (className = "h-4 w-4") => (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
        <circle cx="12" cy="8" r="5" />
        <path d="M20 21a8 8 0 0 0-16 0" />
      </svg>
    ),
  },
];

export function getActiveStudioTab(pathname: string): StudioTabKey {
  if (pathname === "/studio") return "overview";
  if (pathname.startsWith("/studio/works")) return "works";
  if (pathname.startsWith("/studio/wallet")) return "wallet";
  if (pathname.startsWith("/studio/account")) return "account";
  return "overview";
}
