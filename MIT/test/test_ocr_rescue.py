"""#172 OCR rescue ladder — pure, ML-free policy + geometric pre-split (no model imports)."""


def test_rescue_steps_good_prob_no_rescue():
    from manga_translator.ocr_rescue import ocr_rescue_steps
    # confident read → no rescue even if the line is wide
    assert ocr_rescue_steps(prob=0.92, aspect_ratio=10.0) == []


def test_rescue_steps_low_prob_wide_line_presplits_then_vision():
    from manga_translator.ocr_rescue import ocr_rescue_steps
    # underconfident AND long-thin → geometric pre-split first, then vision re-read
    assert ocr_rescue_steps(prob=0.4, aspect_ratio=10.0) == ['presplit', 'vision']


def test_rescue_steps_low_prob_normal_shape_skips_presplit():
    from manga_translator.ocr_rescue import ocr_rescue_steps
    # underconfident but not long-thin → pre-split won't help, go straight to vision
    assert ocr_rescue_steps(prob=0.4, aspect_ratio=2.0) == ['vision']


def test_split_overlong_box_leaves_normal_line_untouched():
    from manga_translator.ocr_rescue import split_overlong_box
    box = (10, 20, 90, 60)          # w=80 h=40 aspect=2 -> not over-long
    assert split_overlong_box(box, max_aspect=4.0) == [box]


def test_split_overlong_box_segments_a_wide_line():
    from manga_translator.ocr_rescue import split_overlong_box
    box = (0, 0, 480, 40)           # aspect 12, max 4 -> ceil(12/4)=3 segments
    segs = split_overlong_box(box, max_aspect=4.0)
    assert len(segs) == 3
    # segments tile the full width left-to-right, same y, no gaps/overlap
    assert segs[0][0] == 0 and segs[-1][2] == 480
    for a, b in zip(segs, segs[1:]):
        assert a[2] == b[0]                       # contiguous
    assert all(s[1] == 0 and s[3] == 40 for s in segs)   # full height preserved


def test_rejoin_segment_reads_concatenates_in_order():
    from manga_translator.ocr_rescue import rejoin_segment_reads
    # segment reads of one split line rejoin into the original (contiguous crops)
    assert rejoin_segment_reads(['STAR', 'TING']) == 'STARTING'
    assert rejoin_segment_reads(['HELLO ', 'WORLD']) == 'HELLO WORLD'
    # empty/None segment reads are dropped, not stringified
    assert rejoin_segment_reads(['OK', '', None, '!']) == 'OK!'
