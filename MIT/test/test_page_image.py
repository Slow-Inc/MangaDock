"""#1141: the gateway translator sees the page it translates.

Blind A/B on 29 real pages (judge sees the image): image 163 vs text 97 votes, 19 vs 8 pages. The page image rides a
per-request contextvar so the concurrent pages of one worker cannot see each other's image.
"""
import asyncio
import base64
import io

import numpy as np
from PIL import Image

import manga_translator.page_image as pi


def _page(w=3000, h=2000):
    return np.full((h, w, 3), 200, np.uint8)


def test_on_by_default_and_env_turns_it_off():
    assert pi.page_image_enabled(env={}) is True
    for off in ('0', 'false', 'off', 'no'):
        assert pi.page_image_enabled(env={'MIT_TRANSLATE_PAGE_IMAGE': off}) is False


def test_no_scope_means_no_image():
    assert pi.current_page_image() is None


def test_scope_sets_and_resets_the_image():
    with pi.page_image_scope(_page(), env={}):
        assert pi.current_page_image() is not None
    assert pi.current_page_image() is None


def test_scope_is_empty_when_disabled_or_without_a_page():
    with pi.page_image_scope(_page(), env={'MIT_TRANSLATE_PAGE_IMAGE': '0'}):
        assert pi.current_page_image() is None
    with pi.page_image_scope(None, env={}):
        assert pi.current_page_image() is None


def test_image_is_a_jpeg_with_the_long_side_capped():
    with pi.page_image_scope(_page(), env={}):
        data = base64.b64decode(pi.current_page_image())
    im = Image.open(io.BytesIO(data))
    assert im.format == 'JPEG' and max(im.size) == pi.MAX_SIDE and im.size == (pi.MAX_SIDE, round(pi.MAX_SIDE * 2 / 3))


def test_image_is_encoded_once_per_scope(monkeypatch):
    calls = []
    real = pi._encode
    monkeypatch.setattr(pi, '_encode', lambda img: calls.append(1) or real(img))
    with pi.page_image_scope(_page(), env={}):
        pi.current_page_image(); pi.current_page_image()
    assert len(calls) == 1


def test_concurrent_requests_keep_their_own_page():
    async def request(shade):
        with pi.page_image_scope(np.full((40, 40, 3), shade, np.uint8), env={}):
            await asyncio.sleep(0.01)
            px = Image.open(io.BytesIO(base64.b64decode(pi.current_page_image()))).getpixel((5, 5))
            return abs(px[0] - shade) < 8

    async def both():
        return await asyncio.gather(request(30), request(220))
    assert asyncio.run(both()) == [True, True]


def test_content_blocks_for_each_protocol():
    anth = pi.with_page_image('<|1|>HI', 'QUJD', 'anthropic')
    assert anth[0] == {'type': 'image', 'source': {'type': 'base64', 'media_type': 'image/jpeg', 'data': 'QUJD'}}
    assert anth[1]['type'] == 'text' and anth[1]['text'].endswith('<|1|>HI')
    oai = pi.with_page_image('<|1|>HI', 'QUJD', 'openai')
    assert oai[0] == {'type': 'image_url', 'image_url': {'url': 'data:image/jpeg;base64,QUJD'}}
    assert oai[1]['text'].endswith('<|1|>HI')
