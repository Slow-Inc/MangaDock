"""Shared torch-free import of `manga_translator.translators.custom_openai` for the logic gate (#359).

Used by test_custom_openai_none_content.py (#631) and test_custom_openai_thinking.py (#623).
"""
import os
import sys
import types


_MISSING = object()


def load_custom_openai():
    """Import manga_translator.translators.custom_openai without loading torch.

    The `translators` package __init__ and `manga_translator.utils.inference` are the
    two torch entry points in this import chain (same rationale as conftest.py #359).
    They are stubbed in sys.modules for the duration of the import only; every entry
    touched here is restored afterwards — including the translator submodules this
    import pulls in, whose classes would otherwise carry the stub base classes in
    their MRO — so later tests in the session re-import them fresh and nothing leaks.
    """
    if 'manga_translator.translators.custom_openai' in sys.modules:
        return sys.modules['manga_translator.translators.custom_openai']

    import manga_translator

    _touched = (
        'manga_translator.utils.inference',
        'manga_translator.translators',
        'manga_translator.translators.common',
        'manga_translator.translators.config_gpt',
        'manga_translator.translators.keys',
        'manga_translator.translators.custom_openai',
    )
    saved = {name: sys.modules.get(name) for name in _touched}
    # __dict__, not hasattr/getattr: the package's PEP 562 __getattr__ would import
    # the heavy manga_translator.manga_translator module (torch).
    saved_parent_attr = manga_translator.__dict__.get('translators', _MISSING)

    try:
        # 1) stub the torch-only utils submodule: common.py does
        #    `from ..utils import InfererModule, ModelWrapper`, which would otherwise
        #    trigger utils.__getattr__ -> import utils.inference -> torch.
        inf = types.ModuleType('manga_translator.utils.inference')

        from manga_translator.utils.log import get_logger

        class InfererModule:
            def __init__(self):
                self.logger = get_logger(self.__class__.__name__)

        class ModelWrapper:
            """Empty stand-in: needed only as a base class for common.py's class
            definitions; never instantiated by these tests."""

        inf.InfererModule = InfererModule
        inf.ModelWrapper = ModelWrapper
        sys.modules['manga_translator.utils.inference'] = inf

        # 2) stub the translators package __init__ (it imports the ML stack).
        pkg = types.ModuleType('manga_translator.translators')
        pkg.__path__ = [os.path.join(os.path.dirname(manga_translator.__file__), 'translators')]
        sys.modules['manga_translator.translators'] = pkg
        manga_translator.__dict__['translators'] = pkg

        import manga_translator.translators.custom_openai as co
    finally:
        for name, prev in saved.items():
            if prev is None:
                sys.modules.pop(name, None)
            else:
                sys.modules[name] = prev
        if saved_parent_attr is _MISSING:
            manga_translator.__dict__.pop('translators', None)
        else:
            manga_translator.__dict__['translators'] = saved_parent_attr

    return co
