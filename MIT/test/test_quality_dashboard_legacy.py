"""Positive control: the dashboard must detect a leftover defect (not only clean pages)."""
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT / 'tools'))

from quality_dashboard import load_payloads, summarise

FIXTURES = ROOT / 'test' / 'fixtures' / 'dashboard_legacy'


def test_a_legacy_content_loss_is_reported_by_the_dashboard():
    payloads = load_payloads(str(FIXTURES))
    assert len(payloads) == 1
    report = summarise(payloads)
    assert report['gate_violations'].get('content_loss') == 1, report
    assert report['leftover'].get('content_loss') == 1, report
    assert report['regions'] == 1

