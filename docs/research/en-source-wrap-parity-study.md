# Original-referencing line-break across source languages — study (#435)

> Research deliverable for issue #435 / PRD #434. **No production code changed.** Output: validated problem characterisation, MangaTranslator mechanism (cited), an A/B methodology, candidate comparison, and a recommendation to feed a future implementation PRD. The current `clean_wrap_width(source-bbox-width)` reference stays the baseline.

## 1. Problem — refined by cross-language E2E (2026-06-30)

"Reference the original line-breaks" was believed to be JP-only. Rendering a small matrix (One-Punch JP-source, Gal Yome no Himitsu EN-source) through the **real backend render config** refines it: the wrap width is decided by **which render branch claims the region**, and that branch's **source of width** — not by the target language.

`resize_regions_to_font_size` has three branches:
- **bubble-fit** (`MIT_BUBBLE_AREA_FIT`) — wraps to the *balloon interior* width.
- **clean-layout** (`MIT_CLEAN_LAYOUT`) — wraps to the *source region bbox* width (`clean_wrap_width(x2-x1, …)`).
- **legacy** — length-ratio.

### Matrix (narration / caption blocks)

| Source | `bubble_area_fit` | Branch taken | Wrap width source | Result |
|--------|-------------------|--------------|-------------------|--------|
| JP (vertical) | OFF | clean-layout | source bbox (narrow, vertical column) | **narrow column ✅** |
| JP (vertical) | ON  | bubble-fit   | balloon interior (wide) | wide ❌ |
| EN (horizontal) | OFF | clean-layout | source bbox (**wide**, horizontal line) | wide ❌ |
| EN (horizontal) | ON  | bubble-fit   | balloon interior (wide) | wide ❌ |

**The only narrow case is `JP + clean-layout`.** It is an accident of two things coinciding: (a) clean-layout references the *source* bbox width, and (b) Japanese is set vertically so that bbox is narrow. Neither holds for EN source, and turning on `bubble_area_fit` (needed so EN *dialogue* fills its balloon, #175) routes narration through bubble-fit, which is wide for everyone.

Evidence (rendered, this session): One-Punch JP→EN bfit OFF = narrow narration; JP→EN bfit ON = wide; JP→TH bfit ON = wide (same as JP→EN ON → **wrap is target-invariant**); Gal Yome EN→TH bfit ON = wide narration + (now-fixed) tiny dialogue. Per-region geometry from a debug hook (`[#179dbg]`): dialogue that *should* fill a balloon has text-footprint/balloon-width `rw/bw ≈ 0.88–0.90`; narration loosely placed in a large box has `rw/bw ≈ 0.40–0.59`.

**Conclusion:** the defect is **source-orientation-dependent and target-invariant** in the clean-layout path, and **always-wide** in the bubble-fit path. A real fix must stop deriving the wrap width from the *source* footprint and stop letting bubble-fit wrap narration to the full balloon width.

## 2. How MangaTranslator does it — source-agnostic (cited)

Studied from `D:/Github/MangaDock/MangaTranslator/`. **Its wrapping never reads the source text's bbox width or reading orientation. The wrap maximum is always the target render region's geometry; line breaks are recomputed optimally on the translated text.** The pipeline comment is explicit: *"Fallback uses neutral rotation since we no longer track orientation"* (`pipeline.py:1526`); both region types hard-default `vertical_stack=False, rotation_deg=0.0` (`pipeline.py:1401-1402, 1448-1449`).

1. **Wrap width = target geometry.** For a balloon, `max_render_width = box_w` of the **cleaned target balloon mask's** distance-transform safe-area (`text_renderer.py:174-182`, via `calculate_centroid_expansion_box`). For an outside-balloon/narration (OSB) region, `cleaned_mask=None` (`pipeline.py:1394`) → padded fraction of the **OSB target bbox** (`text_renderer.py:190-191`, `FALLBACK_PADDING_RATIO=0.08`). No source width anywhere in `render_text_skia → find_optimal_layout → check_fit → find_optimal_breaks_dp`.

2. **Width-squeeze for narrow columns.** `find_optimal_layout` (`layout_engine.py:737-794`): start at the full target width, `max_squeezes = 3 if cleaned_mask is not None else 1`; on a collision against the real binary mask (`_check_collision`, `:607-653`) multiply width ×0.90 and retry; accept the first collision-free fit. So narrow columns come from squeezing the **target** width against the mask, not from the source.

3. **Knuth–Plass DP on the translated text.** `find_optimal_breaks_dp` (`text_processing.py:489-578`): `badness = slack^badness_exponent (3.0) [+ hyphen_penalty 1000 if hyphenated]`; midpoint-out Latin hyphenation for words ≥ `hyphenation_min_word_length` (8) (`text_processing.py:345-427`); CJK kinsoku (`_split_with_cjk_awareness`, `:246-304`, tables `:222-226`). Tokens are the **translated** string (`tokenize_styled_text`), never the source line structure.

4. **Auto-orientation from the translated text.** `_should_try_auto_vertical_text` (`text_renderer.py:38-57`, thresholds `:27-31`: target aspect ≥1.6, ≤12 chars, ≤1 word) + an "is vertical actually better" fill-gain gate (`:60-79`). Only language check is `is_rtl_script` on the **output** (`:49`). No source-language input.

5. **Emphasis = LLM markers, not pixels** (context for #171): Visual Emphasis Policy emits `*italic*`/`**bold**` (`translation.py:89,213-216`); renderer maps via `STYLE_PATTERN`/`parse_styled_segments` (`text_processing.py:8,183-218`) to a 6-pass font variant pick (`font_manager.py`). No glyph-thickness analysis.

6. **Only source-ish leak:** `outside_text_processor.py:212-221` reads each **OSB target bbox's** own aspect (`is_narrow_tall = w/h ≤ 0.4`, `is_tiny = area < 0.005`) to *enlarge the drawing box* before layout — the target region's aspect, not the source's, and it does not feed wrap width or breaks.

## 3. A/B methodology (to run before any default switch)

**Pages (fixed set):**
- JP-source: One-Punch benchmark page (narration + dialogue + SFX).
- EN-source: Gal Yome no Himitsu EN ch1 p4 (narration-style + dialogue balloons).
- (Optional 2nd target to prove target-invariance: render each to both EN and TH.)

**Procedure:** render each page through the real backend render config with the candidate flag **off (baseline)** then **on**, on the live worker (direct `POST /translate/with-form/patches` mirroring `buildMitConfig`, or the Reader after a cache reset). Because translation is non-deterministic, **freeze the OCR/translation result** (same regions + same translated strings) and vary only the layout flag, so the comparison isolates layout. (Reuse the existing per-region dump harness to pin inputs.)

**Metrics (per region, objective):**
- *column aspect* = block_height / block_width (higher = narrower column);
- *mean line width / max line width* (lower = tidier narrow column);
- *line count* vs the original region's line count (closeness);
- *overflow* = does any laid line cross the balloon mask / panel (must be 0);
- *fill* = block area / balloon-safe-area (dialogue should be high; narration moderate).

**Pass bar (decision gate to flip default):**
- EN-source narration column aspect rises materially toward the JP-source baseline; no overflow; dialogue fill unchanged (still fills, #175 preserved);
- JP-source output unchanged vs today when the flag is **off** (byte-identical golden/guard);
- side-by-side images attached for human sign-off.

## 4. Candidate approaches

| # | Approach | Per-source behaviour | Risk | Leans on |
|---|----------|----------------------|------|----------|
| A | **Baseline** — keep `clean_wrap_width(source bbox)` | narrow only for JP+clean-layout | none | — |
| B | **Target-space width-squeeze** (port MangaTranslator §2): wrap to the balloon safe-area / OSB target bbox, squeeze ×0.90 vs mask | source-agnostic narrow columns; needs target masks/safe-area | medium (mask plumbing, perf of squeeze loop) | #183 (squeeze), #166 mask |
| C | **B + Knuth–Plass** (port §3 as a pure module): optimal breaks on the translated tokens | best raggedness across languages | medium | #180 (KP) |
| D | **rw/bw discriminator** (cheap lever): when `rw/bw < ~0.72`, route the region to clean-layout (narrow) instead of bubble-fit | fixes the bubble-fit-steals-narration case only; does not fix EN clean-layout wide wrap | low | — |
| E | **B/C + auto-vertical** (§4, #182) for tall-narrow target boxes | full parity incl. vertical target | high | #182 |

Trade-off summary: **D** is the cheapest partial fix (kills the `bubble_area_fit`-on narration-wide regression) but leaves EN clean-layout wrapping wide. **B** is the smallest change that is genuinely source-agnostic for *both* paths. **C** adds typographic quality (needed for long Latin lines). **E** completes parity but is the largest.

## 5. Recommendation

Pursue **C = B + Knuth–Plass**, staged, behind an opt-in flag with A/B gating (PRD #434), keeping **A** as the baseline:

1. **Slice 1 — target-space width derivation + squeeze (B).** Replace, *behind the flag*, the wrap-width source: balloon regions wrap to the balloon safe-area width and squeeze ×0.90 vs the mask; OSB/narration wrap to the padded target bbox. This alone makes both paths source-agnostic and is demoable on EN-source narration.
2. **Slice 2 — Knuth–Plass DP (C) via #180** as the wrapper inside the flagged path.
3. **Defer auto-vertical (E/#182)** to a separate concern (target-orientation, not wrap-width).
4. Ship **D (rw/bw)** only if an immediate partial relief is wanted before B lands — it is cheap and safe but partial; log it as such.

Rationale: B/C is exactly MangaTranslator's mechanism (§2), is source-agnostic by construction (no per-orientation branch — aligns with the Engineering North Star of removing the source-dependency rather than adding orientation branches), and reuses existing issues (#180 KP, #183 squeeze, #166 mask). The A/B gate (§3) protects the known-good JP baseline until the metrics prove the switch.

## 6. Links
- PRD #434 (parent, research-gated). Implementation issues to lean on: #180 (Knuth–Plass), #183 (squeeze), #182 (auto-vertical), #432 (S4 unify). Detection-layer sibling: #436 (stylized double-detection). Emphasis/font: #171 P2.
- Prior memory: `project_mit_175_dialogue_path.md` (residuals 1–3, rw/bw data), `project_render_parity_direction.md`.
