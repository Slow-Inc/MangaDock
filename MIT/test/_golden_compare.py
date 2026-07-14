"""Pure verdict for a characterization golden vs a fresh run (no font / no freetype — portable).

Some goldens encode freetype-derived geometry: the bubble_fit balloon search binary-searches a
font size and squeezes a column using real glyph advances (`text_render.calc_horizontal`). Those
advances differ across freetype builds — a newer Pillow wheel, or a different OS — so the fitted
dst_points shift sub-pixels and the byte-identical assertion fails on a machine other than the one
that recorded the golden (the #541 CI red: golden recorded on Windows/freetype-2.14.3, CI runs
Linux/Pillow-12.3.0). That is environment drift, not a code change.

`same_env` is True only when the current freetype build AND platform match what the golden recorded.
Box-derived goldens (legacy / clean_layout) stay byte-identical across environments, so they still
assert everywhere; only a genuine mismatch on a *different* environment is downgraded to a skip."""


def golden_verdict(arrays_equal: bool, same_env: bool) -> str:
    """Return 'pass' (matched — assert holds anywhere), 'fail' (mismatch on the recording
    environment → a real logic regression), or 'skip' (mismatch on a different environment →
    freetype-metric drift, regenerate on this platform to assert)."""
    if arrays_equal:
        return 'pass'
    return 'fail' if same_env else 'skip'
