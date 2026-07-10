"""Verify the CURRENT (not cached) render behavior for non-ENG targets on the One-Punch page:
SFX translation + line-break quality. Renders THA + CHS + KOR via the live MIT server with the
same render-parity config the Backend sends, so we see what TODAY's pipeline produces."""
import io, json, sys
from pathlib import Path
import requests
from PIL import Image

HERE = Path(__file__).parent
PAGE = HERE / "_bubble_proof" / "benchmark_before.png"
OUT = HERE / "_lang_proof"; OUT.mkdir(exist_ok=True)
URL = "http://127.0.0.1:5003/translate/with-form/image"

RENDER = {"direction": "auto", "rtl": False, "bubble_area_fit": False, "supersampling": 4,
          "uppercase": True, "en_comic_font": True, "en_font": "anime_ace_3.ttf",
          "anti_overlap": True, "clean_layout": True, "font_size_max": 20}

def run(lang):
    cfg = json.dumps({
        "translator": {"target_lang": lang},
        "detector": {"detection_size": 2560, "det_bubble_seg": True, "det_sfx": True},
        "ocr": {"prob": 0.03, "vlm_rescue": True},
        "inpainter": {"inpainter": "lama_large", "inpainting_size": 2048,
                      "inpainting_precision": "bf16", "full_page_inpaint": True},
        "render": RENDER,
    })
    r = requests.post(URL, files={"image": ("p.png", PAGE.read_bytes(), "image/png")},
                      data={"config": cfg}, timeout=1200)
    print(lang, "status", r.status_code, "len", len(r.content))
    r.raise_for_status()
    Image.open(io.BytesIO(r.content)).convert("RGB").save(OUT / f"onepunch_{lang}.png")

for lang in (sys.argv[1:] or ["THA", "CHS", "KOR"]):
    run(lang)
print("saved to tools/_lang_proof/")
