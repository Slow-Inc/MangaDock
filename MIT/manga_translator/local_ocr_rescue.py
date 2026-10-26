"""Local OCR rescue (#1143): read a hard crop with the on-device Hayai recogniser, not the vision gateway.

The rescue path spends one HTTP call per hard box on the vision gateway (12-15 s for the slowest; on ch. 6 pages
10-11, 98 of 153 calls came back empty). The same crops are read locally in ~0.13 s, at a measured confidence
that separates real lettering from text the model invents over artwork. The gateway stays as the fallback: any
failure to load or read falls back to it, so a worker without the model behaves exactly as before.

This is the ladder's second rung only; ``ocr_rescue.py`` keeps the ML-free policy (#172).
"""
import asyncio
import os

from .config import Ocr
from .ocr import get_ocr

_DISABLED_AFTER_FAILURE = False


def local_rescue_enabled() -> bool:
    """``MIT_RESCUE_LOCAL_OCR=0`` restores the gateway-only rescue. On by default."""
    return str(os.environ.get('MIT_RESCUE_LOCAL_OCR', '1')).strip().lower() not in ('0', 'false', 'no', 'off')


async def transcribe_crops_local(crops, device: str) -> list:
    """Read each crop with the local recogniser, preserving order. '' for a read below the confidence floor.

    Raises if the model cannot be loaded, which the caller treats as "use the gateway"."""
    global _DISABLED_AFTER_FAILURE
    if _DISABLED_AFTER_FAILURE:
        raise RuntimeError('local OCR rescue disabled after an earlier failure')
    ocr = get_ocr(Ocr.hayai)
    if not ocr.is_loaded():
        try:
            await ocr.load(device)
        except Exception:
            _DISABLED_AFTER_FAILURE = True
            raise
    return [await asyncio.to_thread(ocr.read_crop, crop) for crop in crops]
