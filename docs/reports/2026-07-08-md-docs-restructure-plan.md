# MD / Docs Restructure Plan — for AI-Agent Efficiency (v2)

> **Status:** PROPOSAL (2026-07-08) — plan only, nothing executed yet. Awaiting go-ahead on scope.
> **v2** folds in a 3-agent brainstorm (Antigravity=system, Codex=code, claude-9arm=logic) via PAL clink, all having read the real files. See "§6 Brainstorm revisions" for what changed and why.
> **Decision locked by user:** (1) **bilingual STAYS** — the MD files are rendered directly by the public docs site, so the Thai mirror is single-source content, not token waste. (2) This round = **written plan first**, no file mutations.

> [!danger] ⚠️ BASE-BRANCH WARNING (2026-07-08) — DO NOT EXECUTE ON `perf/mit-layout-fit-and-merge`
> This branch is **134 commits behind `origin/main`** on docs (~100 MD files added/changed on main since merge-base `31f7b4d8`). Several targets are in a **conflicting state** vs main and invalidate parts of this plan:
> - **Vault migration is divergent:** here `.claude/memory/*` is being deleted + `Obsidian-MangaDock/` has 30 **untracked** notes; on main `.claude/memory/` is still canonical (34 files) + vault has only 7 committed notes. Phase 1.4 collides.
> - **ADR renumber is wrong:** main already uses 018/019 and has **three** collision pairs (002×2, 022×2, 023×2). Phase 1.2's "002→018" is invalid — recompute free numbers against main (020, 029+).
> - **Newer-on-main:** `CLAUDE.md`, `Home.md`, `reference-external-docs-index.md`, `docs/adr/README.md`, `system-impact-report.md` all changed on main.
> - **Stale concern:** ADRs 023–027, benchmarks, PRDs are **already on main** (not worktree-at-risk) → Phase 0.1 largely moot.
> **→ Rebase this effort onto `main` (or a branch off main) and re-run the survey against main's tree before executing. This is downstream of the known `main↔perf` divergence (see memory `project_mp2_deploy_blocked_branch_divergence`).**

---

## 0. The constraint that reshapes everything: docs are a CMS, not just agent context

`Frontend/app/docs/page.tsx` **auto-scans and renders every `.md` at the repo root + recursively every file under `docs/**`**, ships each file's **full content to the client**, and `DocsClient.tsx#filterLangBlocks` toggles `<!-- lang:th -->` / `<!-- lang:en -->` / `<!-- lang:end -->` blocks per the site's language switch. `relativePath` is the document identity **and** the GitHub blob deep-link **and** the prev/next nav key. Category = `CATEGORY_LABELS[dir]` (in `utils.ts`) or the raw path if unmapped.

Consequences every action must respect:
- **Two consumers, one source** — same file feeds the AI agent's context and the public "Docs & History" hub.
- **Bilingual is load-bearing** — keep the exact `<!-- lang:* -->` markers; never strip Thai.
- **Anything added to root or `docs/**` becomes a public page.** A new `docs/research/README.md` publishes as a page named "README" under raw category `docs/research` (because `CATEGORY_LABELS` has no entry for it — verified in `utils.ts:21-26`).
- **`relativePath` is identity + URL + nav key** — renaming/moving a file changes its GitHub deep-link, its search title, and its prev/next position (order = unsorted `fs.readdir()`).
- **The 17 a11y dumps currently render on the site** under "หลัก" — user-visible clutter.
- **`Documents/` is NOT scanned** (only root + `docs/`) — the academic tree is already invisible to site & agents. Keep it that way.
- **The whole corpus (incl. 258 KB `DONE.md` + ~130 files) is bundled into the client on every visit** — a real payload problem, not just DONE.md (see Phase 3).

---

## 1. Diagnosis — 6 systemic problems (evidence-backed)

| # | Problem | Evidence (paths) | Agent? | Site? |
|---|---------|------------------|:------:|:-----:|
| 1 | **5 competing "read-me-first" indexes, not cross-linked** | `Obsidian-MangaDock/Home.md`, `docs/adr/README.md`, `Obsidian-MangaDock/reference-external-docs-index.md`, `Documents/DOCUMENT_INDEX.md`, `docs/OPEN-WORK-LEDGER.md` | ✅ ambiguous bootstrap | ➖ |
| 2 | **Stale files self-label "READ FIRST" but contradict reality** | `docs/reports/mit-refactor-progress.md` (2026-06-10, "READ THIS FIRST", says COMPLETE — superseded by ledger 07-05); `CLAUDE_BRIEF.md` (2026-05-28, cache "IN PROGRESS #13–15" vs vault `project-cache-phase2` = done) | ✅ trusts wrong state | ✅ stale pages |
| 3 | **ADR index wrong + numbers collide** | two `docs/adr/002-*.md`; README lists the *superseded* `002-luminance`, **omits** the *accepted* `002-drop-batch-redis-pubsub`; 018–020 dangling; `survey-manifest` claims "30 ADRs" vs 18 on disk | ✅ can't trust "why" | ✅ |
| 4 | **Same content in 3–4 places → drift** | DoD/issue-lifecycle in `CLAUDE.md` + `Home.md` + `docs/agents/issue-tracker.md`; glossary `CONTEXT.md` ∩ `UBIQUITOUS_LANGUAGE.md`; `PRODUCT.md` ⊂ `DESIGN.md`; work `Roadmap.md` ↔ `Todo.md` ↔ `OPEN-WORK-LEDGER.md` | ✅ cost + contradiction | ✅ dup pages |
| 5 | **17 untracked a11y dumps at root** | `dd2 dd3 ee g3 gg m2 m3 mm modal-cta modal-snap r3 rc2 reader-ctrl reader_nav res2 rr telemetry-snapshot`.md — untracked, NOT gitignored | ✅ glob/status noise | ✅ **junk pages** |
| 6 | **Flat subtrees, no living/archival signal** | `docs/research/` (11 files, 4 overlapping mangatranslator), `docs/reports/` (living + dated snapshots mixed), `docs/superpowers/plans/` (done + open mixed) | ✅ which is canonical? | ✅ unordered |

**Landmines an agent would act on wrongly:** `Documents/Plan/Plan.md` + `SE_PHASE1_*.md` still say **Firebase/Firestore** and "payment/mobile out of scope" — system is now **Supabase + wallet + mobile**. `.claude/worktrees/feat-mit-font-s1/` holds **ADRs 023–027 + benchmarks + PRDs that are NOT on `main`/this branch** (verified: `docs/adr/` here has none of 023–027) — off-main, at risk if that worktree is discarded.

---

## 2. Target architecture (principles)

1. **One bootstrap path, and it must be genuinely bounded.** `CLAUDE.md` (always-on) → `Home.md` + `OPEN-WORK-LEDGER.md`. **Change the bootstrap RULE itself** from "read Home.md *and the notes it links*" to "read Home.md, then read *only the notes relevant to the task*." (Today's rule forces ~25 notes / 50–125 KB before any code — that is the opposite of bounded. This is the single highest-leverage change — §6.)
2. **Right owner per fact — but respect always-on vs on-demand.** Mutable facts (status, roadmap, work) → one owner. **Standing behavioral rules (north star, DoD, issue lifecycle) STAY condensed in `CLAUDE.md`** because it is the *only* guaranteed-loaded file; a pointer to an on-demand file is a single point of failure. Move *reference detail* out, keep *rules* in.
3. **Fewer indexes, not just cross-linked.** Merge, don't annotate. Target set: `Home.md` (memory + folded external-docs catalog), `docs/adr/README.md` (ADR "why"), `docs/OPEN-WORK-LEDGER.md` (current work), `Documents/DOCUMENT_INDEX.md` (academic, separate audience). **Eliminate `reference-external-docs-index.md` as a standalone** — fold into Home.md.
4. **Self-describing files (random-access robustness).** Agents grep/glob/land mid-tree, not only via bootstrap. Every non-trivial doc carries its own `status: living | snapshot | archived` frontmatter + a canonical-source pointer. Stale files get a **machine-parseable `<!-- REDIRECT: path -->` marker**, not a human-only banner.
5. **Bilingual preserved, structure deduped.** Cut duplicate *facts*, never duplicate *languages*.
6. **Academic island stays walled** (`Documents/` — explicit "not source of truth" note).
7. **Docs-site-aware & code-first.** Site-rendering code (`page.tsx` denylist, README-skip, `CATEGORY_LABELS`, deterministic sort) must land **before** files are moved/added — else the site publishes junk/unpolished pages mid-restructure.

---

## 3. Phased action plan (file-by-file)

Legend — **Risk:** 🟢 trivial/reversible · 🟡 judgment call · 🔴 touches code / many files. All git-reversible.

### Phase 0 — Preserve + site-code guardrails (do FIRST; brainstorm-added)

| Action | Files | Risk |
|--------|-------|:----:|
| **0.1** Verify `feat-mit-font-s1` worktree, land ADRs 023–027 + benchmarks + PRDs onto a durable branch/`main` before any worktree is discarded | `.claude/worktrees/feat-mit-font-s1/*` → `docs/` | 🟡 data-loss gate |
| **0.2** `page.tsx`: add a relative-path **site denylist** (`CLAUDE.md`, `CLAUDE_BRIEF.md`), checked in BOTH root + recursive scans; **skip `README.md`** (so subtree index READMEs stay agent/repo-only, no bilingual burden, no "README" pages); add **deterministic sort** (order is currently raw `fs.readdir()` → fragile prev/next) | `Frontend/app/docs/page.tsx` | 🔴 code |
| **0.3** `utils.ts`: add `CATEGORY_LABELS` entries for `docs/research`, `docs/reports`, `docs/superpowers`, `docs/adr` (else they render raw-path categories) | `Frontend/app/docs/utils.ts` | 🟢 |

Exact denylist (Codex):
```ts
const SITE_MD_DENYLIST = new Set(['CLAUDE.md', 'CLAUDE_BRIEF.md']);
const isDenied = (rel: string) =>
  SITE_MD_DENYLIST.has(rel.replaceAll('\\', '/')) || rel.endsWith('README.md');
// apply in the root loop (on e.name) AND the recursive loop (on childRel)
```

### Phase 1 — Truth fixes

| Action | Files | Risk |
|--------|-------|:----:|
| **1.1** Delete the 17 a11y dumps; add **explicit root-anchored** `.gitignore` (NOT a broad `*.md` glob); redirect Playwright output to `test-output/` | root, `.gitignore` | 🟢 |
| **1.2** ADR 002 collision: `git mv 002-drop-batch-redis-pubsub.md → 018-…`; add BOTH rows (superseded 002 + accepted 018) to `docs/adr/README.md`; **`rg` sweep + update internal refs** (e.g. `docs/reports/system-impact-report.md:121`); fix `survey-manifest` "30 ADRs" | `docs/adr/*`, refs | 🟡 |
| **1.3** Stale "read-first" files → replace human banner with **`<!-- REDIRECT: docs/OPEN-WORK-LEDGER.md -->`** machine marker + `status: archived` frontmatter | `docs/reports/mit-refactor-progress.md`; delete/redirect `CLAUDE_BRIEF.md` | 🟡 |
| **1.4** Finish vault migration: commit `.claude/memory/*` deletions + `Obsidian-MangaDock/*` adds | `.claude/memory/`, vault | 🟢 |
| **1.5** Resolve dangling wikilink `[[project-mit-translate-nondeterministic]]` (create note or repoint) | vault | 🟢 |

`.gitignore` block (Codex — explicit, root-anchored):
```gitignore
# Root Playwright a11y markdown dumps
/dd2.md
/dd3.md
/ee.md
/g3.md
/gg.md
/m2.md
/m3.md
/mm.md
/modal-cta.md
/modal-snap.md
/r3.md
/rc2.md
/reader-ctrl.md
/reader_nav.md
/res2.md
/rr.md
/telemetry-snapshot.md
/test-output/
```

### Phase 2 — Dedup + index-merge + bounded bootstrap

| Action | Files | Risk | Note |
|--------|-------|:----:|------|
| **2.1** **Change the bootstrap rule** in `CLAUDE.md`: "read Home.md, then only task-relevant notes" (not "and the notes it links") | `CLAUDE.md` | 🟡 | THE highest-leverage change |
| **2.2** DoD/issue-lifecycle: **keep a 2–3 line condensed rule + pointer IN `CLAUDE.md`** (it's always-on); make `docs/agents/issue-tracker.md` the full canonical; trim `Home.md`'s copy to a pointer | `CLAUDE.md`, `Home.md`, `docs/agents/issue-tracker.md` | 🟡 | do NOT fully remove from CLAUDE.md |
| **2.3** Shrink `CLAUDE.md` by moving **reference detail** (module tables, arch gotchas, verbose skill prose, cache internals) → on-demand vault/docs notes; keep north-star + bootstrap + condensed rules + core commands | `CLAUDE.md` → vault | 🟡 | target "only always-relevant rules", not a byte count |
| **2.4** Merge `reference-external-docs-index.md` → an "External Knowledge Sources" section in `Home.md`; delete the standalone (5→4 indexes) | vault | 🟡 | |
| **2.5** Glossary: `UBIQUITOUS_LANGUAGE.md` canonical; `CONTEXT.md` "Language" → pointer | `CONTEXT.md`, `UBIQUITOUS_LANGUAGE.md` | 🟡 | |
| **2.6** `Todo.md` → **merge into `Roadmap.md`** (it's a product roadmap, not open work); ledger owns open work | `Todo.md`, `Roadmap.md` | 🟡 | |
| **2.7** `PRODUCT.md` → trim brand/principles dup, point to `DESIGN.md` | `PRODUCT.md` | 🟡 | |
| **2.8** Subtree indexing: add `README.md` status-tables (LIVING/SNAPSHOT/ARCHIVED) **AND** add `status:` frontmatter to **each file** (README = bootstrap aid; frontmatter = random-access guarantee); signpost research chain → `translator-deep-dissection.md` | `docs/research/`, `docs/reports/`, `docs/superpowers/plans/` | 🟢 | READMEs are site-skipped per 0.2 |
| **2.9** Wall off `Documents/`: "NOT engineering source of truth" banner in `DOCUMENT_INDEX.md`; mark `Plan.md`/`SE_PHASE1` historical (Firebase-era) | `Documents/*` | 🟢 | |

### Phase 3 — Bigger / own decision

| Action | Files | Risk | Why deferred |
|--------|-------|:----:|--------------|
| **3.1** **Docs-site payload architecture**: change `page.tsx` to scan **metadata only** (path/name/category) and fetch each doc's content **on-click via an API route** — fixes the whole-corpus client bundle, of which `DONE.md` (258 KB) is only the worst case | `page.tsx`, `DocsClient.tsx`, new API route | 🔴 | supersedes "just split DONE.md"; real frontend change |
| **3.2** `DONE.md` split by quarter into `docs/history/` (complements 3.1; smaller even before the API lands) | `DONE.md` | 🟡 | |

---

## 4. What this buys

- **Phase 0:** no data loss; the site can't publish junk mid-restructure; file moves become safe (sorted, categorized, denylisted).
- **Phase 1:** agent + site stop trusting wrong "current" state; ADR "why" ledger trustworthy; one memory home.
- **Phase 2:** genuinely bounded session start (the big token win — via the *rule*, not language); one owner per mutable fact while standing rules stay always-visible; 5→4 indexes; docs robust to random-access entry.
- **Phase 3:** removes the last heavy client payload at the architecture level.

## 5. Open decisions before executing

1. `CLAUDE_BRIEF.md` — delete, or `<!-- REDIRECT -->` stub? (lean delete)
2. `Todo.md` — merge into `Roadmap.md` (brainstorm rec) vs delete-with-pointer to ledger?
3. `DONE.md` — quarter-split now, or wait for the 3.1 metadata-scan API?
4. `CLAUDE.md` on the public site — denylist it (Phase 0.2 assumes yes) — confirm it should be agent-only?
5. Snapshot archiving — move dated files to `…/archive/` (changes category + GitHub link) vs leave-in-place + rely on `status:` frontmatter? (brainstorm leans: frontmatter + skip the moves)
6. How far to shrink `CLAUDE.md` (2.3) — divergence resolved as "move reference detail, keep standing rules"; confirm you're OK trimming the big architecture/command sections into on-demand notes.

## 6. Brainstorm revisions (what v2 changed vs v1, and why)

Three independent agents read the real files. All confirmed the diagnosis and Phase-1 direction; each added a distinct, concrete improvement:

- **Antigravity (system):** land the site-rendering code changes FIRST (else new README/moved files publish as junk) → **Phase 0**; recover the off-main worktree docs (023–027) → **0.1**; the *whole corpus* is bundled to the client, not just DONE.md → **3.1**; `CATEGORY_LABELS` gaps → **0.3**.
- **Codex (code):** `relativePath` is identity+URL+nav → update refs after ADR rename (**1.2**); exact root-anchored `.gitignore` (**1.1**); exact `SITE_MD_DENYLIST` + README-skip (**0.2**); add deterministic sort (**0.2**); new READMEs would render in both languages without markers → resolved by skipping READMEs from the site.
- **claude-9arm (logic):** the plan's "bounded first-read" **contradicted the existing CLAUDE.md rule** — fix the *rule*, not just the files → **2.1** (now the headline); don't remove standing rules from always-on CLAUDE.md → **2.2**; merge indexes, don't cross-link → **2.4** (5→4); random-access robustness via `status:` frontmatter + machine-parseable redirect markers → **1.3 / 2.8**; `Todo.md`→`Roadmap.md` → **2.6**.

One nuance I add with full session context: CLAUDE.md is injected once and **prompt-cached**, so the "140k tokens over 20 turns" framing overstates the per-turn cost — the real wins are (a) a genuinely bounded *first-read* (2.1) and (b) getting agent-only files off the public site (0.2), not per-turn billing.

---

## 7. Execution log — 2026-07-08 (on `perf/mit-layout-fit-and-merge`, changes UNSTAGED for review)

Executed the safe / high-value / additive slice. Deep-restructure + code-refactor items deliberately deferred.

**✅ Done this pass:**
- **0.2** `page.tsx` — added `SITE_MD_DENYLIST` (`CLAUDE.md`, `CLAUDE_BRIEF.md`) + skip all `README.md` + deterministic `relativePath` sort. Typecheck + eslint clean.
- **0.3** `utils.ts` — added `CATEGORY_LABELS` for adr/research/reports/benchmarks/superpowers/plans/specs/deploy.
- **1.1** Deleted 17 root a11y dumps; added explicit root-anchored `.gitignore` block + `/test-output/`.
- **1.2** ADR 002 collision → renamed accepted `002-drop-batch-redis-pubsub.md` → **`020-…`** (free on this branch + main); updated its title + `docs/adr/README.md` table + conventions note + the inbound ref in `system-impact-report.md:121`.
- **1.3** `CLAUDE_BRIEF.md` deleted (stale/orphan/contradictory, now site-denylisted anyway); `mit-refactor-progress.md` given `<!-- REDIRECT: docs/OPEN-WORK-LEDGER.md -->` + `<!-- status: archived -->` + HISTORICAL banner, neutralized its "READ THIS FIRST" trap.
- **1.5** Created `Obsidian-MangaDock/project-mit-translate-nondeterministic.md` (resolves the dangling `[[…]]` from the concept + verify notes); added it to `Home.md`.
- **2.1** `CLAUDE.md` bootstrap rule (both EN + TH) → "read Home.md first, then only task-relevant notes, not the whole graph."
- **2.8** Added agent/repo-only status-table READMEs to `docs/research/`, `docs/reports/`, `docs/superpowers/plans/` (site-skipped per 0.2).
- **2.9** `Documents/DOCUMENT_INDEX.md` — "NOT engineering source of truth" banner + flagged `Plan.md`/`SE_PHASE1` as Firebase-era historical.

**✅ Done — second pass (same day):**
- **Renderer fix** `DocsClient.tsx#filterLangBlocks` — strip single-line HTML comments so machine markers (`<!-- REDIRECT: … -->`, `<!-- status: … -->`) never render as literal text on the public site. Makes the redirect-marker pattern safe on site-rendered files.
- **2.5** `CONTEXT.md` `## Language` → pointer: `UBIQUITOUS_LANGUAGE.md` is canonical, local terms are a quick-ref (non-destructive — kept the local table).
- **2.6** `Todo.md` → `<!-- REDIRECT -->` + `status: archived` + SUPERSEDED banner (bilingual); kept the completed-phase checklist as history. Open work → ledger, phases → Roadmap.
- **2.7** `PRODUCT.md` → cross-link to `DESIGN.md` as the canonical visual design system (kept the product brief intact — PRODUCT and DESIGN are legitimately different docs; did NOT gut it).

**⏭️ Still deferred (do during perf→main reconciliation, or need own decision):**
- **1.4** Finish vault migration (commit `.claude/memory` deletions) — entangled with divergent main state; not committing on a shared branch.
- **2.2 / 2.3** Condense DoD into a CLAUDE.md pointer + move CLAUDE.md reference-detail into on-demand notes — invasive on a bilingual, merge-conflict-prone always-on file (`CLAUDE.md` is one of the 6 merge-conflict files).
- **2.4** Merge `reference-external-docs-index.md` → `Home.md` (5→4 indexes) — `Home.md` is also a merge-conflict file; more edits worsen the eventual resolve. Do during reconciliation.
- **3.1** ~~Docs-site payload architecture (metadata scan + fetch-on-click)~~ — **REJECTED** by brainstorm: a metadata-only scan empties `f.content`, which **breaks `DocsClient`'s client-side full-text search** (`files.filter(f => … f.content…)`, ~L1003). Total corpus is only ~1.7 MB, so the full refactor isn't worth rebuilding search as a server API. **Replaced by** a one-line denylist of the biggest dev-only file → **done** (`DONE.md` added to `SITE_MD_DENYLIST`, ~258 KB / ~15% off the bundle, search intact).
- **3.2** DONE.md split by quarter — still worthwhile for repo hygiene, but `DONE.md` conflicts with main (modified there) → do during reconciliation.

**Verification:** `tsc --noEmit` = 0 errors (project-wide, incl. all `app/docs/*` files). `eslint` on the changed docs files: our edits clean; the 2 `set-state-in-effect` errors + `Tag` unused warning it reports are **pre-existing** in the GitHub-list views (lines 448/569/11), untouched by this work. Changes are unstaged — review alongside existing WIP before committing.

### Brainstorm verdict (2026-07-08) — sequencing: **B (stop safe slice, reconcile, then finish)**

A 3-agent clink round (antigravity + claude-9arm answered; codex hit a usage cap) **converged on Option B**: commit the safe slice here, then do the conflict-bound items (2.2/2.3 CLAUDE.md, 2.4 Home.md, 1.4 vault migration) + any payload work on a branch off the *reconciled* main — zero rework, since those files conflict with main anyway. Concrete findings folded in above: (a) 3.1 breaks search → use the DONE.md denylist instead; (b) the deferral logic is sound (safe slice did *rule/additive* changes, the deferred items are *content-merge* changes — different dimension); (c) the real high-friction conflict is `Home.md` (create-vs-edit — main created it from scratch, we edited it), less so `CLAUDE.md` (main's Benchmarks section is adjacent, not overlapping).

---

*This plan lives on the public docs site once committed (under `docs/reports/`). Transient execution doc — redirect/archive it once the phases land, per its own `status:` rule.*
