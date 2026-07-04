"""Text layer of a translated page (#158, PRD #155 P2 enabler).

The patch result carries what each rendered region said — source text and
translation — so downstream consumers (rolling context #159, translation
memory #160) can see what a finished page contains without re-OCR.

Stdlib-only on purpose: the payload shape must unit-test in <1s without the
ML stack. Regions are duck-typed: anything with .text / .translation.
"""
from typing import Iterable, List, Dict


def regions_payload(regions: Iterable) -> List[Dict[str, str]]:
    """[{src, dst}] for every rendered region, in render order.

    #535 Phase-0c: when render-telemetry attrs are present on a region they are
    included so the defect-metric harness can diagnose per region (geometry, the
    routing branch taken, source vs final font px). Keys appear ONLY when the
    attr exists — a bare region still yields exactly the legacy {src, dst}
    (backward-compatible; old consumers untouched)."""
    out: List[Dict[str, str]] = []
    for r in regions or []:
        d = {
            'src': getattr(r, 'text', '') or '',
            'dst': getattr(r, 'translation', '') or '',
        }
        for attr, key, conv in (
            ('xyxy', 'xyxy', list),
            ('bubble_box', 'bubble_box', list),
            ('font_size', 'font_src_px', int),
            ('render_branch', 'branch', str),
            ('render_font_px', 'font_final_px', int),
            ('render_dst_box', 'dst_box', list),
        ):
            v = getattr(r, attr, None)
            if v is not None:
                try:
                    d[key] = conv(v)
                except (TypeError, ValueError):
                    pass
        if 'branch' in d or 'font_final_px' in d:
            d['rendered'] = True
        out.append(d)
    return out


def dropped_regions_payload(dropped: Iterable) -> List[Dict[str, str]]:
    """#535 Phase-0c: [{src, dst, xyxy?, rendered: False, drop_reason}] for every
    region the post-translation filter dropped — so a page's payload accounts for
    ALL detected text, and an empty bubble in the render is attributable."""
    out: List[Dict[str, str]] = []
    for r, reason in dropped or []:
        d = {
            'src': getattr(r, 'text', '') or '',
            'dst': getattr(r, 'translation', '') or '',
        }
        xy = getattr(r, 'xyxy', None)
        if xy is not None:
            d['xyxy'] = list(xy)
        d['rendered'] = False
        d['drop_reason'] = reason
        out.append(d)
    return out
