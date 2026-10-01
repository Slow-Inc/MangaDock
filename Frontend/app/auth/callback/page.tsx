"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";

function postOAuthCallback(payload: Record<string, string | null>) {
  let delivered = false;
  if (window.opener && !window.opener.closed) {
    window.opener.postMessage(payload, window.location.origin);
    delivered = true;
  }
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(JSON.stringify(payload));
    delivered = true;
  }
  return delivered;
}

type CallbackState = {
  status: "pending" | "success" | "error";
  message: string;
};

export default function AuthCallbackPage() {
  const [state, setState] = useState<CallbackState>({
    status: "pending",
    message: "กำลังดำเนินการ กรุณารอสักครู่...",
  });

  useEffect(() => {
    let finished = false;
    let subscription: { unsubscribe: () => void } | undefined;
    let closeTimer: ReturnType<typeof setTimeout> | undefined;

    const fail = (message: string, errorCode: string | null = null) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      subscription?.unsubscribe();
      setState({ status: "error", message });
      postOAuthCallback({ type: "supabase:oauth:callback", error: message, error_code: errorCode });
    };
    const complete = (session: Session | null) => {
      if (finished || !session) return;
      finished = true;
      clearTimeout(timeout);
      subscription?.unsubscribe();
      const delivered = postOAuthCallback({
        type: "supabase:oauth:callback",
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
      setState({
        status: "success",
        message: delivered
          ? "เข้าสู่ระบบสำเร็จ กลับไปยัง MangaDock ได้แล้ว"
          : "เข้าสู่ระบบสำเร็จในเบราว์เซอร์นี้ แต่ยังส่งผลกลับไปยังแอปไม่ได้ กรุณากลับไปเริ่มเข้าสู่ระบบจากแอปอีกครั้ง",
      });
      if (delivered) closeTimer = setTimeout(() => window.close(), 300);
    };
    const timeout = setTimeout(() => {
      fail("การเข้าสู่ระบบใช้เวลานานเกินไป กรุณากลับไปเริ่มเข้าสู่ระบบอีกครั้ง", "auth/callback-timeout");
    }, 15000);

    const search = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const read = (key: string) => search.get(key) || hash.get(key);
    if (read("error") || read("error_code")) {
      fail(read("error_description") || read("error") || "เข้าสู่ระบบไม่สำเร็จ", read("error_code"));
    } else {
      const result = supabase.auth.onAuthStateChange((event, session) => {
        if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          complete(session);
        }
      });
      subscription = result.data.subscription;
      if (finished) subscription.unsubscribe();
      // Initialization may finish before subscription; read outside the auth lock.
      void supabase.auth.getSession().then(({ data, error }) => {
        if (error) fail("ไม่สามารถยืนยันการเข้าสู่ระบบได้ กรุณาลองอีกครั้ง");
        else complete(data.session);
      }).catch(() => fail("ไม่สามารถยืนยันการเข้าสู่ระบบได้ กรุณาลองอีกครั้ง"));
    }

    return () => {
      finished = true;
      subscription?.unsubscribe();
      clearTimeout(timeout);
      if (closeTimer) clearTimeout(closeTimer);
    };
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0f0f0f] px-6 text-white">
      <div className="max-w-md text-center" role="status" aria-live="polite">
        <p className="text-sm text-white/60">{state.message}</p>
        {state.status !== "pending" && (
          <Link className="mt-6 inline-block rounded-lg bg-white px-5 py-3 text-sm text-black" href="/">
            กลับไปยัง MangaDock
          </Link>
        )}
      </div>
    </div>
  );
}
