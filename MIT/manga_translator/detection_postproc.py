"""SFX detection second-pass merge (#187 seam S13 / #168).

`merge_sfx_detections` + `textline_aabb` moved off the god object: run the AnimeText SFX
detector as a second pass and merge the boxes the primary detector missed (IoA-deduped)
as empty textlines, so stylized SFX flow through OCR → translate → render like any
dialogue line. Gated by ``config.detector.det_sfx`` at the call site. ``device`` is passed
in; the ML imports stay lazy so the module is import-light.
"""
import logging
from typing import Tuple

import numpy as np

logger = logging.getLogger('manga_translator')


def textline_aabb(q) -> Tuple[float, float, float, float]:
    xs, ys = q.pts[:, 0], q.pts[:, 1]
    return (float(xs.min()), float(ys.min()), float(xs.max()), float(ys.max()))


def merge_sfx_detections(ctx, result, device):
    from .sfx_detector import detect_sfx_boxes
    from .sfx_merge import dedup_sfx_boxes
    from .utils.generic import Quadrilateral
    textlines, mask_raw, mask = result
    sfx_boxes = detect_sfx_boxes(ctx.img_rgb, device=str(device or 'cuda'))
    if not sfx_boxes:
        return result
    existing = [textline_aabb(t) for t in textlines]
    fresh = dedup_sfx_boxes(existing, sfx_boxes)
    for (x1, y1, x2, y2) in fresh:
        pts = np.array([[x1, y1], [x2, y1], [x2, y2], [x1, y2]], dtype=np.float32)
        textlines.append(Quadrilateral(pts, '', 1.0))
    logger.info(f"[SFXDetect] {len(sfx_boxes)} boxes, +{len(fresh)} new textlines "
                f"(deduped {len(sfx_boxes) - len(fresh)})")
    return (textlines, mask_raw, mask)


def empty_balloon_boxes(balloon_aabbs, textline_aabbs, ink_of_box, min_ink: int = 150):
    """#535 empty-balloon rescue (Otome "STARTING WITH…" box): DBNet can be blind to a
    clean typeset caption while the balloon detector still sees its BOX. A balloon that
    (a) contains no detected textline (by textline CENTER) and (b) actually has ink
    (``ink_of_box(box) >= min_ink`` dark px — so a genuinely empty balloon never baits
    the VLM into hallucinating) is missed text: the caller appends it as an empty
    textline so OCR→vlm_rescue reads it like a rescued SFX. Pure geometry."""
    out = []
    for b in balloon_aabbs:
        bx1, by1, bx2, by2 = b
        b_area = max(1.0, (bx2 - bx1) * (by2 - by1))
        # AREA coverage, not center-containment: at a low text_threshold DBNet can
        # leave one faint sliver inside the box (it dies later at OCR) which would
        # wrongly mark the balloon as covered.
        cov = 0.0
        for t in textline_aabbs:
            ix = max(0.0, min(bx2, t[2]) - max(bx1, t[0]))
            iy = max(0.0, min(by2, t[3]) - max(by1, t[1]))
            cov += ix * iy
        if cov / b_area >= 0.2:
            continue
        if ink_of_box(b) < min_ink:
            continue
        out.append(tuple(b))
    return out


def merge_empty_balloons(ctx, result, device):
    """#535: append an empty textline for every inked balloon DBNet left uncovered —
    it then flows OCR → vlm_rescue → translate → render exactly like a rescued SFX.
    Best-effort: any failure returns ``result`` unchanged."""
    try:
        from .bubble_detector import detect_bubbles
        from .utils.generic import Quadrilateral
        textlines, mask_raw, mask = result
        polygons = detect_bubbles(ctx.img_rgb, device=str(device or 'cuda'))
        if not polygons:
            return result
        img = ctx.img_rgb

        def _aabb(poly):
            xs = [p[0] for p in poly]
            ys = [p[1] for p in poly]
            return (float(min(xs)), float(min(ys)), float(max(xs)), float(max(ys)))

        def _ink(box):
            x1, y1, x2, y2 = (max(0, int(v)) for v in box)
            crop = img[y1:y2, x1:x2]
            if crop.size == 0:
                return 0
            gray = crop.mean(axis=2) if crop.ndim == 3 else crop
            return int((gray < 128).sum())

        balloons = [_aabb(p) for p in polygons]
        existing = [textline_aabb(t) for t in textlines]
        fresh = empty_balloon_boxes(balloons, existing, _ink)
        for (x1, y1, x2, y2) in fresh:
            pts = np.array([[x1, y1], [x2, y1], [x2, y2], [x1, y2]], dtype=np.float32)
            textlines.append(Quadrilateral(pts, '', 1.0))
        if fresh:
            logger.info(f"[EmptyBalloon] +{len(fresh)} uncovered inked balloon(s) queued for VLM rescue")
        return (textlines, mask_raw, mask)
    except Exception:
        logger.warning("[EmptyBalloon] rescue failed — continuing without", exc_info=True)
        return result
