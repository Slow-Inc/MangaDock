"""Dashboard aggregation on real (trimmed) doctor payload fixtures."""
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT / 'tools'))

from quality_dashboard import load_payloads, summarise

FIXTURES = ROOT / 'test' / 'fixtures' / 'dashboard'


def test_the_dashboard_aggregates_real_payload_shapes():
    payloads = load_payloads(str(FIXTURES))
    assert len(payloads) == 2
    report = summarise(payloads)
    assert report['pages'] == 2
    assert report['regions'] == 19  # 8 + 11 rendered regions in the fixtures
    assert report['gate_violations'].get('dropped_!') == 1  # the Iruma nuance
    assert report['leftover'] == {}  # the loop guards left nothing
    assert report['timing_ms']['wall'] > 0

