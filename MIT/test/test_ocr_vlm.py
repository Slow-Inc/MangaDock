"""Vision-LLM SFX OCR rescue (#168 / PRD #172).

Pins the parse/sanitize + the injected-HTTP contract with no network/GPU: a fake
`post_fn` stands in for the OpenAI-compatible vision endpoint, so we test that a
crop turns into a clean UPPERCASE SFX token and that every failure mode degrades
to '' (region drops as before)."""
from types import SimpleNamespace

import numpy as np

from manga_translator.ocr_vlm import build_sfx_prompt, restore_sfx_translations, sanitize_sfx, vlm_localize_sfx


def _crop():
    return np.zeros((40, 80, 3), dtype=np.uint8)


class _Resp:
    def __init__(self, content):
        self._c = content
    def json(self):
        return {"choices": [{"message": {"content": self._c}}]}


def _post_returning(content):
    calls = {}
    def post(url, headers=None, json=None, timeout=None):
        calls['url'] = url
        calls['json'] = json
        calls['headers'] = headers
        return _Resp(content)
    post.calls = calls
    return post


# ── sanitize_sfx (pure) ───────────────────────────────────────────────────────

def test_sanitize_uppercases_and_strips_punctuation():
    assert sanitize_sfx('"loom"') == 'LOOM'
    assert sanitize_sfx('Loom.') == 'LOOM'

def test_sanitize_takes_first_nonempty_line():
    assert sanitize_sfx('\n  \nLOOM\nsome explanation') == 'LOOM'

def test_sanitize_keeps_multiword_and_bang():
    assert sanitize_sfx('ba-dump!') == 'BA-DUMP!'

def test_sanitize_empty_or_refusal_returns_blank():
    assert sanitize_sfx('') == ''
    assert sanitize_sfx('none') == ''
    assert sanitize_sfx('   ') == ''

def test_sanitize_caps_length():
    assert len(sanitize_sfx('A' * 100)) == 24


# ── vlm_localize_sfx (HTTP injected) ──────────────────────────────────────────

def test_localize_returns_sanitized_sfx():
    post = _post_returning('LOOM')
    out = vlm_localize_sfx(_crop(), api_base='https://gw/v1', api_key='k', model='m', post_fn=post)
    assert out == 'LOOM'
    # request shape: posts to /chat/completions with bearer + an image part
    assert post.calls['url'] == 'https://gw/v1/chat/completions'
    assert post.calls['headers']['Authorization'] == 'Bearer k'
    parts = post.calls['json']['messages'][0]['content']
    assert any(p.get('type') == 'image_url' and p['image_url']['url'].startswith('data:image/png;base64,') for p in parts)

def test_localize_blank_creds_short_circuits_without_calling():
    called = {'n': 0}
    def post(*a, **k):
        called['n'] += 1
        raise AssertionError('should not be called')
    assert vlm_localize_sfx(_crop(), api_base='', api_key='k', model='m', post_fn=post) == ''
    assert called['n'] == 0

def test_localize_http_error_degrades_to_blank():
    def post(*a, **k):
        raise RuntimeError('network down')
    assert vlm_localize_sfx(_crop(), api_base='https://gw/v1', api_key='k', model='m', post_fn=post) == ''

def test_localize_malformed_response_degrades_to_blank():
    class Bad:
        def json(self):
            return {"unexpected": True}
    assert vlm_localize_sfx(_crop(), api_base='https://gw/v1', api_key='k', model='m',
                            post_fn=lambda *a, **k: Bad()) == ''


# ── restore_sfx_translations (survive the translate stage) ────────────────────
# The rescue produces the FINAL English SFX and flags the region; the translate
# stage then blanks region.translation (translating an already-English word). This
# helper, run after apply_translations, restores the SFX so it isn't dropped.

def test_restore_resets_translation_to_text_for_flagged_regions():
    r = SimpleNamespace(text='LOOM', translation='', sfx_rescued=True)
    restore_sfx_translations([r])
    assert r.translation == 'LOOM'

def test_restore_leaves_normal_regions_untouched():
    r = SimpleNamespace(text='ぬ', translation='its real translation')
    restore_sfx_translations([r])
    assert r.translation == 'its real translation'


# ── multilingual SFX — TH/ZH/KO get target-language onomatopoeia, ENG unchanged ──
# Before: the prompt + sanitizer were hardcoded English (Latin-only), so a non-ENG
# target produced an English SFX that failed the target-script check and the region
# dropped → the raw JP glyph (ぬ) survived. Now the prompt asks for the target
# language and the sanitizer keeps that script.

def test_build_prompt_eng_is_byte_identical():
    p = build_sfx_prompt('ENG')
    assert 'the English onomatopoeia an official English manga translation' in p
    assert '1-3 words, UPPERCASE, no quotes' in p          # ENG keeps the UPPERCASE instruction


def test_build_prompt_targets_language_without_uppercase_for_non_latin():
    for code, name in [('THA', 'Thai'), ('CHS', 'Chinese'), ('CHT', 'Chinese'), ('KOR', 'Korean')]:
        p = build_sfx_prompt(code)
        assert f'the {name} onomatopoeia an official {name} manga translation' in p
        assert 'UPPERCASE' not in p                          # no case for non-Latin scripts


def test_sanitize_keeps_target_script_for_non_latin():
    assert sanitize_sfx('"ตึง"', 'THA') == 'ตึง'             # Thai kept, quotes stripped
    assert sanitize_sfx('砰！', 'CHS') == '砰'                # Chinese kept, fullwidth ! stripped
    assert sanitize_sfx('쿵', 'KOR') == '쿵'                  # Korean kept


def test_sanitize_eng_latin_unchanged():
    assert sanitize_sfx('loom', 'ENG') == 'LOOM'
    assert sanitize_sfx('"loom"') == 'LOOM'                  # default target_lang stays ENG/Latin


def test_localize_threads_target_lang_into_prompt():
    post = _post_returning('ตึง')
    out = vlm_localize_sfx(_crop(), api_base='https://gw/v1', api_key='k', model='m',
                           target_lang='THA', post_fn=post)
    assert out == 'ตึง'                                      # Thai SFX survives sanitize
    prompt_text = post.calls['json']['messages'][0]['content'][0]['text']
    assert 'Thai' in prompt_text and 'English onomatopoeia' not in prompt_text


# ── should_rescue_sfx (pure provenance gate, #278) ─────────────────────────────
from manga_translator.ocr_vlm import should_rescue_sfx, ocr_read_real_text  # noqa: E402


def test_ocr_read_real_text_detects_ascii_alnum():
    # the false-positive fragments observed across the Gal Yome EN→Thai pages
    for s in ("W", "I", "THE", "M", "8", "1", "WHA", "HUH?"):
        assert ocr_read_real_text(s), s
    # the genuine dropped stylized glyphs the rescue is for — NOT real-text reads
    for s in ("ぬ", "サ", "ぎい", "ほ。ん", "⁉", "", "  ", None):
        assert not ocr_read_real_text(s), s


def test_rescue_fires_for_det_sfx_provenance_short_text_large_box():
    # a det_sfx-provenance region the 48px OCR read as a few chars → rescue
    assert should_rescue_sfx("ぬ", from_sfx_detection=True, box_w=120, box_h=90, vlm_rescue=True)


def test_rescue_NOT_for_short_dialogue_without_provenance():
    # #278 core: 3-4 char dialogue ("HUH?") in a big bubble, NOT det_sfx → must NOT be rescued
    assert not should_rescue_sfx("HUH?", from_sfx_detection=False, box_w=200, box_h=120, vlm_rescue=True)   # 4 chars
    assert not should_rescue_sfx("ですよ", from_sfx_detection=False, box_w=200, box_h=120, vlm_rescue=True)  # 3 chars


def test_rescue_fallback_tight_2char_without_provenance():
    # no provenance → only ≤2 chars qualify (tight fallback)
    assert should_rescue_sfx("は", from_sfx_detection=False, box_w=200, box_h=120, vlm_rescue=True)
    assert should_rescue_sfx("おい", from_sfx_detection=False, box_w=200, box_h=120, vlm_rescue=True)
    assert not should_rescue_sfx("おはよ", from_sfx_detection=False, box_w=200, box_h=120, vlm_rescue=True)  # 3 chars


def test_rescue_blocked_when_text_too_long_even_with_provenance():
    assert not should_rescue_sfx("ABCDE", from_sfx_detection=True, box_w=200, box_h=120, vlm_rescue=True)  # 5 > 4


def test_rescue_blocked_for_small_box():
    assert not should_rescue_sfx("ぬ", from_sfx_detection=True, box_w=30, box_h=30, vlm_rescue=True)   # area < 3600
    assert not should_rescue_sfx("ぬ", from_sfx_detection=True, box_w=400, box_h=20, vlm_rescue=True)  # min side < 24


def test_rescue_off_when_vlm_rescue_disabled():
    assert not should_rescue_sfx("ぬ", from_sfx_detection=True, box_w=200, box_h=120, vlm_rescue=False)


def test_rescue_NOT_for_ascii_reads_even_with_provenance():
    # #278 (root cause of the empty/garbled-bubble defect): det_sfx false-positives on
    # dialogue bubbles get 48px-OCR'd as clean ASCII fragments ("W"/"I"/"THE"/"M"/"8"/"WHA").
    # A genuine stylized SFX the OCR DROPS reads as non-ASCII garbage/CJK — so a readable
    # ASCII letter/digit is proof the OCR succeeded on real text, NOT a dropped glyph.
    # Rescuing those made the vision model hallucinate a phantom Thai SFX that merged INTO
    # and corrupted the real dialogue render (observed across 5 Gal Yome EN→Thai pages).
    for ascii_read in ("W", "I", "THE", "M", "8", "1", "WHA"):
        assert not should_rescue_sfx(ascii_read, from_sfx_detection=True,
                                     box_w=400, box_h=370, vlm_rescue=True), ascii_read


def test_rescue_STILL_fires_for_nonascii_dropped_glyphs():
    # regression guard: the real stylized SFX the rescue is FOR (the non-ASCII glyphs the
    # 48px OCR drops) must still rescue — these are exactly what was localized correctly
    # in the same run ("ほ。ん"→โฮน, "サ"→ซาซึ, "ぎい"→กิริ๊ง).
    for glyph in ("ぬ", "サ", "ぎい", "ほ。ん"):
        assert should_rescue_sfx(glyph, from_sfx_detection=True,
                                 box_w=400, box_h=370, vlm_rescue=True), glyph


# ── #278 nits: ENG prompt byte-identity (==) + non-Latin refusal guard ─────────

def test_build_prompt_eng_is_byte_identical_exact():
    assert build_sfx_prompt('ENG') == (
        "This image is a cropped sound effect (SFX / onomatopoeia) from a Japanese manga panel. "
        "Reply with ONLY the English onomatopoeia an official English manga translation would letter "
        "in its place, matching the mood of the scene. 1-3 words, UPPERCASE, no quotes, no punctuation, "
        "no explanation. If it is not a sound effect, reply with an empty line."
    )


def test_sanitize_non_latin_drops_latin_refusal():
    # a Thai-target reply that declines in Latin must not pass as a SFX token
    assert sanitize_sfx('NONE', target_lang='THA') == ''
    assert sanitize_sfx('NA', target_lang='THA') == ''
    # a real Thai SFX still passes
    assert sanitize_sfx('ตูม', target_lang='THA') == 'ตูม'
