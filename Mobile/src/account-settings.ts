import type { SupabaseClient } from "@supabase/supabase-js";
import type { createMobileSession } from "./session.ts";
import { createApi } from "./api.ts";
import { createMedia, type PickedImage } from "./media.ts";
export type AccountProfile = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: number;
  plan: string;
  trustScore: number;
  ratingAvg: number;
  ratingCount: number;
  country: string | null;
  preferredLanguage: string | null;
  bio: string | null;
  translatorLanguages: string[];
};
export function createAccountSettings(options: {
  apiOrigin: string;
  deviceId: string;
  fetch: typeof globalThis.fetch;
  session: ReturnType<typeof createMobileSession>;
  supabase: SupabaseClient;
}) {
  let state = {
    profile: null as AccountProfile | null,
    loading: false,
    error: null as string | null,
    photos: [] as string[],
  };
  const listeners = new Set<() => void>();
  const api = createApi(options);
  const media = createMedia(options);
  function publish(next: typeof state) {
    state = next;
    listeners.forEach((listener) => listener());
  }
  let identity = 0,
    loadGeneration = 0,
    owner = options.session.snapshot().account?.uid ?? null;
  const requests = new Set<AbortController>();
  function identityChanged() {
    const next = options.session.snapshot().account?.uid ?? null;
    if (owner !== next) {
      owner = next;
      identity++;
      loadGeneration++;
      requests.forEach((request) => request.abort());
      publish({ profile: null, loading: false, error: null, photos: [] });
    }
  }
  let unsubscribe: (() => void) | undefined =
    options.session.subscribe(identityChanged);
  async function request(path: string, init: RequestInit, current: number) {
    const token = await options.session.accessToken();
    if (current !== identity || !unsubscribe) return null;
    const controller = new AbortController();
    requests.add(controller);
    try {
      const result = await api.request(path, {
        ...init,
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      return current === identity && !controller.signal.aborted ? result : null;
    } finally {
      requests.delete(controller);
    }
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
      const current = identity,
        generation = ++loadGeneration;
      publish({ ...state, loading: true, error: null });
      try {
        const response = await request("users/me", {}, current);
        if (!response) return;
        const profile = (await response.json()) as AccountProfile;
        if (current !== identity || generation !== loadGeneration) return;
        if (profile.uid !== owner)
          throw new Error("ข้อมูลบัญชีไม่ตรงกับผู้เข้าสู่ระบบ");
        publish({ ...state, profile, loading: false, error: null });
      } catch (error) {
        if (current === identity && generation === loadGeneration)
          publish({
            ...state,
            loading: false,
            error:
              error instanceof Error ? error.message : "โหลดบัญชีไม่สำเร็จ",
          });
      }
    },
    async saveProfile(body: { displayName?: string; photoURL?: string }) {
      const current = identity;
      await options.session.accessToken();
      if (current !== identity || !unsubscribe) return false;
      const displayName = body.displayName?.trim();
      if (body.displayName !== undefined && !displayName)
        throw new Error("กรุณาระบุชื่อ");
      const { data, error } = await options.supabase.auth.updateUser({
        data: {
          ...(displayName !== undefined
            ? { display_name: displayName, full_name: displayName }
            : {}),
          ...(body.photoURL !== undefined ? { avatar_url: body.photoURL } : {}),
        },
      });
      if (current !== identity) return false;
      if (error) throw error;
      if (data.user?.id !== owner)
        throw new Error("ข้อมูลบัญชีไม่ตรงกับผู้เข้าสู่ระบบ");
      if (
        !(await request(
          "users/me",
          {
            method: "PATCH",
            body: JSON.stringify({
              ...body,
              ...(displayName !== undefined ? { displayName } : {}),
            }),
          },
          current,
        ))
      )
        return false;
      if (current !== identity) return false;
      await options.session.refreshAccount();
      await store.load();
      return true;
    },
    async saveTranslatorProfile(body: {
      bio?: string;
      translatorLanguages?: string[];
      country?: string;
      preferredLanguage?: string;
    }) {
      const current = identity;
      if (
        !(await request(
          "users/me/translator-profile",
          { method: "PATCH", body: JSON.stringify(body) },
          current,
        ))
      )
        return false;
      if (current !== identity) return false;
      await store.load();
      return true;
    },
    async loadPhotos() {
      const current = identity,
        response = await request("users/me/photo-history", {}, current);
      if (!response) return;
      const photos = (await response.json()) as string[];
      if (current === identity) publish({ ...state, photos });
    },
    async uploadAvatar(image: PickedImage) {
      const current = identity;
      const uploaded = await media.upload<{ url: string }>(
        "users/me/avatar",
        image,
      );
      if (!uploaded || current !== identity) return false;
      if (
        !(await store.saveProfile({ photoURL: uploaded.url })) ||
        current !== identity
      )
        return false;
      const photos = [
        uploaded.url,
        ...state.photos.filter((photo) => photo !== uploaded.url),
      ];
      const result = await request(
        "users/me/photo-history",
        { method: "POST", body: JSON.stringify({ photos }) },
        current,
      );
      if (!result || current !== identity) return false;
      await store.loadPhotos();
      return current === identity;
    },
    activate() {
      media.activate();
      identityChanged();
      unsubscribe ??= options.session.subscribe(identityChanged);
    },
    dispose() {
      media.dispose();
      identity++;
      loadGeneration++;
      requests.forEach((request) => request.abort());
      unsubscribe?.();
      unsubscribe = undefined;
    },
  };
  return store;
}
