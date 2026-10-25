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

1. **On a credit page, the ratio check skips short Latin lines handed back verbatim.** A page counts as a credit page
   when at least one line came back verbatim and holds a URL, an e-mail or a wallet-like token (letters mixed with
   digits, 8+ characters). On such a page, a verbatim line is skipped only when its source is ASCII, it has no
   target-script letter, and it has fewer than 4 plain words (a coin name, an address, a handle). Every other page is
   judged exactly as before. A page whose every answer is verbatim is judged whole.
2. **`untranslated_source_word` treats donation-platform lines as credit lines.** `PAYPAL|PATREON|DISCORD|KO-FI|DONAT`
   joins the existing `_CREDIT_SRC` list (`TRANSLATED BY`, `CREDIT`, ...), which the guard already skips.

## Alternatives considered

- **Sort pages so heavy pages dispatch first.** Rejected by the developer: a predictor can be wrong, and sorting adds
  moving parts without removing the wasted calls.
- **Stop retrying when a retry does not move the ratio.** This still spends one extra whole-page call per credit page,
  and the guard stays wrong about what it measures.
- **Turn `enable_post_translation_check` off.** This loses the guard against pages answered in the wrong language.
- **First revision (reviewed and replaced before merge):** skip any short verbatim line on any page, and treat
  mid-sentence Capitalised words as names. Independent review found inputs that slip through: verbatim Japanese
  lines, short English shouts hidden behind one Thai line, and quote, ellipsis or Title Case sources that
  defeat the name regex. Gating on the credit-page signal and reusing `_CREDIT_SRC` closes all of them with less
  code.

## Consequences

- Credit page: 1 LLM call, 7.8–14.2 s (it was 24–40 s with 4–8 calls). Real chapter: 18.8–23.8 s (it was
  58.5–60.1 s). The last-page gap is 2.3–6.0 s (it was 39–46 s).
- Replayed against the session logs: across 577 page translations, only credit pages change verdict (67 flips, fail →
  pass), and none gets stricter. Of 4,112 segments, the only ones no longer flagged as untranslated words are the
  `Paypal`/`Patreon` donation lines.
- A dialogue line that mentions Discord, Patreon or PayPal is no longer checked for leftover English words.
