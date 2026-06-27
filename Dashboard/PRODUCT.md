# Product

## Register

product

## Users

The MangaDock developer (and later moderator/admin staff) monitoring the MIT translation pipeline and system health. Context: often opened *during an incident* — on the dev's local machine or a separate host — when something in the pipeline broke and they need to know what, and where, fast. It is the window into the box when production can't be inspected directly, and it must keep working when the Frontend/Backend are down.

## Product Purpose

A standalone, out-of-band monitoring dashboard for the MIT pipeline (PRD #279, ADR 018). It shows the translation pipeline as a live workflow — each stage's status (detection → OCR → inpaint → translate → render), the gateway diagnosis (the 9arm model-down case), GPU/host telemetry as charts, and a live activity/log feed. Any stage can be expanded inline for detail and live logs. Success: an incident is diagnosable at a glance, and the dashboard runs locally even when the rest of the stack is down.

## Brand Personality

A restrained, expressive monitoring console: **Speck + PremiumBuss + Arcana, fused** (see `DESIGN.md`). Three words: **precise, calm, premium**. A warm monotone canvas where color is reserved for status and data — coral signature/alert (Speck), lime drench + punch-card heatmap + oversized numbers (PremiumBuss), mono ring/arc gauges + inverted card + light theme (Arcana). Nothing decorative, every element load-bearing, the trust Linear/Vercel/Stripe earn — through this three-reference fusion, not a generic template. (Earlier framings "flight-deck / anti-SaaS" then "shadcn/ui" were both superseded; `precise/calm/premium` + signal-over-noise carry forward.) **Canonical rebuild → [`dashboardv2/`](../dashboardv2/PRODUCT.md).**

## Anti-references

- Consumer **marketing-page** tropes inside the product (oversized hero, gradient text, glassmorphism-as-default). The SaaS aesthetic is the *product-UI* one (shadcn/Linear/Vercel), not the landing-page one.
- Generic admin templates (AdminLTE / Bootstrap dashboards, sidebar-plus-identical-cards with no identity).
- Cluttered Grafana (panels stacked with no hierarchy — noise without signal).
- Color as decoration. In this console color is a signal (status, data); chrome stays neutral.

## Design Principles

- **Glanceable truth.** The one question that matters during an incident — is the pipeline healthy, and where is it stuck — is readable in one second, before any detail.
- **Mission-control calm.** Dense telemetry stays legible through hierarchy and restraint, not by hiding data. Signal over noise.
- **Progressive depth.** Overview first; click any pipeline stage to expand inline into detail and live logs. Never a modal for what a panel can do.
- **Motion conveys state.** Animation shows the pipeline actually working — the active stage, data flowing, a stalled stage — and nothing decorative.
- **Survives the storm.** It is the thing you open when everything else is down, so it stays standalone, local-runnable, and degrades gracefully (a dead service reads "down", it does not crash the view).

## Accessibility & Inclusion

WCAG AA: body text ≥4.5:1 on the dark surface, large text ≥3:1. Status is conveyed by shape/label as well as color (color-blind safe — not green/amber/red alone). Every animation, including the pipeline flow, has a `prefers-reduced-motion` alternative (state shown statically). Full keyboard reach for the expand/collapse affordances.
