"""Text layer of a translated page (#158, PRD #155 P2 enabler).

Every translated page returns what each rendered region said — the source
text and its translation — alongside the patch PNGs. Pure logic, no ML
imports: regions are duck-typed (anything with .text / .translation).
"""
import re
from pathlib import Path

from manga_translator.text_layer import regions_payload


class _Region:
    def __init__(self, text, translation):
        self.text = text
        self.translation = translation


def test_every_rendered_region_contributes_src_and_dst():
    regions = [
        _Region("STOP RIGHT THERE!", "หยุดตรงนั้นเลย!"),
        _Region("Huh?", "หา?"),
    ]
    assert regions_payload(regions) == [
        {"src": "STOP RIGHT THERE!", "dst": "หยุดตรงนั้นเลย!"},
        {"src": "Huh?", "dst": "หา?"},
    ]


def test_missing_or_empty_text_degrades_to_empty_strings():
    class Bare:
        pass

    assert regions_payload([Bare()]) == [{"src": "", "dst": ""}]
    assert regions_payload(None) == []


def test_translate_patches_returns_the_text_layer():
    """Wiring check via source inspection — running the pipeline needs
    GPU/models (same pattern as test_page_context.py). The patch result dict
    must carry regions_payload(...) alongside img/patches. #905 moved that
    phase into _finish_patches; translate_patches must delegate to it."""
    src = (Path(__file__).parent.parent / 'manga_translator' / 'manga_translator.py').read_text(encoding='utf-8')
    fn = re.search(r'async def translate_patches\(self.*?(?=\n    async def )', src, re.S)
    assert fn, 'translate_patches not found'
    assert 'return await self._finish_patches(ctx, config, source_icc)' in fn.group(0)
    finish = re.search(r'async def _finish_patches\(self.*?(?=\n    async def )', src, re.S)
    assert finish, '_finish_patches not found'
    assert "'regions': regions_payload(" in finish.group(0)


# ---- #535 Phase-0c: telemetry enrichment (keys appear only when the attr exists) ----

def test_render_telemetry_keys_included_when_present():
    r = _Region("こんにちは", "สวัสดี")
    r.xyxy = (10, 20, 110, 80)
    r.bubble_box = (5, 10, 120, 90)
    r.font_size = 32                 # src lettering (OCR)
    r.render_branch = "bubble_fit_sole"
    r.render_font_px = 26            # final chosen font
    r.render_dst_box = (12, 22, 108, 78)
    out = regions_payload([r])[0]
    assert out["src"] == "こんにちは" and out["dst"] == "สวัสดี"
    assert out["xyxy"] == [10, 20, 110, 80]
    assert out["bubble_box"] == [5, 10, 120, 90]
    assert out["font_src_px"] == 32
    assert out["branch"] == "bubble_fit_sole"
    assert out["font_final_px"] == 26
    assert out["dst_box"] == [12, 22, 108, 78]
    assert out["rendered"] is True


def test_bare_region_payload_stays_backward_compatible():
    # no telemetry attrs → exactly the legacy {src,dst} shape (old consumers safe)
    assert regions_payload([_Region("a", "b")]) == [{"src": "a", "dst": "b"}]


def test_dropped_regions_payload_reports_reason_and_not_rendered():
    from manga_translator.text_layer import dropped_regions_payload
    r = _Region("123", "42")
    r.xyxy = (1, 2, 3, 4)
    out = dropped_regions_payload([(r, "Numeric translation")])
    assert out == [{"src": "123", "dst": "42", "xyxy": [1, 2, 3, 4],
                    "rendered": False, "drop_reason": "Numeric translation"}]


def test_numpy_values_serialize_to_plain_python():
    # live bug: region.xyxy carries numpy int32 → pydantic "Unable to serialize
    # unknown type numpy.int32" → HTTP 500. Payload must coerce to plain Python.
    import json
    import numpy as np
    r = _Region("a", "b")
    r.xyxy = np.array([1, 2, 3, 4], dtype=np.int32)
    r.bubble_box = (np.int32(5), np.int32(6), np.int32(7), np.int32(8))
    r.font_size = np.int32(24)
    r.render_font_px = np.int64(20)
    r.render_dst_box = (np.float32(1.5), 2.0, 3.0, np.float64(4.5))
    r.render_branch = "clean_layout"
    out = regions_payload([r])[0]
    json.dumps(out)                       # must not raise
    assert all(type(x) in (int, float) for x in out["xyxy"] + out["dst_box"])
    assert type(out["font_src_px"]) is int and type(out["font_final_px"]) is int


# ---- 2026-10-20 quality loop: an early-returned page still accounts for its drops ----

def test_empty_patch_result_still_lists_the_dropped_regions():
    """A page whose every region was dropped (e.g. the LLM echoed English back and the identical-
    translation filter removed them all) returned 'regions': [] — indistinguishable from a page
    with no text, so Pipeline Doctor could only say 'no regions' (Chainsaw Man credits page)."""
    from manga_translator.text_layer import empty_patch_result

    class R:
        text, translation, xyxy = 'NOTICE:', 'NOTICE:', (10, 10, 90, 30)

    out = empty_patch_result(800, 1150, [(R(), 'Translation identical to original')])
    assert out['img_width'] == 800 and out['img_height'] == 1150 and out['patches'] == []
    assert out['regions'] == [{'src': 'NOTICE:', 'dst': 'NOTICE:', 'xyxy': [10, 10, 90, 30],
                               'rendered': False, 'drop_reason': 'Translation identical to original'}]


def test_translate_patches_early_returns_report_drops():
    src = (Path(__file__).parent.parent / 'manga_translator' / 'manga_translator.py').read_text(encoding='utf-8')
    fn = re.search(r'async def translate_patches\(self.*?(?=\n    async def )', src, re.S).group(0)
    assert "'patches': [], 'regions': []}" not in fn


def test_page_failure_tells_a_failed_page_from_an_empty_one_1144():
    from types import SimpleNamespace as NS
    from manga_translator.text_layer import page_failure
    echo = [(NS(text=f'LINE {i}'), 'Translation identical to original') for i in range(5)]
    assert page_failure(echo, [])                                   # the whole page echoed the source
    assert page_failure([], ['textline_merge'])                      # a stage crashed
    assert not page_failure([], [])                                  # a page with no text
    # the live repro echoed TWO lines (ch. 6 p2), so two is a failure; a single kept-as-is line is not
    assert page_failure(echo[:2], [])
    assert not page_failure(echo[:1], [])
    mixed = echo[:3] + [(NS(text='ー'), 'speculative box read as junk')]
    assert page_failure(mixed, [])
