# #1057 — opt-in retry for an untranslated English word inside Thai

- **Date:** 2026-10-23 · **Files:** `translation_quality.py` (predicate), `translators/common.py` (opt-in trigger +
  note), tests.

## Problem (from the full-corpus sweep)

`DID ANYONE BRING THE RESOURCE MATERIALS?` -> `มีใครเอามATERIALS มาบ้างไหม?` — the model kept an English word and
glued it to Thai. The gate flagged the *mangled* token (`added_latin`), but there was no retry class for
untranslated source words, so nothing re-asked.

## Predicate (licensed to avoid the known false positives)

`untranslated_source_word(src, dst, to_lang)` returns true when:

- the target is Thai and the answer is **mostly Thai** (credits/titles/logos that stay Latin are skipped);
- the source is **not a credit line** (`TRANSLATED BY …`, `ART`, `STORY`, `EDITING`, …) — `แปลโดย DALE` stays legal;
- an answer Latin word matches a source word exactly, **or is a partial copy covering >= 60 % of it** (the observed
  `ATERIALS` case, where the Thai `ม` swallowed the M);
- the word has a vowel (`RTSD`, `TV` are acronyms and skipped).

## Wiring (opt-in `MIT_LEAK_LATIN_GUARD=1`)

Predicate -> `_is_glitched` reason `untranslated_word` -> retry note asking to translate the kept word (proper names
and credits may stay). Same predicate -> trigger -> note discipline as #1039/#1052/#1056, with tests.

## Evidence

- Predicate tests: the observed mangled line and an intact `MATERIALS` line are caught; credit line, title-only Latin,
  acronym (`RTSD`), word absent from the source and a mostly-Latin answer are all skipped.
- Trigger test: `_is_glitched` is false without the env flag and true with it (heavy glitch-retry suite 18 passed).
- **False-positive sweep:** three credit/title-heavy pages (Otome p0, Kage p0, Horimiya p1) with the flag on:
  **0 triggers, gate 0 violations**.

## Why opt-in

Natural occurrences are rare and the guard has only been proven on unit/credit-page samples; a forced-guard
injection (inject the observed line, prove the retry translates it) plus a wider sweep should come before defaulting.