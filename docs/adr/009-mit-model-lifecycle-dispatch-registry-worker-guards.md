# ADR 009 — Model lifecycle: DispatchRegistry lazy-cache + ModelLifecycle preload/reaper + worker port guards

- **Status:** Accepted (2026-06-14) — implemented. All three facets are landed on `main`: `DispatchRegistry`
  (S22), `ModelLifecycle` (S21), and the `worker_lifecycle` guards (#193). The `OfflineInpainter`/`INPAINTERS`
  contract this records is the existing seam; ADR 003's `flux_klein` inpainter that plugs into it is a separate,
  not-yet-implemented decision.
- **Context:** #188 (model load/lifecycle + translator base abstractions) and #187 (god-object decomposition) —
  see `docs/reports/mit-refactor-progress.md`. #193 (worker `--start-instance` lifecycle).
- **Relates to:** ADR 003 — the `OfflineInpainter` contract + `INPAINTERS` registry described here is the exact
  seam `Inpainter.flux_klein` plugs into, so this is a prerequisite reference for ADR 003.

## Context

The MIT inference server loads six independent families of heavy ML models — **detector, OCR, inpainter,
upscaler, colorizer, translator**. Before this work, each family's `__init__` module carried its own
byte-identical copy of the *same* lazy-load-and-cache plumbing: a module-level registry dict, a `get_X`
that instantiated-on-first-use and cached, and an `unload` that popped the cache. The trio differed only in
three trivial ways — the registry dict, the cached type, and the noun in the "not found" error message —
yet it was duplicated six times, so a fix to the caching quirk had to be made (and kept consistent) in six
places.

Two more lifecycle concerns were tangled into the driver god object (`manga_translator.py`):

1. An eager **preload** block (gated on `models_ttl == 0`) that downloaded/loaded every model up front, plus an
   idempotent **background reaper** guard that started the TTL-unload loop. Both were inline in the driver, so
   they could not be unit-tested without importing the full ML stack.
2. The `--start-instance` front server launches the translation worker as a subprocess on `front_port + 1`.
   The inline launch had **no startup port-collision check**: if a previous worker was orphaned on that port,
   the new subprocess failed to bind and the front server hung forever waiting for a `/register` that never
   came (#193). Shutdown was also fragile — uvicorn overrides the process signal handlers, so the SIGINT path
   alone leaked the worker on Ctrl+C.

The forces: **remove the six-way duplication without changing behaviour** (the lazy-cache quirk and error
message are load-bearing — see below), **make lifecycle logic unit-testable off the ML stack**, and **convert
the silent worker hang into a loud, actionable failure** — all under the North Star (simplest construct that
suffices, extract for testability when it pays off, surgical changes).

## Decision

**1. One `DispatchRegistry(registry, kind)` for all six dispatch modules.**
`MIT/manga_translator/dispatch_registry.py` folds the duplicated trio into a single small class with `get`
(lazy-instantiate + cache) and `async unload` (pop). Each module constructs one
`_registry = DispatchRegistry(<DICT>, '<noun>')`, then exposes `get_X` as a thin wrapper over `_registry.get`
and re-binds `unload = _registry.unload`, while keeping its **own** divergent `prepare`/`dispatch` bodies
(different model methods, signatures, and `prepare`-load behaviour, so they genuinely cannot be unified):

| Module (`manga_translator/.../__init__.py`) | registry dict | `kind` noun |
|---|---|---|
| `detection` | `DETECTORS` (5 entries) | `'detector'` |
| `ocr` | `OCRS` (4 entries) | `'OCR'` |
| `inpainting` | `INPAINTERS` (5 entries) | `'inpainter'` |
| `upscaling` | `UPSCALERS` (3 entries) | `'upscaler'` |
| `colorization` | `COLORIZERS` (1 entry) | `'colorizer'` |
| `translators` | `TRANSLATORS` | `'translator'` |

Behaviour is preserved **verbatim**, including the deliberate `if not self._cache.get(key)` re-create quirk
(a falsy cached instance re-instantiates) and the `','.join(self._registry)` choice list in the not-found
`ValueError` — both called out as load-bearing in the module docstring. The same S22 also removed the global
`MODEL` in detection.

**2. `OfflineInpainter` base + `INPAINTERS` registry as the inpainter swap seam.**
`MIT/manga_translator/inpainting/common.py:16-24` defines `OfflineInpainter(CommonInpainter, ModelWrapper)`
with `_MODEL_SUB_DIR = 'inpainting'`, an `_inpaint` that delegates to `self.infer(...)`, and an abstract
`_infer`. `MIT/manga_translator/inpainting/__init__.py:13-19` maps the five built-in inpainters through that
contract — `Inpainter.default → AotInpainter`, `lama_large → LamaLargeInpainter`, `lama_mpe → LamaMPEInpainter`,
`none → NoneInpainter`, `original → OriginalInpainter`. The module's `prepare`/`dispatch` only call
`download()`/`load()` when the instance `isinstance(..., OfflineInpainter)`, so a new model can be added by
registering a class against the contract — no driver change. (`InpainterConfig.inpainter` defaults to
`Inpainter.lama_large`.)

**3. `ModelLifecycle` facade for preload + reaper, ML-stack-free.**
`MIT/manga_translator/model_lifecycle.py` defines `ModelLifecycle(reaper, prepare_fns)`. The `prepare_*`
functions are injected as a dict table, so the facade carries **no ML stack of its own**.
`preload(config, device, models_ttl)` is verbatim the inline preload block — it runs only when
`models_ttl == 0`, in the same order, with the same `upscale.upscale_ratio` and `colorizer != Colorizer.none`
conditions and the same `device` threading. `ensure_running()` delegates to `reaper.ensure_started()` (the
idempotency guard lives in the reaper). It is wired in `manga_translator.py` (the table built at line 174,
`preload` called in `translate` (line 380) and `_translate_until_translation` (line 1240), `ensure_running`
called after in `_translate` (line 490) and `_translate_until_translation` (line 1243)).

**4. `worker_lifecycle` port guards + idempotent terminate (#193).**
`MIT/server/worker_lifecycle.py` is pure stdlib (`socket`/`subprocess`):
- `port_is_free(host, port)` — plain bind, **no `SO_REUSEADDR`**, so an actively-listening orphaned worker
  reliably reports the port as taken.
- `ensure_worker_port_free(worker_host, worker_port, front_port)` — **fail-loud**: raises a `RuntimeError`
  naming both ports and pointing at `MIT/README.md > Worker lifecycle` when the worker port is occupied,
  instead of letting the subprocess silently fail to bind.
- `terminate_process(proc, timeout=5.0)` — idempotent (no-op on `None` or an already-exited proc), escalating
  `terminate()` → `kill()` on timeout.

`server/main.py` wires these: `start_translator_client_proc` calls `ensure_worker_port_free('127.0.0.1', port,
params.port)` before `subprocess.Popen`, then registers `terminate_process` on `atexit`, the SIGINT/SIGTERM
handlers, and the `__main__` `finally` — three paths, all safe to overlap because terminate is idempotent
(needed because uvicorn overrides the signal handlers, leaking the worker on Ctrl+C through the signal path
alone).

All four facets are unit-tested **without the ML stack or a real worker**: `test/test_dispatch_registry.py`
imports only `manga_translator.dispatch_registry`; `test/test_model_lifecycle.py` uses `SimpleNamespace` mocks
+ `config.Colorizer`; `test/test_worker_lifecycle.py` uses only `socket`/`subprocess`.

## Alternatives considered

- **Per-module duplicated cache logic (status quo before S22).** Each `__init__` keeps its own copy of the
  get/cache/unload trio. Rejected — it duplicated identical plumbing six times; a fix to the lazy-cache quirk
  or error message had to land in six places, and S22 measured the trio as byte-identical across modules
  (`docs/reports/mit-refactor-progress.md`, S22 row), so a single shared `DispatchRegistry` is the simpler
  equivalent that removes the duplication rather than propping it up.
- **One monolithic `ModelManager` wrapping all six families.** A single class owning load/dispatch/unload for
  detector + OCR + inpainter + upscaler + colorizer + translator. Rejected — the `prepare`/`dispatch` bodies
  genuinely diverge (different model methods, signatures, and prepare-load behaviour per family), so a unified
  wrapper would have to special-case each family internally, recreating the divergence inside one class. Only
  the truly identical part (the cache trio) is shared; divergent parts stay per-module.
- **No worker port pre-check (status quo).** Let the worker subprocess start and fail to bind on its own.
  Rejected — that is exactly the #193 symptom: the front server hangs forever on a `/register` that never
  arrives, with no error surfaced. `ensure_worker_port_free` converts that silent hang into a loud
  `RuntimeError`.

## Consequences

- **Positive:** the six-way lazy-cache duplication collapses to one ~30-line `DispatchRegistry`, behaviour
  preserved byte-identical (full-stack E2E byte-exact per the S22 row); preload + reaper logic is now a small
  injected-table facade unit-tested in milliseconds off the ML stack; the `OfflineInpainter`/`INPAINTERS`
  contract makes new inpainters a registry entry, not a driver edit; the worker port guard turns the #193
  silent hang into an actionable error, and `terminate_process` (idempotent across atexit + signals +
  `finally`) means the worker can never outlive the front server.
- **Negative / limits:** the deliberate quirks are now centralised but still load-bearing — the
  `if not self._cache.get(key)` re-create branch and the exact error wording must stay verbatim or behaviour
  shifts. `ModelLifecycle` only consolidates `preload` + `ensure_running`; the usage **tracker** and
  **unloader** remain wired directly into the driver (not behind the facade). Eager preload is still
  unconditionally enabled when `models_ttl == 0` — it is not yet a runtime knob.
- **Follow-up:** deferring/disabling the `models_ttl == 0` eager preload is a startup-latency lever (lazy-load
  on first request instead of paying the full download/load up front). The other half of #188 — the
  translator **base abstraction** (`BaseGPTTranslator`) — is still open. ADR 003's `Inpainter.flux_klein`
  plugs into the `OfflineInpainter` contract described here; that inpainter is a separate decision and is not
  yet implemented in this codebase.
