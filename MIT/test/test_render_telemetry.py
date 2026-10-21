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
                        lambda region, shape, fmin, fmax, page_shape=None, **kw: (20, 80.0, 30.0))
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


def test_rescued_sfx_inside_balloon_is_dialogue_not_display(stubs):
    # #431/#19 (Otome "Sieg..."): a rescued SFX INSIDE a speech balloon is normal
    # dialogue — it must NOT take the big display path (which overlaid the bubble).
    img = np.full((200, 200, 3), 255, np.uint8)
    r = FakeRegion(horizontal=True, translation='ซึเอะ', sfx_rescued=True,
                   bubble_box=(0, 0, 100, 100), xyxy=(20, 20, 80, 80), font_size=110)
    rend.resize_regions_to_font_size(img, [r], None, 0, 8, bubble_fit=True, clean_layout=True)
    assert r.render_branch != 'sfx_display'


def test_tall_balloon_interior_renders_as_tall_column_not_wide_strip(monkeypatch):
    # Otome "THIS SCUMBAG" box: a TALL rectangular balloon rendered as small wide
    # lines at the top (hard to read). A tall interior must reuse the narrow-column
    # search: bigger font, column following the box's vertical shape.
    def fake_calc(font, text, max_width, max_height, language='en_US', **kw):
        import math
        px = max(1, font // 2)
        cpl = max(1, int(max_width) // px)
        n = math.ceil(len(text) / cpl)
        return ['x' * cpl] * n, [min(int(max_width), len(text) * px)] * n
    monkeypatch.setattr(rend.text_render, 'calc_horizontal', fake_calc)
    monkeypatch.setattr(rend, '_bubble_interior_box',
                        lambda region, bubble_box, shape: (120.0, 300.0, (100.0, 170.0)))  # tall interior
    monkeypatch.setattr(rend, '_bubble_fit_font_size', lambda region, wh, ratio: 15)       # old wide fit
    img = np.full((400, 400, 3), 255, np.uint8)
    r = FakeRegion(horizontal=True, translation='AB ' * 8, font_size=19,
                   bubble_box=(40, 20, 160, 320), xyxy=(50, 30, 150, 310))
    rend.resize_regions_to_font_size(img, [r], None, 0, 8, bubble_fit=True, clean_layout=True)
    assert r.render_branch == 'bubble_fit_tall'
    assert r.render_font_px > 15                    # bigger than the old wide fit
    box = r.render_dst_box
    assert (box[3] - box[1]) > (box[2] - box[0])    # tall block, not a wide strip


def test_display_sfx_font_capped_to_page_fraction(stubs, monkeypatch):
    # 2nd-manga p13: a huge チュン title SFX rendered "จุนจุน" so large it covered ~1/3
    # of the page. The display-SFX font is capped to a fraction of PAGE height.
    import numpy as np
    import manga_translator.rendering.text_render as tr
    monkeypatch.setattr(tr, 'calc_horizontal',
                        lambda fs, text, mw, mh, language='en_US', **k: (['x'], [float(fs) * 2]))
    img = np.full((300, 300, 3), 255, np.uint8)
    # huge SFX bbox + huge source font on an 1800px-tall page -> would render enormous
    r = FakeRegion(horizontal=True, translation='จุน', sfx_rescued=True, bubble_box=None,
                   xyxy=(40, 40, 760, 400), font_size=300)
    rend.resize_regions_to_font_size(img, [r], None, 0, 8, bubble_fit=False,
                                     clean_layout=True, page_shape=(1800, 1200))
    assert r.render_branch == 'sfx_display'
    assert r.render_font_px <= int(1800 * 0.12)      # capped to <=12% of page height


def test_duplicate_translation_display_sfx_keeps_largest(stubs, monkeypatch):
    # p13: two チュン marks -> two identical "จุน" display SFX at different spots (not
    # overlapping). Keep the LARGEST (most prominent) and blank the rest — via the
    # proven blank-then-skip path (safe on the full-page render group).
    import numpy as np
    import manga_translator.rendering.text_render as tr
    monkeypatch.setattr(tr, 'calc_horizontal',
                        lambda fs, text, mw, mh, language='en_US', **k: (['x'], [float(fs)]))
    img = np.full((400, 400, 3), 255, np.uint8)
    big = FakeRegion(horizontal=True, translation='จุน', sfx_rescued=True, bubble_box=None,
                     xyxy=(200, 40, 380, 160), font_size=60)          # large
    small = FakeRegion(horizontal=True, translation='จุน', sfx_rescued=True, bubble_box=None,
                       xyxy=(20, 60, 70, 100), font_size=30)          # small, far away
    rend.resize_regions_to_font_size(img, [big, small], None, 0, 8,
                                     bubble_fit=False, clean_layout=True)
    assert big.render_branch == 'sfx_display'
    assert small.render_branch == 'suppressed' and not small.translation


def test_anti_overlap_does_not_push_a_region_out_of_the_balloon_it_shares(monkeypatch):
    """Tsuki p1 (2026-10-20): two regions shared one balloon; the sibling's territory is that
    whole balloon, so clamping against it shoved the block out of its own balloon and onto the
    neighbouring balloon's text. Siblings in one balloon are not neighbours to avoid."""
    monkeypatch.setattr(rend, '_clean_layout_dst',
                        lambda region, shape, fmin, fmax, page_shape=None, **kw: (20, 89.0, 96.0))
    img = np.full((800, 800, 3), 255, np.uint8)
    balloon = (477.0, 473.0, 560.0, 694.0)
    a = FakeRegion(horizontal=True, translation='BUT THAT SORT OF', xyxy=(483, 522, 543, 584),
                   bubble_box=balloon)
    b = FakeRegion(horizontal=True, translation='MY APOLOGIES', xyxy=(488, 603, 544, 633),
                   bubble_box=balloon)
    rend.resize_regions_to_font_size(img, [a, b], None, 0, 8, bubble_fit=False, anti_overlap=True,
                                     clean_layout=True)
    x1, _, x2, _ = a.render_dst_box
    assert (x1 + x2) / 2 == pytest.approx(513.0)


def test_anti_overlap_never_pushes_a_block_out_of_its_own_balloon(monkeypatch):
    """#795 follow-up (Tsuki p1, 2026-10-21): dodging a balloon-less neighbour shifted 'ARE YOU
    SERIOUS?' 12 px past its own balloon's left edge. After the dodge the block is kept inside
    its balloon whenever it fits there."""
    monkeypatch.setattr(rend, '_clean_layout_dst',
                        lambda region, shape, fmin, fmax, page_shape=None, **kw: (20, 93.0, 48.0))
    img = np.full((800, 800, 3), 255, np.uint8)
    a = FakeRegion(horizontal=True, translation='ARE YOU SERIOUS?', xyxy=(73, 550, 136, 580),
                   bubble_box=(68.0, 473.0, 161.0, 654.0))
    b = FakeRegion(horizontal=True, translation='IT WONT KILL ME', xyxy=(150, 502, 211, 544))
    rend.resize_regions_to_font_size(img, [a, b], None, 0, 8, bubble_fit=False, anti_overlap=True,
                                     clean_layout=True)
    x1, _, x2, _ = a.render_dst_box
    assert x1 >= 68.0 - 0.5 and x2 <= 161.0 + 0.5, a.render_dst_box


def test_a_clean_layout_block_is_fitted_into_its_narrow_balloon_832():
    """#832 (Iruma p0): the English covered 43 of a 59 px balloon, so the region went to clean_layout,
    whose column was floored at the widest Thai word — an 89 px block spilling past the balloon.
    When the block is wider than the balloon interior it is laid out again on that interior."""
    from pathlib import Path
    from manga_translator.rendering import text_render
    text_render.set_font(str(Path(__file__).parent.parent / 'fonts' / 'Prompt-Regular.ttf'))
    img = np.full((1000, 800, 3), 255, np.uint8)
    r = FakeRegion(horizontal=True, translation='เธอฉลาดมากนะ โย-ชาน!', xyxy=(66.4, 743, 109.0, 805),
                   bubble_box=(58.0, 710.0, 117.9, 834.0), target_lang='THA', font_size=14)
    rend.resize_regions_to_font_size(img, [r], None, 0, 8, bubble_fit=True, anti_overlap=True,
                                     font_size_max=20, clean_layout=True)
    x1, y1, x2, y2 = r.render_dst_box
    assert x2 - x1 <= 59 * 1.05 and x1 >= 58 - 1 and x2 <= 117 + 1, r.render_dst_box


def test_a_dodge_that_narrows_the_space_relays_the_text_to_fit_it_795():
    """Iruma p0 (2026-10-21): the balloon detector merged three balloons into one box; dodging the
    neighbour shrank the free space to ~69 px but the 91 px block was only re-centred, so it still
    ran into the next balloon's text. When the dodge leaves a narrower space, lay the text out to it."""
    from pathlib import Path
    from manga_translator.rendering import text_render
    text_render.set_font(str(Path(__file__).parent.parent / 'fonts' / 'Prompt-Regular.ttf'))
    img = np.full((1000, 800, 3), 255, np.uint8)
    merged = (418.0, 367.0, 777.0, 610.0)
    a = FakeRegion(horizontal=True, translation='แม้แต่ของฟรีที่ได้มาไม่พอจะรั้งเธอไว้ได้ตลอด',
                   xyxy=(409.0, 485.0, 472.0, 626.0), bubble_box=merged, target_lang='THA', font_size=14)
    b = FakeRegion(horizontal=True, translation='ถ้าเธอไม่มีพลังที่มีประโยชน์แบบนี้ ก็คงไม่มีใครคบกับตัวป่วนอย่างเธอ',
                   xyxy=(489.0, 438.0, 607.0, 566.0), bubble_box=merged, target_lang='THA', font_size=14)
    rend.resize_regions_to_font_size(img, [a, b], None, 0, 8, bubble_fit=True, anti_overlap=True,
                                     font_size_max=20, clean_layout=True)
    ax2 = a.render_dst_box[2]
    assert ax2 <= 489.0 + 1, (a.render_dst_box, b.render_dst_box)


def test_a_block_taller_than_the_dodged_space_still_moves_off_the_neighbour_795():
    """Anta p1 (2026-10-21): the caption above pushed the balloon text's top edge down, leaving less
    height than the block; e9f36bb6 dropped the vertical dodge, so the block stayed put over the
    caption (19 px). The block moves flush against the edge the neighbour pushed in."""
    from pathlib import Path
    from manga_translator.rendering import text_render
    text_render.set_font(str(Path(__file__).parent.parent / 'fonts' / 'Prompt-Regular.ttf'))
    img = np.full((1600, 1100, 3), 255, np.uint8)
    balloon = (821.0, 953.0, 1051.0, 1404.0)
    caption = FakeRegion(horizontal=True, translation='RUA-HIME โจมตีไอดอลยอดนิยม 20, 000 วิว. 3 ชั่วโมงที่แล้ว',
                         xyxy=(551.0, 1206.0, 1016.0, 1275.0), target_lang='THA', font_size=14)
    text = FakeRegion(horizontal=True, translation='วิดีโอมียอดวิวหลายหมื่น',
                      xyxy=(848.0, 1241.0, 993.0, 1364.0), bubble_box=balloon, target_lang='THA', font_size=14)
    rend.resize_regions_to_font_size(img, [caption, text], None, 0, 8, bubble_fit=True, anti_overlap=True,
                                     font_size_max=20, clean_layout=True)
    assert text.render_dst_box[1] >= 1275.0, (caption.render_dst_box, text.render_dst_box)
    assert text.render_dst_box[3] <= balloon[3] + 1, text.render_dst_box


def test_a_dodge_that_runs_into_another_neighbour_shares_the_gap_795():
    """Mieruko p0 (2026-10-21): the balloon above pushed the sign text's top edge down; moving the
    block flush with that edge ran it 29 px into the line below, which it had not touched. A block
    taller than the gap between two neighbours is centred in that gap instead."""
    from pathlib import Path
    from manga_translator.rendering import text_render
    text_render.set_font(str(Path(__file__).parent.parent / 'fonts' / 'Prompt-Regular.ttf'))
    img = np.full((1500, 1000, 3), 255, np.uint8)
    above = FakeRegion(horizontal=True, translation='ฉันจะกลับมาอีกแน่นอน!', xyxy=(146.0, 879.0, 265.0, 984.0),
                       bubble_box=(90.0, 801.0, 312.0, 1084.0), target_lang='THA', font_size=14)
    sign = FakeRegion(horizontal=True, translation='ดูดวง นาทีละ 5, 000 เยน นาทีละ 10, 000 เยน',
                      xyxy=(65.0, 1051.0, 200.0, 1211.0), target_lang='THA', font_size=14)
    below = FakeRegion(horizontal=True, translation='คอร์สปิเศษ 30, 000 เยน', xyxy=(62.0, 1208.0, 223.0, 1281.0),
                       target_lang='THA', font_size=14)
    rend.resize_regions_to_font_size(img, [above, sign, below], None, 0, 8, bubble_fit=True, anti_overlap=True,
                                     font_size_max=20, clean_layout=True)
    _, y1, _, y2 = sign.render_dst_box
    assert y2 - y1 > 1206 - 1086, 'precondition: the block is taller than the gap'
    assert abs((y2 - 1206.0) - (1086.0 - y1)) <= 2, sign.render_dst_box


def test_a_relaid_block_is_dodged_with_its_new_size_795():
    """Review of bfc9a64d: a block re-laid to a narrower free space is taller, but it was placed
    against the dodge of the OLD block — both edges looked pushed, so it was centred back over the
    neighbour above (top 73.5 under a neighbour ending at 100). The dodge is redone at its new size."""
    above = (0.0, 0.0, 200.0, 100.0)
    cx, cy = rend._place_off_neighbours(100.0, 150.0, 60.0, 160.0, [above], None)
    assert cy - 80.0 >= 100.0, cy


def test_a_one_sided_second_dodge_moves_flush_not_to_a_phantom_gap_795():
    """Review of bfc9a64d: when the move hits a neighbour on an axis the first dodge never touched,
    the far side is no neighbour — the block sits flush against the one it hit instead of being
    centred between it and the block's own old edge (which left it still overlapping)."""
    left = (0.0, 90.0, 110.0, 150.0)       # pushes the 100x40 block right, flush at x=112
    low_right = (205.0, 135.0, 300.0, 300.0)  # untouched before; the move to x 112..212 runs into it
    cx, cy = rend._place_off_neighbours(150.0, 120.0, 100.0, 40.0, [left, low_right], None)
    x2, y2 = cx + 50.0, cy + 20.0
    assert x2 <= 205.0 or y2 <= 135.0, (cx, cy)


_SHRINK_BY = {'หนึ่ง': 2, 'สอง': 2, 'ยาวมาก!': 3, 'เล็กลงมาก': 12}   # per-text shrink of the stub fit


def _echo_stubs(monkeypatch):
    monkeypatch.setattr(rend, '_bubble_interior_box',
                        lambda region, bubble_box, shape: (60.0, 40.0, (50.0, 50.0)))
    monkeypatch.setattr(rend, '_bubble_fit_font_size', lambda region, wh, ratio: 42)

    def laid(region, shape, fmin, fmax, page_shape=None, shrink_to_fit=False, **kw):
        tall = getattr(region, 'tall', False) and not shrink_to_fit
        if shrink_to_fit:   # the shrink fit: wrap into the box, 6 px smaller (or as the region says)
            return (fmax - _SHRINK_BY.get(region.translation, 6), min(50.0, region.xyxy[2] - region.xyxy[0]), 30.0)
        return (fmax, 50.0, 90.0 if tall else 30.0)
    monkeypatch.setattr(rend, '_clean_layout_dst', laid)


def _in_balloon(y, font, text='เฮ้', **kw):
    # a narrow source column in a wider balloon -> the clean_layout branch
    kw.setdefault('horizontal', True)
    return FakeRegion(translation=text, xyxy=(300, y, 340, y + 40),
                      bubble_box=(290, y - 10, 400, y + 50), font_size=font, **kw)


def _page():
    lines = [_in_balloon(100 + 70 * k, s) for k, s in enumerate((18, 20, 16))]
    credit = _in_balloon(400, 8, 'อย่ารีโฮสต์')
    sole = FakeRegion(horizontal=True, translation='เปลี่ยนเรื่อง', xyxy=(20, 20, 100, 100),
                      bubble_box=(10, 10, 110, 110), font_size=18)
    return lines, credit, sole


def test_font_src_scale_sets_one_dialogue_size_per_page_851(monkeypatch):
    """#851: the dialogue on one page rendered at 20 px (absolute font_size_max) next to a sole balloon
    filled to 35-37 px, both blind to the source lettering. With font_src_scale the page's dialogue
    size is scale x the median source size; bubble_fit_sole stops above it; a region far below the
    median (8 px credits) keeps its own scaled size."""
    _echo_stubs(monkeypatch)
    lines, credit, sole = _page()
    img = np.full((800, 800, 3), 255, np.uint8)
    rend.resize_regions_to_font_size(img, lines + [credit, sole], None, 0, 8, bubble_fit=True,
                                     font_size_max=20, clean_layout=True, font_src_scale=1.4)
    assert [r.render_font_px for r in lines] == [25, 25, 25]      # round(1.4 x median 18)
    assert credit.render_font_px == 11                            # round(1.4 x its own 8)
    assert sole.render_font_px == 25                              # was 42: filled past the page size


def test_font_src_scale_zero_keeps_the_absolute_font_851(monkeypatch):
    _echo_stubs(monkeypatch)
    lines, credit, sole = _page()
    img = np.full((800, 800, 3), 255, np.uint8)
    rend.resize_regions_to_font_size(img, lines + [credit, sole], None, 0, 8, bubble_fit=True,
                                     font_size_max=20, clean_layout=True)
    assert [r.render_font_px for r in lines] == [20, 20, 20] and sole.render_font_px == 42


def test_the_page_size_survives_patch_grouping_851(monkeypatch):
    """The /patches path renders one group of regions at a time, so the page median is fixed on the
    whole page first (annotate_page_font) and a group alone still gets it."""
    _echo_stubs(monkeypatch)
    lines, credit, sole = _page()
    rend.annotate_page_font(lines + [credit, sole], 1.4)
    img = np.full((800, 800, 3), 255, np.uint8)
    rend.resize_regions_to_font_size(img, [lines[1]], None, 0, 8, bubble_fit=True,
                                     font_size_max=20, clean_layout=True, font_src_scale=1.4)
    assert lines[1].render_font_px == 25                          # not round(1.4 x its own 20) = 28


def test_lettering_far_above_the_page_size_keeps_the_absolute_font_851(monkeypatch):
    """Iruma p0 candidates (2026-10-21): an SFX the detector did not tag ('PRK', 44 px against a 13 px
    page median) took scale x its own size — 79 px at 1.8. Only regions below the band (credits)
    scale from their own size; one far above it keeps the absolute font as before."""
    _echo_stubs(monkeypatch)
    lines, credit, sole = _page()
    sfx = _in_balloon(600, 44, 'ปึ่ก')
    img = np.full((800, 800, 3), 255, np.uint8)
    rend.resize_regions_to_font_size(img, lines + [credit, sole, sfx], None, 0, 8, bubble_fit=True,
                                     font_size_max=20, clean_layout=True, font_src_scale=1.4)
    assert sfx.render_font_px == 20 and lines[0].render_font_px == 25


def test_text_outside_any_balloon_keeps_the_absolute_font_851(monkeypatch):
    """A/B at 1.4 (2026-10-21): balloon-less text — a table of contents, a sign — is packed tight
    against its neighbours; growing it to the page size overlapped 10 pairs. Only text in a balloon
    takes the page size."""
    _echo_stubs(monkeypatch)
    lines, credit, sole = _page()
    caption = FakeRegion(horizontal=True, translation='ตอนที่ 1', xyxy=(500, 600, 700, 630), font_size=18)
    img = np.full((800, 800, 3), 255, np.uint8)
    rend.resize_regions_to_font_size(img, lines + [credit, sole, caption], None, 0, 8, bubble_fit=True,
                                     font_size_max=20, clean_layout=True, font_src_scale=1.4)
    assert caption.render_font_px == 20 and lines[0].render_font_px == 25


def test_a_block_too_tall_for_its_balloon_is_relaid_851(monkeypatch):
    """A/B at 1.4 (Akuyaku p1): a clean-layout block at the page size fit the balloon's width but not
    its height and spilled. With the page size on, a block taller than the interior is laid out
    again on it (wrap, then shrink) like one that is too wide (#832)."""
    _echo_stubs(monkeypatch)
    lines, credit, sole = _page()
    tall = _in_balloon(600, 18, 'ยาวมาก', tall=True)
    img = np.full((800, 800, 3), 255, np.uint8)
    rend.resize_regions_to_font_size(img, lines + [credit, sole, tall], None, 0, 8, bubble_fit=True,
                                     font_size_max=20, clean_layout=True, font_src_scale=1.4)
    assert tall.render_font_px == 19                              # re-laid with shrink: 25 - 6


def test_a_tall_balloon_keeps_the_letterers_column_width():
    """Kaoru p0 (2026-10-21): 'THINK OF THE SIGHTSEEING!' is lettered as two 152 px lines in a tall
    octagon; bubble_fit_tall squeezed the Thai until it filled the interior's height — a 60 px column
    of one word per line ('สวย / แค่ / ไหน!'). The Thai column is never narrower than the source
    column the letterer chose: the squeeze aims at the height the source text used, not the balloon's."""
    from pathlib import Path
    from manga_translator.rendering import text_render
    text_render.set_font(str(Path(__file__).parent.parent / 'fonts' / 'Prompt-Regular.ttf'))
    img = np.full((1600, 1070, 3), 255, np.uint8)
    r = FakeRegion(horizontal=True, translation='คิดดูสิว่าวิวมันจะสวยแค่ไหน!', xyxy=(843.0, 158.0, 995.0, 213.0),
                   bubble_box=(825.0, 40.0, 1019.0, 483.0), target_lang='THA', font_size=25)
    rend.resize_regions_to_font_size(img, [r], None, 0, 8, bubble_fit=True, anti_overlap=True,
                                     font_size_max=20, clean_layout=True)
    x1, _, x2, _ = r.render_dst_box
    assert r.render_branch == 'bubble_fit_tall' and x2 - x1 >= 0.75 * 152, (r.render_dst_box, r.render_font_px)


def test_a_tall_balloon_keeps_the_letterers_column_width_too():
    """Replay of a10a303c (Kage p0): with the squeeze aimed at the source height, the Thai wrapped to
    the full interior width and touched the narration box's border (block 614..771 in a 616..769
    box) — the old one-word column had hidden it. The column also keeps the letterer's width (the
    134 px source column), widening toward the interior only if the text does not fit."""
    from pathlib import Path
    from manga_translator.rendering import text_render
    text_render.set_font(str(Path(__file__).parent.parent / 'fonts' / 'Prompt-Regular.ttf'))
    img = np.full((1600, 1100, 3), 255, np.uint8)
    r = FakeRegion(horizontal=True, translation='ผู้ที่ทำได้เช่นนั้น คือเพียงผู้ถือครองพลังธรรมดาๆ',
                   xyxy=(624.0, 1231.0, 758.0, 1296.0), bubble_box=(616.0, 1146.0, 769.0, 1382.0),
                   target_lang='THA', font_size=20)
    rend.resize_regions_to_font_size(img, [r], None, 0, 8, bubble_fit=True, anti_overlap=True,
                                     font_size_max=20, clean_layout=True)
    x1, _, x2, _ = r.render_dst_box
    assert r.render_branch == 'bubble_fit_tall' and 616 + 4 <= x1 and x2 <= 769 - 4, r.render_dst_box


def test_page_size_review_fixes_851(monkeypatch):
    """Review of d5fda3a3: (a) a page-size font never drops below font_size_minimum; (b) an SFX region
    gets no page size; (c) clean layout does not grow past the page size toward a bigger own size."""
    lines = [_in_balloon(100 + 70 * k, s) for k, s in enumerate((30, 30, 50))]
    tiny = _in_balloon(400, 10)
    sfx = _in_balloon(500, 30, 'ตูม', from_sfx_detection=True)
    rend.annotate_page_font(lines + [tiny, sfx], 0.5)
    assert sfx.page_font is None
    _echo_stubs(monkeypatch)
    img = np.full((800, 800, 3), 255, np.uint8)
    rend.resize_regions_to_font_size(img, lines + [tiny], None, 0, 8, bubble_fit=True,
                                     font_size_max=20, clean_layout=True, font_src_scale=0.5)
    assert tiny.render_font_px >= 8                                # round(0.5 x 10) = 5 -> the minimum


def test_clean_layout_does_not_grow_past_the_page_size_851():
    from pathlib import Path
    from manga_translator.rendering import text_render
    text_render.set_font(str(Path(__file__).parent.parent / 'fonts' / 'Prompt-Regular.ttf'))
    from types import SimpleNamespace
    r = SimpleNamespace(translation='สวัสดี', target_lang='THA', font_size=50, xyxy=(0.0, 0.0, 400.0, 300.0))
    assert rend._clean_layout_dst(r, (800, 800, 3), 8, 30, grow=False)[0] == 30
    assert rend._clean_layout_dst(r, (800, 800, 3), 8, 30)[0] == 50     # default unchanged


def test_page_size_applies_only_where_it_fits_851(monkeypatch):
    """A/B at 1.4 (2026-10-21): two regions sharing one balloon both grew to the page size and
    collided (Akuyaku p1, Iruma p1), and a tall narration block outgrew its balloon (Kage p1). The
    page size goes only to a balloon's sole occupant, and a page-sized block that does not fit its
    balloon falls back to the absolute font — never worse than without the knob."""
    _echo_stubs(monkeypatch)
    lines, credit, sole = _page()
    shared = [_in_balloon(600, 18, 'ซ้าย'), _in_balloon(600, 18, 'ขวา')]       # same bubble_box
    tall = _in_balloon(500, 18, 'ยาวมาก', tall=True, horizontal=False)          # no #832 re-lay
    img = np.full((800, 800, 3), 255, np.uint8)
    rend.resize_regions_to_font_size(img, lines + [credit, sole] + shared + [tall], None, 0, 8,
                                     bubble_fit=True, font_size_max=20, clean_layout=True, font_src_scale=1.4)
    assert [r.render_font_px for r in shared] == [20, 20]
    assert tall.render_font_px == 20 and lines[0].render_font_px == 25


def test_a_page_size_that_does_not_fit_shrinks_to_fit_before_falling_back_851(monkeypatch):
    """A/B at 1.4 with the fallback (7cd7e0d1): a region that did not fit dropped straight to the absolute
    20 px next to 39 px neighbours — pages got LESS consistent (Akuyaku p1 1.55x -> 1.95x). It now takes the
    largest size <= the page size that fits its balloon interior (or, sharing a balloon, its own
    footprint), and only below the absolute font falls back to it."""
    _echo_stubs(monkeypatch)
    lines, credit, sole = _page()
    shared = [_in_balloon(600, 18, 'หนึ่ง'), _in_balloon(600, 18, 'สอง')]
    tall = _in_balloon(500, 18, 'ยาวมาก!', tall=True, horizontal=False)
    small = _in_balloon(300, 18, 'เล็กลงมาก', tall=True, horizontal=False)
    img = np.full((800, 800, 3), 255, np.uint8)
    rend.resize_regions_to_font_size(img, lines + [credit, sole] + shared + [tall, small], None, 0, 8,
                                     bubble_fit=True, font_size_max=20, clean_layout=True, font_src_scale=1.4)
    assert [r.render_font_px for r in shared] == [23, 23]     # fits its own 40 px footprint at 25 - 2
    assert tall.render_font_px == 22                           # fits the interior at 25 - 3
    assert small.render_font_px == 20                          # 25 - 12 < 20: the absolute font


def test_a_page_sized_block_slightly_taller_than_its_box_is_refitted_851(monkeypatch):
    """A/B on 8d67df60 (Kage p1): a 303 px block passed the fit check of a 292 px box under 5 % slack
    and spilled. The page-size fit has no slack."""
    _echo_stubs(monkeypatch)
    monkeypatch.setattr(rend, '_bubble_interior_box', lambda region, bubble_box, shape: (60.0, 88.0, (50.0, 50.0)))
    lines, credit, sole = _page()
    tall = _in_balloon(500, 18, 'ยาวมาก!', tall=True, horizontal=False)     # laid 90 tall in an 88 px box
    img = np.full((800, 800, 3), 255, np.uint8)
    rend.resize_regions_to_font_size(img, lines + [credit, sole, tall], None, 0, 8,
                                     bubble_fit=True, font_size_max=20, clean_layout=True, font_src_scale=1.4)
    assert tall.render_font_px == 22                                         # refitted, not 25 at 90 px
