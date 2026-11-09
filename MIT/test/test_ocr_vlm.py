"""Vision-LLM SFX OCR rescue (#168 / PRD #172).

Pins the parse/sanitize + the injected-HTTP contract with no network/GPU: a fake
`post_fn` stands in for the OpenAI-compatible vision endpoint, so we test that a
crop turns into a clean UPPERCASE SFX token and that every failure mode degrades
to '' (region drops as before)."""
from types import SimpleNamespace

import numpy as np

from manga_translator.ocr_vlm import (SFX_MAX_TOKENS, build_sfx_prompt, crop_has_lettering,
                                       restore_sfx_translations, sanitize_sfx, vlm_localize_sfx)


def _crop():
    """A white crop with two thick dark strokes - the ink profile of a real SFX crop (#887).

    The rescue refuses crops without lettering before spending a vision call, so the contract tests
    below must feed it the shape of a crop it was built for."""
    crop = np.full((40, 80, 3), 250, dtype=np.uint8)
    crop[6:34, 10:24] = 28
    crop[6:34, 30:44] = 28
    return crop


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
    assert any(p.get('type') == 'image_url' and (p['image_url']['url'].startswith('data:image/jpeg;base64,') or p['image_url']['url'].startswith('data:image/png;base64,')) for p in parts)

# ── #881: a thinking model needs a budget above its reasoning need ────────────
# The configured gateway default (qwen3.8-27b-fp8) answers only after ~154 reasoning
# tokens: max_tokens=24 was spent entirely on reasoning, the reply came back '' with
# finish_reason='length', and the caller read that as "no SFX here" (measured on the
# Boku SFX crop, 2026-10-21).

class _RespFinish:
    def __init__(self, content, finish):
        self._c, self._f = content, finish
    def json(self):
        return {"choices": [{"message": {"content": self._c}, "finish_reason": self._f}]}


def test_localize_budget_lets_a_thinking_model_answer():
    bodies = []
    def post(url, headers=None, json=None, timeout=None):
        bodies.append(json)
        if json['max_tokens'] < 200:      # the gateway spends a small budget on reasoning
            return _RespFinish('', 'length')
        return _RespFinish('เฮ้อ', 'stop')
    out = vlm_localize_sfx(_crop(), api_base='https://gw/v1', api_key='k', model='m',
                           target_lang='THA', post_fn=post)
    assert out == 'เฮ้อ'
    assert bodies[0]['max_tokens'] >= 200


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
    # #881: the rescue now TRANSCRIBES instead of inventing an SFX, so 1-2 mark reads from det_sfx
    # are sent; a box over a bubble then comes back as that bubble's own text and is dropped by
    # resolve_rescue (below). Real words ("THE", "WHA") still prove the OCR did its job.
    for ascii_read in ("THE", "WHA"):
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


# ── #697: reject the refusal replies the vision model actually sends ──────────

def test_sanitize_eng_rejects_empty_line_restatement():
    # the model echoes the prompt's own "reply with an empty line" instruction
    assert sanitize_sfx('EMPTY LINE') == ''

def test_sanitize_eng_rejects_parenthesized_refusal():
    # meta-commentary wrapped in parens (trailing punctuation allowed)
    assert sanitize_sfx('(no sound effect)') == ''
    assert sanitize_sfx('(no sound effect)!!') == ''

def test_sanitize_tha_rejects_negation():
    # explicit Thai negation: ไม่พบเสียง ("no sound found"), ไม่เกี่ยว ("unrelated")
    assert sanitize_sfx('ไม่พบเสียง', 'THA') == ''
    assert sanitize_sfx('ไม่เกี่ยว', 'THA') == ''

def test_sanitize_tha_rejects_parenthesized_refusal():
    assert sanitize_sfx('(เสียงพูด)', 'THA') == ''

def test_sanitize_real_sfx_still_pass():
    # ENG
    assert sanitize_sfx('LOOM') == 'LOOM'
    assert sanitize_sfx('SQUELCH') == 'SQUELCH'
    assert sanitize_sfx('BAM!') == 'BAM!'
    assert sanitize_sfx('KA-BOOM') == 'KA-BOOM'
    # THA
    assert sanitize_sfx('ตึง', 'THA') == 'ตึง'
    assert sanitize_sfx('ปัง', 'THA') == 'ปัง'


# ── #694: a reply that yields no SFX must say why, not go quiet ───────────────

import logging  # noqa: E402


class _Completion:
    """A chat completion carrying `finish_reason`, which `_Resp` leaves out."""
    def __init__(self, content, finish_reason):
        self._c, self._f = content, finish_reason
    def json(self):
        return {"choices": [{"message": {"content": self._c}, "finish_reason": self._f}]}


def _localize(resp, caplog):
    with caplog.at_level(logging.WARNING, logger='manga_translator'):
        return vlm_localize_sfx(_crop(), api_base='https://gw/v1', api_key='k', model='m',
                                post_fn=lambda *a, **k: resp)


def _warnings(caplog):
    return [r.getMessage() for r in caplog.records if r.levelno == logging.WARNING]


def test_truncated_none_reply_is_logged_with_reason_budget_and_region(caplog):
    assert _localize(_Completion(None, 'length'), caplog) == ''   # render behaviour unchanged
    [msg] = _warnings(caplog)
    assert 'finish_reason=length' in msg
    assert 'content=None' in msg
    assert f'max_tokens={SFX_MAX_TOKENS}' in msg
    assert 'crop=80x40' in msg


def test_truncated_reply_with_partial_content_is_still_logged(caplog):
    assert _localize(_Completion('LOO', 'length'), caplog) == 'LOO'   # value unchanged
    [msg] = _warnings(caplog)
    assert 'finish_reason=length' in msg


def test_reply_that_sanitises_to_nothing_is_logged(caplog):
    assert _localize(_Completion('NONE', 'stop'), caplog) == ''
    [msg] = _warnings(caplog)
    assert 'sanitised to empty' in msg
    assert "'NONE'" in msg


def test_a_completed_reply_logs_nothing(caplog):
    assert _localize(_Completion('LOOM', 'stop'), caplog) == 'LOOM'
    assert _warnings(caplog) == []


# ── 2026-10-20 quality loop: stop paying for a rescue the model cannot serve ─────────────────
# Doctor timing on 17 real pages: every SFX rescue call ended finish_reason=length with no
# content (the gateway model reasons past max_tokens and cannot see images, #693), ~2.5-3 s each,
# sequential — up to 20 s of a page's 31 s. After a run of unusable replies the rescue stops
# calling until a cooldown trial succeeds; a usable reply resets the streak.

def test_rescue_stops_calling_after_consecutive_unusable_replies(caplog):
    from manga_translator.ocr_vlm import SFX_UNSERVED_LIMIT
    calls = {'n': 0}

    def post(*a, **k):
        calls['n'] += 1
        return _Completion(None, 'length')

    for _ in range(SFX_UNSERVED_LIMIT + 3):
        assert vlm_localize_sfx(_crop(), api_base='https://gw/v1', api_key='k', model='m', post_fn=post) == ''
    assert calls['n'] == SFX_UNSERVED_LIMIT


def test_a_usable_reply_resets_the_unserved_streak():
    from manga_translator.ocr_vlm import SFX_UNSERVED_LIMIT
    replies = [_Completion(None, 'length')] * (SFX_UNSERVED_LIMIT - 1) + [_Completion('BAM', 'stop')] \
        + [_Completion(None, 'length')] * (SFX_UNSERVED_LIMIT - 1)
    calls = {'n': 0}

    def post(*a, **k):
        calls['n'] += 1
        return replies[calls['n'] - 1]

    for _ in replies:
        vlm_localize_sfx(_crop(), api_base='https://gw/v1', api_key='k', model='m', post_fn=post)
    assert calls['n'] == len(replies)  # never tripped


def test_failed_calls_count_toward_the_unserved_streak():
    """Doctor 2026-10-20 (Kage p1): the gateway answered an error body with no 'choices' four
    times, ~6 s each — a failing call wastes the same page time as a truncated one."""
    from manga_translator.ocr_vlm import SFX_UNSERVED_LIMIT

    class ErrorBody:
        def json(self):
            return {'error': {'message': 'upstream overloaded'}}

    calls = {'n': 0}

    def post(*a, **k):
        calls['n'] += 1
        return ErrorBody()

    for _ in range(SFX_UNSERVED_LIMIT + 2):
        assert vlm_localize_sfx(_crop(), api_base='https://gw/v1', api_key='k', model='m', post_fn=post) == ''
    assert calls['n'] == SFX_UNSERVED_LIMIT


def test_a_tripped_rescue_retries_once_after_the_cooldown(monkeypatch):
    """A breaker that latched for the life of the process turned one gateway outage into silent,
    permanent loss of SFX rescue on a long-running server. After the cooldown one trial call is
    allowed: a usable reply closes the breaker, another failure re-opens it."""
    from manga_translator import ocr_vlm
    clock = {'t': 1000.0}
    monkeypatch.setattr(ocr_vlm, '_now', lambda: clock['t'])
    replies = [_Completion(None, 'length')] * ocr_vlm.SFX_UNSERVED_LIMIT
    calls = {'n': 0}

    def post(*a, **k):
        calls['n'] += 1
        return replies[calls['n'] - 1] if calls['n'] <= len(replies) else _Completion('BAM', 'stop')

    def call():
        return vlm_localize_sfx(_crop(), api_base='https://gw/v1', api_key='k', model='m', post_fn=post)

    for _ in range(ocr_vlm.SFX_UNSERVED_LIMIT + 2):
        call()
    assert calls['n'] == ocr_vlm.SFX_UNSERVED_LIMIT              # tripped
    clock['t'] += ocr_vlm.SFX_BREAKER_COOLDOWN_S
    replies.append(_Completion(None, 'length'))
    call()
    call()
    assert calls['n'] == ocr_vlm.SFX_UNSERVED_LIMIT + 1          # one trial, failed -> open again
    clock['t'] += ocr_vlm.SFX_BREAKER_COOLDOWN_S
    assert call() != ''                                          # trial succeeds -> closed
    call()
    assert calls['n'] == ocr_vlm.SFX_UNSERVED_LIMIT + 3


def test_after_the_cooldown_only_one_trial_is_admitted(monkeypatch):
    """Half-open means ONE trial: concurrent pages must not each spend a ~3 s call."""
    from manga_translator import ocr_vlm
    clock = {'t': 1000.0}
    monkeypatch.setattr(ocr_vlm, '_now', lambda: clock['t'])
    for _ in range(ocr_vlm.SFX_UNSERVED_LIMIT):
        ocr_vlm._breaker.fail('m')
    assert not ocr_vlm._breaker.allows()
    clock['t'] += ocr_vlm.SFX_BREAKER_COOLDOWN_S
    assert ocr_vlm._breaker.allows()        # the trial
    assert not ocr_vlm._breaker.allows()    # a concurrent page while the trial is in flight


# #754 — ADR 026 Addendum DROP, narrowed by the 2026-10-20 corpus probe (16 EN pages): every det_sfx
# false-positive read ONE ASCII char from art ('I', 'v', 'n', 'S', '1'), while multi-char ASCII
# reads were real lettering worth keeping ('CHAINSAWMAN', 'Yamai', 'Omake', '491'). A real-text
# read sitting on a dialogue line ('W'/'THE' over a bubble, Gal Yome 2026-06-30) is dropped too.

def test_a_single_char_ascii_read_from_det_sfx_is_a_false_positive():
    from manga_translator.ocr_vlm import sfx_false_positive
    for t in ('I', 'v', 'S', '1'):
        assert sfx_false_positive(t, True, (0, 0, 200, 300), [])


def test_real_multi_char_lettering_off_the_dialogue_is_kept():
    from manga_translator.ocr_vlm import sfx_false_positive
    for t in ('CHAINSAWMAN', 'Yamai', '491'):
        assert not sfx_false_positive(t, True, (0, 0, 200, 300), [(500, 500, 600, 540)])


def test_a_real_text_read_that_is_a_fragment_of_a_dialogue_line_is_dropped():
    from manga_translator.ocr_vlm import sfx_false_positive
    assert sfx_false_positive('THE', True, (160, 150, 240, 175), [(100, 140, 300, 190)])


def test_a_big_real_sfx_around_a_small_dialogue_line_is_kept():
    """Review 2026-10-20: 'contains a dialogue centre' dropped a panel-wide 'BOOM' that merely
    surrounded a small line; a false positive is a fragment INSIDE the dialogue instead."""
    from manga_translator.ocr_vlm import sfx_false_positive
    assert not sfx_false_positive('BOOM', True, (0, 0, 400, 300), [(150, 150, 250, 180)])


def test_only_det_sfx_provenance_and_ascii_reads_are_dropped():
    from manga_translator.ocr_vlm import sfx_false_positive
    assert not sfx_false_positive('I', False, (0, 0, 200, 300), [])      # dialogue 'I' stays
    assert not sfx_false_positive('ぬ', True, (0, 0, 200, 300), [])      # dropped glyph: rescue's job


def test_speculative_box_reads_the_region_provenance():
    from types import SimpleNamespace
    from manga_translator.ocr_vlm import speculative_box
    assert speculative_box(SimpleNamespace(speculative=True))
    assert not speculative_box(SimpleNamespace(speculative=False))
    assert not speculative_box(SimpleNamespace())


# #797 follow-up (2026-10-21 probe, 16 pages): rescue placeholders whose OCR read was junk all had
# confidence <= 0.657 ('TAF' .60, 'V' .61, 'LIt' .045); real reads were >= 0.959 ('STICK', 'IS SHE',
# 'CALLED', '-AVALA'). Length cannot tell 'LIt' from 'WAS'; confidence can.

def test_a_low_confidence_placeholder_read_is_junk():
    from types import SimpleNamespace
    from manga_translator.ocr_vlm import placeholder_junk
    assert placeholder_junk(SimpleNamespace(rescue_placeholder=True, prob=0.6))
    assert not placeholder_junk(SimpleNamespace(rescue_placeholder=True, prob=0.97))
    assert not placeholder_junk(SimpleNamespace(rescue_placeholder=False, prob=0.1))  # DBNet text


def _blank_crop(w=120, h=90, lines=0):
    """A near-white crop with a few thin panel/armour lines - the det_sfx false-positive shape
    the rescue was inventing SFX on (#887)."""
    crop = np.full((h, w, 3), 250, np.uint8)
    for i in range(lines):
        y = int(h * (i + 1) / (lines + 1))
        crop[max(0, y - 1):y + 1, :] = 60
    return crop


def _lettered_crop(w=120, h=90):
    """White crop with two thick dark strokes: the ink profile of real lettering."""
    crop = np.full((h, w, 3), 250, np.uint8)
    crop[20:70, 20:32] = 30
    crop[20:70, 45:57] = 30
    crop[30:42, 70:110] = 30
    return crop


def test_a_blank_art_crop_has_no_lettering_887():
    """Taida p0: a det_sfx box on plain armour (mean 248, 4.8% dark, std 30) became a rendered
    phantom 'ฟู่'. Blank/line-only crops must not reach the vision call."""
    assert crop_has_lettering(_blank_crop(lines=0)) is False
    assert crop_has_lettering(_blank_crop(lines=3)) is False


def test_a_lettered_crop_has_lettering_887():
    assert crop_has_lettering(_lettered_crop()) is True


def test_a_blank_crop_is_never_sent_to_the_vision_endpoint_887():
    calls = []
    import requests
    orig = requests.post
    try:
        requests.post = lambda *a, **k: calls.append(1)
        out = vlm_localize_sfx(_blank_crop(lines=2), api_base='http://x/v1', api_key='k', model='m')
    finally:
        requests.post = orig
    assert out == ''
    assert calls == []


def _single_stroke_crop(w=120, h=90):
    """One thick connected stroke (a panel arc / a thick oval) - high ink, no lettering. These
    were the 4 phantoms that survived the contrast guard (#887)."""
    crop = np.full((h, w, 3), 250, np.uint8)
    crop[34:58, 8:112] = 30          # thicker than the contrast floor, still ONE stroke
    return crop


def test_one_thick_non_lettering_stroke_has_no_lettering_887():
    """Contrast alone admits a thick arc or oval; lettering is SEVERAL separate strokes."""
    assert crop_has_lettering(_single_stroke_crop()) is False


def test_lettering_is_several_strokes_887():
    """Two separate thick strokes (the shape of real katakana) are lettering; the ink amount is the
    same as the single-stroke crop, so this pins the component rule rather than the contrast rule."""
    assert crop_has_lettering(_lettered_crop()) is True


# #881 review: `swallows_dialogue` was folded into `resolve_rescue` (`_containment`, same 70 % threshold), so
# the #887 r3 container case is pinned by `test_resolve_rescue_keeps_new_text_and_drops_what_repeats_a_bubble`
# below rather than by two tests of a helper the pipeline no longer calls.

def test_localize_candidates_runs_concurrently_and_preserves_order():
    import asyncio
    import time

    from manga_translator.ocr_vlm import localize_candidates

    calls = []

    def fake_worker(crop, *, api_base, api_key, model, target_lang):
        calls.append(crop)
        time.sleep(0.15)
        return 'sfx-' + crop

    started = time.time()
    out = asyncio.run(localize_candidates(['a', 'b', 'c', 'd'], api_base='x', api_key='k', model='m',
                                          target_lang='THA', worker=fake_worker))
    elapsed = time.time() - started
    assert out == ['sfx-a', 'sfx-b', 'sfx-c', 'sfx-d']
    assert sorted(calls) == ['a', 'b', 'c', 'd']
    assert elapsed < 0.45  # 4 sequential sleeps would be >= 0.6 s


# ── #881: the rescue reaches the gateway and transcribes ─────────────────────
def test_rescue_calls_send_the_gateway_headers(monkeypatch):
    # OpenCode Go answers 400 MissingSessionID without x-opencode-session: every rescue failed
    # silently since the move to that gateway (0 rescued in three session logs, 925 boxes dropped).
    import manga_translator.ocr_vlm as v
    monkeypatch.setattr(v, '_gateway_headers', lambda: {'x-opencode-session': 's1'})
    for call in (v.vlm_localize_sfx, v.vlm_transcribe):
        post = _post_returning('BOOM')
        v.reset_sfx_breaker()
        call(_crop(), api_base='http://gw/v1', api_key='k', model='m', post_fn=post)
        assert post.calls['headers']['x-opencode-session'] == 's1'
        assert post.calls['headers']['Authorization'] == 'Bearer k'


def test_transcribe_returns_the_lettered_text_on_one_line():
    from manga_translator.ocr_vlm import vlm_transcribe
    post = _post_returning('Kurose\n-kun,\nyou...')
    assert vlm_transcribe(_crop(), api_base='http://gw/v1', api_key='k', model='m', post_fn=post) == 'Kurose -kun, you...'
    assert 'Transcribe' in post.calls['json']['messages'][0]['content'][0]['text']


def test_transcription_parse_drops_markers_and_refusals():
    from manga_translator.ocr_vlm import parse_transcription
    assert parse_transcription("I'm glad.") == "I'm glad."
    assert parse_transcription('SFX: ドキドキ') == 'ドキドキ'
    assert parse_transcription('NONE') == ''
    assert parse_transcription('  ') == ''
    assert parse_transcription(None) == ''


def test_a_det_sfx_box_read_as_short_ascii_is_still_worth_a_transcription():
    # the '-kun, you...' box read as '14' by the 48px OCR; a transcription cannot invent an SFX,
    # it reads the box or answers NONE, so ASCII junk from det_sfx no longer blocks it
    from manga_translator.ocr_vlm import should_rescue_sfx
    assert should_rescue_sfx('14', True, 300, 460, True)
    assert should_rescue_sfx('T', True, 300, 460, True)
    assert not should_rescue_sfx('HUH?', False, 300, 460, True)     # dialogue read, not det_sfx: unchanged
    assert not should_rescue_sfx('KUROSE', True, 300, 460, True)    # a real word read: OCR did its job


def test_a_container_takes_over_only_the_dialogue_its_transcription_repeats():
    from manga_translator.ocr_vlm import transcription_covers
    assert transcription_covers('Kurose -kun, you...', ['Kurose'])
    assert transcription_covers("KUROSE-KUN, YOU...", ['kurose'])
    assert not transcription_covers('NO WAY', ['Kurose'])
    assert not transcription_covers('Kurose -kun', [])


def test_resolve_rescue_keeps_new_text_and_drops_what_repeats_a_bubble():
    from manga_translator.ocr_vlm import resolve_rescue
    dialogue = [((100, 100, 300, 160), 'Kurose', 'r1'), ((600, 600, 800, 700), 'WHAT DO YOU MEAN?!', 'r2')]
    # nothing underneath: a hand-lettered line the OCR lost -> keep it
    assert resolve_rescue((0, 0, 90, 90), "I'm glad.", dialogue) == ('keep', [], 'transcribed')
    # a box over a bubble that transcribes that bubble's own text: the #278 phantom -> drop
    assert resolve_rescue((620, 610, 700, 650), 'WHAT DO YOU MEAN', dialogue) == (
        'drop', [], 'repeats an overlapping line')
    # a container swallowing a line it repeats AND extends: it replaces that line (#881 Kurose case)
    assert resolve_rescue((80, 80, 400, 500), 'Kurose -kun, you...', dialogue) == (
        'takeover', ['r1'], 'replaces the lines it swallows')
    # a big ink cluster that only repeats the bubble it swallows adds nothing -> drop (live ch. 6 p10:
    # the panel-sized 'T' box took over "JUST WHEN WE'D FINALLY GOTTEN CLOSER...")
    assert resolve_rescue((80, 80, 400, 500), 'KUROSE!', dialogue) == (
        'drop', [], 'swallows a dialogue line it does not repeat')
    # a container swallowing a line it does NOT repeat: leave the dialogue alone
    assert resolve_rescue((80, 80, 400, 500), 'BOOM', dialogue) == (
        'drop', [], 'swallows a dialogue line it does not repeat')
    # every drop says WHY it dropped - the log used to call all of them "repeats an overlapping line"
    assert resolve_rescue((0, 0, 90, 90), '', dialogue) == ('drop', [], 'nothing read')


def test_a_guessed_box_survives_a_failed_line_read_so_the_rescue_can_try():
    # #881: 'I'm glad.' (hand-lettered, 70 px glyphs) was boxed by det_sfx, read below the prob floor
    # by the 48px OCR and dropped before the rescue ever saw it. Guessed boxes are kept, as empty
    # text; a normal dialogue line below the floor still drops.
    from manga_translator.ocr_vlm import keep_ocr_line
    sfx = SimpleNamespace(text='', is_sfx=True)
    placeholder = SimpleNamespace(text='', rescue_placeholder=True)
    dialogue = SimpleNamespace(text='')
    assert keep_ocr_line(sfx, below_floor=True)
    assert keep_ocr_line(placeholder, below_floor=True)
    assert not keep_ocr_line(dialogue, below_floor=True)
    assert keep_ocr_line(SimpleNamespace(text='HELLO'), below_floor=False)
    assert not keep_ocr_line(SimpleNamespace(text='  '), below_floor=False)


def test_placeholders_count_as_guessed_boxes_for_the_rescue():
    from manga_translator.ocr_vlm import guessed_box
    assert guessed_box(SimpleNamespace(from_sfx_detection=True))
    assert guessed_box(SimpleNamespace(rescue_placeholder=True))
    assert not guessed_box(SimpleNamespace())


def test_a_placeholder_skips_the_sfx_ink_gate():
    # an empty-balloon / ink-cluster placeholder already proved its ink when it was made; the #887
    # contrast gate (tuned for SFX on art) rejected thin lettering in a big white balloon
    # (`Kurose -kun, you...`: dark 5 %, std 54)
    from manga_translator.ocr_vlm import vlm_transcribe
    faint = np.full((200, 200, 3), 250, dtype=np.uint8)
    faint[90:100, 40:160] = 30
    post = _post_returning('Kurose -kun, you...')
    assert vlm_transcribe(faint, api_base='http://gw/v1', api_key='k', model='m', post_fn=post) == ''
    assert vlm_transcribe(faint, api_base='http://gw/v1', api_key='k', model='m', post_fn=post,
                          check_lettering=False) == 'Kurose -kun, you...'


def test_a_read_of_only_dashes_or_rings_is_line_art_not_worth_a_call():
    # 3 chapters live: 60 rescue calls on 'ー' / 'ーー' / '○' reads, 0 transcriptions - balloon arcs and lines
    from manga_translator.ocr_vlm import should_rescue_sfx
    for read in ('ー', 'ーー', '○', '—', '~'):
        assert not should_rescue_sfx(read, True, 300, 300, True), read
    assert should_rescue_sfx('', True, 300, 300, True)
    assert should_rescue_sfx('ぬ', True, 300, 300, True)


def test_transcription_follows_the_translator_onto_the_anthropic_protocol(monkeypatch):
    # live: deepseek (thinking) spent all 512 tokens reasoning now and then -> finish=length, content '' ->
    # three in a row paused the rescue for 300 s and every box in that window dropped. The translator already
    # runs haiku on the Anthropic protocol, which does not think; the rescue now goes the same way.
    import manga_translator.ocr_vlm as v
    monkeypatch.setenv('CUSTOM_OPENAI_PROTOCOL', 'anthropic')
    monkeypatch.setenv('CUSTOM_OPENAI_ANTHROPIC_MODEL', 'claude-haiku-5-5')
    monkeypatch.setattr(v, '_gateway_headers', lambda: {'x-opencode-session': 's1'})
    calls = {}

    class R:
        def json(self):
            return {'content': [{'type': 'text', 'text': "I'm glad."}], 'stop_reason': 'end_turn'}

    def post(url, headers=None, json=None, timeout=None):
        calls.update(url=url, headers=headers, json=json)
        return R()
    v.reset_sfx_breaker()
    out = v.vlm_transcribe(_crop(), api_base='https://gw/zen/go/openai/v1', api_key='k', model='deepseek', post_fn=post)
    assert out == "I'm glad."
    assert calls['url'].endswith('/anthropic/v1/messages')
    assert calls['json']['model'] == 'claude-haiku-5-5'
    assert calls['json']['messages'][0]['content'][0]['type'] == 'image'
    assert calls['headers']['x-opencode-session'] == 's1' and calls['headers']['anthropic-version']


# ── #881 review: the failure modes that made the original rescue silent ──────

def test_the_rescue_sends_the_extra_headers_parsed_from_the_env(monkeypatch):
    """#881 root cause: the rescue never sent CUSTOM_OPENAI_EXTRA_HEADERS, so every call answered 400
    MissingSessionID (0 of 925 boxes rescued). Pin the REAL parse, not a monkeypatched header dict."""
    import manga_translator.ocr_vlm as v
    monkeypatch.setenv('CUSTOM_OPENAI_EXTRA_HEADERS', '{"x-opencode-session":"s1"}')
    post = _post_returning('BOOM')
    v.reset_sfx_breaker()
    v.vlm_transcribe(_crop(), api_base='http://gw/v1', api_key='k', model='m', post_fn=post)
    assert post.calls['headers']['x-opencode-session'] == 's1'
    assert post.calls['headers']['Authorization'] == 'Bearer k'


def test_a_non_200_transcription_is_a_failure_not_a_silent_empty(monkeypatch):
    """The status was never checked: a 400 body parsed to content='' and the rescue dropped the line while
    telling the breaker everything was fine - #881 recurring silently."""
    import manga_translator.ocr_vlm as v
    monkeypatch.setenv('CUSTOM_OPENAI_PROTOCOL', 'anthropic')
    monkeypatch.setenv('CUSTOM_OPENAI_ANTHROPIC_MODEL', 'claude-haiku-5-5')

    class R:
        status_code = 400
        text = '{"error":{"message":"MissingSessionID"}}'

        def json(self):
            return {'content': []}

    v.reset_sfx_breaker()
    for _ in range(3):
        assert v.vlm_transcribe(_crop(), api_base='https://gw/zen/go/openai/v1', api_key='k', model='m',
                                post_fn=lambda *a, **k: R()) == ''
    assert not v._breaker.allows()   # three unusable answers still stop the rescue, as before


def test_a_200_with_no_content_blocks_is_not_an_answer(monkeypatch):
    import manga_translator.ocr_vlm as v
    monkeypatch.setenv('CUSTOM_OPENAI_PROTOCOL', 'anthropic')
    monkeypatch.setenv('CUSTOM_OPENAI_ANTHROPIC_MODEL', 'claude-haiku-5-5')

    class R:
        status_code = 200
        text = ''

        def json(self):
            return {'content': [], 'stop_reason': 'end_turn'}

    v.reset_sfx_breaker()
    assert v.vlm_transcribe(_crop(), api_base='https://gw/zen/go/openai/v1', api_key='k', model='m',
                            post_fn=lambda *a, **k: R()) == ''
    assert v._breaker.streak == 1


def test_a_two_letter_sfx_clipping_a_bubble_is_not_dropped_as_a_phantom():
    """The phantom check was any overlap + symmetric substring, so a real 2-letter Latin SFX over a bubble edge
    ('HA' over 'WHAT?!') was dropped. The phantom sits INSIDE the line it repeats."""
    from manga_translator.ocr_vlm import resolve_rescue
    dialogue = [((100, 100, 300, 160), 'WHAT?!', 'r1')]
    assert resolve_rescue((60, 120, 110, 150), 'HA', dialogue)[0] == 'keep'      # 20 % over the line
    assert resolve_rescue((150, 110, 200, 150), 'WHAT', dialogue)[0] == 'drop'   # inside, repeats it

