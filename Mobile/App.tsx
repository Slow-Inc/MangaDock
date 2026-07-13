import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import * as Application from "expo-application";
import * as AuthSession from "expo-auth-session";
import * as MediaLibrary from "expo-media-library";
import { StatusBar } from "expo-status-bar";
import * as WebBrowser from "expo-web-browser";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { WebView, WebViewMessageEvent, WebViewNavigation } from "react-native-webview";
import {
  NativeToWebMessage,
  OAuthProvider,
  parseWebToNativeMessage,
} from "./shared/mobileBridge";

WebBrowser.maybeCompleteAuthSession();

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? "http://localhost:4000";
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const DEVICE_ID_STORAGE_KEY = "mangadock_native_device_id";
const WEB_DEVICE_ID_KEY = "mangadock_device_id";

function readOAuthParams(url: string): URLSearchParams {
  const parsed = new URL(url);
  const params = new URLSearchParams(parsed.search);
  const hash = new URLSearchParams(parsed.hash.replace(/^#/, ""));
  hash.forEach((value, key) => params.set(key, value));
  return params;
}

function webMessageScript(payload: unknown) {
  const serialized = JSON.stringify(payload).replace(/<\/script/gi, "<\\/script");
  return `
    window.dispatchEvent(new MessageEvent("message", { data: ${serialized} }));
    true;
  `;
}

function localStorageScript(key: string, value: string) {
  const safeKey = JSON.stringify(key);
  const safeValue = JSON.stringify(value);
  return `
    try {
      window.localStorage.setItem(${safeKey}, ${safeValue});
    } catch (error) {}
    true;
  `;
}

async function getNativeDeviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(DEVICE_ID_STORAGE_KEY);
  if (existing) return existing;

  const nativeId =
    Platform.OS === "android"
      ? Application.getAndroidId()
      : await Application.getIosIdForVendorAsync();

  const id = nativeId ? `mdock_native_${nativeId}` : `mdock_native_${crypto.randomUUID()}`;
  await AsyncStorage.setItem(DEVICE_ID_STORAGE_KEY, id);
  return id;
}

export default function App() {
  const webViewRef = useRef<WebView>(null);
  const [webReady, setWebReady] = useState(false);
  const [authBusy, setAuthBusy] = useState<OAuthProvider | null>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const supabase = useMemo(() => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        flowType: "pkce",
      },
    });
  }, []);

  useEffect(() => {
    let mounted = true;
    getNativeDeviceId()
      .then((id) => {
        if (mounted) setDeviceId(id);
      })
      .catch(() => {
        if (mounted) setDeviceId(`mdock_native_${Date.now().toString(36)}`);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!canGoBack) return false;
      webViewRef.current?.goBack();
      return true;
    });
    return () => sub.remove();
  }, [canGoBack]);

  const postMessageToWeb = useCallback((payload: NativeToWebMessage) => {
    webViewRef.current?.injectJavaScript(webMessageScript(payload));
  }, []);

  const syncDeviceIdToWeb = useCallback(() => {
    if (!deviceId) return;
    webViewRef.current?.injectJavaScript(localStorageScript(WEB_DEVICE_ID_KEY, deviceId));
  }, [deviceId]);

  const startOAuth = useCallback(async (provider: OAuthProvider) => {
    if (!supabase) {
      postMessageToWeb({
        type: "mangadock:native-auth:session",
        error: "Missing Supabase env in Mobile/.env",
      });
      return;
    }

    setAuthBusy(provider);
    const redirectTo = AuthSession.makeRedirectUri({
      scheme: "mangadock",
      path: "auth/callback",
    });

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });

      if (error || !data.url) {
        throw error ?? new Error("OAuth URL was not returned");
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type !== "success") {
        postMessageToWeb({
          type: "mangadock:native-auth:session",
          error: "Login was cancelled",
        });
        return;
      }

      const params = readOAuthParams(result.url);
      const errorDescription = params.get("error_description") ?? params.get("error");
      if (errorDescription) throw new Error(errorDescription);

      const code = params.get("code");
      if (code) {
        const { data: sessionData, error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError || !sessionData.session) {
          throw exchangeError ?? new Error("OAuth code did not return a session");
        }

        postMessageToWeb({
          type: "mangadock:native-auth:session",
          access_token: sessionData.session.access_token,
          refresh_token: sessionData.session.refresh_token,
        });
        return;
      }

      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");
      if (!accessToken || !refreshToken) {
        throw new Error("OAuth callback did not include a session");
      }

      const { data: sessionData, error: setSessionError } =
        await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
      if (setSessionError || !sessionData.session) {
        throw setSessionError ?? new Error("OAuth token was rejected");
      }

      postMessageToWeb({
        type: "mangadock:native-auth:session",
        access_token: sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Native OAuth failed";
      postMessageToWeb({
        type: "mangadock:native-auth:session",
        error: message,
      });
      Alert.alert("Login failed", message);
    } finally {
      setAuthBusy(null);
    }
  }, [postMessageToWeb, supabase]);

  const requestMediaLibraryPermission = useCallback(async (requestId: string) => {
    let status: "granted" | "denied" | "blocked" = "denied";
    try {
      const current = await MediaLibrary.getPermissionsAsync(false, ["photo"]);
      const result = current.granted
        ? current
        : await MediaLibrary.requestPermissionsAsync(false, ["photo"]);
      status = result.granted
        ? "granted"
        : result.canAskAgain
          ? "denied"
          : "blocked";
    } catch {
      // Keep denied as the fail-closed result when the native API is unavailable.
    }

    postMessageToWeb({
      type: "mangadock:permission:result",
      permission: "media-library",
      requestId,
      status,
    });

    if (status === "blocked") {
      Alert.alert(
        "Photo access is disabled",
        "Allow photo access in system settings to upload manga images.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Open settings", onPress: () => void Linking.openSettings() },
        ],
      );
    }
  }, [postMessageToWeb]);

  const onMessage = useCallback(async (event: WebViewMessageEvent) => {
    const payload = parseWebToNativeMessage(event.nativeEvent.data);
    if (!payload) return;

    if (payload.type === "mangadock:oauth:start") {
      await startOAuth(payload.provider);
      return;
    }

    if (payload.type === "mangadock:permission:request") {
      await requestMediaLibraryPermission(payload.requestId);
    }
  }, [requestMediaLibraryPermission, startOAuth]);

  const onNavigationStateChange = useCallback((navState: WebViewNavigation) => {
    setCanGoBack(navState.canGoBack);
  }, []);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
        <StatusBar style="light" />
        <WebView
          ref={webViewRef}
          source={{ uri: WEB_URL }}
          originWhitelist={["http://*", "https://*"]}
          onMessage={onMessage}
          onLoadStart={() => setLoadError(null)}
          onLoadEnd={() => {
            setWebReady(true);
            syncDeviceIdToWeb();
          }}
          onNavigationStateChange={onNavigationStateChange}
          onError={(event) => setLoadError(event.nativeEvent.description)}
          injectedJavaScriptBeforeContentLoaded={
            deviceId ? localStorageScript(WEB_DEVICE_ID_KEY, deviceId) : undefined
          }
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loading}>
              <ActivityIndicator color="#fff" />
            </View>
          )}
          renderError={() => (
            <View style={styles.error}>
              <Text style={styles.errorTitle}>Cannot load MangaDock</Text>
              <Text style={styles.errorText}>
                {loadError ?? `Check that the web app is running at ${WEB_URL}`}
              </Text>
              <Pressable
                style={styles.retryButton}
                onPress={() => {
                  setWebReady(false);
                  setLoadError(null);
                  webViewRef.current?.reload();
                }}
              >
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
            </View>
          )}
        />
        {(!webReady || authBusy) && (
          <View pointerEvents="none" style={styles.overlay}>
            <ActivityIndicator color="#fff" />
            <Text style={styles.overlayText}>
              {authBusy ? `Signing in with ${authBusy}...` : "Loading MangaDock..."}
            </Text>
          </View>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const fill = {
  bottom: 0,
  left: 0,
  position: "absolute" as const,
  right: 0,
  top: 0,
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#050507",
  },
  loading: {
    ...fill,
    alignItems: "center",
    backgroundColor: "#050507",
    justifyContent: "center",
  },
  overlay: {
    ...fill,
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
    gap: 12,
    justifyContent: "center",
  },
  overlayText: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 13,
    fontWeight: "600",
  },
  error: {
    ...fill,
    alignItems: "center",
    backgroundColor: "#050507",
    justifyContent: "center",
    padding: 28,
  },
  errorTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 10,
    textAlign: "center",
  },
  errorText: {
    color: "rgba(255,255,255,0.62)",
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 22,
    textAlign: "center",
  },
  retryButton: {
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  retryText: {
    color: "#050507",
    fontSize: 13,
    fontWeight: "800",
  },
});
