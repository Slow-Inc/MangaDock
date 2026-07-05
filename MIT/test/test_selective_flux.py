"""#421 selective-Flux routing — the pure discriminator that decides which erase-mask
components sit over TEXTURED art (LaMa smears them) vs flat background (LaMa is fine)."""
import numpy as np


def _textured(h, w, seed):
    rng = np.random.RandomState(seed)
    return (rng.rand(h, w) * 255).astype(np.uint8)


def test_routes_a_component_over_textured_background():
    from manga_translator.selective_flux import find_text_over_art_boxes
    h, w = 200, 200
    img = np.stack([_textured(h, w, 0)] * 3, axis=-1)   # high-frequency (hair-like) bg
    mask = np.zeros((h, w), np.uint8)
    mask[95:105, 60:140] = 255                          # a text stroke sitting on it
    text_only = mask.copy()
    boxes = find_text_over_art_boxes(mask, img, text_only)
    assert len(boxes) == 1
    x1, y1, x2, y2 = boxes[0]
    assert x1 <= 60 and y1 <= 95 and x2 >= 140 and y2 >= 105   # box covers the stroke


def test_skips_a_component_over_flat_background():
    from manga_translator.selective_flux import find_text_over_art_boxes
    h, w = 200, 200
    img = np.full((h, w, 3), 245, np.uint8)             # flat paper (a speech bubble)
    mask = np.zeros((h, w), np.uint8)
    mask[95:105, 60:140] = 255                          # dialogue text on flat bg
    text_only = mask.copy()
    boxes = find_text_over_art_boxes(mask, img, text_only)
    assert boxes == []                                  # LaMa handles flat fine — no Flux


def test_merges_nearby_textured_components_into_one_box():
    from manga_translator.selective_flux import find_text_over_art_boxes
    h, w = 200, 300
    img = np.stack([_textured(h, w, 1)] * 3, axis=-1)   # textured everywhere
    mask = np.zeros((h, w), np.uint8)
    mask[95:105, 40:90] = 255                           # component A
    mask[95:105, 110:160] = 255                         # component B, ~20px away (< pad*2)
    text_only = mask.copy()
    boxes = find_text_over_art_boxes(mask, img, text_only, pad=24)
    assert len(boxes) == 1                              # merged (padded boxes overlap)
    x1, y1, x2, y2 = boxes[0]
    assert x1 <= 40 and x2 >= 160                       # spans both


def test_skips_high_variance_but_light_texture_no_dark_art():
    # High std-dev alone over-routes (JPEG noise, light screentone, panel haze). Real
    # art that LaMa smears — hair — has DARK ink strokes. A bright noisy ring (min 150,
    # no dark ink) is not art and must NOT be routed even though its std is high.
    from manga_translator.selective_flux import find_text_over_art_boxes
    h, w = 200, 200
    rng = np.random.RandomState(3)
    img = np.stack([(150 + rng.rand(h, w) * 105).astype(np.uint8)] * 3, axis=-1)  # std~30, no dark
    mask = np.zeros((h, w), np.uint8)
    mask[95:105, 60:140] = 255
    boxes = find_text_over_art_boxes(mask, img, mask.copy())
    assert boxes == []
