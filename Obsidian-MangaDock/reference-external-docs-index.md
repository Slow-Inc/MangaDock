---
name: reference-external-docs-index
tags: ["moc", "reference"]
description: Catalog of knowledge-bearing MD files that live OUTSIDE the vault (docs/, reports, ADRs, PRDs, DONE/PIPELINE logs) — read these too; reconcile new ones into the vault so nothing is missed
metadata:
  type: reference
---

The vault holds one-fact memory notes, but a lot of durable knowledge lives in **external MD files** in the repo (design docs, benchmark reports, ADRs, PRDs, resume points, DONE/PIPELINE logs). Those are easy to miss because they aren't in the vault. This note is the **index of external MD sources to read**, plus the rule to keep it current.

**Rule:** when you create or find a knowledge-bearing MD outside the vault, add a line here (and, if it's a standing decision/resume-point/rule, also a proper vault note). Periodically reconcile: inventory repo `*.md`, diff against this list, fold the gaps in. Prevents the "benchmarked the wrong endpoint for a whole session" class of loss — see [[feedback-benchmark-patch-not-image-endpoint]] · [[feedback-md-update-every-change]].

## Canonical external docs (read when relevant)

### Resume points / status (read FIRST to continue work)
- `docs/reports/mit-refactor-progress.md` — MIT god-object decomposition (#187/#188) single resume point → [[project-mit-refactor-resume]]
- `docs/prd/mit-render-defect-master-plan.md` — MIT render-defect campaign: execution log §7a–7e, learnings, next step (patch-path inventory). **§7e = benchmark methodology correction.**

### Benchmark reports (`docs/reports/benchmarks/`)
- `2026-07-02-patch-path-methodology.md` — Thai under-fill was an image-endpoint artifact; patch path fills correctly (+ proof images)
- `2026-07-02-clean-layout-both-axis-hotfix.md` — #430 Phase-3 One-Punch overflow hotfix
- `2026-06-30-clean-layout-page-scale.md` — first benchmark-report exemplar (format reference)

### Impact reports / ADRs / PRDs
- `docs/reports/system-impact-report.md` — full-field change log + MIT tech-debt register → [[feedback-impact-report]]
- `docs/adr/` — architecture decision records (~20); check before changing a decided area
- `docs/prd/` — product requirement docs (bilingual EN+TH)
- `docs/agents/` — issue-tracker / triage-labels / domain docs (from /setup-matt-pocock-skills)

### Per-service logs
- `DONE.md` (root + MIT) — change history log → [[feedback-md-history-log]]
- `MIT/PIPELINE.md` — MIT pipeline §5 change log for render/pipeline work
- `CONTEXT.md` — domain glossary (single-context)

> [!todo] Reconcile in progress (2026-07-02)
> An inventory of ALL repo `*.md` vs this list is running. Fill in any durable gaps it finds (research notes under `docs/research/`, additional benchmark/ADR files, spec docs) so the catalog is complete.
