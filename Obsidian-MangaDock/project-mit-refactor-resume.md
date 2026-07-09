---
name: project-mit-refactor-resume
tags: ["project"]
description: The MIT god-object decomposition (#187/#188) is tracked in docs/reports/mit-refactor-progress.md — the single resume point. Read it first to continue without re-exploring.
metadata:
  type: project
---

The MIT tech-debt decomposition is a long, multi-seam effort. To resume without re-analyzing, **read `docs/reports/mit-refactor-progress.md` first** — it is the single entry point: the S1–S26 seam status table (done / next / blocked), the landmines to preserve, the tech-debt issue status, and the read-order for the deep map.

Canonical artifacts (committed; S1–S12 on `main`, later seams on the `refactor/mit-seam-s17…` stack):
- `docs/research/mit-core-decomposition-analysis.md` — 26 seams, interfaces, per-seam test strategy, 16 source-cited landmines, safe order (from a 6-agent deep read).
- `docs/reports/tech-debt-remediation-plan.md` — roadmap + 2026-06-09 reconciliation (seam-based, interleaved; #188 starts early at S3, not Phase-C-last).
- `docs/research/translator-deep-dissection.md`, `render-parity-port-plan.md` — MangaTranslator reference + render-parity gaps.

Method (enforced): characterization net first → byte-identical extraction → ship + report per seam (one commit each). **Landmines (TTL key drift L1, divergent min_ratio 0.5/0.3 + threshold 6/>10 L6, singleton page-context bleed L9, exit(-1) L2) are PRESERVED during extraction and fixed only later behind an opt-in flag.** Pairs with [[feedback-core-boundary]], [[feedback-techdebt-all-scenarios]], [[feedback-impact-report]].

Progress: the progress-doc header holds the live high-water mark (kept current per seam) — trust it over any number pinned here. As of 2026-06-10: **S1–S12 on `main`; S13/S16/S17/S18/S19/S20/S21 on the refactor stack** (S17/S21/S18 E2E-validated via the production tunnel, byte-identical). A pre-existing `sys.modules` test-pollution bug was fixed so the full suite is a reliable 18 async-only baseline. **Next = S14 VerboseDebugSink (unblocked by S18), then S15 / S22–S26 + S12 value-object (🔒#192).** New S18 finding worth preserving: the four post-translation "copies" are NOT a clean dedup — the three phase-2 retry loops are structurally divergent + load-bearing (L6/L8), so they were *relocated* into `post_translation.py` as per-scope params, NOT unified.
