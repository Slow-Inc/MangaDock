# Product — MIT Staff Console (dashboardv2)

> Canonical product brief for the dashboard rebuild (`dashboardv2`). The original `Dashboard/PRODUCT.md` carries the
> same purpose; this corrects the design-language naming and reflects the clean rebuild. See `DESIGN.md`.

## Register

product

## Users

The MangaDock developer (and later moderator/admin staff) monitoring the MIT translation pipeline and system health.
Context: often opened *during an incident* — on the dev's local machine or a separate host — when something in the
pipeline broke and they need to know what, and where, fast. It is the window into the box when production can't be
inspected directly, and it must keep working when the Frontend/Backend are down.

## Product Purpose

A standalone, out-of-band monitoring dashboard for the MIT pipeline (PRD #279, ADR 018). It shows the translation
pipeline as a live workflow — each stage's status (detection → OCR → translate → inpaint → render), the gateway
diagnosis (the 9arm model-down case), GPU/host telemetry as charts, the node fleet, traffic/streams, and a live
activity/log feed. Per-node depth opens in a popup (logs + console included). Success: an incident is diagnosable at
a glance, and the dashboard runs locally even when the rest of the stack is down.

## Brand Personality

A restrained, expressive monitoring console: **Speck + PremiumBuss + Arcana, fused** (see `DESIGN.md`). Three words:
**precise, calm, premium**. A warm monotone canvas where colour is reserved for status and data — coral as the one
signature/alert hue (Speck), lime drench + punch-card heatmap + oversized numbers for hero data (PremiumBuss), mono
ring/arc gauges + one inverted card + a first-class light theme (Arcana). Nothing decorative, every element
load-bearing — the trust that Linear / Vercel / Stripe earn, expressed through this specific three-reference fusion
rather than a generic SaaS template.

## Anti-references

- Consumer **marketing-page** tropes inside the product (oversized hero, gradient text, glassmorphism-as-default).
- Generic admin templates (AdminLTE / Bootstrap, sidebar-plus-identical-cards with no identity).
- Cluttered Grafana (panels stacked with no hierarchy — noise without signal).
- Colour as decoration. Here colour is a signal (status, data); chrome stays neutral.
- Mislabelling the direction as "shadcn" or "Finesse UI" — the actual system is Speck + PremiumBuss + Arcana.

## Design Principles

- **Glanceable truth.** The one question during an incident — is the pipeline healthy, and where is it stuck — is
  readable in one second, before any detail.
- **Mission-control calm.** Dense telemetry stays legible through hierarchy and restraint, not by hiding data.
- **Progressive depth.** Overview first (anomaly-at-a-glance); drill a node → popup (its logs/console/metrics); the
  MIT view holds the system-wide pipeline/telemetry depth. Never a modal for what a panel can do.
- **Two modes, one render path.** Mock mode drafts every UX state behind `NEXT_PUBLIC_MOCKUP_MODE`; realtime mode
  shows live MIT data or a designed No Data — the same components render both, so mock→real never strands a panel.
- **Survives the storm.** Opened when everything else is down: standalone, local-runnable, degrades gracefully (a
  dead service reads "down" / "No Data", it does not crash the view).

## Accessibility & Inclusion

WCAG AA: body text ≥4.5:1 on the dark surface, large text ≥3:1. Status is conveyed by shape/label as well as colour
(colour-blind safe). Every animation has a `prefers-reduced-motion` alternative. Full keyboard reach for view/tab
switching and the node popup.
