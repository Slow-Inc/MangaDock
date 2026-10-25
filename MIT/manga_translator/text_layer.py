"""Text layer of a translated page (#158, PRD #155 P2 enabler).

The patch result carries what each rendered region said — source text and
translation — so downstream consumers (rolling context #159, translation
memory #160) can see what a finished page contains without re-OCR.

Stdlib-only on purpose: the payload shape must unit-test in <1s without the
ML stack. Regions are duck-typed: anything with .text / .translation.
"""
from typing import Iterable, List, Dict, Optional


def _int_box(v):
    """JSON-safe pixel box: numpy scalars → plain int (pydantic can't dump np.int32)."""
    return [int(x) for x in v]


def _float_box(v):
    """JSON-safe float box: numpy scalars → plain float."""
    return [float(x) for x in v]


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
            ('xyxy', 'xyxy', _int_box),
            ('bubble_box', 'bubble_box', _int_box),
            ('font_size', 'font_src_px', int),
            ('render_branch', 'branch', str),
            ('render_font_px', 'font_final_px', int),
            ('render_dst_box', 'dst_box', _float_box),
            # #881: the doctor tells a rescued SFX (drawn at its source glyph size) from a
            # detection error; present only when the rescue flagged the region.
            ('sfx_rescued', 'sfx_rescued', bool),
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
            d['xyxy'] = _int_box(xy)
        d['rendered'] = False
        d['drop_reason'] = reason
        out.append(d)
    return out


#: #1144: a page whose source was echoed back for this many lines failed to translate; one or two kept lines
#: (a sign, a name) are legitimate.
ECHO_FAILURE_MIN = 3


def page_failure(dropped: Iterable, failed_stages) -> str:
    """Why a page that renders nothing FAILED, or '' when it simply has no text (#1144). A failed page must
    be reported as an error: an empty success is cached by the Backend for 7 days. Pure."""
    if failed_stages:
        return 'stage failed: ' + ', '.join(failed_stages)
    echoed = sum(1 for _r, reason in dropped or [] if reason == 'Translation identical to original')
    if echoed >= ECHO_FAILURE_MIN:
        return f'translation echoed the source for {echoed} lines'
    return ''


def empty_patch_result(img_w: int, img_h: int, dropped: Optional[Iterable]) -> Dict:
    """The /patches result for a page that renders nothing — still listing what was dropped and
    why, so "no text" and "every region dropped" are distinguishable (2026-10-20 quality loop)."""
    return {'img_width': img_w, 'img_height': img_h, 'patches': [],
            'regions': dropped_regions_payload(dropped or [])}
