"use client";

import { useEffect } from "react";
import { getSupabase } from "@/lib/supabase";
import { mapOAuthError } from "@/lib/oauth";

// OAuth redirect-flow callback. The provider redirects the full page here;
// getSupabase() (detectSessionInUrl) exchanges the code/token, then we go back to
// the dashboard home, which renders from the persisted session. We don't await
// getSession() — we redirect on the SIGNED_IN event or a short backstop, so the
// page never hangs.
export default function AuthCallbackPage() {
  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const errorCode = search.get("error_code") || hash.get("error_code");
    const errorDesc = search.get("error_description") || hash.get("error_description");
    const error = search.get("error") || hash.get("error");
    if (error || errorCode) {
      window.location.replace("/?auth_error=" + encodeURIComponent(mapOAuthError(errorCode, errorDesc || error)));
      return;
    }

    const supabase = getSupabase(); // init triggers the URL token exchange
    let done = false;
    const home = () => { if (!done) { done = true; window.location.replace("/"); } };
    const sub = supabase?.auth.onAuthStateChange((_e, session) => { if (session) home(); });
    const backstop = setTimeout(home, 1500); // also covers no-session → home shows login
    return () => { sub?.data.subscription.unsubscribe(); clearTimeout(backstop); };
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--bg)" }}>
      <span className="h-5 w-5 animate-spin rounded-full" style={{ border: "2px solid var(--hairline)", borderTopColor: "var(--mit)" }} />
    </div>
  );
}
