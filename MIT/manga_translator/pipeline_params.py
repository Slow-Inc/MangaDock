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
import torch

from .utils import ModelWrapper


def apply_global_settings(params) -> None:
    """Apply the process-global construction side effects, verbatim:
    a conditional model-dir override, then enable TF32 on matmul and cuDNN."""
    if params.get('model_dir'):
        ModelWrapper._MODEL_DIR = params.get('model_dir')
    # TF32 on matmul (default False in torch>=1.12) and on cuDNN (default True)
    torch.backends.cuda.matmul.allow_tf32 = True
    torch.backends.cudnn.allow_tf32 = True
