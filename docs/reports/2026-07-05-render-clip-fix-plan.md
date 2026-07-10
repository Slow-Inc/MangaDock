# Fix plan — first-glyph loss on tall-narrow Thai captions (p13 True-Ending)

> Companion to `2026-07-05-render-clip-brief.md`. Planned on Fable 5 after a full re-derivation of the
> render geometry. **Key reframe:** the zoom evidence shows the WHOLE first character of each line missing
> ("ฉากจบที่"→"ากจบที", "ฉันยังไม่"→"นยังไม่") — the "vertical cut" is the aligned column of missing first
> glyphs, not a pixel crop. Two independent walkthroughs of `render()` (warp src-box→dst_points, then crop at
> `boundingRect(dst_points)`) prove that stage CANNOT produce a hard cut: everything warped lands inside the
> crop by construction. Therefore the loss originates either at TEXT level (the line strings already lack the
> glyph) or PIXEL level inside `put_text_horizontal`'s canvas, or at PATCH-ALPHA level — three cheap,
> mutually-exclusive checks.

## Step 0 — text-level check (cheapest, most likely)
Instrument `put_text_horizontal` (temporary `print`, worker stdout → `_phase0_worker.log`):
log `repr(line_text_list)` + `line_width_list` + requested `width` when `'จบ' in text`.
- **If lines print as `['ากจบที่', …]`** → the first cluster is lost in TEXT: suspects are the
  `calc_horizontal` line-assembly (ZWSP-token → line join), `_split_into_syllables` char-split path, or a
  strip/slice on the line string. Fix in `calc_horizontal` with a pure unit test (`text_render` is
  import-light — sub-second tests) asserting `''.join(lines).replace(ZWSP,'') == text.replace(' ','')`
  (glyph conservation).
- **If lines print complete (`['ฉากจบที่', …]`)** → go to Step 1.

## Step 1 — pixel-level dump (only if Step 0 shows complete lines)
Same gate; dump to `MIT/_render_dump/`:
(a) `line_box` post-crop from `put_text_horizontal` (is ฉ ink present in the returned canvas?),
(b) `temp_box` after ss-downscale in `render()`,
(c) the final composited crop + the `changed_alpha` mask for that area.
Decision:
- missing already in (a) → `_paste_bitmap`/pen placement clips the first glyph on the ss canvas
  (suspect: first-glyph `place_x` computed with a negative/mis-scaled bearing at ss, or the
  `boundingRect(canvas_border)` crop when the border pass fails for the first glyph). Fix at the placement,
  unit-testable by rendering a Thai line to a canvas and asserting ink columns > 0 at the left edge.
- present in (a)+(b) but missing in (c) → patch-alpha/compositing; inspect `changed_alpha` mask (is the
  first-glyph area transparent because rendered ≈ original there? e.g. the glyph landed on the caption's
  black border → black-on-black diff < 8 → transparent → ORIGINAL border shows and the glyph vanishes).
  Fix: OR the text-render mask into the alpha (the renderer knows exactly which pixels it drew).

## Step 2 — implement the confirmed branch (TDD)
- One failing unit test at the confirmed layer FIRST (glyph-conservation / left-edge-ink / alpha-covers-text).
- Surgical fix; keep `test_render_golden.py` byte-identical unless the fix is deliberately glyph-global
  (then regenerate the golden intentionally and say so).

## Step 3 — verify per the benchmark rules
1. ds12 live ×2 (non-det wording; the defect must be gone in both) — zoom the TE box.
2. Re-check the neighbours this session already fixed: One-Punch boy panel (A2), p10 ME-OFF, p31 SCUMULTOS,
   p13 SFX (dedup/cap) — one render each.
3. Owned suites + regression sweep p1/p2 EN+THA if any glyph-global change.
4. Commit MD+PNG benchmark; SendUserFile for confirm; remove ALL temporary instrumentation.

## Rollback
Every step is one commit; revert the fix commit restores today's clean state (`09150636`).

---
## OUTCOME (executed same session, Fable 5)

**Step 0/1 decisive result:** text-level COMPLETE (`lines=['ออปชั่นจบ', …]`), put_text canvas dump COMPLETE →
loss occurred at COMPOSITING. The cut x=369 matched the SCUM group crop's right edge exactly.

**Confirmed root:** full-page-inpaint path — every group's crop carries the WHOLE page's inpainted background,
so `changed_alpha(rendered, original)` also marked FOREIGN erasures opaque; a later patch painted
inpainted-white over an earlier patch's text along its crop edge. Mirrored twin of the ME-OFF resurrection.

**Fix:** `own_work_alpha` (pure, TDD `086f9277`): a patch composites only (1) text it drew
(rendered != background snapshot — render() draws in-place, so the slice is snapshotted first) and
(2) erasure inside its OWN region zones. Per-crop path unchanged.

**Verified:** TE box ×2 runs — first glyph present every line; ME-OFF still gone; instrumentation removed
(`fd27ff4e` also hardened the A1 white-box erase with an absolute both-dims art-CC gate).

**New finding while verifying (separate, filed):** the One-Punch boy figure ghosts FLAKILY even at prod
threshold — a legit dialogue region (俺には関係ない…, xyxy reaching y=584) overlaps the boy's head; the CRF
refinement sometimes classifies his hair strokes as text inside the allowed zone (+8px margin) → erased →
LaMa smear. Pre-existing (task #20 item-11 "ghost inpaint" class), NOT introduced this session; needs its own
pass (stroke-vs-art classification in refinement, or margin tightening with characterization).
