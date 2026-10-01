# MIT Master Plan 2 — Review Findings (fable-5 + clink, 2026-07-03)

Two independent reviews of `mit-master-plan-2.md` (context: `mit-master-plan-2-review-pack.md`):
**fable-5** (this session — traced every load-bearing claim against the real code) and
**clink / claude-9arm codereviewer** (external CLI).

> ⚠️ **clink caveat:** the external agent's file reads were permission-blocked, so it reviewed from
> codebase priors + the framing questions, NOT the actual plan text ("Since the actual plan files don't
> exist on disk, I'll reconstruct…"). Its *strategic* findings stand; its *file-level* claims are
> discounted below where the code refutes them. (Cost note: 1.7M input tokens / ~$8.7 per clink pass.)

---

## 1. Verdicts

| Reviewer | Verdict | Top reason |
|---|---|---|
| clink (claude-9arm) | **fix-then-ship** | no translation-quality measurement framework → "human-level" is unverifiable |
| fable-5 | **fix-then-ship** | same #1 + two cluster premises (P8, P10) are refuted by direct code evidence |

Both reviews independently converge on the same #1 change.

---

## 2. Claim verification (fable-5 — traced against code)

### Confirmed ✅ (8)
| Plan claim | Evidence |
|---|---|
| P1 bug site: `-1` floor derived from crop | `rendering/__init__.py:387-388` (pre-fix) — **now FIXED, PR #522** (2px→18px benchmark) |
| P5 config defaults already merged | `Backend/src/books/mit-config.ts:234` (2560), `:264` (2048) |
| P3 no `MIT_REFERENCE_LAYOUT` Backend knob | grep `Backend/src/` → nothing |
| P2 RollingContext exists, default-off | `MIT/server/rolling_context.py`, `MIT_CONTEXT_PAGES=0` (`batch_runner.py:71`), `reset_page_context` (`manga_translator.py:1467`) |
| P2 tests exist | `test_batch_runner.py`, `test_rolling_context.py`, `test_prev_context.py`, `test_prev_context_prompt.py` |
| P1 premise "fit cores return the floor when nothing fits" | `font_fit.py` docstring: "If even low overflows, returns low — a too-tight floor beats invisible text" |
| `fit_to_box` upward-rescan heuristic | `reference_layout.py` (`_UPWARD_RESCAN_WINDOW`) |
| Harness blind to the `-1` bug | `render_replay.py:48` hardcodes `font_size_minimum=8` |

### Refuted / stale ❌ (2)
| Plan claim | What the code actually shows | Consequence |
|---|---|---|
| **P8 / defect 23:** "Knuth-Plass not wired; greedy still default; the KP adapter is written [elsewhere] — this is wiring" | `KnuthPlassLineBreaker` **is on main** (`text_render.py:835`), with the `LineBreaker` Protocol seam (`:798`) + `GreedyLineBreaker` (`:822`), and the comment at `:923` says KP **is already selected behind `render.bubble_area_fit`** — which production sets (`MIT_BUBBLE_AREA_FIT`, see render-knob-gating memory). PR #425 adds kinsoku/`line_break.py` extras, unmerged. | **P8's premise is stale.** First action = *verify which breaker actually runs in prod config*; the remaining scope is likely only the word-whole floor (#9) + PR #425 kinsoku merge, not "wire the seam". |
| **P10 / defect 27:** "`calc_vertical()` is dead code in the patch path" | `calc_vertical` **is called** at `rendering/__init__.py:615` (`if region.vertical:` single-axis expansion) and `text_render.py:599`. | **Premise wrong as written.** The real vertical gap (if any) needs re-diagnosis — likely about the *render* stage (per-char stacking) rather than sizing. Do not schedule #182 work off this inventory line as-is. |

### Status updates needed in the plan
- **P1 readable-floor: DONE** (PR #522, deterministic benchmark 2px→18px, `docs/reports/benchmarks/2026-07-03-readable-floor.md`). Residual: the plan's P1 fixture spec (parametrize `replay_clean_layout` with crop-vs-page shape; un-hardcode `fs_min=8`) is **not yet done** — the integration test in `test_render_overlap.py` pins the contract instead. Carry as a small P4-adjacent harness task.

---

## 3. clink findings — kept vs discounted

### Kept (strategic, code-independent)
1. **No translation-quality measurement = the plan's biggest blind spot.** BLEU/COMET are wrong for manga (no aligned corpus), but a **human-eval framework** is buildable: ~50-page curated test set spanning dialogue/narration/SFX/vertical + a 5-point rubric (readability, name consistency, tone/register, cultural adaptation, naturalness) + blind A/B vs a human translation. Without it, "human-level" is a slogan and none of P1-P12 can be shown to move the needle on *translation* quality. → **Elevate to Phase 0.**
2. **Render-heavy, translation-light.** P1/P3/P4/P5 polish the output's look; the user-facing differentiator is the translation itself (OCR quality ceiling, VLM non-determinism, LLM prompt/cultural adaptation, SFX translation). Rebalance the execution effort toward the translation side (P2, P6, P7) once the two critical render blockers are done.
3. **P2 zero-code ≠ zero-risk:** enabling RollingContext changes the prompt for every LLM call — quality can move either way; benchmark before/after (the plan's deterministic prompt-layer test covers wiring, not quality).
4. Missing-from-inventory candidates: cultural-adaptation/localization quality as its own defect line (currently folded into P7), and SFX *translation* quality (vs detection/render, which the inventory has).

### Discounted (contradicted by evidence)
- clink: "P4's polygon-spill premise may be wrong — safe-area + overlap clamping already handle it; drop the gate."
  **Refuted:** `safe_area.py` yields an interior **box** (distance-transform), not a polygon-bounded fill, and
  the harness metric `overflow_vs_det_w` measures vs the **detection box** — the 2026-07-03 user-caught oval
  over-fill + text-loss are the *empirical proof* the gap is real and unmeasured. **The P4 gate stays.**
  (clink formed this view without reading the plan/defect reports — the exact blind spot P4 fixes.)

---

## 4. Agreed amendments to master plan 2

1. **NEW Phase 0 item — translation-quality measurement framework (human-eval)**: curated ~50-page set +
   rubric + blind A/B protocol. Gates any "human-level" claim; both reviewers' #1.
2. **P1 → status DONE** (PR #522); carry the harness-parametrize residual into P4's harness work.
3. **P8: verify-before-schedule** — determine the active LineBreaker in prod config first; re-scope to
   word-whole floor + PR #425 kinsoku if KP is already live.
4. **P10: re-diagnose before schedule** — `calc_vertical` is not dead; capture what the vertical path
   actually does in the patch path before writing #182 tasks off the stale line.
5. **P4 gate confirmed** (against clink's objection) — the empirical 2026-07-03 evidence stands.
6. **P2 add a quality-risk note** — env-enable is zero-code but changes every prompt; pair the wiring test
   with a before/after chapter-consistency eval (which item 1's rubric provides).

---

*fable-5 verification method: Grep/Read on `MIT/manga_translator/` + `Backend/src/` in this worktree —
every table row above cites the file:line inspected. clink transcript: continuation `acdc0c32` (pal MCP).*

---

## 5. Round 2 — codex + agy (antigravity), 2026-07-03

Two more independent reviewers, each given a distinct angle (codex = roadmap/engineering-call/effort;
agy = translation-quality specialist). Both **fix-then-ship**. They surfaced findings the first pair missed
— and codex **corrected a fable-5 verification error**.

### 🔴 CORRECTION to §2: the P8 "stale premise" finding was WRONG (codex caught it)
fable-5 (§2) claimed KnuthPlass is "already selected behind `bubble_area_fit`" — read from the **comment**
at `text_render.py:44`. codex traced the actual **callers**: every `calc_horizontal(...)` in
`rendering/__init__.py` (`:114,119,167,172,285,302,361,603`) is called **without** `line_breaker`, so
`text_render.py:46` falls back to `GreedyLineBreaker()`. **KnuthPlassLineBreaker exists but is never wired.**
⇒ **P8's ORIGINAL premise (KP not wired, greedy is default) is CORRECT; my amendment was the error.** The
comment at `:44` is aspirational and misleading. Lesson: trust the call graph, not the docstring
(verify-before-claiming — a comment is not a trace). P10 (`calc_vertical` not dead) stays confirmed —
all three reviewers agree it is called (`rendering/__init__.py:615`).

### 🔴 NEW CRITICAL — P2 RollingContext is NOT cache-safe (codex; verified)
Backend prechecks each page and sends **only uncached pages** to MIT (`mit-batch-orchestrator.service.ts:441`
`uncachedPages`, `:452` push-on-miss, `:488` sent to MIT). MIT `RollingContext` only accumulates pages it
translated **in that loop** (`batch_runner.py:94-110`). So **cached page 0 + uncached page 1 → page 1 is
generated with EMPTY prior context yet cached under a context-enabled key**. The same patch-cache key can
hold a context-aware OR a context-free translation depending on cache state at generation time — a real
correctness bug. **This blocks executing P2 as written.** Fix: when `MIT_CONTEXT_PAGES>0`, send the full
ordered chapter to MIT, OR persist page `regions` and seed `RollingContext` from cached prior pages before
translating misses. Add a test: cached page 0 + uncached page 1.

### codex — other findings
- **HIGH — P2 zero-risk misses rollout cost + prompt-bleed.** `renderConfigHash()` folds every `MIT_*` env
  into the patch key (`mit-config.ts:95-105/:111-126`) → enabling `MIT_CONTEXT_PAGES` busts the whole patch
  cache. And `RollingContext` carries every `dst` line verbatim (`rolling_context.py:30-32`) → a hallucinated
  name / OCR garbage becomes prompt input for later pages. ⇒ **sequence P2 AFTER P7's numbered-contract +
  determinism gate**, not before.
- **HIGH — roadmap orders P8 after P3 → layout rework.** P3's corpus envelope is baselined on the current
  (greedy) breaker; wiring KP (P8) later changes multi-line wraps and invalidates it. ⇒ **fold "active
  breaker selection" into P3's promotion gate, or move P8 before P3.**
- **MEDIUM — P5 hash gap:** `renderConfigHash` sees env vars, not the serialized config *defaults*
  (`mit-config.ts:99-105`). A quality-affecting default change with no env change → stale patches survive the
  same key. ⇒ hash the built config JSON, or bump a patch-cache version on default-only changes.
- **MEDIUM — effort understated:** P2 is **not S** (cache semantics + partial-batch seeding + telemetry);
  P5 benchmark is **M** (stage-isolated DBNet/LaMa fixtures + full-res reports on a 12GB box). P1 plan-state
  is inconsistent (header "DONE" vs inventory/roadmap still "open").
- **CUT — P12 inpaint-quality** from this plan (erase fidelity only, admits out-of-scope) → separate backlog.
- Positives: the polygon-spill gate + the cross-job-bleed-boundary discipline (`reset_page_context`) are right.

### agy (antigravity) — translation-quality specialist angle
- **P7 is missing the three real human-level levers.** P7 is mechanical (numbered contract, low temp,
  glossary). It lacks: (1) **character voice / register** — pronoun choice (`watashi`/`ore`/`boku`) +
  honorific mapping (`-san`/`-sama`/`-chan`) to interpersonal dynamics; (2) **multi-bubble clause
  reconstruction** — a sentence split across bubbles must be translated as one clause, not fragments;
  (3) **SFX semantic localization** — `ゴゴゴ`→"RUMBLE" not romaji. ⇒ P7 needs these, not just format hygiene.
- **The real ceiling is the model class, not prompt hygiene.** A text-only LLM translates a blind line list
  (no gender/expression/panel flow); OCR (defect 28) caps it further. Breaking it needs a **multimodal VLM
  translator** taking the page image + coordinates. (Aligns with the plan's own §7 honesty, but should be
  named as the ceiling.)
- **NEW defect (absent from the 29):** **fragmented-clause translation of split speech bubbles** — single
  sentences split across bubbles translated independently → disjointed English. A pro catches this instantly.
- **Concrete MVE eval (runnable by a 2-person team in a week)** — this operationalizes the Phase-0 item both
  earlier reviewers demanded: 3–5 chapters (~60–100 pages) from Manga109 / a series with an official EN
  translation as reference; sample **100 bubbles** (dialogue+narration+SFX); rubric **0-2** on
  {Faithfulness, Cohesion/reading-order, Style/naturalness}; Student A generates (context ON vs OFF),
  Student B blind-grades vs the official reference. ⇒ **adopt as the Phase-0 human-eval spec.**

### Net corrections to the plan (round 2)
1. **P2 → add a CACHE-SAFETY GATE** (send full ordered chapter, or seed context from cached pages) + a
   partial-batch test **before** any production enable. Re-estimate P2 as **M**, sequence **after P7**.
2. **P8 → revert the fable-5 amendment.** KP is genuinely un-wired (greedy default); P8 = wire
   `KnuthPlassLineBreaker` into the `calc_horizontal` callers. **Sequence P8 into/of before P3** (breaker
   baseline). Word-whole floor (#9) + PR #425 kinsoku remain.
3. **Phase-0 eval → adopt agy's MVE spec** (100 bubbles, 0-2 rubric, blind A/B vs official EN).
4. **P7 → expand** to include character-voice/pronoun/honorific consistency, multi-bubble clause
   reconstruction, and SFX semantic localization — not just the numbered contract.
5. **NEW defect 30:** fragmented-clause split-bubble translation (domain: translation; cluster: a new
   `multi-bubble-clause` or fold into P7).
6. **P5 → add config-JSON hashing / cache-version** to the verify-and-close scope.
7. **CUT P12** inpaint-quality → separate backlog.
8. Name the **multimodal-VLM-translator** ceiling explicitly in §7 as the real accuracy cap.

*codex transcript: continuation `92398f23`; agy transcript: continuation `3caf5acc` (pal MCP). Both read the
actual plan files (codex + agy file reads succeeded, unlike the first clink pass).*
