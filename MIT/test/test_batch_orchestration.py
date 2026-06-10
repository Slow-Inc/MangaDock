"""Batch-mode pure helpers (#187 seam S26a).

Two `self`-free helpers lifted out of `translate_batch`:
`placeholder_context` (the empty Context appended when an image fails
pre-processing, duplicated across the MemoryError-retry-failure and the generic
error branches) and `build_page_translation_record` (the per-page
`{src: translation}` + `{idx: src}` dicts appended to TranslationMemory after the
batch completes — the #136/#140 cross-page context, L7). These golden cases pin
both exactly; no ML stack is imported.
"""
from types import SimpleNamespace

import manga_translator.batch_orchestration as bo


# ---- placeholder_context: empty text_regions + original input -----------------

def test_placeholder_context_has_input_and_empty_text_regions():
    ctx = bo.placeholder_context('IMG')
    assert ctx.input == 'IMG'
    assert ctx.text_regions == []          # initialized empty (downstream skips it)


# ---- build_page_translation_record: keyed by text_raw, falling back to text ---

def test_build_page_translation_record_prefers_text_raw_else_text():
    r1 = SimpleNamespace(text_raw='原1', text='t1', translation='แปล1')
    r2 = SimpleNamespace(text='t2', translation='แปล2')      # no text_raw → keyed by text

    page_translations, page_original_texts = bo.build_page_translation_record([r1, r2])

    assert page_translations == {'原1': 'แปล1', 't2': 'แปล2'}   # raw-text → translation
    assert page_original_texts == {0: '原1', 1: 't2'}           # index → raw-text


def test_build_page_translation_record_empty_regions_yields_empty_dicts():
    assert bo.build_page_translation_record([]) == ({}, {})
