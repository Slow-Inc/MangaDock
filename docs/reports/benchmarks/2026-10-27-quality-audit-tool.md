# Chapter quality audit — the numbers we kept working out by hand, now a tool

Everything the last rounds measured on a chapter (completeness, English residue, name drift) lived in throwaway
scripts. This puts the deciding logic in `manga_translator/quality_audit.py` (pure, torch-free, CI-tested) and a
CLI over the JSON a bench run or a patches response already produces.

## What it reports

- **completeness**: real dialogue lines (≥2 words, ≥8 letters, mostly Latin source) and how many carry target
  language text;
- **residue**: dialogue lines that came back with no Thai (the "English left on the page" case), with page and text;
- **name drift**: for names the caller asks about (`--names HAIMIYA,KUROSE`), how many different Thai spellings the
  chapter used. Drift is checked against the chapter's own learned spelling with the same matcher the glossary
  uses; an automatic pass over every capitalised token was tried and rejected — it flagged ordinary words and
  brands (COIN, PAYPAL, MAD) as "names".

CLI: `python tools/quality_audit.py <bench.json|response.json> [--names A,B] [--json report.json]`.

## Numbers on the saved runs (Haimiya ch. 6, 14 pages)

| run | regions | dialogue | translated | residue | name drift |
|---|---|---|---|---|---|
| series memory, run 1 | 156 | 58 | 53 (91 %) | 5 | HAIMIYA: ฮาอิมิยะ / ไฮมิยะ |
| final stack (before the name fix), run 1 | 156 | 58 | 53 (91 %) | 5 | HAIMIYA: อิมิยะ / ไฮมิยะ |
| rolling-context arm, run 1 | 156 | 58 | 53 (91 %) | 5 | none |

The 5 "residue" lines are all on the credit page (e-mail, wallet address, donation URLs, voucher codes) — content
that is not meant to be translated (#1139), so this chapter is effectively 58/58 for dialogue. The series-memory
run still shows the page-0 holdout from last round (the first page is delivered before anything is learned); the
rolling-context arm happened to be uniform.

## Bug the audit itself surfaced

Building the drift check exposed a real defect in last round's learner: when a chapter used both spellings, the
**partial** spelling (`มิยะ` — the piece both variants share) appeared on every line and outcounted each full
variant, so `learn_spellings` could return the fragment. It now drops any candidate contained in a longer
candidate that is itself frequent enough ("maximal grams only") and ranks the survivors. This strengthens the name
fix and is covered by the existing tests (38 pass across the name/audit suites).

## Limits

- The dialogue filter is a heuristic; it deliberately ignores art/SFX junk, which is measured elsewhere.
- Drift needs the names to be named by the caller; there is no reliable automatic detection of what is a character
  name (tried, see above).
- The audit reads finished JSON, so it measures outputs, not the pipeline internals.
