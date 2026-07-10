"""Benchmark the #168/#172 vision-LLM OCR rescue end-to-end: full render-parity
config + det_sfx + ocr.vlm_rescue on the One Punch-Man page. Shows whether the big
ぬ (which the 48px OCR drops) now renders an English SFX via the 9arm vision gateway.
Montage [original | ours | MangaTranslator]. Run from MIT/ (worker must have new code)."""
import base64
import io
import json
from pathlib import Path

import requests
from PIL import Image

WORKER = "http://127.0.0.1:5003/translate/with-form/patches"
ROOT = Path(__file__).parent.parent.parent
PAGE = ROOT / "Backend" / "uploads" / "chapters" / \
    "752fc515-72ce-4890-9369-0337ea3a8224" / "d8658a92-f12d-44ad-99ff-9701793a7110.jpg"
REF = ROOT / "MIT" / "example_translation.jpg"
OUT = Path(__file__).parent / "_bubble_proof"


def config() -> str:
    return json.dumps({
        "translator": {"target_lang": "ENG"},
        "detector": {"detection_size": 2048, "det_bubble_seg": True, "det_sfx": True},
        "ocr": {"prob": 0.03, "vlm_rescue": True},
        "inpainter": {"inpainter": "lama_large", "inpainting_size": 1536, "inpainting_precision": "bf16"},
        "render": {"direction": "auto", "rtl": False, "bubble_area_fit": True, "supersampling": 4,
                   "uppercase": True, "en_comic_font": True, "font_max_box_ratio": 0.5},
    })


def main():
    print(f"page exists={PAGE.exists()}")
    img = PAGE.read_bytes()
    r = requests.post(WORKER, files={"image": ("p.jpg", img, "image/jpeg")},
                      data={"config": config()}, timeout=900)
    r.raise_for_status()
    patches = r.json().get("patches", [])
    page = Image.open(io.BytesIO(img)).convert("RGB")
    for p in patches:
        pt = Image.open(io.BytesIO(base64.b64decode(p["img_b64"]))).convert("RGBA")
        page.paste(pt, (int(p["x"]), int(p["y"])), pt)
    ours = OUT / "vlm_full.png"
    page.save(ours)
    print(f"-> {len(patches)} patches -> {ours.name}")
    imgs = [Image.open(PAGE).convert("RGB"), page]
    if REF.exists():
        imgs.append(Image.open(REF).convert("RGB"))
    h = min(i.height for i in imgs)
    sc = [i.resize((int(i.width * h / i.height), h)) for i in imgs]
    W = sum(i.width for i in sc) + 16 * (len(sc) - 1)
    canvas = Image.new("RGB", (W, h), (20, 20, 20))
    x = 0
    for i in sc:
        canvas.paste(i, (x, 0)); x += i.width + 16
    canvas.save(OUT / "vlm_montage.png")
    print(f"montage [original | ours(vlm) | reference] -> vlm_montage.png")


if __name__ == "__main__":
    main()
