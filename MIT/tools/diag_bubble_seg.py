"""Proof diag (#170): run a speech-bubble segmentation YOLO on reference pages,
save balloon-mask overlays, and report VRAM so we can judge 12 GB co-residency
BEFORE writing any pipeline code. Throwaway/measurement only — not wired in.

Usage:
    .venv/Scripts/python.exe tools/diag_bubble_seg.py
Reads tools/_bubble_proof/page*.jpg, writes tools/_bubble_proof/out/*_mask.jpg
"""
from pathlib import Path
import subprocess
import time

import cv2
import numpy as np


def smi() -> str:
    try:
        r = subprocess.run(
            ["nvidia-smi", "--query-gpu=memory.used,memory.total",
             "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=10)
        return r.stdout.strip().splitlines()[0] + " MB (used/total)"
    except Exception as e:  # noqa: BLE001
        return f"n/a ({e})"


def main() -> None:
    import torch
    from huggingface_hub import hf_hub_download
    from ultralytics import YOLO

    proof = Path(__file__).parent / "_bubble_proof"
    out = proof / "out"
    out.mkdir(exist_ok=True)

    print("VRAM before model load :", smi())
    weights = hf_hub_download(repo_id="kitsumed/yolov8m_seg-speech-bubble",
                              filename="model.pt")
    print("weights:", weights)
    model = YOLO(weights)
    torch.cuda.reset_peak_memory_stats()
    print("VRAM after model load  :", smi())

    pages = sorted(proof.glob("page*.jpg"))
    print(f"reference pages: {len(pages)}")
    for p in pages:
        img = cv2.imread(str(p))
        if img is None:
            print(f"{p.name}: UNREADABLE")
            continue
        t = time.time()
        res = model.predict(img, imgsz=1024, conf=0.30, device=0, verbose=False)[0]
        dt = (time.time() - t) * 1000
        n = 0 if res.masks is None else len(res.masks)
        vis = img.copy()
        if res.masks is not None:
            overlay = img.copy()
            for poly in res.masks.xy:
                cv2.fillPoly(overlay, [poly.astype(np.int32)], (0, 255, 0))
            vis = cv2.addWeighted(overlay, 0.4, img, 0.6, 0)
            for b in res.boxes.xyxy.cpu().numpy():
                x1, y1, x2, y2 = b.astype(int)
                cv2.rectangle(vis, (x1, y1), (x2, y2), (0, 0, 255), 2)
        cv2.imwrite(str(out / f"{p.stem}_mask.jpg"), vis)
        print(f"{p.name}: {n:2d} bubbles  {img.shape[1]}x{img.shape[0]}  {dt:.0f}ms")

    print("Peak VRAM this process :",
          f"{torch.cuda.max_memory_reserved() / 1e6:.0f} MB reserved")
    print("VRAM peak (smi)        :", smi())


if __name__ == "__main__":
    main()
