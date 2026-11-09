---
name: project-mit-opencv-threads-ultralytics
description: importing ultralytics sets OpenCV to 1 thread for the whole MIT process; the YOLO loaders must restore it (cv2.setNumThreads(-1)) — 2351fb15, #872
type: project
---

`import ultralytics` runs `cv2.setNumThreads(0)` at import time (a PyTorch DataLoader workaround), so
every OpenCV call in the MIT process — the detector's page bilateral filter, render warps, resizes,
dilations — ran single-threaded once the balloon/SFX YOLO loaders had been used (verified:
`cv2.getNumThreads()` 20 → 1). Restoring it (`manga_translator/cv_threads.py`, called right after the
import in `bubble_detector._load` and `sfx_detector._load`) took detection 1.28 → 0.58 s and rendering
0.63 → 0.40 s per page warm, renders byte-identical (2026-10-21).

**Why:** the cost hides in "native" time (bilateralFilter, warpPerspective look like irreducible C work in
a profile) and only shows when the same call is timed standalone (0.05 s vs 0.64 s in-pipeline).

**How to apply:** any new code path that imports ultralytics (or another lib that touches global OpenCV
state) must call `restore_opencv_threads()` after the import; when a native OpenCV op looks slow in a
profile, compare it with a standalone call before assuming it is the algorithm. See [[feedback-decomposition-method]].
