"""Deterministic render-only replay harness (#462, master plan §8.1/§8.2).

Serialize the sizing-relevant state of a page's regions ONCE (dump), then replay just the font-sizing
dispatch offline — no ML, no worker, no network — so a render knob's effect on layout is measured
deterministically instead of being confounded by the non-deterministic translator. Kept dependency-light
(only the sizing fields + `resize_regions_to_font_size`) so replay runs in well under a second.
"""
import json
from types import SimpleNamespace

# The exact region attributes the sizing dispatch reads (rendering/__init__.py). Nothing else affects
# the layout decision, so this is the complete deterministic fixture for a region.
_FIELDS = ['xyxy', 'translation', 'font_size', 'target_lang',
           'bubble_box', 'bubble_polygon', 'sfx_rescued']


def serialize_regions(regions, page_shape):
    """Capture the sizing-relevant state of `regions` + the full page shape into a JSON-able fixture."""
    out = []
    for r in regions:
        d = {}
        for f in _FIELDS:
            v = getattr(r, f, None)
            if f in ('xyxy', 'bubble_box') and v is not None:
                v = [float(x) for x in v]
            elif f == 'bubble_polygon' and v is not None:
                v = [[float(px), float(py)] for px, py in v]
            d[f] = v
        out.append(d)
    return {'page_shape': [int(page_shape[0]), int(page_shape[1])], 'regions': out}


def reconstruct_regions(fixture):
    """Rebuild lightweight region objects (SimpleNamespace) from a fixture for offline replay."""
    regs = []
    for d in fixture['regions']:
        ns = SimpleNamespace()
        for f in _FIELDS:
            v = d.get(f)
            if f == 'xyxy' and v is not None:
                v = tuple(v)
            setattr(ns, f, v)
        regs.append(ns)
    return regs


def replay_clean_layout(fixture, reference_layout=False, font_size_max=20,
                        font_size_minimum=8, font_path=None):
    """Replay the clean-layout SIZING for the fixture regions offline & deterministically, returning a
    LayoutDecision per region. Routing (which regions ARE clean-layout) needs the full TextBlock
    geometry and is out of scope — the caller supplies clean-layout regions; the DEFECT (narration/
    caption size) lives in this sizing, not the routing. `fill_frac_w/h` is measured against the ACTUAL
    fit box (for reference_layout that is the safe-interior/detection box, fixing the live trace's
    misleading `avail_w`)."""
    import os
    from . import rendering as R
    from .rendering import text_render
    from .render_overlap import clean_layout_font_size

    if font_path is None:
        font_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'fonts', 'anime_ace_3.ttf')
    text_render.set_font(font_path)

    regs = reconstruct_regions(fixture)
    ph = tuple(fixture['page_shape'])
    img_shape = (ph[0], ph[1], 3)
    out = []
    for r in regs:
        x1, y1, x2, y2 = (float(v) for v in r.xyxy)
        bubble_box = getattr(r, 'bubble_box', None)
        flat = clean_layout_font_size(font_size_max, ph[0], ph[1], font_size_minimum)
        if reference_layout:
            bw, bh, (rcx, rcy), fill, cap = R._reference_layout_intent(r, bubble_box, img_shape, flat)
            fs, block_w, block_h = R._reference_clean_layout(r, bw, bh, font_size_minimum, cap, ph[1])
            avail_w, avail_h = float(bw), float(bh)
        else:
            fill = None
            laid = R._clean_layout_dst(r, img_shape, font_size_minimum, font_size_max, ph)
            if laid is None:
                out.append(dict(has_bubble=bubble_box is not None, orig_fs=r.font_size, final_fs=None,
                                route='skipped'))
                continue
            fs, block_w, block_h = laid
            avail_w, avail_h = (x2 - x1), (y2 - y1)
            rcx, rcy = (x1 + x2) / 2.0, (y1 + y2) / 2.0
        det_w, det_h = (x2 - x1), (y2 - y1)
        out.append(dict(
            has_bubble=bubble_box is not None, fill=fill, orig_fs=r.font_size, final_fs=int(fs),
            flat=int(flat),
            block_w=round(float(block_w), 2), block_h=round(float(block_h), 2),
            avail_w=round(avail_w, 2), avail_h=round(avail_h, 2),
            det_w=round(det_w, 2), det_h=round(det_h, 2),
            fill_frac_w=round(block_w / avail_w, 3) if avail_w else 0.0,
            fill_frac_h=round(block_h / avail_h, 3) if avail_h else 0.0,
            # width vs the VISIBLE detection box — the user-perceived overflow (a demoted-bubble
            # region can fit its wide safe-interior yet still spill past its narrow visible box).
            overflow_vs_det_w=round(block_w / det_w, 3) if det_w else 0.0,
            # UNDER-size guard (the other failure direction): a non-fill region's font vs the flat
            # design size. Far below 1.0 ⇒ over-shrunk / near-invisible (the 2026-07-02 over-correction).
            readability_ratio=round(fs / flat, 3) if flat else 0.0,
            # P4 (#525): spill of the sized block past the TRUE bubble polygon (0 = inside). Sees the
            # round/oval over-fill that overflow_vs_det_w (detection-box only) misses.
            spill_frac_poly=spill_fraction_vs_polygon(getattr(r, 'bubble_polygon', None),
                                                      block_w, block_h, rcx, rcy)))
    return out


def spill_fraction_vs_polygon(polygon, block_w, block_h, cx, cy):
    """Fraction of a ``block_w×block_h`` rectangle centred at ``(cx, cy)`` that falls OUTSIDE the bubble
    ``polygon`` — the P4 keystone metric (#525). ``0.0`` = the sized text block sits entirely within the
    bubble's true (possibly curved) shape; higher = more spill past the edge. Unlike ``overflow_vs_det_w``
    (which measures vs the axis-aligned detection box) this sees a rectangular block poking past a round/oval
    bubble. Pure: rasterises the polygon on a local canvas and counts block pixels inside it. Returns 0.0 for
    degenerate inputs (no polygon / non-positive block)."""
    bw, bh = int(round(block_w)), int(round(block_h))
    if not polygon or len(polygon) < 3 or bw <= 0 or bh <= 0:
        return 0.0
    from PIL import Image, ImageDraw
    import numpy as np
    bx1, by1 = cx - block_w / 2.0, cy - block_h / 2.0
    xs = [p[0] for p in polygon] + [bx1, bx1 + block_w]
    ys = [p[1] for p in polygon] + [by1, by1 + block_h]
    ox, oy = int(min(xs)) - 1, int(min(ys)) - 1
    cw, ch = int(max(xs)) - ox + 2, int(max(ys)) - oy + 2
    mask = Image.new('L', (cw, ch), 0)
    ImageDraw.Draw(mask).polygon([(px - ox, py - oy) for px, py in polygon], fill=1)
    m = np.asarray(mask, dtype=bool)
    rx1, ry1 = int(round(bx1)) - ox, int(round(by1)) - oy
    inside = int(m[max(0, ry1):ry1 + bh, max(0, rx1):rx1 + bw].sum())
    return round(1.0 - inside / float(bw * bh), 4)


def dump_fixture(regions, page_shape, path):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(serialize_regions(regions, page_shape), f, ensure_ascii=False)


def load_fixture(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)
