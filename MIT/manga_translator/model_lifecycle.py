"""Model lifecycle facade (#187 seam S21 / #188).

Folds the two duplicated construction concerns that bracketed the pipeline: the eager
``preload`` block (gated on ``models_ttl == 0``) and the idempotent cleanup-task guard
(``ensure_running`` → ``ModelReaper.ensure_started``). The ``prepare_*`` functions are
injected as a table so this carries no ML stack of its own; ``preload`` is verbatim the
inline block (same order, same upscale/colorizer conditions, same ``device`` threading).
"""
import logging

from .config import Colorizer

logger = logging.getLogger('manga_translator')


class ModelLifecycle:
    def __init__(self, reaper, prepare_fns):
        self._reaper = reaper
        self._prepare = prepare_fns

    def ensure_running(self):
        """Start the background model-reaper if it isn't running (idempotent — the guard
        lives in the reaper). Returns the task."""
        return self._reaper.ensure_started()

    async def preload(self, config, device, models_ttl) -> None:
        """Eagerly load + download the models (not strictly necessary; remove to lazy
        load) — only when ``models_ttl == 0``. Verbatim the inline preload block."""
        if models_ttl == 0:
            logger.info('Loading models')
            if config.upscale.upscale_ratio:
                await self._prepare['upscaling'](config.upscale.upscaler)
            await self._prepare['detection'](config.detector.detector)
            await self._prepare['ocr'](config.ocr.ocr, device)
            await self._prepare['inpainting'](config.inpainter.inpainter, device)
            await self._prepare['translation'](config.translator.translator_gen)
            if config.colorizer.colorizer != Colorizer.none:
                await self._prepare['colorization'](config.colorizer.colorizer)
