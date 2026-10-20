"use client";

/**
 * Studio shell (Epic C #788), built in-house after the "Dashboard Shell" docs the dev supplied:
 * a resizable sidebar (drag the edge, arrow keys on the handle, double-click resets; the width is remembered) with
 * grouped navigation and one active pill that slides to the chosen item; under 672 px the same navigation opens as a
 * drawer. Beside it, a header with the page title and a status pill (the account's Studio role), then the page,
 * which scrolls on its own. Pages add their tabs and actions with `StudioToolbar`.
 * Reduced motion: the pill, the drawer and the resize do not animate (globals.css).
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import Navbar from "../../components/Navbar";
import Badge from "../../components/ui/Badge";
import Mascot from "../../components/mascot/Mascot";
import { useAuth } from "../../contexts/AuthContext";
import { getActiveStudioTab, STUDIO_TABS } from "./studioTabs";
import { SIDEBAR, clampSidebarWidth, studioPageTitle, studioRoleLabel } from "../lib/shellMath";

const WIDTH_KEY = "md-studio-sidebar";
const ITEM_H = 40; // px per nav row — the active pill moves in these steps

function readWidth(): number {
  try {
    return clampSidebarWidth(Number(localStorage.getItem(WIDTH_KEY) ?? SIDEBAR.initial));
  } catch {
    return SIDEBAR.initial;
  }
}

/** The grouped navigation, shared by the sidebar and the drawer. */
function StudioNav({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const active = getActiveStudioTab(pathname);
  const activeIndex = Math.max(0, STUDIO_TABS.findIndex((t) => t.key === active));
  return (
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
                onClick={onNavigate}
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
  );
}

const EYEBROW = "font-mono text-[0.6875rem] uppercase tracking-[0.1em] text-ink-3";

export default function StudioShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { userRole } = useAuth();
  const role = studioRoleLabel(userRole);
  const [width, setWidth] = useState<number>(SIDEBAR.initial);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const dragging = useRef(false);
  const scroller = useRef<HTMLDivElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const drawer = useRef<HTMLDivElement>(null);

  // Restore the remembered width after mount (localStorage is not available during SSR).
  useEffect(() => {
    const w = readWidth();
    if (w !== SIDEBAR.initial) requestAnimationFrame(() => setWidth(w));
  }, []);

  // The content scrolls in its own box, so the app-wide reset to the top on navigation does not reach it.
  useEffect(() => {
    scroller.current?.scrollTo(0, 0);
  }, [pathname]);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    menuButton.current?.focus();
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;
    drawer.current?.querySelector<HTMLElement>('[role="dialog"] button')?.focus();
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") closeDrawer();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen, closeDrawer]);

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
    <div
      style={{ "--studio-sidebar": `${width}px` } as CSSProperties}
      className="flex h-dvh flex-col pb-[calc(var(--mobile-nav-height)+env(safe-area-inset-bottom))] pt-16 md:pb-0"
    >
      <Navbar />

      <aside
        aria-label="เมนูสตูดิโอ"
        className="fixed bottom-[calc(var(--mobile-nav-height)+env(safe-area-inset-bottom))] left-0 top-16 z-30 hidden w-[var(--studio-sidebar)] flex-col border-r border-line bg-bg min-[672px]:flex md:bottom-0"
      >
        <div className="px-5 pb-3 pt-6">
          <p className={EYEBROW}>Studio</p>
        </div>

        <StudioNav pathname={pathname} />

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

      <div className="flex min-h-0 flex-1 flex-col min-[672px]:pl-[var(--studio-sidebar)]">
        <header className="flex items-center gap-3 border-b border-line px-4 py-3 sm:px-6">
          <button
            ref={menuButton}
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="เปิดเมนูสตูดิโอ"
            aria-expanded={drawerOpen}
            aria-controls="studio-drawer"
            className="-ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-fill hover:text-ink min-[672px]:hidden"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-5 w-5" aria-hidden>
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <h1 className="min-w-0 truncate text-lg font-semibold text-ink">{studioPageTitle(pathname)}</h1>
          {role ? <Badge tone="accent">{role}</Badge> : null}
        </header>

        <div ref={scroller} data-lenis-prevent className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {children}
        </div>
      </div>

      {/* Drawer under 672 px: always in the DOM so it can slide out (visibility waits for the slide);
          `inert` keeps it out of reach while closed. */}
      <div id="studio-drawer" ref={drawer} inert={!drawerOpen} className={`fixed inset-0 z-[60] transition-[visibility] duration-[var(--t2)] min-[672px]:hidden ${drawerOpen ? "visible" : "invisible"}`}>
        <button
          type="button"
          tabIndex={-1}
          aria-label="ปิดเมนู"
          onClick={closeDrawer}
          className={`absolute inset-0 bg-scrim/80 transition-opacity duration-[var(--t2)] ease-[var(--ease)] ${drawerOpen ? "opacity-100" : "opacity-0"}`}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="เมนูสตูดิโอ"
          className={`absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-line bg-bg pt-[env(safe-area-inset-top)] transition-transform duration-[var(--t2)] ease-[var(--ease)] ${
            drawerOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between px-5 pb-3 pt-5">
            <p className={EYEBROW}>Studio</p>
            <button
              type="button"
              onClick={closeDrawer}
              aria-label="ปิดเมนู"
              className="flex h-9 w-9 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-fill hover:text-ink"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-5 w-5" aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          <StudioNav pathname={pathname} onNavigate={() => setDrawerOpen(false)} />
          <div className="mt-auto border-t border-line px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <Link href="/studio/upload" onClick={() => setDrawerOpen(false)} className="text-sm text-ink-2 transition-colors hover:text-ink">
              อัปโหลดงานใหม่ →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
