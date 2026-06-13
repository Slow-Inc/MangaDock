"""Compare FULL-PAGE inpaint (our /translate/with-form/image = upstream-style) vs the
PATCH path on the bottom-right ghost region. If full-page erases the big text cleanly
and patch leaves a gray blob, the regression is patch-mode's small-crop inpaint."""
import base64, io, json
from pathlib import Path
import requests
from PIL import Image

ROOT = Path(__file__).parent.parent.parent
PAGE = ROOT/"Backend"/"uploads"/"chapters"/"752fc515-72ce-4890-9369-0337ea3a8224"/"d8658a92-f12d-44ad-99ff-9701793a7110.jpg"
OUT = Path(__file__).parent/"_clean_proof"; OUT.mkdir(exist_ok=True)

cfg = json.dumps({
    "translator": {"target_lang": "ENG"},
    "detector": {"detection_size": 2560, "det_bubble_seg": True, "det_sfx": True},
    "ocr": {"prob": 0.03, "vlm_rescue": True},
    "inpainter": {"inpainter": "lama_large", "inpainting_size": 2048, "inpainting_precision": "bf16"},
    "render": {"direction": "auto", "rtl": False, "bubble_area_fit": False, "supersampling": 4,
               "uppercase": True, "en_comic_font": True, "anti_overlap": True,
               "clean_layout": True, "font_size_max": 20},
})
img = PAGE.read_bytes()
r = requests.post("http://127.0.0.1:5003/translate/with-form/image",
                  files={"image": ("p.jpg", img, "image/jpeg")}, data={"config": cfg}, timeout=900)
print("status", r.status_code, "len", len(r.content))
r.raise_for_status()
out = Image.open(io.BytesIO(r.content)).convert("RGB")
out.save(OUT/"fullpage.png")
w,h = out.size
out.crop((int(w*0.55),int(h*0.62),w,h)).resize((int(w*0.45*2.2),int(h*0.38*2.2))).save(OUT/"br_fullpage.png")
print("saved fullpage.png + br_fullpage.png", out.size)
