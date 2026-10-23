import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import * as Application from "expo-application";
import * as Crypto from "expo-crypto";
import * as WebBrowser from "expo-web-browser";
import { fetch as nativeFetch } from "expo/fetch";
import { AppState, Platform } from "react-native";
import * as Linking from "expo-linking";
import { createPushNotifications } from "./push-notifications.ts";
import { connectNativePush, pushPlatform } from "./native-push.ts";
import { installAuthCrypto } from "./authCrypto.ts";
import { getDeviceId } from "./device.ts";
import { createMobileSession } from "./session.ts";
import { createAuthManagement } from "./auth-management.ts";
import {
  notificationDestination,
  type NotificationDestination,
} from "./notification-links.ts";

export async function createRuntime() {
  const apiOrigin = process.env.EXPO_PUBLIC_API_BASE_URL;
  const authUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const authKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!apiOrigin || !authUrl || !authKey)
    throw new Error("กรุณาตั้งค่าการเชื่อมต่อ MangaDock ก่อนเปิดแอป");
  for (const url of [apiOrigin, authUrl]) {
    if (!["http:", "https:"].includes(new URL(url).protocol))
      throw new Error("ที่อยู่บริการ MangaDock ไม่ถูกต้อง");
  }
  installAuthCrypto({
    getRandomValues: Crypto.getRandomValues,
    randomUUID: Crypto.randomUUID,
    digest: (data) => Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, data),
  });
  const deviceId = await getDeviceId(AsyncStorage, async () =>
    Platform.OS === "android"
      ? Application.getAndroidId()
      : Application.getIosIdForVendorAsync(),
  );
  const fetch: typeof globalThis.fetch = (input, init) =>
    nativeFetch(input, init);
  const supabase = createClient(authUrl, authKey, {
    global: { fetch },
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: false,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: "pkce",
    },
  });
  let beforeSignOut = async () => {};
  const session = createMobileSession({
    supabase,
    apiOrigin,
    deviceId,
    fetch,
    beforeSignOut: () => beforeSignOut(),
    openAuthSession: (url, redirectTo) =>
      WebBrowser.openAuthSessionAsync(url, redirectTo),
  });
  const auth = createAuthManagement({
    supabase,
    session,
    apiOrigin,
    deviceId,
    fetch,
    openAuthSession: (url, redirectTo) =>
      WebBrowser.openAuthSessionAsync(url, redirectTo),
  });
  let destination: NotificationDestination | null = null;
  const destinations = new Set<() => void>();
  let disposed = false;
  let initialized = false;
  const pushEnabled =
    Platform.OS === "android" &&
    process.env.EXPO_PUBLIC_PUSH_ENABLED === "true";
  const push = createPushNotifications({
    apiOrigin,
    deviceId,
    fetch,
    session,
    storage: AsyncStorage,
    platform: pushPlatform,
    enabled: pushEnabled,
    navigate(next) {
      destination = next;
      destinations.forEach((subscriber) => subscriber());
    },
  });
  beforeSignOut = () => push.beforeSignOut();
  const disconnectPush = pushEnabled ? connectNativePush(push) : () => {};
  async function receiveLink(url: string) {
    if (disposed) return false;
    if (await auth.handleCallback(url)) return true;
    const next = notificationDestination(url);
    if (!next || disposed) return false;
    destination = next;
    destinations.forEach((listener) => listener());
    return true;
  }
  const links = Linking.addEventListener("url", (event) => {
    void receiveLink(event.url).catch(() => {});
  });
  const refresh = (state: string) => {
    if (state === "active") {
      supabase.auth.startAutoRefresh();
      if (initialized) void push.refresh();
    } else supabase.auth.stopAutoRefresh();
  };
  refresh(AppState.currentState);
  const listener = AppState.addEventListener("change", refresh);
  return {
    session,
    supabase,
    auth,
    apiOrigin,
    deviceId,
    fetch,
    push,
    destination: {
      snapshot: () => destination,
      subscribe(listener: () => void) {
        destinations.add(listener);
        return () => {
          destinations.delete(listener);
        };
      },
      consume() {
        destination = null;
        destinations.forEach((listener) => listener());
      },
    },
    async initialize() {
      const url = await Linking.getInitialURL();
      const authHandled = url
        ? await auth.handleCallback(url).catch(() => true)
        : false;
      if (!authHandled) {
        await session.restore();
        if (url) await receiveLink(url).catch(() => {});
      }
      initialized = true;
      // A restored account already queued registration via the session listener.
      // Optional push connectivity must not delay opening the product.
      if (session.snapshot().status !== "signedIn") void push.refresh();
    },
    dispose() {
      disposed = true;
      destinations.clear();
      links.remove();
      listener.remove();
      disconnectPush();
      push.dispose();
      auth.dispose();
      supabase.auth.stopAutoRefresh();
      session.dispose();
    },
  };
}
export type MobileRuntime = Awaited<ReturnType<typeof createRuntime>>;
