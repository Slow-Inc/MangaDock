"""MVE translation-quality eval harness (#526, Master Plan 2 Phase 0).

Stdlib-only, no ML — the harness assembles the eval set, blinds the A/B, and
aggregates the human rubric scores into a scorecard. The human still grades; this
locks the parts that must be reproducible (blinding by seed, aggregation, report).
"""
import json

import pytest

from eval.translation_eval import (
    AXES,
    BUBBLE_TYPES,
    EvalItem,
    RubricScore,
    aggregate,
    load_eval_set,
    make_blind_pairs,
    render_scorecard,
    unblind_preference,
)


def _items():
    return [
        EvalItem('b1', 'ソース1', 'cand dialogue', 'ref dialogue', 'dialogue', 'context_on'),
        EvalItem('b2', 'ソース2', 'cand narration', 'ref narration', 'narration', 'context_on'),
        EvalItem('b3', 'ゴゴゴ', 'RUMBLE', 'RUMBLE-ref', 'sfx', 'context_on'),
    ]


def test_load_eval_set_reads_triples(tmp_path):
    p = tmp_path / 'set.json'
    p.write_text(json.dumps({'items': [
        {'id': 'b1', 'source': 'x', 'candidate': 'c', 'reference': 'r',
         'bubble_type': 'dialogue', 'config_label': 'context_off'},
    ]}), encoding='utf-8')
    items = load_eval_set(str(p))
    assert len(items) == 1
    assert items[0].id == 'b1' and items[0].candidate == 'c' and items[0].reference == 'r'
    assert items[0].bubble_type == 'dialogue' and items[0].config_label == 'context_off'


def test_load_eval_set_rejects_unknown_bubble_type(tmp_path):
    p = tmp_path / 'bad.json'
    p.write_text(json.dumps({'items': [
        {'id': 'b1', 'source': 'x', 'candidate': 'c', 'reference': 'r', 'bubble_type': 'banner'},
    ]}), encoding='utf-8')
    with pytest.raises(ValueError):
        load_eval_set(str(p))


def test_rubric_score_validates_range():
    RubricScore('b1', 2, 1, 0).validate()  # ok
    with pytest.raises(ValueError):
        RubricScore('b1', 3, 1, 0).validate()
    with pytest.raises(ValueError):
        RubricScore('b1', 2, -1, 0).validate()


def test_make_blind_pairs_is_deterministic_by_seed():
    items = _items()
    a = make_blind_pairs(items, seed=42)
    b = make_blind_pairs(items, seed=42)
    assert [(p.item_id, p.left, p.right) for p in a] == [(p.item_id, p.left, p.right) for p in b]
    # a pair never leaks which side is the candidate in its public fields
    assert not hasattr(a[0], 'candidate') and not hasattr(a[0], 'reference')


def test_blind_pairs_place_candidate_on_both_sides_across_the_set():
    # blinding must actually shuffle — the candidate is not always 'left' (else the grader
    # learns the position). Over a set + seed, candidate lands on both sides.
    items = _items() * 4  # 12 items → both sides represented
    pairs = make_blind_pairs(items, seed=7)
    sides = {p._candidate_side for p in pairs}
    assert sides == {'left', 'right'}
    # and each pair's two texts are exactly the item's candidate + reference (no mangling)
    by_id = {it.id: it for it in items}
    for p in pairs:
        it = by_id[p.item_id]
        assert {p.left, p.right} == {it.candidate, it.reference}


def test_unblind_preference_maps_grader_choice_back_to_source():
    items = _items()[:1]
    pair = make_blind_pairs(items, seed=1)[0]
    left_is_cand = pair._candidate_side == 'left'
    # grader picks the LEFT text ('A')
    assert unblind_preference(pair, 'A') == ('candidate' if left_is_cand else 'reference')
    assert unblind_preference(pair, 'B') == ('reference' if left_is_cand else 'candidate')
    assert unblind_preference(pair, 'tie') == 'tie'


def test_aggregate_per_axis_and_per_type_means():
    items = _items()
    scores = [
        RubricScore('b1', 2, 2, 2),  # dialogue perfect
        RubricScore('b2', 1, 1, 1),  # narration middling
        RubricScore('b3', 0, 0, 0),  # sfx failing
    ]
    agg = aggregate(items, scores)
    assert agg['n'] == 3
    for ax in AXES:
        assert agg['axis_mean'][ax] == pytest.approx(1.0)  # (2+1+0)/3
    assert agg['overall_mean'] == pytest.approx(1.0)
    assert agg['by_type']['dialogue']['overall'] == pytest.approx(2.0)
    assert agg['by_type']['sfx']['overall'] == pytest.approx(0.0)


def test_aggregate_reports_candidate_winrate_from_blind_prefs():
    items = _items()
    pairs = make_blind_pairs(items, seed=3)
    # grader preferences per public A/B; unblind → candidate/reference/tie
    prefs = {}
    for p in pairs:
        # simulate: grader always prefers whichever side is the candidate for b1/b2, ties b3
        if p.item_id == 'b3':
            prefs[p.item_id] = 'tie'
        else:
            prefs[p.item_id] = 'A' if p._candidate_side == 'left' else 'B'
    scores = [RubricScore('b1', 2, 2, 2), RubricScore('b2', 2, 2, 2), RubricScore('b3', 1, 1, 1)]
    agg = aggregate(items, scores, blind_pairs=pairs, preferences=prefs)
    # 2 candidate wins, 0 reference wins, 1 tie → win-rate over decided = 2/2 = 1.0
    assert agg['ab']['candidate_wins'] == 2
    assert agg['ab']['reference_wins'] == 0
    assert agg['ab']['ties'] == 1
    assert agg['ab']['candidate_winrate'] == pytest.approx(1.0)


def test_render_scorecard_embeds_the_numbers():
    items = _items()
    scores = [RubricScore('b1', 2, 2, 2), RubricScore('b2', 1, 1, 1), RubricScore('b3', 0, 0, 0)]
    agg = aggregate(items, scores)
    md = render_scorecard(agg, meta={'title': 'ctx ON', 'date': '2026-07-04'})
    assert 'ctx ON' in md
    assert '1.00' in md  # overall mean
    for ax in AXES:
        assert ax in md
    for bt in BUBBLE_TYPES:
        assert bt in md
