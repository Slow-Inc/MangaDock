"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Activity, LogOut, Link2 } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { LangToggle } from "@/components/lang-toggle";
import { ChatAssistant } from "@/components/chat-assistant";
import { AccountPanel } from "@/components/account-panel";
import { useLang } from "@/components/lang-provider";
import { useDevAuth } from "@/components/auth-gate";
import { SERVICES, SERVICE_STATUS_COLOR } from "@/lib/services";

function AccountRow() {
  const { user, configured, signOut } = useDevAuth();
  const [panel, setPanel] = useState(false);
  if (!configured || !user) return null;
  const email = user.email ?? "signed in";
  return (
    <>
      <div className="flex items-center justify-between gap-1 rounded-lg px-2 py-1.5" style={{ background: "color-mix(in oklch, var(--ink) 5%, transparent)" }}>
        <span className="min-w-0 flex-1 truncate text-[11px]" style={{ color: "var(--ink-2)" }} title={email}>
          {email}
        </span>
        <button onClick={() => setPanel(true)} className="shrink-0 rounded p-1 transition-colors hover:opacity-80" title="Account connections" aria-label="Account connections">
          <Link2 size={13} style={{ color: "var(--ink-3)" }} />
        </button>
        <button onClick={signOut} className="shrink-0 rounded p-1 transition-colors hover:opacity-80" title="Sign out" aria-label="Sign out">
          <LogOut size={13} style={{ color: "var(--ink-3)" }} />
        </button>
      </div>
      <AccountPanel open={panel} onClose={() => setPanel(false)} />
    </>
  );
}

const NAV = [
  { href: "/", label: "Overview", Icon: LayoutGrid },
  ...SERVICES.map((s) => ({ href: `/service/${s.id}`, label: s.name, Icon: s.Icon, status: s.status })),
];

const systemDot = SERVICES.some((s) => s.status === "down")
  ? "var(--error)"
  : SERVICES.some((s) => s.status === "stale")
    ? "var(--processing)"
    : "var(--success)";

export function Shell({ children, right }: { children: ReactNode; right?: ReactNode }) {
  const pathname = usePathname();
  const { t } = useLang();

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg)" }}>
      {/* ── left rail ── */}
      <aside
        className="theme-tx sticky top-0 hidden h-screen w-[210px] shrink-0 flex-col justify-between px-3 py-4 md:flex"
        style={{ borderRight: "1px solid var(--hairline)", background: "var(--surface)" }}
      >
        <div>
          <Link href="/" className="mb-5 flex items-center gap-2.5 px-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-[8px]" style={{ background: "var(--mit)" }}>
              <Activity size={15} strokeWidth={2.25} style={{ color: "#06140a" }} />
            </span>
            <div className="leading-none">
              <div className="text-[13.5px] font-semibold tracking-tight" style={{ color: "var(--ink)" }}>
                MIT Dashboard
              </div>
              <div className="mt-0.5 text-[10.5px]" style={{ color: "var(--ink-3)" }}>
                {t("brand.sub")}
              </div>
            </div>
          </Link>
          <nav className="flex flex-col gap-0.5">
            {NAV.map((n) => {
              const active = n.href === "/" ? pathname === "/" : pathname === n.href;
              const dot = "status" in n ? SERVICE_STATUS_COLOR[n.status] : systemDot;
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors"
                  style={{ background: active ? "color-mix(in oklch, var(--ink) 7%, transparent)" : "transparent" }}
                >
                  <n.Icon size={15} strokeWidth={1.85} style={{ color: active ? "var(--ink)" : "var(--ink-3)" }} />
                  <span className="flex-1 text-[13px] font-medium" style={{ color: active ? "var(--ink)" : "var(--ink-2)" }}>
                    {n.href === "/" ? t("nav.overview") : n.label}
                  </span>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: dot }} />
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex flex-col gap-2 px-1">
          <AccountRow />
          <span className="text-[10.5px]" style={{ color: "var(--ink-3)" }}>
            {t("rail.standalone")}
          </span>
          <div className="flex items-center justify-between">
            <LangToggle />
            <ThemeToggle />
          </div>
        </div>
      </aside>

      {/* ── center ── */}
      <main className="min-w-0 flex-1 px-6 py-5">{children}</main>

      {/* ── right rail ── */}
      {right && (
        <aside
          className="theme-tx sticky top-0 hidden h-screen w-[300px] shrink-0 flex-col px-4 py-5 lg:flex"
          style={{ borderLeft: "1px solid var(--hairline)", background: "var(--surface)" }}
        >
          {right}
        </aside>
      )}

      <ChatAssistant />
    </div>
  );
}
