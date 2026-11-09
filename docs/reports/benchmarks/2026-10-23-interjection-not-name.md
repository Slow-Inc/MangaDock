# Interjections are not names: stop the series glossary from learning laughter renderings

- **Date:** 2026-10-23 · `name_glossary.candidate_names` / `extract_glossary` (feeds both the gate name check and the
  default series name memory).

## What was wrong

The v4 default sweep's only gate finding was `inconsistent_name: HEHE -> ['เข่า', 'ฮิฮิ']`: the 4-letter laughter token
matched the Latin name pattern, so the gate treated two different laughter renderings as an inconsistent character
name. Worse, `extract_glossary` would have accepted it (`HEHE` -> `เข่า`, a nonsense Thai 'knee-knee' rendering), and
the **default series memory** learns from that glossary — one bad page could then enforce `เข่า` for every later HEHE
on the same series.

## Fix

- `_INTERJECTION` denylist + `is_interjection_source()` (laughter syllables, onomatopoeia, interjections: HEHE/HAHA/NYA/
  UGH/HEY/OK/...), applied in `candidate_names`.
- Real names are unaffected (`TSUKUYOMI` still a candidate and still learns `สึคุโยมิ`).

## Evidence

| check | before | after |
|---|---|---|
| gate on the v4 corpus | 1 (`inconsistent_name: HEHE`) | **0 violations** |
| leftovers | {} | **{}** |
| glossary learning HEHE | `HEHE -> เข่า` | `{}` (skipped) |
| suite | 966 | **967 passed** (new test) |