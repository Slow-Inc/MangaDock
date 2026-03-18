"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getActiveStudioTab, STUDIO_TABS } from "./studioTabs";

export default function StudioNav() {
  const pathname = usePathname();
  const activeKey = getActiveStudioTab(pathname);

  return (
    <nav className="hidden border-b border-white/10 md:block">
      <div className="flex gap-1">
        {STUDIO_TABS.map((tab) => {
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
              {tab.icon("h-4 w-4")}
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
