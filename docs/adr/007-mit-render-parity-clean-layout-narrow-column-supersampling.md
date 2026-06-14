# ADR 007 — Render parity with the MangaTranslator reference: clean-layout, narrow-column, supersampling, EN comic font, ALL-CAPS

- **Status:** Accepted (2026-06-14) — **implemented, default-off.** Every lever below is in-tree and
  load-bearing, but each is an **opt-in `RenderConfig` knob that defaults to its identity value**
  (`clean_layout=False`, `supersampling=1`, `en_comic_font=False`, `en_font=None`,
  `font_size_max=0`, `anti_overlap=False`, `uppercase=False`, `font_max_box_ratio=0.5` ==
  the prior #175 cap). With no `MIT_*` env overrides the render path is **byte-identical** to the
  legacy warp-onto-quad behaviour. The decision documents the *target* the renderer was retuned
  toward; the parity look ships only when the backend sets the knobs (dev `Backend/.env`, not
  committed — see `project_render_knob_gating`).
- **Area:** MIT (text-rendering / typesetting path; backend env→config glue in `books.service.ts`)
- **Context PRD:** #181 (render parity) · cascades into #186 (footprint-aware wrap) and #180
  (Knuth-Plass line breaking, not yet done)
- **Codifies:** the `.claude/memory/project_render_parity_direction.md` direction decided 2026-06-08
  and reworked 2026-06-13 (PRs #263/#264)
- **Relation to siblings:** the *erase/inpaint* side of "look like a human typeset it" is ADR 002
  (luminance reground), ADR 005 (classical CPU refinement levers), ADR 003 (optional Flux inpainter).
  This ADR is the *typesetting* side — what the translated glyphs look like once the plate is clean.

## Context

Side-by-side against the meangrinch/MangaTranslator reference (One Punch-Man JA→EN benchmark page),
our output "looked like a novel, theirs looked like a manga." The root cause was **not** font size:
MIT's `render()` rasterises the translated English onto a canvas and then **homography-warps it into
the original Japanese detection quad**. A JP narration column is a **tall, narrow vertical quad**, so
horizontal English warped into it gets **stretched oversized and overflows** the panel; no font knob
(`font_size_offset`, the #166 area-fit, `font_max_box_ratio`) could fix this cleanly because the
distortion *is* the warp (`project_render_parity_direction`, 2026-06-13 update).

The forces:

- **Visual-quality / retention promise.** The product bet is "as close to a human typesetter as
  possible" (`project_translation_northstar`). Render parity is the most visible half of that bet.
- **No convergence from independent tuning.** The reference already solved this with a coherent set
  of choices (narrow-column wrap to the mask interior, small absolute fonts, supersampling, a comic
  face, ALL-CAPS). Re-deriving an independent heuristic kept missing.
- **Zero-regression constraint.** The same renderer serves every language (incl. the worker's Thai
  default face). Any parity change had to be opt-in and identity-by-default so non-EN / unset paths
  stay byte-identical, and so it can be rolled back without a redeploy.

## Decision

Retarget the MIT renderer toward the MangaTranslator reference instead of warping English onto the
JP detection quad, via a family of **opt-in `RenderConfig` knobs** (`MIT/manga_translator/config.py`
`RenderConfig`), all default-off / identity, wired through `stages.py:run_text_rendering`
(lines 76–84) → `rendering/__init__.py:dispatch`/`resize_regions_to_font_size`/`render`:

1. **`clean_layout` — upright horizontal block, no warp** (`config.py` `clean_layout`;
   `rendering/__init__.py:158-186` `_clean_layout_dst`, applied at `258-277`). For non-balloon,
   non-SFX regions (narration, captions, vertical-JP columns), the translation is laid out as an
   **upright horizontal block at a small absolute font** placed on the region centre via
   `centered_box` (`render_overlap.py:28`), with `region._direction='h'` forced (line 274). The
   homography in `render()` then becomes a plain scale, not a tall stretch. SFX is exempt
   (`region.sfx_rescued` → keeps the big stylised legacy path).

2. **Narrow-column wrapping to the bubble's safe interior** (`rendering/__init__.py:100-117`
   `_bubble_interior_box`; `safe_area.py:safe_area_box`). When the #170 balloon polygon is carried,
   it is rasterised and a distance-transform + pole-of-inaccessibility anchor measures the **largest
   centred box that fits the mask's *safe interior***, so English reflows into the balloon's true
   (narrow) shape, not its bounding box. For clean-layout regions, `clean_wrap_width`
   (`render_overlap.py:38-46`) wraps to the region's **own source-bbox width** (`x2f-x1f`, clamped to
   11–45% of page width), so the break points follow the original columns rather than reflowing into
   a wide paragraph (the #186/#264 "doesn't reference the original line-breaks" fix). The balloon box
   is deliberately *not* used as the wrap reference for narration.

3. **`supersampling` — render Nx then downscale** (`config.py` `supersampling`;
   `rendering/__init__.py:483-540`). `put_text_*` runs at `font_size * ss` on an `ss`× canvas, then
   `cv2.resize(..., INTER_AREA)` downscales — crisper glyphs and controlled stroke weight. `ss=1` →
   byte-identical.

4. **EN comic font, with BYO override** (`manga_translator.py:955-974` `_render_font_path`). For
   `target_lang == 'ENG'`, `en_font` (a filename in `fonts/`) takes precedence, else `en_comic_font`
   selects the bundled `fonts/comic shanns 2.ttf`; otherwise the worker's default `self.font_path`
   (Prompt-Bold, a Thai face) is kept. Both `fonts/comic shanns 2.ttf` and the BYO option
   `fonts/anime_ace_3.ttf` are present in the repo. (The legacy `manga2eng` renderer's
   `dispatch_eng_render` also hard-defaults to `comic shanns 2.ttf` at `rendering/__init__.py:593`.)

5. **`uppercase` → ALL-CAPS** (`config.py` `uppercase`; applied in `region_apply.py:14-20`
   `apply_render_casing`, called on the single-page path). Mirrors the reference's ALL-CAPS
   lettering. (Independently, the `manga2eng` word-segmenter `text_render_eng.py:102` already
   uppercases unconditionally; the *gated, language-neutral* knob is `render.uppercase`.)

6. **Absolute font cap + anti-overlap** (supporting levers): `font_size_max` caps non-SFX font so
   the length-ratio heuristic can't oversize a block (`apply_font_cap`, `render_overlap.py:18-25`;
   and it also pins `final_scale=1.0` at `rendering/__init__.py:356-357` so the homography doesn't
   re-inflate the capped font); `font_max_box_ratio` caps the #166 bubble-fit font at a fraction of
   balloon height (default 0.5); `anti_overlap` clamps each region's box off its neighbours'
   territory before sizing (`clamp_box_to_neighbors`, `render_overlap.py:49-84`).

**Backend exposure.** `Backend/src/books/books.service.ts:buildMitConfig` maps env → config,
each guarded so an unset var omits the field (byte-identical): `MIT_CLEAN_LAYOUT`,
`MIT_SUPERSAMPLING`, `MIT_EN_COMIC_FONT`, `MIT_EN_FONT`, `MIT_EN_UPPERCASE`, `MIT_FONT_SIZE_MAX`,
`MIT_ANTI_OVERLAP`, `MIT_FONT_MAX_BOX_RATIO` (lines 725–747). `renderConfigHash()`
(`books.service.ts:559-566`) hashes **all** `MIT_*` env vars into the translated-patch cache key, so
toggling any render knob busts the cache and avoids serving a stale render.

## Alternatives considered

- **Bespoke independent render heuristic** — rejected. The reference already encodes a coherent,
  internally-consistent design (interior-mask wrap + small absolute font + supersampling + comic
  face + ALL-CAPS); re-deriving these one knob at a time kept failing to converge on the same
  "manga, not novel" look (`project_render_parity_direction`). Porting the reference's *approach*
  (e.g. `safe_area.py` is a direct port of its distance-transform/pole-of-inaccessibility anchor) is
  cheaper and reaches parity.

- **Keep warping EN onto the JP detection quad** (the prior default) — rejected. Measured to be the
  *cause* of "narration big / overflowing": a tall narrow JP quad stretches horizontal English
  oversized, and no font knob fixes it cleanly because the distortion is the warp itself
  (`project_render_parity_direction` 2026-06-13). It survives only as the default-off legacy path for
  byte-identical fallback.

- **Upstream `dispatch_eng_render` / `manga2eng` renderer** (`rendering/__init__.py:588-606`) —
  rejected as the parity target: too minimal for our needs (horizontal-only, its own fixed casing /
  font assumptions). It remains selectable via `Renderer.manga2eng`, but the parity work lives in the
  `default` renderer's `resize_regions_to_font_size`/`render` path so it composes with bubble-fit,
  SFX, and anti-overlap.

## Consequences

- **Positive:** defines the user-facing typesetting aesthetic (the retention-facing half of the
  translation north star) as a single documented direction rather than scattered knobs; the clean
  upright-block layout removes the oversized/overflowing narration that warping caused; narrow-column
  wrap to the mask interior makes English break where the JP columns did; supersampling + the comic
  face + ALL-CAPS give the "comic" read. Every lever is **opt-in and identity-by-default**, so
  non-EN languages, the unset path, and rollback are all byte-identical (verified by
  `Backend/src/books/books-mit-config.spec.ts`). Decision is grounded in side-by-side benchmark
  comparison, not eyeballing a single render.

- **Negative / limits:** the parity look is **config-dependent** — setting only *some* knobs silently
  falls back to the legacy overflowing path (the #166/#170/#179 area-fit machinery only runs inside
  the `bubble_area_fit` branch), a real footgun documented in `project_render_knob_gating`.
  `supersampling=4` multiplies the per-region render cost (canvas area ∝ ss²) before the downscale.
  The clean-layout wrap is still a greedy width wrap, not optimal line breaking. The "parity" is
  visual/approximate (~90–95% in the live benchmark), not pixel-exact. The render knobs live in the
  cache key, so any change forces a re-translate of cached patches.

- **Follow-ups:** #186 (footprint-aware wrap) is landed via `clean_wrap_width`; it unblocks #180
  (Knuth-Plass / optimal line breaking) to replace the greedy wrap. Vertical *true* manga stacking
  (reference `_build_vertical_layout`) and the SFX path (#168 detector + VLM-OCR rescue) remain
  separate tracks feeding the same parity goal.
