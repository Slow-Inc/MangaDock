"""#626 deterministic render A/B driver — render the SAME dump (fixed inpaint + regions =
fixed translation) with whatever manga_translator is on PYTHONPATH, composite onto a page
canvas built from the inpainted patches. Run twice (reconciled vs landing PYTHONPATH), then
diff. No GPU, no LLM/OCR jitter — isolates the RENDER code.

Usage: PYTHONPATH=<mit> python _reconcile_render_ab.py <dump_dir> <out_png>
"""
import sys, glob, pickle, asyncio
import numpy as np
from PIL import Image

DUMP, OUT = sys.argv[1], sys.argv[2]
FONT = 'D:/Github/MangaDock/MIT/fonts/Prompt-Bold.ttf'


async def render_page():
    from manga_translator.rendering import dispatch
    pkls = sorted(glob.glob(f'{DUMP}/r_*.pkl'))
    # page canvas from the first patch's page_shape
    d0 = pickle.load(open(pkls[0], 'rb'))
    ph = d0.get('page_shape')  # (H, W)
    H, W = (int(ph[0]), int(ph[1])) if ph else (int(d0['img_h']), int(d0['img_w']))
    page = np.full((H, W, 3), 235, dtype=np.uint8)  # light-grey canvas
    for p in pkls:
        d = pickle.load(open(p, 'rb'))
        inpainted = np.ascontiguousarray(d['inpainted'].copy())
        regions = d['regions']
        x1, y1 = int(d['x1']), int(d['y1'])
        # match the tuned prod render knobs (Backend/.env landing-2026-07-04); reference_layout
        # defaults OFF so reconciled and landing take the same bubble-fit spine path.
        kw = dict(font_size_minimum=-1, bubble_fit=True, supersampling=4, anti_overlap=True,
                  font_size_max=20, clean_layout=True, page_shape=d.get('page_shape'))
        out = await dispatch(inpainted, regions, FONT, render_mask=None, **kw)
        oh, ow = out.shape[:2]
        yh, xw = min(y1 + oh, H), min(x1 + ow, W)
        page[y1:yh, x1:xw] = out[:yh - y1, :xw - x1]
    return page


async def main():
    page = await render_page()
    Image.fromarray(page).save(OUT)
    print(f'saved {OUT} {page.shape}')


asyncio.run(main())
