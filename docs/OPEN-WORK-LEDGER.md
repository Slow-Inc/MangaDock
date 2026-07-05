# Open Work Ledger — consolidated single source (2026-07-05)

> **Why this file exists:** open work was scattered across GitHub issues, RESUME-HERE,
> ADRs, PIPELINE §5, DONE.md, and one-off `*-plan.md` docs. Agents read issues but
> often miss the MD. This ledger consolidates **everything still open** — GitHub-tracked
> **and** MD-only — into one place, deduped, with a phased management plan.
> **Read this file at session start (it is linked from CLAUDE.md).** When you finish an
> item, update its row here AND its GitHub issue; when you discover new work, add a row
> here and (for anything non-trivial) file an issue so it does not vanish into MD again.

**Legend:** ✅ done, pending merge · 🟢 buildable now (no external gate) · 🟡 gated (needs user merge / GPU / decision) · 🔴 **UNTRACKED** (MD-only, no GitHub issue — highest miss-risk)

---

## The one keystone that unblocks the most: **Stage B branch reconciliation** 🔴🟡

Most render/translation-quality work is **code-complete on `landing/render-phase0`** (now backed up on origin) but **not on `main`/`perf`**. It cannot close until it is promoted. This is the single highest-leverage action.

- **Stage B** = merge `landing/render-phase0` → `perf/mit-layout-fit-and-merge`. Committed-vs-committed conflict is tiny (**1 file: `MIT/test/test_sfx_merge.py`**), but `perf` carries a **312-file uncommitted WIP** that needs the dev to commit or designate per-file authority first. Classifier hard-blocks agent self-merge to the default branch.
- **`mit-config.ts` `buildMitConfig` plumbing** (emits `selective_flux`/`protect_figures`/`restrict_fullpage_mask`/`adaptive_dilate` from `MIT_*` env) is **loose in the WIP, uncommitted** — must be committed and also landed on `landing` for Stage-B parity.
- **Stage C** = later `perf ↔ main` divergence (123 behind / 27 ahead).
- Refs: `RESUME-HERE.md` Queue #1/#5, `2026-07-05-phase3-convergence-plan.md`. **No GitHub issue exists for Stage B/C** → file one.

---

## Track 1 — Render / Translation Quality (Master Plan 2, epic #528)

| Item | Status | Gate | Next action |
|---|---|---|---|
| #421 selective-Flux (per-region) | 🟡 code-complete on landing, `MIT_SELECTIVE_FLUX=0` | Stage B + #459 | promote + pre-cache embedding, then enable |
| #459 prepare-models CLI | 🟡 built on branch | Stage B / land to main | verify idempotency/preflight ACs |
| #460 readiness gate | ✅ slice-1 (13 tests) on landing | Stage B + GPU | wire worker→tracker + `/ready` snapshot + gating at dispatch |
| #278 SFX provenance gate | 🟡 done on landing | Stage B | merge; MD warns `is_sfx` grep still 0 in prod path — confirm wired |
| #172 OCR rescue ladder | 🟡 partial (core on landing) | Stage B | wire split→OCR→rejoin + gate + per-page log + bench |
| #539 page-review erase/composite | 🟡 done on landing | Stage B | close after promotion |
| #540 boy-ghost CRF | 🟡 CRF half fixed, gated off | GPU + Stage B | **chibi/hair detection-FP half still open** (see 🔴 below) |
| #182 vertical text | 🟡 slice-1 predicates on worktree | GPU + wiring | wire render path + benchmark |
| #276 diverse-manga Flux E2E | 🟡 verify-before-close | GPU + source imgs | run E2E, then close-or-fold-into-#421 |
| #431 SFX oversize/overlap | 🟡 verify-before-close | GPU + Gal-Yome p4 | confirm overlap gone via #278/#169, then close-superseded |
| #437 Thai glyph fade at lobe | 🟢/🟡 not started | GPU to verify | synthetic-alpha test + force glyph interior alpha=255 |
| #420 translate non-determinism | 🟢 not scoped | — | pin temp0/greedy + deterministic sort + N-run test |
| #527 split-bubble clause | 🟢 not designed | — | design reading-order/adjacency grouping first |
| #174 flat-fill fast-path | 🟢 not started | — | confirm not redundant w/ flatten_white_captions, then build |
| **KP line-break wiring** | 🔴 module done, **prod OFF** (rolled back, narration bloat) | — | **#180 CLOSED** — step 2 (select behind `bubble_area_fit` + E2E + tune) undone |
| **#436 giant-bubble co-occupant** (occupancy=3) half | 🔴 only dedup half shipped | — | **#436 CLOSED** — co-occupant half unverified |
| **boy-ghost chibi detection-FP** | 🔴 mis-filed as "#49-class" (#49 = merged cache PR) | GPU | genuinely UNTRACKED; stroke-vs-art at prod threshold, non-deterministic |
| **class-B display-SFX p31** faint underline residual (minor) | 🔴 | — | `2026-07-05-page-review-defects.md` |
| **legacy non-bubble regions overflow** (no fit-to-box) | 🔴 | — | `DONE.md:244` |
| Epics/PRD hubs | 🟡 | children | #169 #178 #434 #535 close when children close |

---

## Track 2 — CI / Test Infrastructure

| Item | Status | Next action |
|---|---|---|
| #358 empty jest.ci skip-list | ✅ PR #541 (788 tests green) | **merge** |
| #503 reland resize_regions goldens | ✅ PR #541 (deterministic) | **merge** |
| #356/#357 CI dispatcher + gate | ✅ PR #361 (scrutinized: ship) | **merge**, then set `gate` as required check |
| stale `Backend/package-lock.json` (missing aws-sdk) | 🟢 known — CI uses `bun`/`bun.lock` (worked around) | optionally regen lockfile or drop it |

---

## Track 3 — Backend Correctness & Security (mostly 🔴 MD-only)

| Item | Status | Source |
|---|---|---|
| Payment/unlock correctness — FR-1 revert-claim atomicity, FR-2 price re-read in RPC | 🔴 PRD **Status: Draft**, 5 open questions | `backend-audit-remediation.md`, `2026-06-28-payment-unlock-correctness.md` |
| RLS backstop on `unlocks`/`wallet` + boot-assert `TURNSTILE_SECRET_KEY` + CI lint guard uid-scoped queries | 🔴 | ADR 013 |
| Webhook idempotency → **DB unique-constraint** (in-memory only today) | 🔴 | ADR 012 |
| Magic-byte upload-guard shared helper (DRY forum+upload) | 🔴 | ADR 016 |
| `write_translations` opens file w/o `encoding=` → `UnicodeEncodeError` on Windows cp1252 | 🔴 latent bug | mit-refactor-progress |
| `streaming.py stream()` awaits `messages.get()` w/o timeout → SSE hang if no terminal frame | 🔴 latent bug ("ยังไม่ filed") | DONE.md:922 |
| `readWithTimeout` never `clearTimeout`s race-loser timer (dangling timer) | 🔴 latent bug | ADR 017 |
| Backend hotfix backlog: chapter-list via apiCache (~11/min re-fetch), cache `readerAvailable`, dedup `storage.list`, R2 `.list` backoff+logging, per-manga `_chapters` namespace | 🔴 | impact-report:303 |
| L3 disk cap/TTL prune · unify 3 cross-page context windows · `models_ttl==0` eager-preload as runtime knob | 🔴 | ADR 011 / 010 / 009 |

---

## Track 4 — Translation Memory / Context (epic #155)

| Item | Status | Next action |
|---|---|---|
| #161 chapter-summary + auto-glossary generation | 🟢 storage exists (#160), **generation logic absent** (`chapter_summaries`=0 rows) | build gen on batch-complete + composer feed; /to-prd first (xhigh) |
| Ubiquitous-language glossary assembly (7-agent EN+TH output never assembled into `UBIQUITOUS_LANGUAGE.md`) | 🔴 | mit-refactor-progress |

---

## Track 5 — Frontend / Observability

| Item | Status | Next action |
|---|---|---|
| #304 dashboardv2 | 🟡 mock-mode ships vs "no-mock" PRD intent; I2–I6 never filed | decide: drop mock / file I2–I6 / close for dashboardv2-native issue |
| #281 translate-error classifier | 🟡 timeout wired (custom_openai); other terminal branches raw | wire RateLimitError/APIError/connection + integration test |
| History-export + Mermaid-rendering frontend plans | 🔴 unchecked checklists, no issue | confirm state; file if real |
| `useReaderZoom` / `useTranslationStream` / Turnstile extraction (entangled w/ continuous-scroll) | 🔴 **#302 CLOSED** — extraction leftover | refile if still wanted |

---

## Track 6 — Decomposition Tech-Debt (#187/#188)

| Item | Status | Source |
|---|---|---|
| BaseGPTTranslator base-abstraction half of #188 | 🔴 **#188 CLOSED** — "still open (xhigh)" leftover | mit-refactor-progress L87 |
| `load_dotenv()` import side-effect extraction | 🔴 **#192 CLOSED** — only parse seam taken | ADR 008, PIPELINE §230 |
| Priority debt: core decomposition #188→#187 (per team memory) | 🟢 | continue byte-identical/characterization-first |

---

## Track 7 — PRDs not yet turned into issues 🔴

- `interactive-flow-simulations.md` — marked "Ready for implementation", no issue.
- `r2-global-asset-distribution.md` — marked "Ready for implementation", no issue.
- Worker `/v1/translate` incompatible with current Backend flow — "Phase C, pending design decision" (ADR 021 deployment epic). `DONE.md:1487`.

---

## Management Plan — phased execution order

**Phase 0 — Unblock (user-gated, highest leverage).** Nothing large closes without these.
1. Merge **PR #541** (#358, #503) + **PR #361** (#356, #357); set `gate` as the required check.
2. **Stage B**: dev commits the 312-file WIP (or assigns per-file authority) → 3-way merge `landing → perf` (only `test_sfx_merge.py` conflicts) → this closes/promotes **#278 #421 #459 #460 #539 #540 #172** and lands the `mit-config.ts` plumbing.

**Phase 1 — Tracking hygiene (do immediately, cheap, removes MD blind spots).**
File GitHub issues for the 🔴 UNTRACKED items so agents stop missing them — priority order:
- Latent bugs (correctness): `write_translations` encoding · `streaming.py` SSE timeout · `readWithTimeout` dangling timer.
- Leftovers under closed issues: KP wiring (was #180) · #436 co-occupant half · #188 base-abstraction · #192 dotenv · boy-ghost chibi detection-FP.
- Security backstops (ADR 012/013/016).
- Stage B/C process epic.
- PRDs → issues: payment/unlock, interactive-flow-sim, r2-global-asset, history-export, mermaid.

**Phase 2 — Backend correctness & security** (Track 3). Payment/unlock first (money path), then security backstops, then latent-bug fixes. Each TDD + PR.

**Phase 3 — Render/translation quality** (Track 1). Needs the GPU worker + prod-faithful benchmarks (patches endpoint, PNG committed). Order: GPU-verify #431/#276/#437 → build #420/#527/#174 → Flux prod-enable (#459 pre-cache → #421 on) → #460 wiring.

**Phase 4 — Context/frontend** (Tracks 4/5). #161 (needs /to-prd), dashboard mock→real (#304), #281 classifier wiring.

**Phase 5 — Tech-debt & deferred PRDs** (Tracks 6/7). Core decomposition #187/#188 continuation; interactive-flow-sim / r2 PRDs when prioritized.

**Gating summary:** Phase 0 is the multiplier (unblocks ~10 issues). Phase 1 is cheap and makes the rest visible. Phases 2–5 are then independently schedulable; most render work (Phase 3) additionally needs the GPU worker up + manga source pages available.
