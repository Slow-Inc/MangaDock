"""Blind A/B packets for translation-prompt experiments (quality loop, 2026-10-20).

Judges must not know which arm is which, and the un-blinding must be exact, so the shuffle is
seeded per page and the key travels with the packet. Torch-free.
"""
from tools.translation_ab import blind_pairs, page_texts, tally


def test_page_texts_keeps_reading_order_and_skips_empty():
    doc = {'regions': [{'src': 'HELLO'}, {'src': ''}, {'src': 'WORLD'}]}
    assert page_texts(doc) == ['HELLO', 'WORLD']


def test_blind_pairs_hide_the_arm_and_are_reproducible():
    a = {'p1': ['ก', 'ข'], 'p2': ['ค']}
    b = {'p1': ['ง', 'จ'], 'p2': ['ฉ']}
    packet1, key1 = blind_pairs(a, b, seed=7)
    packet2, key2 = blind_pairs(a, b, seed=7)
    assert packet1 == packet2 and key1 == key2
    for page in packet1:
        x, y = page['X'], page['Y']
        assert {tuple(x), tuple(y)} == {tuple(a[page['page']]), tuple(b[page['page']])}
        assert key1[page['page']] in ('A', 'B')  # which arm is X


def test_tally_unblinds_votes_into_arm_wins():
    key = {'p1': 'A', 'p2': 'B', 'p3': 'A'}
    votes = {'p1': 'X', 'p2': 'X', 'p3': 'TIE'}
    assert tally(votes, key) == {'A': 1, 'B': 1, 'TIE': 1}
