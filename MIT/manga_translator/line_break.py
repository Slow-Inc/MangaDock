"""Knuth-Plass-style line breaking (#180, render parity).

Pure arithmetic, no ML/PIL imports. A pragmatic Knuth-Plass DP that globally
minimises total badness (``slack ** badness_exponent``) across all lines, so the
wrapped block is balanced instead of greedy-overflowing into an ugly short last
line. Lines that end in a hyphen take an extra ``hyphen_penalty``. Ported from
MangaTranslator ``core/text/text_processing.py:489-579``; the word-width is a
caller-supplied callback (the renderer's measurer in production, ``len`` in tests)
so the search stays dependency-light and the prediction matches the real render.

With ``respect_kinsoku`` (#180 step 3), the DP also honours CJK 禁則 rules — a break
that would strand a 行頭禁則 char at a line start or a 行末禁則 char at a line end is
charged ``kinsoku_penalty`` (a large but FINITE cost, so it is avoided whenever a legal
alternative exists yet can never deadlock a run where every break violates a rule).
"""
from typing import Callable, List

from .kinsoku import is_forbidden_line_end, is_forbidden_line_start


def hyphenate_overwide_tokens(
    tokens: List[str],
    max_width: float,
    word_width: Callable[[str], float],
) -> List[str]:
    """Split any token wider than ``max_width`` into hyphenated fragments that each fit,
    returning a new token list (#180 — Latin hyphenation of an over-wide word). A fitting
    token is passed through untouched, so applying this to text with no over-wide word is a
    no-op (byte-identical). Every fragment but the last gets a trailing ``-`` (and is sized
    so ``fragment + '-'`` still fits); the tail carries no hyphen. The DP's ``hyphen_penalty``
    then prices those breaks. If the column is too narrow for even one char plus a hyphen, a
    fragment degrades to a single (possibly overflowing) char so the split always terminates
    with lossless, in-order coverage — ``''.join(f.rstrip('-') ...)`` reproduces the word."""
    out: List[str] = []
    for t in tokens:
        if word_width(t) <= max_width:
            out.append(t)
            continue
        i, n = 0, len(t)
        while i < n:
            j = i + 1  # always take at least one char so a too-narrow column can't loop
            while j < n:
                last = j + 1 == n        # the final fragment needs no hyphen, so it may be wider
                cand = t[i:j + 1] + ('' if last else '-')
                if word_width(cand) > max_width:
                    break
                j += 1
            out.append(t[i:j] + ('-' if j < n else ''))
            i = j
    return out


def find_optimal_line_breaks(
    tokens: List[str],
    max_width: float,
    word_width: Callable[[str], float],
    space_width: float = 1.0,
    badness_exponent: float = 3.0,
    hyphen_penalty: float = 1000.0,
    respect_kinsoku: bool = False,
    kinsoku_penalty: float = 1e9,
) -> List[List[str]]:
    """Group ``tokens`` into lines minimising total badness; return the lines as
    lists of tokens.

    A line spanning tokens ``[j..i)`` has width ``sum(widths) + space_width`` per
    gap; it must be ``<= max_width`` (a single token wider than ``max_width`` is
    still allowed on its own line so a too-long word never deadlocks the search).
    ``badness = max(0, max_width - line_width) ** badness_exponent``, plus
    ``hyphen_penalty`` when the line's last token ends in ``-``. Empty input → ``[]``.

    ``respect_kinsoku`` (default off → byte-identical to the greedy-replacing balance
    path): when on, the break opening a line ``[j..i)`` (``j > 0``) is charged
    ``kinsoku_penalty`` if ``tokens[j]`` may not begin a line (行頭禁則) or
    ``tokens[j-1]`` may not end one (行末禁則). CJK callers tokenise per character and
    pass ``space_width=0``."""
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
            # 禁則: charge the break that opens this line if it strands a forbidden
            # char at a line edge (start of this line, or end of the previous one).
            if respect_kinsoku and j > 0 and (
                is_forbidden_line_start(tokens[j]) or is_forbidden_line_end(tokens[j - 1])
            ):
                badness += kinsoku_penalty
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
