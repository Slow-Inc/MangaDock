"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

/**
 * OAuth popup callback page — mirrors Frontend/app/auth/callback/page.tsx.
 * Opens as a popup; postMessages session tokens (or error) back to opener, then closes.
 */
export default function AuthCallbackPage() {
  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const hash   = new URLSearchParams(window.location.hash.replace(/^#/, ""));

    const errorCode = search.get("error_code") || hash.get("error_code");
    const errorDesc = search.get("error_description") || hash.get("error_description");
    const error     = search.get("error") || hash.get("error");

    if (error || errorCode) {
      if (window.opener) {
        window.opener.postMessage(
          { type: "supabase:oauth:callback", error_code: errorCode, error: errorDesc || error },
          "*",
        );
      }
      setTimeout(() => window.close(), 300);
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session) {
        subscription.unsubscribe();
        if (window.opener) {
          window.opener.postMessage(
            {
              type: "supabase:oauth:callback",
              access_token: session.access_token,
              refresh_token: session.refresh_token,
            },
            "*",
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
    <div style={{
      minHeight: "100dvh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#18120f",
      color: "rgba(246,240,234,0.4)",
      fontSize: 13,
    }}>
      Processing… please wait
    </div>
  );
}
