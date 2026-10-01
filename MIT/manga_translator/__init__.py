import importlib

import colorama
from dotenv import load_dotenv

colorama.init(autoreset=True)

# #614 — `.env` is loaded by an EXPLICIT `initialize()` call, never as an import side-effect.
# It used to run here and again in `translators/keys.py`, which made the environment
# non-deterministic: a test could not assert "this env var is unset", and the Backend's
# hygienic `buildMitConfig` (env read at one controlled point) fought a package that
# quietly loaded .env the moment anything imported it. Entry points — the server
# (`server/main.py`) and the CLI (`manga_translator/__main__.py`) — call `initialize()`
# before importing anything that reaches `translators.keys`, which snapshots the keys at
# ITS import time. Idempotent, so a second call is free.
_env_loaded = False


def initialize() -> bool:
    """Load `.env` into `os.environ`. Idempotent; True only on the call that loaded it."""
    global _env_loaded
    if _env_loaded:
        return False
    load_dotenv()
    _env_loaded = True
    return True


# #359 — lazy public API (PEP 562). The old `from .manga_translator import *` eagerly
# imported torch + cv2 + transformers + diffusers (multi-GB) on ANY import of this package,
# so even a pure-logic test that only touches `.config` / `.textline_merge` / `.ocr_vlm`
# dragged in the full ML stack. Forwarding attribute access to the heavy implementation
# module on FIRST use keeps `import manga_translator` (and lightweight submodule imports)
# torch-free, while `from manga_translator import Config / Context / MangaTranslator / ...`
# still resolves exactly as before — just at access time, not import time.
def __getattr__(name):
    # import_module (not `from . import`) so resolving the submodule's own name
    # (`manga_translator.manga_translator`) doesn't re-enter __getattr__ → recurse.
    _impl = importlib.import_module(__name__ + '.manga_translator')  # loads torch/cv2/... here
    return _impl if name == 'manga_translator' else getattr(_impl, name)


def __dir__():
    _impl = importlib.import_module(__name__ + '.manga_translator')
    return sorted(set(globals()) | set(dir(_impl)))
