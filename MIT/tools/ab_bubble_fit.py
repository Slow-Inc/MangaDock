"""Proof diag (#166): translate one reference page through the running worker
twice — bubble_area_fit OFF vs ON (both with bubble-seg) — and composite the
returned patches back onto the page so the binary-search font sizing can be
judged visually. Throwaway/measurement only — not wired in.

Usage (worker must be up on :5003):
    .venv/Scripts/python.exe tools/ab_bubble_fit.py
Reads tools/_bubble_proof/page01.jpg, writes before.png / after_fitoff.png /
after_fiton.png there.
"""
import base64
import io
import json
from pathlib import Path

import requests
from PIL import Image

WORKER = "http://127.0.0.1:5003/translate/with-form/patches"
PROOF = Path(__file__).parent / "_bubble_proof"
PAGE = PROOF / "page01.jpg"

# page01.jpg is an English scan — leave source as ANY (no source_lang_only) so
# the source_lang filter doesn't drop every region as "not JPN".
TRANSLATOR = {"target_lang": "THA"}
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
    data = resp.json()
    patches = data.get("patches", [])

    page = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    for p in patches:
        patch = Image.open(io.BytesIO(base64.b64decode(p["img_b64"]))).convert("RGBA")
        page.paste(patch, (int(p["x"]), int(p["y"])), patch)
    out = PROOF / f"after_{label}.png"
    page.save(out)
    print(f"{label}: bubble_area_fit={bubble_fit} -> {len(patches)} patches -> {out.name}")
    return len(patches)


def main() -> None:
    Image.open(PAGE).convert("RGB").save(PROOF / "before.png")
    print(f"original -> before.png ({PAGE.name})")
    translate("fitoff", False)
    translate("fiton", True)


if __name__ == "__main__":
    main()
