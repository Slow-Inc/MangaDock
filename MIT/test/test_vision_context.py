"""Scene-context analyst for the translator (#1143 Track B5), torch-free helpers.

The analyst output is prompt text: these tests pin that a valid answer becomes useful notes, a broken answer
becomes no notes (a page must never be lost because the analyst failed), and that the flag is opt-in.
"""
from manga_translator.vision_context import (analyst_lines, apply_corrections, current_vision_context,
                                             format_context, parse_analyst, vision_context_enabled,
                                             vision_context_mode, vision_context_scope)


class _Region:
    def __init__(self, text):
        self.text = text

GOOD = '''Here you go:
{"lines":[{"n":1,"corrected":"I'm glad.","speaker":"boy in suit","gender":"m","role":"dialogue","emotion":"relieved"},
{"n":2,"corrected":"Hated that idea that much~?","speaker":"girl with glasses","gender":"f","role":"dialogue","emotion":"teasing"},
{"n":3,"corrected":"バッ","speaker":"sound effect","gender":"unknown","role":"sfx","emotion":"sudden"}],
"missing":["HUH ... ?"]}'''


def test_the_flag_is_opt_in(monkeypatch):
    monkeypatch.delenv('MIT_VISION_CONTEXT', raising=False)
    assert vision_context_enabled() is False and vision_context_mode() == 'off'
    for on in ('1', 'true', 'on', 'YES'):
        monkeypatch.setenv('MIT_VISION_CONTEXT', on)
        assert vision_context_enabled() is True and vision_context_mode() == 'notes', on
    for mode in ('notes', 'correct', 'both'):
        monkeypatch.setenv('MIT_VISION_CONTEXT', mode)
        assert vision_context_mode() == mode
    monkeypatch.setenv('MIT_VISION_CONTEXT', '0')
    assert vision_context_mode() == 'off'


def test_safe_corrections_replace_the_source_line():
    regions = [_Region('I WA WORRIED THE WHOLE TIME'), _Region('hatedm that idea')]
    hints = {1: {'corrected': 'I WAS WORRIED THE WHOLE TIME'},
             2: {'corrected': 'Hated that idea'}}
    assert apply_corrections(regions, hints) == 2
    assert regions[0].text == 'I WAS WORRIED THE WHOLE TIME'
    assert regions[1].text == 'Hated that idea'


def test_unsafe_corrections_are_refused():
    # a truncated answer, a wildly longer one, a non-ASCII one and an identical one are all left alone
    regions = [_Region('HELLO THERE'), _Region('HI'), _Region('HI'), _Region('SAME')]
    hints = {1: {'corrected': 'HEL'}, 2: {'corrected': 'A LINE THAT IS FAR TOO LONG TO TRUST'},
             3: {'corrected': 'เกลียด'}, 4: {'corrected': 'SAME'}}
    assert apply_corrections(regions, hints) == 0
    assert [r.text for r in regions] == ['HELLO THERE', 'HI', 'HI', 'SAME']


def test_the_numbered_lines_block_is_what_the_analyst_sees():
    assert analyst_lines(['I am glad.', 'Huh-']) == '1. I am glad.\n2. Huh-'


def test_a_json_answer_becomes_parsed_hints():
    hints = parse_analyst(GOOD)
    assert hints[1]['speaker'] == 'boy in suit' and hints[1]['role'] == 'dialogue'
    assert hints[2]['gender'] == 'f' and hints[3]['role'] == 'sfx'


def test_a_broken_answer_yields_no_hints():
    assert parse_analyst('the model refused') == {}
    assert parse_analyst('{"lines": [') == {}
    assert format_context(parse_analyst('nope')) == ''


def test_the_notes_name_speaker_role_and_the_corrected_reading():
    block = format_context(parse_analyst(GOOD))
    assert block.startswith('SCENE NOTES')
    assert 'line 1: boy in suit, m, dialogue, relieved | reads: I' in block
    assert 'line 3: sound effect, sfx' in block


def test_the_notes_are_scoped_and_empty_outside_the_scope():
    assert current_vision_context() == ''
    with vision_context_scope('SCENE NOTES\n- line 1'):
        assert current_vision_context().startswith('SCENE NOTES')
    assert current_vision_context() == ''
