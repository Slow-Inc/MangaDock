"""Post-render QA: read the Thai a page actually shows and compare it with what was intended (#1143 Track C).

Runs the Thai recogniser (th_PP-OCRv5 from PaddleOCR) over each rendered region of a page and prints a CER table
plus the lines worth a human look. Offline tool, not part of the serving path: Paddle lives in its own venv on
this box (C:/Users/xenod/venvs/paddle) because paddle2onnx is broken here and MIT should not carry Paddle.

Usage (from the paddle venv):
  python tools/render_qa.py --page /path/p2.jpg --mit http://127.0.0.1:5003
  python tools/render_qa.py --image page.png --regions regions.json

"--page" POSTs the page to a running MIT, composes the returned patches, and QAs the result - the same path the
reader sees. "--image/--regions" QA a pair saved earlier (regions: [{"xyxy": [...], "dst": "..."}]).
"""
import argparse
import base64
import io
import json
import os
import statistics
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from manga_translator.render_qa import cer, is_suspicious, SUSPICIOUS_CER  # noqa: E402


def compose_from_mit(page_path, mit):
    import httpx
    raw = open(page_path, "rb").read()
    cfg = os.environ.get("RENDER_QA_CONFIG") or json.dumps(
        {"translator": {"target_lang": "THA", "source_lang": "ENG"}})
    r = httpx.post(mit.rstrip("/") + "/translate/with-form/patches",
                   files={"image": ("p.jpg", raw, "image/jpeg")}, data={"config": cfg}, timeout=900)
    r.raise_for_status()
    data = r.json()
    page = Image.open(io.BytesIO(raw)).convert("RGBA")
    for patch in data.get("patches") or []:
        img = Image.open(io.BytesIO(base64.b64decode(patch["img_b64"]))).convert("RGBA")
        page.alpha_composite(img, (patch["x"], patch["y"]))
    regions = [{"xyxy": g["xyxy"], "dst": g.get("dst", "")}
               for g in data.get("regions") or [] if g.get("xyxy")]
    return page.convert("RGB"), regions


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--page", help="source page jpg; POST it to --mit and QA the composed result")
    ap.add_argument("--mit", default="http://127.0.0.1:5003")
    ap.add_argument("--image", help="already rendered page png")
    ap.add_argument("--regions", help="regions json saved earlier")
    ap.add_argument("--json", help="write the per-region result here")
    args = ap.parse_args()
    if args.page:
        page, regions = compose_from_mit(args.page, args.mit)
    elif args.image and args.regions:
        page = Image.open(args.image).convert("RGB")
        regions = json.load(open(args.regions, encoding="utf-8"))
    else:
        ap.error("give --page (with --mit) or --image with --regions")

    from paddleocr import PaddleOCR
    ocr = PaddleOCR(lang="th", use_doc_orientation_classify=False, use_doc_unwarping=False,
                    use_textline_orientation=False, enable_mkldnn=False)

    rows = []
    for g in regions:
        x1, y1, x2, y2 = (int(v) for v in g["xyxy"])
        intended = (g.get("dst") or "").strip()
        if not intended:
            continue
        crop = page.crop((max(0, x1), max(0, y1), min(page.width, x2), min(page.height, y2)))
        if crop.width < 6 or crop.height < 6:
            continue
        got = ""
        try:
            for res in ocr.predict(np.array(crop)):
                d = res.json if hasattr(res, "json") else res
                d = d.get("res", d) if isinstance(d, dict) else d
                got += " ".join(d.get("rec_texts") or [])
        except Exception as exc:  # a QA tool reports, it does not crash
            got = "<error: %s>" % type(exc).__name__
        rows.append({"box": [x1, y1, x2, y2], "intended": intended, "read": got,
                     "cer": round(cer(intended, got), 3)})

    if not rows:
        print("no rendered regions with Thai text")
        return 0
    rows.sort(key=lambda r: -r["cer"])
    values = [r["cer"] for r in rows]
    print("%d lines | median CER %.3f | suspicious threshold %.2f"
          % (len(rows), statistics.median(values), SUSPICIOUS_CER))
    for r in rows:
        flag = "SUSPICIOUS" if is_suspicious(r["intended"], r["read"]) else "ok"
        print("  %.2f %-10s %s <- read %s"
              % (r["cer"], flag, repr(r["intended"])[:60], repr(r["read"])[:60]))
    if args.json:
        json.dump(rows, open(args.json, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print("wrote %s" % args.json)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
