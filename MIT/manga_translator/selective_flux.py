"""#421 selective-Flux routing (pure, no GPU/model dependency).

Decides which erase-mask components sit over TEXTURED art — where LaMa leaves a gray
smear because it cannot synthesise the texture back (a character's hair under dialogue
text) — versus flat background where LaMa is fine. Only the textured ones are routed to
the Flux repair pass. The texture signal is the pixel std-dev in a ring just OUTSIDE each
mask component, reusing the same machinery as ``adaptive_dilate_mask``.
"""
import cv2
import numpy as np


def find_text_over_art_boxes(erase_mask, img_rgb, text_only_mask,
                             flat_std: float = 18.0, ring: int = 6,
                             min_area: int = 100, pad: int = 24,
                             dark_thresh: int = 90, min_dark_frac: float = 0.05):
    """Return padded bounding boxes ``[(x1, y1, x2, y2), ...]`` of erase-mask components
    that sit over textured ART — routed to the Flux repair pass.

    Two gates (both must hold), because std-dev alone over-routes on JPEG noise, light
    screentone and panel haze: (1) the ring just outside the component is textured
    (std >= ``flat_std``); (2) the ring actually contains dark ink (art strokes) —
    a bright noisy ring is not the hair/line-art that LaMa smears."""
    gray = img_rgb if img_rgb.ndim == 2 else cv2.cvtColor(img_rgb, cv2.COLOR_RGB2GRAY)
    gf = gray.astype(np.float32)
    h, w = gray.shape
    m = (np.ascontiguousarray(erase_mask) > 0).astype(np.uint8)
    num, labels, stats, _ = cv2.connectedComponentsWithStats(m)
    boxes = []
    for c in range(1, num):
        if stats[c, cv2.CC_STAT_AREA] < min_area:
            continue
        comp = (labels == c).astype(np.uint8)
        k = 2 * ring + 1
        grown = cv2.dilate(comp, np.ones((k, k), np.uint8))
        band = (grown > 0) & (comp == 0)
        ring_px = gf[band]
        std = float(ring_px.std()) if band.any() else 0.0
        if std < flat_std:
            continue
        # secondary art gate: the ring must actually contain dark ink (hair/line-art),
        # not just be high-variance-but-bright (noise/light screentone).
        dark_frac = float((ring_px < dark_thresh).mean()) if band.any() else 0.0
        if dark_frac < min_dark_frac:
            continue
        x, y, bw, bh = (stats[c, cv2.CC_STAT_LEFT], stats[c, cv2.CC_STAT_TOP],
                        stats[c, cv2.CC_STAT_WIDTH], stats[c, cv2.CC_STAT_HEIGHT])
        boxes.append((max(0, x - pad), max(0, y - pad),
                      min(w, x + bw + pad), min(h, y + bh + pad)))
    return _merge_overlapping(boxes)


def _merge_overlapping(boxes):
    """Union boxes whose (already padded) rectangles overlap, so a cluster of textured
    text components becomes one Flux crop instead of N. Iterates to a fixed point."""
    boxes = list(boxes)
    changed = True
    while changed:
        changed = False
        out = []
        for b in boxes:
            for i, o in enumerate(out):
                if b[0] <= o[2] and o[0] <= b[2] and b[1] <= o[3] and o[1] <= b[3]:
                    out[i] = (min(o[0], b[0]), min(o[1], b[1]),
                              max(o[2], b[2]), max(o[3], b[3]))
                    changed = True
                    break
            else:
                out.append(b)
        boxes = out
    return boxes
