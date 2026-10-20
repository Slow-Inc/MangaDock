"""#614 — `.env` must load on an EXPLICIT call, never as an import side-effect.

`manga_translator/__init__.py` and `translators/keys.py` both used to call `load_dotenv()`
at module scope. Two consequences the team kept paying for:

1. **The environment was non-deterministic in tests.** No test could assert "this var is
   unset", because merely importing the package could populate it from a developer's `.env`.
2. **It fought the Backend's hygienic config.** `Backend/src/books/mit-config.ts`
   (`buildMitConfig`) reads env at ONE controlled point; a package that loads `.env` the
   moment anything imports it makes that point meaningless.

The fix moves the load into `manga_translator.initialize()`, which the two entry points —
`server/main.py` and `manga_translator/__main__.py` — call before anything reaches
`translators.keys` (keys snapshots the API keys at ITS import time, so ordering is the
landmine this guards).

The import-time check runs in a CHILD interpreter (same pattern as `test_lazy_import.py`)
so the spy sees a genuinely fresh interpreter, and so this file belongs in the torch-free
logic gate. The child prints a `RESULT=` sentinel so a startup banner can't confuse the parse.
"""
import importlib
import os
import re
import subprocess
import sys

_MIT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_SERVER_MAIN = os.path.join(_MIT_ROOT, 'server', 'main.py')
_CLI_MAIN = os.path.join(_MIT_ROOT, 'manga_translator', '__main__.py')
_KEYS = os.path.join(_MIT_ROOT, 'manga_translator', 'translators', 'keys.py')
_BENCH_TUNED = os.path.join(_MIT_ROOT, 'tools', 'bench_render_tuned.py')


def _result(code: str) -> str:
    """Run `code` in a child interpreter; return the value it prints as `RESULT=<value>`."""
    env = dict(os.environ, PYTHONPATH=_MIT_ROOT, PYTHONIOENCODING='utf-8')
    out = subprocess.run([sys.executable, '-c', code], capture_output=True,
                         encoding='utf-8', errors='replace', env=env)
    assert out.returncode == 0, f"child failed:\n{out.stderr[-1500:]}"
    m = re.search(r'^RESULT=(.*)$', out.stdout, re.MULTILINE)
    assert m, f"no RESULT sentinel in child stdout:\n{out.stdout[-800:]}\n{out.stderr[-800:]}"
    return m.group(1).strip()


# --- the behaviour: import does not load, initialize() does -----------------------

def test_importing_package_does_not_load_dotenv():
    """`import manga_translator` must not pull .env in. The spy is installed BEFORE the
    import inside the child, so a module-scope `load_dotenv()` would be seen and counted."""
    got = _result(
        "import dotenv, manga_translator\n"
        "calls = []\n"
        "dotenv.load_dotenv = lambda *a, **k: calls.append(1)\n"
        "manga_translator.load_dotenv = lambda *a, **k: calls.append(1)\n"
        "import importlib; importlib.reload(manga_translator)\n"
        "after_import = len(calls)\n"
        "manga_translator.initialize()\n"
        "print('RESULT={} {}'.format(after_import, len(calls)))"
    )
    assert got == '0 1', f"expected import=0 loads then initialize=1 load, got {got!r}"


def test_importing_keys_does_not_load_dotenv():
    """The landmine the issue names: `translators/keys.py` also used to call `load_dotenv()`.
    Importing it must be inert too — otherwise `initialize()` in the entry point is pointless
    for every consumer that reaches keys first.

    Loaded BY FILE PATH, not as `manga_translator.translators.keys`: importing it as a package
    submodule runs the `translators` package init, which reaches the impl module and imports
    torch — and this file belongs in the torch-free logic gate. `keys.py` imports only `os`,
    so a standalone load exercises exactly the module-scope behaviour under test. (CI caught
    this: the first version of this test did the package import and failed the gate with
    `ModuleNotFoundError: No module named 'torch'`.)
    """
    got = _result(
        "import importlib.util, dotenv\n"
        "calls = []\n"
        "dotenv.load_dotenv = lambda *a, **k: calls.append(1)\n"
        f"spec = importlib.util.spec_from_file_location('keys_under_test', {_KEYS!r})\n"
        "m = importlib.util.module_from_spec(spec)\n"
        "spec.loader.exec_module(m)\n"
        "print('RESULT={} {}'.format(len(calls), bool(m.CUSTOM_OPENAI_API_KEY is not None)))"
    )
    assert got == '0 True', f"importing translators.keys loaded .env (got {got!r})"


def test_initialize_is_idempotent():
    """A second call must not re-read the file, and the module must report which call did the
    work — that is what lets an entry point call it defensively."""
    got = _result(
        "import manga_translator\n"
        "first = manga_translator.initialize()\n"
        "second = manga_translator.initialize()\n"
        "print('RESULT={} {}'.format(first, second))"
    )
    assert got == 'True False', f"expected initialize() to report True then False, got {got!r}"


# --- the structure: nothing regressed into module-scope loading --------------------

def test_no_module_scope_load_dotenv_remains():
    """Guard the two files by source. A future edit that re-adds `load_dotenv()` at module
    scope is exactly the regression this issue closed, and it is invisible to the child-spy
    tests above only if the spy is missed — so pin the source too."""
    for path in (os.path.join(_MIT_ROOT, 'manga_translator', '__init__.py'), _KEYS):
        with open(path, encoding='utf-8') as fh:
            src = fh.read()
        # The only permitted occurrence is inside initialize()'s body, i.e. indented; a
        # commented mention is documentation, not a call.
        offenders = [ln for ln in src.splitlines()
                     if 'load_dotenv(' in ln
                     and not ln.startswith((' ', '\t'))
                     and not ln.lstrip().startswith('#')]
        assert not offenders, f"{path} calls load_dotenv() at module scope: {offenders}"


def test_both_entrypoints_initialize_before_importing_keys():
    """Ordering is the whole risk: `initialize()` after the first keys import is a no-op that
    silently leaves every API key empty. Assert the call precedes the first
    `manga_translator`/`server` import in each entry point.

    `tools/bench_render_tuned.py` is in the list because it builds a real `MangaTranslator`. It
    used to receive `.env` for free via the import side-effect, so it is exactly the caller
    that regresses when the load becomes explicit — and a benchmark tool falling back to default
    keys produces a reference image that gets blamed on a render change.
    """
    for path in (_SERVER_MAIN, _CLI_MAIN, _BENCH_TUNED):
        with open(path, encoding='utf-8') as fh:
            lines = fh.read().splitlines()
        init_at = next((i for i, ln in enumerate(lines) if '_initialize_env()' in ln), None)
        assert init_at is not None, f"{path} never calls initialize()"
        first_pkg = next((i for i, ln in enumerate(lines)
                          if re.match(r'\s*(from|import)\s+(manga_translator|server)\b', ln)
                          and '_initialize_env' not in ln), None)
        assert first_pkg is not None, f"{path} imports no package module to check ordering against"
        assert init_at < first_pkg, (
            f"{path} imports the package at line {first_pkg + 1} but only calls initialize() at "
            f"line {init_at + 1} — keys would snapshot the env before .env is loaded"
        )


def test_package_still_exposes_initialize():
    """The lazy PEP 562 `__getattr__`/`__dir__` forward unknown names to the implementation
    module, so a missing `initialize` would be masked rather than raised — and checking it via
    `dir()` or `getattr()` on an unknown name would pull torch in. `vars()` is the module's own
    `__dict__`: it sees a real export and costs nothing. (CI caught this too — the first version
    used `dir()` and failed the torch-free gate.)"""
    import manga_translator
    assert callable(vars(manga_translator).get('initialize')), \
        'manga_translator.initialize is not a real module export'
