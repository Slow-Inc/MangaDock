"""#268 measurement: render the One Punch-Man benchmark through the prod patch path with
MIT_DEBUG_REGROUND_DUMP set so the REAL (pristine crop, pre-reground inpaint, erase mask) of
each group is dumped; then measure offline — no rendered glyphs, no LLM jitter — how far the
masked inpaint sits from its LOCAL original surround (the band) at several re-ground strengths.
PASS = corrected masked |delta| ~0 (< 4) vs the baseline ~18. Run from MIT/ with the worker up."""
import io, json, os, glob
from pathlib import Path
import numpy as np
import requests
import cv2
from manga_translator.patch_geometry import reground_inpaint_luminance

ROOT = Path(__file__).parent.parent.parent
PAGE = ROOT/"Backend"/"uploads"/"chapters"/"752fc515-72ce-4890-9369-0337ea3a8224"/"d8658a92-f12d-44ad-99ff-9701793a7110.jpg"
DUMP = Path(__file__).parent/"_reground_dump"


def config() -> str:
    return json.dumps({
        "translator": {"target_lang": "ENG"},
        "detector": {"detection_size": 2560, "det_bubble_seg": True, "det_sfx": True},
        "ocr": {"prob": 0.03, "vlm_rescue": True},
        "inpainter": {"inpainter": "lama_large", "inpainting_size": 2048, "inpainting_precision": "bf16",
                      "full_page_inpaint": True, "lama_lum_reground": 1.0},
        "render": {"direction": "auto", "rtl": False, "bubble_area_fit": False, "supersampling": 4,
                   "uppercase": True, "en_comic_font": True, "anti_overlap": True,
                   "clean_layout": True, "font_size_max": 20},
    })


def local_target(crop, inpaint, mask):
    """The helper's own per-pixel low-freq target field (propagated original surround)."""
    mb = mask > 127
    r = max(8, int(round(0.06 * min(crop.shape[:2]))))
    k = (2*r+1, 2*r+1)
    filled = cv2.inpaint(np.ascontiguousarray(crop), (mb*np.uint8(255)), max(3, r//4), cv2.INPAINT_TELEA)
    lowO = cv2.boxFilter(filled.astype(np.float32), -1, k, normalize=True)
    return lowO, mb


def band(img, lowO, mb, sel):
    """mean / p95 |L(img) - L(target)| over the masked pixels in selection `sel`."""
    L = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY).astype(np.float32)
    Lt = cv2.cvtColor(lowO.astype(np.uint8), cv2.COLOR_RGB2GRAY).astype(np.float32)
    d = np.abs(L - Lt)[mb & sel]
    return (float(d.mean()), float(np.percentile(d, 95))) if d.size else (0.0, 0.0)


def main():
    if DUMP.exists():
        for f in glob.glob(str(DUMP/'*.npz')): os.remove(f)
    os.environ['MIT_DEBUG_REGROUND_DUMP'] = str(DUMP)   # (also passed to the worker via its own env)
    img = PAGE.read_bytes()
    r = requests.post("http://127.0.0.1:5003/translate/with-form/patches",
                      files={"image": ("p.jpg", img, "image/jpeg")}, data={"config": config()}, timeout=900)
    r.raise_for_status()
    print("patches:", len(r.json().get("patches", [])))
    dumps = sorted(glob.glob(str(DUMP/'*.npz')))
    print("dumped groups:", len(dumps))
    for f in dumps:
        d = np.load(f)
        crop, inpaint, mask = d['crop'], d['inpaint'], d['mask']
        mb = mask > 127
        if mb.sum() < 50:  # skip tiny
            continue
        lowO, mb = local_target(crop, inpaint, mask)
        # split hair (dark target) vs cheek (light target) by the per-pixel target luminance
        Lt = cv2.cvtColor(lowO.astype(np.uint8), cv2.COLOR_RGB2GRAY)
        dark = Lt < 128
        light = ~dark
        print(f"\n=== {Path(f).name}  mask px={int(mb.sum())} ===")
        for s in (0.0, 0.7, 0.85, 1.0):
            out = reground_inpaint_luminance(inpaint, crop, mask, strength=s) if s > 0 else inpaint
            mh, ph = band(out, lowO, mb, dark)
            mc, pc = band(out, lowO, mb, light)
            print(f"  strength {s:>4}:  hair Δmean={mh:5.1f} p95={ph:5.1f} | cheek Δmean={mc:5.1f} p95={pc:5.1f}")


if __name__ == "__main__":
    main()
