# Product

## Register

product

## Users

The MangaDock developer (and later moderator/admin staff) monitoring the MIT translation pipeline and system health. Context: often opened *during an incident* — on the dev's local machine or a separate host — when something in the pipeline broke and they need to know what, and where, fast. It is the window into the box when production can't be inspected directly, and it must keep working when the Frontend/Backend are down.

## Product Purpose

A standalone, out-of-band monitoring dashboard for the MIT pipeline (PRD #279, ADR 016). It shows the translation pipeline as a live workflow — each stage's status (detection → OCR → inpaint → translate → render), the gateway diagnosis (the 9arm model-down case), GPU/host telemetry as charts, and a live activity/log feed. Any stage can be expanded inline for detail and live logs. Success: an incident is diagnosable at a glance, and the dashboard runs locally even when the rest of the stack is down.

## Brand Personality

Mission-control precision with Apple restraint. Three words: **precise, calm, premium**. A NASA/SpaceX flight console rendered with Apple's clarity and deference — confident and technical, never loud. The interface earns trust the way Linear and a flight deck do: nothing decorative, every element load-bearing.

## Anti-references

- Consumer-SaaS marketing pages (oversized hero, gradient text, glassmorphism-as-default, the big-number template).
- Generic admin templates (AdminLTE / Bootstrap dashboards, sidebar-plus-identical-cards with no identity).
- Cluttered Grafana (panels stacked with no hierarchy — noise without signal).

## Design Principles

- **Glanceable truth.** The one question that matters during an incident — is the pipeline healthy, and where is it stuck — is readable in one second, before any detail.
- **Mission-control calm.** Dense telemetry stays legible through hierarchy and restraint, not by hiding data. Signal over noise.
- **Progressive depth.** Overview first; click any pipeline stage to expand inline into detail and live logs. Never a modal for what a panel can do.
- **Motion conveys state.** Animation shows the pipeline actually working — the active stage, data flowing, a stalled stage — and nothing decorative.
- **Survives the storm.** It is the thing you open when everything else is down, so it stays standalone, local-runnable, and degrades gracefully (a dead service reads "down", it does not crash the view).

## Accessibility & Inclusion

WCAG AA: body text ≥4.5:1 on the dark surface, large text ≥3:1. Status is conveyed by shape/label as well as color (color-blind safe — not green/amber/red alone). Every animation, including the pipeline flow, has a `prefers-reduced-motion` alternative (state shown statically). Full keyboard reach for the expand/collapse affordances.
