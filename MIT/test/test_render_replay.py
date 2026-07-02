"""#462 Phase-0/1 — deterministic render-only replay harness (master plan §8.1/§8.2).

The live translator is non-deterministic (OCR-VLM/LLM sampling → different text + geometry each run),
so A/B-ing a render knob on the worker is confounded (see memory project_mit_translate_nondeterministic).
This harness serializes the sizing-relevant region state ONCE, then replays JUST the font-sizing
dispatch offline (no ML, no worker, no network) so a knob's effect on layout is measured deterministically.
"""
from types import SimpleNamespace

from manga_translator.render_replay import serialize_regions, reconstruct_regions


def _region(xyxy, translation, font_size, bubble_box=None):
    return SimpleNamespace(xyxy=xyxy, translation=translation, font_size=font_size,
                           target_lang='ENG', bubble_box=bubble_box, bubble_polygon=None,
                           sfx_rescued=False)


def test_serialize_then_reconstruct_round_trips_the_sizing_fields():
    regs = [_region((10, 20, 110, 220), 'HELLO THERE', 30, bubble_box=(5, 15, 120, 230)),
            _region((0, 0, 60, 40), 'HI', 18)]
    fixture = serialize_regions(regs, page_shape=(1500, 1080))
    assert fixture['page_shape'] == [1500, 1080]
    assert len(fixture['regions']) == 2

    back = reconstruct_regions(fixture)
    assert [tuple(r.xyxy) for r in back] == [(10, 20, 110, 220), (0, 0, 60, 40)]
    assert back[0].translation == 'HELLO THERE'
    assert back[0].font_size == 30
    assert back[0].target_lang == 'ENG'
    assert tuple(back[0].bubble_box) == (5, 15, 120, 230)
    assert back[1].bubble_box is None


def test_replay_clean_layout_is_deterministic_and_bounds_reference_width():
    # Replay the clean-layout SIZING (the defect lives here) offline & deterministically. The fixture
    # regions are treated as clean-layout (routing needs the full TextBlock geometry; the defect does
    # not). fill_frac_w is measured against the ACTUAL fit box (fixes the trace's misleading avail_w).
    from manga_translator.render_replay import replay_clean_layout
    fixture = serialize_regions(
        [_region((100, 100, 480, 200), 'WHAT SHOULD WE DO IF ITS NOW WE CAN STILL HIDE', 40)],
        page_shape=(1522, 1080))

    on1 = replay_clean_layout(fixture, reference_layout=True, font_size_max=20)
    on2 = replay_clean_layout(fixture, reference_layout=True, font_size_max=20)
    assert on1 == on2, 'replay is not deterministic'

    d = on1[0]
    assert d['final_fs'] >= 8
    # reference fit bounds BOTH axes against its own fit box → width fits (± rounding).
    assert d['block_w'] <= d['avail_w'] + 2, f"reference width overflow: {d['block_w']:.0f} > {d['avail_w']:.0f}"

    off = replay_clean_layout(fixture, reference_layout=False, font_size_max=20)
    assert 'final_fs' in off[0] and 'fill_frac_w' in off[0]


import pytest


def test_reference_layout_no_region_spills_past_its_detection_box():
    # Deterministic metric guard on the real One-Punch fixture: with reference_layout ON + the
    # demoted-bubble discriminator (should_fill_demoted_bubble), no region blows past its VISIBLE
    # detection box (what the user saw as "too big"). Before the fix the two top blocks spilled ~2.3x;
    # now they narrow (0.93/0.97). Threshold 1.35 tolerates only a degenerate tiny box (the 23px "...HUH?"
    # bubble, where a single word can't fit at the minimum font) — not the real oversize.
    from manga_translator.render_replay import load_fixture, replay_clean_layout
    fx = load_fixture('test/fixtures/onepunch-layout.json')
    decisions = replay_clean_layout(fx, reference_layout=True, font_size_max=20)
    worst = max(d['overflow_vs_det_w'] for d in decisions)
    assert worst <= 1.35, f'a region spills {worst:.2f}x past its detection box (target ~narrow column)'


def test_reference_layout_thai_dialogue_still_fills_its_bubble():
    # No-regression gate: the discriminator must NOT narrow the Thai dialogue (it fills its bubble —
    # interior/det ratio 1.07-1.19 ≤ 1.4). Each region should fill (final font grows well past the flat
    # ~20 cap, i.e. it used the interior-fill path).
    from manga_translator.render_replay import load_fixture, replay_clean_layout
    fx = load_fixture('test/fixtures/thai-galyome-layout.json')
    decisions = replay_clean_layout(fx, reference_layout=True, font_size_max=20)
    assert decisions, 'thai fixture empty'
    assert all(d['final_fs'] >= 24 for d in decisions), \
        f"a Thai bubble under-filled (fill path lost): {[d['final_fs'] for d in decisions]}"


def test_reference_layout_narration_not_over_shrunk():
    # Two-sided guard (the direction the earlier over-spill-only metric missed): a non-fill region must
    # not shrink far below the flat design size, or it renders near-invisible. Complements
    # test_reference_layout_no_region_spills_past_its_detection_box (the over-size direction). Fixed by
    # fit_to_box's non-monotonic upward re-scan (the wrap-induced tiny-branch bug) + a generous vertical
    # tolerance so narration wraps to more lines at the flat size instead of shrinking. Degenerate tiny
    # boxes (det_w < 40 — e.g. the 23px "...HUH?" interjection) are excluded: a word can't fit them at a
    # readable size regardless.
    from manga_translator.render_replay import load_fixture, replay_clean_layout
    fx = load_fixture('test/fixtures/onepunch-layout.json')
    decisions = replay_clean_layout(fx, reference_layout=True, font_size_max=20)
    non_fill = [d for d in decisions if not d.get('fill') and d.get('det_w', 0) >= 40]
    assert non_fill, 'no non-fill regions to check'
    worst = min(d['readability_ratio'] for d in non_fill)
    assert worst >= 0.6, f'a non-fill region over-shrank to {worst:.2f}x the flat design size (too small)'


import glob
import os as _os

# Safety envelope (brainstorm de-risk consensus): every clean-layout region under reference_layout
# must land inside a two-sided box — not spill past its detection width, not over-shrink below the
# flat design size, and a fill region must actually fill. Parameterized over the WHOLE fixture corpus
# so any newly-captured page is auto-guarded (the pre-condition for promoting reference_layout to default).
_SPILL_CEILING = 1.35      # block_w / det_w  (over-size / spill)
_READABILITY_FLOOR = 0.6   # final_fs / flat  (non-fill under-shrink), for det_w >= 40 (skip tiny boxes)
_FILL_FLOOR = 0.9          # final_fs / flat  (a fill region must reach ~the flat size, i.e. actually fill)


def _fixture_paths():
    here = _os.path.dirname(__file__)
    return sorted(glob.glob(_os.path.join(here, 'fixtures', '*-layout.json')))


@pytest.mark.slow
def test_reference_layout_safety_envelope_over_corpus():
    # Runs the reference fit over the WHOLE fixture corpus — many calc_horizontal calls, ~minutes.
    # Marked slow (opt-in via `-m slow`); the per-fixture guards above cover the fast suite.
    from manga_translator.render_replay import load_fixture, replay_clean_layout
    paths = _fixture_paths()
    assert paths, 'no layout fixtures found'
    violations = []
    for p in paths:
        name = _os.path.basename(p)
        for i, d in enumerate(replay_clean_layout(load_fixture(p), reference_layout=True, font_size_max=20)):
            if d.get('final_fs') is None:
                continue
            if d['overflow_vs_det_w'] > _SPILL_CEILING:
                violations.append(f'{name}#{i}: spill {d["overflow_vs_det_w"]}x > {_SPILL_CEILING}')
            if d.get('fill'):
                if d['readability_ratio'] < _FILL_FLOOR:
                    violations.append(f'{name}#{i}: fill under-filled {d["readability_ratio"]}x < {_FILL_FLOOR}')
            elif d.get('det_w', 0) >= 40 and d['readability_ratio'] < _READABILITY_FLOOR:
                violations.append(f'{name}#{i}: narration over-shrank {d["readability_ratio"]}x < {_READABILITY_FLOOR}')
    assert not violations, 'reference_layout safety-envelope violations:\n' + '\n'.join(violations)
