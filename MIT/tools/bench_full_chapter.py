"""Full-chapter render benchmark — render EVERY page of a chapter through the running worker with
the production fix-stack config, composite ``before | after`` per page for QA against the original
on the 11-point defect checklist (memory ``feedback_benchmark_defect_checklist``).

Worker-direct (``POST /translate/with-form/patches`` on :5003) — bypasses the backend cache so each
page is a fresh render. Source pages are the backend's cached chapter scans.

Usage (worker up on :5003, from MIT/):
    .venv/Scripts/python.exe tools/bench_full_chapter.py [CHAPTER_DIR] [N_PAGES] [TARGET_LANG]

Defaults: the Gal Yome EN chapter, 30 pages, THA. Output composites land in tools/_bench_full/.
"""
import base64, io, json, sys, time
from pathlib import Path
import requests
from PIL import Image

WORKER = "http://127.0.0.1:5003/translate/with-form/patches"
# Gal Yome no Himitsu EN chapter scans, cached by the backend image proxy.
DEFAULT_CH = Path(r"D:/Github/MangaDock/Backend/img-cache/_chapters/chapters/78e4caf1-1382-45dd-a861-9cebd8dc60d8")
CH = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_CH
N = int(sys.argv[2]) if len(sys.argv) > 2 else 30
TARGET = sys.argv[3] if len(sys.argv) > 3 else "THA"
OUT = Path(__file__).parent / "_bench_full"
OUT.mkdir(parents=True, exist_ok=True)

CONFIG = json.dumps({
    "translator": {"target_lang": TARGET},
    "detector": {"detection_size": 2560, "det_bubble_seg": True, "det_sfx": True},
    "ocr": {"prob": 0.03, "vlm_rescue": True},
    "inpainter": {"inpainter": "lama_large", "inpainting_size": 2048, "inpainting_precision": "bf16",
                  "full_page_inpaint": True, "inpaint_context_pad": 256},
    "render": {"direction": "auto", "bubble_area_fit": True, "anti_overlap": True, "font_size_max": 20,
               "clean_layout": True, "en_comic_font": True, "en_font": "anime_ace_3.ttf",
               "uppercase": True, "supersampling": 4, "patch_feather_radius": 16, "patch_content_alpha": True},
})


def render(src: Path, retries: int = 3):
    for _ in range(retries):
        try:
            r = requests.post(WORKER, files={"image": ("p.jpg", src.read_bytes(), "image/jpeg")},
                              data={"config": CONFIG}, timeout=900)
            if r.status_code == 200:
                return r.json()
            print(f"  {src.name} HTTP {r.status_code} retry", flush=True)
        except Exception as e:
            print(f"  {src.name} {type(e).__name__} retry", flush=True)
        time.sleep(4)
    return None


def main():
    for i in range(N):
        src = CH / f"ds{i}.jpg"
        if not src.exists():
            print(f"ds{i}: MISSING {src}", flush=True)
            continue
        t0 = time.time()
        j = render(src)
        if j is None:
            print(f"ds{i}: FAILED", flush=True)
            continue
        patches = j.get("patches", [])
        before = Image.open(src).convert("RGB")
        after = before.copy()
        for p in patches:
            pt = Image.open(io.BytesIO(base64.b64decode(p["img_b64"]))).convert("RGBA")
            after.paste(pt, (int(p["x"]), int(p["y"])), pt)
        canvas = Image.new("RGB", (before.width * 2 + 16, before.height), (20, 20, 20))
        canvas.paste(before, (0, 0))
        canvas.paste(after, (before.width + 16, 0))
        canvas.save(OUT / f"p{i:02d}.png")
        print(f"ds{i}: {len(patches)} patches {time.time() - t0:.0f}s", flush=True)
    print("=== ALL DONE ===", flush=True)


if __name__ == "__main__":
    main()
