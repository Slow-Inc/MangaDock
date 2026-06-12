"""Vision-LLM SFX OCR rescue (#168 / PRD #172).

Pins the parse/sanitize + the injected-HTTP contract with no network/GPU: a fake
`post_fn` stands in for the OpenAI-compatible vision endpoint, so we test that a
crop turns into a clean UPPERCASE SFX token and that every failure mode degrades
to '' (region drops as before)."""
from types import SimpleNamespace

import numpy as np

from manga_translator.ocr_vlm import restore_sfx_translations, sanitize_sfx, vlm_localize_sfx


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
