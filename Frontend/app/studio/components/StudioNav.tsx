"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  {
    key: "overview",
    label: "ภาพรวม",
    href: "/studio",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
        <path d="M3 3v18h18" />
        <path d="M7 16l4-8 4 4 4-6" />
      </svg>
    ),
  },
  {
    key: "works",
    label: "ผลงาน",
    href: "/studio/works",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
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
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
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
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
        <circle cx="12" cy="8" r="5" />
        <path d="M20 21a8 8 0 0 0-16 0" />
      </svg>
    ),
  },
] as const;

export default function StudioNav() {
  const pathname = usePathname();

  const activeKey =
    pathname === "/studio"
      ? "overview"
      : pathname.startsWith("/studio/works")
        ? "works"
        : pathname.startsWith("/studio/wallet")
          ? "wallet"
          : pathname.startsWith("/studio/account")
            ? "account"
            : "overview";

  return (
    <nav className="border-b border-white/10">
      <div className="flex gap-1">
        {tabs.map((tab) => {
          const isActive = tab.key === activeKey;
          return (
            <Link
              key={tab.key}
              href={tab.href}
              className={`relative flex flex-col items-center gap-0.5 px-3 py-2.5 text-xs transition-colors sm:flex-row sm:gap-2 sm:px-4 sm:text-sm ${
                isActive
                  ? "text-indigo-400"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {isActive && (
                <span className="absolute bottom-0 left-0 h-0.5 w-full bg-indigo-400" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
