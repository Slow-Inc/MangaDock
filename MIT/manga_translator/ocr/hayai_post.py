"""Pure helpers for the Hayai OCR adapter (#1143 Track C). Stdlib + numpy only, so they unit-test torch-free.

The 48 px recogniser predicts a colour per glyph; Hayai returns text only, while the renderer still needs a
foreground/background pair for the region. These helpers derive that pair from the crop itself.
"""
import numpy as np

_LUMA = np.array([0.299, 0.587, 0.114], dtype=np.float32)


def colors_from_crop(crop_rgb):
    """(fg, bg) RGB tuples for a lettering crop: the ink colour and the balloon colour.

    The crop is split on luma into two clusters; the dominant cluster is the balloon and the other is the ink -
    so black-on-white lettering gives fg (0, 0, 0) / bg (255, 255, 255) and white-on-black lettering the
    reverse, whether the ink covers 5 % of the crop or half of it. A crop with no usable contrast (an empty or
    flat crop) falls back to black on white. Pure."""
    if crop_rgb is None or getattr(crop_rgb, 'size', 0) == 0:
        return (0, 0, 0), (255, 255, 255)
    px = np.asarray(crop_rgb, dtype=np.float32).reshape(-1, 3)
    luma = px @ _LUMA
    lo, hi = float(luma.min()), float(luma.max())
    if hi - lo < 24:                              # flat crop: nothing to separate
        return (0, 0, 0), (255, 255, 255)
    # 1-D two-means on luma: works whether the ink is 5 % of the crop or half of it.
    thr = (lo + hi) / 2.0
    ink = luma <= thr
    for _ in range(8):
        if not ink.any() or ink.all():
            break
        thr = (float(luma[ink].mean()) + float(luma[~ink].mean())) / 2.0
        nxt = luma <= thr
        if np.array_equal(nxt, ink):
            break
        ink = nxt
    if not ink.any() or ink.all():
        return (0, 0, 0), (255, 255, 255)
    dark, light = px[ink].mean(axis=0), px[~ink].mean(axis=0)
    # the dominant side is the balloon, the other side is the ink
    fg, bg = (light, dark) if ink.mean() > 0.5 else (dark, light)
    return tuple(int(round(float(v))) for v in fg), tuple(int(round(float(v))) for v in bg)


def clean_text(text) -> str:
    """The model's answer as one line: strip whitespace runs and empty answers. Pure."""
    return ' '.join(str(text or '').split())
