"""#359 — importing the `manga_translator` package must not eagerly load torch.

`manga_translator/__init__.py` used to run `from .manga_translator import *`, dragging
torch + cv2 + transformers + diffusers (multi-GB) into EVERY import — even a pure-logic
test that only touches `config`/`textline_merge`/`ocr_vlm`. That made the CI logic gate
slow and forced `mit-ci` to stay report-only. PEP 562 `__getattr__` forwards the public
API lazily, so importing the package (or a lightweight submodule) stays torch-free while
`from manga_translator import Config/MangaTranslator/...` still resolves on first access.

Both checks run the heavy import in a CHILD interpreter (subprocess) so this test file
itself imports nothing heavy and belongs in the torch-free logic suite. The child prints a
`RESULT=<x>` sentinel so an unrelated startup banner on stdout can't confuse the parse.
"""
import os
import re
import subprocess
import sys

_MIT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _result(code: str) -> str:
    """Run `code` in a child interpreter; return the value it prints as `RESULT=<value>`."""
    env = dict(os.environ, PYTHONPATH=_MIT_ROOT, PYTHONIOENCODING='utf-8')
    out = subprocess.run([sys.executable, '-c', code], capture_output=True,
                         encoding='utf-8', errors='replace', env=env)
    assert out.returncode == 0, f"child failed:\n{out.stderr[-1500:]}"
    m = re.search(r'^RESULT=(.*)$', out.stdout, re.MULTILINE)
    assert m, f"no RESULT sentinel in child stdout:\n{out.stdout[-800:]}\n{out.stderr[-800:]}"
    return m.group(1).strip()


def test_importing_package_is_torch_free():
    # The goal: a bare `import manga_translator` must not pull torch into sys.modules.
    got = _result("import manga_translator, sys; print('RESULT=' + str('torch' in sys.modules))")
    assert got == 'False', f"torch leaked on `import manga_translator` (got {got})"


def test_importing_lightweight_submodule_is_torch_free():
    # The payoff: pure-logic tests import lightweight submodules — those must stay torch-free.
    got = _result("from manga_translator.config import Config; import sys; "
                  "print('RESULT=' + str('torch' in sys.modules))")
    assert got == 'False', f"torch leaked via `from manga_translator.config import Config` (got {got})"


def test_package_still_reexports_consumed_public_api():
    # Characterization: the names server/ + mode/ import via `from manga_translator import X`
    # must still resolve to the SAME objects as the implementation module (passes eager & lazy).
    code = (
        "import manga_translator as p\n"
        "from manga_translator import manga_translator as m\n"
        "names = ['Config', 'Context', 'MangaTranslator', 'TranslationInterrupt', 'logger']\n"
        "print('RESULT=' + str(all(getattr(p, n) is getattr(m, n) for n in names)))\n"
    )
    assert _result(code) == 'True', "package no longer re-exports the consumed public API"
