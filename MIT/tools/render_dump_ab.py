"""DETERMINISTIC offline real-page A/B: load the render dump (fixed inpainted bg + regions
= fixed translation), re-render the SAME regions with two render configs, composite onto the
original page. Only the render knob differs → clean before/after, no LLM/OCR jitter.

Usage: render_dump_ab.py <dump_dir> <src_page> <out_png> <knobA=val,..> <knobB=val,..> <labelA> <labelB>
"""
import sys, glob, pickle, asyncio
sys.path.insert(0, 'D:/Github/MangaDock/MIT')
import numpy as np
from PIL import Image, ImageDraw, ImageFont

DUMP, SRC, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
KNOBS_A = dict(kv.split('=') for kv in sys.argv[4].split(',')) if sys.argv[4] else {}
KNOBS_B = dict(kv.split('=') for kv in sys.argv[5].split(',')) if sys.argv[5] else {}
LABEL_A, LABEL_B = sys.argv[6], sys.argv[7]
FONT = 'D:/Github/MangaDock/MIT/fonts/Prompt-Bold.ttf'


def _coerce(v):
    if v in ('True', 'true'):
        return True
    if v in ('False', 'false'):
        return False
    try:
        return int(v)
    except ValueError:
        return v


async def render_config(knobs):
    """Render every dumped patch with the given render knobs; composite onto the page. Regions are
    reloaded per call (dispatch mutates font_size), so the two configs start from identical state."""
    from manga_translator.rendering import dispatch
    base = np.array(Image.open(SRC).convert('RGB'))
    H, W = base.shape[:2]
    pkls = sorted(glob.glob(f'{DUMP}/r_*.pkl'))
    for p in pkls:
        with open(p, 'rb') as f:
            d = pickle.load(f)
        inpainted = np.ascontiguousarray(d['inpainted'].copy())
        regions = d['regions']
        x1, y1 = int(d['x1']), int(d['y1'])
        kw = dict(font_size_minimum=-1, bubble_fit=True, supersampling=4, anti_overlap=True,
                  font_size_max=20, clean_layout=True,
                  page_shape=d.get('page_shape'))
        kw.update({k: _coerce(v) for k, v in knobs.items()})
        out = await dispatch(inpainted, regions, FONT, render_mask=None, **kw)
        oh, ow = out.shape[:2]
        yh, xw = min(y1 + oh, H), min(x1 + ow, W)
        base[y1:yh, x1:xw] = out[:yh - y1, :xw - x1]
    return base


async def main():
    a = await render_config(KNOBS_A)
    b = await render_config(KNOBS_B)
    imgA, imgB = Image.fromarray(a), Image.fromarray(b)
    W, Hh = imgA.size
    lab = 46
    canvas = Image.new('RGB', (W * 2 + 30, Hh + lab), 'white')
    canvas.paste(imgA, (0, lab))
    canvas.paste(imgB, (W + 30, lab))
    dr = ImageDraw.Draw(canvas)
    try:
        fnt = ImageFont.truetype(FONT, 30)
    except Exception:
        fnt = ImageFont.load_default()
    dr.text((10, 8), LABEL_A, fill='#d64545', font=fnt)
    dr.text((W + 40, 8), LABEL_B, fill='#2e9e5b', font=fnt)
    canvas.save(OUT, quality=92)
    print('WROTE', OUT, canvas.size, '| patches:', len(glob.glob(f'{DUMP}/r_*.pkl')))


asyncio.run(main())
