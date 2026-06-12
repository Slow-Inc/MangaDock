"""Pure geometry helpers for the per-region patch path (#187 seam S24a).

These three functions are the `self`-free numpy/cv2 core of `translate_patches`'
per-group rendering: shift a region into crop-local coordinates, rasterize a
text-only inpaint mask, and crop/scale the raw detection mask to a patch. They
are deterministic pixel/coordinate math with no model or `self` dependency, so
they live here as plain functions (golden-numpy unit-tested) and the driver
keeps thin delegates. Bodies are byte-identical with the former methods.
"""
import copy
from typing import Any, List

import cv2
import numpy as np


def build_local_region(region: Any, x_offset: int, y_offset: int) -> Any:
    local_region = copy.deepcopy(region)
    local_region.lines = np.array(local_region.lines, dtype=np.int32)
    local_region.lines[..., 0] -= x_offset
    local_region.lines[..., 1] -= y_offset
    local_region._bounding_rect = None

    # #166: the balloon box (#170) is in page coords — shift it into the crop
    # so area-driven sizing compares it against the local textline box.
    bb = getattr(local_region, 'bubble_box', None)
    if bb is not None:
        local_region.bubble_box = (bb[0] - x_offset, bb[1] - y_offset,
                                   bb[2] - x_offset, bb[3] - y_offset)
    # #179: shift the balloon polygon into crop coords too (used to rasterize
    # the interior mask for narrow-column wrapping).
    poly = getattr(local_region, 'bubble_polygon', None)
    if poly is not None:
        local_region.bubble_polygon = [(px - x_offset, py - y_offset) for px, py in poly]

    for key in [
        'xyxy', 'xywh', 'center', 'unrotated_polygons', 'unrotated_min_rect',
        'min_rect', 'polygon_aspect_ratio', 'unrotated_size', 'aspect_ratio',
    ]:
        local_region.__dict__.pop(key, None)

    return local_region


def create_text_only_mask(img_h: int, img_w: int, regions: List[Any]) -> np.ndarray:
    """Create a mask containing only text regions for targeted inpainting.

    This preserves the background while only marking text areas for removal.
    Returns a mask where text regions = 255 (inpaint), background = 0 (preserve).
    """
    mask = np.zeros((img_h, img_w), dtype=np.uint8)

    adaptive_kernel = 5
    if regions:
        font_sizes = [int(getattr(region, 'font_size', 0) or 0) for region in regions]
        avg_font_size = sum(font_sizes) / max(1, len(font_sizes))
        adaptive_kernel = int(max(3, min(9, round(avg_font_size / 10) * 2 + 1)))

    for region in regions:
        if hasattr(region, 'lines') and region.lines is not None and len(region.lines) > 0:
            for line in region.lines:
                pts = np.array(line, dtype=np.int32).reshape(-1, 2)
                if pts.shape[0] >= 3:
                    cv2.fillPoly(mask, [pts], 255)
        elif hasattr(region, 'xyxy'):
            x1, y1, x2, y2 = map(int, region.xyxy)
            cv2.rectangle(mask, (x1, y1), (x2, y2), 255, -1)

    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (adaptive_kernel, adaptive_kernel))
    mask = cv2.dilate(mask, kernel, iterations=1)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=1)

    return mask


def crop_mask_for_patch(
    raw_mask_source: np.ndarray,
    x1: int,
    y1: int,
    x2: int,
    y2: int,
    img_h: int,
    img_w: int,
) -> np.ndarray:
    crop_h = max(1, y2 - y1)
    crop_w = max(1, x2 - x1)

    if raw_mask_source is None:
        return np.zeros((crop_h, crop_w), dtype=np.uint8)

    mask = raw_mask_source
    if len(mask.shape) == 3:
        mask = cv2.cvtColor(mask, cv2.COLOR_BGR2GRAY)

    mask_h, mask_w = mask.shape[:2]
    if mask_h <= 0 or mask_w <= 0:
        return np.zeros((crop_h, crop_w), dtype=np.uint8)

    if mask_h == img_h and mask_w == img_w:
        mx1, my1, mx2, my2 = x1, y1, x2, y2
    else:
        scale_x = mask_w / max(1.0, float(img_w))
        scale_y = mask_h / max(1.0, float(img_h))
        mx1 = int(np.floor(x1 * scale_x))
        my1 = int(np.floor(y1 * scale_y))
        mx2 = int(np.ceil(x2 * scale_x))
        my2 = int(np.ceil(y2 * scale_y))

    mx1 = max(0, min(mask_w, mx1))
    my1 = max(0, min(mask_h, my1))
    mx2 = max(0, min(mask_w, mx2))
    my2 = max(0, min(mask_h, my2))

    if mx2 <= mx1 or my2 <= my1:
        return np.zeros((crop_h, crop_w), dtype=np.uint8)

    cropped_mask = np.ascontiguousarray(mask[my1:my2, mx1:mx2].copy())
    if cropped_mask.size == 0:
        return np.zeros((crop_h, crop_w), dtype=np.uint8)

    if cropped_mask.shape[0] != crop_h or cropped_mask.shape[1] != crop_w:
        # #248: nearest-neighbor on a BINARY mask. INTER_LINEAR bleeds the 255s
        # into a gradient that the `> 0` re-binarize below turns into fattened
        # edges (a 2x upscale of one pixel lights 16 vs nearest's 4) — that extra
        # halo is exactly what makes LaMa over-erase. Nearest keeps the edge tight.
        cropped_mask = cv2.resize(cropped_mask, (crop_w, crop_h), interpolation=cv2.INTER_NEAREST)

    cropped_mask[cropped_mask > 0] = 255
    return cropped_mask.astype(np.uint8)


def union_refined_with_fallback(refined_mask: np.ndarray, text_only_mask: np.ndarray) -> np.ndarray:
    """Tame the patch inpaint mask handed to LaMa (#248).

    The refined (CRF-tightened) mask hugs the glyph strokes. `text_only_mask` is a
    dilated + MORPH_CLOSE rectangle/polygon; OR-ing it wholesale (the old
    ``cv2.max(refined, text_only)``) forces LaMa to erase a fat halo of clean
    background around every glyph — destroying screentone / line-art next to
    bubbles. Instead keep the tight refined mask everywhere it has coverage, and
    fall back to ``text_only_mask`` only inside the connected components the
    refinement missed ENTIRELY. Glyphs the CRF dropped are still covered (no
    residue); regions it covered get no halo.
    """
    refined = np.ascontiguousarray(refined_mask).astype(np.uint8)
    text_only = np.ascontiguousarray(text_only_mask).astype(np.uint8)

    out = refined.copy()
    out[out > 0] = 255

    # Per-component fallback: add text_only only where refined has zero overlap.
    num, labels = cv2.connectedComponents((text_only > 0).astype(np.uint8))
    for label in range(1, num):
        component = labels == label
        if not np.any(refined[component]):
            out[component] = 255

    return out


def expand_inpaint_crop(x1: int, y1: int, x2: int, y2: int,
                        img_h: int, img_w: int, pad: int):
    """Expand a render-rect crop by `pad` px on each side for inpainting (#249).

    The patch path renders a tight crop, but LaMa's FFC global branch reconstructs
    by mixing global context — a tight crop starves it of clean background. This
    returns a larger inpaint crop ``(ix1, iy1, ix2, iy2)`` (the render rect grown by
    `pad`, clamped to the image) plus the offset ``(ox, oy)`` of the render rect
    inside that larger crop, so the caller can slice the inpaint result back to the
    render rect after running LaMa on the wider receptive field. Pure integer math.
    """
    ix1 = max(0, x1 - pad)
    iy1 = max(0, y1 - pad)
    ix2 = min(img_w, x2 + pad)
    iy2 = min(img_h, y2 + pad)
    return ix1, iy1, ix2, iy2, x1 - ix1, y1 - iy1


def feather_alpha(content_mask: np.ndarray, radius: int) -> np.ndarray:
    """Distance-transform alpha ramp for blending a patch into the page (#173).

    Each translated region is composited as a rectangular PNG patch; against a
    textured/screentone background the straight edge reads as a visible rectangle.
    This builds a per-patch alpha that is opaque (255) over the content and fades
    to 0 over a `radius`-px band *outside* the content, so the patch blends instead
    of showing a hard seam: ``alpha = clip(1 - d_out / radius, 0, 1)`` where
    ``d_out`` is the Euclidean distance from each background pixel to the nearest
    content pixel (0 inside content). ``radius <= 0`` → hard alpha (byte-identical
    to the un-feathered patch). Pure numpy/cv2 — no ML.
    """
    content = (np.ascontiguousarray(content_mask) > 0).astype(np.uint8)
    if radius <= 0:
        return content * np.uint8(255)

    background = (content == 0).astype(np.uint8)
    d_out = cv2.distanceTransform(background, cv2.DIST_L2, 3)
    ramp = np.clip(1.0 - d_out / float(radius), 0.0, 1.0)
    return (ramp * 255.0).astype(np.uint8)
