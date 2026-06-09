"""Knuth-Plass-style line breaking (#180, render parity).

Pure arithmetic, no ML/PIL imports. A pragmatic Knuth-Plass DP that globally
minimises total badness (``slack ** badness_exponent``) across all lines, so the
wrapped block is balanced instead of greedy-overflowing into an ugly short last
line. Lines that end in a hyphen take an extra ``hyphen_penalty``. Ported from
MangaTranslator ``core/text/text_processing.py:489-579``; the word-width is a
caller-supplied callback (the renderer's measurer in production, ``len`` in tests)
so the search stays dependency-light and the prediction matches the real render.
"""
from typing import Callable, List


def find_optimal_line_breaks(
    tokens: List[str],
    max_width: float,
    word_width: Callable[[str], float],
    space_width: float = 1.0,
    badness_exponent: float = 3.0,
    hyphen_penalty: float = 1000.0,
) -> List[List[str]]:
    """Group ``tokens`` into lines minimising total badness; return the lines as
    lists of tokens.

    A line spanning tokens ``[j..i)`` has width ``sum(widths) + space_width`` per
    gap; it must be ``<= max_width`` (a single token wider than ``max_width`` is
    still allowed on its own line so a too-long word never deadlocks the search).
    ``badness = max(0, max_width - line_width) ** badness_exponent``, plus
    ``hyphen_penalty`` when the line's last token ends in ``-``. Empty input → ``[]``.
    """
    n = len(tokens)
    if n == 0:
        return []
    w = [word_width(t) for t in tokens]
    INF = float("inf")
    cost = [INF] * (n + 1)
    prev = [0] * (n + 1)
    cost[0] = 0.0
    for i in range(1, n + 1):
        line_width = 0.0
        for j in range(i - 1, -1, -1):
            if j < i - 1:
                line_width += space_width
            line_width += w[j]
            # Line [j..i) overflows — and it isn't a lone (forced) token: any
            # smaller j is only wider, so stop extending this line leftward.
            if line_width > max_width and j < i - 1:
                break
            slack = max_width - line_width
            badness = (slack ** badness_exponent) if slack > 0 else 0.0
            if tokens[i - 1].endswith("-"):
                badness += hyphen_penalty
            total = cost[j] + badness
            if total < cost[i]:
                cost[i] = total
                prev[i] = j
    lines: List[List[str]] = []
    k = n
    while k > 0:
        j = prev[k]
        lines.insert(0, tokens[j:k])
        k = j
    return lines
