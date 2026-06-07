"""PNG encoding for translated patches.

Patches must carry the source page's ICC profile: manga scans often embed
non-sRGB profiles (e.g. "Dot Gain 20%"). The browser color-manages the page
through that curve but renders an untagged patch as plain sRGB, leaving every
patch rectangle visibly darker than the page around it (#156 investigation,
2026-06-07). Import-light (PIL/io only) so it unit-tests without the ML stack.
"""
import io

from PIL import Image


def _profile_color_space(icc_profile: bytes):
    try:
        from PIL import ImageCms
        return ImageCms.ImageCmsProfile(io.BytesIO(icc_profile)).profile.xcolor_space.strip()
    except Exception:
        return None


def encode_patch_png(img_array, icc_profile=None, compress_level: int = 1) -> bytes:
    """Encode a rendered patch (HxWx3 uint8 array) as PNG.

    compress_level=1 is ~10x faster than optimize=True with ~15% larger
    files — the right trade-off for interactive translation.

    Browsers only honor an embedded profile whose color space matches the
    image: a GRAY profile (the common manga-scan case) on an RGB PNG is
    silently ignored, so the patch is saved as grayscale in that case.
    """
    img = Image.fromarray(img_array)
    kwargs = {}
    if icc_profile:
        kwargs['icc_profile'] = icc_profile
        if _profile_color_space(icc_profile) == 'GRAY':
            img = img.convert('L')
    buf = io.BytesIO()
    img.save(buf, format='PNG', compress_level=compress_level, **kwargs)
    return buf.getvalue()
