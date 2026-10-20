"use client";

/**
 * Studio shell (Epic C #788), built in-house after the "Dashboard Shell" docs the dev supplied:
 * a resizable sidebar (drag the edge, arrow keys on the handle, double-click resets; the width is remembered),
 * grouped navigation with one active pill that slides to the chosen item, and the page content beside it.
 * Desktop only — phones keep StudioMobileShell. Reduced motion: the pill and the resize do not animate.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import Mascot from "../../components/mascot/Mascot";
import { getActiveStudioTab, STUDIO_TABS } from "./studioTabs";
import { SIDEBAR, clampSidebarWidth } from "../lib/shellMath";

const WIDTH_KEY = "md-studio-sidebar";
const ITEM_H = 40; // px per nav row — the active pill moves in these steps

function readWidth(): number {
  try {
    return clampSidebarWidth(Number(localStorage.getItem(WIDTH_KEY) ?? SIDEBAR.initial));
  } catch {
    return SIDEBAR.initial;
  }
}

export default function StudioShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const active = getActiveStudioTab(pathname);
  const activeIndex = Math.max(0, STUDIO_TABS.findIndex((t) => t.key === active));
  const [width, setWidth] = useState<number>(SIDEBAR.initial);
  const dragging = useRef(false);

  // Restore the remembered width after mount (localStorage is not available during SSR).
  useEffect(() => {
    const w = readWidth();
    if (w !== SIDEBAR.initial) requestAnimationFrame(() => setWidth(w));
  }, []);

  const commit = useCallback((w: number) => {
    const next = clampSidebarWidth(w);
    setWidth(next);
    try {
      localStorage.setItem(WIDTH_KEY, String(next));
    } catch {
      /* private mode */
    }
  }, []);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (dragging.current) setWidth(clampSidebarWidth(e.clientX));
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    dragging.current = false;
    commit(e.clientX);
  };
  // A cancelled pointer (touch scroll takeover, window blur) must end the drag, or a later hover resizes.
  const onPointerCancel = () => {
    dragging.current = false;
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft") commit(width - SIDEBAR.step);
    else if (e.key === "ArrowRight") commit(width + SIDEBAR.step);
    else if (e.key === "Home") commit(SIDEBAR.min);
    else if (e.key === "End") commit(SIDEBAR.max);
    else return;
    e.preventDefault();
  };

  return (
    <div style={{ "--studio-sidebar": `${width}px` } as CSSProperties}>
      <aside
        aria-label="เมนูสตูดิโอ"
        className="fixed bottom-0 left-0 top-16 z-30 hidden border-r border-line bg-bg md:flex md:w-[var(--studio-sidebar)] md:flex-col"
      >
        <div className="px-5 pb-3 pt-6">
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.1em] text-ink-3">Studio</p>
        </div>

        <nav className="relative px-3">
          <span
            aria-hidden
            className="absolute inset-x-3 top-0 rounded-[var(--r2)] bg-fill transition-transform duration-[var(--t2)] ease-[var(--ease)]"
            style={{ height: ITEM_H - 4, transform: `translateY(${activeIndex * ITEM_H}px)` }}
          />
          <ul className="relative">
            {STUDIO_TABS.map((tab) => {
              const isActive = tab.key === active;
              return (
                <li key={tab.key} style={{ height: ITEM_H }}>
                  <Link
                    href={tab.href}
                    aria-current={isActive ? "page" : undefined}
                    className={`flex h-9 items-center gap-3 rounded-[var(--r2)] px-3 text-sm transition-colors duration-[var(--t1)] ${
                      isActive ? "text-ink" : "text-ink-2 hover:text-ink"
                    }`}
                  >
                    {tab.icon("h-4 w-4 shrink-0")}
                    <span className="truncate">{tab.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="mt-auto flex items-center gap-3 border-t border-line px-5 py-4">
          <Mascot area="studio" size={36} interactive={false} paused label="มาสคอตสตูดิโอ" />
          <Link href="/studio/upload" className="text-sm text-ink-2 transition-colors hover:text-ink">
            อัปโหลดงานใหม่ →
          </Link>
        </div>

        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="ปรับความกว้างเมนู"
          aria-valuemin={SIDEBAR.min}
          aria-valuemax={SIDEBAR.max}
          aria-valuenow={width}
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onLostPointerCapture={onPointerCancel}
          onKeyDown={onKeyDown}
          onDoubleClick={() => commit(SIDEBAR.initial)}
          className="absolute -right-1 top-0 h-full w-2 cursor-col-resize after:absolute after:inset-y-0 after:left-1/2 after:w-px after:bg-transparent after:transition-colors hover:after:bg-ink-3 focus-visible:outline-none focus-visible:after:w-0.5 focus-visible:after:bg-accent"
        />
      </aside>

      <div className="md:pl-[var(--studio-sidebar)]">{children}</div>
    </div>
  );
}
