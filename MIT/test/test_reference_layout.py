"""#178/#175 Phase 4 — reference layout engine (master plan `docs/prd/mit-render-defect-master-plan.md`).

Port MangaTranslator's proven fit: binary-search the font DOWN from a cap to the largest that fits
BOTH axes of the balloon SAFE-BOX (not the source column — the 2026-07-02 learning), failing loud at
the minimum rather than overflowing. This file drives the pure fit core; the measure fn is injected so
the search logic is deterministic and font-free.
"""
from manga_translator.reference_layout import fit_to_box


def test_fit_to_box_finds_largest_font_that_fits_both_axes():
    # fake measure: block grows linearly with font (w = font*5, h = font*8).
    measure = lambda f: (f * 5, f * 8)
    # box 100x160 → width allows font ≤ 20, height allows ≤ 20 → 20 (the binding axis wins).
    assert fit_to_box(measure, box_w=100, box_h=160, cap=40, min_fs=8) == 20
    # narrower box 50x160 → width now binds at font ≤ 10.
    assert fit_to_box(measure, box_w=50, box_h=160, cap=40, min_fs=8) == 10
    # nothing fits even at the minimum → return min (fail-loud, never overflow past the floor).
    assert fit_to_box(measure, box_w=10, box_h=10, cap=40, min_fs=8) == 8
