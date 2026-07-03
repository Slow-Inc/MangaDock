"""#170/#178 detection-recall lever: when det_bubble_seg (YOLO) misses an oval/tall balloon, a
classical flood-fill can synthesize one so the region fills its bubble instead of being treated as
narration (the 2026-07-02 trace showed has_bubble=False dialogue under-filling). Flood-fill can LEAK
(open bubbles, dark art) and return a bogus box, so a synthesized bubble is only used if it passes
this pure acceptance gate — the guardrail that keeps the fallback from creating new regressions.
"""
from manga_translator.bubble_association import acceptable_synth_bubble


def test_acceptable_synth_bubble_gate():
    page_w, page_h = 1000, 1500
    region = (100, 100, 200, 300)  # the text region the bubble must enclose

    # a real bubble: encloses the text with modest margin → accept
    assert acceptable_synth_bubble((80, 80, 260, 340), region, page_w, page_h) is True
    # page/panel leak (~whole page) → reject (flood-fill escaped the bubble)
    assert acceptable_synth_bubble((0, 0, 995, 1495), region, page_w, page_h) is False
    # does not contain the text region → reject (wrong region flooded)
    assert acceptable_synth_bubble((300, 300, 400, 400), region, page_w, page_h) is False
    # degenerate: no bigger than the text box → reject (nothing to fill)
    assert acceptable_synth_bubble((100, 100, 200, 300), region, page_w, page_h) is False
