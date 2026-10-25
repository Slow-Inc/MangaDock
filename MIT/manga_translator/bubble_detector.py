"""Speech-balloon segmentation wrapper (#170).

The only module that imports ultralytics/torch for bubble detection — kept
isolated so the association/grouping logic in ``bubble_association`` stays pure
and unit-testable. Lazy-loads a YOLOv8-seg speech-bubble model and returns one
polygon per detected balloon; on any failure it returns no balloons so the
pipeline degrades to its stage-off behaviour.

Model: ``kitsumed/yolov8m_seg-speech-bubble`` — the default MangaTranslator
uses; ~490 MB GPU transient, ~30 ms/page after warmup (measured on the 12 GB
box, #170 proof).
"""
import logging
from typing import List, Tuple

logger = logging.getLogger(__name__)

_REPO = "kitsumed/yolov8m_seg-speech-bubble"
_FILE = "model.pt"
_model = None


def _load():
    global _model
    if _model is None:
        from huggingface_hub import hf_hub_download
        from ultralytics import YOLO
        from .cv_threads import restore_opencv_threads
        restore_opencv_threads()   # the import left OpenCV single-threaded (#872)
        path = hf_hub_download(repo_id=_REPO, filename=_FILE)
        _model = YOLO(path)
        logger.info(f"[BubbleSeg] loaded {_REPO}")
    return _model


def detect_bubbles(img_rgb, device: str = "cuda", imgsz: int = 1024,
                   conf: float = 0.30) -> List[List[Tuple[float, float]]]:
    """One polygon (list of (x, y) px) per detected balloon, in image coords.

    ``img_rgb`` is an HWC RGB array (pipeline convention); ultralytics expects
    BGR, so we flip channels to match the proof run. Empty list on no detection
    or any error.
    """
    try:
        model = _load()
        img_bgr = img_rgb[:, :, ::-1]
        res = model.predict(img_bgr, imgsz=imgsz, conf=conf, device=device,
                            verbose=False)[0]
        if res.masks is None:
            return []
        return [[(float(x), float(y)) for x, y in poly] for poly in res.masks.xy]
    except Exception:
        logger.warning("[BubbleSeg] detection failed — proceeding without "
                       "balloons", exc_info=True)
        return []


def preload(device: str = "cuda") -> bool:
    """Load the balloon-seg weights onto `device` so the first page does not pay for it.

    Best-effort: any failure (download/GPU) only logs and leaves the lazy path in place.
    """
    try:
        import numpy as np
        model = _load()
        # A tiny warm-up predict is what actually moves the weights onto the device.
        model.predict(np.zeros((64, 64, 3), dtype=np.uint8), imgsz=64, conf=0.99, device=device, verbose=False)
        logger.info(f"[BubbleSeg] preloaded on {device}")
        return True
    except Exception:
        logger.warning("[BubbleSeg] preload failed - it will lazy-load on the first page", exc_info=True)
        return False


def unload() -> None:
    """Drop the model so its VRAM can be reclaimed."""
    global _model
    _model = None
