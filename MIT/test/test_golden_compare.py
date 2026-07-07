"""Unit test for the pure characterization-golden verdict (test/_golden_compare.py).

Deterministic, no font / no freetype — locks the decision table that keeps a freetype-metric
golden (the bubble_fit balloon search) from false-failing across platforms while still catching a
real logic regression on the platform the golden was recorded on."""
from _golden_compare import golden_verdict


def test_arrays_equal_always_passes_even_on_a_different_env():
    # A portable golden (box-derived geometry, e.g. legacy / clean_layout) matches everywhere —
    # a matching run asserts on any platform, so CI keeps real coverage of those paths.
    assert golden_verdict(arrays_equal=True, same_env=True) == 'pass'
    assert golden_verdict(arrays_equal=True, same_env=False) == 'pass'


def test_mismatch_on_same_env_is_a_real_regression():
    # Same freetype + platform the golden was recorded on: a drift is a genuine logic change.
    assert golden_verdict(arrays_equal=False, same_env=True) == 'fail'


def test_mismatch_on_a_different_env_is_environment_drift_not_a_regression():
    # Different freetype build / OS: glyph advances shift sub-pixels and move the fitted geometry.
    # That is not a code change — skip rather than false-fail (the #541 CI red on Linux vs Windows).
    assert golden_verdict(arrays_equal=False, same_env=False) == 'skip'
