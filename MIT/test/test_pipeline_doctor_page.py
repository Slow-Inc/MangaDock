"""Pipeline Doctor page mode (#756, part of #685): attribute each defect to the first stage it
appears in.

The fixtures mirror the 2026-10-20 EN→TH gate page: one caption box whose lines sit
`gap/char_size` = 1.00 apart, so `textline_merge` left them as separate regions and each line was
translated on its own. The probes must name `merge` as the stage, and mark the fragment
translations downstream as inherited rather than as a second, independent defect.

Torch-free: the probes read a plain snapshot and never import the pipeline.
"""
from tools.pipeline_doctor import FAIL, OK, WARN
from tools.pipeline_doctor.page_probes import PageSnapshot, Region, diagnose


def _region(i, xyxy, text, translation, *, font=20, bubble=None, bubble_box=None,
            branch='clean_layout', font_px=18, dst=None, sfx=False):
    return Region(index=i, xyxy=xyxy, text=text, translation=translation, font_size=font,
                  bubble_idx=bubble, bubble_box=bubble_box, render_branch=branch,
                  render_font_px=font_px, render_dst_box=dst if dst is not None else xyxy,
                  from_sfx=sfx)


CAPTION = (98, 108, 347, 609)


def _split_caption_page():
    # Three lines of one caption, 20 px apart at 20 px font (gap/char_size = 1.00): merge kept
    # them apart, so the translator saw three fragments.
    return PageSnapshot(target_lang='THA', width=1200, height=1705, textlines=6, sfx_lines=0,
                        empty_reads=0, regions=[
        _region(0, (131, 167, 318, 189), 'COLONIAL PLANET', 'ดาวอาณานิคม', bubble=3, bubble_box=CAPTION),
        _region(1, (157, 209, 293, 229), "VESTA'S MAIN", 'เวสตาสเมน', bubble=3, bubble_box=CAPTION),
        _region(2, (114, 249, 335, 434), 'INDUSTRY IS AGRICULTURE', 'อุตสาหกรรมคือเกษตรกรรม',
                bubble=3, bubble_box=CAPTION),
        _region(3, (869, 127, 1084, 306), 'THE FIRST TIME', 'เป็นครั้งแรก', bubble=5,
                bubble_box=(853, 107, 1096, 545)),
    ])


def _by_stage(run):
    return {r.stage: r for r in run.reports}


def test_regions_sharing_one_container_fail_at_merge():
    run, flags = diagnose(_split_caption_page())
    merge = _by_stage(run)['merge']
    assert merge.status == FAIL
    assert merge.metrics['split_containers'] == 1
    assert merge.metrics['split_regions'] == 3
    # the evidence carries the measured spacing, which is what makes the fix obvious
    assert 'gap/char=1.00' in merge.evidence
    assert flags[0][0] == ('merge', FAIL)
    assert 3 not in flags  # the intact caption on the right is not touched


def test_downstream_symptoms_of_a_merge_split_are_inherited_not_new():
    page = _split_caption_page()
    page.regions[1].translation = ''  # an empty fragment translation on a split region
    run, flags = diagnose(page)
    translate = _by_stage(run)['translate']
    assert translate.metrics['inherited'] == 1
    assert translate.metrics['root'] == 0
    assert translate.status == OK  # the root cause is merge's, not translate's
    assert ('translate', 'inherited') in [(s, k) for s, k in flags[1][1:]]


def test_near_miss_lines_in_untagged_regions_warn_at_merge():
    # no balloon tags (bubble seg off / missed): fall back to geometry — vertically adjacent,
    # edge-aligned, same font, gap/char_size between 1.0 and 1.6
    page = PageSnapshot(target_lang='ENG', width=800, height=1150, textlines=2, sfx_lines=0,
                        empty_reads=0, regions=[
        _region(0, (100, 100, 300, 120), 'THE BUGS', 'X'),
        _region(1, (110, 144, 290, 164), 'HAVE A', 'Y'),
    ])
    merge = _by_stage(diagnose(page)[0])['merge']
    assert merge.status == WARN
    assert merge.metrics['near_miss_pairs'] == 1


def test_empty_translation_on_an_intact_region_fails_at_translate():
    page = PageSnapshot(target_lang='ENG', width=800, height=1150, textlines=1, sfx_lines=0,
                        empty_reads=0, regions=[_region(0, (100, 100, 300, 160), 'こんにちは', '')])
    run, flags = diagnose(page)
    assert _by_stage(run)['translate'].status == FAIL
    assert flags[0][0] == ('translate', FAIL)


def test_latin_left_in_a_thai_translation_warns():
    page = PageSnapshot(target_lang='THA', width=800, height=1150, textlines=1, sfx_lines=0,
                        empty_reads=0, regions=[_region(0, (100, 100, 300, 160), 'HELLO THERE', 'HELLO ครับ')])
    translate = _by_stage(diagnose(page)[0])['translate']
    assert translate.status == WARN
    assert translate.metrics['latin_in_target'] == 1


def test_rendered_text_spilling_out_of_its_container_fails_at_render():
    page = PageSnapshot(target_lang='ENG', width=800, height=1150, textlines=1, sfx_lines=0,
                        empty_reads=0, regions=[
        _region(0, (100, 100, 200, 160), 'あ', 'A LONG LINE', bubble=0, bubble_box=(90, 90, 210, 170),
                dst=(60, 95, 240, 165)),
    ])
    run, flags = diagnose(page)
    assert _by_stage(run)['render'].status == FAIL
    assert flags[0][0] == ('render', FAIL)


def test_a_clean_page_is_all_ok():
    page = PageSnapshot(target_lang='ENG', width=800, height=1150, textlines=2, sfx_lines=0,
                        empty_reads=0, regions=[
        _region(0, (100, 100, 200, 160), 'こんにちは', 'HELLO', bubble=0, bubble_box=(90, 90, 210, 170)),
        _region(1, (400, 600, 500, 700), 'さようなら', 'GOODBYE', bubble=1, bubble_box=(390, 590, 510, 710)),
    ])
    run, flags = diagnose(page)
    assert run.ok and not run.warnings
    assert flags == {}


def test_snapshot_from_the_production_patches_payload():
    """The CLI reads the same `/patches` payload production returns (`text_layer.regions_payload`),
    so the probes see what users get. Regions sharing one `bubble_box` share a container; dropped
    regions are reported, not probed."""
    from tools.pipeline_doctor.page_probes import snapshot_from_payload
    payload = {'img_width': 1200, 'img_height': 1705, 'patches': [], 'regions': [
        {'src': 'COLONIAL PLANET', 'dst': 'ดาวอาณานิคม', 'xyxy': [131, 167, 318, 189],
         'bubble_box': [98, 108, 347, 609], 'font_src_px': 21, 'branch': 'clean_layout',
         'font_final_px': 18, 'dst_box': [140.0, 160.0, 310.0, 195.0], 'rendered': True},
        {'src': "VESTA'S MAIN", 'dst': 'เวสตาสเมน', 'xyxy': [157, 209, 293, 229],
         'bubble_box': [98, 108, 347, 609], 'font_src_px': 20, 'rendered': True},
        {'src': 'THE FIRST TIME', 'dst': 'ครั้งแรก', 'xyxy': [869, 127, 1084, 306], 'rendered': True},
        {'src': 'ぬ', 'dst': '', 'xyxy': [10, 10, 90, 90], 'rendered': False, 'drop_reason': 'filtered'},
    ]}
    page = snapshot_from_payload(payload, 'THA', textlines=40, sfx_lines=1, empty_reads=2)
    assert (page.width, page.height, page.textlines) == (1200, 1705, 40)
    assert [r.index for r in page.regions] == [0, 1, 2]
    assert page.regions[0].bubble_idx == page.regions[1].bubble_idx is not None
    assert page.regions[2].bubble_idx is None
    assert page.regions[0].render_dst_box == (140.0, 160.0, 310.0, 195.0)
    assert page.regions[1].render_font_px is None
    assert page.dropped == [('ぬ', 'filtered')]


def test_two_multi_line_paragraphs_in_one_box_only_warn():
    """A caption box with two paragraphs (each region several lines tall) is legitimately two
    regions — seen on the right caption of the 2026-10-20 page. Only a single-line fragment proves
    a split, so paragraphs WARN and do not fail the run."""
    box = (853, 107, 1096, 545)
    page = PageSnapshot(target_lang='THA', width=1200, height=1705, textlines=12, sfx_lines=0,
                        empty_reads=0, regions=[
        _region(0, (869, 127, 1084, 306), 'THE FIRST TIME HUMANITY', 'ก', font=19, bubble=0, bubble_box=box),
        _region(1, (875, 327, 1078, 504), 'DURING THE YEAR 1254', 'ข', font=19, bubble=0, bubble_box=box),
    ])
    merge = _by_stage(diagnose(page)[0])['merge']
    assert merge.status == WARN
    assert merge.metrics['split_containers'] == 0
    assert merge.metrics['paragraph_containers'] == 1


def test_separate_blocks_under_one_container_are_not_a_split():
    """One YOLO polygon can cover two speech boxes drawn as one white shape (2026-10-20 corpus:
    6.1x the font apart). They do not chain as lines of one block, so this is not a merge defect —
    the same rule `container_merge` uses to decide what to coalesce."""
    box = (480, 280, 620, 650)
    page = PageSnapshot(target_lang='THA', width=800, height=1150, textlines=8, sfx_lines=0,
                        empty_reads=0, regions=[
        _region(0, (565, 350, 615, 382), 'TSUKUYOMI', 'ก', font=14, bubble=1, bubble_box=box),
        _region(1, (500, 466, 592, 595), 'IF THERE WAS A RELIGION', 'ข', font=14, bubble=1, bubble_box=box),
    ])
    merge = _by_stage(diagnose(page)[0])['merge']
    assert merge.status == OK
    assert merge.metrics['split_containers'] == 0
    assert merge.metrics['shared_containers'] == 1
