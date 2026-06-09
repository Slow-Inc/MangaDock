"""Translation→region assignment (#187 seam S2).

The happy-path "assign each translated sentence to its region + stamp
target_lang/alignment/direction" loop lived in **four** near-duplicate copies inside
MangaTranslator (single 1151-1160, batch-memory-fallback 1591-1595, batch
2264-2273, concurrent 2476-2481), plus the render-casing logic (also in the retry
path 3022-3025), plus an error-fallback "use the source text as the translation"
loop in **three** copies (2363, 2505, 2541). Extracted to `region_apply` so the
drift surfaces collapse. Behaviour preserved verbatim, including the L10
`zip`-truncation invariant and the uppercase/lowercase casing.
"""
from types import SimpleNamespace

from manga_translator.region_apply import (
    apply_original_as_translation,
    apply_render_casing,
    apply_translations,
)


def _cfg(target_lang='THASIM', alignment='auto', direction='auto',
         uppercase=False, lowercase=False):
    return SimpleNamespace(
        translator=SimpleNamespace(target_lang=target_lang),
        render=SimpleNamespace(
            uppercase=uppercase, lowercase=lowercase,
            alignment=alignment, direction=direction,
        ),
    )


def _r(text='src', translation=None):
    return SimpleNamespace(text=text, translation=translation)


def test_apply_assigns_translation_and_metadata():
    r = _r()
    cfg = _cfg(target_lang='THASIM', alignment='center', direction='h')
    applied = apply_translations([r], ['สวัสดี'], cfg)
    assert applied == 1
    assert r.translation == 'สวัสดี'
    assert r.target_lang == 'THASIM'
    assert r._alignment == 'center'
    assert r._direction == 'h'


def test_casing_off_by_default_leaves_translation_verbatim():
    # batch / concurrent / memory-fallback paths do NOT apply render casing
    r = _r()
    apply_translations([r], ['Hello World'], _cfg(uppercase=True))
    assert r.translation == 'Hello World'


def test_apply_casing_uppercase_when_requested():
    r = _r()
    apply_translations([r], ['Hello'], _cfg(uppercase=True), apply_casing=True)
    assert r.translation == 'HELLO'


def test_apply_casing_lowercase_when_requested():
    r = _r()
    apply_translations([r], ['Hello'], _cfg(lowercase=True), apply_casing=True)
    assert r.translation == 'hello'


def test_apply_render_casing_helper_in_place():
    # the retry path re-cases an already-assigned region.translation in place
    r = _r(translation='Hello')
    apply_render_casing(r, _cfg(uppercase=True))
    assert r.translation == 'HELLO'
    r2 = _r(translation='Hello')
    apply_render_casing(r2, _cfg(lowercase=True))
    assert r2.translation == 'hello'
    r3 = _r(translation='Hello')
    apply_render_casing(r3, _cfg())  # neither flag → untouched
    assert r3.translation == 'Hello'


def test_short_translations_leave_trailing_regions_untouched_L10():
    # L10: zip truncation — fewer translations than regions → the extras keep their
    # prior translation (None) and are never stamped. Count == translations consumed.
    r0, r1, r2 = _r(), _r(), _r()
    applied = apply_translations([r0, r1, r2], ['a', 'b'], _cfg())
    assert applied == 2
    assert (r0.translation, r1.translation) == ('a', 'b')
    assert r2.translation is None
    assert not hasattr(r2, 'target_lang')  # never stamped


def test_extra_translations_are_dropped_L10():
    r0 = _r()
    applied = apply_translations([r0], ['a', 'b', 'c'], _cfg())
    assert applied == 1
    assert r0.translation == 'a'


def test_count_lets_caller_thread_a_shared_index():
    # the batch path consumes a flat translation list across contexts via a running
    # index; the returned count is how the caller advances it.
    flat = ['p0a', 'p0b', 'p1a']
    page0 = [_r(), _r()]
    page1 = [_r()]
    idx = 0
    idx += apply_translations(page0, flat[idx:], _cfg())
    idx += apply_translations(page1, flat[idx:], _cfg())
    assert idx == 3
    assert [r.translation for r in page0] == ['p0a', 'p0b']
    assert [r.translation for r in page1] == ['p1a']


def test_original_as_translation_uses_source_text_for_every_region():
    # error-fallback: keep the source text as its own translation, stamp metadata,
    # no casing, no truncation — every region is touched.
    r0, r1 = _r(text='ใจ'), _r(text='กัน')
    cfg = _cfg(target_lang='ENG', alignment='left', direction='v', uppercase=True)
    apply_original_as_translation([r0, r1], cfg)
    assert r0.translation == 'ใจ'  # casing NOT applied even with uppercase=True
    assert r1.translation == 'กัน'
    for r in (r0, r1):
        assert r.target_lang == 'ENG'
        assert r._alignment == 'left'
        assert r._direction == 'v'
