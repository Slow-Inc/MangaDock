"""Tuning pass for the two live defects on the One Punch-Man benchmark page:
text-overlap (from the SFX 2nd pass colliding with dialogue) and oversized font
(font_max_box_ratio too high). Renders a few combos and montages vs reference so
we can pick env values for Backend/.env. Throwaway. Usage (worker up on :5003):
    .venv/Scripts/python.exe tools/ab_tune.py
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


def config(ratio: float, sfx: bool) -> str:
    return json.dumps({
        "translator": {"target_lang": "ENG"},
        "detector": {"detection_size": 2048, "det_bubble_seg": True, "det_sfx": sfx},
        "ocr": {"prob": 0.03},
        "inpainter": {"inpainter": "lama_large", "inpainting_size": 1536, "inpainting_precision": "bf16"},
        "render": {
            "direction": "auto", "rtl": False,
            "bubble_area_fit": True,
            "supersampling": 4,
            "uppercase": True,
            "en_comic_font": True,
            "font_max_box_ratio": ratio,
        },
    })


def translate(label: str, ratio: float, sfx: bool) -> Path:
    img_bytes = PAGE.read_bytes()
    resp = requests.post(WORKER, files={"image": ("page.jpg", img_bytes, "image/jpeg")},
                         data={"config": config(ratio, sfx)}, timeout=900)
    resp.raise_for_status()
    patches = resp.json().get("patches", [])
    page = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    for p in patches:
        patch = Image.open(io.BytesIO(base64.b64decode(p["img_b64"]))).convert("RGBA")
        page.paste(patch, (int(p["x"]), int(p["y"])), patch)
    out = OUT / f"tune_{label}.png"
    page.save(out)
    print(f"{label}: ratio={ratio} sfx={sfx} -> {len(patches)} patches -> {out.name}")
    return out


def montage(paths, names) -> None:
    imgs = [Image.open(PAGE).convert("RGB")] + [Image.open(p).convert("RGB") for p in paths]
    labels = ["original"] + names
    if REF.exists():
        imgs.append(Image.open(REF).convert("RGB")); labels.append("reference")
    h = min(i.height for i in imgs)
    scaled = [i.resize((int(i.width * h / i.height), h)) for i in imgs]
    gap = 16
    W = sum(i.width for i in scaled) + gap * (len(scaled) - 1)
    canvas = Image.new("RGB", (W, h), (20, 20, 20))
    x = 0
    for i in scaled:
        canvas.paste(i, (x, 0)); x += i.width + gap
    out = OUT / "tune_montage.png"
    canvas.save(out)
    print(f"montage [{' | '.join(labels)}] -> {out.name} size={canvas.size}")


def main() -> None:
    print(f"page exists={PAGE.exists()} ref exists={REF.exists()}")
    a = translate("r60_nosfx", 0.60, False)
    b = translate("r45_nosfx", 0.45, False)
    montage([a, b], ["ratio0.60 noSFX", "ratio0.45 noSFX"])


if __name__ == "__main__":
    main()
