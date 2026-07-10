# Technical brief — narrow-tall Thai caption render "clip" (p13 True-Ending box)

> **Purpose:** hand a fresh planning session everything needed to design a fix. The symptom is
> user-reported ("text ขาดไปบางส่วน"); root-cause is partially isolated but NOT solved. Text is NOT lost
> (payload complete) — this is a RENDER-quality/geometry issue on tall-narrow caption boxes with long Thai
> text. A quick width-margin fix was tried and reverted (see §5).

## 1. Symptom
On the p13 (Last Arcanum / Otome chapter `c1abfbeb`, page `ds12.jpg`) middle "True Ending" caption box, the
rendered Thai text has its **leading character(s) of each line visually cut** at a clean vertical left edge.
E.g. payload `ฉากจบที่...` renders as `ากจบที่...` (the ฉ loop cut → looks like ว), `ที่ฉัน...` → `นยัง...`.
The user circled this box across two screenshots. Same class likely affects any **narrow, tall caption box
holding a long Thai sentence** rendered via the `clean_layout` branch.

## 2. What is NOT the cause (ruled out with data)
- **Not translation/text loss.** The `/patches` payload `dst` is complete on all 5 sampled runs
  (e.g. `ฉากจบที่ฉันยังไม่ได้ดูคือฉากจบที่แท้จริง`, `อีนดิ้งที่ฉันยังไม่ได้ดูคือ อีนดิ้งแท้`). Translation is
  non-deterministic (different wording each run) but never truncated in the payload.
- **Not the dst-box width being too small (mostly).** Live instrumentation (temporary `[CLIPDBG]` log in
  `render()`): for this box `norm_h(dst width)=123`, `temp_box(rendered text, post-ss-downscale) w=129,h=83`.
  The text block is only ~5% wider than the dst box → a 5% horizontal squish, NOT a gross clip. Widening the
  box did not remove the visual cut (§5).

## 3. Live diagnostic numbers (the one instrumented run)
```
[CLIPDBG] norm_h=123 norm_v=120 _wrap_w_ss=492 temp_box(w,h)=(129,83) r_temp=1.55 r_orig=1.02
```
- `norm_h/norm_v` = dst-box width/height from `dst_points` (≈123×120, nearly square).
- `_wrap_w_ss = 492` = `norm_h*ss` (123×4) — the item-9 `longest_token_width` floor did NOT widen it here.
- `temp_box=(129,83)` = the tight-cropped rendered text after the ss=4 downscale: **wide-short** (r_temp 1.55)
  vs the **square** dst box (r_orig 1.02). So `render()` pads the text block's HEIGHT (`_pad_box(pad_height)`)
  then warps 129×~125 → 123×120.
- Region telemetry: detection `xyxy=[352,1211,448,1333]` (96×122), caption `bubble_box=[330,1117,468,1436]`
  (138×319, tall), `dst_box=[364.5,1212,435.5,1332]` (71×120 before the reverted margin), `font_final_px=20`,
  `branch=clean_layout`.

## 4. Code path (all in `MIT/manga_translator/rendering/`)
1. `_clean_layout_dst()` (`__init__.py:162`) computes `(font_size, block_w, block_h)`. block_w = max wrapped
   line width from `calc_horizontal` at the base font, floored per-token by `_floor_w` (hyphenation-aware;
   Thai words floor at whole-token width). `resize_regions_to_font_size` builds `dst_points =
   centered_box(cx, cy, block_w, block_h)`.
2. `render()` (`__init__.py:714`), horizontal branch:
   - `_wrap_w_ss = max(round(norm_h[0]*ss), longest_token_width(font*ss))` (`:756`) — item-9 floor to stop
     Thai/CJK mid-word splits at ss=4.
   - `put_text_horizontal(font*ss, text, _wrap_w_ss, norm_v*ss, ...)` renders the ss canvas.
   - downscale `/ss` with `INTER_AREA` (`:782`) → thins strokes.
   - `_pad_box` to match `r_orig` aspect (`:793-806`), then `findHomography` + `warpPerspective` (`:812-816`),
     then **crop to `boundingRect(dst_points)`** (`:817-825`).
3. `put_text_horizontal()` (`text_render.py:1213`): builds a canvas `canvas_w = max(line_width_list) +
   (font+bg)*2` (`:1228`), pen starts at left margin `font+bg`, renders glyphs by `horiAdvance`, then
   **returns `line_box[y:y+h, x:x+w]` = boundingRect crop to the ink** (`:1270`). NB: `calc_horizontal`'s
   `line_width_list` is an *estimate*; if the real glyph advances exceed it, the last glyphs overrun `canvas_w`
   and clip at the RIGHT canvas edge — but the observed cut is on the LEFT.

## 5. What was tried and REVERTED
- **block_w breathing margin** (`block_w + clean_fs*0.5`, then `*2.0` to test): commit `67167505`, reverted
  by `09150636`. Widening the dst box did not remove the left cut and, at `*2.0`, pushed the box wider than
  the caption `bubble_box` → text overflowed the box on the RIGHT. Conclusion: the cut is NOT primarily a
  dst-width problem. HEAD is back to the clean pre-attempt state.

## 6. Leading hypotheses (unverified — for the planner to weigh)
- **H1 — ss-downscale stroke thinning.** `INTER_AREA` downscale of a ss=4 canvas thins the delicate Thai
  loops (ฉ, ฉั) at ~20px final font; on a narrow box the leftmost thin stroke reads as "cut". Fix direction:
  a heavier stroke/border for small fonts, or a different downscale filter, or render nearer 1× for small
  fonts. RISK: touches every rendered glyph → needs the golden test + a full regression sweep.
- **H2 — `_pad_box`/homography places the text block off-centre.** `_pad_box(pad_height, ext, offset)` with
  `offset` semantics (`:689-711`); if the wide-short temp_box is centred wrong when mapped into the square
  dst box, the block sits slightly left → left glyphs land outside `boundingRect(dst_points)` and get cropped
  (`:825`). Instrument the actual warped-text extent vs the crop box to confirm.
- **H3 — `calc_horizontal` vs `put_text_horizontal` width disagreement.** block_w uses `calc_horizontal`'s
  estimate; the real render can be a few px wider per line → the block overruns the tight dst box on both
  sides, clipped by the `boundingRect` crop; we notice the left. Fix: measure with the real renderer, or add
  a small symmetric inset that also shrinks the font so it can't overflow (unlike the reverted pure-widen).

## 7. Reproduce + instrument (worker recipe)
- Worker: run from the temp worktree venv, `MIT/.venv` (cu121), on port 5003. Launch:
  `cd MIT && python -u server/main.py --host 127.0.0.1 --port 5003 --use-gpu --start-instance`; poll
  `/ready` until `{"ready":true}` (~8-16 s).
- Render the page (full-page path, prod-faithful config) via `POST /translate/with-form/patches` with
  `inpainter.full_page_inpaint=true`, `render.clean_layout=true, font_size_max=20, supersampling=4,
  bubble_area_fit=true, anti_overlap=true`, `ocr.prob=0.03, ocr.vlm_rescue=true`, `detector.text_threshold=0.3,
  det_bubble_seg=true, det_sfx=true`. Composite `patches[].img_b64` onto the source.
- Source page (LOCAL): `Backend/img-cache/_chapters/chapters/c1abfbeb-ced9-4595-bb43-7c9242d0a0a1/ds12.jpg`.
  The True-Ending region is identified by `src` containing `ENDING` and NOT `SCUM`.
- Instrumentation used: a one-line `logger.warning("[CLIPDBG] ...")` after the ss downscale in `render()`
  (`__init__.py:~787`), gated to `render_branch=='clean_layout' and 'จบ' in translation`. The worker's caught
  render exception can be surfaced by appending `\n{traceback.format_exc()}` to the warning at
  `patch_renderer.py:277` (revert after).
- Non-determinism: render 2-3× and eyeball; the clip is consistent across runs even though the wording changes.

## 8. Constraints for the fix
- MUST NOT regress the many render fixes landed this session (One-Punch narration columns, SFX display/dedup,
  bubble_fit_tall, clean_layout squeeze). Owned suites: `test_render_telemetry.py`, `test_render_golden.py`
  (byte-identical snapshot — a global-font or downscale change will trip it, intentionally), `test_render_overlap.py`.
- Any glyph-render change (H1) is pipeline-wide → gate behind the golden test + a One-Punch p1/p2 EN+THA
  regression sweep (see `docs/reports/benchmarks/2026-07-05-regression-sweep.md` for the baseline recipe).
- TDD is required (RED→GREEN). The synthetic golden test could NOT reproduce the exact clip (put_text('') and
  a plain blank region don't trigger it) — the reliable signal is the LIVE render of ds12 + eyeball, so the
  plan should include a live-verification step, not only unit tests.

## 9. Pointers
- Branch: `landing/render-phase0` (worktree `C:\Users\xenod\AppData\Local\Temp\mp2-deploy-build`), 77 commits
  ahead of the perf tip `efdf9c3c`, NOT merged (Phase 3 convergence pending — see
  `docs/reports/2026-07-05-phase3-convergence-plan.md`).
- Related: item-9 ss floor (`longest_token_width`, commit `57c6c75d`), clean_layout squeeze
  (ADR 007 + `docs/reports/mit-refactor-progress.md`), the render pipeline (ADR 004/022).
- Sibling minor still open: p31 name-box faint underline residual (decorative ornament / partial-inpaint
  ghost) — separate from this clip.
