"""#167-class diagnosis — detection variants + OCR attribution on one page.
Usage: .venv/Scripts/python.exe -u diag_167.py <image_path> <out_dir>
"""
import asyncio
import sys

import cv2
import numpy as np
from PIL import Image

from manga_translator.config import Config
from manga_translator.detection import dispatch as dispatch_detection
from manga_translator.ocr import dispatch as dispatch_ocr, prepare as prepare_ocr

VARIANTS = [
    ("A_baseline_2048", 2048, 0.5, False, False),
    ("B_invert", 2048, 0.5, True, False),
    ("D_thr03", 2048, 0.3, False, False),
]


async def main(img_path: str, out_dir: str) -> None:
    img = np.array(Image.open(img_path).convert("RGB"))
    cfg = Config()
    device = "cuda"

    results = {}
    for name, size, thr, invert, gamma in VARIANTS:
        textlines, _, _ = await dispatch_detection(
            cfg.detector.detector, img, size, thr,
            cfg.detector.box_threshold, cfg.detector.unclip_ratio,
            invert, gamma, cfg.detector.det_rotate, cfg.detector.det_auto_rotate,
            device, False,
        )
        results[name] = textlines
        overlay = img.copy()
        for tl in textlines:
            pts = np.array(tl.pts, dtype=np.int32).reshape(-1, 2)
            x, y, w, h = cv2.boundingRect(pts)
            cv2.rectangle(overlay, (x, y), (x + w, y + h), (255, 0, 0), 5)
        Image.fromarray(overlay).save(f"{out_dir}/{name}.png")
        print(f"{name}: {len(textlines)} textlines")

    print("\n=== OCR attribution (prob=0.01) on A_baseline ===")
    cfg.ocr.prob = 0.01
    await prepare_ocr(cfg.ocr.ocr, device)
    ocr_lines = await dispatch_ocr(cfg.ocr.ocr, img, results["A_baseline_2048"], cfg.ocr, device, False)
    print(f"kept {len(ocr_lines)}/{len(results['A_baseline_2048'])}")
    for q in ocr_lines:
        pts = np.array(q.pts, dtype=np.int32).reshape(-1, 2)
        x, y, w, h = cv2.boundingRect(pts)
        print(f"   ({x},{y},{w}x{h}) prob={q.prob:.3f} text={q.text[:55]!r}")


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1], sys.argv[2]))
