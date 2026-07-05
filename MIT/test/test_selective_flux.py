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


# ---- #421 step 2: paste_flux_repair — mask-only feathered composite into full_inpainted ----

def test_paste_replaces_only_inside_mask():
    from manga_translator.selective_flux import paste_flux_repair
    h, w = 120, 120
    full = np.full((h, w, 3), 200, np.uint8)            # LaMa result (gray smear stand-in)
    box = (30, 30, 90, 90)
    flux_crop = np.full((60, 60, 3), 40, np.uint8)      # Flux reconstruction (dark hair)
    mask_crop = np.zeros((60, 60), np.uint8)
    mask_crop[10:50, 10:50] = 255                       # erase region within the crop
    out = paste_flux_repair(full, flux_crop, mask_crop, box, feather=0)
    # inside mask (global 40..80, 40..80) -> flux value; outside -> untouched LaMa
    assert out[50, 50, 0] == 40                         # inside mask -> flux
    assert out[35, 35, 0] == 200                        # inside box, outside mask -> LaMa
    assert out[10, 10, 0] == 200                        # outside box -> untouched
    assert full[50, 50, 0] == 200                       # input not mutated


def test_paste_grayscale_locks_flux_color_tint():
    # Flux Klein Q4 can tint a B/W page. On grayscale input the paste must stay neutral.
    from manga_translator.selective_flux import paste_flux_repair
    h, w = 80, 80
    full = np.full((h, w, 3), 200, np.uint8)            # neutral gray (R==G==B)
    box = (0, 0, 80, 80)
    flux_crop = np.zeros((80, 80, 3), np.uint8)
    flux_crop[..., 0] = 30; flux_crop[..., 1] = 60; flux_crop[..., 2] = 90  # color-tinted
    mask_crop = np.full((80, 80), 255, np.uint8)
    out = paste_flux_repair(full, flux_crop, mask_crop, box, feather=0, grayscale=True)
    px = out[40, 40]
    assert px[0] == px[1] == px[2]                      # neutral (no tint)
