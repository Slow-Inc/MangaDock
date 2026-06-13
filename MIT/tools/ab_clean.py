"""A/B the render-layout rework (clean_layout) end-to-end on the One Punch-Man page,
through the prod patch path. Montage: [original | warp (clean OFF) | clean-layout ON | reference].
The clean-layout column should show narration/caption text laid out small + upright +
wrapped (like the reference), instead of the warp column's stretched/oversized English.
Run from MIT/ with the worker holding the new code."""
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
OUT = Path(__file__).parent / "_clean_proof"
OUT.mkdir(exist_ok=True)


def config(clean: bool) -> str:
    render = {"direction": "auto", "rtl": False, "bubble_area_fit": False,
              "supersampling": 4, "uppercase": True, "en_comic_font": True,
              "anti_overlap": True}
    if clean:
        render["clean_layout"] = True
        render["font_size_max"] = 20
    return json.dumps({
        "translator": {"target_lang": "ENG"},
        "detector": {"detection_size": 2560, "det_bubble_seg": True, "det_sfx": True},
        "ocr": {"prob": 0.03, "vlm_rescue": True},
        "inpainter": {"inpainter": "lama_large", "inpainting_size": 2048, "inpainting_precision": "bf16"},
        "render": render,
    })


def render(clean: bool) -> Image.Image:
    img = PAGE.read_bytes()
    r = requests.post(WORKER, files={"image": ("p.jpg", img, "image/jpeg")},
                      data={"config": config(clean)}, timeout=900)
    r.raise_for_status()
    patches = r.json().get("patches", [])
    page = Image.open(io.BytesIO(img)).convert("RGB")
    for p in patches:
        pt = Image.open(io.BytesIO(base64.b64decode(p["img_b64"]))).convert("RGBA")
        page.paste(pt, (int(p["x"]), int(p["y"])), pt)
    tag = "clean" if clean else "warp"
    page.save(OUT / f"{tag}.png")
    print(f"[{tag}] {len(patches)} patches")
    return page


def main():
    print(f"page exists={PAGE.exists()}")
    warp = render(False)
    clean = render(True)
    imgs = [Image.open(PAGE).convert("RGB"), warp, clean]
    if REF.exists():
        imgs.append(Image.open(REF).convert("RGB"))
    h = min(i.height for i in imgs)
    sc = [i.resize((int(i.width * h / i.height), h)) for i in imgs]
    W = sum(i.width for i in sc) + 16 * (len(sc) - 1)
    canvas = Image.new("RGB", (W, h), (20, 20, 20))
    x = 0
    for i in sc:
        canvas.paste(i, (x, 0)); x += i.width + 16
    canvas.save(OUT / "clean_montage.png")
    print("montage [original | warp | clean-layout | reference] -> clean_montage.png")


if __name__ == "__main__":
    main()
