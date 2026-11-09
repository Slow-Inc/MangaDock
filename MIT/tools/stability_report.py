"""Pure helpers for the translation-stability audit (no ML imports, unit-testable)."""
from difflib import SequenceMatcher


def compare_runs(runs, stable=0.85, moderate=0.5):
    """Bucket each common source segment by its worst run-to-run similarity.

    `runs` is a list of {src: dst} dicts (one per translation run). Only segments present in EVERY run are
    scored, because a segment missing from one run has no comparable answer.
    """
    runs = [dict(r or {}) for r in runs or []]
    if not runs:
        return {'segments': 0, 'stable': 0, 'moderate': 0, 'unstable': 0, 'unstable_examples': []}
    common = set.intersection(*(set(r) for r in runs))
    buckets = {"stable": [], "moderate": [], "unstable": []}
    for src in sorted(common):
        values = [r[src] for r in runs]
        worst = min(
            SequenceMatcher(None, values[i], values[j]).ratio()
            for i in range(len(values))
            for j in range(i + 1, len(values))
        )
        row = {"src": src, "dst": values, "min_ratio": round(worst, 2)}
        buckets["stable" if worst >= stable else "moderate" if worst >= moderate else "unstable"].append(row)
    return {
        "segments": len(common),
        **{k: len(v) for k, v in buckets.items()},
        "unstable_examples": buckets["unstable"][:8],
    }
