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


# ---- #421 step 3: apply_selective_flux_repair — orchestration (Flux injected, no GPU) ----
import asyncio


def test_orchestrator_repairs_textured_box_via_injected_flux():
    from manga_translator.selective_flux import apply_selective_flux_repair
    h, w = 200, 200
    img = np.stack([_textured(h, w, 0)] * 3, axis=-1)   # textured (routes)
    mask = np.zeros((h, w), np.uint8); mask[95:105, 60:140] = 255
    full = np.full((h, w, 3), 200, np.uint8)            # LaMa smear stand-in

    calls = []
    async def fake_flux(crop, mcrop):
        calls.append(crop.shape)
        return np.zeros_like(crop)                      # Flux "reconstructs" dark

    out, n = asyncio.run(apply_selective_flux_repair(full, img, mask, mask.copy(), fake_flux))
    assert n == 1 and len(calls) == 1                   # one crop sent to Flux
    # inside mask -> mostly flux (dark); feathered paste won't be exactly 0
    assert out[100, 100, 0] < 30                        # ~flux, far from LaMa's 200


def test_orchestrator_fails_open_when_flux_raises():
    from manga_translator.selective_flux import apply_selective_flux_repair
    h, w = 200, 200
    img = np.stack([_textured(h, w, 0)] * 3, axis=-1)
    mask = np.zeros((h, w), np.uint8); mask[95:105, 60:140] = 255
    full = np.full((h, w, 3), 200, np.uint8)
    async def boom(crop, mcrop):
        raise RuntimeError("CUDA OOM")
    out, n = asyncio.run(apply_selective_flux_repair(full, img, mask, mask.copy(), boom))
    assert n == 0                                       # no repairs applied
    assert np.array_equal(out, full)                    # fail-open: LaMa result stands


def test_skips_flat_bubble_with_thin_dark_border():
    # The real Otome over-route class: dialogue in a WHITE bubble whose ring clips a thin
    # dark border. Ring has SOME dark px but the surround is mostly paper — must NOT route
    # (dark_frac below the gate). Hair, by contrast, is a mostly-dark textured surround.
    from manga_translator.selective_flux import find_text_over_art_boxes
    h, w = 200, 200
    img = np.full((h, w, 3), 245, np.uint8)             # white bubble interior
    img[:, 40:44] = 20                                  # a thin dark bubble border (left)
    mask = np.zeros((h, w), np.uint8)
    mask[95:105, 90:150] = 255                          # dialogue text, away from border
    boxes = find_text_over_art_boxes(mask, img, mask.copy())
    assert boxes == []                                  # mostly-paper ring -> skip


def test_skips_solid_dark_border_in_ring_routes_textured_dark_hair():
    # The real precision/recall fix (v2): ring dark_frac alone can't separate a solid
    # dark BORDER (uniform dark line — LaMa fills it fine) from HAIR (dark + textured —
    # LaMa smears). Gate on the VARIANCE of the dark ring pixels: uniform border -> skip,
    # noisy hair -> route. Both have high dark_frac, so v1 (dark_frac only) mis-routes the
    # border.
    from manga_translator.selective_flux import find_text_over_art_boxes
    h, w = 200, 200
    rng = np.random.RandomState(7)

    # (a) BORDER: white paper + a solid uniform dark bar crossing the text's ring
    img_b = np.full((h, w, 3), 245, np.uint8)
    img_b[85:150, :] = 20                                # solid dark bar (uniform ~20)
    mask = np.zeros((h, w), np.uint8); mask[95:105, 60:140] = 255
    assert find_text_over_art_boxes(mask, img_b, mask.copy()) == []   # uniform -> skip

    # (b) HAIR: dark textured strands (values 0..90 noisy) around the same text
    img_h = np.full((h, w, 3), 245, np.uint8)
    hair = (rng.rand(65, w) * 90).astype(np.uint8)      # dark AND high-variance
    img_h[85:150, :] = np.stack([hair] * 3, axis=-1)
    assert len(find_text_over_art_boxes(mask, img_h, mask.copy())) == 1   # textured -> route


def test_dark_frac_boundary_matches_real_page_distribution():
    # Calibrated to REAL captured masks (docs/reports/benchmarks/2026-07-05-421-*): the
    # One-Punch hair ring measures dark_frac ~0.20 (route); every Otome ds9 dialogue ring
    # measures <=0.11 (skip). The gap puts the boundary at 0.15 — locks against a regression
    # back to 0.05 (over-routes flat) or 0.25 (under-repairs hair).
    from manga_translator.selective_flux import find_text_over_art_boxes
    h, w = 200, 200
    mask = np.zeros((h, w), np.uint8); mask[95:105, 60:140] = 255
    for frac, expect in [(0.22, 1), (0.10, 0)]:
        rng = np.random.RandomState(11)
        img = np.full((h, w), 210, np.uint8)            # bright surround
        dark = rng.rand(h, w) < frac
        img[dark] = (rng.rand(h, w)[dark] * 80).astype(np.uint8)  # dark-textured fraction
        img3 = np.stack([img] * 3, axis=-1)
        assert len(find_text_over_art_boxes(mask, img3, mask.copy())) == expect
