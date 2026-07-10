"use client";

// Real Supabase auth gate for dashboardv2 (PRD #279, ADR 016).
// Workflow mirrors Frontend/app/contexts/AuthContext.tsx:
//   - OAuth via centred popup + postMessage (skipBrowserRedirect: true)
//   - Email/password via signInWithPassword
//   - Role resolved from profiles table (not user_metadata)
//   - Bypass when NEXT_PUBLIC_SUPABASE_URL is absent → mock-data mode
//
// Exports:
//   useDevAuth() — hook consumed by dashboard.tsx (same shape as the V1 stub)
//   AuthGate     — provider component; wrap <Dashboard> in page.tsx

import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";

// ── Bypass detection ─────────────────────────────────────────────────────
const SUPABASE_CONFIGURED =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// ── Auth context ─────────────────────────────────────────────────────────
const AuthCtx = createContext<{ token: string | null }>({ token: null });

/** Hook consumed by dashboard.tsx — unchanged interface from the V1 stub. */
export const useDevAuth = (): { token: string | null } => useContext(AuthCtx);

// ── AuthGate ─────────────────────────────────────────────────────────────
export function AuthGate({ children }: { children: React.ReactNode }) {
  if (!SUPABASE_CONFIGURED) {
    return <AuthCtx.Provider value={{ token: null }}>{children}</AuthCtx.Provider>;
  }
  return <AuthGateInner>{children}</AuthGateInner>;
}

// ── Role lookup ──────────────────────────────────────────────────────────
async function fetchProfileRole(uid: string): Promise<number | null> {
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("uid", uid)
    .maybeSingle<{ role: number | null }>();
  return data?.role ?? null;
}

// ── Popup OAuth helper (mirrors Frontend openOAuthPopup) ─────────────────
function openOAuthPopup(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const w = 500, h = 650;
    const left = Math.max(0, (window.screen.width  - w) / 2);
    const top  = Math.max(0, (window.screen.height - h) / 2);
    const popup = window.open(
      url,
      "oauth-popup",
      `width=${w},height=${h},left=${left},top=${top},scrollbars=yes,resizable=yes`,
    );

    if (!popup || popup.closed) {
      reject(Object.assign(new Error("Popup blocked"), { code: "auth/popup-blocked" }));
      return;
    }

    const onMessage = async (event: MessageEvent) => {
      if (event.data?.type !== "supabase:oauth:callback") return;
      window.removeEventListener("message", onMessage);
      clearInterval(closedPoll);
      try { popup.close(); } catch { /* ignore */ }

      const { error_code, error, access_token, refresh_token } = event.data as {
        error_code?: string; error?: string;
        access_token?: string; refresh_token?: string;
      };

      if (error_code || error) {
        reject(new Error(error || "Authentication error"));
        return;
      }

      if (access_token && refresh_token) {
        const { data: { session: existing } } = await supabase.auth.getSession();
        if (!existing) {
          await supabase.auth.setSession({ access_token, refresh_token });
        }
      }
      resolve();
    };

    window.addEventListener("message", onMessage);

    const closedPoll = setInterval(() => {
      try {
        if (popup.closed) {
          clearInterval(closedPoll);
          window.removeEventListener("message", onMessage);
          reject(Object.assign(new Error(""), { code: "auth/popup-closed-by-user" }));
        }
      } catch {
        clearInterval(closedPoll);
        window.removeEventListener("message", onMessage);
        reject(Object.assign(new Error(""), { code: "auth/popup-closed-by-user" }));
      }
    }, 500);
  });
}

// ── AuthGateInner ────────────────────────────────────────────────────────
type AuthState = "loading" | "unauthenticated" | "forbidden" | "ok";

function AuthGateInner({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [state, setState] = useState<AuthState>("loading");

  const resolveSession = async (s: Session | null) => {
    setSession(s);
    if (!s) { setState("unauthenticated"); return; }
    const role = await fetchProfileRole(s.user.id);
    setState(role != null && role >= 8 ? "ok" : "forbidden");
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => resolveSession(data.session));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => {
      resolveSession(s);
    });
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state === "loading") return <Screen><Spinner /></Screen>;
  if (state === "unauthenticated") return <LoginScreen />;
  if (state === "forbidden") {
    return (
      <Screen>
        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 32 }}>🔒</span>
          <p style={{ color: "var(--ink)", fontWeight: 600, margin: 0 }}>Access denied</p>
          <p style={{ color: "var(--ink-3)", fontSize: 13, margin: 0 }}>
            {session?.user?.email} — not an admin
          </p>
          <button onClick={() => supabase.auth.signOut()} style={btnStyle("var(--surface-2)")}>
            Sign out
          </button>
        </div>
      </Screen>
    );
  }

  return (
    <AuthCtx.Provider value={{ token: session!.access_token }}>
      {children}
    </AuthCtx.Provider>
  );
}

// ── Login screen ─────────────────────────────────────────────────────────
type SocialProvider = "google" | "github" | "facebook";

function LoginScreen() {
  const [mode, setMode]   = useState<"oauth" | "email">("oauth");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy]   = useState<SocialProvider | "email" | null>(null);

  const handleOAuth = async (provider: SocialProvider) => {
    setError(null);
    setBusy(provider);
    try {
      const redirectTo = `${window.location.origin}/auth/callback`;
      const { data, error: err } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (err || !data.url) throw err ?? new Error("Cannot open popup");
      await openOAuthPopup(data.url);
      // onAuthStateChange fires → resolveSession() → role check
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code ?? "";
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        // silent — user closed the popup
      } else if (code === "auth/popup-blocked") {
        setError("Browser blocked the popup. Please allow popups and try again.");
      } else {
        setError(e instanceof Error ? e.message : "Authentication error");
      }
    } finally {
      setBusy(null);
    }
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy("email");
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(null);
    if (err) setError("Incorrect email or password");
  };

  const isBusy = busy !== null;

  return (
    <Screen>
      <div style={{ width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Header */}
        <div style={{ textAlign: "center" }}>
          <p style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700, color: "var(--ink)" }}>
            MIT Staff Console
          </p>
          <p style={{ margin: 0, fontSize: 13, color: "var(--ink-3)" }}>Admin access only</p>
        </div>

        {/* Card */}
        <div style={{
          background: "var(--surface)",
          border: "1px solid var(--hairline-strong)",
          borderRadius: 14,
          padding: "24px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}>
          {error && (
            <p style={{
              margin: 0, fontSize: 12, color: "var(--error)",
              background: "rgba(244,101,78,0.1)", borderRadius: 8,
              padding: "8px 12px", textAlign: "center",
            }}>
              {error}
            </p>
          )}

          {/* OAuth buttons */}
          <OAuthButton provider="google"   label="Continue with Google"   icon={<GoogleIcon />}   busy={busy} disabled={isBusy} onClick={handleOAuth} />
          <OAuthButton provider="github"   label="Continue with GitHub"   icon={<GitHubIcon />}   busy={busy} disabled={isBusy} onClick={handleOAuth} />
          <OAuthButton provider="facebook" label="Continue with Facebook" icon={<FacebookIcon />} busy={busy} disabled={isBusy} onClick={handleOAuth} color="#1877F2" />

          <Divider />

          {/* Email form toggle */}
          {mode === "oauth" ? (
            <button onClick={() => setMode("email")} disabled={isBusy} style={btnStyle("var(--surface-2)")}>
              <EmailIcon />
              Continue with Email
            </button>
          ) : (
            <form onSubmit={handleEmail} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="admin@example.com"
                style={inputStyle}
              />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="••••••••"
                style={inputStyle}
              />
              <button type="submit" disabled={isBusy} style={btnStyle("var(--coral)")}>
                {busy === "email" ? "Signing in…" : "Sign in"}
              </button>
              <button
                type="button"
                onClick={() => { setMode("oauth"); setError(null); }}
                style={{ background: "none", border: "none", color: "var(--ink-3)", fontSize: 12, cursor: "pointer", padding: 0 }}
              >
                ← Back
              </button>
            </form>
          )}
        </div>
      </div>
    </Screen>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

function OAuthButton({
  provider, label, icon, busy, disabled, onClick, color = "var(--surface-2)",
}: {
  provider: SocialProvider;
  label: string;
  icon: React.ReactNode;
  busy: SocialProvider | "email" | null;
  disabled: boolean;
  onClick: (p: SocialProvider) => void;
  color?: string;
}) {
  const isLoading = busy === provider;
  return (
    <button onClick={() => onClick(provider)} disabled={disabled} style={btnStyle(color)}>
      {isLoading ? <Spinner size={16} /> : icon}
      {isLoading ? "Opening popup…" : label}
    </button>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: "100dvh",
      background: "var(--bg)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
    }}>
      {children}
    </div>
  );
}

function Spinner({ size = 28 }: { size?: number }) {
  return (
    <div style={{
      width: size, height: size, flexShrink: 0,
      border: "2px solid var(--hairline-strong)",
      borderTopColor: "var(--ink-2)",
      borderRadius: "50%",
      animation: "spin 0.8s linear infinite",
    }} />
  );
}

function Divider() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ flex: 1, height: 1, background: "var(--hairline)" }} />
      <span style={{ fontSize: 11, color: "var(--ink-3)", letterSpacing: "0.08em" }}>OR</span>
      <div style={{ flex: 1, height: 1, background: "var(--hairline)" }} />
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box",
  background: "var(--panel-2)",
  border: "1px solid var(--hairline-strong)",
  borderRadius: 8, padding: "10px 12px",
  fontSize: 13, color: "var(--ink)", outline: "none",
};

function btnStyle(bg: string): React.CSSProperties {
  return {
    width: "100%", display: "flex", alignItems: "center",
    justifyContent: "center", gap: 8,
    background: bg, border: "1px solid var(--hairline-strong)",
    borderRadius: 8, padding: "10px 14px",
    fontSize: 13, fontWeight: 500,
    color: "var(--ink)", cursor: "pointer", transition: "opacity 0.15s",
  };
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff" style={{ flexShrink: 0 }}>
      <path d="M24 12.073C24 5.404 18.627 0 12 0S0 5.404 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.514c-1.491 0-1.956.93-1.956 1.886v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
    </svg>
  );
}

function EmailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <rect x="2" y="4" width="20" height="16" rx="2"/>
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
    </svg>
  );
}
