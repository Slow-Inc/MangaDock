"""Patch PNG encoding must preserve the source page's ICC profile (#156).

Manga scans often embed non-sRGB profiles (e.g. "Dot Gain 20%"). The browser
color-manages the page through that curve, but renders an untagged patch as
sRGB — leaving every patch rectangle visibly darker than the page around it.
Pure-logic tests: PIL + numpy only, no ML imports.
"""
import io

import numpy as np
from PIL import Image

from manga_translator.utils.patch_png import encode_patch_png


def _arr():
    return np.full((8, 8, 3), 180, dtype=np.uint8)


def test_embeds_source_icc_profile_in_patch_png():
    icc = b"fake-dot-gain-20-profile-bytes"

    png = encode_patch_png(_arr(), icc_profile=icc)

    out = Image.open(io.BytesIO(png))
    assert out.info.get("icc_profile") == icc


def test_grayscale_profile_yields_grayscale_png_with_profile():
    """Real-world case (#156): manga scans are grayscale JPEGs tagged with a
    GRAY ICC profile ("Dot Gain 20%"). Browsers ignore a GRAY profile attached
    to an RGB image — the patch must be saved as grayscale so the profile is
    honored and the patch tones match the color-managed page."""
    import os
    with open(os.path.join(os.path.dirname(__file__), "testdata", "dotgain20.icc"), "rb") as f:
        icc = f.read()

    png = encode_patch_png(_arr(), icc_profile=icc)

    out = Image.open(io.BytesIO(png))
    assert out.mode == "L"
    assert out.info.get("icc_profile") == icc
    assert np.array(out)[0, 0] == 180  # raw values untouched


def test_no_profile_when_source_has_none():
    png = encode_patch_png(_arr(), icc_profile=None)

    out = Image.open(io.BytesIO(png))
    assert out.info.get("icc_profile") is None
    assert np.array_equal(np.array(out), _arr())
