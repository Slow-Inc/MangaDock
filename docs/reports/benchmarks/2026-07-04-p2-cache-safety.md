# Rolling-context cache-safety — no context-free result under a context-on key (Master Plan 2 P2 / #524)

**Defect (md):** master-plan-2 §Priority-2 + issue #524 (codex, 4-reviewer round). Enabling cross-page
`RollingContext` (`MIT_CONTEXT_PAGES>0`) is **not cache-safe** with the Backend batch precheck:
- The orchestrator prechecks each page and sends **only uncached pages** to MIT
  (`mit-batch-orchestrator.service.ts` `uncachedPages` → `stream.run`).
- MIT `RollingContext` only accumulates the pages it actually translated in that loop
  (`server/batch_runner.py:110`).
- ⇒ cached-page-0 + uncached-page-1 → page 1 is translated with **empty prior context**, then cached under
  the context-enabled patch key. The same key can hold a context-aware **or** context-free translation
  depending on cache state at generation time. This **blocks P2** (the critical cross-page consistency defect).

## Fix (gated, byte-identical when off)
`mit-batch-orchestrator.service.ts`: when `MIT_CONTEXT_PAGES>0` **and** the batch is not fully cached, send the
**full ordered chapter** to MIT (no partial pre-serve) so `RollingContext` is always complete — every page is
regenerated under full context, so a cached-page-N key can never hold a context-free result. When context is
off (default) **or** every page is already cached (each was generated under full context), the per-page
precheck is unchanged.

- `renderConfigHash()` already folds **every** `MIT_*` env key, so `MIT_CONTEXT_PAGES` auto-partitions the
  patch cache: context-on and context-off patches live in separate namespaces (flipping the knob busts the
  cache once — a clean re-translate, not a poisoned mix).
- **Operational requirement (documented):** enabling context needs `MIT_CONTEXT_PAGES` on **both** the MIT
  worker (for `RollingContext`) **and** the Backend process (for send-full + the cache namespace). Setting it
  only on MIT reintroduces the bug (Backend still sends only misses).

## Method (deterministic, no ML / no translator)
Unit-level defect binding via the orchestrator's real precheck→send path, transport stubbed to inspect exactly
which pages reach MIT. The poison shape from #524: page 0 cached, page 1 a miss.

## Result — before → after
| scenario | pages sent to MIT | context complete? | cache-safe? |
|---|---|---|---|
| **BEFORE** (context on, partial cache) | `[1]` (only the miss) | ❌ page 1 sees empty context | ❌ context-free result cached under context-on key |
| **AFTER** (context on, partial cache) | `[0, 1]` (full ordered chapter) | ✅ page 1 sees page 0 | ✅ every cached page was context-complete |
| **AFTER** (context OFF, default) | `[1]` (only the miss) | n/a | ✅ **byte-identical to today** |

![P2 #524: BEFORE sends [1] (context-free, cache-unsafe) → AFTER sends [0,1] (full chapter, cache-safe)](./2026-07-04-p2-cache-safety.png)

## Assessment
- **fix-root:** the exact #524 poison (partial batch under context) now sends the complete ordered chapter, so
  no page is ever translated with truncated context and then cached — the P2-blocking cache-safety hole is closed.
- **no-regression:** the `#294` characterization net (14 tests, the byte-identical extraction guard) stays green;
  the context-off path is provably unchanged (dedicated test asserts only-misses-sent when the knob is unset).
  Wider batch/config suites: **68/68** green.
- **limitation / follow-up:** the first batch after enabling context re-translates the whole chapter (cache
  bust by design — correctness over a one-time cost). `RollingContext` still carries every `dst` line verbatim,
  so a hallucinated/garbled line becomes later-page prompt input (prompt-bleed) — this is why P2 **enable** is
  still sequenced *after* P7's numbered-contract + determinism gate. This fix unblocks that enable; it does not
  itself flip context on (still default-off).

**Tests:** `mit-batch-orchestrator.spec.ts` — `#524 rolling-context cache-safety` (2 tests: full-chapter-on-partial
when on; only-misses when off). RED at `[1] !== [0,1]` before the fix, GREEN after.
