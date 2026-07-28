"""SFX second-pass dedup (#168, PRD #169 P1).

DBNet finds dialogue but zero stylized katakana SFX; a second detector
(AnimeText YOLO) finds the SFX. Its boxes are merged into the normal textline
flow, but any box already covered by a DBNet textline must be dropped so we
don't double-detect dialogue. Pure geometry, no ML imports — boxes are
(x1, y1, x2, y2).
"""
import re
from pathlib import Path

from manga_translator.sfx_merge import dedup_sfx_boxes


def test_sfx_detector_second_pass_is_wired():
    """#168 wiring (source-inspection, no GPU): det_sfx runs the AnimeText second
    pass, dedups against the primary textlines, and appends survivors as empty
    Quadrilateral textlines for OCR. The detector wrapper auto-downloads the gated
    model via HF_TOKEN (load_dotenv), mirroring bubble_detector (#170)."""
    base = Path(__file__).parent.parent / 'manga_translator'
    det = (base / 'sfx_detector.py').read_text(encoding='utf-8')
    assert 'deepghs/AnimeText_yolo' in det and 'yolo12x_animetext/model.pt' in det
    assert 'def detect_sfx_boxes' in det and 'res.boxes.xyxy' in det
    # #187 S15 moved the detection adapter (the det_sfx gate + merge call) into stages.py
    stg = (base / 'stages.py').read_text(encoding='utf-8')
    assert re.search(r'if\s+config\.detector\.det_sfx\s*:', stg)  # gated, opt-in (call site)
    assert 'merge_sfx_detections' in stg                          # delegates to the module
    # the merge logic itself lives in detection_postproc.py (#187 seam S13)
    dpp = (base / 'detection_postproc.py').read_text(encoding='utf-8')
    assert 'def merge_sfx_detections' in dpp
    assert 'detect_sfx_boxes' in dpp and 'dedup_sfx_boxes' in dpp
    assert 'Quadrilateral' in dpp                                 # boxes → textlines
    cfg = (base / 'config.py').read_text(encoding='utf-8')
    assert re.search(r'det_sfx:\s*bool\s*=\s*False', cfg)         # opt-in default


def test_sfx_box_far_from_dialogue_is_kept():
    existing = [(0, 0, 50, 50)]
    candidate = [(200, 200, 260, 320)]  # nowhere near the dialogue box
    assert dedup_sfx_boxes(existing, candidate) == [(200, 200, 260, 320)]


def test_sfx_box_mostly_inside_a_dialogue_box_is_dropped():
    existing = [(0, 0, 100, 100)]
    candidate = [(10, 10, 90, 90)]  # fully inside → IoA 1.0 → duplicate
    assert dedup_sfx_boxes(existing, candidate) == []


def test_all_kept_when_there_are_no_existing_textlines():
    candidate = [(0, 0, 10, 10), (50, 50, 70, 70)]
    assert dedup_sfx_boxes([], candidate) == candidate


def test_small_overlap_below_threshold_is_kept():
    existing = [(0, 0, 100, 100)]
    # candidate 100x100 at (90,90): overlaps a 10x10 corner → IoA 100/10000 = 0.01
    candidate = [(90, 90, 190, 190)]
    assert dedup_sfx_boxes(existing, candidate, ioa_threshold=0.2) == [(90, 90, 190, 190)]


# ---- #19 (Otome p10): SFX box ENGULFING an existing textline = FP on normal text ----

def test_sfx_box_containing_a_textline_is_dropped():
    from manga_translator.sfx_merge import dedup_sfx_boxes
    # thin DBNet line fully inside a big SFX candidate: IoA-over-candidate is tiny
    # (0.06) so the old check passed it -> phantom overlay on the girl's bubble.
    existing = [(100, 100, 220, 118)]              # thin text line
    candidate = [(80, 60, 260, 240)]               # big FP box engulfing it
    assert dedup_sfx_boxes(existing, candidate) == []


def test_sfx_box_far_from_text_still_kept():
    from manga_translator.sfx_merge import dedup_sfx_boxes
    existing = [(0, 0, 50, 20)]
    candidate = [(300, 300, 400, 400)]
    assert dedup_sfx_boxes(existing, candidate) == [(300, 300, 400, 400)]


# ---- #278: gate SFX rescue on det_sfx provenance, not a length heuristic ----

class _Region:
    def __init__(self, text, xyxy, is_sfx=False):
        self.text, self.xyxy, self.is_sfx = text, xyxy, is_sfx


def test_should_sfx_rescue_only_for_provenance_regions():
    from manga_translator.sfx_merge import should_sfx_rescue
    # a det_sfx-provenance region (appended by merge_sfx_detections) -> rescue
    sfx = _Region('ﾄﾞ', (10, 10, 120, 120), is_sfx=True)
    assert should_sfx_rescue(sfx) is True
    # short dialogue in a large bubble ('は？', 'HUH?') -> NOT SFX -> no rescue
    dialogue = _Region('は？', (0, 0, 200, 200), is_sfx=False)
    assert should_sfx_rescue(dialogue) is False


def test_should_sfx_rescue_missing_flag_defaults_false():
    from manga_translator.sfx_merge import should_sfx_rescue
    class Bare:  # a region that never got the attribute
        text, xyxy = 'おい', (0, 0, 90, 90)
    assert should_sfx_rescue(Bare()) is False


def test_is_sfx_provenance_propagates_through_textline_merge():
    # merge_sfx_detections flags SFX textlines is_sfx=True; the flag must reach the merged
    # TextBlock region so the rescue site can gate on it.
    import asyncio, numpy as np
    from manga_translator.utils.generic import Quadrilateral
    from manga_translator import textline_merge
    def quad(x1, y1, x2, y2, txt, sfx):
        q = Quadrilateral(np.array([[x1, y1], [x2, y1], [x2, y2], [x1, y2]], np.float32), txt, 0.9)
        q.is_sfx = sfx
        return q
    sfx_q = quad(30, 30, 140, 90, 'ﾄﾞ', True)
    dlg_q = quad(300, 300, 460, 360, 'hello', False)
    regions = asyncio.run(textline_merge.dispatch([sfx_q, dlg_q], 600, 600, verbose=False))
    by_text = {r.text: getattr(r, 'is_sfx', None) for r in regions}
    assert any(v is True for v in by_text.values())      # the SFX region carries the flag
    assert any(v is False for v in by_text.values())     # the dialogue region does not
