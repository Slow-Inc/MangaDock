"""Switching fonts must actually change the glyphs that get rendered (#680).

`get_char_glyph` is memoised on `(cdpt, font_size, direction)`. That key says nothing about
which font is loaded, and `set_font()` swaps the module-global `FONT_SELECTION` underneath it —
so every character/size already in the cache keeps rendering with the PREVIOUS font: wrong
letterform and wrong advance, i.e. wrong wrap widths.

Not hypothetical: a worker process calls `set_font()` from `dispatch_render` (configured font),
`dispatch_eng_render` (comic shanns) and `dispatch_eng_render_pillow` (NotoSansMonoCJK), so any
request that follows one with a different font is served stale glyphs. It also made four
characterization goldens fail on `integrate/render-reconcile` depending only on test ORDER.

Tested through the public seam — `set_font()` in, rendered advance out — not by inspecting the
cache, so the fix is free to change how invalidation is implemented.
"""

from pathlib import Path

import numpy as np

from manga_translator.rendering import text_render as tr

_FONTS = Path(__file__).parent.parent / 'fonts'
_PROMPT = str(_FONTS / 'Prompt-Bold.ttf')


def _advance(char='A', font_size=48):
    """Render one glyph on a scratch canvas and return the advance the renderer used."""
    text = np.zeros((160, 160), dtype=np.uint8)
    border = np.zeros((160, 160), dtype=np.uint8)
    return tr.put_char_horizontal(font_size, char, [40, 110], text, border, 4)


def test_advance_follows_the_font_that_is_currently_set():
    tr.set_font(_PROMPT)
    prompt_advance = _advance()

    tr.set_font('')                      # back to the fallback fonts
    fallback_advance = _advance()

    assert fallback_advance != prompt_advance, (
        'the renderer returned the previous font\'s advance after set_font() — '
        'the glyph cache is keyed without the font and was never invalidated'
    )


def test_re_setting_the_same_font_keeps_the_cache():
    """Rules out the tempting fix: clearing unconditionally inside set_font().

    `dispatch_render` calls `set_font(font_path)` on EVERY request, so an unconditional
    `cache_clear()` would throw the whole glyph cache away once per page and re-rasterise
    every character from freetype. This test reaches into `cache_info()` on purpose —
    the invariant being pinned IS about the cache, so there is no behavioural proxy for it.
    """
    tr.set_font(_PROMPT)
    _advance('B')
    _advance('C')
    populated = tr.get_char_glyph.cache_info().currsize
    assert populated > 0, 'precondition: rendering should populate the glyph cache'

    tr.set_font(_PROMPT)                 # same font again — the per-request case

    assert tr.get_char_glyph.cache_info().currsize == populated, (
        'set_font() dropped the glyph cache even though the font did not change — '
        'that is one full cache rebuild per render request'
    )
