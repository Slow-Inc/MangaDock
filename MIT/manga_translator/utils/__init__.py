import importlib

from .sort import *
from .bubble import is_ignore
from .generic import *
# #359: `.inference` is the only utils submodule that imports torch — do NOT eager-import it,
# or every `from manga_translator.utils import <anything>` (and every utils-submodule import)
# drags in the multi-GB ML stack. Its public names (ModelWrapper / InfererModule / ...) are
# forwarded lazily by __getattr__ below, so model wrappers that need them still resolve on
# first access while pure-logic imports stay torch-free.
from .log import *
from .textblock import *
from .threading import *


def __getattr__(name):
    # import_module (not `from . import`) so resolving the submodule's own name
    # (`...utils.inference`) doesn't re-enter __getattr__ → recurse.
    _inf = importlib.import_module(__name__ + '.inference')  # loads torch here
    return _inf if name == 'inference' else getattr(_inf, name)


def __dir__():
    _inf = importlib.import_module(__name__ + '.inference')
    return sorted(set(globals()) | set(dir(_inf)))
