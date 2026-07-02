---
name: reference-external-docs-index
tags: ["moc", "reference"]
description: Catalog of knowledge-bearing MD files that live OUTSIDE the vault (docs/, reports, ADRs, PRDs, DONE/PIPELINE logs) — read these too; reconcile new ones into the vault so nothing is missed
metadata:
  type: reference
---

The vault holds one-fact memory notes, but a lot of durable knowledge lives in **external MD files** in the repo (design docs, benchmark reports, ADRs, PRDs, resume points, DONE/PIPELINE logs). Those are easy to miss because they aren't in the vault. This note is the **index of external MD sources to read**, plus the rule to keep it current.

**Rule:** when you create or find a knowledge-bearing MD outside the vault, add a line here (and, if it's a standing decision/resume-point/rule, also a proper vault note). Periodically reconcile: inventory repo `*.md`, diff against this list, fold the gaps in. Prevents the "benchmarked the wrong endpoint for a whole session" class of loss — see [[feedback-benchmark-patch-not-image-endpoint]] · [[feedback-md-update-every-change]].

> [!warning] WORKTREE-only docs (not on `main` yet — at risk of loss)
> The freshest render-campaign knowledge lives ONLY in the worktree `.claude/worktrees/feat-mit-font-s1/`:
> the entire `docs/reports/benchmarks/` folder, ADRs 023–027, `docs/prd/mit-render-defect-master-plan.md`,
> `docs/prd/PRD-en-source-wrap-parity.md`, `docs/research/en-source-wrap-parity-study.md`. **Land these on
> main (or a durable branch) before the worktree is discarded.**

## Canonical external docs (full catalog — reconciled 2026-07-02 via repo-wide inventory)

### ⭐ Resume points / controlling plans (read FIRST to continue work)
- `docs/prd/mit-render-defect-master-plan.md` *(worktree)* — render-defect campaign; execution log §7a–7f, learnings, next step. **§7e = benchmark-endpoint correction; §7f = confirmed One-Punch narration-oversize defect.**
- `docs/reports/benchmarks/2026-07-01-thai-layout-fixes-progress.md` *(worktree)* — Thai EN→TH render-fix "resume-here" work log
- `docs/reports/mit-refactor-progress.md` — MIT god-object decomposition (#187/#188) resume point → [[project-mit-refactor-resume]]

### 🏛️ ADRs — `docs/adr/` (was a total vault blind spot; check before changing a decided area)
- `docs/adr/README.md` — **ADR index; start here, fans out to all** (~27 records)
- 008 byte-identical decomposition method (binding for MIT-core changes) · 011 three-tier cache · 012 MIT integration security boundary (HMAC+HWID) · 013–017/021 authz/proxy/auth-context/magic-byte/batch/deploy
- MIT render/inpaint cluster: 003 flux inpainter · 004 patch pipeline · 005 cpu levers · 006 bubble detect · 007 render parity
- *(worktree)* **023–027** — bubble-area-fit / width-squeeze / clean-layout page-scale / SFX provenance gate / patch content-alpha (the active #175/#430/#436 render decisions)

### 📊 Benchmark reports — `docs/reports/benchmarks/` *(worktree-only folder)*
- `2026-07-02-patch-path-methodology.md` — patch-path vs image-endpoint correction (+ proof images) → [[feedback-benchmark-patch-not-image-endpoint]]
- `2026-07-02-clean-layout-both-axis-hotfix.md` — #430 Phase-3 overflow hotfix · `2026-06-30-clean-layout-page-scale.md` — format exemplar
- Full-chapter validation + per-fix evidence (caption-size, problem-pages-en-th, sfx-falsepos/rescue, overlap-content-alpha, thai-word-break) — evidence behind ADRs 023–027

### 📋 PRDs — `docs/prd/`
- *(worktree)* `PRD-en-source-wrap-parity.md` — source-agnostic wrap parity (EN→x == JP→x); **unpublished (gh 401) — would be lost**
- `backend-audit-remediation.md` — backend audit remediation (2026-06-28)

### 🔬 Research — `docs/research/`
- `mit-core-decomposition-analysis.md` — #187/#188 landmine map (companion to ADR 008)
- `mit-vs-upstream-quality-divergence.md` + `inpaint-cleanliness-vs-upstream.md` — where/why MIT lowered quality vs zyddnys upstream
- `translator-deep-dissection.md` / `mangatranslator-internals.md` / `-round2-deep.md` / `-study.md` — reference translator dissection → [[project-render-parity-direction]]
- `mit-hidden-capabilities.md` — undocumented MIT capabilities (font-weight system etc.) · `render-parity-port-plan.md` · `translation-northstar.md` · *(worktree)* `en-source-wrap-parity-study.md` (#435)

### 🧱 MIT core docs (read before touching MIT)
- `MIT/ARCHITECTURE.md` — map of the ~46k-LOC MIT codebase · `MIT/CONTRACT.md` — MIT↔Backend wire contract (broke twice) · `MIT/SETUP.md` runbook → [[project-mit-launch-env]] · `MIT/BENCHMARK.md` reference-page protocol · `MIT/PIPELINE.md` §5 change log

### 📐 Standards / glossary / context (binding)
- `Skills.md` — T4-STANDARD backend engineering standard · `UBIQUITOUS_LANGUAGE.md` — canonical term glossary (bold = verbatim) · `CONTEXT.md` — system context · `Roadmap.md` — V5 master roadmap

### 📕 Reports / learnings / ops
- `docs/reports/system-impact-report.md` — full-field change log + tech-debt register → [[feedback-impact-report]]
- `docs/reports/bug-case-catalog.md` — symptom→root→fix→lesson war-stories (durable learnings)
- `docs/reports/mit-presentation-defense.md` + `mit-benchmark-and-quality.md` — thesis/viva material
- `docs/deploy/backend-vps.md` — VPS/Docker deploy runbook · `docs/coin-topup-xendit.md` — Xendit PromptPay top-up design
- `docs/agents/{issue-tracker,triage-labels,domain,workflow}.md` — repo agent conventions
- `DONE.md` (root + MIT) — change history → [[feedback-md-history-log]]

### 🚫 Excluded (ephemeral / superseded — do NOT index)
- 17 root Playwright a11y dumps (`dd2 dd3 ee g3 gg m2 m3 mm modal-* r3 rc2 reader-* res2 rr telemetry-snapshot.md`), `Todo.md` (living), superseded ADR 002-luminance-reground, point-in-time branch reviews, realized `docs/superpowers/plans/*`.
