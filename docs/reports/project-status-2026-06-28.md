# Project Status & Next Steps — snapshot 2026-06-28

> Resume/handoff note (per the team's "update MD every change + Resume-here" convention). Captures the
> assessment, remaining work, the thesis-book assembly plan, and pending engineering from the 2026-06-28
> session so a future session (human or agent) continues without re-deriving. **Not merged to main yet —
> to be merged next round with the next feature.**

---

## 1. What was done this session (2026-06-28)

- **CI gates landed** — first CI in the repo. PR **#355** merged (`backend-ci`/`frontend-ci`/`mit-ci` + `Backend/jest.ci.config.js`); backend 62 suites/616 tests green on Node 22. TDD: fixed `books-health.spec.ts` (skip-list 9→8). ADR 020.
- **CI dispatcher** — PR **#361** (open, verified green): consolidated one `CI` workflow + `dorny/paths-filter` dispatcher + a single `gate` job for safe required-checks; folds in #357 (pin bun, empty-files guard). Closes #356/#357.
- **Docs** — PR **#360** (open): ADR 020 + DONE + impact-report + README CI section. PR **#362** merged: ADR 021 + 3 presentation reports.
- **Deployment decision** — **ADR 021** (ephemeral on-demand 2-tier; near-zero marginal cost; deferred until validated).
- **Presentation reports created** (on main via #362): `positioning-differentiation-legal.md`, `bug-case-catalog.md`, `mit-presentation-defense.md`.
- **Node 22 installed** locally (nvm-windows) — Jest 30 can't run on Node 26.

## 2. Pending engineering close-out (do next)

- [ ] **Merge PR #360** (docs-CI) — auto-merge was blocked (self-PR); needs human merge.
- [ ] **Merge PR #361** (dispatcher) — verified green; human merge.
- [ ] **Branch protection** on `main` → mark **`gate`** as the single required check (only after #361 merges, else path-filtered checks deadlock — that's the whole point of #356).
- [ ] **#358** — shrink the backend jest skip-list (8 pre-existing-failing suites; TDD one at a time; books-batch-* blocked by #143).
- [ ] **#359** — lazy-import torch in `manga_translator/__init__` → make `mit-ci` a blocking gate (drop `continue-on-error`).

## 3. Project assessment snapshot

| Dimension | Value |
|---|---|
| LOC (authored) | ~111k (FE 31k · BE 23k · MIT 45k · Dashboard 12k) |
| Commits | 348 (xeno ~85%, akkanop-x 70+19, Cable 19, AI agents) |
| Timeline | 2026-03-08 → ongoing (~3.7 mo); June burst ~264 commits |
| Issues | 200 closed (100% completed) / **43 open** / 82% close rate |
| PRs | 66 merged (~87%) / 10 closed / 2 open |
| Tests | 176 files (BE 70 · MIT 88 · FE 18) |
| Docs | 155 project MD · ~205k words · 21 ADR · 7 SE phase docs |
| Team | xeno (ป.4 MC KMUTNB, tech-lead) · Akkanop (ป.3 IT BU, autonomous mid-level) · Cable (ป.4 IT, Mobile, part-time) — pro work-experience ≈ 0 yr; output is top ~1-2% undergrad |

**Maturity:** Code/Arch/Process ⭐⭐⭐⭐⭐ · Security/Perf ⭐⭐⭐⭐ · Observability/Scale ⭐⭐⭐ · **Deployment ⭐⭐ (deliberately deferred, ADR 021)**.
**Phases:** 0–1.5 ✅ · Phase 2 partial (cache ✅ R2 ✅ payment=sandbox, GPU-cloud deploy ❌) · 3–5 not started.

## 4. Remaining work (prioritised)

**A. Engineering close-out** (this week) — §2 above.
**B. MIT quality** (advisor will scrutinise — 18 open MIT issues): render parity #178 (SFX/narration-box), context #140/#155/#159/#160/#161, **+ translation-accuracy benchmark on OpenMantra/Manga109 (the #1 viva gap)**.
**C. Phase 2 finish**: payment sandbox→prod (Xendit approval has lead time); GPU-cloud deploy setup.
**D. Deployment (ADR 021)**: alpha deploy term 1 (ephemeral, de-risk) → push-button script/IaC + demo-day reliability (pre-warm GPU, fallback LLM, cached demo) → prod deploy term 2 after final system test.
**E. Phase 3–5** (mobile/native/retention): **defer** — don't scope-creep for the academic deadline.
**F. Documentation / thesis book** — §5.

**Risks:** (1) scope creep into Phase 3–5; (2) skipping the translation benchmark; (3) bus factor (xeno 85%).
**Academic window:** term 1 = main systems + chapters 2/3 (advisor); term 2 = deploy + present. Core is done → **on track** if focused.

## 5. Thesis-book (เล่ม) assembly plan

- **Size:** ~150–250 pages. Body text needed ≈ 40–70k words; the rest is diagrams/tables/screenshots.
- **Source material:** ~205k words of project MD = **3–5× surplus** → the task is **selection + condensation + academic-rewrite**, NOT generating content.
- **Chapter → source mapping:**
  - บท1 บทนำ ← PRODUCT.md, positioning report, Roadmap *(rewrite cohesively)*
  - บท2 ทฤษฎี+งานเกี่ยวข้อง ← **positioning-differentiation-legal.md** (research/Mantra/Orange/legal), CONTEXT.md, reference docs *(near-ready)*
  - บท3 วิเคราะห์+ออกแบบ (largest) ← SE_PHASE2 (SRS), **UML_REPORT**, SYSTEM_ARCHITECTURE, **21 ADR**, MIT ARCHITECTURE/PIPELINE
  - บท4 พัฒนา+ทดสอบ ← SE_PHASE4/5, **bug-case-catalog.md**, DONE.md, system-impact-report, 176 tests *(gap: real UAT results + screenshots)*
  - บท5 สรุป+ข้อเสนอแนะ ← **mit-presentation-defense.md** (limitations), Roadmap (future) *(rewrite)*
  - ภาคผนวก ← README, SETUP, **ADR 021**, CONTRACT
- **EXCLUDE from the book:** scratch root MDs (dd2/dd3/ee/gg/m2/mm/r3/rc2…), `.claude/memory/`, `CLAUDE.md`. DONE.md only excerpted, not pasted whole.
- **Real new-writing gaps:** UAT execution results (PHASE5 is template), screenshots/UI walkthrough, cohesive intro + conclusion, abstract/TOC/references.
- **Next artifact (optional):** a per-subsection content-mapping sheet so the book is copy-assemble.

## 6. Reference index of this session's deliverables
- `docs/adr/020-ci-test-gates.md` (in #360) · `docs/adr/021-deployment-and-cost-architecture.md` (on main)
- `docs/reports/positioning-differentiation-legal.md` · `bug-case-catalog.md` · `mit-presentation-defense.md` (on main)
- `Documents/Software Engineer/UML_REPORT.md` §6.1 (target 2-tier deployment diagram)
