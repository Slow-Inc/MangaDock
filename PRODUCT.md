# Product

## Register

product

## Users

Engineering team building MangaDock — developers who need to understand the system architecture, trace data flows, and onboard quickly. They work with the codebase daily; the Docs surface is a tool they return to, not a place they browse once.

Secondary surface: the main manga app serves readers who browse, read, and engage with manga content.

## Product Purpose

MangaDock is a manga reading and ML-powered translation platform. It consists of three services (Next.js frontend, NestJS backend, Python GPU inference) and a Docs portal that documents the system through interactive flow simulations, tech stack references, and live GitHub integration.

The Docs portal succeeds when a new team member can trace a request from the browser through every service without asking anyone — and when an existing member can answer "why does X work this way?" in under a minute.

## Brand Personality

Technical and precise — no fluff, no hand-waving. The system is shown as it actually works.

Premium and refined — every surface shows intentional craft; Apple-grade attention to detail on the product side.

Open and transparent — the Docs portal is a first-class product, not an afterthought. Show the work.

On the Docs surface specifically: professional and docs-first. A serious engineering team makes serious documentation.

## Anti-references

**Corporate docs** (Confluence, GitBook) — boring gray, no hierarchy, no personality. The system is interesting; the docs should match.

**Bleeding-edge experimental** (brutalist, WebGL-heavy, illegible) — style over substance. Readable and functional wins.

**Generic SaaS dashboards** — cream backgrounds, rounded metric-card grids, hollow personality. Especially for the Docs portal.

## Design Principles

1. **Show, don't describe** — interactive simulations over prose wherever possible. The system demonstrates itself.
2. **Precision reads as trust** — tight spacing, aligned grids, and exact tokens signal that the team knows what it's doing. Sloppiness in the docs implies sloppiness in the code.
3. **Progressive depth** — short labels at a glance, technical detail one click deeper. Never show everything at once.
4. **Two surfaces, one product** — the dark manga app and the white Docs portal are different registers for different moods; they share a quality bar, not a color palette.
5. **Performance is part of the design** — animations that jank, transitions that block, or layouts that shift undermine the premium claim immediately.

## Accessibility & Inclusion

WCAG AA minimum. Thai and English bilingual throughout — both languages receive equal visual treatment. Reduced-motion respects `prefers-reduced-motion`. Focus indicators via global `:focus-visible` ring (globals.css).
