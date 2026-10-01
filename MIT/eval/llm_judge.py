"""LLM-judge for the MVE translation-quality eval (#526, Master Plan 2 P7-accuracy).

The MVE (`translation_eval.py`) needs a grader. A human grader is the gold standard, but an
LLM-judge can produce a FIRST real scorecard autonomously — lower-confidence than a human, but a
genuine 0-2 rubric score per bubble instead of "unmeasurable". Reuses the project's existing
OpenAI-compatible endpoint (`CUSTOM_OPENAI_*`); torch-free (only `openai` + stdlib) so it runs
without the ML stack. Deterministic-ish (temperature=0) but the backend may still vary slightly.
"""
from __future__ import annotations

import json
import os
import re
from typing import List

from eval.translation_eval import AXES, EvalItem, RubricScore

_JUDGE_SYSTEM = (
    'You are a strict bilingual manga-translation quality grader. Grade ONE translated line '
    'against its source. Score each axis 0-2 (2=best):\n'
    '- faithfulness: 2 accurate meaning · 1 minor nuance lost · 0 hallucination/garble/untranslated\n'
    '- cohesion: 2 natural, correct pronouns/reading-order · 1 minor slips · 0 broken syntax\n'
    '- style: 2 natural voice fits a manga bubble · 1 stilted/awkward · 0 unreadable\n'
    'Reply with ONLY compact JSON: {"faithfulness":N,"cohesion":N,"style":N}'
)


def _parse(txt: str, item_id: str) -> RubricScore:
    m = re.search(r'\{[^{}]*\}', txt or '')
    if not m:
        raise ValueError(f'no JSON in judge reply for {item_id}: {txt!r}')
    d = json.loads(m.group(0))
    return RubricScore(item_id, int(d['faithfulness']), int(d['cohesion']), int(d['style'])).validate()


async def judge_items(items: List[EvalItem], model: str | None = None) -> List[RubricScore]:
    """Grade each (source, candidate) with the LLM-judge; returns a RubricScore per item."""
    import openai
    client = openai.AsyncOpenAI(api_key=os.getenv('CUSTOM_OPENAI_API_KEY') or 'x')
    client.base_url = os.getenv('CUSTOM_OPENAI_API_BASE', 'http://localhost:11434/v1')
    mdl = model or os.getenv('CUSTOM_OPENAI_MODEL', 'gpt-4o-mini')
    out: List[RubricScore] = []
    for it in items:
        r = await client.chat.completions.create(
            model=mdl, temperature=0,
            messages=[{'role': 'system', 'content': _JUDGE_SYSTEM},
                      {'role': 'user', 'content': f'Source: {it.source}\nTranslation: {it.candidate}'}])
        out.append(_parse(r.choices[0].message.content, it.id))
    return out
