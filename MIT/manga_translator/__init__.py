import importlib

import colorama
from dotenv import load_dotenv

colorama.init(autoreset=True)
load_dotenv()


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
