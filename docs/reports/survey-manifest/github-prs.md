# GitHub PR Survey — Slow-Inc/MangaDock

Source: `gh pr list --repo Slow-Inc/MangaDock --state merged` on 2026-07-04.
Scope: full PR **bodies** (not just titles/commit messages), read via `gh pr view --json title,body,mergedAt,additions,deletions,files`.

## Top-level table

| Metric | Value |
|---|---|
| Total merged PRs | **116** |
| PRs read in full for this survey | 20 (selected by size + decomposition/security/ADR/master-plan signal) |

**5 largest merged PRs by lines changed (additions + deletions):**

| Rank | PR | Lines changed | +/- | Title |
|---|---|---|---|---|
| 1 | #194 | 21,215 | +17,442/-3,773 | feat: render parity (MangaTranslator) + SFX + MIT god-object decomposition (tech-debt) |
| 2 | #414 | 18,084 | +17,919/-165 | feat(dashboard): Dashboard V2 + MIT layout-fit sync + Community/Studio UI fixes |
| 3 | #220 | 14,538 | +122/-14,416 | refactor(MIT): remove vendored SD/LDM inpainter + ctd/YOLOv5 detector (#191, -14.4k LOC) |
| 4 | #8 | 8,655 | +7,464/-1,191 | feat(forum): high-performance real-time community hub with SSE & LRU cache |
| 5 | #286 | 6,811 | +4,365/-2,446 | Backend: security hardening (PRD #223) + books.service god-file decomposition (PRD #228) |

Note: `files` counts for PRs #194, #414, #433 are capped at **100** by the `gh`/GitHub API default page limit — actual file counts for those three are likely higher than shown.

---

### PR #194: feat: render parity (MangaTranslator) + SFX + MIT god-object decomposition (tech-debt)
- **merged_at:** 2026-06-09T07:13:47Z
- **size:** +17442/-3773, 100 files (API-capped; top dirs: Frontend/app 54, Backend/src 22, .claude/memory 14)
- **read_date:** 2026-07-04
- **findings:** Confirms all render-parity knobs (`MIT_EN_UPPERCASE`, `MIT_EN_FONT`, `MIT_FONT_MAX_BOX_RATIO`, `MIT_SFX_DETECTOR`, #166/#170/#175/#176/#179/#181/#183) shipped as one bundle, opt-in and byte-identical when unset — a single PR is the origin point for most render-parity knobs cited individually elsewhere. Names the god-object decomposition source doc explicitly: `docs/research/mit-core-decomposition-analysis.md` = "26 seams, 16 source-cited landmines" — the seam count (26) and landmine count (16) as first stated. Test counts at this point: MIT 78 pure-module + Backend 66 (useful as an early baseline vs. later PRs' higher counts, showing test-suite growth over time). Body explicitly states "Nothing is merged — this is for team review" language pattern used repeatedly across PRs (self-review workflow before Copilot/human sign-off).

### PR #414: feat(dashboard): Dashboard V2 + MIT layout-fit sync + Community/Studio UI fixes
- **merged_at:** 2026-07-02T23:37:56Z
- **size:** +17919/-165, 100 files (API-capped; almost entirely new — Dashboard/components 40, Dashboard/lib 34)
- **read_date:** 2026-07-04
- **findings:** New substance: this PR is a 3-way merge of independently-reviewed sub-PRs (#501 MIT layout-fit sync, #497 Community+Studio UI fixes) each already `/scrutinize`-reviewed and squash-merged before landing here — shows the team's pattern of landing large surface area via pre-vetted sub-PRs rather than one big review. Confirms the dashboard's `/api/service-status` aggregator endpoint is deliberately **unauthenticated** (`GET /status` has no `@UseGuards`) with error-string clamping as the compensating control — a concrete security design decision not visible from commit messages alone.

### PR #220: refactor(MIT): remove vendored SD/LDM inpainter + ctd/YOLOv5 detector (#191, -14.4k LOC)
- **merged_at:** 2026-06-11T06:05:26Z
- **size:** +122/-14416, 67 files (MIT/manga_translator 59)
- **read_date:** 2026-07-04
- **findings:** Genuinely new substance: explicit roadmap-alignment justification — the reference repo `MangaTranslator` uses Flux (`diffusers>=0.37`) + ultralytics YOLOv8/v11/v12, so the deleted CompVis-LDM + GPL-licensed YOLOv5 vendored code was already obsolete relative to where the project was heading, making the deletion "roadmap-aligned, not a capability loss." States the removal eliminated **one GPL dependency** entirely from the codebase (compliance-relevant fact not otherwise documented). Precise breakdown: SD/LDM inpainter ~11.7k LOC, ctd/YOLOv5 ~2.3k LOC (GPL). Validated as production byte-identical: Backend only ever sent `lama_large`/default+dbnet — sd/ctd paths were dead code with zero production callers.

### PR #8: feat(forum): high-performance real-time community hub with SSE & LRU cache
- **merged_at:** 2026-05-27T01:47:50Z
- **size:** +7464/-1191, 95 files (Frontend/app 37, Backend/src 29)
- **read_date:** 2026-07-04
- **findings:** This is the **origin PR** for several security fixes usually cited as later/standalone work: TOCTOU wallet fix (`addCoins`/`spendCoins` → atomic `add_coins_atomic`/`spend_coins_atomic` RPCs), MIME-spoofing fix (`file-type` magic-byte validation replacing client `Content-Type`), and XSS sanitization of `imageUrls` against `javascript:` URIs — all landed as "Round 3 fixes (manual review)" in the very first community-forum PR, not a later hardening pass. Documents a concrete "unlock ordering" fix: the unlock row is now inserted **before** `processRevenueSplit`, with rollback on payment failure, so a buyer can never pay without getting access — a specific correctness invariant not stated elsewhere. Shows the 3-round review process explicitly: Round 1/2 = Copilot-found fixes, Round 3 = manual security review — an artifact of the multi-reviewer workflow.

### PR #286: Backend: security hardening (PRD #223) + books.service god-file decomposition (PRD #228)
- **merged_at:** 2026-06-14T13:11:32Z
- **size:** +4365/-2446, 45 files (Backend/src 38)
- **read_date:** 2026-07-04
- **findings:** Concrete before/after metric not in the terser commit history: `books.service.ts` **1834 → 376 lines (−79%)**, now a thin facade with zero controller/call-site changes. Test evidence with a real "before the safety net existed" baseline: full backend suite went from **192 pass / 16 fail → 530 pass / 0 fail** — the 16 pre-existing failures are the same ones documented in team memory (`project_backend_pre_existing_test_failures.md`), confirming this PR is where the characterization net was built that made those failures visible/fixable. Six sequential extraction PRs (#229–#234) are itemized with what each did (`mit-config.ts`, `MitClient` boundary, `MitTranslationService`, `MitBatchOrchestrator` with dead Redis pub/sub removal per ADR-002, `GeminiModelCatalog`/`MangaCatalogService`/`LandingService` split) — the method line ("characterization-first, byte-identical extraction, 1 seam = 1 commit, build whole backend per seam") is the same playbook later reused verbatim in #313, #195, #203.

### PR #6: Translator profile feature
- **merged_at:** 2026-03-18T08:27:58Z
- **size:** +5694/-446, 43 files (Frontend/app 23, Backend/src 14)
- **read_date:** 2026-07-04
- **findings:** Empty PR body — no narrative substance beyond the title and file list. Given the date (2026-03-18) and file footprint, this appears to be an early, undocumented iteration on the translator-profile feature that PR #3 (below) later formalizes with a full writeup; treat #3 as the citable source for this feature area.

### PR #112: fix(MIT): batch translation reliability, cancel correctness, security hardening + per-request Gemini model
- **merged_at:** 2026-06-05T16:33:27Z
- **size:** +4979/-526, 72 files (MIT/manga_translator 13, MIT/test 12, Backend/src 11, MIT/server 9)
- **read_date:** 2026-07-04
- **findings:** This is the **origin PR** for the "0/20 + Cloudflare 524" incident narrative (batch translation total failure due to timeout) — 28 commits, each scoped to one issue, all independently live-verified on 2026-06-05 through the production tunnel. Concrete live-e2e timing data not found elsewhere: cancel at page 5/18 → re-translate → **5 cached pages replayed in 1.5s** → MIT continues pages 6,7 → cancel toast shown correctly for both cancel events. Documents an explicit ADR-level design decision (#129): cancellation stays **page-granular by design** because of a "forrtl-200 crash class" on the single MIT worker — a named failure mode not otherwise documented. Test suite growth: MIT unit suite **25 → 69 passing**. Confirms #108's GPT few-shot lookup simplification (dropping `langcodes` dependency) — the exact example already cited verbatim in this repo's own CLAUDE.md North Star section — originates in this PR.

### PR #203: refactor(MIT): god-object decomposition tail — S13→S26 (#187 / #188)
- **merged_at:** 2026-06-10T12:50:24Z
- **size:** +3788/-1091, 45 files (MIT/test 21, MIT/manga_translator 15)
- **read_date:** 2026-07-04
- **findings:** Concrete driver-file shrink metric: `manga_translator.py` **3040 → 1934 lines (−36%)** at this point in the decomposition (a different snapshot than the final "3040→2235, −26.5%" figure in team memory — this PR is a mid-point, not the end state). Pixel-exact E2E validation is documented with actual dimensions: a real chapter page's two patches measured **649×1492 + 451×1489 pixel-identical** to the pre-refactor baseline, proving the S13–S26 seam extraction was truly byte-identical in production, not just in unit tests. Lists 13 named seams (S13, S14, S15, S16, S17, S18, S19, S20, S21, S23, S24, S25, S26) each mapped to a specific extracted module — more granular than the summary table in `mit-refactor-progress.md`. Notes a test-pollution bug fixed in passing: `test_precision`/`test_qwen3_translator` weren't restoring `sys.modules` after stubbing, which had been masking 8 failures in the "clean" baseline.

### PR #433: feat(MIT): #175 S1 — pure font-sizing primitives (processing_scale + two-tier bounds)
- **merged_at:** 2026-07-03T02:45:29Z
- **size:** +4714/-86, 100 files (API-capped; docs/reports 38, MIT/manga_translator 18, MIT/test 15, docs/adr 6 — bulk of the diff is accumulated docs/reports, not this feature)
- **read_date:** 2026-07-04
- **findings:** Small but citable new substance: exact source-line references into the MangaTranslator reference clone used to verify formulas — `processing_scale(h,w) = sqrt(megapixels)` clamped to `[0.5, 4.0]` matches MT `pipeline.py:694`; `font_bounds()` dialogue `[8,16]` / display `[10,64]` bounds match MT `config.py:102-103,147-148`. This is the first of a new S1/S2/S3 "Master Plan 2" font-sizing refactor sequence (distinct from the earlier #187/#188 god-object seams), explicitly a "prefactor slice" — primitives added but unused until S2/S3, so render stays byte-identical.

### PR #3: feat: Translator Upload System and Translator Profile
- **merged_at:** 2026-03-15T23:13:33Z
- **size:** +3923/-87, 20 files (Backend/src 11, Frontend/app 5)
- **read_date:** 2026-07-04
- **findings:** Genuinely new: the earliest substantive feature PR in the repo's history, and it reveals the **original backend was Firestore/Firebase**, not Supabase — `firebase.json`, `firestore.indexes.json` present, chapter-version FSM (`draft → pending_moderation → published → rejected → draft`) implemented as Firestore CRUD. This confirms the Supabase migration (PR #4, "Convent Database to Supabase," merged one day later on 2026-03-16) was a full backend swap, not an incremental adoption — useful context for a thesis section on architectural pivots. Also documents the original Copilot-coding-agent prompt verbatim (Thai: "เราต้องทำอะไรเพิ่มบ้าง... เพิ่มระบบ Upload, ระบบ Translator Profile ดีไหม"), showing the project began via GitHub Copilot coding agent before the team's current Claude Code workflow.

### PR #7: v1.1: System Optimization & Infrastructure Readiness
- **merged_at:** 2026-05-22T22:18:18Z
- **size:** +1933/-1199, 62 files (Frontend/app 30, Backend/src 20)
- **read_date:** 2026-07-04
- **findings:** Introduces the term **"T4-STANDARD"** ("Pillar 6" = structured JSON logging for all API requests/responses) as an internal engineering-standard label not seen in later PRs or current docs — likely an earlier/retired naming convention worth noting if the thesis discusses how engineering standards evolved. Frames this PR as laying groundwork "required for Phase 2 and Cloudflare integration" — ties the Storage Adapter Pattern (later realized as R2 support in PR #185/#222) and the async MIT webhook pipeline (later hardened in #112) back to a single planning point.

### PR #277: feat(MIT): Flux Klein optional inpainter + multilingual SFX/line-break parity + ADR audit
- **merged_at:** 2026-06-14T08:01:22Z
- **size:** +2897/-44, 44 files (docs/adr 15, MIT/manga_translator 10, MIT/test 7)
- **read_date:** 2026-07-04
- **findings:** Richest single PR body found (18-section change-record template). New concrete numbers: Flux Klein-4B GGUF-Q4 inpainter opt-in costs **~3-4s/page vs LaMa's <1s**, with steady-state VRAM peak of **5.8 GB** (leaving 7 GB headroom on a 12 GB card) via cached prompt-embedding + load/unload — more precise than the "5-7/12GB" range in team memory. Documents the actual mechanism of the multilingual SFX bug being fixed: the SFX rescue path was previously nested inside a filter gated on `source_lang == target_lang` coincidentally matching English, so TH/ZH/KO targets kept the raw misread Japanese glyph (ぬ) instead of a localized SFX — after the fix, rendered as 噗(ZH)/นุ(TH)/누(KO)/NYAA-style(EN). Contains an explicit "Lessons Learned" section: classical CPU inpaint levers (mask_tighten, seamless_clone, etc.) "looked plausible but were measured ineffective" — measure, don't eyeball. Also states vertical CJK orientation was deliberately deferred because the production per-region patch-render path (not the full-page path) drops most text and needs a renderer rework — a scoping decision not documented elsewhere.

### PR #315: feat(wallet): SSE payment confirmation + webhook HMAC — replace polling
- **merged_at:** 2026-06-19T13:52:14Z
- **size:** +2809/-88, 22 files (Backend/src 10, Frontend/app 4)
- **read_date:** 2026-07-04
- **findings:** Root cause documented precisely: the Xendit webhook literally could not reach `localhost` in the dev environment, so `coin_topups.status` stayed stuck at `pending` forever and the 3-second polling loop never observed a state change — this is the actual reason SSE replaced polling (not just a performance choice). Lays out a clean 6-layer security table (SSE auth via JWT, SSE ownership check, SSE auto-close on expiry, webhook HMAC, atomic double-credit claim gate, emit-ordering-after-addCoins) as a single reusable reference for how wallet security is layered.

### PR #341: feat(wallet): webhook hardening, atomic unlock, topup pages — full security pass
- **merged_at:** 2026-06-26T22:46:46Z
- **size:** +2024/-605, 38 files (Frontend/app 20, Backend/src 15)
- **read_date:** 2026-07-04
- **findings:** New concrete vulnerability disclosure: all 4 wallet `SECURITY DEFINER` Postgres functions (`add_coins_atomic` ×2, `spend_coins_atomic`, `purchase_unlock_atomic`) were **callable directly by `anon`/`authenticated` roles via PostgREST**, bypassing the NestJS service layer entirely — fixed by an explicit `REVOKE EXECUTE` migration (`revoke_wallet_rpc_public_execute`). Documents a specific failure-recovery invariant: if `addCoins` throws after the webhook claims a topup as processing, the code now reverts the claim to `'pending'` so Xendit's own retry mechanism can eventually complete the credit — the "let the upstream retry, don't lose the money" pattern. Includes an explicit ordered deploy runbook (backup DB → apply staged SQL → set two env vars → confirm one env var unset → deploy) for going live safely.

### PR #532: feat(MIT): MP2 Phase-0 — eval harness (#526) + P2 cache-safety (#524) + P5 verify
- **merged_at:** 2026-07-04T02:31:24Z
- **size:** +2341/-18, 40 files (docs/reports 16, MIT/_render_dump 5, MIT/eval 4)
- **read_date:** 2026-07-04
- **findings:** Documents a real cross-page cache-poisoning bug **found by Codex** (a different AI model than the one doing the implementation) during Master Plan 2 review: the batch orchestrator pre-checks cache and sends only *uncached* pages to MIT, but MIT's `RollingContext` only learns from pages it translates in that same loop — so a batch with page 0 cached + page 1 uncached would translate page 1 with an **empty prior-context window**, then cache that degraded translation under the context-**on** cache key, silently poisoning future re-reads. Fix: when rolling context is enabled and the batch isn't fully cached, send the *entire ordered chapter* so context is always complete. This is a concrete example of the multi-agent review workflow (Claude implements, Codex catches a subtle bug) catching something a single-model review might have missed.

### PR #313: refactor(Backend): split mit-batch-orchestrator.service.ts (1010 LOC) — transport/stream vs job-state (#294)
- **merged_at:** 2026-06-18T11:58:16Z
- **size:** +1662/-550, 19 files (Backend/src 12, Frontend/app 3)
- **read_date:** 2026-07-04
- **findings:** Concrete metric: `mit-batch-orchestrator.service.ts` **1010 → 557 LOC**, and the books test suite grew **214 → 244** (0 fail) alongside a whole-backend **595/0**. Documents a genuinely useful characterization-testing detail: a **12-case characterization net** (clean/multi-chunk/carry/keep-alive/malformed/non-numeric-pageIndex/stream-error/dead-worker-guard/stream-drop-retry/submit-throws/202-async/idempotency) was written first, against the *pre-split* code, then proven to stay green identically through every extraction commit — a fully worked example of "characterization-first" in practice with the actual test names. Explicitly leaves one known bug unaddressed by design: `readWithTimeout`'s race-loser timer isn't cleaned up, flagged in ADR 017 as a deliberate behind-a-flag follow-up rather than an oversight.

### PR #16: feat(cache): Multi-Tier Cache Architecture — Phase 2 L1/L2/L3 + Write-behind
- **merged_at:** 2026-05-28T02:05:17Z
- **size:** +1994/-166, 30 files (Backend/src 18)
- **read_date:** 2026-07-04
- **findings:** Contains the clearest available ASCII diagram of the full L1(in-memory)/L2(Redis)/L3(disk)/Supabase truth hierarchy and the write-behind flow (`set()` → L1 → L2 → markDirty → periodic L3BatchWriter + Leader-only BatchSyncWorker via RPOPLPUSH), useful directly as a thesis diagram source. Names a concrete pre-existing bug this PR fixed: `JsonCacheService.set()` used to call `writeToDisk()` on **every single L1 write**, and because L1 updates are realtime/frequent, this caused "massive disk I/O overflow" — the fix moved all L3 writes to periodic batch writers only. Documents per-type flush cadence: wallet every 2s, stats every 5s, default every 60s — a concrete tuning decision. States this is Phase 2a+2b only; Phase 2c (Supabase write-behind, cross-node L1 sync via pub/sub) is explicitly scaffolded but not yet built — dates this PR precisely within the larger cache-hardening arc (Phase 2.1–2.5 already known via team memory).

### PR #463: feat(wallet): wallet security hardening V1–V9
- **merged_at:** 2026-07-01T23:53:34Z
- **size:** +1937/-135, 12 files (Backend/src 4, Frontend/app 3)
- **read_date:** 2026-07-04
- **findings:** Unusually transparent PR: the body includes the **/scrutinize review findings verbatim**, showing 3 blockers caught and fixed before merge — (1) a duplicate `TopupThrottleGuard` import causing a TypeScript compile error, (2) 4 unit tests mocking a `maybeSingle` pre-SELECT call path that no longer existed after a rebase (stale mocks), (3) the SQL migration file itself defining `purchase_unlock_atomic` with the **old 6-arg, caller-trusted-price signature** while the actual TypeScript call site already used the new 4-arg self-contained RPC — applying the migration as originally written would have created a mismatched Postgres function overload in production. This is a rare concrete artifact of "long-lived branch + rebase" drift being caught by review, and a good example for a thesis section on the value of the /scrutinize gate. Lessons-learned section states explicitly: "CREATE OR REPLACE FUNCTION with different arg lists creates an overload, not a replacement" — a specific Postgres footgun.

### PR #195: refactor(MIT): god-object decomposition seams S2–S11 (#187 / #188)
- **merged_at:** 2026-06-09T09:35:22Z
- **size:** +1500/-375, 24 files (MIT/manga_translator 11, MIT/test 10)
- **read_date:** 2026-07-04
- **findings:** Test count snapshot at this point: 234 passed (was 177, +57 new), 19 pre-existing async failures. Two genuinely new anecdotes not in the terser progress-doc/ADR record: (1) during seam S11, the `replace_symbol_body` refactoring tool mis-detected a method boundary mid-extraction, producing a duplicate `def` that ate part of `_dispatch_with_context` — caught immediately by grep, the file was reverted and redone with an anchored regex instead — a concrete example of an AI-tooling failure mode during automated refactoring. (2) A latent Windows-specific bug was surfaced (and deliberately preserved, not fixed): the `--save-text` path opens files with no explicit `encoding=`, so on a cp1252-default platform, `ensure_ascii=False` with non-ASCII content raises `UnicodeEncodeError` — logged for a future opt-in fix rather than silently patched. Both are strong material for a thesis section on AI-assisted refactoring risk/practice.

### PR #427: perf(MIT): lazy-import torch so logic tests run torch-free → mit-ci blocking logic gate (#359)
- **merged_at:** 2026-07-03T01:34:15Z
- **size:** +1851/-20, 18 files (MIT/manga_translator 8, MIT/test 3, .github/workflows 1)
- **read_date:** 2026-07-04
- **findings:** Precise root cause: `manga_translator/__init__.py`'s `from .manga_translator import *` and `utils/__init__.py`'s `from .inference import *` eagerly pulled in torch+cv2+transformers+diffusers (multi-GB) on **any** import, even a pure-logic-only `from manga_translator.config import Config` — this forced CI to install the full ML stack just to run a font-fit unit test, and the CI job had been left `continue-on-error` (report-only), meaning real MIT breakage could show green. Fix uses PEP 562 lazy package boundaries (`__getattr__`/`__dir__` forwarding via `importlib.import_module`) — documented as ADR 023. Concrete measured impact: torch-needing test files dropped **27 → 12**, and torch-free-collectible tests rose **338 → 413**. This PR is the direct origin of the "MIT CI baseline + #359 blocking-gate landing" milestone already referenced by commit message in recent git log — confirms the blocking gate replaced a `continue-on-error` job that had been silently useless.
