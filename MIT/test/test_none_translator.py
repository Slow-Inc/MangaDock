"""None-translator front-matter guards (#187 seam S9).

Two landmine-bearing pieces of `_run_text_translation`'s front-matter, extracted so they
are named, tested, and documented:

- **L12** `apply_prep_manual_override` — when `prep_manual` is set, the translator is
  forced to `none` by mutating `config.translator.translator` **in place** (poisons a
  reused Config; preserved verbatim, not fixed).
- **L3** `stamp_none_translations` — the none path blanks every region's translation and
  stamps metadata; the caller then returns **all** regions unfiltered (the asymmetry vs
  the filtered normal path).

The call site keeps the exact order: override → tracker.touch → (if none) stamp + return.
"""
from types import SimpleNamespace

from manga_translator.config import Translator
from manga_translator.none_translator import (
    apply_prep_manual_override,
    stamp_none_translations,
)


def _cfg(translator=Translator.gemini, target_lang='THASIM', alignment='auto', direction='auto'):
    return SimpleNamespace(
        translator=SimpleNamespace(translator=translator, target_lang=target_lang),
        render=SimpleNamespace(alignment=alignment, direction=direction),
    )


def _region(text='src', translation=None):
    return SimpleNamespace(text=text, translation=translation)


def test_prep_manual_true_forces_translator_to_none_L12():
    cfg = _cfg(translator=Translator.gemini)
    apply_prep_manual_override(cfg, prep_manual=True)
    assert cfg.translator.translator == Translator.none


def test_prep_manual_false_leaves_translator_unchanged():
    cfg = _cfg(translator=Translator.gemini)
    apply_prep_manual_override(cfg, prep_manual=False)
    assert cfg.translator.translator == Translator.gemini


def test_stamp_none_blanks_translation_and_stamps_metadata():
    cfg = _cfg(target_lang='ENG', alignment='center', direction='h')
    r1 = _region(text='hello', translation='leftover')
    r2 = _region(text='world')
    stamp_none_translations([r1, r2], cfg)
    for r in (r1, r2):
        assert r.translation == ''          # blanked (creates blank area)
        assert r.target_lang == 'ENG'
        assert r._alignment == 'center'
        assert r._direction == 'h'


def test_stamp_none_on_empty_list_is_a_noop():
    # no regions -> nothing happens, no error
    stamp_none_translations([], _cfg())
