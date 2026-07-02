# MIT Render-Defect Campaign — Master Plan

> **Status:** DRAFT (2026-07-02) · **Branch:** `worktree-feat-mit-font-s1` · **Owner:** @xenodev
> **Goal:** Fix ALL known MIT render defects (12-item checklist) and reach visual parity with the
> MangaTranslator reference, WITHOUT regressing the two already-working targets.
>
> Grounds on: upstream studies (`docs/research/render-parity-port-plan.md`,
> `mangatranslator-internals.md`, `en-source-wrap-parity-study.md`), the benchmark standard
> (memory `feedback_benchmark_defect_checklist`), and a 3-model brainstorm (codex/Gemini/Qwen).

---

## 1. Problem statement

We fix render defects **one-by-one as the user flags them**. Because the render code is a **single
shared path** used by every source→target language pair, each fix risks regressing an
already-good target — and does, silently. Concrete (2026-07-02): a Thai "fill-the-balloon" fix
oversized the **English One-Punch** target (narration bigger than the reference, free-text
overflowing the art). It was caught only by chance-benchmarking the English target.

**Two protected baselines** (must never regress):
- **Thai** — English→Thai, "Gal Yome" chapter (30 pages). Active work.
- **English** — Japanese→English, "One-Punch" page, vs reference `MIT/example_translation.jpg`.

**Root cause of the regression pattern:** our fork DIVERGED from the reference renderer's proven
sizing model. Reference = *shrink-to-fit from a cap, bounded on BOTH axes, against a mask safe-box*.
Ours added `clean_layout_target_fs` (GROWS the font toward the source glyph size) + a **height-only**
shrink loop → wide regions overflow. Render `__init__.py` is **849 LOC vs upstream's 430** — ~420 LOC
of bolted-on sizing machinery (`clean_layout`, `bubble_area_fit`, `clean_layout_target_fs`,
supersampling, track-orig-fs) that upstream does not have.

---

## 2. The proven target model (what we converge TO)

From `mangatranslator-internals.md` (meangrinch clone = source of `example_translation.jpg`) and the
render-parity study. This is the algorithm to match — do NOT invent a new one:

1. **Safe-box, not raw bbox.** Distance-transform inset rectangle inside the bubble mask (centered,
   symmetric) → text fits against this, so it never touches the balloon outline.
2. **Outer loop = binary-search font size** over `[min, max]` (reference default 8–16, scaled) —
   start at the cap, search DOWN to the largest size that fits.
3. **Fit test bounds BOTH axes:** `max_line_width ≤ box_w AND total_block_height ≤ box_h`.
4. **Inner loop = Knuth-Plass DP** line-break (badness = slack³ + hyphen penalty) → evenly-filled
   lines (the "neat" look).
5. **Mask collision → horizontal squeeze ×0.90, up to 3×** before shrinking font.
6. **Fail loudly, never overflow** — if nothing fits at `min_font`, raise; do not spill over art.
7. **Roles = only 2 classes:** in-bubble (dialogue+narration, uniform policy) vs outside-text
   (SFX/caption: larger font range, UPPERCASE, outline). Emphasis (SFX shout / thought) is inline
   **bold**/*italic* from the translator, NOT a sizing branch.
8. **ALL-CAPS dialogue comes from the FONT** (comic faces are caps-dominant), not a code transform;
   only outside-text is `.upper()`'d in code.

**Divergence table (our regression source):**

| dimension | reference (proven) | our fork (regresses) |
|---|---|---|
| size direction | shrink FROM cap | grow toward `orig_fs` |
| bound | width AND height | height only → width overflow |
| no-fit | fail loudly | spill over art |
| box | distance-transform safe-box | source bbox |
| roles | 2 clean classes | implicit, scattered conditionals |

---

## 3. Methodology (3-model consensus: codex + Gemini + Qwen)

All three independently converged:

- **Do NOT keep patching one-by-one.** Build a deterministic **regression guard FIRST**, before more
  fixes — every future fix is unprovable without it.
- **Metrics are the blocking gate; golden images are advisory** (pixel diffs are brittle to
  antialiasing/font/platform drift). "Golden = the gate, trace = the compass."
- **Inventory all 12 defects → map each to its code-path touch-point → CLUSTER by touch-point.**
  If N defects share the shrink loop, fix the loop once → solve N. Order by code-path convergence,
  not raw severity.
- **Characterize BEFORE refactor** (behavior-preserving first), then extract explicit role policies.
- Every fix: failing test → minimal change → deterministic replay → BOTH-target visual benchmark →
  user confirm → commit.

---

## 4. Phased plan (revised 2026-07-02 after a 3-model critique — codex + Qwen)

> Both critics independently rejected "inventory-first" and "full harness before core change":
> most of the 12 defects are likely SYMPTOMS of the bad sizing model, so inventorying before
> convergence classifies noise. And a guard that asserts only the PREDICTED layout gives false
> confidence — it must assert the FINAL RENDERED output (post supersample/homography/warp/clip).
> Revised order: fixtures → trace ALL branches → minimal metric guard → stop-the-bleeding →
> converge (port reference engine behind a flag) → THEN inventory what survives → cluster fixes.

| Phase | Deliverable | Gate |
|---|---|---|
| **0 — Freeze fixtures** | Dump+replay fixtures: exact post-translate regions (text, bbox, mask, font_size, bubble_box, page_shape, config, fonts) for One-Punch + 3–5 high-risk Thai pages. Replay bypasses OCR/translate/inpaint. | 2 replays → identical input-geometry hashes + identical LayoutDecision traces |
| **1 — Trace ALL branches** | The render path has SEVERAL mutually-bypassing sizing branches (bubble_fit_sole, bubble_fit_shared, clean_layout, legacy length-ratio). Emit ONE **LayoutDecision** record per region from EVERY branch: role, chosen path, fallback_reason, orig_fs→final_fs, safe_box, wrap_w, block_w/h, **fill_frac_w & fill_frac_h**, and — critically — the **FINAL rendered alpha bbox** (post supersample/homography/warp) + page-clip flag. Insert-only logging, zero behavior change. | known 2026-07-02 oversize is visible in the trace with the exact branch responsible |
| **2 — Minimal metric guard** | Lightweight pytest replay tests (~fast) asserting **metric envelopes on the FINAL render**: no width/height overflow, no page clip, final_fs ∈ [min,cap], no mid-word Thai break, mask-contained. Golden SSIM is DEFERRED to advisory/human-review only (weak for text: small shifts dominate SSIM while under-fill/mid-word-break pass). | a deliberate oversize/under-fill mutation turns the gate RED |
| **3 — Stop the bleeding** | Minimal both-axis bound on the legacy/clean_layout shrink path + stop grow-toward-source from overriding the cap on non-SFX roles. Contained hotfix, NO broad refactor. (Doubles as the demo hotfix.) | known width overflow fixed; other replay traces unchanged beyond declared envelopes |
| **4 — Converge to the reference contract** | Port the reference algorithm as a **NEW pure layout module (~200 LOC) behind one config flag** (not a 400-LOC in-place edit): safe-box → binary-search-from-cap → both-axis fit → Knuth-Plass → mask-squeeze ×0.90≤3 → **fail-loud** (test failure in replay; visible diagnostic/fallback in prod, never silent tiny text). Add early **role-normalization** (collapse the scattered implicit roles to the 2 reference classes). Route in-bubble dialogue through it; then explicit outside-text/SFX policy. Rollback = one env var. | both targets pass blocker metrics + visual; side-by-side vs old path on ≥1 page; no Latin/CJK golden drift |
| **5 — Inventory what SURVIVES** | NOW build the 12×N matrix from a fresh full-chapter + One-Punch render — only for defects that survive the unified sizing contract (many will vanish). Map survivor → touch-point → cluster → issue#. | every survivor has a fixture + failing test + owner |
| **6 — Cluster fixes** | Resolve survivors in touch-point clusters (§5), each TDD + both-target benchmark + user confirm. | both targets green before each cluster is "done" |

**Demo carve-out:** Phase 3 (both-axis bound hotfix) IS the demo fix — do it after a thin Phase 0–2
slice (One-Punch + 2–3 Thai pages, metric gate only). Full reference port (Phase 4) comes after the demo.
Flag any thin-slice shortcut per meta-rule "no silent caps".

---

## 5. Defect inventory → clusters → issues

Grouped by shared code-path touch-point (fix the root once per cluster):

| Cluster | Defects (checklist #) | Touch-point | Issues |
|---|---|---|---|
| **A. Font sizing** | 2 under-fill, oversize-vs-target, 8 clipped/overflow, 12 UI-strip bloat | `_clean_layout_dst` / `clean_layout_target_fs` / bubble-fit shrink loop | #175 epic, #430, #432, #429, #431 |
| **B. Wrap/line-break** | 9 word-break (DONE) | `text_render.calc_horizontal` / render() ss re-wrap | #434, #180, #435 |
| **C. SFX/outside-text** | 3 phantom, 6 romaji untranslated | det_sfx + `ocr_vlm` rescue gate | #278, #169, #168 |
| **D. Overlap/geometry** | 5 multi-lobe, 7 overlap | `render_overlap` clamp, bubble grouping | #436, #183 |
| **E. Inpaint/patch** | 4 fade, 10 pixelation, 11 ghost | patch composition / mask / inpaint (NOT render) | #437, #268/#269/#270/#418, #421 |
| **F. Empty** | 1 text missing | region drop / patch occlusion | #436 |

> Note: cluster E defects are **inpaint/patch**, not render sizing — do not force them into render
> fixes. The render regression guard still applies as a non-regression net.

---

## 6. Regression guard design

- **Deterministic replay CLI:** `prepare fixture` (dump) + `replay fixture` (render-only, no ML).
  Fixtures committed as metadata + local binary artifacts (paths documented; images may be gitignored).
- **Metric envelopes (blocking):** per region — no overflow (fill_frac_w ≤ 1, fill_frac_h ≤ 1), no
  image-bound clip, `final_fs ∈ [min, cap]`, no forced mid-word Thai/CJK break, mask-contained.
- **Golden images (advisory):** SSIM / masked-pixel-delta vs `example_translation.jpg` + a pinned Thai
  golden, with calibrated tolerance. Pin font path + hash + OpenCV/platform metadata.
- **Tiers:** smoke replay per edit · both-target visual benchmark per defect · full Thai chapter +
  One-Punch as the "done" gate (per memory meta-rules 3/5/6).

---

## 7. Risks

| risk | mitigation |
|---|---|
| Golden image brittleness (AA/font/platform) | metrics = blocking, image = advisory + pinned font/OpenCV metadata |
| Harness work delays visible fixes | thin first slice (One-Punch + 2–3 Thai pages), then expand |
| Overfit to 2 targets | add synthetic Latin/Thai/CJK layout-invariant characterization cases |
| Refactor changes behavior while restructuring | first extraction commit behavior-preserving; require trace/image parity |
| Non-render defects consume render complexity | classify each defect by pipeline stage before assigning a fix (cluster E) |
| Full-chapter too slow for inner loop | tiered gates: smoke per edit, full chapter for done |

---

## 7a. Execution log + learnings (2026-07-02)

- **Phase 3 (both-axis hotfix) — DONE, committed** (`df30e25e`): `_clean_layout_dst` now bounds a
  sized-up caption on both axes (`_CLEAN_DISPLAY_W_TOL`). Removes the gross One-Punch width overflow
  (fonts 40→18, face-covering block gone); Thai no under-fill regression. Report:
  `docs/reports/benchmarks/2026-07-02-clean-layout-both-axis-hotfix.md`.
- **Phase 1 (harness metric) — DONE, committed** (`c0f8b45f`, `2f71a71c`): `sizing_trace.axis_fill`
  + `overflow_axes`; the LayoutDecision trace emits `fill_frac_w/h` + `overflow_w/h`.
- **Phase 4 attempt — REVERTED (key learning):** a quick "shrink-to-min on overflow" made narration
  render *too small / faint* (verified on One-Punch). Root: the bound was the **source-text column
  width** (`x2-x1`), which for narration is much narrower than the balloon it sits in → over-shrink.
  **The proper Phase-4 fix must bound against the balloon SAFE-BOX (distance-transform interior),
  not the source column** — narration balloons are wider than their source column. clean_layout
  regions often lack a `bubble_box` (det_bubble_seg misses egg/oval narration), so Phase 4 needs a
  safe-box (or territory) fallback for those. This is the reference model exactly (safe-box →
  binary-search-from-cap → both-axis → fail-loud) and is NOT a quick patch — it is the real Phase-4
  reference-engine port. Do it behind a flag, gated by the harness (#462), verified on both targets.

## 7b. Phase-4 engine landed behind a flag (2026-07-02, cont.)

`reference_layout` flag wired end-to-end (config → stages → dispatch → resize), OFF by default
(golden byte-identical). Engine: `reference_layout.fit_to_box` (pure) + `_reference_clean_layout`
(safe-box binary-search, word-whole) + `_reference_fit_box` (safe interior for bubbled regions, else
detection box). TDD: 4 reference-layout + 3 clean-layout tests.

**Worker verify (flag ON):**
- **One-Punch (EN): fixed** — the gross overflow is gone; every region is contained + readable (no
  more giant face-covering blocks). Slightly smaller than target + greedy line-breaks (→ KP #180).
- **Thai (ds20): REGRESSES** — dialogue in round bubbles that `fills_bubble_width < 0.72` demotes to
  clean_layout now caps at the flat size → **under-fills the balloon** ("มีอยู่แล้วค่ะ" small in a big
  oval). The flat cap is right for narration but wrong for a bubbled region that should FILL.

**⇒ flag stays OFF until fixed.** Before default-on, `_reference_clean_layout` needs a **per-role cap**:
bubbled regions (a `bubble_box` present) should fill the interior (cap = interior-height bound, like
bubble-fit), only narration (no bubble) caps at the flat size. Plus KP line-break (#180) for line
parity. This is the `fills_bubble_width` discriminator problem (item-2b) surfacing — tracked under #430/#432.

## 7c. Phase-4 hits the detection boundary (2026-07-02, trace-confirmed)

Added a per-role cap (`_reference_cap`: bubbled → fill interior, narration → flat) and re-verified.
**It did NOT fix Thai under-fill.** The sizing trace (reference_layout ON, Gal Yome ds20) shows why —
all three Thai dialogue regions:

```
route=clean_layout  has_bubble=False  orig=80 final=26  fill_frac_h=0.19   (dialogue, but no bubble)
route=clean_layout  has_bubble=False  orig=44 final=22  fill_frac_h=0.35
route=clean_layout  has_bubble=False  orig=33 final=22  fill_frac_h=0.57
```

`has_bubble=False` — **det_bubble_seg missed these oval/tall balloons** (item-2 root cause #1). With
no bubble mask, the renderer treats them as narration → flat cap → under-fill. **This is a hard
boundary: One-Punch narration is *also* `has_bubble=False` and *should* stay small, so `has_bubble`
is the only signal that separates "dialogue in an undetected bubble" from "real narration" — and it's
false for both.** `orig_fs` can't disambiguate either (JP narration is big-font too, which is exactly
why the old `clean_layout_target_fs`/track-orig-fs over-sized One-Punch while "accidentally" filling
Thai). **No render-only rule wins both without the bubble mask.**

**⇒ reference_layout default-on is blocked on bubble DETECTION coverage (#170 / a detection-model
change), not render.** The render engine is correct for detected bubbles. Next real lever: improve
`det_bubble_seg` recall on egg/oval/tall balloons (out of render scope) — then flip reference_layout on.
Until then it stays OFF (verified: flipping it on trades One-Punch oversize for Thai under-fill).

## 7d. Detection-recall fallback started — validator done, wiring in the WRONG path (2026-07-02)

Built the classical flood-fill balloon fallback for the has_bubble=False root:
- `acceptable_synth_bubble` gate (pure, TDD'd) — accepts a synth bubble only if it encloses the text,
  is bigger than it, and isn't a page/panel leak. Committed.
- Wired into `_tag_regions_with_bubbles` behind `det.det_bubble_synth` (flag OFF → byte-identical).

**Verify (flag ON) — did NOT fix Thai; the worker log shows why:** no `[BubbleSeg]` line at all on a
`/translate/with-form/image` render — `_tag_regions_with_bubbles` **does not run in the patch/image
render path**. Bubble boxes for that path are assigned elsewhere (see `patch_geometry.py:28-34`, which
sets `local_region.bubble_box`). So the synth fallback is wired at a seam the actual render doesn't use.
One-Punch showed no regression only because the fallback never ran.

**⇒ next: find the real bubble-assignment seam for the patch/image path (`patch_geometry`) and add the
synth fallback there** (gated + validated the same way), then re-verify both targets. The validator +
config flag are reusable; only the call site moves. Flag stays OFF until it actually runs + verifies.

## 7e. ⚠️ BENCHMARK METHODOLOGY CORRECTION (2026-07-02) — read this first

**The whole campaign was partly benchmarked on the WRONG endpoint.** `/translate/with-form/image`
(→ `get_ctx` → full-page `translate()`) **never tags speech bubbles** — `_tag_regions_with_bubbles`
is called ONLY inside `translate_patches` (manga_translator.py:1476), and production (Backend) uses
`/translate/with-form/patches` → `translate_patches`. So every render-defect conclusion drawn from the
`image` endpoint saw `has_bubble=False` for EVERY region — a structural artifact, not real behavior.

**Verified on the production `patches` endpoint (bubbles ON):**
- Thai ds20: `[BubbleSeg] 4 balloons, 3/3 regions tagged` → dialogue **FILLS its bubbles** ("มีอยู่หนึ่งอัน"
  fills the oval, "ราคา 1858 เยน" fills the tall bubble). The session-long "under-fill" was the
  image-endpoint artifact. det_bubble_seg is NOT missing ovals.
- One-Punch: `[BubbleSeg] 5 balloons, 3/6 tagged` (3 narration boxes correctly have no bubble) → text
  present, bubbles filled, narration prominent, **no catastrophic overflow** (the giant face-covering
  block was largely the image-endpoint artifact too).

**⇒ Corrections to earlier sections:**
- §7c "Phase-4 is detection-bound (has_bubble=False)" — **WRONG / artifact.** On the patch path bubbles
  are tagged; that conclusion was measured on the non-tagging endpoint.
- §7d "synth-fallback wiring in the wrong path" — **WRONG.** `translate_patches` DOES call
  `_tag_regions_with_bubbles`; the wiring is correct. It just wasn't needed on these two pages (`+0`
  fallback — YOLO tagged everything). Keep it (flag `det_bubble_synth`, OFF) as a genuine-miss safety net.
- Phase-3 hotfix + Phase-4 engine: valid, tested, flag-gated code — but their **necessity must be
  re-checked on the patch path**, where the defects they target are much milder than the image endpoint showed.

**RULE (also in team memory): benchmark MIT render via `/translate/with-form/patches` (composite the
returned patches onto the original) — NEVER `/translate/with-form/image` for anything bubble/sizing
related.** Patch JSON: `{img_width, img_height, patches:[{x,y,w,h,img_b64}]}`; composite = paste each
`img_b64` PNG (RGBA) at `(x,y)` onto the original.

**Next real step:** re-run the 12-item defect inventory on the PATCH path (reference_layout ON vs OFF)
to find which defects are actually real in production, before any more render code.

## 7f. Confirmed real (patch-path) defect: One-Punch narration blocks render LARGER than target

2026-07-02, user-verified on the **patch path** (correct endpoint): the two top narration blocks
("WHAT SHOULD WE DO…", "THIS BRAT DOESN'T REALIZE…") render clearly bigger/wider than the target's
narrow multi-line columns. This is a REAL production defect (not the image-endpoint artifact) — these
are `has_bubble=False` → clean_layout → `reference_cap` = flat. Two compounding causes:
1. **Flat cap too high** — `clean_layout_font_size(font_size_max=20, page)` scales with page resolution
   to a size above the target's narration (reference model caps in-bubble ~16). Lever: lower the
   clean-layout narration cap (smaller `font_size_max`, or a narration-specific cap ≈ reference 16).
2. **Wrap column too wide / greedy line-break** — target wraps into a narrower column (more lines,
   smaller font); ours wraps wide (fewer lines, bigger). Lever: narrower wrap for narration + KP
   line-break (#180) so the column matches the target shape.

Tracked as a first-class item (was only an aside in §7e). Fix on the patch path, verify vs target,
reference_layout ON vs OFF. Related: #180 (KP line-break), #430 (render sizing).

## 7g. Discriminator OVER-CORRECTS (user feedback 2026-07-02) — narration now too SMALL

The `interior_w/det_w` discriminator correctly stops the demoted-bubble from FILLING a wide interior,
but its "narrow" treatment (flat cap + wrap to the detection box) **over-shrinks**: on the One-Punch
page (0.92 MP → flat ≈ 19px, width-fit drops it to 10–13px) the two top blocks render TINY, and the
target renders them as a **readable narrow column echoing the original VERTICAL narration**. User also
saw a Thai bubble ("plastic bag") go tiny — the 3 patches are all present (no text loss), but that live
run's region had ratio > 1.4 so it was narrowed too (the non-determinism + threshold-sensitivity the
brainstorm agents flagged). So we traded "too big" for "too small" — the exact ping-pong the campaign warns about.

**Root:** the narrow path has no readability FLOOR and its size isn't calibrated to the target. Threshold
1.4 (from the deterministic fixture) mis-fires on other live runs of the same page (translator non-determinism).

**Real fix (next):** calibrate narration size to the TARGET deterministically — measure the target's
narration font px and set the narrow-path cap/column to match (a readable narrow column, not min font),
and honour the original's vertical orientation as the reference. Add a readability-FLOOR metric guard
(final_fs not far below the target) so the harness catches over-shrink too, not just over-spill. Until then
the discriminator stays behind the OFF flag (production/demo unaffected — reference_layout is not the default).

## 7h. reference_layout de-risk — threshold validated across corpus (2026-07-02)

Post-demo, executed the brainstorm-consensus de-risk (3-agent, all read the code): the unanimous #1 risk
was the demoted-bubble discriminator threshold (1.4) being unstable across the non-deterministic
translator. Actions taken:
- **Narration over-shrink fixed** (the earlier over-correction): `fit_to_box` was a plain binary search
  that hit word-wrap NON-monotonicity and returned the tiny branch → added a bounded upward re-scan; plus
  the non-fill path gets a generous vertical tolerance so narration wraps to more lines at the flat size.
  Live render confirms readable narrow columns; two-sided metric guard green.
- **Corpus expanded 2 → 4 fixtures** (One-Punch + Gal Yome ds20/ds4/ds12; a 5th was a byte-identical dup,
  dropped). Measured discriminator ratios across **17 bubble regions**: Thai (fills) = **1.07–1.20**,
  One-Punch (narrow) = **1.61–3.43**. **Clean separation — nothing lands in [1.20, 1.60]; ~0.2 margin each
  side of the 1.4 threshold, consistent across every page.** The instability concern is substantially
  reduced (no near-boundary region in the corpus).
- **Parameterized safety-envelope guard** over the whole corpus: every region must be within the box
  (spill ≤ 1.35×det, narration ≥ 0.6×flat, fill ≥ 0.9×flat). Passes on all 4 fixtures. Marked `slow`
  (calc_horizontal-heavy). Any new fixture is auto-guarded.

**Status:** reference_layout is now corpus-validated on 4 pages + envelope-guarded, but still **flag OFF**
(promotion to default is a separate call — grow the corpus further + the multi-run flip check the agents
suggested if the threshold ever needs tightening; the remaining cleanup is merging `_reference_fit_box`
+ `_reference_cap` into one intent resolver + naming the constants).

## 8. Immediate next actions

1. Render-only replay fixture spec + dump/replay CLI (One-Punch + the 2026-07-02 oversize region +
   2–3 Thai high-risk pages).
2. Extend `MIT_SIZING_TRACE` into a per-region **LayoutDecision** across ALL branches — add
   fill_frac_w/h, **final rendered alpha bbox + page-clip**, role, chosen path, fallback_reason.
3. Write the failing metric test for the known **clean_layout width-overflow** (One-Punch) and
   **Thai under-fill**; confirm a deliberate mutation turns it RED.
4. **Phase 3 hotfix** (also the demo fix): minimal both-axis bound on the legacy/clean_layout shrink +
   stop grow-past-cap on non-SFX roles.
5. THEN Phase 4: port the reference layout engine as a new module behind a flag + role-normalization.
6. Only after convergence: inventory survivors → cluster → fix.

---

## 9. Open decision for the user

The one point the two critics split on (I recommend codex's order):
- **Qwen:** skip the width patch, port the reference engine straight away (the grow+height-only-shrink
  is structural; a band-aid breaks on the next case).
- **Codex (recommended):** minimal both-axis patch FIRST as cheap containment (stops the active
  regression + unblocks the demo), THEN the clean reference-engine port behind a flag.

Both agree the end state is the ported reference engine behind a flag — the split is only whether to
ship a contained width-patch in between. Given the demo, the patch-then-port order wins.
