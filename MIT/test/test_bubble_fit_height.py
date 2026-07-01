"""#430 item-2: bubble-fit must GROW the font to fill a tall balloon's HEIGHT (not stop early on
width and leave the balloon half-empty). Measured on the worker: dialogue that legitimately fills
the balloon width (fills_ratio 0.72-0.92) still renders at Hfill 0.12-0.51 because the font search
wraps at the full column width, binds on width, and stops before the height fills — even when the
longest word has headroom to grow (p20b "1858 เยนครับ": word fits to font ~44, but render stops at 29).

These are deterministic, font-only characterizations of `_bubble_fit_layout` (no worker/ML).
"""
from pathlib import Path
from types import SimpleNamespace

from manga_translator.rendering import _bubble_fit_layout, text_render

_FONT = str(Path(__file__).parent.parent / 'fonts' / 'Arial-Unicode-Regular.ttf')


def _fit(text, lang, box_wh):
    text_render.set_font(_FONT)
    region = SimpleNamespace(translation=text, target_lang=lang)
    font, bw, bh = _bubble_fit_layout(region, box_wh, (1000, 1000), 8)
    return font, bw, bh


# ── no-regress anchor: a WIDE balloon (One-Punch-style EN) already fills — must not change ─────

def test_wide_english_balloon_fit_is_unchanged():
    # box 240×120, "THIS BRAT…": fills both axes well today (font 28, Hfill 0.84, Wfill 0.85).
    # The tall-balloon fix must not touch this — pins the healthy wide case byte-for-byte.
    font, bw, bh = _fit('THIS BRAT IS GONNA GET US ALL KILLED', 'en_US', (240, 120))
    assert font == 28
    assert round(bw) == 204 and round(bh) == 101


# ── the fix: a TALL balloon with width-headroom must grow the font to fill the height ──────────

def test_tall_balloon_grows_font_to_fill_height_when_word_has_headroom():
    # box 123×325, "1858 เยนครับ": longest word fits up to ~font 44, but render stops at 29 and
    # only fills 32% of the height. The fix must grow the font so the tall balloon fills — the
    # word still fits the width (no mid-word break), the height is used.
    font, bw, bh = _fit('1858 เยนครับ', 'th_TH', (123, 325))
    hfill = bh / 325.0
    assert font >= 40, f'font stayed small ({font}); should grow toward the width ceiling (~44)'
    assert hfill >= 0.45, f'height still under-filled (Hfill {hfill:.2f}); tall balloon left empty'
