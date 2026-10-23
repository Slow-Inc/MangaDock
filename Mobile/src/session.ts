import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { createAccountApi } from "./backend.ts";

export type Account = {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: number;
};
export type SessionState =
  | { status: "signedOut"; account: null }
  | { status: "signedIn"; account: Account }
  | { status: "mfaRequired"; account: null; factorId: string };

export function createMobileSession(options: {
  supabase: SupabaseClient;
  apiOrigin: string;
  deviceId: string;
  fetch: typeof globalThis.fetch;
  beforeSignOut?: () => Promise<void>;
  openAuthSession?: (
    url: string,
    redirectTo: string,
  ) => Promise<{ type: string; url?: string }>;
}) {
  let state: SessionState = { status: "signedOut", account: null };
  let generation = 0;
  const listeners = new Set<() => void>();
  function publish(next: SessionState) {
    if (state.status === "signedOut" && next.status === "signedOut") return;
    state = next;
    listeners.forEach((listener) => listener());
  }
  const api = createAccountApi(options);
  const { data: authListener } = options.supabase.auth.onAuthStateChange(
    (event) => {
      if (event === "SIGNED_OUT") {
        generation++;
        publish({ status: "signedOut", account: null });
      }
    },
  );
  async function accept(session: Session, current: number) {
    const { data, error } =
      await options.supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error) throw error;
    if (current !== generation) return;
    if (data.nextLevel === "aal2" && data.currentLevel !== "aal2") {
      const factor = session.user.factors?.find(
        (item) => item.factor_type === "totp" && item.status === "verified",
      );
      if (!factor) throw new Error("ไม่พบวิธียืนยันบัญชีที่รองรับ");
      publish({ status: "mfaRequired", account: null, factorId: factor.id });
      return;
    }
    const account = await api.loadAccount(session.access_token);
    if (account.uid !== session.user.id)
      throw new Error("ข้อมูลบัญชีไม่ตรงกับผู้เข้าสู่ระบบ");
    if (current === generation) publish({ status: "signedIn", account });
  }
  return {
    snapshot: () => state,
    async accessToken() {
      if (state.status !== "signedIn")
        throw new Error("กรุณาเข้าสู่ระบบและยืนยันบัญชี");
      const { data, error } = await options.supabase.auth.getSession();
      if (error) throw error;
      if (
        state.status !== "signedIn" ||
        !data.session ||
        data.session.user.id !== state.account.uid
      )
        throw new Error("กรุณาเข้าสู่ระบบอีกครั้ง");
      return data.session.access_token;
    },
    dispose() {
      generation++;
      state = { status: "signedOut", account: null };
      listeners.clear();
      authListener.subscription.unsubscribe();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async signInOAuth(provider: "google" | "facebook") {
      if (!options.openAuthSession)
        throw new Error("ไม่สามารถเปิดหน้าเข้าสู่ระบบได้");
      const current = ++generation;
      publish({ status: "signedOut", account: null });
      const redirectTo = "mangadock://auth/callback";
      const { data, error } = await options.supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error) throw error;
      if (!data.url) throw new Error("ไม่สามารถเปิดหน้าเข้าสู่ระบบได้");
      const result = await options.openAuthSession(data.url, redirectTo);
      if (result.type !== "success" || !result.url || current !== generation)
        return;
      const callback = new URL(result.url);
      const expected = new URL(redirectTo);
      if (
        callback.protocol !== expected.protocol ||
        callback.host !== expected.host ||
        callback.pathname !== expected.pathname ||
        callback.username ||
        callback.password
      )
        throw new Error("OAuth callback ไม่ตรงกับคำขอ");
      const providerError =
        callback.searchParams.get("error_description") ??
        callback.searchParams.get("error");
      if (providerError) throw new Error(providerError);
      const code = callback.searchParams.get("code");
      if (!code) throw new Error("ไม่ได้รับรหัสยืนยันการเข้าสู่ระบบ");
      const { data: exchanged, error: exchangeError } =
        await options.supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) throw exchangeError;
      if (!exchanged.session) throw new Error("เข้าสู่ระบบไม่สำเร็จ");
      await accept(exchanged.session, current);
    },
    async verifyTotp(code: string) {
      if (state.status !== "mfaRequired")
        throw new Error("ไม่มีคำขอยืนยันบัญชี");
      const current = generation;
      const { error } = await options.supabase.auth.mfa.challengeAndVerify({
        factorId: state.factorId,
        code,
      });
      if (error) throw error;
      const { data, error: sessionError } =
        await options.supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!data.session) throw new Error("กรุณาเข้าสู่ระบบอีกครั้ง");
      await accept(data.session, current);
    },
    async signOut() {
      await options.beforeSignOut?.();
      generation++;
      publish({ status: "signedOut", account: null });
      const { error } = await options.supabase.auth.signOut({ scope: "local" });
      if (error) throw error;
    },
    revokeAcceptance() {
      generation++;
      publish({ status: "signedOut", account: null });
    },
    async restore() {
      const current = ++generation;
      publish({ status: "signedOut", account: null });
      const { data, error } = await options.supabase.auth.getSession();
      if (error) throw error;
      if (!data.session) return;
      await accept(data.session, current);
    },
    async refreshAccount() {
      const current = ++generation;
      const { data, error } = await options.supabase.auth.getSession();
      if (error) throw error;
      if (current !== generation) return;
      if (
        !data.session ||
        state.status !== "signedIn" ||
        data.session.user.id !== state.account.uid
      )
        throw new Error("กรุณาเข้าสู่ระบบอีกครั้ง");
      await accept(data.session, current);
    },
    async signIn(email: string, password: string) {
      const current = ++generation;
      publish({ status: "signedOut", account: null });
      const { data, error } = await options.supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        if (current === generation)
          await options.supabase.auth.signOut({ scope: "local" });
        throw error;
      }
      if (!data.session) throw new Error("เข้าสู่ระบบไม่สำเร็จ");
      await accept(data.session, current);
    },
  };
}
