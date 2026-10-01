import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { flowType: typeof window !== "undefined" && window.ReactNativeWebView && window.__MANGA_DOCK_CLIENT__ === "android-mobile-shell" ? "pkce" : "implicit" } },
);
