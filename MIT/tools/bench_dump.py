"""Deterministic render-fixture dump (in-process, no worker).

Runs the REAL pipeline once on a page and pickles the pre-render Context state
(img_inpainted + img_rgb + text_regions + page_shape) right before rendering, so
the non-deterministic upstream (OCR-VLM / API translate) is captured ONCE and the
render stage can then be replayed deterministically under different knobs/code.

    .venv/Scripts/python.exe tools/bench_dump.py <page.jpg> <out.pkl> [ENG|THA|...]

Prod-faithful config mirrors what the Backend sends (clean_layout + bubble_area_fit
+ det_sfx + vlm_rescue + lama_large full-page). Same-tree dump→replay ⇒ the pickled
TextBlock class is identical on replay, so no cross-branch unpickle risk.
"""
import asyncio
import os
import pickle
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
MIT = os.path.dirname(HERE)
sys.path.insert(0, MIT)

from manga_translator import MangaTranslator, Config  # noqa: E402
from manga_translator import logger  # noqa: E402


def build_config(target_lang: str) -> Config:
    """Prod render-parity config (matches Backend buildMitConfig + ab_clean/ab_lang)."""
    return Config(**{
        "translator": {"target_lang": target_lang},
        "detector": {"detection_size": 2560, "det_bubble_seg": True, "det_sfx": True},
        "ocr": {"prob": 0.03, "vlm_rescue": True},
        "inpainter": {"inpainter": "lama_large", "inpainting_size": 2048,
                      "inpainting_precision": "bf16", "full_page_inpaint": True},
        "render": {"direction": "auto", "rtl": False, "bubble_area_fit": True,
                   "supersampling": 4, "uppercase": True, "en_comic_font": True,
                   "anti_overlap": True, "clean_layout": True, "font_size_max": 20},
    })


class DumpingTranslator(MangaTranslator):
    """Intercept the render stage: pickle the pre-render fixture, then render normally."""

    dump_path = None

    async def _run_text_rendering(self, config, ctx):
        fixture = {
            "img_inpainted": ctx.img_inpainted,
            "img_rgb": ctx.img_rgb,
            "text_regions": ctx.text_regions,
            "page_shape": getattr(ctx, "page_shape", None),
        }
        with open(self.dump_path, "wb") as f:
            pickle.dump(fixture, f)
        logger.info(f"[bench_dump] wrote fixture: {self.dump_path} "
                    f"({len(ctx.text_regions)} regions, page_shape={fixture['page_shape']})")
        return await super()._run_text_rendering(config, ctx)


async def main():
    page = sys.argv[1]
    out = sys.argv[2]
    lang = sys.argv[3] if len(sys.argv) > 3 else "ENG"

    font = os.path.normpath(os.path.join(MIT, "fonts", "Prompt-Bold.ttf"))
    tr = DumpingTranslator({"use_gpu": True, "verbose": False, "kernel_size": 3,
                            "font_path": font if os.path.isfile(font) else None})
    tr.dump_path = out

    img = Image.open(page).convert("RGB")
    ctx = await tr.translate(img, build_config(lang), skip_context_save=True)
    n = len(ctx.text_regions) if ctx.text_regions else 0
    print(f"[bench_dump] done: {n} regions, fixture at {out}")


if __name__ == "__main__":
    asyncio.run(main())
