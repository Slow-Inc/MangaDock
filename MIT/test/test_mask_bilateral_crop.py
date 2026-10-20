"""#822: complete_mask bilateral-filtered the whole (resized) page, ~0.6 s, but only reads the
filtered image inside each textline's rect. Filtering each rect with an 8 px margin (the filter's
radius at d=17) gives the same pixels there — identical output, a fraction of the work."""
import cv2
import numpy as np

from manga_translator.mask_refinement.text_mask_utils import bilateral_region


def test_a_filtered_region_equals_the_same_region_of_the_filtered_page():
    rng = np.random.default_rng(7)
    img = rng.integers(0, 256, size=(300, 420, 3), dtype=np.uint8)
    full = cv2.bilateralFilter(img, 17, 80, 80)
    for (x, y, w, h) in [(50, 60, 120, 40), (0, 0, 30, 30), (400, 280, 20, 20), (200, 0, 220, 300)]:
        assert np.array_equal(bilateral_region(img, x, y, w, h), full[y:y + h, x:x + w]), (x, y, w, h)
