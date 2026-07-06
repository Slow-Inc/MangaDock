"""Deterministic KP render replay (#545 regression reproduction).

Loads a pre-render fixture (from tools/bench_dump.py) and replays ONLY the render
stage twice on main's code — knuth_plass OFF (baseline) vs ON (global) — measuring
each region's post-render font size and producing a real-render montage. No ML, no
worker, no network: the upstream translate was frozen in the fixture, so any pixel
difference is 100% the line-breaker knob. Reproduces the documented narration
"oversize" regression that got MIT_KNUTH_PLASS rolled back (deploy 0111c229 / #545).

    <main-venv>/python.exe tools/bench_replay_kp.py <fixture.pkl> <out_dir>
"""
import asyncio
import copy
import os
import pickle
import sys
from types import SimpleNamespace

import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
MIT = os.path.dirname(HERE)
sys.path.insert(0, MIT)

from manga_translator import Config  # noqa: E402
from manga_translator.stages import run_text_rendering  # noqa: E402


def build_config(knuth_plass: bool) -> Config:
    return Config(**{
        "translator": {"target_lang": "ENG"},
        "render": {"direction": "auto", "rtl": False, "bubble_area_fit": True,
                   "supersampling": 4, "uppercase": True, "en_comic_font": True,
                   "anti_overlap": True, "clean_layout": True, "font_size_max": 20,
                   "knuth_plass": knuth_plass},
    })


def font_path() -> str:
    return os.path.join(MIT, "fonts", "anime_ace_3.ttf")


async def render_variant(fixture, knuth_plass: bool):
    """Deep-copy regions (sizing mutates them), render, return (image, per-region font sizes)."""
    regions = copy.deepcopy(fixture["text_regions"])
    ctx = SimpleNamespace(
        img_inpainted=fixture["img_inpainted"].copy(),
        img_rgb=fixture["img_rgb"],
        text_regions=regions,
        render_mask=None,
        page_shape=fixture.get("page_shape"),
    )
    out = await run_text_rendering(build_config(knuth_plass), ctx, font_path())
    sizes = [int(getattr(r, "font_size", 0) or 0) for r in regions]
    return np.asarray(out), sizes, regions


def label(img: np.ndarray, text: str) -> Image.Image:
    im = Image.fromarray(img).convert("RGB")
    d = ImageDraw.Draw(im)
    try:
        f = ImageFont.truetype(os.path.join(MIT, "fonts", "anime_ace_3.ttf"), 26)
    except Exception:
        f = ImageFont.load_default()
    d.rectangle([0, 0, im.width, 34], fill=(0, 0, 0))
    d.text((8, 4), text, fill=(255, 255, 0), font=f)
    return im


async def main():
    fixture = pickle.load(open(sys.argv[1], "rb"))
    out_dir = sys.argv[2]
    os.makedirs(out_dir, exist_ok=True)

    off_img, off_sizes, off_regs = await render_variant(fixture, knuth_plass=False)
    on_img, on_sizes, on_regs = await render_variant(fixture, knuth_plass=True)

    orig = fixture["img_rgb"]
    Image.fromarray(off_img).save(os.path.join(out_dir, "kp_off.png"))
    Image.fromarray(on_img).save(os.path.join(out_dir, "kp_on.png"))

    # side-by-side montage: [ original | KP off | KP on ]
    panels = [label(orig, "ORIGINAL (JA)"), label(off_img, "KP OFF (baseline)"),
              label(on_img, "KP ON (global)")]
    h = max(p.height for p in panels)
    montage = Image.new("RGB", (sum(p.width for p in panels) + 20, h), (40, 40, 40))
    x = 0
    for p in panels:
        montage.paste(p, (x, 0))
        x += p.width + 10
    montage.save(os.path.join(out_dir, "kp_545_montage.png"))

    # scorecard: font-size delta per region (bloat = ON >> OFF ⇒ oversize regression)
    print("region | src_txt                         | fs_off | fs_on | delta | ratio")
    print("-------|---------------------------------|--------|-------|-------|------")
    worst = 0.0
    for i, r in enumerate(off_regs):
        tr = (getattr(r, "translation", "") or "")[:31]
        fo, fn = off_sizes[i], on_sizes[i]
        ratio = (fn / fo) if fo else 0.0
        worst = max(worst, ratio)
        flag = "  <== BLOAT" if ratio >= 1.25 else ""
        print(f"  [{i}] | {tr:<31} | {fo:>6} | {fn:>5} | {fn-fo:>+5} | {ratio:>4.2f}{flag}")
    print(f"\nworst fs ratio (ON/OFF): {worst:.2f}  "
          f"({'REGRESSION reproduced' if worst >= 1.25 else 'no inflation'})")
    print(f"montage: {os.path.join(out_dir, 'kp_545_montage.png')}")


if __name__ == "__main__":
    asyncio.run(main())
