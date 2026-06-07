"""Text layer of a translated page (#158, PRD #155 P2 enabler).

The patch result carries what each rendered region said — source text and
translation — so downstream consumers (rolling context #159, translation
memory #160) can see what a finished page contains without re-OCR.

Stdlib-only on purpose: the payload shape must unit-test in <1s without the
ML stack. Regions are duck-typed: anything with .text / .translation.
"""
from typing import Iterable, List, Dict


def regions_payload(regions: Iterable) -> List[Dict[str, str]]:
    """[{src, dst}] for every rendered region, in render order."""
    out: List[Dict[str, str]] = []
    for r in regions or []:
        out.append({
            'src': getattr(r, 'text', '') or '',
            'dst': getattr(r, 'translation', '') or '',
        })
    return out
