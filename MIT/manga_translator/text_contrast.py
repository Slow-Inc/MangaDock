"""Choose a readable text colour for a patch (#1143 follow-up): compare the ink colour with the pixels that were
actually painted underneath it, not with the OCR guess of the balloon colour.

Found in the inpainting comparison: Thai text drawn over dark hair came out dark-on-dark because the region colour
pair came from the lettering crop while the repaired patch behind it was the character hair. The rule is blunt -
when the ink and the painted background are too close in luma, switch to white or black (whichever contrasts
more) and give it the opposite stroke. Torch-free and pure so it unit-tests without the ML stack.
"""
import numpy as np

_LUMA = np.array([0.299, 0.587, 0.114], dtype=np.float32)


def luma(rgb) -> float:
    """Rec.601 luma of an RGB triple (pure)."""
    return float(np.dot(np.asarray(rgb, dtype=np.float32)[:3], _LUMA))


def background_luma(region_pixels) -> float:
    """Median luma of the pixels behind the text: the flat background, so a few ink pixels do not decide it (pure)."""
    if region_pixels is None:
        return 255.0
    px = np.asarray(region_pixels)
    if px.size == 0 or px.dtype == object:
        return 255.0
    if px.ndim == 3 and px.shape[2] >= 3:
        return float(np.median(px[:, :, :3].reshape(-1, 3).astype(np.float32) @ _LUMA))
    return float(np.median(px))


def readable_colors(fg_rgb, stroke_rgb, region_pixels, min_contrast: float = 45.0):
    """(fg, stroke) that stay readable on the painted pixels (pure).

    Unchanged when the ink already separates from the painted background; otherwise the ink becomes white on a
    dark background or black on a light one, and the stroke takes the opposite."""
    fg = tuple(int(v) for v in np.asarray(fg_rgb, dtype=np.int32)[:3])
    stroke = tuple(int(v) for v in np.asarray(stroke_rgb, dtype=np.int32)[:3])
    bg = background_luma(region_pixels)
    if abs(luma(fg) - bg) >= min_contrast:
        return fg, stroke
    if bg < 128:
        return (255, 255, 255), (0, 0, 0)
    return (0, 0, 0), (255, 255, 255)


def contrast_enabled(env=None) -> bool:
    """MIT_TEXT_CONTRAST=0 restores the OCR-derived colours verbatim; on by default."""
    import os
    value = str((env if env is not None else os.environ).get("MIT_TEXT_CONTRAST", "1")).strip().lower()
    return value not in ("0", "false", "no", "off")
