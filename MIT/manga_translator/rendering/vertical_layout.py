"""#182 — pure auto-orientation + vertical stacking geometry (font-free).

`auto_orientation` decides horizontal vs vertical for a Latin region from its box
aspect + text shape (manga rule: tall-narrow, short, single-word -> vertical).
`vertical_layout` computes per-glyph (x, y) stack positions from advances + box,
wrapping to the next column when a column fills. Both pure (no freetype) so the
gate thresholds + column math are unit-testable with stub advances. Wiring into
the render path is slice 2 (behind render.auto_vertical / render.bubble_area_fit)."""
from typing import List, Tuple


def auto_orientation(box_h: int, box_w: int, char_count: int, word_count: int, *,
                     min_aspect: float = 1.6, max_chars: int = 12, max_words: int = 1) -> bool:
    """True -> stack vertically. Matches MangaTranslator's gate: a tall-narrow box
    (height/width >= ``min_aspect``) holding short (<= ``max_chars``) single-token
    (<= ``max_words``) text. Anything else renders horizontally. ``box_w == 0`` is
    treated as infinitely tall-narrow (aspect passes)."""
    if char_count > max_chars or word_count > max_words:
        return False
    aspect = float('inf') if box_w <= 0 else box_h / box_w
    return aspect >= min_aspect


def vertical_layout(advances: List[int], box_h: int, col_width: int = 0, *,
                    tracking: float = 0.90) -> List[Tuple[int, int]]:
    """Per-glyph (x, y) positions stacking top->down, wrapping to a new column when
    the next glyph would overflow ``box_h``. Each glyph steps y by
    ``advance * tracking`` (the manga VERTICAL_ADVANCE_TRACKING). A new column shifts
    x by ``col_width`` and resets y. The first glyph of a column is always placed
    (even if taller than the box) so an oversized glyph cannot loop forever. Pure
    geometry — ``advances`` are the per-glyph vertical advances in px (the caller
    supplies real freetype advances)."""
    positions: List[Tuple[int, int]] = []
    x = 0
    y = 0
    col_has_glyph = False
    for adv in advances:
        step = int(round(adv * tracking))
        if col_has_glyph and y + step > box_h:
            x += col_width      # wrap to next column
            y = 0
            col_has_glyph = False
        positions.append((x, y))
        y += step
        col_has_glyph = True
    return positions
