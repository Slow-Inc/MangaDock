# DESIGN.md — MIT Staff Console (dashboardv2)

> **Canonical design spec for the dashboard rebuild.** Supersedes `Dashboard/DESIGN.md` (the original project,
> kept at `:4100` as legacy/reference). This is the clean Next.js 16 rebuild (`dashboardv2`, `:4200`, `bun`).
> Direction locked with the user via `/grill-me` + `/grill-with-docs` + reference review (2026-06-18).

---

## 1. Direction — three references, combined

The design is **Speck + PremiumBuss + Arcana**, fused into one system (NOT shadcn, NOT Finesse UI — earlier docs
named those; they are wrong). Each reference contributes a distinct ingredient:

- **Speck** — the base. Warm premium **monotone** (warm charcoal chrome), a single **coral signature** (`--coral`
  `#f4654e`) carried across the bar chart (hatched + active pill tooltip), the donut, active nav, and deltas. The
  alert hue and the brand accent are the same coral.
- **PremiumBuss** — the expressive data layer. **Lime drench** hero panels (`--drench-lime`), the **punch-card /
  heatmap** node grid (colour = usage), and **oversized bold numbers** as the anchor of a panel.
- **Arcana** — the restraint + light mode. **Mono ring / arc gauges**, one **inverted (high-contrast) card** per
  view for the single most important figure, big tabular numbers, and a first-class **light theme**.

**The rule: a monotone canvas, colour used with intent.** Neutrals carry the base (surfaces, borders, labels,
inactive controls, most cards). On that canvas two colour systems live: (a) a fixed **status signal** (success /
processing / warning / error) always carried by **shape + label + colour** so it reads on any surface; and (b) an
**expressive accent palette** (lime, coral, teal, violet, warm/lime gradients — Speck/PremiumBuss) that *selected
hero panels and data viz* adopt as identity. The discipline that keeps it from slop: expressive colour is
meaningful, reserved for a few hero moments per view, and **status legibility always wins** (a red `down` dot reads
on a lime panel). Result: an incident is readable in one second, the console has identity, and it stays
colour-blind-safe (shape + label).

Dark is the default (the console opens during incidents); light is a first-class toggle (Arcana parity), held in
component state on the shell wrapper (`.theme-dark` / `.light`).

## 2. Tokens

Authoritative values live in `app/globals.css`. Summary (do not duplicate hex here — read the file):

- **Neutral (dark, default):** bg `#18120f` → surface `#221b16` → surface-2 `#2b221c`; hairline white .07/.13;
  ink `#f6f0ea` / .58 / .34. **Light:** bg `#f6f1ec` → surface `#fffdfb`; ink `#241c17` / `#6b5f56` / `#a89a8e`.
  Contrast: body ≥4.5:1, large ≥3:1 (verify both themes).
- **Status signal (fixed, shape+label+colour):** idle (neutral) · processing `#f59e0b` · success `#34d399` ·
  warning `#eab308` · error = coral `#f4654e`. Each pairs with a soft tint. Never changes meaning.
- **Coral signature (Speck):** `--coral #f4654e` + `--coral-soft` — active nav, accents, the one alert hue.
- **Expressive accents (Speck / PremiumBuss):** lime `#a3e635`, coral `#fb7185`, teal `#2dd4bf`, violet `#a78bfa`,
  sky `#38bdf8`, amber `#fbbf24` + drenched surface gradients (warm Speck panel, lime→emerald PremiumBuss panel).
  Hero panels + data viz only, never chrome.
- **Stage / chart accents:** detect / ocr / translate / inpaint / render — distinct, inside the pipeline + charts.
- **Radius:** `--radius 12px`. **Type:** sans = Geist (`var(--font-geist-sans)`), mono = Geist Mono (all numerics,
  `tabular-nums`); fixed rem scale (~1.2, product not fluid); metric hero numbers 28–40px mono (the Arcana move).
- **Spacing:** atomic 4px base. **Elevation:** flat, border-first; one soft tier for floating cards; the inverted
  hero card uses inverted ink, not a heavier shadow.

## 3. Two data modes (mock ↔ realtime)

Every panel reads one hook — `components/use-live-snapshot.ts` (`useLiveSnapshot`) — which returns one shape
(`MitLive`, `lib/live-map.ts`). The mode is set by **`NEXT_PUBLIC_MOCKUP_MODE`** (`.env.local`, read via
`lib/mock-mode.ts`). **Mock and realtime share one render path**, so flipping the flag can never strand a panel.

| | **Mock mode** (`MOCKUP_MODE=true`, default for drafting) | **Realtime mode** (`=false`) |
|---|---|---|
| source | `MOCK_MIT` / `MOCK_SERIES` / `MOCK_EVENTS` (`lib/mock-live.ts`) via `buildMockLive()` | live MIT SSE stream (`/api/live`, deferred in V2 until OAuth lands) |
| panel **with** a `MitLive` field | renders the mock value | renders the live value |
| panel **without** a live source | renders the **mock** (full UX draft) | renders **No Data** — the *live-or-No-Data* rule |
| purpose | draft + review every UX/UI state before live | the real console |
| indicator | amber **"Mockup data"** badge | connection chip (live / connecting / offline) |

**`live-or-No-Data` is a realtime-mode rule, NOT a mock-mode rule.** In mock mode the whole dashboard shows mock so
the UX can be drafted end-to-end. In realtime mode each panel shows real MIT telemetry where a source exists, or an
explicit designed **No Data** state (the original `docs/prd/dashboard-live-or-no-data.md` epic rule). The mock layer
exists **for drafting** and is the deliberate, scoped reason mock data lives here despite that PRD's "delete all
mock" framing — mock is gated behind the env flag and shares the live render path, so it documents the live UX
rather than diverging from it.

## 4. Information architecture (locked via /grill-with-docs, 2026-06-18)

**Single-page shell** (ported from the original `/preview`), NOT route-per-view. The left rail switches an in-page
`view`; the chrome (rail / topbar / theme) is persistent. **Logs/Console are dropped from the nav** and become
**per-node** (see Node popup). Cross-service categories from the legacy dashboard are **distributed into existing
views, not a new "System" view** (avoids redundancy).

**Nav (4):** `Overview · Frontend · Backend · MIT`.

**Overview — anomaly-at-a-glance + cross-service rollup.** See what is wrong without a click; each summary drills
down:
1. status chips (connection + MIT health) · 2. incident banner (conditional) · 3. KPI strip (Pages / Throughput /
GPU + Pages/hour bar) · 4. vitals gauges (GPU/VRAM/CPU/RAM ring + arc) + one inverted hero card · 5. **Subsystems
board** (FE/BE/MIT/gateway/Redis/Supabase/R2/streams) · 6. node heatmap (punch-card, colour = usage; down nodes
flagged) → node popup · 7. VRAM donut (per-model + available segment) · 8. **Traffic** (users online + bandwidth per
service/node) · 9. **Streams** (SSE stream health) · 10. Live feed (real `live.events`).

> **SystemFlow dropped (2026-06-18):** the cross-service flow diagram from `:4100` was cut — redundant with the
> Subsystems board (service health) + the pipeline spine (MIT internal flow), low incident-signal (an architecture
> diagram, not anomaly-at-a-glance), and mostly static until FE/BE have a live source. Its intent is covered by
> those two panels.

**MIT — depth tabs:** Pipeline (gateway diagnosis + stage timing + quality) · Telemetry (vitals + **GpuDetail host
time-charts** + VRAM by model) · Queue (full translate queue) · Workers (lifecycle; click a worker → node popup).

**Frontend / Backend:** one page-level **No Data** ("telemetry not wired — #283 / #282") until those `/status`
feeds land. In mock mode they may draft future panels; in realtime they are No Data.

**Node popup — per-node, the one place for a node's everything** (opened from the heatmap / Workers): Compute
(GPU/CPU usage + clock) · Memory (VRAM / RAM) · Thermal (temp + fan) · Power · Network (bandwidth) · Spec · Errors ·
**Logs** · **Console**. Logs and Console live here (per-node), so there is no separate aggregated Logs/Console view —
the Overview feed + incident banner + a red node surface the anomaly, then you drill into that node for its
logs/console. Today MIT emits one worker + machine-wide GPU/host, so most per-node fields render No Data on real
data until MIT telemetry is extended per-node (#279 follow-up); the mock fills every field so the UX can be drafted.

**Category coverage (legacy → V2):** SubsystemBoard / TrafficPanel / StreamHealth → Overview (SystemFlow **dropped**
— see above) · IncidentSummary → incident banner · PipelinePanel → Overview spine + MIT#pipeline · MetricCards / GpuDetail →
Overview vitals + MIT#telemetry · VramPanel → Overview donut + MIT#telemetry · **Logs / Console → node popup** ·
LiveActivity → Live feed · ServiceModal → node popup + service views.

## 5. Component archetypes (each ships all 5 data-states)

Every panel renders mock **or** live through `useLiveSnapshot`, and a panel with no live source shows **No Data** in
realtime mode. The five states are designed, not bolted on: **live · No Data · loading (skeleton, never a centered
spinner) · empty · error (red, labelled)**. One button shape and one form-control vocabulary across the console;
status by shape + label as well as colour.

| archetype | live / mock | No Data (realtime, no source) | loading | error |
|---|---|---|---|---|
| metric card (Arcana big number) | mono hero number + delta + sparkline | number `—` + "No live source" | skeleton bar | red number + reason |
| chart panel (bar/line/donut) | muted series, real wall-clock x-axis | centered No Data | skeleton chart | red-tinted, last-known faded |
| status board (subsystems) | per-item dot + label | item-level No Data | row skeletons | item `down` (red, labelled) |
| pipeline / stage spine | 5 stages, active animated, timing | all idle (before first run) | spine skeleton | stuck stage red + inline log |
| heatmap (node grid) | colour = usage, down flagged | grid No Data | tile skeletons | down node red ring |
| data table (queue / workers) | rows | "No jobs / workers yet" | row skeletons | red row / banner |
| feed (events) | real `live.events`, timestamps | "No events yet" | skeleton lines | error events red |
| node popup | per-node sections | per-field No Data | — | errors section |

## 6. Motion & accessibility

- Motion conveys **state only** (150–250 ms, ease-out): stage activation/flow, value ticks (`CountUp`), chart
  grow-from-0, gauge sweep, skeleton shimmer. No page-load choreography. Every animation has a
  `prefers-reduced-motion` static fallback. Wall-clock timestamps are client-only (mounted-gate) to avoid SSR
  hydration drift.
- WCAG AA (both themes); status by shape + label (colour-blind-safe); full keyboard reach for view/tab switching +
  the node popup (Esc + backdrop close); focus-visible rings.

## 7. Relationship to the original Dashboard + build order

- **`dashboardv2/` (`:4200`)** — **THE dashboard.** Decision (2026-06-18): abandon `:4100` and build V2 out fully,
  porting every topic/category from the old one into this clean Speck design + IA. Single-page shell, **mock-mode
  only for now** (OAuth + `/api/live` deferred — `components/auth-gate.tsx` is a stub `{ token: null }`).
- **`Dashboard/` (`:4100`)** — the original (OAuth/Supabase + `/api/live` live stream + the old design at `/legacy`).
  **Being abandoned** — kept only as a **topic/data reference** while V2 is built out (its `lib/services` mock data +
  the `SubsystemBoard`/`TrafficPanel`/`StreamHealth`/`GpuDetail` components are the source for the V2 versions).
  Removed once V2 covers its topics + ports realtime.
- **Build-out:** B1 Logs/Console→node popup ✅ · B2 Overview gains Traffic ✅ + Streams ✅ (Subsystems already a
  strip; **SystemFlow dropped**) · B3 MIT Telemetry gains GpuDetail host charts · B4 realtime (OAuth + `/api/live`).
  Each: TDD on pure mappers + visual E2E.

**Build order (against this spec):** the V2 started as the faithful single-page **port**. Done: B1 (Logs/Console →
node popup), B2 (Traffic + Streams panels; SystemFlow cut). Next: B3 MIT Telemetry adds GpuDetail host charts;
B4 wire realtime (OAuth + `/api/live`). Each consumes the data layer + this token system, with TDD on the pure
mappers + visual E2E.
