"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Browser Supabase client for the Dev-console OAuth login (PRD #279, ADR 016).
// Same project as the app's Frontend; the dev signs in (Google), and the
// resulting access token is forwarded to MIT, which verifies it independently
// (ADR 016 §Decision 4). Returns null when the env is absent, so the dashboard
// still runs (mock mode) on a machine without Supabase configured.

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  if (!client) {
    client = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // No-op lock: the default navigator.locks lock can deadlock (getSession /
        // the OAuth-callback exchange hang) in some browsers. A single-tab dev
        // console doesn't need cross-tab serialization, so just run the fn.
        lock: async (_name, _acquireTimeout, fn) => fn(),
      },
    });
  }
  return client;
}
