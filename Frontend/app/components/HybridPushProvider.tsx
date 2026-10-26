"use client";

import {createContext, useContext, useEffect, useRef, useState, type ReactNode} from "react";
import {useRouter} from "next/navigation";
import {useAuth} from "../contexts/AuthContext";
import {supabase} from "../lib/supabase";
import {createPushNotifications, type PushState} from "../lib/hybridPushController";
import type {NotificationDestination} from "../lib/hybridPushLinks";
import {createHybridPushTransport, hybridPushAvailable} from "../lib/hybridPushTransport";
import {registerHybridPushCleanup} from "../lib/hybridPushLifecycle";

type Controller = ReturnType<typeof createPushNotifications>;
const PushContext = createContext<{controller: Controller | null; state: PushState | null}>({controller: null, state: null});
export const useHybridPush = () => useContext(PushContext);

function destinationPath(destination: NotificationDestination): string {
  switch (destination.kind) {
    case "book": return `/book/${destination.id}`;
    case "post": return `/community/p/${destination.id}`;
    case "profile": return `/community/profile/${destination.id}`;
    case "forumManga": return `/community/manga/${destination.id}`;
    case "collection": return `/collections/${destination.id}`;
    case "collections": return "/collections";
    case "feed": return "/feed";
    case "account": return "/settings/profile";
    case "wallet": return "/studio/wallet";
    case "studio": return "/studio";
    case "staff": return "/admin";
    default: return "/";
  }
}

export function HybridPushProvider({children}: {children: ReactNode}) {
  const {user, loading} = useAuth();
  const router = useRouter();
  const owner = useRef<string | null>(user?.uid ?? null);
  const listeners = useRef(new Set<() => void>());
  const transportRef = useRef<ReturnType<typeof createHybridPushTransport> | null>(null);
  const controllerRef = useRef<Controller | null>(null);
  const [controller, setController] = useState<Controller | null>(null);
  const [state, setState] = useState<PushState | null>(null);
  const ready = !loading;

  useEffect(() => {
    if (loading) return;
    owner.current = user?.uid ?? null;
    // Session invalidation reaches native before any new token request.
    void transportRef.current?.request("session", {uid: owner.current}).catch(() => {});
    listeners.current.forEach(listener => listener());
  }, [user?.uid, loading]);

  useEffect(() => {
    if (!ready || !hybridPushAvailable()) return;
    let disposed = false;
    let unsubscribe: (() => void) | undefined;
    let removeCleanup: (() => void) | undefined;
    const transport = createHybridPushTransport(event => {
      if (event.event === "refresh") void controllerRef.current?.refresh();
      if (event.event === "open" && typeof event.responseId === "string") controllerRef.current?.open(event.data, event.responseId);
    });
    transportRef.current = transport;
    void (async () => {
      try {
        const {deviceId, registrationOwner} = await transport.request<{deviceId: string; registrationOwner?: string | null}>("connect");
        if (disposed) return;
        // WebView storage can be cleared independently of native storage. Preserve
        // the OS cleanup marker so an off preference cannot leave a hidden binding.
        if (registrationOwner && !localStorage.getItem("mangadock_push_registration_owner"))
          localStorage.setItem("mangadock_push_registration_owner", registrationOwner);
        await transport.request("session", {uid: owner.current});
        if (disposed) return;
        const push = createPushNotifications({
          apiOrigin: new URL("/api/proxy/", location.origin).href,
          deviceId,
          fetch: window.fetch.bind(window),
          enabled: true,
          session: {
            snapshot: () => ({account: owner.current ? {uid: owner.current} : null}),
            async accessToken() {
              const {data: {session}, error} = await supabase.auth.getSession();
              if (error || !session || session.user.id !== owner.current) throw new Error("กรุณาเข้าสู่ระบบอีกครั้ง");
              return session.access_token;
            },
            subscribe(listener) { listeners.current.add(listener); return () => { listeners.current.delete(listener); }; },
          },
          storage: {getItem: async key => localStorage.getItem(key), setItem: async (key, value) => { localStorage.setItem(key, value); }},
          platform: {
            permission: prompt => transport.request<boolean>("permission", {prompt}),
            token: () => transport.request<string>("token"),
            unregister: () => transport.request<void>("reset"),
            preview: () => transport.request<void>("preview"),
          },
          navigate: destination => router.push(destinationPath(destination)),
        });
        controllerRef.current = push;
        const update = () => {
          setState(push.snapshot());
          void transport.request("presentation", {on: push.snapshot().status === "on"}).catch(() => {});
        };
        unsubscribe = push.subscribe(update);
        removeCleanup = registerHybridPushCleanup(async () => {
          void transport.request("presentation", {on: false}).catch(() => {});
          await push.beforeSignOut();
        });
        setController(push);
        update();
        await transport.request("ready");
        if (!disposed) await push.refresh();
      } catch {
        if (!disposed) setState({status: "error", busy: false, error: "บริการแจ้งเตือนยังไม่พร้อม กรุณาเปิดแอปใหม่แล้วลองอีกครั้ง"});
      }
    })();
    return () => {
      disposed = true;
      unsubscribe?.();
      removeCleanup?.();
      controllerRef.current?.dispose();
      controllerRef.current = null;
      transportRef.current = null;
      transport.dispose();
    };
  }, [ready, router]);

  return <PushContext.Provider value={{controller, state}}>{children}</PushContext.Provider>;
}
