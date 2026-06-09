---
name: project-mit-refactor-resume
description: The MIT god-object decomposition (#187/#188) is tracked in docs/reports/mit-refactor-progress.md — the single resume point. Read it first to continue without re-exploring.
metadata:
  type: project
---

The MIT tech-debt decomposition is a long, multi-seam effort. To resume without re-analyzing, **read `docs/reports/mit-refactor-progress.md` first** — it is the single entry point: the S1–S26 seam status table (done / next / blocked), the landmines to preserve, the tech-debt issue status, and the read-order for the deep map.

Canonical artifacts (all committed on `feat/context-aware-translation`):
- `docs/research/mit-core-decomposition-analysis.md` — 26 seams, interfaces, per-seam test strategy, 16 source-cited landmines, safe order (from a 6-agent deep read).
- `docs/reports/tech-debt-remediation-plan.md` — roadmap + 2026-06-09 reconciliation (seam-based, interleaved; #188 starts early at S3, not Phase-C-last).
- `docs/research/translator-deep-dissection.md`, `render-parity-port-plan.md` — MangaTranslator reference + render-parity gaps.

Method (enforced): characterization net first → byte-identical extraction → ship + report per seam (one commit each). **Landmines (TTL key drift L1, divergent min_ratio 0.5/0.3 + threshold 6/>10 L6, singleton page-context bleed L9, exit(-1) L2) are PRESERVED during extraction and fixed only later behind an opt-in flag.** Pairs with [[feedback-core-boundary]], [[feedback-techdebt-all-scenarios]], [[feedback-impact-report]].

Progress as of 2026-06-09: #192a/b done; S1 (region filter) done; punctuation + validators + #186 `_greedy_pack` done (they are S-seams). **Next: S2 (apply_translations), then S3 (ModelUsageTracker, #188 start).**
