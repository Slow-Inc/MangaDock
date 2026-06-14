"""Pad an inpaint image to a multiple of 32 with an EXACT inverse (Flux Klein inpainter, #273).

Flux/diffusion needs side lengths that are multiples of 32. We pad (edge-replicate, bottom/right)
rather than resize, so the crop's real pixels are never resampled and the model output maps back to
the original crop byte-for-byte after `unpad` — that exactness is what lets the patch composite stay
byte-identical outside the erase mask. Pure numpy: no torch / diffusers.
"""
import numpy as np

from manga_translator.flux_image_prep import pad_to_multiple, unpad


def test_pads_up_to_next_multiple_of_32():
    img = np.zeros((50, 70, 3), dtype=np.uint8)
    padded, orig = pad_to_multiple(img, 32)
    assert padded.shape[0] % 32 == 0 and padded.shape[1] % 32 == 0
    assert padded.shape[:2] == (64, 96)               # 50->64, 70->96
    assert orig == (50, 70)


def test_unpad_round_trips_byte_exact():
    content = np.arange(50 * 70 * 3, dtype=np.uint8).reshape(50, 70, 3)
    padded, orig = pad_to_multiple(content, 32)
    back = unpad(padded, orig)
    assert back.shape == content.shape
    np.testing.assert_array_equal(back, content)      # no resampling — exact


def test_original_region_is_untouched_by_padding():
    img = np.random.RandomState(0).randint(0, 256, (33, 33, 3), dtype=np.uint8)
    padded, _ = pad_to_multiple(img, 32)
    assert padded.shape == (64, 64, 3)                # 33->64 on both sides
    np.testing.assert_array_equal(padded[:33, :33], img)   # top-left = original, pad only bottom/right


def test_already_a_multiple_is_a_noop():
    img = np.zeros((64, 32, 1), dtype=np.uint8)
    padded, orig = pad_to_multiple(img, 32)
    assert padded.shape[:2] == (64, 32)
    assert orig == (64, 32)
    np.testing.assert_array_equal(unpad(padded, orig), img)


def test_handles_2d_mask_and_custom_multiple():
    mask = np.ones((10, 20), dtype=np.uint8)
    padded, orig = pad_to_multiple(mask, 8)
    assert padded.shape == (16, 24)                   # 10->16, 20->24
    assert padded.ndim == 2
    np.testing.assert_array_equal(unpad(padded, orig), mask)
