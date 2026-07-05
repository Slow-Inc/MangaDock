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


def restrict_mask_to_render_regions(mask: np.ndarray, allowed_mask: np.ndarray,
                                    margin: int = 3) -> np.ndarray:
    """#535 empty-bubble guard: the erase mask may never cover text strokes this
    patch will not re-render. The refined mask hunts ALL text-like strokes in the
    crop — including a dropped region's text or a neighbouring group's bubble —
    and erasing those without drawing anything back is the "white empty bubble"
    defect. Intersect the erase mask with the allowed (to-be-rendered) region
    mask, dilated by ``margin`` px so legitimate refinement spill hugging a
    rendered glyph survives. Inputs are not mutated. Pure numpy/cv2."""
    allowed = (np.ascontiguousarray(allowed_mask) > 0).astype(np.uint8)
    if margin > 0:
        k = 2 * margin + 1
        allowed = cv2.dilate(allowed, np.ones((k, k), np.uint8))
    out = np.ascontiguousarray(mask).astype(np.uint8).copy()
    out[allowed == 0] = 0
    return out


def page_scaled_font_min(img_h: int, img_w: int, existing: int) -> int:
    """Page-scaled render font floor for patch mode (#250).

    The renderer's auto floor is ``(h+w)/200`` computed on the small patch crop →
    ~3-4px, unreadably small on the fallback render path (vertical / occupancy>1 /
    no-balloon / SFX). Derive it from the full PAGE instead, and keep any explicit
    override that is already larger.
    """
    page_min = round((img_h + img_w) / 200)
    return max(int(existing), page_min)


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


def seamless_blend_inpaint(inpainted_rgb: np.ndarray, original_rgb: np.ndarray,
                           mask: np.ndarray, *, erode: int = 2) -> np.ndarray:
    """Poisson seamless-clone the inpainted region into the original (PRD #268 escalation lever).

    ``cv2.seamlessClone`` re-integrates the inpaint from the original's boundary gradients, so
    the DC (mean-brightness) band vanishes by construction. It asserts on border-touching or
    empty masks, so the mask is eroded, cleared off the 1-px border, and the call is skipped
    (input returned) when nothing usable remains. Note: it cannot synthesise texture (it
    re-integrates LaMa's already-smooth gradients), so over high-frequency art it trades a hard
    band for a soft smudge — kept as the reserved escalation, not the primary fix. Pure cv2."""
    mb = mask > 127
    if not mb.any():
        return inpainted_rgb
    m = (mb.astype(np.uint8) * np.uint8(255))
    if erode > 0:
        m = cv2.erode(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * erode + 1, 2 * erode + 1)))
    m[:1, :] = 0; m[-1:, :] = 0; m[:, :1] = 0; m[:, -1:] = 0   # seamlessClone needs a border margin
    ys, xs = np.where(m > 0)
    if ys.size == 0:
        return inpainted_rgb
    center = (int((xs.min() + xs.max()) // 2), int((ys.min() + ys.max()) // 2))
    try:
        return cv2.seamlessClone(np.ascontiguousarray(inpainted_rgb),
                                 np.ascontiguousarray(original_rgb), m, center, cv2.NORMAL_CLONE)
    except cv2.error:
        return inpainted_rgb


def tighten_text_mask(original_rgb: np.ndarray, coarse_mask: np.ndarray, *,
                      dilate: int = 2, contrast: float = 18.0,
                      min_frac: float = 0.02) -> np.ndarray:
    """Shrink a coarse text mask to the actual ink strokes inside it (PRD #268 lever).

    A coarse box mask makes LaMa repaint the whole rectangle → a big band over textured art.
    Within the coarse mask this keeps only pixels whose luminance differs from the LOCAL
    background by more than ``contrast`` (the ink — darker OR lighter than the surrounding
    art), plus a small ``dilate`` to cover anti-aliased edges, clipped to the coarse mask. So
    LaMa fills only the strokes and the original art between them survives. If too few strokes
    are found (< ``min_frac`` of the box → contrast can't separate them, e.g. flat fill), the
    coarse mask is returned unchanged so source text is never left un-erased. Pure cv2/numpy."""
    coarse = np.ascontiguousarray(coarse_mask)
    cb = coarse > 127
    if not cb.any():
        return coarse
    gray = cv2.cvtColor(np.ascontiguousarray(original_rgb), cv2.COLOR_RGB2GRAY).astype(np.float32)
    # Background estimate: inpaint the coarse-masked region of the ORIGINAL (fast-marching) so
    # the surrounding art is propagated under the text — robust to any stroke width (a median
    # window narrower than a thick stroke would just return the stroke itself).
    bg = cv2.inpaint(np.ascontiguousarray(original_rgb), (cb * np.uint8(255)), 3, cv2.INPAINT_TELEA)
    bg_gray = cv2.cvtColor(bg, cv2.COLOR_RGB2GRAY).astype(np.float32)
    stroke = (np.abs(gray - bg_gray) > float(contrast)) & cb
    if dilate > 0:
        k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * dilate + 1, 2 * dilate + 1))
        stroke = (cv2.dilate(stroke.astype(np.uint8), k) > 0) & cb
    if int(stroke.sum()) < min_frac * int(cb.sum()):
        return coarse
    return stroke.astype(np.uint8) * np.uint8(255)


def reground_inpaint_luminance(inpainted_rgb: np.ndarray, original_rgb: np.ndarray,
                               mask: np.ndarray, *, strength: float = 1.0,
                               radius_frac: float = 0.06, max_delta: float = 40.0,
                               chroma: bool = True) -> np.ndarray:
    """Re-ground the low-frequency luminance of an inpainted crop *inside the mask* to the
    local original surroundings — kill the "painted band" where LaMa's fill is a few levels
    off the real art (PRD #268).

    The LaMa fill can be too LIGHT over dark hair and too DARK over the lighter cheek within
    one mask; a single global offset can only null the average. This computes, per pixel and
    **per RGB channel**, a spatially-varying correction from two normalized convolutions (box
    filters): the local mean of the ORIGINAL over the non-mask neighbours (``lowO``) and the
    local mean of the INPAINT over the masked neighbours (``lowI``). ``delta = clip(lowO -
    lowI, ±max_delta)`` added to the inpaint pulls each masked pixel's low frequency to its
    own surround while LaMa's high-frequency detail (hair strands) — the inpaint minus its own
    local mean — is preserved. A boundary feather tapers the correction to 0 at the mask edge
    (no new edge-band). Over a uniform background the per-pixel field collapses to a single
    scalar (≡ a plain mean offset). Working per RGB channel is exact for B&W manga (R=G=B → an
    equal shift on all channels → no chroma tint, the #156-safe property) and naturally matches
    local colour when a page has it. ``chroma=False`` forces a single shared grey delta
    (hue-locked) as an escape hatch. Outside the mask the crop is byte-identical. Pure cv2/numpy
    — no torch, CPU.

    ``strength`` (0→1) lerps the correction (0 → input returned unchanged, byte-identical).
    Returns a corrected RGB uint8 crop the same shape as the input."""
    inp = np.ascontiguousarray(inpainted_rgb)
    if strength <= 0:
        return inp
    h, w = mask.shape[:2]
    mask_bool = mask > 127
    n_mask = int(mask_bool.sum())
    valid = ~mask_bool
    n_valid = int(valid.sum())
    # Nothing to erase, or too little surrounding context to ground against → leave as-is.
    if n_mask == 0 or n_valid < 0.15 * (h * w):
        return inp

    r = max(8, int(round(radius_frac * min(h, w))))
    k = (2 * r + 1, 2 * r + 1)
    inp_f = inp.astype(np.float32)
    maskf = mask_bool.astype(np.float32)
    mask_u8 = (mask_bool * np.uint8(255))
    # Propagate the surrounding ORIGINAL into the mask (fast-marching) so the low-frequency
    # target is defined even deep inside a mask wider than the box kernel — a plain
    # normalized box convolution leaves the interior of a wide mask with no valid neighbour.
    # The propagated fill follows each side's surround → bidirectional correction (dark hair
    # vs lighter cheek) in one pass.
    orig_filled = cv2.inpaint(np.ascontiguousarray(original_rgb), mask_u8,
                              max(3, r // 4), cv2.INPAINT_TELEA).astype(np.float32)
    denM = cv2.boxFilter(maskf, -1, k, normalize=False) + 1e-3    # local count of mask
    # Inner feather: full correction in the mask interior, tapering to 0 over the last few px
    # at the mask edge (so the corrected interior blends into the byte-identical exterior — a
    # GaussianBlur(sigma=r) would wrongly weaken the interior of a narrow column).
    dist = cv2.distanceTransform(mask_bool.astype(np.uint8), cv2.DIST_L2, 3)
    feather_px = max(2.0, r / 3.0)
    soft = np.clip(dist / feather_px, 0.0, 1.0).astype(np.float32) * float(strength)

    # Per-channel low-frequency delta (in 0–255 value space → exact for B&W, no LAB nonlinearity).
    deltas = []
    for c in range(3):
        lowO = cv2.boxFilter(orig_filled[..., c], -1, k, normalize=True)          # propagated-original low-freq
        lowI = cv2.boxFilter(inp_f[..., c] * maskf, -1, k, normalize=False) / denM  # inpaint low-freq over the mask
        deltas.append(np.clip(lowO - lowI, -max_delta, max_delta))
    if not chroma:                                   # hue-lock: one shared grey delta
        shared = (deltas[0] + deltas[1] + deltas[2]) / 3.0
        deltas = [shared, shared, shared]

    out = inp_f.copy()
    for c in range(3):
        out[..., c] = np.clip(inp_f[..., c] + deltas[c] * soft, 0.0, 255.0)
    out = out.astype(np.uint8)
    out[valid] = inp[valid]   # enforce exact outside-mask byte-identity
    return np.ascontiguousarray(out)


def add_own_balloon_interiors(allowed_mask: np.ndarray, regions,
                              border_frac: float = 0.04) -> np.ndarray:
    """#535 ("ME OFF!" ghost): a region that owns a speech balloon may erase ANY
    stroke inside that balloon — the translation is re-rendered over the whole
    balloon, so leftover source lines the detector's box missed (the last "ME
    OFF!" line) are its own territory, not a neighbour's. Adds each region's
    (slightly shrunk, border-safe) ``bubble_box`` interior to the allowed erase
    mask. Regions without a balloon contribute nothing. Input not mutated."""
    out = np.ascontiguousarray(allowed_mask).astype(np.uint8).copy()
    h, w = out.shape[:2]
    for r in regions:
        bb = getattr(r, 'bubble_box', None)
        if bb is None:
            continue
        x1, y1, x2, y2 = (float(v) for v in bb)
        dx, dy = (x2 - x1) * border_frac, (y2 - y1) * border_frac
        ix1, iy1 = max(0, int(x1 + dx)), max(0, int(y1 + dy))
        ix2, iy2 = min(w, int(x2 - dx)), min(h, int(y2 - dy))
        if ix2 > ix1 and iy2 > iy1:
            out[iy1:iy2, ix1:ix2] = 255
    return out


def erase_own_balloon_ink(mask: np.ndarray, crop_rgb: np.ndarray, regions,
                          border_frac: float = 0.06, ink_thresh: int = 128,
                          dilate_px: int = 2, art_ink_frac: float = 0.22) -> np.ndarray:
    """#535 round-7 ("ME OFF!" ghost / A1 leftover caption text): the detector's
    line box misses caption text at the box edges — inside a region's OWN box they
    are its territory (the translation re-renders over the box), so add that INK to
    the erase mask.

    One-Punch HUH-panel regression fix: a character figure is LINE ART (thin
    strokes, same as text — a connected-component *size* test can't tell them
    apart). Instead gate on the whole-box INK FRACTION: a white caption box is
    mostly paper (low ink, ~10%) so all its ink is text and safe to erase; a box
    whose interior ink exceeds ``art_ink_frac`` contains art (a figure) and is
    skipped ENTIRELY — nothing erased. Input not mutated."""
    out = np.ascontiguousarray(mask).astype(np.uint8).copy()
    h, w = out.shape[:2]
    gray = crop_rgb.mean(axis=2) if crop_rgb.ndim == 3 else crop_rgb
    for r in regions:
        bb = getattr(r, 'bubble_box', None)
        if bb is None:
            continue
        x1, y1, x2, y2 = (float(v) for v in bb)
        dx, dy = (x2 - x1) * border_frac, (y2 - y1) * border_frac
        ix1, iy1 = max(0, int(x1 + dx)), max(0, int(y1 + dy))
        ix2, iy2 = min(w, int(x2 - dx)), min(h, int(y2 - dy))
        if ix2 <= ix1 or iy2 <= iy1:
            continue
        ink = (gray[iy1:iy2, ix1:ix2] < ink_thresh).astype(np.uint8)
        if ink.mean() > art_ink_frac:
            continue                              # box contains art -> preserve all
        ink = ink * 255
        if dilate_px > 0:
            k = 2 * dilate_px + 1
            ink = cv2.dilate(ink, np.ones((k, k), np.uint8))
        out[iy1:iy2, ix1:ix2] = np.maximum(out[iy1:iy2, ix1:ix2], ink)
    return out


def changed_alpha(rendered: np.ndarray, original: np.ndarray,
                  thresh: int = 8, dilate_px: int = 3) -> np.ndarray:
    """#535 round-8 (the "ME OFF!" resurrection): patch crops overlap, and a patch
    composited as a full opaque rectangle repaints its crop's ORIGINAL pixels over
    a neighbouring patch's erased/rendered work — un-deleting the neighbour's
    source text. Alpha = only the pixels this patch actually CHANGED vs the
    pristine crop (small ``dilate_px`` ring against anti-aliased seams), so
    overlapping patches compose instead of stomping each other. Pure numpy/cv2."""
    diff = np.abs(rendered.astype(np.int16) - original.astype(np.int16))
    if diff.ndim == 3:
        diff = diff.max(axis=2)
    changed = (diff > thresh).astype(np.uint8)
    if dilate_px > 0:
        k = 2 * dilate_px + 1
        changed = cv2.dilate(changed, np.ones((k, k), np.uint8))
    return (changed * 255).astype(np.uint8)
