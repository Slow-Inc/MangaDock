# ADR 035 — MIT post-translation guards skip text no translation can change

- Status: Accepted, 2026-10-26 (#1139).
- Scope: `MIT/manga_translator/translation_checks.py` (`check_target_language_ratio`) and
  `MIT/manga_translator/translation_quality.py` (`untranslated_source_word`).

## Context

The last page of a scanlated chapter is usually the group's credit page: coin names, wallet addresses, URLs and
e-mails, with two sentences in between. Two guards re-asked the LLM about text that no answer can change:

- the page-level Thai-script ratio (threshold 0.5) measured 0.37–0.42, so `single_page_lang_check_retry`
  re-translated the whole page 3 more times, each one failing the same way;
- `untranslated_source_word` (#1057) flagged `Paypal` / `Patreon`, which the system prompt lets stay Latin, so
  every translate call repeated once.

The result was 4–8 LLM calls and a 24–40 s page. On a real 14-page chapter, the chapter took 58.5–60.1 s and its
last page finished 39–46 s after the page before it. The retry log lines never reached the worker log.

## Decision

1. **The ratio check skips a region the model handed back verbatim if that region has no target-script letter and
   fewer than 4 plain words.** A sentence left in English still counts. A page whose every answer is verbatim is
   judged whole, so a page answered in English still fails.
2. **`untranslated_source_word` treats a Capitalised word inside a sentence-case source, not at the start of a
   sentence, as a name.** The comparison ignores case. All-caps lettering carries no such signal, so the #1057
   behaviour is unchanged there.

## Alternatives considered

- **Sort pages so heavy pages dispatch first.** Rejected by the developer: a predictor can be wrong, and sorting adds
  moving parts without removing the wasted calls.
- **Stop retrying when a retry does not move the ratio.** This still spends one extra whole-page call per credit page,
  and the guard stays wrong about what it measures.
- **Turn `enable_post_translation_check` off.** This loses the guard against pages answered in the wrong language.

## Consequences

- Credit page: 1 LLM call, 11–15 s (it was 24–40 s with 4–8 calls). Real chapter: 16.7–21.8 s (it was 58.5–60.1 s).
  The last-page gap is 3–5 s (it was 39–46 s).
- Replayed against the session logs: across 540 page translations, only credit pages change verdict (42 flips, fail →
  pass), and none gets stricter. Of 3,903 segments, the only ones no longer flagged as untranslated words are the 60
  `Paypal`/`Patreon` lines.
- A sentence-case webtoon line with a capitalised common noun mid-sentence would no longer be re-asked if the model
  left it in English. No such case appears in the logs.
