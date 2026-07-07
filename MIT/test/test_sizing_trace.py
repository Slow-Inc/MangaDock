"""Item-2 under-fill MEASUREMENT (Phase 0, #430) — pure diagnostics, no PIL/ML.

These functions read the raw per-region sizing facts the dispatcher dumps (env-gated
`MIT_SIZING_TRACE`) and classify WHY a region under-fills its bubble, so the item-2 fix
targets the measured dominant cause instead of a guess. Multi-agent review (2026-07-01)
hardened the taxonomy: under-fill is measured by rendered FILL FRACTION (not the routing
path), because bubble-fit — especially the shared-bubble path — can still render small.
"""
from manga_translator.rendering.sizing_trace import fill_fraction, underfill_bucket, classify


def _rec(**over):
    """A raw sizing-trace record with sane defaults; tests override the fields they exercise."""
    base = dict(route='clean_layout', has_bubble=True, occupancy=1, fills_ratio=0.9,
                fills_threshold=0.72, orig_fs=14, clean_fs_flat=20, final_fs=20)
    base.update(over)
    return base


# ── fill_fraction: measured occupancy of the available area ────────────────────

def test_fill_fraction_is_block_area_over_available_area():
    # a 40×10 rendered text block in an 80×40 available box fills (40·10)/(80·40) = 0.125
    assert fill_fraction(block_w=40, block_h=10, avail_w=80, avail_h=40) == 0.125


def test_fill_fraction_zero_available_area_is_zero_not_crash():
    # a degenerate/undetected box (avail area 0) must not divide-by-zero; unknown → 0.0
    assert fill_fraction(block_w=40, block_h=10, avail_w=0, avail_h=40) == 0.0


# ── underfill_bucket: WHY a region is small, by the gate that first blocked filling ────

def test_underfill_bucket_no_bubble_when_no_balloon_detected():
    # no balloon detected/associated → forced to clean-layout, can't bubble-fit at all
    assert underfill_bucket(_rec(route='clean_layout', has_bubble=False)) == 'no_bubble'


def test_underfill_bucket_fills_demote_when_sole_occupant_below_threshold():
    # a lone region whose (English) footprint spans < 0.72 of its balloon is demoted off the
    # sole-occupant bubble-fit path down to clean-layout
    assert underfill_bucket(_rec(has_bubble=True, occupancy=1, fills_ratio=0.55)) == 'fills_demote'


def test_underfill_bucket_shared_fit_when_balloon_shared_by_multiple_regions():
    # 2+ regions share a balloon → each fits its OWN detection box, not the balloon → can be small
    assert underfill_bucket(_rec(route='bubble_fit_shared', occupancy=2, fills_ratio=0.9)) \
        == 'shared_fit_small'


def test_underfill_bucket_bubblefit_constrained_when_sole_fit_path():
    # entered sole-occupant bubble-fit yet still small → the fit was constrained (safe-box /
    # anti-overlap clamp / short text in a tall balloon); fill_fraction, not route, flags it small
    assert underfill_bucket(_rec(route='bubble_fit_sole', occupancy=1, fills_ratio=0.9)) \
        == 'bubblefit_constrained'


def test_underfill_bucket_clean_flat_source_small_when_orig_at_or_below_flat():
    # clean-layout region pinned at the flat cap because the ORIGINAL lettering was already small
    # (orig_fs <= clean_fs_flat) — lifting the flat cap alone would NOT help
    assert underfill_bucket(_rec(route='clean_layout', orig_fs=12, clean_fs_flat=20)) \
        == 'clean_flat_source_small'


def test_underfill_bucket_clean_shrunk_to_fit_when_orig_above_flat():
    # clean-layout region whose original lettering was large (orig_fs > clean_fs_flat) yet renders
    # small → not the flat cap (clean-layout grows for large-orig); it was shrunk to fit box height
    assert underfill_bucket(_rec(route='clean_layout', orig_fs=40, clean_fs_flat=20)) \
        == 'clean_shrunk_to_fit'


# ── classify: tally ONLY the actually-under-filled regions (by measured fill_frac) ─────

def test_classify_tallies_only_underfilled_regions_by_bucket():
    # a well-filled region (fill_frac 0.9) is excluded so healthy small captions can't dilute
    # the dominant cause (the review's dilution-trap fix)
    recs = [
        _rec(fill_frac=0.20, has_bubble=False),                                  # no_bubble
        _rec(fill_frac=0.15, has_bubble=True, occupancy=1, fills_ratio=0.50),    # fills_demote
        _rec(fill_frac=0.90, route='bubble_fit_sole', fills_ratio=0.90),         # filled → excluded
    ]
    out = classify(recs, underfill_threshold=0.5)
    assert out['total'] == 3
    assert out['underfilled'] == 2
    assert out['by_bucket'] == {'no_bubble': 1, 'fills_demote': 1}


def test_classify_reports_dominant_bucket_and_its_share():
    recs = [_rec(fill_frac=0.1, has_bubble=False) for _ in range(3)] + \
           [_rec(fill_frac=0.1, has_bubble=True, occupancy=1, fills_ratio=0.4)]  # 1 fills_demote
    out = classify(recs, underfill_threshold=0.5)
    assert out['dominant'] == 'no_bubble'
    assert out['dominant_share'] == 0.75


def test_classify_dominant_is_none_when_nothing_underfilled():
    out = classify([_rec(fill_frac=0.95, route='bubble_fit_sole', fills_ratio=0.9)])
    assert out['underfilled'] == 0
    assert out['dominant'] is None


# ── wiring: the dispatcher emits one JSONL record per region when MIT_SIZING_TRACE is set ──────

def test_dispatcher_emits_one_record_per_region_with_orig_fs_snapshotted_before_overwrite(
        tmp_path, monkeypatch):
    import json
    from pathlib import Path
    import numpy as np
    from manga_translator.rendering import resize_regions_to_font_size, text_render
    from manga_translator.utils import TextBlock

    text_render.set_font(str(Path(__file__).parent.parent / 'fonts' / 'Arial-Unicode-Regular.ttf'))
    trace = tmp_path / 'trace.jsonl'
    monkeypatch.setenv('MIT_SIZING_TRACE', str(trace))
    reg = TextBlock([[[20, 20], [600, 20], [20, 240], [600, 240]]], texts=['x'],
                    translation='hello world', direction='h', target_lang='ENG', font_size=40)
    reg.set_font_colors([255, 255, 255], [0, 0, 0])
    img = np.zeros((720, 1000, 3), dtype=np.uint8)
    # sizing only (no bubble → clean-layout path, an item-2-relevant small-font branch); the emit
    # fires before the render stage, so no render is needed to exercise the wiring
    resize_regions_to_font_size(img, [reg], None, 0, 0, clean_layout=True)

    lines = [json.loads(x) for x in trace.read_text(encoding='utf-8').splitlines()]
    assert len(lines) == 1                    # exactly one record for the one region
    rec = lines[0]
    assert rec['route'] == 'clean_layout'     # no bubble + clean_layout on → clean-layout path
    assert rec['region_index'] == 0
    assert rec['orig_fs'] == 40               # snapshotted BEFORE the branch overwrites font_size
    assert rec['clean_fs_flat'] > 0           # recomputed flat cap recorded
    assert rec['fill_frac'] >= 0.0            # derived by the emitter


# #462 harness: per-axis fill + overflow classifier (the oversize side, mirroring the
# under-fill area metric). These are the pure metrics the regression guard asserts on
# the FINAL render — a region must not overflow width or height beyond a tolerance.

def test_axis_fill_is_a_per_axis_ratio_not_area():
    from manga_translator.rendering.sizing_trace import axis_fill
    assert axis_fill(200, 100) == 2.0     # block twice the available width -> overflow signal
    assert axis_fill(50, 100) == 0.5
    assert axis_fill(50, 0) == 0.0        # degenerate available -> 0.0, never divide-by-zero


def test_overflow_axes_flags_width_and_height_independently():
    from manga_translator.rendering.sizing_trace import overflow_axes
    assert overflow_axes(block_w=200, block_h=50, avail_w=100, avail_h=100) == (True, False)   # wide only
    assert overflow_axes(block_w=50, block_h=200, avail_w=100, avail_h=100) == (False, True)   # tall only
    assert overflow_axes(block_w=90, block_h=90, avail_w=100, avail_h=100) == (False, False)   # fits
    # tolerance: a small slack does not count as overflow
    assert overflow_axes(block_w=105, block_h=50, avail_w=100, avail_h=100, tol=1.1) == (False, False)
