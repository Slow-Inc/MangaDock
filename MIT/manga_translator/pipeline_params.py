"""Pipeline construction globals (#187 seam S12, globals half).

``apply_global_settings`` isolates the process-global side effects the constructor did
inline — the conditional ``ModelWrapper._MODEL_DIR`` override and the two
``torch.backends.*.allow_tf32 = True`` flags — so the value-parsing can stay free of
process globals.

The ``PipelineParams`` value object for the ~20 parsed fields is **deferred until #192**
centralises config (per ``docs/research/mit-core-decomposition-analysis.md``): it is
entangled with the device / ``using_gpu`` / raise logic and ordering in the constructor,
which is best untangled once config parsing is centralised.
"""
import logging
from dataclasses import dataclass
from typing import Optional

import torch

from .utils import ModelWrapper

logger = logging.getLogger(__name__)


def _is_gpu(device: str) -> bool:
    """device.startswith('cuda') or 'mps' — the body of MangaTranslator.using_gpu."""
    return device.startswith('cuda') or device == 'mps'


def apply_global_settings(params) -> None:
    """Apply the process-global construction side effects, verbatim:
    a conditional model-dir override, then enable TF32 on matmul and cuDNN."""
    if params.get('model_dir'):
        ModelWrapper._MODEL_DIR = params.get('model_dir')
    # TF32 on matmul (default False in torch>=1.12) and on cuDNN (default True)
    torch.backends.cuda.matmul.allow_tf32 = True
    torch.backends.cudnn.allow_tf32 = True


@dataclass
class PipelineParams:
    """#187 S12: the constructor's ~13 parsed fields as a value object.

    ``from_params`` is the verbatim extraction of ``MangaTranslator.parse_init_params``:
    the device / ``using_gpu`` / gpu-limited / cuda-availability-raise logic, the
    ``batch_concurrent`` auto-disable, and the field parsing. ``batch_concurrent`` is
    passed in (the constructor sets it before parsing, and this validation may turn it
    off). Keeps the constructor's foot-guns verbatim: ``kernel_size`` has no default
    (``int(None)`` raises if absent), and the raise leaves an unusable half-built object
    either way (so moving the raise here is byte-identical at the behaviour level).
    """
    verbose: bool
    use_mtpe: bool
    font_path: Optional[str]
    models_ttl: int
    batch_size: int
    batch_concurrent: bool
    ignore_errors: bool
    device: str
    gpu_limited_memory: bool
    kernel_size: int
    input_files: list
    save_text: bool
    load_text: bool

    @property
    def using_gpu(self) -> bool:
        return _is_gpu(self.device)

    @classmethod
    def from_params(cls, params: dict, batch_concurrent: bool) -> 'PipelineParams':
        verbose = params.get('verbose', False)
        use_mtpe = params.get('use_mtpe', False)
        font_path = params.get('font_path', None)
        models_ttl = params.get('models_ttl', 0)
        batch_size = params.get('batch_size', 1)

        if batch_concurrent and batch_size < 2:
            logger.warning('--batch-concurrent requires --batch-size to be at least 2. When batch_size is 1, concurrent mode has no effect.')
            logger.info('Suggestion: Use --batch-size 2 (or higher) with --batch-concurrent, or remove --batch-concurrent flag.')
            batch_concurrent = False

        ignore_errors = params.get('ignore_errors', False)
        # check mps for apple silicon or cuda for nvidia
        device_avail = 'mps' if torch.backends.mps.is_available() else 'cuda'
        device = device_avail if params.get('use_gpu', False) else 'cpu'
        gpu_limited_memory = params.get('use_gpu_limited', False)
        if gpu_limited_memory and not _is_gpu(device):
            device = device_avail
        if _is_gpu(device) and (not torch.cuda.is_available() and not torch.backends.mps.is_available()):
            raise Exception(
                'CUDA or Metal compatible device could not be found in torch whilst --use-gpu args was set.\n'
                'Is the correct pytorch version installed? (See https://pytorch.org/)')
        kernel_size = int(params.get('kernel_size'))
        input_files = params.get('input', [])
        save_text = params.get('save_text', False)
        load_text = params.get('load_text', False)

        return cls(
            verbose=verbose, use_mtpe=use_mtpe, font_path=font_path, models_ttl=models_ttl,
            batch_size=batch_size, batch_concurrent=batch_concurrent, ignore_errors=ignore_errors,
            device=device, gpu_limited_memory=gpu_limited_memory, kernel_size=kernel_size,
            input_files=input_files, save_text=save_text, load_text=load_text,
        )
