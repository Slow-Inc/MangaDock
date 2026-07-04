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
        total_ink = ink_of_box(b)
        if total_ink < min_ink:
            continue                              # genuinely empty — never bait the VLM
        # INK coverage: a dialogue bubble's text covers only ~10-30% of the balloon
        # AREA but ~all of its INK — area coverage duplicated every bubble (v6 live).
        # Sum the ink inside the textline∩balloon clips; >=50% of the balloon's ink
        # inside textlines = covered.
        covered_ink = 0.0
        for t in textline_aabbs:
            ix1, iy1 = max(bx1, t[0]), max(by1, t[1])
            ix2, iy2 = min(bx2, t[2]), min(by2, t[3])
            if ix2 > ix1 and iy2 > iy1:
                covered_ink += ink_of_box((ix1, iy1, ix2, iy2))
        if covered_ink / max(1.0, float(total_ink)) >= 0.5:
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

        def _shrink(b, f=0.10):
            # the balloon's black BORDER counts as ink and dilutes the coverage
            # fraction below threshold (live v7 duplicated every bubble) — measure
            # the interior only.
            w, h = b[2] - b[0], b[3] - b[1]
            return (b[0] + w * f, b[1] + h * f, b[2] - w * f, b[3] - h * f)

        balloons = [_shrink(_aabb(p)) for p in polygons]
        # #535: square white caption boxes are not speech balloons — the YOLO never
        # proposes them (the "STARTING WITH…" box) — but their bright interiors are
        # trivially detectable; give them the same ink-coverage rescue.
        gray_pre = img.mean(axis=2).astype('uint8') if img.ndim == 3 else img
        balloons += [_shrink(b) for b in white_box_candidates(gray_pre)]
        existing = [textline_aabb(t) for t in textlines]
        fresh = empty_balloon_boxes(balloons, existing, _ink)
        for (x1, y1, x2, y2) in fresh:
            pts = np.array([[x1, y1], [x2, y1], [x2, y2], [x1, y2]], dtype=np.float32)
            textlines.append(Quadrilateral(pts, '', 1.0))
        if fresh:
            logger.info(f"[EmptyBalloon] +{len(fresh)} uncovered inked balloon(s) queued for VLM rescue")

        # #535 ink-cluster completeness: text-like ink on a LIGHT background that
        # neither DBNet nor the balloon YOLO covered (a square panel caption, a
        # stray sentence line) — the last net under everything.
        gray = img.mean(axis=2).astype('uint8') if img.ndim == 3 else img
        covered = [textline_aabb(t) for t in textlines] + list(balloons)
        clusters = uncovered_text_clusters(gray, covered)
        for (x1, y1, x2, y2) in clusters:
            pts = np.array([[x1, y1], [x2, y1], [x2, y2], [x1, y2]], dtype=np.float32)
            textlines.append(Quadrilateral(pts, '', 1.0))
        if clusters:
            logger.info(f"[InkCluster] +{len(clusters)} uncovered text cluster(s) queued for VLM rescue")
        return (textlines, mask_raw, mask)
    except Exception:
        logger.warning("[EmptyBalloon] rescue failed — continuing without", exc_info=True)
        return result


def uncovered_text_clusters(gray, covered_boxes, min_area: int = 1200,
                            max_area_frac: float = 0.25,
                            ink_lo: float = 0.04, ink_hi: float = 0.45,
                            bg_light: int = 190, dilate_px: int = 9):
    """#535 completeness (Otome "STARTING WITH…" box + the "ME OFF!" line): find
    text-like INK CLUSTERS no detector covered — sparse dark strokes sitting on a
    LIGHT background (typeset captions / dialogue), the exact pattern both DBNet and
    the balloon YOLO can miss. Dark/dense art is rejected by the ink-density and
    background-lightness gates. Pure numpy/cv2; returns page-coord boxes to append
    as empty textlines for the VLM rescue."""
    import cv2 as _cv2
    import numpy as _np
    g = gray if gray.ndim == 2 else _cv2.cvtColor(gray, _cv2.COLOR_RGB2GRAY)
    h, w = g.shape[:2]
    ink = (g < 128).astype(_np.uint8)
    for (x1, y1, x2, y2) in covered_boxes or []:
        ink[max(0, int(y1)):max(0, int(y2)), max(0, int(x1)):max(0, int(x2))] = 0
    k = 2 * dilate_px + 1
    blob = _cv2.dilate(ink, _np.ones((k, k), _np.uint8))
    num, labels, stats, _ = _cv2.connectedComponentsWithStats(blob)
    out = []
    page_area = float(h * w)
    for i in range(1, num):
        x, y, bw, bh, area = stats[i]
        if bw * bh < min_area or (bw * bh) / page_area > max_area_frac:
            continue
        crop = g[y:y + bh, x:x + bw]
        crop_ink = (crop < 128)
        density = float(crop_ink.mean())
        if not (ink_lo <= density <= ink_hi):
            continue                      # too sparse = speckle; too dense = art
        non_ink = crop[~crop_ink]
        if non_ink.size == 0 or float(_np.median(non_ink)) < bg_light:
            continue                      # background not light = art region
        out.append((float(x), float(y), float(x + bw), float(y + bh)))
    return out


def white_box_candidates(gray, bright: int = 220, min_area: int = 8000,
                         max_area_frac: float = 0.25, min_fill: float = 0.7):
    """#535 (the "STARTING WITH…" caption): a square white CAPTION BOX is not a
    speech balloon, so the balloon YOLO never proposes it — but its white interior
    is trivially detectable. Bright connected components that are large and
    box-like (component area >= ``min_fill`` of their bounding rect) are returned
    as balloon-equivalent boxes for the same ink-coverage rescue. Pure cv2."""
    import cv2 as _cv2
    import numpy as _np
    g = gray if gray.ndim == 2 else _cv2.cvtColor(gray, _cv2.COLOR_RGB2GRAY)
    h, w = g.shape[:2]
    bright_mask = (g >= bright).astype(_np.uint8)
    # NO morphological close: a 15px close bridged the box's thin black border to
    # the white art outside (one page-sized component -> rejected). The interior
    # is already one connected component around the thin text strokes.
    num, labels, stats, _ = _cv2.connectedComponentsWithStats(bright_mask)
    out = []
    page_area = float(h * w)
    for i in range(1, num):
        x, y, bw, bh, area = stats[i]
        rect = float(bw * bh)
        if rect < min_area or rect / page_area > max_area_frac:
            continue
        if area / rect < min_fill:
            continue
        out.append((float(x), float(y), float(x + bw), float(y + bh)))
    return out
