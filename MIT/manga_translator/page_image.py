"""The page image for the gateway translator (#1141), torch-free.

The translator used to receive only the OCR text, so it chose pronouns and particles blind and translated OCR slips
as written. On 29 real pages, a blind A/B judged with the image preferred the request that carries the page image
163 to 97 votes (19 pages to 8): male speakers got ผม/ครับ, and `HAIMIYAT -SENPAIS RINE` came back as ไลน์ของรุ่นพี่ไฮมิยะ.

The image rides a contextvar set around one page's translation, so the pages a worker runs at once (#1123 slots)
each send their own. It is encoded once per page, lazily, as a JPEG whose long side is capped at ``MAX_SIDE``.
``MIT_TRANSLATE_PAGE_IMAGE=0`` turns it off.
"""
import base64
import contextlib
import contextvars
import io
import os

MAX_SIDE = 1568  # Anthropic's recommended long side; larger images are downscaled server-side anyway
NOTE = ("The page image is attached. Use it only to understand who is speaking to whom, their expressions and what "
        "each line refers to. Translate only the numbered segments below, with the same output rules.\n\n")

_page = contextvars.ContextVar("mit_page_image", default=None)


def page_image_enabled(env=None) -> bool:
    value = str((env if env is not None else os.environ).get('MIT_TRANSLATE_PAGE_IMAGE', '')).strip().lower()
    return value not in ('0', 'false', 'no', 'off')


def _encode(img_rgb) -> str:
    from PIL import Image
    im = Image.fromarray(img_rgb).convert('RGB')
    im.thumbnail((MAX_SIDE, MAX_SIDE))
    buf = io.BytesIO()
    im.save(buf, 'JPEG', quality=85)
    return base64.b64encode(buf.getvalue()).decode()


@contextlib.contextmanager
def page_image_scope(img_rgb, env=None):
    """Make ``img_rgb`` (H x W x 3 uint8) the page the translator sees while the block runs."""
    slot = {'img': img_rgb, 'b64': None} if img_rgb is not None and page_image_enabled(env) else None
    token = _page.set(slot)
    try:
        yield
    finally:
        _page.reset(token)


def current_page_image():
    """This page's image as base64 JPEG, or None outside a scope / when disabled."""
    slot = _page.get()
    if slot is None:
        return None
    if slot['b64'] is None:
        slot['b64'] = _encode(slot['img'])
    return slot['b64']


def with_page_image(text: str, b64: str, protocol: str) -> list:
    """The user content for ``text`` with the page image in front, in the given protocol's shape."""
    if protocol == 'anthropic':
        image = {'type': 'image', 'source': {'type': 'base64', 'media_type': 'image/jpeg', 'data': b64}}
    else:
        image = {'type': 'image_url', 'image_url': {'url': 'data:image/jpeg;base64,' + b64}}
    return [image, {'type': 'text', 'text': NOTE + text}]
