"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { Session, User, UserIdentity } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import { LoginScreen } from "@/components/login-screen";
import { GithubAutoLink } from "@/components/github-auto-link";
import { DebugConsole } from "@/components/debug-console";
import { pushLog } from "@/lib/debug-log";

// Standalone auth for the Dev console (PRD #279, ADR 016), mirroring the
// Frontend's providers — Email/password + Google + Facebook — plus GitHub. OAuth
// uses a full-page redirect flow (→ /auth/callback → back to /); email/password
// is direct. The dashboard's callback URL must be in the Supabase Redirect URLs
// allowlist, else Supabase falls back to the Site URL.

export type OAuthProvider = "google" | "facebook" | "github";

interface DevAuth {
  token: string | null;
  user: User | null;
  configured: boolean;
  signInOAuth: (p: OAuthProvider) => Promise<void>;
  signInEmail: (email: string, password: string) => Promise<void>;
  signUpEmail: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  linkOAuth: (p: OAuthProvider) => Promise<void>;
  unlinkProvider: (identity: UserIdentity) => Promise<void>;
  addPassword: (password: string) => Promise<void>;
  getIdentities: () => Promise<UserIdentity[]>;
  signOut: () => void;
}

const noop = async () => {};
const Ctx = createContext<DevAuth>({
  token: null, user: null, configured: false,
  signInOAuth: noop, signInEmail: noop, signUpEmail: noop, resetPassword: noop,
  linkOAuth: noop, unlinkProvider: noop, addPassword: noop,
  getIdentities: async () => [], signOut: () => {},
});
export const useDevAuth = () => useContext(Ctx);

export function AuthGate({ children }: { children: ReactNode }) {
  const supabase = getSupabase();
  const configured = !!supabase;
  const pathname = usePathname();
  // The OAuth callback route must render its own token-exchange + redirect logic,
  // never the login gate — otherwise a signed-out callback shows the login screen
  // and the exchange never runs (the page hangs).
  const isCallback = pathname === "/auth/callback";
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!configured);

  useEffect(() => {
    if (!supabase) return;
    let settled = false;
    const finish = (s: Session | null) => { settled = true; setSession(s); setReady(true); };
    supabase.auth.getSession().then(({ data }) => finish(data.session)).catch(() => finish(null));
    const safety = setTimeout(() => { if (!settled) setReady(true); }, 2500);
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      pushLog("info", "auth", `${event} · ${s?.user?.email ?? "no session"} · providers=[${(s?.user?.app_metadata?.providers ?? []).join(",")}]`);
      finish(s);
    });
    return () => { clearTimeout(safety); sub.subscription.unsubscribe(); };
  }, [supabase]);

  // Redirect back to the dedicated callback. Pair with a `https://dashboard…/**`
  // wildcard in Supabase's Redirect URLs — the canonical combo that reliably
  // matches the path (a bare-origin entry is exact-match only and brittle).
  const callbackUrl = () => `${window.location.origin}/auth/callback`;

  const value: DevAuth = {
    token: session?.access_token ?? null,
    user: session?.user ?? null,
    configured,
    signInOAuth: async (provider) => {
      // Full-page redirect to the provider, back to /auth/callback → /.
      const { error } = await supabase!.auth.signInWithOAuth({ provider, options: { redirectTo: callbackUrl() } });
      if (error) throw new Error(error.message);
    },
    signInEmail: async (email, password) => {
      const { error } = await supabase!.auth.signInWithPassword({ email, password });
      if (error) throw new Error("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
    },
    signUpEmail: async (email, password) => {
      const { error } = await supabase!.auth.signUp({ email, password, options: { emailRedirectTo: callbackUrl() } });
      if (error) throw new Error(error.message);
    },
    resetPassword: async (email) => {
      const { error } = await supabase!.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/callback` });
      if (error) throw new Error(error.message);
    },
    linkOAuth: async (provider) => {
      const { error } = await supabase!.auth.linkIdentity({ provider, options: { redirectTo: callbackUrl() } });
      if (error) throw new Error(error.message);
    },
    unlinkProvider: async (identity) => {
      const { error } = await supabase!.auth.unlinkIdentity(identity);
      if (error) throw new Error(error.message);
    },
    addPassword: async (password) => {
      const { error } = await supabase!.auth.updateUser({ password });
      if (error) throw new Error(error.message);
    },
    getIdentities: async () => {
      const { data } = await supabase!.auth.getUserIdentities();
      return data?.identities ?? [];
    },
    signOut: () => void supabase?.auth.signOut(),
  };

  return (
    <Ctx.Provider value={value}>
      {!configured || isCallback ? children : !ready ? <Splash /> : !session ? <LoginScreen /> : <GithubAutoLink>{children}</GithubAutoLink>}
      {configured && <DebugConsole />}
    </Ctx.Provider>
  );
}

function Splash() {
  return (
    <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--bg)" }}>
      <span className="h-5 w-5 animate-spin rounded-full" style={{ border: "2px solid var(--hairline)", borderTopColor: "var(--mit)" }} />
    </div>
  );
}
