# Series name memory for the single-page production path (#980 follow-up)

- **Date:** 2026-10-23 · **Files:** `manga_translator/series_glossary_memory.py` (new), `manga_translator.py`
  (`translate_patches`), `test/test_series_glossary_memory.py`.

## Problem

Production translates **one page per request**, so the batch path's name glossary (#980) never runs there and a
character name can be spelled differently on every page. Measured earlier this loop: the single-page path rendered
`สึกุโยมิ` on page 1 and `ทสึคึโยมิ` on page 2 of the same chapter (`inconsistent_name`, gate).

## What was added (opt-in `MIT_SERIES_GLOSSARY=1`)

`series_glossary_memory` keys a small LRU (32 series) by the Backend's stable `translator.series_context` (#157).
After each page it learns name -> spelling votes from **name-focused lines only** (one candidate in the source, Thai
run 3-12 chars, translation no longer than the run + 6 chars, so a clause that merely mentions the name cannot
poison it). The next page of the same series applies the remembered spellings deterministically (existing
`apply_glossary` edit-distance rule) before rendering. No series key -> no-op; `MIT_NAME_GLOSSARY=0` also disables it.

## Evidence

- Unit tests: first page learns only; second page of the same series replaces a near-miss spelling; another series
  is untouched; no key -> no-op; flag is opt-in. (4 tests, pure Python.)
- Live two-page run (Tsuki c2 p0/p1, real gateway, series context set): page 2 logged `[series-glossary] applied 2
  name fix(es)` and the final spellings were **สึกุโยมิ / สึกุโยมิ — consistent**, versus the inconsistent baseline
  measured earlier for the same path.

## Why opt-in

It changes rendered output and can freeze an imperfect spelling across the series (same consistency-vs-correctness
tradeoff as the batch glossary). Once the Backend sends `series_context` for all series (it only sends it when
catalog metadata exists), a corpus replay + judge comparison can justify defaulting it on.
## Promoted to default (#980 follow-up)

After the opt-in results above, the memory became **default ON** (`MIT_SERIES_GLOSSARY=0` disables; `MIT_NAME_GLOSSARY=0`
disables it with the base glossary). Reasons and checks:

- The memory is keyed by `(target language, series_context)`; a series translated to two languages keeps separate
  memories, and without a series context the path is a strict no-op.
- **First page cannot change:** with a series context supplied on a single replay, the rendered PNG is
  **byte-identical** to the run without context (the first page only learns).
- Live two-page run with no env override: `[series-glossary] applied 2 name fix(es)`, both pages `สึกุโยมิ` — the
  same consistency the batch path already ships by default (its glossary), now on the production path.
- The consistency-vs-correctness tradeoff is unchanged from the batch glossary: a spelling can be frozen, but a
  chapter will not show two spellings of one name. `MIT_SERIES_GLOSSARY=0` is the escape hatch.