"""Tests for the pure stability-report helper (quality-loop measurement tool)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / 'tools'))

from stability_report import compare_runs


def test_buckets_use_the_worst_pairwise_ratio():
    runs = [
        {"A": "สวัสดีครับ", "B": "ฉันจะไปตลาด", "C": "ฉันจะไปตลาด"},
        {"A": "สวัสดีครับ", "B": "ฉันจะไปตลาดวันนี้", "C": "ฉันจะไปตลาดวันนี้มากๆ"},
        {"A": "สวัสดีครับ", "B": "บ้านหลังใหญ่", "C": "ฉันจะไปตลาด"},
    ]
    report = compare_runs(runs)
    assert report["segments"] == 3
    assert report["stable"] == 1  # A identical in all three
    assert report["unstable"] == 1  # B: "ฉันจะไปตลาด" vs "บ้านหลังใหญ่" is well below 0.5
    assert report["moderate"] == 1  # C: ~0.79 worst pair (between 0.5 and 0.85)
    assert {row["src"] for row in report["unstable_examples"]} == {"B"}


def test_segments_missing_from_a_run_are_not_scored():
    runs = [{"A": "x"}, {"A": "x", "ONLY_ONCE": "y"}, {"A": "x"}]
    report = compare_runs(runs)
    assert report["segments"] == 1
    assert report["stable"] == 1


def test_thresholds_are_parameters():
    runs = [{"A": "สวัสดี"}, {"A": "สวัดดี"}]
    assert compare_runs(runs, stable=0.99)["stable"] == 0
    assert compare_runs(runs, stable=0.1)["stable"] == 1


def test_empty_runs_are_safe():
    assert compare_runs([])["segments"] == 0
