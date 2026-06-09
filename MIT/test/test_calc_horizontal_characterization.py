"""Characterization test for calc_horizontal (#186 refactor safety net).

`rendering/text_render.py::calc_horizontal` is a ~270-line greedy wrap monolith
slated for decomposition into a pluggable LineBreaker seam (#186, unblocks #180).
Before touching it, this locks its CURRENT line-breaking behaviour on representative
strings so the extraction can be proven byte-identical. Golden values are pinned to
the bundled `Arial-Unicode-Regular.ttf` + the local freetype; regenerate if either
changes (run the strings through calc_horizontal and update GOLDEN).
"""
from pathlib import Path

from manga_translator.rendering import text_render as tr

_FONT = str(Path(__file__).parent.parent / 'fonts' / 'Arial-Unicode-Regular.ttf')

# (font_size, text, max_width, max_height, language, hyphenate) -> expected lines
GOLDEN = [
    ((40, "normal english sentences can be hyphenated", 300, 400, "en_US", False),
     ['normal english', 'sentences can be', 'hyphenated']),
    ((40, "Pneumonoultramicroscopicsilicovolcanoconiosis", 300, 400, "en_US", True),
     ['Pneumonoultra', 'microscopicsilico', 'volcanoconiosis']),
    ((40, "What should we do? We can still hide somewhere", 260, 500, "en_US", True),
     ['What should', 'we do? We', 'can still hide', 'somewhere']),
    ((40, "THIS BRAT DOESNT REALIZE WHAT HE DID YET", 240, 500, "en_US", True),
     ['THIS BRAT', 'DOESNT', 'REALIZE', 'WHAT HE', 'DID YET']),
]


def test_calc_horizontal_line_breaking_is_unchanged():
    tr.set_font(_FONT)
    for args, expected_lines in GOLDEN:
        lines, widths = tr.calc_horizontal(*args)
        assert lines == expected_lines, f"args={args!r}"
        # contract: one width per line, all positive
        assert len(widths) == len(lines)
        assert all(w > 0 for w in widths)
