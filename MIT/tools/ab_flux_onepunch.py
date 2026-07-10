"""E2E #276: render the One-Punch benchmark page through the FULL MIT pipeline with the new
optional Flux Klein inpainter vs the default LaMa, so the band/ghost fix is visible end-to-end
(not just the standalone probe). Posts to the running MIT server (/translate/with-form/image)."""
import io, json
from pathlib import Path
import requests
from PIL import Image

HERE = Path(__file__).parent
PAGE = HERE / "_bubble_proof" / "benchmark_before.png"        # raw JP One-Punch page
OUT = HERE / "_flux_proof"; OUT.mkdir(exist_ok=True)
URL = "http://127.0.0.1:5003/translate/with-form/image"

RENDER = {"direction": "auto", "rtl": False, "bubble_area_fit": False, "supersampling": 4,
          "uppercase": True, "en_comic_font": True, "en_font": "anime_ace_3.ttf",
          "anti_overlap": True, "clean_layout": True, "font_size_max": 20}
DET = {"detection_size": 2560, "det_bubble_seg": True, "det_sfx": True}
OCR = {"prob": 0.03, "vlm_rescue": True}


def run(inpainter):
    cfg = json.dumps({
        "translator": {"target_lang": "ENG"},
        "detector": DET, "ocr": OCR,
        "inpainter": {"inpainter": inpainter, "inpainting_size": 2048,
                      "inpainting_precision": "bf16", "full_page_inpaint": True},
        "render": RENDER,
    })
    r = requests.post(URL, files={"image": ("p.png", PAGE.read_bytes(), "image/png")},
                      data={"config": cfg}, timeout=1200)
    print(inpainter, "status", r.status_code, "len", len(r.content))
    r.raise_for_status()
    img = Image.open(io.BytesIO(r.content)).convert("RGB")
    img.save(OUT / f"onepunch_{inpainter}.png")
    return img


flux = run("flux_klein")
lama = run("lama_large")

# side-by-side: original | LaMa | Flux
raw = Image.open(PAGE).convert("RGB")
H = 760
def rs(im):
    w, h = im.size; return im.resize((round(w * H / h), H), Image.LANCZOS)
raw, lama, flux = rs(raw), rs(lama), rs(flux)
gap = 16
m = Image.new("RGB", (raw.width + lama.width + flux.width + gap * 2, H), (255, 255, 255))
x = 0
for im in (raw, lama, flux):
    m.paste(im, (x, 0)); x += im.width + gap
m.save(OUT / "onepunch_raw_lama_flux.png")
print("saved onepunch_{flux_klein,lama_large}.png + onepunch_raw_lama_flux.png")
