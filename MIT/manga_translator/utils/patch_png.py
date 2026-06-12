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


def encode_patch_png(img_array, icc_profile=None, compress_level: int = 1, alpha=None) -> bytes:
    """Encode a rendered patch (HxWx3 uint8 array) as PNG.

    compress_level=1 is ~10x faster than optimize=True with ~15% larger
    files — the right trade-off for interactive translation.

    Browsers only honor an embedded profile whose color space matches the
    image: a GRAY profile (the common manga-scan case) on an RGB PNG is
    silently ignored, so the patch is saved as grayscale in that case.

    `alpha` (#173): an optional HxW uint8 feather mask. When given, the patch is
    encoded with that alpha so the Reader's transparent overlay blends the soft
    edge into the page (no rectangular seam). A GRAY profile is honored only on a
    grayscale image, so a feathered patch on a GRAY-tagged page is saved as mode
    'LA' (grayscale + alpha) to keep #156 color-management; otherwise 'RGBA'.
    Absent → byte-identical to the un-feathered patch.
    """
    img = Image.fromarray(img_array)
    kwargs = {}
    is_gray_icc = bool(icc_profile) and _profile_color_space(icc_profile) == 'GRAY'

    if alpha is not None:
        alpha_img = Image.fromarray(alpha)
        if alpha_img.mode != 'L':
            alpha_img = alpha_img.convert('L')
        if is_gray_icc:
            img = img.convert('L')          # → 'LA' after putalpha: GRAY profile stays valid
            kwargs['icc_profile'] = icc_profile
        else:
            img = img.convert('RGB')        # → 'RGBA' after putalpha
            if icc_profile:
                kwargs['icc_profile'] = icc_profile
        img.putalpha(alpha_img)
    elif icc_profile:
        kwargs['icc_profile'] = icc_profile
        if is_gray_icc:
            img = img.convert('L')

    buf = io.BytesIO()
    img.save(buf, format='PNG', compress_level=compress_level, **kwargs)
    return buf.getvalue()
