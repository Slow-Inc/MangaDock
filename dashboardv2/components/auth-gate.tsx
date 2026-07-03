// OAuth is deferred for V2 (ported dashboard only). The dashboard consumes `useDevAuth().token` solely to
// feed the live SSE hook; in mock mode the token is unused (the hook short-circuits to MOCK_MIT), and in
// live mode a null token degrades gracefully to "offline / No Data". A real Supabase auth gate lands when
// V2 needs live telemetry. Keeping the same import path (`@/components/auth-gate`) so dashboard.tsx is a
// byte-identical port.
export const useDevAuth = (): { token: string | null } => ({ token: null });
