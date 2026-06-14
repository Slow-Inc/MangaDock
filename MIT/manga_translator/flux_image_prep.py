"""Pad an image to a multiple of 32 with an exact inverse (Flux Klein inpainter, ADR 003 / #273).

Flux/diffusion requires side lengths divisible by 32. We PAD (edge-replicate on the bottom/right)
rather than resize, so the inpaint crop's pixels are never resampled: the model output crops back to
the original size byte-for-byte via :func:`unpad`, which is what keeps the patch composite byte-identical
outside the erase mask. Pure numpy — no torch / diffusers — so the geometry unit-tests without a GPU.
"""
import numpy as np


def pad_to_multiple(img: np.ndarray, multiple: int = 32):
    """Pad ``img`` (HxW or HxWxC) so H and W are multiples of ``multiple``.

    Padding is edge-replicated on the bottom and right only, so the original top-left region is
    untouched. Returns ``(padded, (orig_h, orig_w))``; pass that pair to :func:`unpad` to recover the
    exact original pixels.
    """
    h, w = img.shape[:2]
    new_h = -(-h // multiple) * multiple   # ceil-divide up to the next multiple
    new_w = -(-w // multiple) * multiple
    if new_h == h and new_w == w:
        return img, (h, w)
    pads = [(0, new_h - h), (0, new_w - w)] + [(0, 0)] * (img.ndim - 2)
    return np.pad(img, pads, mode="edge"), (h, w)


def unpad(img: np.ndarray, orig_hw) -> np.ndarray:
    """Crop a padded image back to ``orig_hw = (orig_h, orig_w)`` — the exact inverse of the pad."""
    h, w = orig_hw
    return img[:h, :w]
