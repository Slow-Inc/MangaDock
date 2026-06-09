"""Full render-parity + SFX proof (#168 on top of A+B+C + #166/#170/#176/#179/#181).
Translates the One Punch-Man benchmark page JA->EN through the worker with the FULL
config including det_sfx (AnimeText YOLO second pass), composites, and montages vs
MangaTranslator's reference so we can see whether ぬ〜 → translated SFX now appears.

Usage (worker up on :5003): .venv/Scripts/python.exe tools/ab_sfx.py
"""
import base64
import io
import json
from pathlib import Path

import requests
from PIL import Image

WORKER = "http://127.0.0.1:5003/translate/with-form/patches"
ROOT = Path(__file__).parent.parent.parent
PAGE = ROOT / "Backend" / "uploads" / "chapters" / \
    "752fc515-72ce-4890-9369-0337ea3a8224" / \
    "d8658a92-f12d-44ad-99ff-9701793a7110.jpg"
REF = ROOT / "MIT" / "example_translation.jpg"
OUT = Path(__file__).parent / "_bubble_proof"


def config() -> str:
    return json.dumps({
        "translator": {"target_lang": "ENG"},
        "detector": {"detection_size": 2048, "det_bubble_seg": True, "det_sfx": True},  # #168
        "ocr": {"prob": 0.03},
        "inpainter": {"inpainter": "lama_large", "inpainting_size": 1536, "inpainting_precision": "bf16"},
        "render": {
            "direction": "auto", "rtl": False,
            "bubble_area_fit": True, "supersampling": 4,
            "en_comic_font": True,            # B (bundled comic)
            "uppercase": True,                # A
            "font_max_box_ratio": 0.75,       # C
        },
    })


def main() -> None:
    print(f"page exists={PAGE.exists()} ref exists={REF.exists()}")
    img_bytes = PAGE.read_bytes()
    resp = requests.post(WORKER, files={"image": ("page.jpg", img_bytes, "image/jpeg")},
                         data={"config": config()}, timeout=900)
    resp.raise_for_status()
    patches = resp.json().get("patches", [])
    page = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    for p in patches:
        patch = Image.open(io.BytesIO(base64.b64decode(p["img_b64"]))).convert("RGBA")
        page.paste(patch, (int(p["x"]), int(p["y"])), patch)
    ours = OUT / "sfx_full.png"
    page.save(ours)
    print(f"full+sfx: {len(patches)} patches -> {ours.name}")

    imgs = [Image.open(PAGE).convert("RGB"), Image.open(ours).convert("RGB")]
    if REF.exists():
        imgs.append(Image.open(REF).convert("RGB"))
    h = min(i.height for i in imgs)
    scaled = [i.resize((int(i.width * h / i.height), h)) for i in imgs]
    gap = 16
    canvas = Image.new("RGB", (sum(i.width for i in scaled) + gap * (len(scaled) - 1), h), (20, 20, 20))
    x = 0
    for i in scaled:
        canvas.paste(i, (x, 0)); x += i.width + gap
    out = OUT / "sfx_montage.png"
    canvas.save(out)
    print(f"montage [original | ours(full+sfx) | MangaTranslator] -> {out.name} size={canvas.size}")


if __name__ == "__main__":
    main()
