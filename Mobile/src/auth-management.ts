import type { SupabaseClient } from "@supabase/supabase-js";
import type { createMobileSession } from "./session.ts";
import { createApi } from "./api.ts";
export function createAuthManagement(options: {
  apiOrigin: string;
  deviceId: string;
  fetch: typeof globalThis.fetch;
  session: ReturnType<typeof createMobileSession>;
  supabase: SupabaseClient;
  openAuthSession?: (
    url: string,
    redirectTo: string,
  ) => Promise<{ type: string; url?: string }>;
}) {
  let state = {
    verificationEmail: null as string | null,
    recoveryEmail: null as string | null,
    recoveryReady: false,
    error: null as string | null,
  };
  const listeners = new Set<() => void>();
  const api = createApi(options);
  function publish(next: typeof state) {
    state = next;
    listeners.forEach((listener) => listener());
  }
  let recoveryUid: string | null = null;
  let generation = 0,
    disposed = false;
  let recoveryEventCount = 0,
    recoveryEventToken: string | null = null;
  const { data: authSubscription } = options.supabase.auth.onAuthStateChange(
    (event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) {
        recoveryEventCount++;
        recoveryEventToken = session.access_token;
      }
      if (
        event === "SIGNED_OUT" ||
        (event === "SIGNED_IN" &&
          recoveryUid &&
          session?.user.id !== recoveryUid)
      ) {
        generation++;
        recoveryUid = null;
        publish({
          verificationEmail: null,
          recoveryEmail: null,
          recoveryReady: false,
          error: null,
        });
      }
    },
  );
  const store = {
    snapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async signUp(email: string, password: string, displayName: string) {
      const current = ++generation;
      if (disposed) return false;
      const normalized = email.trim().toLowerCase(),
        name = displayName.trim();
      if (!name || password.length < 6)
        throw new Error("กรุณาระบุชื่อและรหัสผ่านอย่างน้อย 6 ตัวอักษร");
      const validation = await api.json<{
        ok: boolean;
        normalizedEmail?: string;
        message?: string;
      }>("users/validate-email", {
        method: "POST",
        body: JSON.stringify({ email: normalized }),
      });
      if (current !== generation || disposed) return false;
      if (!validation.ok)
        throw new Error(
          validation.message ?? "ไม่สามารถใช้อีเมลนี้สมัครสมาชิกได้",
        );
      const acceptedEmail = validation.normalizedEmail ?? normalized;
      const { data, error } = await options.supabase.auth.signUp({
        email: acceptedEmail,
        password,
        options: {
          emailRedirectTo: "mangadock://auth/signup",
          data: { display_name: name, full_name: name },
        },
      });
      if (current !== generation || disposed) return false;
      if (error) throw error;
      if (data.session) await options.session.restore();
      else publish({ ...state, verificationEmail: acceptedEmail });
      return true;
    },
    async requestRecovery(email: string) {
      const current = ++generation;
      if (disposed) return;
      const normalized = email.trim().toLowerCase();
      const { error } = await options.supabase.auth.resetPasswordForEmail(
        normalized,
        { redirectTo: "mangadock://auth/recovery" },
      );
      if (current !== generation || disposed) return;
      if (error) throw error;
      publish({ ...state, recoveryEmail: normalized, recoveryReady: false });
    },
    async resendVerification() {
      const current = generation,
        email = state.verificationEmail;
      if (!email || disposed)
        throw new Error("กรุณาสมัครสมาชิกก่อนขออีเมลยืนยันใหม่");
      const { error } = await options.supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: "mangadock://auth/signup" },
      });
      if (current !== generation || disposed) return false;
      if (error) throw error;
      return true;
    },
    async resetPassword(password: string) {
      const currentGeneration = generation;
      if (!state.recoveryReady || !recoveryUid)
        throw new Error("กรุณาเปิดลิงก์กู้รหัสผ่านที่ส่งไปยังอีเมลก่อน");
      if (password.length < 6)
        throw new Error("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
      const { data: current, error: sessionError } =
        await options.supabase.auth.getSession();
      if (currentGeneration !== generation || disposed) return false;
      if (sessionError) throw sessionError;
      if (current.session?.user.id !== recoveryUid)
        throw new Error("ลิงก์กู้รหัสผ่านหมดอายุ กรุณาขอใหม่");
      const { data, error } = await options.supabase.auth.updateUser({
        password,
      });
      if (currentGeneration !== generation || disposed) return false;
      if (error) throw error;
      if (data.user?.id !== recoveryUid)
        throw new Error("ข้อมูลบัญชีไม่ตรงกับคำขอกู้รหัสผ่าน");
      await options.session.restore();
      if (currentGeneration !== generation || disposed) return false;
      recoveryUid = null;
      publish({ ...state, recoveryReady: false, recoveryEmail: null });
      return true;
    },
    async handleCallback(url: string) {
      if (disposed) return false;
      const callback = new URL(url);
      if (
        callback.protocol !== "mangadock:" ||
        callback.host !== "auth" ||
        !["/recovery", "/signup"].includes(callback.pathname) ||
        callback.username ||
        callback.password ||
        callback.port
      )
        return false;
      const current = ++generation;
      const code = callback.searchParams.get("code");
      if (!code || callback.searchParams.getAll("code").length !== 1)
        throw new Error("ลิงก์กู้รหัสผ่านไม่ถูกต้อง");
      const previousRecoveryCount = recoveryEventCount;
      const { data, error } =
        await options.supabase.auth.exchangeCodeForSession(code);
      if (current !== generation || disposed) return false;
      if (error) throw error;
      const recovery =
        !!data.session &&
        recoveryEventCount > previousRecoveryCount &&
        recoveryEventToken === data.session.access_token;
      if (callback.pathname === "/signup") {
        if (!data.session || recovery)
          throw new Error("ลิงก์ยืนยันอีเมลไม่ถูกต้อง");
        await options.session.restore();
        if (current !== generation || disposed) return false;
        publish({ ...state, verificationEmail: null });
        return true;
      }
      if (!recovery || !data.session)
        throw new Error("ลิงก์นี้ไม่ใช่คำขอกู้รหัสผ่าน");
      options.session.revokeAcceptance();
      recoveryUid = data.session.user.id;
      publish({
        ...state,
        recoveryReady: true,
        recoveryEmail: data.session.user.email ?? null,
      });
      return true;
    },
    dismissError() {
      publish({ ...state, error: null });
    },
    async cancelRecovery() {
      generation++;
      recoveryUid = null;
      publish({ ...state, recoveryReady: false, recoveryEmail: null });
      await options.session.signOut();
    },
    dispose() {
      generation++;
      disposed = true;
      recoveryUid = null;
      authSubscription.subscription.unsubscribe();
    },
  };
  let callbackRequest: { url: string; promise: Promise<boolean> } | null = null;
  let handledCallback: string | null = null;
  return {
    ...store,
    handleCallback(url: string): Promise<boolean> {
      if (handledCallback === url && !disposed) return Promise.resolve(true);
      if (callbackRequest?.url === url) return callbackRequest.promise;
      const promise = store
        .handleCallback(url)
        .then((handled) => {
          if (handled && !disposed) handledCallback = url;
          return handled;
        })
        .catch((error) => {
          if (!disposed)
            publish({
              ...state,
              error:
                error instanceof Error
                  ? error.message
                  : "เปิดลิงก์ยืนยันไม่สำเร็จ",
            });
          throw error;
        })
        .finally(() => {
          if (callbackRequest?.promise === promise) callbackRequest = null;
        });
      callbackRequest = { url, promise };
      return promise;
    },
  };
}
