"""Tests for the opt-in omission verification pass (manga_translator.omission_guard)."""
import asyncio
from types import SimpleNamespace

import manga_translator.omission_guard as og


def test_enabled_flag():
    assert og.enabled({'MIT_OMISSION_VERIFY': '1'}) is True
    assert og.enabled({'MIT_OMISSION_VERIFY': 'on'}) is True
    assert og.enabled({'MIT_OMISSION_VERIFY': '0'}) is False
    assert og.enabled({}) is False


def test_collect_candidates_keeps_only_long_lines_with_thai():
    regions = [
        SimpleNamespace(text='THIS IS A LONG LINE WITH A CLAUSE THAT MIGHT BE DROPPED', translation='บรรทัดยาวที่มีข้อความ'),
        SimpleNamespace(text='SHORT', translation='สั้น'),
        SimpleNamespace(text='ANOTHER LONG LINE WITH ENOUGH ENGLISH WORDS HERE', translation=''),
        SimpleNamespace(text='', translation='มีคำแปล'),
    ]
    cands = og.collect_candidates(regions)
    assert [c['idx'] for c in cands] == [0]
    assert cands[0]['src'].startswith('THIS IS A LONG LINE')


def test_build_query_names_the_missing_part():
    q = og.build_query('ALSO THIS PIQUED MY CURIOSITY', 'this piqued my curiosity')
    assert q.startswith('ALSO THIS PIQUED MY CURIOSITY')
    assert 'missing: this piqued my curiosity' in q


def test_parse_and_distribute_verdicts():
    cands = [{'idx': 3, 'src': 'a', 'dst': 'x'}, {'idx': 5, 'src': 'b', 'dst': 'y'}]
    verdicts = og.parse_verdicts('[{"i":0,"omitted":true,"missing":"clause"},{"i":1,"omitted":false}]')
    assert verdicts is not None
    assert og.distribute(verdicts, cands) == {3: 'clause'}
    assert og.parse_verdicts('no json') is None
    assert og.distribute(None, cands) == {}


def test_better_translation_requires_more_content():
    assert og.better_translation('แล้ว... ในโรงอาหาร', 'แล้ว... เมื่อกลางวันในโรงอาหารที่เดิม') is True
    assert og.better_translation('ข้อความ', 'ข้อความ') is False
    assert og.better_translation('ข้อความ', '') is False


def test_apply_results_updates_only_accepted_regions():
    regions = [SimpleNamespace(translation='แล้ว... ในโรงอาหาร'), SimpleNamespace(translation='ปกติ')]
    applied = og.apply_results(regions, {0: 'curiosity', 1: 'x'}, ['แล้ว... เมื่อกลางวันในโรงอาหารที่เดิม', 'สั้น'])
    assert applied == 1
    assert regions[0].translation.startswith('แล้ว... เมื่อกลางวัน')
    assert regions[1].translation == 'ปกติ'


def test_verify_candidates_needs_every_pass_to_agree(monkeypatch):
    cands = [{'idx': 0, 'src': 'SRC', 'dst': 'TH'}]
    import threading
    lock = threading.Lock()
    replies = [
        '[{"i":0,"omitted":true,"missing":"x"}]',
        '[{"i":0,"omitted":false}]',
    ]
    state = {'n': 0}

    def fake_call(base, key, model, user, timeout=120):
        with lock:
            idx = state['n']
            state['n'] += 1
        return og.parse_verdicts(replies[idx % len(replies)])

    monkeypatch.setattr(og, '_call', fake_call)
    assert asyncio.run(og.verify_candidates(cands, 'http://x', 'k', 'm', passes=2)) == {}


def test_passes_option_parses_and_clamps():
    assert og.passes({}) == 2
    assert og.passes({'MIT_OMISSION_VERIFY_PASSES': '1'}) == 1
    assert og.passes({'MIT_OMISSION_VERIFY_PASSES': '9'}) == 3
    assert og.passes({'MIT_OMISSION_VERIFY_PASSES': 'x'}) == 2
