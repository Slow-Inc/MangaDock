/**
 * DevImageCacheToggle — floating dev-only button to test the img-cache fallback.
 *
 * When IMAGE_CACHE_ENABLED=true on the backend, toggling this ON will:
 *  • append ?forceLocal=true to backend API calls (via URL param + localStorage)
 *  • the backend swaps external CDN URLs with local /img-cache/ paths where cached
 *
 * Visible only when NEXT_PUBLIC_IMAGE_CACHE_DEV_TOOLS=true (set in .env.local).
 * For chapter pages the flag is read from localStorage — no reload needed.
 * For the landing page (SSR) the page reloads with ?forceLocal=1 in the URL.
 */

"use client";

import { useEffect, useState } from "react";

export const LS_KEY = "imgCacheForceLocal";

export default function DevImageCacheToggle() {
  const [active, setActive] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setActive(localStorage.getItem(LS_KEY) === "1");
  }, []);

  // Only render in browser and when dev tools are enabled
  if (!mounted) return null;
  if (process.env.NEXT_PUBLIC_IMAGE_CACHE_DEV_TOOLS !== "true") return null;

  const toggle = () => {
    const next = !active;
    if (next) {
      localStorage.setItem(LS_KEY, "1");
      // Reload the landing page with ?forceLocal=1 so the SSR fetch uses it
      const url = new URL(window.location.href);
      url.searchParams.set("forceLocal", "1");
      window.location.href = url.toString();
    } else {
      localStorage.removeItem(LS_KEY);
      const url = new URL(window.location.href);
      url.searchParams.delete("forceLocal");
      window.location.href = url.toString();
    }
  };

  return (
    <button
      onClick={toggle}
      title={
        active
          ? "forceLocal ON — API is returning /img-cache paths. Click to disable."
          : "forceLocal OFF — API is using external CDN URLs. Click to enable img-cache test."
      }
      className={[
        "fixed bottom-4 right-4 z-9999",
        "flex items-center gap-1.5 px-3 py-1.5",
        "rounded-full backdrop-blur-sm",
        "text-white text-[0.7rem] font-semibold tracking-wide leading-none",
        "cursor-pointer select-none transition-colors duration-200",
        active
          ? "bg-green-950/85 border border-green-500/50"
          : "bg-red-950/85 border border-red-500/50",
      ].join(" ")}
    >
      <span className="text-[0.65rem]">{active ? "🟢" : "🔴"}</span>
      <span>IMG&nbsp;CACHE&nbsp;{active ? "FORCED LOCAL" : "NORMAL"}</span>
    </button>
  );
}
