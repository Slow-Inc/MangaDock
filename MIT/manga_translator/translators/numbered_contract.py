"""Numbered-contract normalizer + determinism gate (Master Plan 2 P7).

GPT-family translators speak a numbered contract — for N source queries the model returns
``<|1|>line one <|2|>line two ...``. Real captured failures (defect sweep 2026-07-03) break it:
the model drops an index, returns fewer/more blocks than N, or emits an empty/garbage block. When
the count shifts, the downstream ``zip(indices, results)`` silently misaligns *every following*
region — a page-wide mistranslation from one dropped line.

These pure functions make the contract measurable (for the #526 eval) and repairable at a boundary
(guarantee exactly N, in order, misses marked), and classify whether a decode config is reproducible
(the P7c gate that makes a cached/replayed translation trustworthy as a golden).

Stdlib only (``re``) → sub-second unit tests, no ML import.
"""
from __future__ import annotations

import re
from typing import Dict, List, Optional

OCR_FAILED = '[OCR FAILED]'
# Tolerant delimiter: the model sometimes emits a marker with a missing/loose closing
# ('<|10|' or '<|10>') — live full-page Otome. Accept an optional closing so a malformed
# marker still SPLITS (no leaked '<|10|' in the text, no index shift for later blocks).
_BLOCK_RE = re.compile(r'<\|\s*(\d+)\s*\|?>?')
_STRAY_MARKER_RE = re.compile(r'<\|\s*\d*\s*\|?>?\s*$')


def parse_numbered_blocks(raw: str) -> Dict[int, str]:
    """Parse ``<|i|>text`` blocks into ``{i: text}`` — each block's text runs to the next tag (or
    end), stripped. Any preamble before the first tag is ignored. A later duplicate index wins."""
    if not raw:
        return {}
    matches = list(_BLOCK_RE.finditer(raw))
    out: Dict[int, str] = {}
    for k, m in enumerate(matches):
        idx = int(m.group(1))
        start = m.end()
        end = matches[k + 1].start() if k + 1 < len(matches) else len(raw)
        out[idx] = _STRAY_MARKER_RE.sub('', raw[start:end]).strip()
    return out


def normalize_numbered_output(raw: str, n: int, missing: str = '[Missing item {n}]') -> List[str]:
    """Return EXACTLY ``n`` strings for a numbered response, in index order 1..n.

    - a missing or empty index → the ``missing`` marker (``{n}`` = the 1-based index);
    - extra indices (> n) are dropped (hallucinated trailing blocks);
    - ``n == 1`` with no tag at all → accept the cleaned whole body (single-query shortcut).

    This guarantees the caller's ``zip`` stays aligned even when the model skips a line."""
    blocks = parse_numbered_blocks(raw)
    if n == 1 and not blocks:
        body = (raw or '').strip()
        return [body if body else missing.format(n=1)]
    out: List[str] = []
    for i in range(1, n + 1):
        text = blocks.get(i, '')
        out.append(text if text else missing.format(n=i))
    return out


def is_deterministic_decode(temperature: Optional[float],
                            top_p: Optional[float] = None,
                            top_k: Optional[int] = None) -> bool:
    """True when the decode is greedy / reproducible: ``temperature == 0``, or ``top_k == 1``, or
    ``top_p == 0``. A reproducible decode is the precondition for trusting a cached or replayed
    translation as a golden (P7c) — non-deterministic sampling lets the same cache key hold different
    text run-to-run, which confounds every render A/B and breaks fixture replay."""
    if temperature is not None and float(temperature) == 0.0:
        return True
    if top_k is not None and int(top_k) == 1:
        return True
    if top_p is not None and float(top_p) == 0.0:
        return True
    return False
