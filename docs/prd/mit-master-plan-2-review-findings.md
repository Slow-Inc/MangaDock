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
