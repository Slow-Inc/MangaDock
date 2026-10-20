"""Objective translation-glitch counter (quality loop, 2026-10-20).

The blind prompt A/B showed that wins and losses were decided mostly by random LLM glitches —
a foreign script leaking in ('甚至连', 'Чит', Korean), an English segment left untranslated, an
empty segment — not by prompt style. These are countable without a judge. Torch-free.
"""
from tools.translation_ab import glitches


def test_counts_each_glitch_kind_per_segment():
    sources = ['HELLO THERE', 'SPECIAL THANKS TO EVERYONE', 'NIGHT VISION', 'IC', 'BYE']
    outputs = ['สวัสดี 甚至连', 'SPECIAL THANKS TO EVERYONE', '', '(IC)', 'ลาก่อน']
    g = glitches(sources, outputs, 'THA')
    assert g == {'segments': 5, 'foreign_script': 1, 'untranslated': 1, 'empty': 1}


def test_short_acronyms_and_clean_thai_are_not_glitches():
    g = glitches(['OK!', 'HP'], ['โอเค!', 'HP'], 'THA')
    assert g['untranslated'] == 0 and g['foreign_script'] == 0
