"""Glyph-accurate erase mask via SAM 2.1 (#1143 Track A4).

MIT's erase mask comes from textline polygons, so everything inside a line box is repainted - including the art
between the letters. On Haimiya ch. 6 p2 the hand-lettered HUH sat on hair and next to hand-drawn motion strokes:
the rectangular mask erased the strokes and repainted the hair, while SAM 2.1 segments the letter strokes
themselves (measured in the SAM sweep: one click returns a hand-drawn letter exactly).

This module turns the seed mask into a glyph-accurate one. It is deliberately conservative: every SAM result is
clipped to a small dilation of the seed mask, and the refined mask is only used when its area stays within a band
of the seed area - otherwise the caller keeps the original. Opt-in (MIT_GLYPH_MASK=1) and fail-open.
"""
import os

import numpy as np

#: Weights are downloaded by ultralytics on first use; the file sits beside the other MIT weights.
DEFAULT_WEIGHTS = 'sam2.1_b.pt'
_MODELS = {}


def glyph_mask_enabled(env=None) -> bool:
    """MIT_GLYPH_MASK=1 turns the refinement on; unset/0 keeps today's textline mask."""
    value = str((env if env is not None else os.environ).get('MIT_GLYPH_MASK', '')).strip().lower()
    return value in ('1', 'true', 'yes', 'on')


def _weights_path(weights=None) -> str:
    if weights:
        return weights
    env = str(os.environ.get('MIT_SAM2_WEIGHTS', '') or '').strip()
    if env:
        return env
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    local = os.path.join(here, 'models', DEFAULT_WEIGHTS)
    return local if os.path.exists(local) else DEFAULT_WEIGHTS


def sample_points(mask, max_points: int = 96, min_component_area: int = 12):
    """Click points for SAM: the centroid of every connected component of the seed mask (pure, cv2 only).

    One point per component keeps the prompt count proportional to the number of letter clusters rather than to
    the number of pixels; tiny specks are skipped because they are noise, not lettering."""
    import cv2
    binary = (np.asarray(mask) > 0).astype(np.uint8)
    if binary.ndim != 2 or not binary.any():
        return []
    count, _labels, stats, centroids = cv2.connectedComponentsWithStats(binary, connectivity=8)
    points = []
    for i in range(1, count):
        if int(stats[i, cv2.CC_STAT_AREA]) < int(min_component_area):
            continue
        cx, cy = centroids[i]
        points.append((float(cx), float(cy)))
        if len(points) >= max_points:
            break
    return points


def _dilate(binary, px: int):
    import cv2
    if px <= 0:
        return binary
    k = np.ones((px * 2 + 1, px * 2 + 1), np.uint8)
    return cv2.dilate(binary.astype(np.uint8), k, iterations=1) > 0


def restrict_masks(masks, seed, grow_px: int = 4, dilate_px: int = 6):
    """Union of SAM masks, each grown by grow_px, clipped to a small dilation of the seed (uint8 0/255).

    SAM returns the fill of a stroke, not its anti-aliased outline, so a raw mask leaves letter edges behind
    (seen on the ch. 6 HUH: the English still showed under the Thai). Growing each mask before clipping covers the
    outline; clipping is what stops a prompt that landed on a character or a panel from deleting the page."""
    import cv2
    seed_bin = (np.asarray(seed) > 0).astype(np.uint8)
    if not seed_bin.any():
        return np.zeros(seed_bin.shape, dtype=np.uint8)
    allowed = _dilate(seed_bin, dilate_px)
    union = np.zeros(seed_bin.shape, dtype=np.uint8)
    for mask in masks or []:
        grown = _dilate(np.asarray(mask) > 0, grow_px)
        union |= ((grown & allowed)).astype(np.uint8)
    return (union * 255).astype(np.uint8)


def accept_refined(refined, seed, min_cover: float = 0.35, max_cover: float = 1.5) -> bool:
    """Whether a refined mask is a plausible replacement for the seed (pure).

    Too small means SAM missed lettering (stroke stubs would survive); too large means a prompt grabbed art. Both
    fall back to the seed."""
    seed_area = float((np.asarray(seed) > 0).sum())
    ref_area = float((np.asarray(refined) > 0).sum()) if refined is not None else 0.0
    if seed_area <= 0 or ref_area <= 0:
        return False
    return min_cover * seed_area <= ref_area <= max_cover * seed_area


def _load(weights, device):
    key = weights
    model = _MODELS.get(key)
    if model is None:
        from ultralytics import SAM
        model = SAM(weights)
        _MODELS[key] = model
    return model


def refine_with_sam2(seed_mask, img_rgb, device='cuda', weights=None, max_points: int = 96):
    """Seed mask + page -> glyph-accurate mask, or None when the result is not trustworthy.

    Raises on real failures (missing weights, no GPU) so the caller can log once and keep the seed."""
    points = sample_points(seed_mask, max_points=max_points)
    if not points:
        return None
    model = _load(_weights_path(weights), device)
    dev = 0 if str(device).startswith('cuda') else 'cpu'
    result = model(np.asarray(img_rgb), points=[[x, y] for x, y in points],
                   labels=[1] * len(points), device=dev, verbose=False)
    masks = []
    if result and getattr(result[0], 'masks', None) is not None:
        data = result[0].masks.data
        for i in range(int(data.shape[0])):
            masks.append(data[i].detach().cpu().numpy())
    import os as _os
    grow = int(_os.environ.get('MIT_GLYPH_MASK_GROW', '8') or 8)
    refined = restrict_masks(masks, seed_mask, grow_px=grow, dilate_px=grow + 2)
    return refined if accept_refined(refined, seed_mask) else None
