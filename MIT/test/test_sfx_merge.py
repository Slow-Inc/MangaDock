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
