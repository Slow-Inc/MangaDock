"""Proof diag (#166 benchmark): translate the uploaded One Punch-Man benchmark
page (JA) to EN through the running worker with bubble_area_fit ON, and
composite the patches back so the result can be compared to MangaTranslator's
reference (example_translation.jpg). Throwaway/measurement only.

Usage (worker up on :5003):
    .venv/Scripts/python.exe tools/ab_benchmark.py
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
OUT = Path(__file__).parent / "_bubble_proof"

# JA source page; ANY avoids the source_lang_only filter dropping mixed OCR.
TRANSLATOR = {"target_lang": "ENG"}
INPAINTER = {"inpainter": "lama_large", "inpainting_size": 1536, "inpainting_precision": "bf16"}


def config(bubble_fit: bool) -> str:
    render = {"direction": "auto", "rtl": False}
    if bubble_fit:
        render["bubble_area_fit"] = True
    return json.dumps({
        "translator": TRANSLATOR,
        "detector": {"detection_size": 2048, "det_bubble_seg": True},
        "ocr": {"prob": 0.03},
        "inpainter": INPAINTER,
        "render": render,
    })


def translate(label: str, bubble_fit: bool) -> int:
    img_bytes = PAGE.read_bytes()
    resp = requests.post(
        WORKER,
        files={"image": ("page.jpg", img_bytes, "image/jpeg")},
        data={"config": config(bubble_fit)},
        timeout=600,
    )
    resp.raise_for_status()
    patches = resp.json().get("patches", [])
    page = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    for p in patches:
        patch = Image.open(io.BytesIO(base64.b64decode(p["img_b64"]))).convert("RGBA")
        page.paste(patch, (int(p["x"]), int(p["y"])), patch)
    out = OUT / f"benchmark_{label}.png"
    page.save(out)
    print(f"{label}: bubble_area_fit={bubble_fit} -> {len(patches)} patches -> {out.name}")
    return len(patches)


def main() -> None:
    print(f"page: {PAGE} exists={PAGE.exists()}")
    Image.open(PAGE).convert("RGB").save(OUT / "benchmark_before.png")
    translate("fiton", True)
    translate("fitoff", False)


if __name__ == "__main__":
    main()
