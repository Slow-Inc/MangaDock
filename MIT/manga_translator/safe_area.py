"""Safe-area interior box from a balloon mask (#179, PRD #178).

Ports MangaTranslator's distance-transform + pole-of-inaccessibility anchor
(image_utils.py:173-348): the largest centered axis-aligned box that fits the
mask's *safe interior* (so text wraps to the bubble's true shape, not its
bounding box), plus an anchor that avoids a conjoined balloon's narrow neck.

Dependency-light (cv2/numpy only, no ML/PIL) so it unit-tests with synthetic
masks in <1s.
"""
from typing import Tuple

import cv2
import numpy as np

Anchor = Tuple[float, float]


def _ray_len(inside: np.ndarray, x: int, y: int, dx: int, dy: int) -> int:
    """Number of consecutive inside pixels from (x,y) along (dx,dy), inclusive."""
    h, w = inside.shape
    d = 0
    while True:
        nx, ny = x + dx * (d + 1), y + dy * (d + 1)
        if nx < 0 or ny < 0 or nx >= w or ny >= h or inside[ny, nx] == 0:
            break
        d += 1
    return d + 1  # include the anchor pixel itself


def safe_area_box(mask: np.ndarray, padding: int = 5,
                  pole_threshold: float = 0.70) -> Tuple[int, int, Anchor]:
    """Largest centered box that fits the mask's safe interior.

    Returns ``(width, height, (anchor_x, anchor_y))``. ``mask`` is treated as
    binary (``>0`` = inside). Empty mask → ``(0, 0, (0, 0))``.

    Anchor = centroid of the safe area (``dist >= padding``); but if that
    centroid sits in a narrow neck (``dist(centroid) < pole_threshold * max``),
    fall back to the deepest pixel (pole of inaccessibility) so conjoined
    balloons don't center text in the join.
    """
    inside = (mask > 0).astype(np.uint8)
    if int(inside.sum()) == 0:
        return 0, 0, (0.0, 0.0)

    dist = cv2.distanceTransform(inside, cv2.DIST_L2, 5)
    max_dist = float(dist.max())

    safe = (dist >= padding).astype(np.uint8)
    moments = cv2.moments(safe if int(safe.sum()) > 0 else inside)
    if moments['m00'] > 0:
        cx, cy = moments['m10'] / moments['m00'], moments['m01'] / moments['m00']
    else:
        ys, xs = np.nonzero(inside)
        cx, cy = float(xs.mean()), float(ys.mean())

    icx = min(max(int(round(cx)), 0), dist.shape[1] - 1)
    icy = min(max(int(round(cy)), 0), dist.shape[0] - 1)
    if max_dist > 0 and dist[icy, icx] < pole_threshold * max_dist:
        ay, ax = np.unravel_index(int(dist.argmax()), dist.shape)
        cx, cy = float(ax), float(ay)

    ax, ay = int(round(cx)), int(round(cy))
    left = _ray_len(inside, ax, ay, -1, 0)
    right = _ray_len(inside, ax, ay, 1, 0)
    up = _ray_len(inside, ax, ay, 0, -1)
    down = _ray_len(inside, ax, ay, 0, 1)
    width = max(1, 2 * min(left, right) - 1)
    height = max(1, 2 * min(up, down) - 1)
    return width, height, (cx, cy)
