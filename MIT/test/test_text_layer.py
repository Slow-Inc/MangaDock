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
