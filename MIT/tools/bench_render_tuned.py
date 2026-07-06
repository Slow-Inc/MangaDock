"""Render One-Punch on landing with the FULL tuned config (Backend/.env 2026-07-04).

Produces the 'best-quality' reference image the user tuned yesterday: clean_layout +
bubble_area_fit + protect_figures + restrict_fullpage_mask + full_page_inpaint +
sfx_detector + supersampling4 + uppercase + comic-font + anti_overlap, KP OFF, Flux OFF.
Saves the final rendered page (translation is non-deterministic — this is ONE reference
render, not an A/B).

    <main-venv>/python.exe tools/bench_render_tuned.py <page.jpg> <out.png>
"""
import asyncio
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
MIT = os.path.dirname(HERE)
sys.path.insert(0, MIT)

from manga_translator import MangaTranslator, Config, logger  # noqa: E402

# The tuned config = Backend/.env (render_version landing-2026-07-04), set directly.
TUNED = {
    "translator": {"target_lang": "ENG"},
    "detector": {"detection_size": 2560, "det_bubble_seg": True, "det_sfx": True},
    "ocr": {"prob": 0.03, "vlm_rescue": True},
    "inpainter": {
        "inpainter": "lama_large", "inpainting_size": 2048, "inpainting_precision": "bf16",
        "inpaint_context_pad": 256, "full_page_inpaint": True,
        "protect_figures": True, "restrict_fullpage_mask": True, "selective_flux": False,
    },
    "render": {
        "direction": "auto", "rtl": False, "bubble_area_fit": True, "anti_overlap": True,
        "font_size_max": 20, "clean_layout": True, "knuth_plass": False,
        "en_comic_font": True, "supersampling": 4, "uppercase": True,
        "en_font": "anime_ace_3.ttf", "patch_feather_radius": 16,
    },
}


async def main():
    page = sys.argv[1]
    out = sys.argv[2]
    font = os.path.normpath(os.path.join(MIT, "fonts", "Prompt-Bold.ttf"))
    tr = MangaTranslator({"use_gpu": True, "verbose": False, "kernel_size": 3, "model_dir": r"D:/Github/MangaDock/MIT/models",
                          "font_path": font if os.path.isfile(font) else None})
    img = Image.open(page).convert("RGB")
    ctx = await tr.translate(img, Config(**TUNED), skip_context_save=True)
    rendered = getattr(ctx, "img_rendered", None)
    if rendered is None:
        logger.error("no img_rendered")
        return
    Image.fromarray(rendered).convert("RGB").save(out)
    n = len(ctx.text_regions) if ctx.text_regions else 0
    print(f"[bench_render_tuned] {n} regions -> {out}")


if __name__ == "__main__":
    asyncio.run(main())
