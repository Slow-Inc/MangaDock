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
    must carry regions_payload(...) alongside img/patches."""
    src = (Path(__file__).parent.parent / 'manga_translator' / 'manga_translator.py').read_text(encoding='utf-8')
    fn = re.search(r'async def translate_patches\(self.*?(?=\n    async def )', src, re.S)
    assert fn, 'translate_patches not found'
    assert "'regions': regions_payload(" in fn.group(0)


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
