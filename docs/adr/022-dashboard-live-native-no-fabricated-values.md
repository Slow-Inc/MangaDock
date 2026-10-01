# 22. Dashboard is live-native — real MIT data or "No Data", never fabricated values on the live path

Date: 2026-06-28 · Status: Accepted · Area: `dashboardv2` (MIT staff console, `:4200`)

## Context

The `dashboardv2` console renders MIT telemetry. Two display modes share one render path:
- **Mock mode** (`NEXT_PUBLIC_MOCKUP_MODE`): every panel renders with design-time sample data, so the whole surface is reviewable without a live MIT.
- **Live mode**: each panel shows the **real** value from the `MitLive` frame, or an honest **"No Data"** when that field is absent — the gap surfaces what is still unwired.

The hard rule: **a value rendered in live mode must be real.** A fabricated/mock value on a live console is worse than a blank — it lies about a running system (e.g. "translate stalled · 95s" over a healthy MIT).

A Track A self-review (`/scrutinize`, 3-agent trace) found this contract breached in four spots — hardcoded values that rendered on the live path: a pipeline header `total 95.0s · translate stalled`, a GPU-util `−11.4%` delta, a hero `94%` success ring, and vitals gauges reading `0%` (instead of No-Data) when `m.gpu` is null. They passed the unit suite because the contract had no render-level test.

## Decision

The live path renders only real or No-Data. Each panel value is one of:
1. **Real** — read from `MitLive` (works for mock and live alike), or
2. **Derived** from real data via a tested pure lib (`dashboardv2/lib/overview-signals.ts`: `pipelineHeaderSummary`, `pctDelta`), or
3. **No-Data** — `—` / "No live source" when the field is absent (e.g. `m.gpu` null → gauge shows `—`, not `0%`), or
4. **Mock-gated** — a design-only constant rendered **only** behind the `mock` flag (e.g. the hero ring), matching the already-gated number beside it.

No hardcoded metric/label may render unconditionally on the live path. New panels follow this contract; the four leaks above were fixed under PR #414.

## Consequences

- **+** The live console is trustworthy — every on-screen number traces to real telemetry or an honest gap; demos can't show fake incident state on healthy MIT.
- **+** Leak-prone presentation logic is extracted into pure, unit-tested libs (`overview-signals.ts`) instead of inline JSX constants.
- **−** The contract is still only enforced by review + pure-lib tests; the data-state gating in `dashboard.tsx` JSX has **no render-level test** — a future render test (mount `mock=false` + healthy `m`, assert absence of design strings) would make it self-checking. Tracked as a follow-up (Track A test-depth nits).
- Relates to PRD #304 (live-native redesign); surfaced by #352/#353/#354; fixed in PR #414.
