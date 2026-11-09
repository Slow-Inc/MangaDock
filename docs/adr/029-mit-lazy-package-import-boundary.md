# ADR 029 — Lazy package-import boundary so logic tests/CI run torch-free

- **Status:** Accepted (2026-06-29) — implemented. `manga_translator/__init__.py` and
  `manga_translator/utils/__init__.py` use PEP 562 `__getattr__`; `test/conftest.py` skips
  torch-only tests when torch is absent; `mit-ci.yml` splits into a logic + heavy job.
- **Context:** #359 (tech-debt) · builds on [[008-mit-god-object-characterization-byte-identical-seams]]
  (characterization-first) · the CI gate it unblocks was provisional from PR #355.
- **Scope:** package/subpackage `__init__` import behaviour + the CI test split. No change to
  runtime translate behaviour or any public call site.

## Context

`manga_translator/__init__.py` ran `from .manga_translator import *`, and
`manga_translator/utils/__init__.py` ran `from .inference import *`. Both pulled torch (the
implementation module imports torch; `utils/inference.py` imports torch directly). So **any**
import of the package — even `from manga_translator.config import Config` or
`from manga_translator.utils.generic import Quadrilateral` in a pure-logic test — eagerly
dragged in torch + cv2 + transformers + diffusers (multi-GB). Consequences:

- The `mit-ci` test workflow had to install the full ML stack to run a font-fit unit test, so it
  was slow and stayed `continue-on-error: true` (report-only) — genuine MIT breakage showed green.
- Local logic-test iteration paid the ~20 s ML import every run.

## Decision

Make the heavy imports **lazy at the package boundary** via PEP 562 `__getattr__`:

- `manga_translator/__init__.py.__getattr__(name)` forwards to the implementation module on
  first attribute access; `import manga_translator` and lightweight submodule imports stay
  torch-free, while `from manga_translator import Config/Context/MangaTranslator/...` still
  resolves (just at access time).
- `manga_translator/utils/__init__.py` stops eager-importing `.inference` (the only torch
  puller in utils) and forwards its names (`ModelWrapper`/`InfererModule`/...) lazily.
- `importlib.import_module(__name__ + '.<sub>')` (not `from . import`) is used inside
  `__getattr__` so resolving the submodule's own name doesn't re-enter `__getattr__` and recurse.
- CI: `mit-ci.yml` splits into a **blocking** `logic` job (lightweight install, torch-free
  suite) and a **report-only** `heavy` job (full ML install). `test/conftest.py` `collect_ignore`s
  the torch-only modules when torch is absent; `asyncio_mode = auto` lets the bare-`async def`
  tests run (pytest-asyncio is already a dev dep).

Characterization-first per ADR 008: `test/test_lazy_import.py` pins (in a child interpreter, so
the test file is itself torch-free) that the package + utils imports are torch-free **and** that
the consumed public API still resolves to the same objects.

## Consequences

- **Measured:** torch-needing test files 27 → 12; torch-free collection 338 → 413 tests; full
  suite 0 new failures. The logic gate collects with 0 errors and never imports torch.
- **Pattern:** new heavy deps belong behind a lazy boundary, not an eager package `__init__`.
  A new torch-only test surfaces as a logic-job collection error → add it to `conftest`'s list.
- **Trade-off:** the first attribute access (not import) now pays the ML import cost — invisible
  to real runs (they access immediately) and the whole point for logic runs (they never access).
- **Residual:** 12 files still need torch — genuine model/translator tests, plus deeper transitive
  chains (`pipeline_params → ModelWrapper` top-import, dispatch registries). Freeing those is a
  follow-up slice. The CI grep dep-filter completeness is validated by the PR's own `mit-ci` run.
- **Reversibility:** restore the eager `import *` lines; the `__getattr__`s are additive.
