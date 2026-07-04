"""Minimum-viable translation-quality eval harness (#526, Master Plan 2 Phase 0).

We measure render-parity but had NO measure of translation *accuracy* — so no translation-side
cluster (P2 context, P6 SFX, P7 contract/voice) could be shown to move quality. BLEU/COMET don't
fit manga (no aligned corpus); the 4-reviewer consensus was a rubric-based blind human-eval.

This module is the reproducible *scaffolding* around that human judgement — the human still grades,
but the parts that MUST be deterministic to be trustworthy are code:

  1. **eval set** — (source, MIT candidate, official reference) triples, tagged by bubble type + the
     config that produced the candidate (e.g. RollingContext on/off), loaded from JSON.
  2. **blind A/B** — each item's candidate & reference are shown as "A"/"B" with the candidate's side
     chosen by a *seeded, balanced* shuffle, so the grader can't learn the position and every run
     reproduces. The side is recorded so a choice can be unblinded afterwards.
  3. **rubric** — 0-2 on {faithfulness, cohesion/reading-order, style}, validated.
  4. **aggregation + scorecard** — per-axis / per-bubble-type means, overall, and the candidate
     win-rate from the blind A/B → a committed markdown scorecard that gates any "human-level" claim.

Stdlib only (no ML/ndarray) → the whole harness unit-tests in well under a second.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from random import Random
from statistics import mean
from typing import Dict, List, Optional

AXES = ('faithfulness', 'cohesion', 'style')
BUBBLE_TYPES = ('dialogue', 'narration', 'sfx')
_SCORE_MIN, _SCORE_MAX = 0, 2


@dataclass
class EvalItem:
    """One graded unit: the source glyphs, MIT's candidate, the official reference, its bubble
    class, and the config label that produced the candidate (so an A/B can compare configs)."""
    id: str
    source: str
    candidate: str
    reference: str
    bubble_type: str
    config_label: str = ''

    def __post_init__(self):
        if self.bubble_type not in BUBBLE_TYPES:
            raise ValueError(
                f'unknown bubble_type {self.bubble_type!r} (expected one of {BUBBLE_TYPES})')


def load_eval_set(path: str) -> List[EvalItem]:
    """Load an eval set from JSON ``{"items": [ {id, source, candidate, reference, bubble_type,
    config_label?}, ... ]}``. Validates the bubble type (raises ``ValueError`` on an unknown one)."""
    with open(path, encoding='utf-8') as f:
        data = json.load(f)
    return [
        EvalItem(
            id=d['id'], source=d['source'], candidate=d['candidate'], reference=d['reference'],
            bubble_type=d['bubble_type'], config_label=d.get('config_label', ''),
        )
        for d in data['items']
    ]


@dataclass
class RubricScore:
    """A grader's 0-2 score per axis for one item (plus the raw A/B preference, recorded separately)."""
    item_id: str
    faithfulness: int
    cohesion: int
    style: int

    def validate(self) -> 'RubricScore':
        for ax in AXES:
            v = getattr(self, ax)
            if not isinstance(v, int) or not (_SCORE_MIN <= v <= _SCORE_MAX):
                raise ValueError(f'{ax}={v!r} out of range [{_SCORE_MIN},{_SCORE_MAX}]')
        return self

    def axis_values(self) -> List[int]:
        return [getattr(self, ax) for ax in AXES]


class BlindPair:
    """One item's candidate & reference presented as ``left`` ("A") and ``right`` ("B"). The public
    surface deliberately does NOT name which is the candidate — only ``_candidate_side`` records it,
    for unblinding after grading. A grader sees ``left``/``right`` and picks "A"/"B"/"tie"."""

    __slots__ = ('item_id', 'left', 'right', '_candidate_side')

    def __init__(self, item_id: str, left: str, right: str, candidate_side: str):
        self.item_id = item_id
        self.left = left
        self.right = right
        self._candidate_side = candidate_side  # 'left' | 'right'


def make_blind_pairs(items: List[EvalItem], seed: int) -> List[BlindPair]:
    """Blind each item's candidate vs reference into ``left``/``right`` with a *seeded, balanced*
    shuffle: exactly ⌈n/2⌉ candidates land on the left and the rest on the right (so the grader can't
    exploit a position bias and every run with the same seed reproduces). Deterministic in ``seed``."""
    n = len(items)
    sides = ['left'] * ((n + 1) // 2) + ['right'] * (n // 2)
    Random(seed).shuffle(sides)
    pairs = []
    for it, side in zip(items, sides):
        if side == 'left':
            pairs.append(BlindPair(it.id, it.candidate, it.reference, 'left'))
        else:
            pairs.append(BlindPair(it.id, it.reference, it.candidate, 'right'))
    return pairs


def unblind_preference(pair: BlindPair, choice: str) -> str:
    """Map a grader's blind choice (``'A'`` = left, ``'B'`` = right, ``'tie'``) back to what they
    actually preferred: ``'candidate'`` (MIT), ``'reference'`` (official), or ``'tie'``."""
    if choice == 'tie':
        return 'tie'
    chosen_side = 'left' if choice == 'A' else 'right'
    return 'candidate' if chosen_side == pair._candidate_side else 'reference'


def aggregate(items: List[EvalItem], scores: List[RubricScore],
              blind_pairs: Optional[List[BlindPair]] = None,
              preferences: Optional[Dict[str, str]] = None) -> dict:
    """Aggregate rubric scores into per-axis means, an overall mean, per-bubble-type means, and (when
    blind pairs + the grader's per-item A/B ``preferences`` are supplied) the candidate win-rate."""
    for s in scores:
        s.validate()
    by_type = {it.id: it.bubble_type for it in items}

    axis_mean = {ax: mean(getattr(s, ax) for s in scores) for ax in AXES} if scores else {
        ax: 0.0 for ax in AXES}
    overall_mean = mean(v for s in scores for v in s.axis_values()) if scores else 0.0

    per_type: Dict[str, dict] = {}
    for bt in BUBBLE_TYPES:
        bt_scores = [s for s in scores if by_type.get(s.item_id) == bt]
        if bt_scores:
            per_type[bt] = {
                'n': len(bt_scores),
                'overall': mean(v for s in bt_scores for v in s.axis_values()),
                'axis_mean': {ax: mean(getattr(s, ax) for s in bt_scores) for ax in AXES},
            }

    out = {
        'n': len(scores),
        'axis_mean': axis_mean,
        'overall_mean': overall_mean,
        'by_type': per_type,
    }

    if blind_pairs and preferences:
        pair_by_id = {p.item_id: p for p in blind_pairs}
        cand = ref = ties = 0
        for item_id, choice in preferences.items():
            p = pair_by_id.get(item_id)
            if p is None:
                continue
            verdict = unblind_preference(p, choice)
            if verdict == 'candidate':
                cand += 1
            elif verdict == 'reference':
                ref += 1
            else:
                ties += 1
        decided = cand + ref
        out['ab'] = {
            'candidate_wins': cand,
            'reference_wins': ref,
            'ties': ties,
            'candidate_winrate': (cand / decided) if decided else 0.0,
        }
    return out


def render_scorecard(agg: dict, meta: dict) -> str:
    """Render the aggregate into a committed markdown scorecard (the gate for a 'human-level' claim)."""
    title = meta.get('title', 'translation eval')
    date = meta.get('date', '')
    lines = [
        f'# Translation-quality scorecard — {title}',
        '',
        f'*Date:* {date} · *graded items:* {agg["n"]} · '
        f'*overall mean (0-2):* **{agg["overall_mean"]:.2f}**',
        '',
        '## Per-axis mean (0-2)',
        '| axis | mean |',
        '|---|---|',
    ]
    for ax in AXES:
        lines.append(f'| {ax} | {agg["axis_mean"][ax]:.2f} |')

    lines += ['', '## Per-bubble-type mean (0-2)', '| type | n | overall | ' +
              ' | '.join(AXES) + ' |', '|---|---|---|' + '---|' * len(AXES)]
    for bt in BUBBLE_TYPES:
        t = agg['by_type'].get(bt)
        if t:
            axes = ' | '.join(f'{t["axis_mean"][ax]:.2f}' for ax in AXES)
            lines.append(f'| {bt} | {t["n"]} | {t["overall"]:.2f} | {axes} |')
        else:
            lines.append(f'| {bt} | 0 | — | ' + ' | '.join('—' for _ in AXES) + ' |')

    ab = agg.get('ab')
    if ab:
        lines += [
            '', '## Blind A/B vs official reference',
            f'- candidate (MIT) wins: **{ab["candidate_wins"]}** · reference wins: '
            f'**{ab["reference_wins"]}** · ties: {ab["ties"]}',
            f'- candidate win-rate (of decided): **{ab["candidate_winrate"]:.2f}**',
        ]
    return '\n'.join(lines) + '\n'
