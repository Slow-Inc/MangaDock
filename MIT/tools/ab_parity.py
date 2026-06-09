"""Render-parity E2E proof (#176 comic font + #181 supersampling 4x + #179 safe-area
narrow column, on top of #166 bubble_area_fit + #170 bubble_seg). Translates the
One Punch-Man benchmark page (JA->EN) through the running worker with the FULL
parity render config, composites the patches, and builds a 3-way montage so the
result can be judged against MangaTranslator's reference (example_translation.jpg).

This mirrors what Backend buildMitConfig emits when MIT_EN_COMIC_FONT=1 +
MIT_SUPERSAMPLING=4 are set (those env->config knobs are unit-tested in
books-mit-config.spec.ts). Throwaway/measurement only.

Usage (worker up on :5003):
    .venv/Scripts/python.exe tools/ab_parity.py
"""
import base64
import io
import json
from pathlib import Path

import requests
from PIL import Image

WORKER = "http://127.0.0.1:5003/translate/with-form/patches"
ROOT = Path(__file__).parent.parent.parent  # repo root
PAGE = ROOT / "Backend" / "uploads" / "chapters" / \
    "752fc515-72ce-4890-9369-0337ea3a8224" / \
    "d8658a92-f12d-44ad-99ff-9701793a7110.jpg"
REF = ROOT / "MIT" / "example_translation.jpg"  # MangaTranslator reference
OUT = Path(__file__).parent / "_bubble_proof"


def parity_config() -> str:
    """Full render-parity config — what the backend sends with all knobs on."""
    return json.dumps({
        "translator": {"target_lang": "ENG"},
        "detector": {"detection_size": 2048, "det_bubble_seg": True},
        "ocr": {"prob": 0.03},
        "inpainter": {"inpainter": "lama_large", "inpainting_size": 1536, "inpainting_precision": "bf16"},
        "render": {
            "direction": "auto",
            "rtl": False,
            "bubble_area_fit": True,   # #166 binary-search fit + #179 safe-area narrow column
            "en_comic_font": True,     # #176 comic shanns 2 for ENG
            "supersampling": 4,        # #181 4x supersample -> INTER_AREA downscale
        },
    })


def translate_parity() -> Path:
    img_bytes = PAGE.read_bytes()
    resp = requests.post(
        WORKER,
        files={"image": ("page.jpg", img_bytes, "image/jpeg")},
        data={"config": parity_config()},
        timeout=900,
    )
    resp.raise_for_status()
    patches = resp.json().get("patches", [])
    page = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    for p in patches:
        patch = Image.open(io.BytesIO(base64.b64decode(p["img_b64"]))).convert("RGBA")
        page.paste(patch, (int(p["x"]), int(p["y"])), patch)
    out = OUT / "benchmark_parity.png"
    page.save(out)
    print(f"parity: {len(patches)} patches -> {out.name}  size={page.size}")
    return out


def montage(ours: Path) -> Path:
    """[ original | ours (parity) | MangaTranslator ref ] scaled to equal height."""
    imgs = [Image.open(PAGE).convert("RGB"), Image.open(ours).convert("RGB")]
    if REF.exists():
        imgs.append(Image.open(REF).convert("RGB"))
    h = min(i.height for i in imgs)
    scaled = [i.resize((int(i.width * h / i.height), h)) for i in imgs]
    gap = 16
    W = sum(i.width for i in scaled) + gap * (len(scaled) - 1)
    canvas = Image.new("RGB", (W, h), (20, 20, 20))
    x = 0
    for i in scaled:
        canvas.paste(i, (x, 0))
        x += i.width + gap
    out = OUT / "parity_montage.png"
    canvas.save(out)
    labels = "original | ours(parity)" + (" | MangaTranslator-ref" if REF.exists() else " | (ref MISSING)")
    print(f"montage [{labels}] -> {out.name}  size={canvas.size}")
    return out


def main() -> None:
    print(f"page exists={PAGE.exists()}  ref exists={REF.exists()}")
    ours = translate_parity()
    montage(ours)


if __name__ == "__main__":
    main()
