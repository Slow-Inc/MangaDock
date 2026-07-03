// Mock-data mode for UX/UI testing while a real MIT live source isn't reachable. Gated by the
// `NEXT_PUBLIC_MOCKUP_MODE` env var (set in `.env.local`, off by default) so production never fakes
// data. When on, `useLiveSnapshot` serves a representative MitLive snapshot through the SAME shape
// the real stream produces — so mock and real share one render path and the mock→real switch can't
// leave a panel behind. Pure read of the inlined env var (Next replaces it client-side at build).

export function isMockMode(): boolean {
  return process.env.NEXT_PUBLIC_MOCKUP_MODE === "true";
}
