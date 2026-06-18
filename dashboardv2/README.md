# MIT Dashboard (V2)

Standalone mission-control dashboard for the MIT translation pipeline (PRD #279, ADR 016) — a clean Next.js 16
rebuild. Ported from the env-synced `Dashboard/components/dashboard.tsx` shell; behaviour is identical.

**Canonical specs:** [`DESIGN.md`](./DESIGN.md) (design system + data modes + IA) · [`PRODUCT.md`](./PRODUCT.md).
Design direction = **Speck + PremiumBuss + Arcana** fused (not shadcn / Finesse UI). This V2 supersedes the original
`Dashboard/` (`:4100`, full OAuth + live stream, kept as legacy/reference until V2 reaches parity).

## Run (bun)

```bash
bun install
bun dev          # http://localhost:4200
bun test         # bun:test — pure logic modules (lib/*.test.ts), 40 tests
bun run build    # production build
```

Use `localhost` (not `127.0.0.1`) — Next 16 blocks cross-origin HMR; allowed dev origins are set in `next.config.ts`.

## Mockup mode (`.env.local`)

`NEXT_PUBLIC_MOCKUP_MODE` toggles the data source through **one render path** (`components/use-live-snapshot.ts`):

| value | behaviour |
|-------|-----------|
| `true` (default) | every panel renders `MOCK_MIT` (`lib/mock-live.ts`); an amber **Mockup data** badge shows in the rail |
| `false` | live MIT telemetry. OAuth is **deferred in V2**, so with no token the dashboard degrades to *offline / No Data* — which is the mock→real wiring-gap check |

Flipping the flag needs a dev-server restart (`NEXT_PUBLIC_*` is inlined at build).

## Scope

This V2 ports the **dashboard UI + env-synced data layer only**. The OAuth/Supabase auth stack is not ported yet
(`components/auth-gate.tsx` is a stub returning `{ token: null }`). Live telemetry (`/api/live`, the MIT SSE
forward) lands when auth is added.

## Structure

```
app/page.tsx            → <Dashboard/>
app/layout.tsx          → Geist fonts + globals
app/globals.css         → warm Speck palette (dark default + .light)
components/dashboard.tsx → the single-page shell (Overview/Frontend/Backend/MIT/Logs/Console views)
components/use-live-snapshot.ts → mock-or-live snapshot (one shape, MitLive)
lib/*                   → pure data layer (mock-mode, mock-live, live-map, snapshot, node-debug, …) + tests
```
