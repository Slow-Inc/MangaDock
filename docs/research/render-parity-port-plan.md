# Render-Parity Port Plan — borrowing MangaTranslator's render polish

> 2026-06-09. Grounded in a render-path dig of the **MangaTranslator** (meangrinch) clone at
> `C:\Github\MangaDock\MangaTranslator`. Companion to docs/research/translator-deep-dissection.md.
> Every "THEIRS" claim cites `file:line` in that clone; verify before relying.
>
> Context: after fixing the in-app overflow (a backend knob-gating config gap, see
> `.claude/memory/project_render_knob_gating.md`), our best render (`MIT/tools/ab_parity.py` →
> `parity_montage.png`) still trails MangaTranslator's reference (`MIT/example_translation.jpg`) on
> the gaps below. This plan maps each visual gap → their mechanism → our adoption.

## Two corrections to earlier assumptions
- **ALL-CAPS is real render-side code**, not just a prompt: `core/pipeline.py:1375` `text = text.upper()`
  runs on every region's translation before render (`placeholders.py:124` re-uppercases OSB text).
- **SFX uses a dedicated detector after all**: `ModelType.YOLO_OSBTEXT = deepghs/AnimeText_yolo`
  (`yolo12x_animetext/model.pt`, `model_manager.py:126,193`) — matches our original #168 plan.

## Gap to mechanism to adoption

| # | Visual gap | THEIRS (mechanism + file:line) | OURS — adoption | Cost |
|---|-----------|--------------------------------|-----------------|------|
| A | mixed-case vs ALL-CAPS | `pipeline.py:1375` `text.upper()` before render, unconditional | uppercase ENG translation behind `en_uppercase` knob (`MIT_EN_UPPERCASE`) | trivial |
| B | thin vs bold strokes | no shipped font — `font_dir:"./fonts"` BYO; weight is the font itself (dialogue `outline_width=0`); separate bold file by keyword (`font_manager.py:231-442`); markdown bold to bold typeface | swap `en_comic_font` to heavier `anime_ace_3.ttf` (already in `MIT/fonts/`) or faux-bold via glyph stroke (`drawing_engine.py:186-202`) | small |
| C | small vs bubble-filling | binary-search largest-fit + collision vs real mask + width squeeze x0.90 up to 3x before shrinking font (`layout_engine.py:726-809`) | we have binary search (#166) but `_MAX_FONT_BOX_RATIO=0.5` (#175) caps it small to relax cap + add width-squeeze-then-grow using #179 safe-area interior width | medium |
| D | greedy vs Knuth-Plass | DP, badness=slack^`badness_exponent`(3.0), `hyphen_penalty`=1000, hyphenate words >=`hyphenation_min_word_length`(8); no kinsoku (`text_processing.py:489-579`,`373-387`) | port the DP as a pure module to #180 (unblocked) | medium |
| E | `ぬ〜` kept vs LOOM | AnimeText YOLO (`deepghs/AnimeText_yolo`) detects outside-bubble text to expand bubble box to OCR to translate to uppercase to render (`detection.py:128-164`) | wire SFX/OSB detection to #168 (model download APPROVED 2026-06-09) | large |
| F | text vanishes into art | dialogue outline 0; OSB/SFX outline 3px contrast-by-luminance (`drawing_engine.py:186-202`,`config.py:150`) | add contrast stroke for OSB/SFX glyphs (do alongside #168) | small |

**Already at parity:** bubble-seg = same model `kitsumed/yolov8m_seg-speech-bubble` (#170); supersampling
4x (theirs LANCZOS both ways, ours INTER_AREA downscale — approx equal); binary-search fit (#166).

## Implementation order (impact / effort)
1. **A** ALL-CAPS — biggest identity shift, smallest change.
2. **C** relax font cap + width-squeeze — fills bubbles like theirs.
3. **B** heavier font / faux-bold.
4. **D** #180 Knuth-Plass DP port.
5. **E+F** #168 SFX via AnimeText + OSB outline (model approved).

All render knobs stay opt-in (byte-identical when unset), wrapped in the existing `bubble_area_fit`
render path in `MIT/manga_translator/rendering/__init__.py`.
</parameter>
</invoke>
