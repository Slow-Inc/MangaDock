"""pydensecrf fallback hardening (#251).

When the optional `pydensecrf` dep is missing, `refine_mask` returns the raw
(un-CRF'd) mask — without DenseCRF the mask doesn't tighten to glyph strokes, so a
deploy missing the dep silently degrades text removal. The fix warns **once** (not
silent, not per-call) so the missing dep is visible. No ML model is imported.
"""
import logging

import numpy as np

import manga_translator.mask_refinement.text_mask_utils as tmu


def test_refine_mask_returns_raw_and_warns_once_when_crf_unavailable(caplog, monkeypatch):
    monkeypatch.setattr(tmu, 'PYDENSECRF_AVAILABLE', False)
    monkeypatch.setattr(tmu, '_warned_no_crf', False)
    rgb = np.zeros((6, 6, 3), np.uint8)
    raw = np.zeros((6, 6), np.uint8)
    raw[2:4, 2:4] = 255

    with caplog.at_level(logging.WARNING):
        out1 = tmu.refine_mask(rgb, raw)
        out2 = tmu.refine_mask(rgb, raw)

    assert np.array_equal(out1, raw)                                   # raw passthrough
    assert np.array_equal(out2, raw)
    crf_warnings = [r for r in caplog.records if 'pydensecrf' in r.getMessage().lower()]
    assert len(crf_warnings) == 1                                     # warned exactly once
