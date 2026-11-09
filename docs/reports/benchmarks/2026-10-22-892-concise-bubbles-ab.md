# `concise_bubbles` — flag was dead; now carried (and the A/B is a tie with 7 % shorter text) (#892)

- **Date:** 2026-10-22 · **Issue:** #892 (P7/#526 lever) · **Harness:** `tools/translation_ab.py` translate/packet
  + the chunked pairwise judge.

## The bug

The Backend has sent `translator.concise_bubbles: true` since #526 (`MIT_CONCISE_BUBBLES` env), and
`ConfigGPT._CONCISE_DIRECTIVE` implements it — but `TranslatorConfig` had no such field and
`chatgpt_config` carried only `series_context`/`prev_context`. Pydantic dropped the unknown key, so the flag
was **silently dead**.

## Fix

`TranslatorConfig.concise_bubbles: bool = False` + the same `chatgpt_config` overrides merge as the context
fields. Absent → `None` → prompts byte-identical (pinned by tests). The flag now actually reaches the prompt.

## A/B (12 pages, seeded blind, chunked judge)

| | base v2 | v2 + concise directive |
|---|---|---|
| translation chars (122 segments) | 2989 (mean 24.5) | **2773 (mean 22.7) → -7.2 %** |
| per segment | — | 56 shorter, 34 longer, 32 same |
| blind judge pages won | **5** | **5** |
| tie | — | 2 |

## Decision — keep it opt-in

No fidelity loss under the judge (dead even) and 7 % shorter text (the #1 render defect is a translation too
long for its bubble), but a tie on 12 pages is not enough evidence to flip a default that changes every
translation for every language/CLI user. The flag now works: `MIT_CONCISE_BUBBLES=1` (Backend) or
`--gpt-config` with `concise_bubbles: true` (Doctor/CLI). Revisit the default with a reference-based eval.

## Files

- `MIT/manga_translator/config.py` — field + carriage.
- `MIT/test/test_prev_context_prompt.py` — 3 tests (carried, absent → None, coexists with context).
- `MIT/tools/prompts/thai_manga_v2_concise.yaml` — the A/B arm, kept as the experiment record.
