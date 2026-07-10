"""#268 A/B all non-Flux band levers on the One Punch-Man bottom-right hair panel, through the
prod patch path. Montage: [original | baseline | mask_tighten | reground | seamless | tighten+reground].
Lets the dev eyeball which (if any) reduces the band, VRAM-neutral. Run from MIT/ with the worker up."""
import base64, io, json
from pathlib import Path
import requests
from PIL import Image

WORKER = "http://127.0.0.1:5003/translate/with-form/patches"
ROOT = Path(__file__).parent.parent.parent
PAGE = ROOT/"Backend"/"uploads"/"chapters"/"752fc515-72ce-4890-9369-0337ea3a8224"/"d8658a92-f12d-44ad-99ff-9701793a7110.jpg"
OUT = Path(__file__).parent/"_levers"; OUT.mkdir(exist_ok=True)

BASE_RENDER = {"direction": "auto", "rtl": False, "bubble_area_fit": False, "supersampling": 4,
               "uppercase": True, "en_comic_font": True, "anti_overlap": True,
               "clean_layout": True, "font_size_max": 20}

VARIANTS = {
    "baseline":    {},
    "tighten":     {"mask_tighten": True},
    "reground":    {"lama_lum_reground": 1.0},
    "seamless":    {"seamless_clone": True},
    "tight+regrnd":{"mask_tighten": True, "lama_lum_reground": 1.0},
}

def cfg(extra):
    inp = {"inpainter": "lama_large", "inpainting_size": 2048, "inpainting_precision": "bf16",
           "full_page_inpaint": True}
    inp.update(extra)
    return json.dumps({"translator": {"target_lang": "ENG"},
                       "detector": {"detection_size": 2560, "det_bubble_seg": True, "det_sfx": True},
                       "ocr": {"prob": 0.03, "vlm_rescue": True},
                       "inpainter": inp, "render": BASE_RENDER})

def render(extra):
    img = PAGE.read_bytes()
    r = requests.post(WORKER, files={"image": ("p.jpg", img, "image/jpeg")}, data={"config": cfg(extra)}, timeout=900)
    r.raise_for_status()
    page = Image.open(io.BytesIO(img)).convert("RGB")
    for p in r.json().get("patches", []):
        pt = Image.open(io.BytesIO(base64.b64decode(p["img_b64"]))).convert("RGBA")
        page.paste(pt, (int(p["x"]), int(p["y"])), pt)
    return page

def br(im):  # bottom-right hair panel crop
    w, h = im.size
    return im.crop((int(w*0.70), int(h*0.62), int(w*0.95), int(h*0.92)))

def main():
    orig = Image.open(PAGE).convert("RGB")
    cols = [("original", br(orig))]
    for name, extra in VARIANTS.items():
        page = render(extra); page.save(OUT/f"{name}.png")
        cols.append((name, br(page)))
        print(f"[{name}] done")
    h = min(c.height for _, c in cols)
    sc = [(n, c.resize((int(c.width*h/c.height), h))) for n, c in cols]
    W = sum(c.width for _, c in sc) + 12*(len(sc)-1)
    canvas = Image.new("RGB", (W, h+18), (30, 30, 30)); x = 0
    from PIL import ImageDraw; d = ImageDraw.Draw(canvas)
    for n, c in sc:
        canvas.paste(c, (x, 18)); d.text((x+2, 2), n, fill=(255,255,255)); x += c.width+12
    canvas.save(OUT/"levers_montage.png")
    print("montage -> _levers/levers_montage.png")

if __name__ == "__main__":
    main()
