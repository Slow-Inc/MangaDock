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
    # #278.2: pin the full literal so a stray-space/word regression is caught by ==, not substrings.
    assert p == (
        "This image is a cropped sound effect (SFX / onomatopoeia) from a Japanese manga panel. "
        "Reply with ONLY the English onomatopoeia an official English manga translation would letter "
        "in its place, matching the mood of the scene. 1-3 words, UPPERCASE, no quotes, no punctuation, "
        "no explanation. If it is not a sound effect, reply with an empty line."
    )


def test_build_prompt_targets_language_without_uppercase_for_non_latin():
    for code, name in [('THA', 'Thai'), ('CHS', 'Chinese'), ('CHT', 'Chinese'), ('KOR', 'Korean')]:
        p = build_sfx_prompt(code)
        assert f'the {name} onomatopoeia an official {name} manga translation' in p
        assert 'UPPERCASE' not in p                          # no case for non-Latin scripts


def test_sanitize_keeps_target_script_for_non_latin():
    assert sanitize_sfx('"ตึง"', 'THA') == 'ตึง'             # Thai kept, quotes stripped
    assert sanitize_sfx('砰！', 'CHS') == '砰'                # Chinese kept, fullwidth ! stripped
    assert sanitize_sfx('쿵', 'KOR') == '쿵'                  # Korean kept


def test_sanitize_drops_english_refusal_for_nonlatin_target():
    # #278.4: a model that echoes an English refusal for a Thai/Chinese request must not
    # leak it as an SFX token — the non-Latin branch previously had no refusal guard.
    assert sanitize_sfx('NONE', 'THA') == ''
    assert sanitize_sfx('N/A', 'CHS') == ''


def test_sanitize_drops_native_cjk_refusal():
    assert sanitize_sfx('无', 'CHS') == ''                    # Chinese "none"
    assert sanitize_sfx('없음', 'KOR') == ''                  # Korean "none"


def test_sanitize_keeps_genuine_nonlatin_sfx_after_guard():
    assert sanitize_sfx('ตึง', 'THA') == 'ตึง'
    assert sanitize_sfx('砰', 'CHS') == '砰'


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
