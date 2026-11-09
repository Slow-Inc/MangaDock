"""Tests for tools/quality_dashboard summarise (pure aggregation)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / 'tools'))

from quality_dashboard import summarise


def _payload(regions, page='p', timing=None):
    return {'page': page, 'regions': regions, 'timing_ms': timing or {}}


def test_counts_gate_violations_and_leftovers():
    payload = _payload([
        {'src': 'MAY THE BLESSINGS OF THE GREAT', 'dst': 'ขอพรจากมหา'},
        {'src': 'DID ANYONE BRING THE RESOURCE MATERIALS?', 'dst': 'มีใครเอามATERIALS มาบ้างไหม?'},
        {'src': 'FINE LINE', 'dst': 'บรรทัดปกติ'},  # normalize-able but harmless
    ], timing={'wall': 100})
    r = summarise([payload])
    assert r['pages'] == 1 and r['regions'] == 3
    assert r['gate_violations'].get('content_loss') == 1
    assert r['gate_violations'].get('untranslated_word') == 1
    assert r['leftover'].get('content_loss') == 1
    assert r['timing_ms'] == {'wall': 100}


def test_skips_never_rendered_payloads_and_aggregates_audit():
    rendered = _payload([{'src': 'X LINE HERE', 'dst': 'บรรทัด'}])
    dropped = {'page': 'q', 'rendered': False, 'regions': [{'src': 'DROP', 'dst': ''}]}
    audit = {'p': {'scores': [
        {'score': 2, 'note': ''},
        {'score': 1, 'note': 'Meaning preserved but typos: ฉัน→ฉัน'},
        {'score': 1, 'note': 'Typos: บ่าน→บ้าน'},
    ]}}
    r = summarise([rendered, dropped], audit)
    assert r['pages'] == 2  # page count still reflects the files
    assert r['regions'] == 1  # dropped payload contributes no regions
    assert r['judge']['segments'] == 3
    assert r['judge']['noise_flags'] == 1
    assert r['judge']['adjusted_mean'] == 1.67

