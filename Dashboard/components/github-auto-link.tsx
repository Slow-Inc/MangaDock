"use client";

import { useEffect, useState } from "react";
import { Activity, Loader2, LogOut } from "lucide-react";
import { useLang } from "@/components/lang-provider";
import { useDevAuth } from "@/components/auth-gate";
import { GithubGlyph } from "@/components/provider-glyphs";
import { pushLog } from "@/lib/debug-log";

// Dev-console GitHub requirement, auto-linked. The console needs a GitHub
// identity (ADR 017), but the app's Frontend has no GitHub-link option (it's
// Dashboard-only). So when a signed-in dev has no GitHub identity yet, the
// dashboard automatically runs `linkIdentity({github})` — which links to the
// CURRENT user (no manual-linking conflict, unlike a fresh GitHub sign-in).
type State = "checking" | "linking" | "retry" | "ok";

const TRIED = "gh-link-tried";

export function GithubAutoLink({ children }: { children: React.ReactNode }) {
  const { getIdentities, linkOAuth } = useDevAuth();
  const [state, setState] = useState<State>("checking");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Surface a link error the redirect carried back.
      const e = new URLSearchParams(window.location.search).get("auth_error");
      if (e) { pushLog("error", "github-link", e); setError(e); window.history.replaceState({}, "", window.location.pathname); }

      const ids = await getIdentities();
      if (cancelled) return;
      pushLog("info", "github-link", `identities: [${ids.map((i) => i.provider).join(", ")}]`);
      if (ids.some((i) => i.provider === "github")) {
        sessionStorage.removeItem(TRIED);
        pushLog("info", "github-link", "github linked ✓");
        setState("ok");
        return;
      }
      // Came back from a link attempt still without GitHub (cancelled / failed) →
      // stop auto-looping; let the dev retry or sign out.
      if (sessionStorage.getItem(TRIED) || e) { pushLog("warn", "github-link", "no github after attempt — showing retry"); setState("retry"); return; }
      sessionStorage.setItem(TRIED, "1");
      pushLog("info", "github-link", "auto-linking GitHub → redirecting to provider");
      setState("linking");
      try {
        await linkOAuth("github"); // full-page redirect to GitHub
      } catch (err) {
        if (!cancelled) { const m = err instanceof Error ? err.message : String(err); pushLog("error", "github-link", m); setError(m); setState("retry"); }
      }
    })();
    return () => { cancelled = true; };
  }, [getIdentities, linkOAuth]);

  if (state === "ok") return <>{children}</>;

  const retry = () => { sessionStorage.removeItem(TRIED); window.location.reload(); };
  return <LinkScreen state={state} error={error} onRetry={retry} />;
}

function LinkScreen({ state, error, onRetry }: { state: State; error: string | null; onRetry: () => void }) {
  const { lang } = useLang();
  const { signOut } = useDevAuth();
  const th = lang === "th";
  const linking = state === "linking";
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6" style={{ background: "var(--bg)" }}>
      <div className="w-full max-w-[340px] text-center">
        <span className="mx-auto mb-5 flex h-11 w-11 items-center justify-center rounded-[12px]" style={{ background: "var(--ink)", color: "var(--bg)" }}>
          <GithubGlyph size={22} />
        </span>
        <h1 className="text-[17px] font-semibold tracking-tight" style={{ color: "var(--ink)" }}>
          {linking ? (th ? "กำลังเชื่อม GitHub…" : "Connecting GitHub…") : (th ? "เชื่อม GitHub เพื่อเข้า Dev console" : "Connect GitHub to enter the Dev console")}
        </h1>
        <p className="mt-2 text-[12.5px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
          {th ? "คอนโซลนี้ต้องใช้ GitHub identity ระบบจะเชื่อมให้อัตโนมัติเข้ากับบัญชีปัจจุบันของคุณ" : "This console requires a GitHub identity. It's linked automatically to your current account."}
        </p>

        {linking ? (
          <div className="mt-6 flex items-center justify-center gap-2 text-[13px]" style={{ color: "var(--ink-3)" }}>
            <Loader2 size={16} className="animate-spin" /> {th ? "กำลังพาไป GitHub…" : "Redirecting to GitHub…"}
          </div>
        ) : (
          <button onClick={onRetry}
            className="mt-6 flex w-full items-center justify-center gap-2.5 rounded-xl py-3 text-[13.5px] font-medium transition-opacity hover:opacity-90"
            style={{ background: "var(--ink)", color: "var(--bg)" }}>
            <GithubGlyph /> {th ? "เชื่อม GitHub" : "Connect GitHub"}
          </button>
        )}

        {error && <p className="mt-3 text-[12px]" style={{ color: "var(--error)" }}>{error}</p>}

        <button onClick={signOut} className="mt-4 inline-flex items-center gap-1.5 text-[11.5px] hover:underline" style={{ color: "var(--ink-3)" }}>
          <LogOut size={12} /> {th ? "ออกจากระบบ" : "Sign out"}
        </button>
      </div>
    </div>
  );
}
