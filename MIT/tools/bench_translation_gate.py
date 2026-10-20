"""#642 translation gate harness: run the tuned in-process pipeline from one MIT tree.

    python tools/bench_translation_gate.py <MIT-root> <out-dir> <label> <runs> <page>:<target_lang> [...]

Saves <out-dir>/<label>_<page-stem>_<target>_r<i>.png and .json (per-region text/translation/xyxy).
One process per MIT tree: two versions of manga_translator cannot share an interpreter.
"""
import asyncio
import json
import os
import sys
import time

root, out_dir, label, runs = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4])
jobs = [a.rsplit(':', 1) for a in sys.argv[5:]]
os.chdir(root)
sys.path.insert(0, root)

try:  # #614 trees load .env explicitly; landing loads it on import
    from manga_translator import initialize as _init
    _init()
except ImportError:
    pass

from PIL import Image  # noqa: E402
from manga_translator import MangaTranslator, Config  # noqa: E402

# Same tuned config as MIT/tools/bench_render_tuned.py (Backend/.env landing-2026-07-04).
def tuned(target):
    return {
        "translator": {"target_lang": target},
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
    os.makedirs(out_dir, exist_ok=True)
    font = os.path.join(root, "fonts", "Prompt-Bold.ttf")
    tr = MangaTranslator({"use_gpu": True, "verbose": False, "kernel_size": 3,
                          "model_dir": os.path.join(root, "models"),
                          "font_path": font if os.path.isfile(font) else None})
    for page, target in jobs:
        stem = os.path.splitext(os.path.basename(page))[0]
        for i in range(1, runs + 1):
            name = f"{label}_{stem}_{target}_r{i}"
            t0 = time.time()
            ctx = await tr.translate(Image.open(page).convert("RGB"), Config(**tuned(target)),
                                     skip_context_save=True)
            regions = [{"text": getattr(r, "text", ""), "translation": getattr(r, "translation", ""),
                        "xyxy": [int(v) for v in r.xyxy],
                        "sfx_rescued": bool(getattr(r, "sfx_rescued", False))}
                       for r in (ctx.text_regions or [])]
            rendered = getattr(ctx, "img_rendered", None)
            if rendered is not None:
                Image.fromarray(rendered).convert("RGB").save(os.path.join(out_dir, name + ".png"))
            with open(os.path.join(out_dir, name + ".json"), "w", encoding="utf-8") as fh:
                json.dump({"label": label, "page": page, "target": target, "run": i,
                           "seconds": round(time.time() - t0, 1), "rendered": rendered is not None,
                           "regions": regions}, fh, ensure_ascii=False, indent=1)
            print(f"[translation_gate] {name}: {len(regions)} regions, {time.time() - t0:.1f}s", flush=True)


asyncio.run(main())
