# Guard wiring bug: filler/lost predicates were notes-only, never retry triggers (fixed)

- **Date:** 2026-10-23 · **Affects:** #1039 (Thai filler words), #1052 (LOST -> หายาก) · **Files:**
  `translators/common.py`, tests, `quality_gate.py`.

## What was wrong

`_is_glitched` is the retry trigger (`translate()` re-asks a segment when it returns True). The #1039 and #1052
predicates had been wired only into `_modify_invalid_translation_query` — the function that composes the retry
**note** — so those segments were never actually re-asked. A live audit with an env-gated trigger log
(`MIT_LOG_GLITCH=1`) exposed it: the mocked-translator tests for filler/lost failed at HEAD.

## Fix

- `_is_glitched` now evaluates all five predicates (`foreign_script`, `negation_lost`, `runaway`,
  `spurious_filler`, `lost_as_rare`) and returns their union; the env-gated `[glitch]` log prints which one fired
  and the pair, for future precision audits.
- New direct regression test: `_is_glitched` must be True for the filler example
  (`ฉันทันมอบพลัง...` for `I AM GRANTING...`) and the lost/rare example (`ของหายาก` for `LOST ITEMS.`), and False
  for clean output and a real `RARE ITEMS.` source — so the predicates cannot silently become notes-only again.
- Mocked retry tests for both guards pass again (`call_count == 2`).

## Live audit after the fix

5 fresh pages with `MIT_LOG_GLITCH=1`: **0 trigger hits** and 0 retries (these runs were clean; both guards target
intermittent errors, so the mocked tests are the deterministic coverage).

## Companion gate fix (#990)

The same audit surfaced a gate false positive: source `Episode?3` (OCR noise between a letter and a digit) was
reported as a dropped `?`. The OCR-embedded punctuation rule now covers letters **and digits**; gate test added.

## Lesson

"Wired into `_is_glitched`" was claimed from a passing mocked test; the test was passing for an unrelated reason
(the note function alone does not trigger a retry). The new direct predicate test is the cheaper invariant.