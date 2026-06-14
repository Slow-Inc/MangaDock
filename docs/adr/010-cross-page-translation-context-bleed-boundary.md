# ADR 010 — Cross-page translation context: TranslationMemory bleed boundary + per-batch RollingContext

- **Status:** Accepted (2026-06-14) — implemented. The in-worker `TranslationMemory`
  bleed boundary and per-mode `build_prev_context` windows are live in
  `manga_translator/`; the per-batch `RollingContext` is live in `server/` and wired
  through `batch_runner`, but ships **default-off** (`MIT_CONTEXT_PAGES=0`), so the batch
  path is byte-identical until an operator opts in.
- **Context PRDs:** #136/#140 (in-worker cross-page memory + its bleed boundary) ·
  #157 (per-series context) · #159 (per-batch rolling context) · #155 (context for every
  LLM translator, not just ChatGPT — implemented locally) · #187 seams S6/S16/S26a/S17.
- **Area:** MIT / Translation Session.

## Context

A chapter is many pages translated independently. Without any memory of prior pages, an
LLM translator re-decides character names, honorifics, and pronouns page-by-page, so the
same name renders three different ways across one chapter. Carrying *prior-page* dialogue
into the next page's prompt fixes that — but it introduces a state-lifetime hazard.

The MIT worker holds the translation pipeline as a **process-lifetime singleton**
(`mode/share.py`'s global `_translator`; `PIPELINE.md` §4.5). The original cross-page
memory was two lists living directly on that singleton, and they grew with **every page
the worker ever translated**. That made pages from *unrelated jobs* bleed into each
other's context-aware prompts — the **#136 singleton page-context bleed**, recorded as
landmine **L9** in `PIPELINE.md` (`translation_memory.py` S16 — "L9 bleed boundary
explicit"). The hazard is real and load-bearing in two opposite directions:

- We **want** continuity *within* one chapter (name/pronoun consistency, #140) and even
  *across* a series (#157 series context) — so we cannot simply wipe memory aggressively.
- We **do not want** continuity to leak across *unrelated jobs* sharing the same worker
  process — that is the #136 bleed.

The forces, then: keep enough state to make a chapter read consistently, draw an explicit
boundary so unrelated jobs cannot leak, and do it without changing today's byte-for-byte
output unless an operator deliberately turns the feature on.

A second wrinkle: MIT translates in **three different modes** (single-page,
sequential-batch, concurrent-batch), and each computes "which prior pages count as
context" differently. That divergence is not accidental — it is correctness-bearing
(concurrent pages aren't translated yet when a sibling page builds its window), so it
must be *preserved*, not unified away.

## Decision

Translation consistency across a chapter is delivered by prior-page context with an
**explicit cross-page bleed boundary**, split across two cooperating mechanisms with
deliberately different state lifetimes.

### 1. In-worker memory with a patch-path-only reset (the #136/L9 boundary)

`manga_translator/translation_memory.py` wraps the two accumulating lists that used to
sit on the god object into a `TranslationMemory` value object:

- `all_page_translations` — per-page `{raw_text: translation}` dicts.
- `original_page_texts` — the parallel per-page `{index: raw_text}` dicts (needed by
  concurrent mode, which references *originals*, not yet-untranslated siblings).
- `reset()` rebinds **both** lists to fresh empties (verbatim the old
  `reset_page_context` — a rebind, not `.clear()`, so a caller still holding the old list
  keeps its contents).

The instance is created once per worker (`manga_translator.py:181`,
`self._translation_memory = TranslationMemory()`) and append sites stay caller-driven
(`manga_translator.py:391/396`, `:1219-1220`, `:1613-1616`), so the seam is
byte-identical to the pre-extraction god object.

The boundary itself is **where `reset()` is called from**: only
`reset_page_context()` (`manga_translator.py:1390-1399`) calls it, and the **only** caller
of `reset_page_context()` is `translate_patches()` (`manga_translator.py:1408`, first line
of the method). This is the **L9 asymmetry**: the single-page/Reader patch path resets the
cross-page memory **at the start of every request**, so a chapter translated patch-by-patch
through `translate_patches` starts clean each call — but the CLI/`translate_batch` paths
that share the same singleton **never** reset it (they accumulate across pages within a
run by design). The asymmetry is documented in the module docstring ("`reset` is still
only called from `translate_patches` (the L9 asymmetry)") and is the structural reason the
#136 bleed cannot recur on the patch path.

### 2. Per-mode context windows (`build_prev_context`, S6)

`manga_translator/prev_context.py::build_prev_context` is the pure extraction of
`MangaTranslator._build_prev_context` (the thin delegate at `manga_translator.py:807-817`).
It preserves the **per-mode index policy** exactly:

- **single-page** (`current_page_index is None`, `batch_index is None`): window is **all**
  prior done pages (`available_pages = all_page_translations`).
- **sequential** (`current_page_index` set): window is the slice **before** the current
  page (`all_page_translations[:current_page_index]`).
- **concurrent** (`batch_index` + `batch_original_texts` set): window is done pages **plus**
  this batch's pages *before* the current one, and it uses **original source text**
  (`use_original_text=True` when `self.batch_concurrent and self.batch_size > 1`,
  `manga_translator.py:1713`) — because the concurrent siblings are translated in parallel
  and their *translations* don't exist yet, so the original JP lines are the only stable
  reference. Landmine **L7** lives here: the concurrent `available_pages.index(page)`
  back-mapping is a **first-match** lookup, so duplicate-content pages resolve to the
  earliest index by design (`prev_context.py:64`). Both `context_size <= 0` and an empty
  `available_pages` short-circuit to `""`.

`context_size` defaults to `0` (`manga_translator.py:180`,
`params.get('context_size', 0)`), so the in-worker context engine is also off unless
configured. The built block is injected into the GPT-family translator via
`set_prev_context` (`chatgpt.py:84-85`), which appends it as a `system` message at
request time (`chatgpt.py:687-688`, `chatgpt_2stage.py:810-811`).

### 3. Per-batch RollingContext (#159, the cross-job-safe path)

For webhook-mode **Batch Jobs**, `server/rolling_context.py::RollingContext` is a
stdlib-only (no ML, no `self`, no worker state) accumulator that is **constructed inside
the batch loop** (`server/batch_runner.py:73-76`) and therefore **born and dies with that
one job**. Each page's translated `dst` lines are fed in via `add_page`
(`batch_runner.py:110`), and the next page's prompt is seeded from the most-recent pages
via `render_block` (`batch_runner.py:94-96`), which emits the numbered
`<|n|>sentence` block. It is bounded by:

- `MIT_CONTEXT_PAGES` (→ `max_pages`, **default 0 = off**): how many recent pages to carry.
  `0` makes `render_block()` always return `""`, so no `prev_context` is ever injected and
  the batch path stays **byte-identical to today**.
- `MIT_CONTEXT_MAX_CHARS` (→ `max_chars`, default 1500): a character cap on the rendered
  block (oldest lines dropped first) so the local tokenizer never truncates the real
  per-page queries.

Because the accumulator is local to the loop — and the worker still resets its own
per-request memory — **the #136 cross-job bleed class stays structurally impossible**: a
`RollingContext` cannot outlive or reach across jobs (`batch_runner.py:68-72` comment).
The rendered block rides `config.translator.prev_context` (`batch_runner.py:42-44`), which
flows through `Config.chatgpt_config` (`config.py:331-337`) → `config_gpt.py:229`
`append_series_context` into `chat_system_template` for **every** ConfigGPT-family
translator (ChatGPT, ChatGPT-2stage, Qwen3, Gemini, DeepSeek, custom_openai —
`config_gpt.py:221-229`). This is the local realization of **PRD #155** ("context for
every LLM translator, not just ChatGPT"): both `series_context` (#157) and `prev_context`
(#159) reuse the same single append seam, so an absent context yields a byte-identical
prompt.

`RollingContext` is unit-tested in `MIT/test/test_rolling_context.py` (page order,
disabled/empty → `""`, page cap keeps most-recent, char cap drops oldest, blank lines
ignored) — the import-light design (`North Star`) is what lets it test without the ML
stack.

## Alternatives considered

- **Reset context per chapter (wipe the in-worker memory at every chapter boundary).**
  Rejected — it breaks **series continuity (#157)**: a deliberate goal is that context
  can span pages and even a series, so an aggressive per-chapter wipe would throw away
  the name/pronoun consistency the feature exists to provide. The chosen boundary resets
  only on the patch path (L9), not on the batch/CLI paths, precisely to keep continuity
  where it is wanted.

- **A global per-series cross-job cache (shared memory keyed by series across jobs).**
  Rejected — it **reintroduces the #136 bleed**: any shared, job-spanning store on the
  singleton is exactly the leak the L9 boundary and the loop-local `RollingContext` were
  built to make impossible. Per-series context is instead supplied as immutable input
  (`series_context`, #157), not as accumulating shared state.

- **Unify the three per-mode context windows into one code path.** Deferred — the
  divergence is **load-bearing**: concurrent mode must reference *original* source text
  (siblings aren't translated yet) and use first-match index back-mapping (L7), while
  single/sequential reference *translations* with different slice semantics. Collapsing
  them would silently change which lines seed which prompt. `build_prev_context` keeps the
  policy explicit-by-argument rather than merging it.

- **Concatenate raw page history into the prompt (no window/char caps).** Rejected — token
  overhead. Both `context_size`/`pages_used` (in-worker) and `max_pages`/`max_chars`
  (per-batch) exist specifically to bound the block so the local tokenizer never truncates
  the actual per-page queries; unbounded history would blow the context budget.

## Consequences

- **Positive:**
  - Improves name/pronoun/honorific consistency *within* a chapter by seeding each page's
    prompt with recent prior-page dialogue.
  - The #136 singleton bleed is structurally prevented on two fronts: the patch path
    resets per request (L9), and the batch path's memory is loop-local so it cannot leak
    across jobs.
  - Default-off (`MIT_CONTEXT_PAGES=0`, `context_size=0`) means the batch path is
    **byte-identical** to today until an operator opts in; same local-first rule as
    `series_context`.
  - PRD #155 is satisfied for every GPT-family translator via the single
    `append_series_context` seam — ChatGPT, Qwen3, Gemini, DeepSeek, custom_openai all
    carry the block, not just ChatGPT.
  - The S16/S6/S26a extractions make the bleed boundary and per-mode policy explicit,
    testable objects (`test_rolling_context.py`, plus the pure `build_prev_context` /
    `build_page_translation_record`), so the invariants are no longer buried in the god
    object.

- **Negative / limits (landmines):**
  - **Patch-path-only reset (L9)** is a subtle invariant: if any future caller invokes the
    in-worker context-aware path *without* going through `translate_patches` (which is the
    sole `reset_page_context()` caller), the #136 cross-job bleed returns. The reset is not
    a general lifecycle hook — it is one line at the top of one method.
  - **Per-mode asymmetry (L7 + the three windows)** is correctness-bearing: the concurrent
    first-match `index()` back-mapping resolves duplicate-content pages to the earliest
    index, and the three modes intentionally choose different source lists and slices.
    Naïvely unifying or "fixing" these will change output.
  - Two separate carriers exist for the same idea — the in-worker `_build_prev_context` →
    `set_prev_context` (`system` message) path and the per-batch
    `prev_context` → `chatgpt_config` (`chat_system_template` append) path — so a reader
    must know which path a given request takes.

- **Follow-ups:**
  - Enabling the per-batch context in production is an operator decision
    (`MIT_CONTEXT_PAGES` > 0); until then the batch path's behavior is unchanged.
  - The deferred unification of the three per-mode windows remains open but is intentionally
    *not* scheduled — it would only be worth it if the divergence can be expressed without
    losing the original-text / index-back-mapping semantics.
