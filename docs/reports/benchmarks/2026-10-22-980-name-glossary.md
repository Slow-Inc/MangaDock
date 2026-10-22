# #980 — cross-page name glossary: TSUKUYOMI now consistent across pages, default ON

- **Date:** 2026-10-22 · **Issue:** #980 · **Files:** `manga_translator/name_glossary.py` (new), `config.py`,
  `translators/config_gpt.py`, `manga_translator.py` (`translate_batch_pipelined`), tests.

## Problem (measured in round 57)

`TSUKUYOMI` came out as `สึกุโยมิ` on page 1 and `ตสึกิโยมิ` on page 2 (three spellings across two runs of the
chapter). The #159 full-dialogue context did not fix it and could hurt the current page.

## Mechanism

1. **Extract** after page i's translation: for regions whose source has exactly one romaji name candidate, the
   longest Thai run in the output is that name's spelling. Existing spellings win (a page never overrides the
   glossary it inherited).
2. **Filter** to names seen at least twice (a one-off ALL-CAPS word like SKY/GROUND is not a character).
3. **Feed** the next page's prompt through the same `chatgpt_config` seam as series/prev context: a
   "Consistent character names" block (`TSUKUYOMI = ทสึคุโยมิ`) + explicit never-re-spell instruction.
4. **Enforce deterministically** after translation: prompt instructions are not reliable (the model copied
   `ทสึคุโยมิ` as `ทสึคิโยมิ` in one run), so on a region whose source contains a glossary name, the closest Thai
   token within edit distance 2 and >=0.7 similarity is replaced with the exact spelling. Unrelated words are
   untouched (tested).

## Evidence (real pages, GPU1)

Deterministic name-consistency metric, 2-page pairs:

| arm | Tsuki TSUKUYOMI on p1 / p2 | verdict |
|---|---|---|
| baseline | `สึกุโยมิ` / `ตสึกิโยมิ` | **inconsistent** |
| glossary + enforcement | `สึกิโยมิ` / `สึกิโยมิ` | **consistent** |

- Targeted two-page judge on the same pairs: **0 mistranslations in both arms** (no meaning harm on Boku /
  Horimiya / Tsuki); Boku page-2 coherence moved 2 -> 1 (one point, inside the #902 noise band).
- Region counts unchanged (17/13, 30/28, 16/21) and wall time unchanged within noise (no extra model call; the
  prompt block is a few hundred characters).

## Default

**ON** for the batch path (`translate_batch_pipelined`); single-page requests are unaffected (no previous page,
no glossary). `MIT_NAME_GLOSSARY=0` disables it. Rationale: it adds no model call, no measurable latency, and the
only new behaviour is fixing spellings it can extract with high confidence — verified not to touch unrelated
Thai (13 unit tests + prompt-carriage tests).

## Caveats

- Extraction covers **romaji** names (EN->TH); JP/kanji names are not detected yet.
- The heuristic picks the longest Thai run on a single-name region, and enforcement only fires on near matches —
  conservative by construction, but a mis-extracted glossary could pin a wrong spelling; that is why the
  two-occurrence filter and the edit-distance bound exist.
- Measured on one consistent chapter pair plus two controls; the metric is deterministic, the judge is noisy.
## Follow-up (round 59): tighter coverage, regression test, tool

- **Prompt-only enforcement was not enough in practice**: a real run copied `ทสึคุโยมิ` as `ทสึคิโยมิ`, so the
  deterministic replacement bound was widened from edit distance <=2 / similarity >=0.7 to **<=3 / >=0.6** (still
  requiring the region's source to contain the name; unrelated Thai is untouched — tested).
- **Regression test** added at the pipeline level (`test_batch_pipelined_translator.py`): page 1 spells the name,
  page 2 drifts, and the batch pipeline must correct page 2 to the page-1 spelling. It also pins the
  two-occurrence filter (a name seen once on the first page is not pinned yet).
- **Tool**: `tools/name_consistency.py <page1.json> <page2.json> …` reports per-name spellings and exits 1 when a
  name is inconsistent — usable as a regression gate on a produced chapter.
- Re-measured on the real Tsuki pair with the widened bound: baseline `สึกุโยมิ / ตสึกิโยมิ` (inconsistent) ->
  glossary arm `ทสึคุโยมิ / ทสึคุโยมิ` (**consistent**). Gate **881 passed**.

Known limitation kept: names that appear only once on a page are pinned only after they recur; JP/kanji names are
not extracted yet.
## Precision pass (round 60): clause-shaped "spellings" and contraction "names" filtered

A within-page scan of 60 stored pages surfaced two false-positive glossary entries: **`SHES`** was taken as a
name (OCR of `SHE'S`) and the region's whole Thai clause as its "spelling" (TH has no spaces, so a clause is one
run). Enforcing that could have rewritten ordinary dialogue.

- `extract_glossary` now accepts a spelling only when it is **3-18 characters** (a transliterated name, not a
  clause) and the stoplist covers common contractions (`SHES`, `IM`, `IVE`, `YOURE`, `THATS`, `DONT`, …).
- Re-scan of the same 60 pages: **0 within-page name variants** (was 2, both false positives).
- Unit tests pin both guards (clause not extracted; contractions not candidates).
- Re-measured the real Tsuki pair after the change: baseline `สึกุโยมิ / ตสึกิโยมิ` (inconsistent) -> glossary
  arm `ทสึคึโยมิ / ทสึคึโยมิ` (**consistent**); gate **883 passed**.

## Negative result recorded

A "dropped numbers" audit over **11,633** stored src/dst pairs found no credible digit loss: every hit was a
formatting artefact (`20, 000` with a space after the comma), a fullwidth digit, or OCR noise inside a word
(`60NNA`, `7BYTHE`). No guard was added — a retry trigger for those would only waste calls.