import { createClient } from "@supabase/supabase-js";
import { isCliNativeShell } from "./cliNativeAuth";
import { fetchCliAuthWithDeadline } from "./cliAuthFetch";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {flowType: isCliNativeShell() ? "pkce" : "implicit"},
    ...(isCliNativeShell() ? {global: {fetch: fetchCliAuthWithDeadline}} : {}),
  },
);
