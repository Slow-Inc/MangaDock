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
                             dark_thresh: int = 90, min_dark_frac: float = 0.15):
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


async def apply_selective_flux_repair(full_inpainted, img_rgb, erase_mask, text_only_mask,
                                      flux_inpaint, logger=None, **route_kw):
    """Orchestrate the #421 repair: route text-over-art components, Flux-inpaint each crop
    of the ORIGINAL image, paste back into ``full_inpainted``. ``flux_inpaint`` is an
    injected ``async (crop_rgb, mask_crop) -> repaired_crop`` — the GPU/model lifecycle
    (LaMa unload, lock, Flux load/unload) lives in the caller so this stays testable and
    the model plumbing is not duplicated. Each box fails open independently: a Flux error
    keeps the LaMa fill for that box. Returns ``(new_full_inpainted, n_repaired)``."""
    boxes = find_text_over_art_boxes(erase_mask, img_rgb, text_only_mask, **route_kw)
    out = full_inpainted
    n = 0
    for (x1, y1, x2, y2) in boxes:
        crop = np.ascontiguousarray(img_rgb[y1:y2, x1:x2])
        mcrop = np.ascontiguousarray(erase_mask[y1:y2, x1:x2])
        try:
            flux_crop = await flux_inpaint(crop, mcrop)
            out = paste_flux_repair(out, flux_crop, mcrop, (x1, y1, x2, y2))
            n += 1
        except Exception:
            if logger is not None:
                logger.warning(f"[SelectiveFlux] box ({x1},{y1},{x2},{y2}) failed, keeping LaMa fill")
    return out, n


def paste_flux_repair(full_inpainted, flux_crop, mask_crop, box, feather: int = 6,
                      grayscale: bool = True):
    """Composite a Flux repair crop back into ``full_inpainted`` ONLY where ``mask_crop``
    is set, with a soft ``feather`` edge. Mask-only (not full-crop) so LaMa's background
    outside the erased text is untouched and Flux tone drift can't leak. Float32 blend,
    cast once. ``feather`` must stay <= own_work_alpha's mask_margin (8px) or the patch
    compositor crops the feather into a hard seam. ``grayscale`` neutralises Flux's Q4
    colour tint on B/W manga (luminance-only). Input is not mutated. Pure."""
    x1, y1, x2, y2 = box
    out = full_inpainted.copy()
    dst = out[y1:y2, x1:x2].astype(np.float32)
    src = flux_crop.astype(np.float32)
    if grayscale:
        lum = cv2.cvtColor(flux_crop, cv2.COLOR_RGB2GRAY).astype(np.float32)
        src = np.repeat(lum[:, :, None], 3, axis=2)
    alpha = (np.ascontiguousarray(mask_crop) > 0).astype(np.float32)
    if feather > 0:
        k = 2 * feather + 1
        alpha = cv2.GaussianBlur(alpha, (k, k), 0)
    a = alpha[:, :, None]
    blended = dst * (1.0 - a) + src * a
    out[y1:y2, x1:x2] = np.clip(blended, 0, 255).astype(np.uint8)
    return out


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
