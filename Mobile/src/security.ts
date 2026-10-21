import type { Factor, SupabaseClient, User } from "@supabase/supabase-js";
import type { createMobileSession } from "./session.ts";
import { createApi } from "./api.ts";
export type KnownDevice = {
  id: string;
  hwid: string;
  user_agent: string | null;
  first_seen: string;
  last_seen: string;
};
export function createSecurity(options: {
  apiOrigin: string;
  deviceId: string;
  fetch: typeof globalThis.fetch;
  session: ReturnType<typeof createMobileSession>;
  supabase: SupabaseClient;
  now?: () => number;
  openAuthSession?: (
    url: string,
    redirectTo: string,
  ) => Promise<{ type: string; url?: string }>;
}) {
  const api = createApi(options);
  let state = {
    user: null as User | null,
    factors: [] as Factor[],
    devices: [] as KnownDevice[],
    loading: false,
    error: null as string | null,
    authenticatedUntil: 0,
    enrollment: null as { id: string; secret: string; uri: string } | null,
  };
  const listeners = new Set<() => void>();
  function publish(next: typeof state) {
    state = next;
    listeners.forEach((listener) => listener());
  }
  let generation = 0,
    owner = options.session.snapshot().account?.uid ?? null;
  let unverifiedEnrollmentId: string | null = null;
  let enrollmentStart: Promise<boolean> | null = null;
  async function cleanupEnrollment(id: string, uid: string | null) {
    const { data } = await options.supabase.auth.getSession();
    if (uid && data.session?.user.id === uid) {
      const { error } = await options.supabase.auth.mfa.unenroll({
        factorId: id,
      });
      if (error) throw error;
    }
  }
  function identityChanged() {
    const next = options.session.snapshot().account?.uid ?? null;
    if (owner !== next) {
      unverifiedEnrollmentId = null;
      owner = next;
      generation++;
      publish({
        user: null,
        factors: [],
        devices: [],
        loading: false,
        error: null,
        authenticatedUntil: 0,
        enrollment: null,
      });
    }
  }
  let unsubscribe: (() => void) | undefined =
    options.session.subscribe(identityChanged);
  const now = options.now ?? Date.now;
  async function confirmAssurance(current: number, required: boolean) {
    const proof =
      await options.supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (current !== generation) return false;
    if (proof.error) {
      if (required) await options.session.restore();
      throw proof.error;
    }
    if (
      (required || proof.data.nextLevel === "aal2") &&
      proof.data.currentLevel !== "aal2"
    ) {
      await options.session.restore();
      throw new Error("ยังยืนยัน Authenticator ไม่สำเร็จ");
    }
    return current === generation;
  }
  async function reauthenticate(password: string, code?: string) {
    const current = generation;
    await options.session.accessToken();
    if (current !== generation || !unsubscribe) return false;
    const { data: existing, error: userError } =
      await options.supabase.auth.getUser();
    if (current !== generation) return false;
    if (userError) throw userError;
    if (existing.user?.id !== owner || !existing.user.email)
      throw new Error("กรุณายืนยันบัญชีเดิม");
    const factor = existing.user.factors?.find(
      (item) => item.factor_type === "totp" && item.status === "verified",
    );
    if (factor && !/^\d{6}$/.test(code ?? ""))
      throw new Error("กรุณาระบุรหัส Authenticator 6 หลัก");
    const { data, error } = await options.supabase.auth.signInWithPassword({
      email: existing.user.email,
      password,
    });
    if (current !== generation) return false;
    if (error) throw error;
    if (data.user?.id !== owner) {
      options.session.revokeAcceptance();
      throw new Error("ข้อมูลบัญชีไม่ตรงกับผู้เข้าสู่ระบบ");
    }
    const assurance =
      await options.supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assurance.error) throw assurance.error;
    if (current !== generation) return false;
    if (
      assurance.data.nextLevel === "aal2" &&
      assurance.data.currentLevel !== "aal2"
    ) {
      const verified =
        data.user.factors?.find(
          (item) => item.factor_type === "totp" && item.status === "verified",
        ) ?? factor;
      if (!verified || !code) {
        await options.session.restore();
        throw new Error("กรุณายืนยันรหัส Authenticator อีกครั้ง");
      }
      const result = await options.supabase.auth.mfa.challengeAndVerify({
        factorId: verified.id,
        code,
      });
      if (current !== generation) return false;
      if (result.error) {
        await options.session.restore();
        throw result.error;
      }
    }
    if (
      !(await confirmAssurance(
        current,
        !!factor || assurance.data.nextLevel === "aal2",
      ))
    )
      return false;
    publish({ ...state, authenticatedUntil: now() + 5 * 60_000 });
    return true;
  }
  const store = {
    snapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async load() {
      const current = ++generation;
      publish({ ...state, loading: true, error: null });
      try {
        await options.session.accessToken();
        if (current !== generation) return;
        const [user, factors, devices] = await Promise.all([
          options.supabase.auth.getUser(),
          options.supabase.auth.mfa.listFactors(),
          options.supabase
            .from("user_known_devices")
            .select("id,hwid,user_agent,first_seen,last_seen")
            .eq("uid", owner)
            .order("last_seen", { ascending: false }),
        ]);
        if (current !== generation) return;
        if (user.error) throw user.error;
        if (factors.error) throw factors.error;
        if (devices.error) throw devices.error;
        if (user.data.user?.id !== owner)
          throw new Error("ข้อมูลบัญชีไม่ตรงกับผู้เข้าสู่ระบบ");
        publish({
          ...state,
          user: user.data.user,
          factors: factors.data.all,
          devices: devices.data ?? [],
          loading: false,
          error: null,
        });
      } catch (error) {
        if (current === generation)
          publish({
            ...state,
            loading: false,
            error:
              error instanceof Error
                ? error.message
                : "โหลดความปลอดภัยไม่สำเร็จ",
          });
      }
    },
    reauthenticate,
    async addPassword(password: string) {
      const current = generation;
      if (password.length < 6)
        throw new Error("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
      await options.session.accessToken();
      if (current !== generation) return false;
      const original = await options.supabase.auth.getUser();
      if (current !== generation) return false;
      if (original.error) throw original.error;
      if (original.data.user?.id !== owner)
        throw new Error("ข้อมูลบัญชีไม่ตรงกับผู้เข้าสู่ระบบ");
      if (
        original.data.user.identities?.some(
          (identity) => identity.provider === "email",
        )
      )
        throw new Error("กรุณาเปลี่ยนรหัสผ่านโดยยืนยันรหัสผ่านเดิม");
      const { data, error } = await options.supabase.auth.updateUser({
        password,
      });
      if (current !== generation) return false;
      if (error) throw error;
      if (data.user?.id !== owner)
        throw new Error("ข้อมูลบัญชีไม่ตรงกับผู้เข้าสู่ระบบ");
      await store.load();
      if (state.error) throw new Error(state.error);
      return true;
    },
    async reauthenticateOAuth(provider: "google" | "facebook", code?: string) {
      const current = generation,
        uid = owner;
      if (!options.openAuthSession)
        throw new Error("เปิดหน้าผู้ให้บริการไม่ได้");
      await options.session.accessToken();
      if (current !== generation) return false;
      const original = await options.supabase.auth.getUser();
      if (current !== generation) return false;
      if (original.error) throw original.error;
      if (
        original.data.user?.id !== uid ||
        !original.data.user.identities?.some(
          (identity) => identity.provider === provider,
        )
      )
        throw new Error("กรุณายืนยันด้วยผู้ให้บริการที่เชื่อมกับบัญชีเดิม");
      const factor = original.data.user.factors?.find(
        (factor) =>
          factor.factor_type === "totp" && factor.status === "verified",
      );
      if (factor && !/^\d{6}$/.test(code ?? ""))
        throw new Error("กรุณาระบุรหัส Authenticator 6 หลัก");
      const redirectTo = "mangadock://auth/reauth";
      const login = await options.supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (current !== generation) return false;
      if (login.error) throw login.error;
      if (!login.data.url) throw new Error("เปิดหน้าผู้ให้บริการไม่ได้");
      const result = await options.openAuthSession(login.data.url, redirectTo);
      if (current !== generation || result.type !== "success") return false;
      if (!result.url) throw new Error("ไม่ได้รับผลยืนยัน");
      const callback = new URL(result.url);
      if (
        callback.protocol !== "mangadock:" ||
        callback.host !== "auth" ||
        callback.pathname !== "/reauth" ||
        callback.username ||
        callback.password ||
        callback.port
      )
        throw new Error("ลิงก์ยืนยันไม่ตรงกับคำขอ");
      const authCode = callback.searchParams.get("code");
      if (!authCode || callback.searchParams.getAll("code").length !== 1)
        throw new Error("ไม่ได้รับรหัสยืนยัน");
      const exchange =
        await options.supabase.auth.exchangeCodeForSession(authCode);
      if (current !== generation) return false;
      if (exchange.error) throw exchange.error;
      if (exchange.data.user?.id !== uid) {
        options.session.revokeAcceptance();
        throw new Error("บัญชีที่ยืนยันไม่ตรงกับบัญชีเดิม");
      }
      const assurance =
        await options.supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (current !== generation) return false;
      if (assurance.error) throw assurance.error;
      if (
        assurance.data.nextLevel === "aal2" &&
        assurance.data.currentLevel !== "aal2"
      ) {
        if (!factor || !code) {
          await options.session.restore();
          throw new Error("กรุณายืนยัน Authenticator อีกครั้ง");
        }
        const result = await options.supabase.auth.mfa.challengeAndVerify({
          factorId: factor.id,
          code,
        });
        if (current !== generation) return false;
        if (result.error) {
          await options.session.restore();
          throw result.error;
        }
      }
      if (
        !(await confirmAssurance(
          current,
          !!factor || assurance.data.nextLevel === "aal2",
        ))
      )
        return false;
      publish({ ...state, authenticatedUntil: now() + 5 * 60_000 });
      return true;
    },
    async link(provider: "google" | "facebook") {
      const current = generation,
        uid = owner;
      if (!options.openAuthSession)
        throw new Error("เปิดหน้าผู้ให้บริการไม่ได้");
      await options.session.accessToken();
      if (current !== generation) return false;
      const redirectTo = "mangadock://auth/link";
      const { data, error } = await options.supabase.auth.linkIdentity({
        provider,
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (current !== generation) return false;
      if (error) throw error;
      if (!data.url) throw new Error("เปิดหน้าผู้ให้บริการไม่ได้");
      const result = await options.openAuthSession(data.url, redirectTo);
      if (current !== generation || result.type !== "success") return false;
      if (!result.url) throw new Error("ไม่ได้รับผลยืนยันจากผู้ให้บริการ");
      const callback = new URL(result.url);
      if (
        callback.protocol !== "mangadock:" ||
        callback.host !== "auth" ||
        callback.pathname !== "/link" ||
        callback.username ||
        callback.password ||
        callback.port
      )
        throw new Error("ลิงก์ยืนยันไม่ตรงกับคำขอ");
      const code = callback.searchParams.get("code");
      if (!code || callback.searchParams.getAll("code").length !== 1)
        throw new Error("ไม่ได้รับรหัสยืนยัน");
      const exchanged =
        await options.supabase.auth.exchangeCodeForSession(code);
      if (current !== generation) return false;
      if (exchanged.error) throw exchanged.error;
      if (exchanged.data.user?.id !== uid) {
        options.session.revokeAcceptance();
        throw new Error("บัญชีที่ยืนยันไม่ตรงกับบัญชีเดิม");
      }
      await options.session.refreshAccount();
      if (current !== generation) return false;
      await store.load();
      if (state.error) throw new Error(state.error);
      if (
        !state.user?.identities?.some(
          (identity) => identity.provider === provider,
        )
      )
        throw new Error("ยังไม่พบการเชื่อมบัญชี กรุณาตรวจสอบอีกครั้ง");
      return true;
    },
    async unlink(provider: string) {
      const current = generation;
      await options.session.accessToken();
      if (current !== generation) return false;
      const { data, error } = await options.supabase.auth.getUser();
      if (current !== generation) return false;
      if (error) throw error;
      if (data.user?.id !== owner)
        throw new Error("ข้อมูลบัญชีไม่ตรงกับผู้เข้าสู่ระบบ");
      const identities = data.user.identities ?? [];
      if (identities.length < 2 || !["google", "facebook"].includes(provider))
        throw new Error("ต้องมีวิธีเข้าสู่ระบบอย่างน้อยหนึ่งวิธี");
      const identity = identities.find(
        (identity) => identity.provider === provider,
      );
      if (!identity) throw new Error("ไม่พบการเชื่อมบัญชีนี้");
      const result = await options.supabase.auth.unlinkIdentity(identity);
      if (current !== generation) return false;
      if (result.error) throw result.error;
      await store.load();
      if (state.error) throw new Error(state.error);
      return !state.user?.identities?.some(
        (identity) => identity.provider === provider,
      );
    },
    startTotp(): Promise<boolean> {
      if (enrollmentStart) return enrollmentStart;
      if (state.enrollment) return Promise.resolve(true);
      const promise = (async () => {
        if (unverifiedEnrollmentId && !(await store.cancelTotp())) return false;
        const current = generation,
          originalOwner = owner;
        await options.session.accessToken();
        if (current !== generation || !unsubscribe) return false;
        const user = await options.supabase.auth.getUser();
        if (current !== generation) return false;
        if (user.error) throw user.error;
        if (user.data.user?.id !== owner)
          throw new Error("ข้อมูลบัญชีไม่ตรงกับผู้เข้าสู่ระบบ");
        if (
          !user.data.user.identities?.some(
            (identity) => identity.provider === "email",
          )
        )
          throw new Error("กรุณาเพิ่มรหัสผ่านให้บัญชีก่อนเปิด MFA");
        if (
          user.data.user.factors?.some(
            (factor) =>
              factor.factor_type === "totp" && factor.status === "verified",
          )
        )
          throw new Error("บัญชีนี้เปิดใช้ Authenticator แล้ว");
        const { data, error } = await options.supabase.auth.mfa.enroll({
          factorType: "totp",
          friendlyName: "MangaDock Authenticator",
        });
        if (error) throw error;
        if (current !== generation) {
          await cleanupEnrollment(data.id, originalOwner).catch(() => {});
          return false;
        }
        unverifiedEnrollmentId = data.id;
        publish({
          ...state,
          enrollment: {
            id: data.id,
            secret: data.totp.secret,
            uri: data.totp.uri,
          },
        });
        return true;
      })().finally(() => {
        if (enrollmentStart === promise) enrollmentStart = null;
      });
      enrollmentStart = promise;
      return promise;
    },
    async finishTotp(code: string) {
      const current = generation,
        enrollment = state.enrollment;
      if (!enrollment || !/^\d{6}$/.test(code))
        throw new Error("กรุณาระบุรหัส Authenticator 6 หลัก");
      await options.session.accessToken();
      if (current !== generation) return false;
      const result = await options.supabase.auth.mfa.challengeAndVerify({
        factorId: enrollment.id,
        code,
      });
      if (current !== generation) return false;
      if (result.error) throw result.error;
      const assurance =
        await options.supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (current !== generation) return false;
      if (assurance.error) throw assurance.error;
      if (assurance.data.currentLevel !== "aal2")
        throw new Error("ยังยืนยัน Authenticator ไม่สำเร็จ");
      await options.session.refreshAccount();
      if (current !== generation) return false;
      unverifiedEnrollmentId = null;
      publish({ ...state, enrollment: null });
      await store.load();
      if (state.error) throw new Error(state.error);
      return state.factors.some(
        (factor) => factor.id === enrollment.id && factor.status === "verified",
      );
    },
    async cancelTotp() {
      const current = generation,
        id = unverifiedEnrollmentId;
      if (!id) return true;
      try {
        await options.session.accessToken();
        if (current !== generation) return false;
        const { error } = await options.supabase.auth.mfa.unenroll({
          factorId: id,
        });
        if (current !== generation) return false;
        if (error) throw error;
        unverifiedEnrollmentId = null;
        return true;
      } finally {
        if (current === generation) publish({ ...state, enrollment: null });
      }
    },
    async signOutOthers() {
      const current = generation;
      if (state.authenticatedUntil <= now())
        throw new Error("กรุณายืนยันตัวตนก่อนทำรายการ");
      await options.session.accessToken();
      if (current !== generation) return false;
      const { error } = await options.supabase.auth.signOut({
        scope: "others",
      });
      if (current !== generation) return false;
      if (error) throw error;
      return true;
    },
    async deleteProductData(confirmation: string) {
      const current = generation;
      if (confirmation !== "ลบบัญชี" || state.authenticatedUntil <= now())
        throw new Error("กรุณายืนยันตัวตนและพิมพ์ ลบบัญชี ก่อนลบข้อมูล");
      const token = await options.session.accessToken();
      if (current !== generation) return false;
      const result = await api.json<{ ok: boolean }>("users/me", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (current !== generation) return false;
      if (!result.ok) throw new Error("ยังลบข้อมูลบัญชีไม่สำเร็จ");
      await options.session.signOut();
      return true;
    },
    async removeTotp(factorId: string) {
      const current = generation;
      if (state.authenticatedUntil <= now())
        throw new Error("กรุณายืนยันตัวตนก่อนทำรายการ");
      if (
        !state.factors.some(
          (factor) =>
            factor.id === factorId &&
            factor.factor_type === "totp" &&
            factor.status === "verified",
        )
      )
        throw new Error("ไม่พบ Authenticator ที่ยืนยันแล้ว");
      await options.session.accessToken();
      if (current !== generation) return false;
      const { error } = await options.supabase.auth.mfa.unenroll({ factorId });
      if (current !== generation) return false;
      if (error) throw error;
      await store.load();
      if (state.error) throw new Error(state.error);
      return !state.factors.some((factor) => factor.id === factorId);
    },
    async changePassword(
      currentPassword: string,
      password: string,
      code?: string,
    ) {
      const current = generation;
      if (password.length < 6)
        throw new Error("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
      if (
        !(await reauthenticate(currentPassword, code)) ||
        current !== generation
      )
        return false;
      const { data, error } = await options.supabase.auth.updateUser({
        password,
      });
      if (current !== generation) return false;
      if (error) throw error;
      if (data.user?.id !== owner)
        throw new Error("ข้อมูลบัญชีไม่ตรงกับผู้เข้าสู่ระบบ");
      await options.session.refreshAccount();
      return current === generation;
    },
    activate() {
      identityChanged();
      unsubscribe ??= options.session.subscribe(identityChanged);
    },
    dispose() {
      const id = unverifiedEnrollmentId,
        uid = owner;
      generation++;
      unsubscribe?.();
      unsubscribe = undefined;
      unverifiedEnrollmentId = null;
      publish({
        ...state,
        user: null,
        devices: [],
        factors: [],
        enrollment: null,
        authenticatedUntil: 0,
        loading: false,
        error: null,
      });
      if (id) void cleanupEnrollment(id, uid).catch(() => {});
    },
  };
  return store;
}
