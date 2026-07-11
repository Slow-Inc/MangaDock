"use client";

import { useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { postOAuthCallbackMessage } from "../../lib/oauthCallback";

/**
 * OAuth popup callback page.
 *
 * Two outcomes:
 *  1. Success — Supabase processes the token; we postMessage the session to opener.
 *  2. Error   — Supabase redirects here with ?error=… params; we postMessage the error.
 */
export default function AuthCallbackPage() {
  useEffect(() => {
    // ── Check for OAuth errors in URL (query string OR hash) ──────────────
    const search = new URLSearchParams(window.location.search);
    const hash   = new URLSearchParams(window.location.hash.replace(/^#/, ""));

    const errorCode = search.get("error_code") || hash.get("error_code");
    const errorDesc = search.get("error_description") || hash.get("error_description");
    const error     = search.get("error") || hash.get("error");

    if (error || errorCode) {
      if (window.opener) {
        postOAuthCallbackMessage(
          window.opener,
          { error_code: errorCode ?? undefined, error: (errorDesc || error) ?? undefined },
          window.location.origin,
        );
      }
      setTimeout(() => window.close(), 300);
      return;
    }

    // ── Success path: Supabase client auto-processes the token ────────────
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session) {
        subscription.unsubscribe();
        if (window.opener) {
          postOAuthCallbackMessage(
            window.opener,
            { access_token: session.access_token, refresh_token: session.refresh_token },
            window.location.origin,
          );
        }
        setTimeout(() => window.close(), 300);
      }
    });

    const fallback = setTimeout(() => window.close(), 10000);
    return () => {
      subscription.unsubscribe();
      clearTimeout(fallback);
    };
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0f0f0f] text-white">
      <p className="text-sm text-white/60">กำลังดำเนินการ กรุณารอสักครู่...</p>
    </div>
  );
}
