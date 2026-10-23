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