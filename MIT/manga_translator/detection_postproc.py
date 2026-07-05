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


def expand_balloons_with_white_boxes(balloon_aabbs, white_boxes,
                                     containment: float = 0.7):
    """#535 round-7 ("ME OFF!" ghost root): the balloon YOLO's box for a square
    caption stops short of the true white box (y=1182 vs 1247 live), so both the
    own-balloon erase and the tall fit miss the caption's last line. When a white
    box substantially contains a balloon (>= ``containment`` of the balloon's
    area), grow the balloon to their union; white boxes touching no balloon are
    appended as balloons of their own. Pure geometry."""
    def _inter(a, b):
        ix = max(0.0, min(a[2], b[2]) - max(a[0], b[0]))
        iy = max(0.0, min(a[3], b[3]) - max(a[1], b[1]))
        return ix * iy

    out = []
    used = [False] * len(white_boxes)
    for b in balloon_aabbs:
        b_area = max(1.0, (b[2] - b[0]) * (b[3] - b[1]))
        grown = tuple(b)
        for i, wb in enumerate(white_boxes):
            if _inter(b, wb) / b_area >= containment:
                grown = (min(grown[0], wb[0]), min(grown[1], wb[1]),
                         max(grown[2], wb[2]), max(grown[3], wb[3]))
                used[i] = True
        out.append(grown)
    for i, wb in enumerate(white_boxes):
        if not used[i] and all(_inter(b, wb) <= 0.0 for b in balloon_aabbs):
            out.append(tuple(wb))
    return out


def erase_ink_in_white_caption_boxes(mask, gray_or_rgb, border_frac: float = 0.06,
                                     ink_thresh: int = 128, dilate_px: int = 2):
    """#535 A1 (leftover caption text): the detection line box misses caption text at
    the box edges, so it survives the erase. Erase ALL ink inside a VERIFIED white
    caption box — ``white_box_candidates`` only returns box-like bright rectangles
    (fill >= 0.7), which are caption panels, NOT speech balloons (oval / containing
    art). So a character figure under a bubble (A2) is never touched — it is not in
    a white box. Pure cv2. Input not mutated."""
    import cv2 as _cv2
    import numpy as _np
    gray = gray_or_rgb if gray_or_rgb.ndim == 2 else _cv2.cvtColor(gray_or_rgb, _cv2.COLOR_RGB2GRAY)
    out = _np.ascontiguousarray(mask).astype(_np.uint8).copy()
    h, w = out.shape[:2]
    for (x1, y1, x2, y2) in white_box_candidates(gray):
        dx, dy = (x2 - x1) * border_frac, (y2 - y1) * border_frac
        ix1, iy1 = max(0, int(x1 + dx)), max(0, int(y1 + dy))
        ix2, iy2 = min(w, int(x2 - dx)), min(h, int(y2 - dy))
        if ix2 <= ix1 or iy2 <= iy1:
            continue
        ink = (gray[iy1:iy2, ix1:ix2] < ink_thresh).astype(_np.uint8)
        # One-Punch HUH regression #2: a bright ART PANEL with a line-art character
        # passes the white-box test (ink ~8%). A connected ink component large in
        # BOTH dims (absolute page-scaled cap — a figure's mass; text lines are wide
        # but THIN) marks the box as art -> skip it entirely.
        art_dim = max(48, int(0.05 * max(h, w)))
        num, _labels, stats, _c = _cv2.connectedComponentsWithStats(ink, connectivity=8)
        has_art = any(stats[c, _cv2.CC_STAT_WIDTH] > art_dim
                      and stats[c, _cv2.CC_STAT_HEIGHT] > art_dim
                      for c in range(1, num))
        if has_art:
            continue
        ink = ink * 255
        if dilate_px > 0:
            k = 2 * dilate_px + 1
            ink = _cv2.dilate(ink, _np.ones((k, k), _np.uint8))
        out[iy1:iy2, ix1:ix2] = _np.maximum(out[iy1:iy2, ix1:ix2], ink)
    return out


def flatten_white_captions(inpainted, gray_or_rgb_orig, border_frac: float = 0.06,
                           ink_thresh: int = 128, dilate_px: int = 3):
    """LaMa-ghost fix (user-diagnosed): the erase mask covered ALL caption ink, yet
    lama_large reconstructed a faint squiggle of the source text from the stroke
    stubs around the tight mask. A verified white caption box is UNIFORM PAPER —
    replace the source-ink pixels (dilated) in the INPAINTED image with the box's
    own paper colour directly, instead of trusting the GAN. Art-gated exactly like
    ``erase_ink_in_white_caption_boxes`` (a box containing a figure is skipped).
    Returns a new image; inputs not mutated. Pure cv2/numpy."""
    import cv2 as _cv2
    import numpy as _np
    gray = (gray_or_rgb_orig if gray_or_rgb_orig.ndim == 2
            else _cv2.cvtColor(gray_or_rgb_orig, _cv2.COLOR_RGB2GRAY))
    out = _np.ascontiguousarray(inpainted).copy()
    h, w = gray.shape[:2]
    for (x1, y1, x2, y2) in white_box_candidates(gray):
        dx, dy = (x2 - x1) * border_frac, (y2 - y1) * border_frac
        ix1, iy1 = max(0, int(x1 + dx)), max(0, int(y1 + dy))
        ix2, iy2 = min(w, int(x2 - dx)), min(h, int(y2 - dy))
        if ix2 <= ix1 or iy2 <= iy1:
            continue
        ink = (gray[iy1:iy2, ix1:ix2] < ink_thresh).astype(_np.uint8)
        art_dim = max(48, int(0.05 * max(h, w)))
        num, _labels, stats, _c = _cv2.connectedComponentsWithStats(ink, connectivity=8)
        if any(stats[c, _cv2.CC_STAT_WIDTH] > art_dim
               and stats[c, _cv2.CC_STAT_HEIGHT] > art_dim
               for c in range(1, num)):
            continue                              # box contains art -> skip
        if not ink.any():
            continue
        if dilate_px > 0:
            k = 2 * dilate_px + 1
            ink = _cv2.dilate(ink, _np.ones((k, k), _np.uint8))
        paper_px = gray[iy1:iy2, ix1:ix2][ink == 0]
        paper = int(_np.median(paper_px)) if paper_px.size else 255
        region = out[iy1:iy2, ix1:ix2]
        region[ink > 0] = paper
        out[iy1:iy2, ix1:ix2] = region
    return out
