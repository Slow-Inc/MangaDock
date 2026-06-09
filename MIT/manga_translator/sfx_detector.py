"""SFX / outside-bubble display-text detector wrapper (#168).

The only module that imports ultralytics/torch for SFX detection — kept isolated
(like ``bubble_detector`` #170) so the dedup geometry in ``sfx_merge`` stays pure
and unit-testable. Lazy-loads the AnimeText YOLO and returns one axis-aligned box
per detected SFX / display-text region; on any failure it returns no boxes so the
pipeline degrades to its stage-off behaviour.

Model: ``deepghs/AnimeText_yolo`` (``yolo12x_animetext/model.pt``) — the detector
MangaTranslator uses for outside-speech-bubble text. The repo is **gated**:
``hf_hub_download`` reads ``HF_TOKEN`` from the environment (loaded from MIT/.env by
``manga_translator/__init__.py``), so the download is automatic like every other
pipeline model — no manual step once access is granted to the HF account.
"""
import logging
from typing import List, Tuple

logger = logging.getLogger(__name__)

_REPO = "deepghs/AnimeText_yolo"
_FILE = "yolo12x_animetext/model.pt"
_model = None

Box = Tuple[float, float, float, float]


def _load():
    global _model
    if _model is None:
        from huggingface_hub import hf_hub_download
        from ultralytics import YOLO
        # token=None → huggingface_hub picks up HF_TOKEN from env (gated repo).
        path = hf_hub_download(repo_id=_REPO, filename=_FILE)
        _model = YOLO(path)
        logger.info(f"[SFXDetect] loaded {_REPO}")
    return _model


def detect_sfx_boxes(img_rgb, device: str = "cuda", imgsz: int = 1024,
                     conf: float = 0.30) -> List[Box]:
    """One axis-aligned ``(x1, y1, x2, y2)`` box per detected SFX/display-text
    region, in image coords.

    ``img_rgb`` is an HWC RGB array (pipeline convention); ultralytics expects
    BGR, so we flip channels to match ``bubble_detector``. Empty list on no
    detection or any error.
    """
    try:
        model = _load()
        img_bgr = img_rgb[:, :, ::-1]
        res = model.predict(img_bgr, imgsz=imgsz, conf=conf, device=device,
                            verbose=False)[0]
        if res.boxes is None:
            return []
        return [(float(x1), float(y1), float(x2), float(y2))
                for x1, y1, x2, y2 in res.boxes.xyxy.tolist()]
    except Exception:
        logger.warning("[SFXDetect] detection failed — proceeding without SFX",
                       exc_info=True)
        return []


def unload() -> None:
    """Drop the model so its VRAM can be reclaimed."""
    global _model
    _model = None
