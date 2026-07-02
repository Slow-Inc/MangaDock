# DESIGN.md — Staff Console (live-native redesign)

> **⚠️ SUPERSEDED (2026-06-18) — canonical spec is now [`dashboardv2/DESIGN.md`](../dashboardv2/DESIGN.md).** This
> file describes the original `Dashboard/` project (`:4100`), kept as legacy/reference. Two corrections vs what was
> actually built: the direction is **Speck + PremiumBuss + Arcana** (not "shadcn/ui base"), and the tokens are the
> **warm Speck palette** in `app/globals.css` (bg `#18120f`), NOT the shadcn-zinc set described in §2 below. The IA
> (route-based, §4) applies to this project only; V2 uses a single-page shell. New work → the V2 spec.
>
> Design system for the redesign (epic #304 / I2 #306). Direction: **Speck + PremiumBuss + Arcana, fused** — a warm
> monotone console where **color is reserved for status/data only** (signal over noise). Locked with the user via
> `/grill-me` + reference review (Speck, PremiumBuss, Arcana). Consumes the I1 data layer (`lib/panel-source`,
> `hooks/use-mit-live`, `components/no-data`).

## 1. Direction

shadcn/ui's component grammar (neutral surfaces, subtle 1px borders, compact radius, Geist/Inter, clean cards and
forms, muted charts) refined with Arcana's restraint: oversized tabular numbers as the anchor of each metric, soft
layered elevation, generous whitespace, one inverted (high-contrast) card per view for the single most important
figure. Mission-control density without mission-control chrome.

**The rule: a monotone canvas, color used with intent.** Neutrals carry the base — surfaces, borders, labels,
inactive controls, most cards. On that canvas two color systems live: (a) a fixed **status signal** (success /
processing / warning / error), always carried by shape + label + color so it reads on any surface; and (b) an
**expressive accent palette** (lime, coral, teal, violet, warm gradients — drawn from Speck and PremiumBuss) that
*selected hero panels and data viz* adopt freely as identity, category, or a drenched moment. The discipline that
keeps it from slop: expressive color is meaningful (a panel's domain, a chart series, the one figure that matters),
it is reserved for a few hero moments per view (not every card — that is the colorful-card-grid tell), and **status
legibility always wins** (a red `down` dot reads on a lime panel). The result: an incident is readable in one
second, the console has life and identity, and it stays colour-blind-safe (shape + label).

Dark is the default (the console is opened during incidents); light is a first-class toggle (shadcn parity).

## 2. Tokens

Defined in `app/globals.css`. **NOTE: the values below (shadcn `zinc`, bg `#09090b`) were superseded — the actual
ramp is the warm Speck palette (bg `#18120f`); see `dashboardv2/DESIGN.md` §2.** Numbers use a mono/tabular face.

- **Neutral (dark):** bg `#09090b` → surface `#101012` → elevated `#16161a`; border `rgba(255,255,255,.07/.12)`;
  ink `#fafafa` / `.62` / `.40`. **Light:** bg `#fafafa` → surface `#fff` → elevated `#f4f4f5`; border
  `rgba(0,0,0,.08/.14)`; ink `#18181b` / `#52525b` / `#a1a1aa`. Contrast: body ≥4.5:1, large ≥3:1 (verify both themes).
- **Status signal (fixed, shape+label+color, shared across themes):** success `#22c55e` · processing `#f59e0b`
  · warning `#eab308` · error `#ef4444` · idle = neutral `#71717a`. Each pairs with a `*-soft` tint (≤14% mix). This
  set never changes meaning — it is the one thing that must read on any surface, including a colored hero panel.
- **Expressive accents (Speck / PremiumBuss — for hero panels + data viz, used with intent):** lime `#a3e635`,
  coral `#fb7185`, teal `#2dd4bf`, violet `#a78bfa`, sky `#38bdf8`, amber `#fbbf24`, plus two drenched surface
  gradients (a warm Speck panel, a lime→emerald PremiumBuss panel). Assigned per panel as identity/category, or to
  carry the single hero figure of a view (the Arcana inverted card, now optionally drenched). Not on chrome, not on
  every card.
- **Stage accents (pipeline / chart series):** detect / ocr / translate / inpaint / render — distinct, drawn from
  the expressive palette, used only inside the pipeline and charts.
- **Radius:** `--r-sm 6px` · `--r 10px` · `--r-lg 14px` (Smooth-Rectangle scale; tighter than the old 16px).
- **Type:** sans = Geist / Inter / system-ui; mono = Geist Mono (all numerics, `tabular-nums`). Fixed rem scale,
  ratio ~1.2 (product, not fluid). Metric hero numbers: 28–40px mono, the Arcana move.
- **Spacing:** atomic 4px base (2 / 4 / 6 / 8 / 12 / 16 / 24 / 32). **Elevation:** flat border-first; one soft
  shadow tier for floating/elevated cards; the inverted hero card uses inverted ink, not a heavier shadow.

## 3. Component archetypes (each ships all 5 data-states)

Every panel renders through `panelSource(id)` + `isNoData(value)` + `<NoData>` (I1). The five states are designed,
not bolted on:

| archetype | live | No Data (mit-live, unpopulated) | loading / connecting | empty (no-source) | error |
|---|---|---|---|---|---|
| **metric card** (Arcana big number) | mono hero number + delta + sparkline | `<NoData>` in the chart slot, number `—` | skeleton bar | n/a (use empty-page) | red number + reason |
| **chart panel** (bar/line/area) | muted series, real x-axis (wall-clock) | centered `<NoData>` | skeleton chart | `<NoData>` | red-tinted, last-known faded |
| **status board** (subsystems) | per-item dot + label (shape+color) | item-level `No Data` | row skeletons | item `No Data` | item `down` (red, labelled) |
| **pipeline / stage spine** | 5 stages, active animated, timing | all idle (before first run) | spine skeleton | n/a | stuck stage red + inline log |
| **data table** (queue / activity / nodes) | rows | "No jobs / events yet" | row skeletons | `<NoData>` | red row / banner |
| **feed** (MIT events) | real `live.events`, timestamps | "No events yet" | skeleton lines | n/a | error events red |
| **terminal** (`mit@console`) | live read-only commands | "not connected" | — | n/a | command error red |

Rules (shadcn/product): skeletons for loading, never a centered spinner; one button shape and one form-control
vocabulary across the whole console; status by shape+label as well as color.

## 4. Layout (re-laid-out · confirmed via /grill-me, #304)

**Navigation model (confirmed via /grill-with-docs, 2026-06-18): route-based, NOT a single-page shell.** Each
view is a real Next route under the persistent `Shell` layout (`<Link>` + `usePathname()`): `/` (overview),
`/service/mit` (depth tabs), `/service/frontend`, `/service/backend`. This gives deep-linking (`/service/mit#vram`
via `tabForHash`), browser back/forward, and refresh-persistence natively. A single-page in-component shell (one
component, `view` held in `useState`) was prototyped and **rejected** — it regressed navigation (refresh resets to
overview, no deep-link/share, no back), duplicated the rail/topbar `Shell` already provides, and orphaned the
`tabForHash` deep-link machinery. **Logs and Console are MIT tabs, not separate rail routes** (they are MIT-scoped:
`mit@console`, MIT event log; a system-wide `/logs` `/console` would be empty/redundant while only MIT has a source).

**Principle — overview = anomaly-at-a-glance.** The overview must let you SEE what is wrong *without a click*:
which node is down, whether VRAM is leaking, where the pipeline is stuck. Per-entity depth opens in a **popup**;
system-wide / long content opens on the **`/service/mit`** detail page. The **queue is deliberately OFF** the
overview — in production it is always huge (heavy user load), so it is noise at the glance layer, not a health
signal; it lives in the detail page, reachable by drilling into the system.

**Interaction model.** A focused entity (a node — later a model / stage) → **popup** for deep debug. System-wide or
long content (full queue, log stream, console, history charts) → the **`/service/mit` page tabs**.

- **Shell:** left rail nav (Overview / Frontend / Backend / MIT — Logs/Console are MIT tabs), top bar (search, connection +
  MIT-health chips, theme toggle, account), **persistent right-rail live feed**. shadcn rail + Arcana calm.
- **Overview (glanceable, anomaly-first):** top→bottom in the Shell:
  1. **header status chips** — connection (connecting / live / offline) + MIT health (up / degraded / down);
  2. **incident banner** — conditional, only on degraded/down: stuck stage + reason + jump-to-detail;
  3. **pipeline hero** — 5-stage spine, active animated, stuck stage flagged; click a stage → `/service/mit#pipeline`;
  4. **KPI strip** — Pages translated · Throughput · GPU% (+ the Pages/hour bar). **No queue here** (always-huge = noise);
  5. **vitals gauges** — GPU / VRAM / CPU / RAM (ring + arc) + one **inverted hero card**;
  6. **subsystem strip** — condensed dot + label (FE / BE / MIT / gateway / Redis / Supabase / R2 / streams);
     FE/BE/MIT click → their service page, infra = status only;
  7. **node heatmap (punch-card)** — node × time, colour = usage (a *by-product*); the **purpose is which node is
     working / down**, with down nodes flagged clearly (red label / empty row); click a node → the **node popup**;
  8. **VRAM donut** — per-model usage **plus an `available` (free) segment in the same ring** (one VRAM viz, no
     separate gauge); a leaking model is flagged red. Deep per-model history → detail.
- **Node popup (per-node debug, opened from the heatmap) — category-grouped, mock-first:** Compute (GPU/CPU usage
  + clock) · Memory (VRAM / RAM) · Thermal (GPU/CPU temp + fan) · Power (draw) · Network (bandwidth) · Spec ·
  Errors · node-specific Logs. Today MIT emits only per-worker `ip/port/pid/busy/uptime` + machine-wide GPU/host, so
  the rest renders `<NoData>` on real data until MIT telemetry is extended per-node (**#279 follow-up**); the mock
  fills every field now so the UX can be drafted. (Real dev ≈ 1 worker; the fleet heatmap is aspirational.)
- **/service/mit (depth layer) — tabs, not one long scroll:** Pipeline (stage timing + per-stage logs + gateway
  diagnosis) · Telemetry (GPU/CPU/RAM/host history charts) · Queue (full translate-queue table) · Workers (lifecycle
  + per-node deep) · Logs · `mit@console`. Live wiring kept.
- **Frontend / Backend pages:** one `<NoDataPage message="Telemetry not wired — Frontend /status pending (#283)">`.

## 5. Motion & accessibility

- Motion conveys state only (150–250 ms, ease-out): stage activation/flow, value ticks, skeleton shimmer, expand.
  No page-load choreography. Every animation has a `prefers-reduced-motion` static fallback (the pipeline shows
  active state without flow).
- WCAG AA (both themes); status by shape + label (color-blind-safe); full keyboard reach for expand/collapse and
  the console; focus-visible rings on the accent-free neutral chrome.

## 6. Build order (I3–I6, against this spec)

I3 overview · I4 `/service/mit` (re-skin, keep live wiring) · I5 Frontend/Backend + shell/nav/feed · I6 delete the
old components + all mock consts. Each consumes I1 (`use-mit-live`, `panel-source`, `<NoData>`) and this token system.
