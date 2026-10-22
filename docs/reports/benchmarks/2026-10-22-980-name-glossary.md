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