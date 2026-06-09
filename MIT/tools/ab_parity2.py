"""Render-parity v2 proof (gaps A+B+C on top of #166/#170/#176/#179/#181).
Translates the One Punch-Man benchmark page JA->EN through the worker with the new
knobs and renders TWO font variants so we can pick the weight:
  - v2_comic : en_comic_font (comic shanns 2) + uppercase + font_max_box_ratio 0.75
  - v2_aa3   : en_font=anime_ace_3.ttf       + uppercase + font_max_box_ratio 0.75
Then a montage [ original | v2_comic | v2_aa3 | MangaTranslator-ref ].

Mirrors what Backend buildMitConfig emits with MIT_EN_UPPERCASE=1,
MIT_FONT_MAX_BOX_RATIO=0.75, MIT_EN_FONT=... (unit-tested in books-mit-config.spec).
Throwaway/measurement only. Usage (worker up on :5003):
    .venv/Scripts/python.exe tools/ab_parity2.py
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


def config(en_font=None) -> str:
    render = {
        "direction": "auto", "rtl": False,
        "bubble_area_fit": True,        # #166/#179
        "supersampling": 4,             # #181
        "uppercase": True,              # parity-A
        "font_max_box_ratio": 0.75,     # parity-C (was 0.5)
    }
    if en_font:
        render["en_font"] = en_font     # parity-B override
    else:
        render["en_comic_font"] = True  # #176 bundled comic
    return json.dumps({
        "translator": {"target_lang": "ENG"},
        "detector": {"detection_size": 2048, "det_bubble_seg": True},
        "ocr": {"prob": 0.03},
        "inpainter": {"inpainter": "lama_large", "inpainting_size": 1536, "inpainting_precision": "bf16"},
        "render": render,
    })


def translate(label: str, en_font=None) -> Path:
    img_bytes = PAGE.read_bytes()
    resp = requests.post(WORKER, files={"image": ("page.jpg", img_bytes, "image/jpeg")},
                         data={"config": config(en_font)}, timeout=900)
    resp.raise_for_status()
    patches = resp.json().get("patches", [])
    page = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    for p in patches:
        patch = Image.open(io.BytesIO(base64.b64decode(p["img_b64"]))).convert("RGBA")
        page.paste(patch, (int(p["x"]), int(p["y"])), patch)
    out = OUT / f"parity2_{label}.png"
    page.save(out)
    print(f"{label}: en_font={en_font or '(comic shanns 2)'} -> {len(patches)} patches -> {out.name}")
    return out


def montage(paths) -> None:
    imgs = [Image.open(PAGE).convert("RGB")] + [Image.open(p).convert("RGB") for p in paths]
    if REF.exists():
        imgs.append(Image.open(REF).convert("RGB"))
    h = min(i.height for i in imgs)
    scaled = [i.resize((int(i.width * h / i.height), h)) for i in imgs]
    gap = 16
    W = sum(i.width for i in scaled) + gap * (len(scaled) - 1)
    canvas = Image.new("RGB", (W, h), (20, 20, 20))
    x = 0
    for i in scaled:
        canvas.paste(i, (x, 0)); x += i.width + gap
    out = OUT / "parity2_montage.png"
    canvas.save(out)
    print(f"montage [original | v2_comic | v2_aa3 | MangaTranslator] -> {out.name} size={canvas.size}")


def main() -> None:
    print(f"page exists={PAGE.exists()} ref exists={REF.exists()}")
    a = translate("comic", en_font=None)
    b = translate("aa3", en_font="anime_ace_3.ttf")
    montage([a, b])


if __name__ == "__main__":
    main()
