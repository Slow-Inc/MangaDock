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
    # Both fixture payloads were the pre-licence false positives (the Iruma `!` nuance); after the precision
    # licences (round 274) they aggregate clean, which is the expected end state.
    assert report['gate_violations'] == {}
    assert report['leftover'] == {}  # the loop guards left nothing
    assert report['timing_ms']['wall'] > 0

