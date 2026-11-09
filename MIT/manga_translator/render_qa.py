"""Post-render QA helpers (#1143 Track C, post-render check): compare what the reader sees with what was intended.

The Thai recogniser itself lives outside this venv (Paddle is installed in C:/Users/xenod/venvs/paddle on this box
and a broken paddle2onnx build blocks the ONNX export), so the offline tool in tools/render_qa.py runs under that
venv. Everything that decides is here, pure and torch-free, so the thresholds are unit-tested.
"""
import re
import unicodedata


def normalize(text) -> str:
    """Letters, digits and combining marks only (pure).

    The Thai recogniser invents spaces and drops punctuation it cannot see, so neither may decide the comparison;
    combining marks are kept on purpose - a missing tone mark is exactly what this check exists to catch."""
    s = unicodedata.normalize("NFC", str(text or ""))
    return "".join(ch for ch in s if ch.isalnum() or unicodedata.category(ch) == "Mn")


def edit_distance(a: str, b: str) -> int:
    """Levenshtein distance (pure)."""
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def cer(expected, got) -> float:
    """Character error rate of a rendered line against its intended text (pure; 1.0 when nothing was intended)."""
    e, g = normalize(expected), normalize(got)
    if not e:
        return 1.0 if g else 0.0
    return edit_distance(e, g) / len(e)


#: A rendered line is worth a human look when the recogniser reads it at least this differently. Measured on
#: Haimiya ch. 6: the one line with a possibly clipped tone mark scored 0.20 while recogniser noise stayed under
#: ~0.11 on clean lines, so 0.18 is the gap (see docs/reports/benchmarks/2026-10-27-render-qa.md).
SUSPICIOUS_CER = 0.18


#: Lines shorter than this (after normalisation) are recognition noise: on ch. 6 the only alarms above the
#: threshold were four-character interjections (`ฟุฟุ` read `ฟพ`, `หืม?` read `หีม?`).
MIN_LENGTH_FOR_CHECK = 5


def is_suspicious(expected, got, threshold: float = SUSPICIOUS_CER) -> bool:
    """Whether a rendered line reads far enough from its intended text to warrant review (pure)."""
    if len(normalize(expected)) < MIN_LENGTH_FOR_CHECK:
        return False
    return cer(expected, got) >= threshold
