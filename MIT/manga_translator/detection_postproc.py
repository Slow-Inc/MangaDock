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
