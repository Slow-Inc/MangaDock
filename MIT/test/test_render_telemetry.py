"""#535 Phase-0c wiring: resize_regions_to_font_size stamps per-region render
telemetry (render_branch / render_font_px / render_dst_box) so the /patches
payload can explain every region. Heavy layout internals are stubbed — this pins
the WIRING (attrs set on every branch), not the layout math."""
import numpy as np
import pytest

import manga_translator.rendering as rend


class FakeRegion:
    def __init__(self, **attrs):
        self.sfx_rescued = False
        self.font_size = 24
        for k, v in attrs.items():
            setattr(self, k, v)


@pytest.fixture()
def stubs(monkeypatch):
    monkeypatch.setattr(rend, '_bubble_interior_box',
                        lambda region, bubble_box, shape: (60.0, 40.0, (50.0, 50.0)))
    monkeypatch.setattr(rend, '_bubble_fit_font_size',
                        lambda region, wh, ratio: 42)
    monkeypatch.setattr(rend, '_clean_layout_dst',
                        lambda region, shape, fmin, fmax, page_shape=None: (20, 80.0, 30.0))
    return monkeypatch


def test_bubble_fit_branch_stamps_telemetry(stubs):
    img = np.full((200, 200, 3), 255, np.uint8)
    r = FakeRegion(bubble_box=(10, 10, 110, 110), horizontal=True,
                   translation='HELLO', xyxy=(20, 20, 100, 100))
    out = rend.resize_regions_to_font_size(
        img, [r], None, 0, 8, bubble_fit=True, clean_layout=True)
    assert r.render_branch == 'bubble_fit_sole'
    assert r.render_font_px == 42
    assert list(map(int, r.render_dst_box)) == [20, 30, 80, 70]   # 60x40 box on (50,50)
    assert len(out) == 1


def test_clean_layout_branch_stamps_telemetry(stubs):
    img = np.full((200, 200, 3), 255, np.uint8)
    r = FakeRegion(horizontal=True, translation='CAPTION', xyxy=(30, 30, 90, 60))
    out = rend.resize_regions_to_font_size(
        img, [r], None, 0, 8, bubble_fit=False, clean_layout=True)
    assert r.render_branch == 'clean_layout'
    assert r.render_font_px == 20
    assert len(r.render_dst_box) == 4
    assert len(out) == 1


def test_narrow_narration_in_big_balloon_falls_through_to_clean_layout(stubs):
    # #535 slice C: tagged + sole occupant, but the text footprint spans only half
    # the balloon width (rw/bw = 0.5 < 0.72) → NOT dialogue-to-fill; must keep the
    # clean-layout narrow column (the target's tall narrow narration block).
    img = np.full((200, 200, 3), 255, np.uint8)
    r = FakeRegion(bubble_box=(0, 0, 160, 160), horizontal=True,
                   translation='THIS BRAT STILL...', xyxy=(40, 20, 120, 140))  # rw 80 / bw 160
    rend.resize_regions_to_font_size(img, [r], None, 0, 8, bubble_fit=True, clean_layout=True)
    assert r.render_branch == 'clean_layout'


def test_wide_dialogue_in_balloon_still_bubble_fits(stubs):
    img = np.full((200, 200, 3), 255, np.uint8)
    r = FakeRegion(bubble_box=(0, 0, 100, 100), horizontal=True,
                   translation='HELLO', xyxy=(5, 20, 95, 80))                  # rw 90 / bw 100
    rend.resize_regions_to_font_size(img, [r], None, 0, 8, bubble_fit=True, clean_layout=True)
    assert r.render_branch == 'bubble_fit_sole'


def test_clean_layout_squeezes_to_fill_tall_original_footprint(monkeypatch):
    # #535 (user vs target): a tall vertical-JP narration bbox must render as a tall
    # NARROW column (like the target), not a few wide lines. clean_layout squeezes
    # the wrap width until the block fills the region's original height.
    def fake_calc(font, text, max_width, max_height, language='en_US', **kw):
        import math
        cpl = max(1, int(max_width) // 10)              # 10px per char
        n = math.ceil(len(text) / cpl)
        return ['x' * cpl] * n, [min(int(max_width), len(text) * 10)] * n
    monkeypatch.setattr(rend.text_render, 'calc_horizontal', fake_calc)
    # 10 short words (spaced) — squeezable; a tall 150x300 original footprint.
    r = FakeRegion(horizontal=True, translation='AB ' * 10, xyxy=(0, 0, 150, 300))
    laid = rend._clean_layout_dst(r, (400, 400, 3), 8, 20)
    fs, block_w, block_h = laid
    # unsqueezed: 2 wide lines (~150px wide, ~48px tall). Squeezed: a tall narrow
    # column (floored at 2×font so it can't become a sliver).
    assert block_w < 75                  # much narrower than the 150px bbox width
    assert block_h >= 150                # ...and 3×+ taller than the unsqueezed 48px
    assert block_h <= 300                # never exceeds the original footprint height


def test_squeeze_never_force_breaks_a_short_word(monkeypatch):
    # #183 hard gate (live regression: "HMPH." -> "HM/PH."): the squeeze floor must
    # be the LONGEST TOKEN's width, not 2x font — a single short word in a tall
    # bubble must stay on one line.
    def fake_calc(font, text, max_width, max_height, language='en_US', **kw):
        import math
        cpl = max(1, int(max_width) // 10)
        toks = text.split() or ['']
        if len(toks) == 1:                       # single word: force-break iff column < word
            if len(text) * 10 <= max_width:
                return [text], [len(text) * 10]
            n = math.ceil(len(text) / cpl)
            return [text[i*cpl:(i+1)*cpl] for i in range(n)], [cpl * 10] * n
        n = math.ceil(len(text) / cpl)
        return ['x' * cpl] * n, [min(int(max_width), len(text) * 10)] * n
    monkeypatch.setattr(rend.text_render, 'calc_horizontal', fake_calc)
    # bbox NARROWER than the word (live case: a tiny tail bubble) — the floor must
    # still be the whole word's width because "HMPH." has no syllable split.
    r = FakeRegion(horizontal=True, translation='HMPH.', xyxy=(0, 0, 40, 300))
    fs, block_w, block_h = rend._clean_layout_dst(r, (400, 400, 3), 8, 20)
    assert block_h <= fs * 1.3           # ONE line — the word was never split


def test_clean_layout_grows_font_toward_original_within_footprint(monkeypatch):
    # user vs target: our narration was a bit SMALLER than target (flat 20px while the
    # original lettering is 35px) and the right one spread sideways. clean_layout must
    # pick the LARGEST font <= original lettering whose narrow column still fits the
    # ORIGINAL footprint (both width and height) — like the target.
    def fake_calc(font, text, max_width, max_height, language='en_US', **kw):
        import math
        px = font // 2                                   # char width scales with font
        cpl = max(1, int(max_width) // px)
        n = math.ceil(len(text) / cpl)
        return ['x' * cpl] * n, [min(int(max_width), len(text) * px)] * n
    monkeypatch.setattr(rend.text_render, 'calc_horizontal', fake_calc)
    # tall footprint 120x300; original lettering 36px; 24 chars of text (spaced)
    r = FakeRegion(horizontal=True, translation='AB ' * 8, font_size=36, xyxy=(0, 0, 120, 300))
    fs, block_w, block_h = rend._clean_layout_dst(r, (400, 400, 3), 8, 20)
    assert fs > 20                        # grew toward the original, not stuck at flat
    assert fs <= 36                       # never larger than the original lettering
    assert block_w <= 120 * 1.06          # column stays inside the original footprint width
    assert block_h <= 300                 # ...and height


def test_duplicate_sfx_region_is_blanked_not_rendered(stubs):
    # #436 slice B (Otome p10 text-over-text): the SFX detector re-detects a word the
    # line detector already captured -> a small duplicate inside the full sentence
    # renders ON TOP. Substring + >=60% containment => blank the duplicate.
    img = np.full((300, 300, 3), 255, np.uint8)
    full = FakeRegion(horizontal=True, translation='จัดปาร์ตี้ดื่มเหล้ากัน',
                      xyxy=(50, 50, 250, 120))
    dup = FakeRegion(horizontal=True, translation='ปาร์ตี้',
                     xyxy=(100, 60, 160, 100))               # inside `full`
    rend.resize_regions_to_font_size(img, [full, dup], None, 0, 8,
                                     bubble_fit=False, clean_layout=True)
    assert dup.translation == ''                              # blanked
    assert getattr(dup, 'render_suppressed_reason', '') == 'duplicate'
    assert full.translation == 'จัดปาร์ตี้ดื่มเหล้ากัน'          # kept intact


def test_non_contained_repeat_survives_dedup(stubs):
    img = np.full((300, 300, 3), 255, np.uint8)
    a = FakeRegion(horizontal=True, translation='ปาร์ตี้', xyxy=(0, 0, 60, 40))
    b = FakeRegion(horizontal=True, translation='จัดปาร์ตี้กัน', xyxy=(200, 200, 300, 260))
    rend.resize_regions_to_font_size(img, [a, b], None, 0, 8,
                                     bubble_fit=False, clean_layout=True)
    assert a.translation == 'ปาร์ตี้'                          # far away → legit repeat, kept


def test_rescued_display_sfx_renders_single_line(monkeypatch):
    # SQUE/LCH live residual: a vision-rescued display SFX (one onomatopoeia word)
    # must render on ONE line — shrink the font until the word fits the detection
    # box width (like the target's big single-line LOOM), never wrap it.
    def fake_calc(font, text, max_width, max_height, language='en_US', **kw):
        import math
        w = int(len(text) * font * 0.5)
        if w <= max_width:
            return [text], [w]
        cpl = max(1, int(max_width / (font * 0.5)))
        n = math.ceil(len(text) / cpl)
        return [text[i*cpl:(i+1)*cpl] for i in range(n)], [int(cpl * font * 0.5)] * n
    monkeypatch.setattr(rend.text_render, 'calc_horizontal', fake_calc)
    img = np.full((400, 400, 3), 255, np.uint8)
    r = FakeRegion(horizontal=True, translation='SQUELCH', font_size=152,
                   sfx_rescued=True, xyxy=(20, 20, 300, 220))
    rend.resize_regions_to_font_size(img, [r], None, 0, 8, bubble_fit=False, clean_layout=True)
    assert r.render_branch == 'sfx_display'
    assert 8 < r.render_font_px <= 152
    # one line: the chosen font makes the whole word fit the box width
    assert len('SQUELCH') * r.render_font_px * 0.5 <= (300 - 20) * 1.06


def test_clean_layout_wrap_clamps_to_page_not_crop(monkeypatch):
    # D page_shape: in the patch path img_shape is the small CROP — clean_wrap_width's
    # 45% cap of a 200px crop (=90px) would strangle a 150px-wide caption. With
    # page_shape threaded, the clamp uses the PAGE width and the column keeps the
    # caption's own footprint.
    def fake_calc(font, text, max_width, max_height, language='en_US', **kw):
        import math
        cpl = max(1, int(max_width) // 10)
        n = math.ceil(len(text) / cpl)
        return ['x' * cpl] * n, [min(int(max_width), len(text) * 10)] * n
    monkeypatch.setattr(rend.text_render, 'calc_horizontal', fake_calc)
    r = FakeRegion(horizontal=True, translation='AB ' * 10, xyxy=(0, 0, 150, 60))  # short wide caption
    # crop 200px wide, page 800px wide
    fs, w_crop, _ = rend._clean_layout_dst(r, (200, 200, 3), 8, 20)
    fs, w_page, _ = rend._clean_layout_dst(r, (200, 200, 3), 8, 20, page_shape=(1150, 800))
    assert w_crop <= 92                   # crop-clamped (45% of 200) — the bug
    assert w_page > 92                    # page-clamped keeps the caption footprint
