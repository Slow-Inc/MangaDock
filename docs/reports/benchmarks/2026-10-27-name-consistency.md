# Character-name consistency — three real bugs found and fixed, live verification still open

The audit (2026-10-27-quality-audit-ch6.md) found `HAIMIYA` rendered as `ไฮมิยะ` and `ฮาอิมิยะ` inside one
chapter while `Kurose` stayed consistent, and traced it to the glossary never learning a name that only appears
inside full sentences. Digging into the code found **three** separate defects, all fixed here.

## 1. An inline hyphen fused the name with the address word

`candidate_names` removes hyphens so that a line break cannot split a name ("TSUKU- YOMI" is one name). The rule
also removed inline hyphens, so `HAIMIYA-SENPAI` became the single candidate `HAIMIYASENPAI` — which never matched
`Haimiya` written on any other page, and left `SENPAI` to be treated as a name.

**Fix:** only a hyphen followed by whitespace is a line break; an inline hyphen is a separator. Address words
(`SENPAI`, `SENSEI`, `KUN`, `CHAN`, `SAN`, `SAMA`, …) join the name stoplist so they can never become names.

## 2. Names inside full sentences were never learned

Both `extract_glossary` and the series memory's `_learn` only read *name-focused* lines (one candidate, translation
barely longer than the spelling). Every Haimiya line is a sentence, so nothing was ever learned.

**Fix:** `learn_spellings(regions)` votes on Thai character n-grams over every line whose source mentions the name,
and keeps a candidate only when it appears in at least two of those lines **and is mostly confined to them**
(≥ 75 %). That specificity test is what rejects grammar the translator uses everywhere — naive substring voting
picks `รุ่นพี่` ("senpai"), which is present in all the same lines. Leading address words and trailing honorifics are
stripped, so what is stored is the name alone.

## 3. Enforcement could not see a name inside unspaced Thai

`apply_glossary` compared whole Thai runs with the glossary spelling. Thai has no spaces between words, so a name
inside `รุ่นพี่ฮาอิมิยะเอามาคืน` is never a whole run and was never fixed.

**Fix:** whole-run matches are tried first (replacing a window inside a run would splice old and new spellings
together), then windows of the target's length are scanned, aligned to whole character clusters and rejecting
windows that end on a dangling leading vowel or that are more than one character longer than the target. A Thai
**consonant-skeleton** rule catches transliterations the generic 0.6-similarity guard rejects: `ไฮมิยะ` and
`ฮาอิมิยะ` are 0.57 similar and four edits apart but share the consonants `ฮมย` / `ฮอมย`.

## Evidence

- **Unit tests:** 33 pass (name glossary, extraction, prompt, series memory), including new cases for the hyphen
  split, sentence-only learning, unspaced enforcement, and the skeleton matcher.
- **Offline replay** of the saved chapter outputs through the old and the new batch logic:
  - old: glossary `{}`, 0 fixes, final variants `ไฮมิยะ ×4 / ฮาอิมิยะ ×1`;
  - new: glossary learns `{HAIMIYA: <the spelling of that run>}` from page 1, enforcement fixes the later page,
    and both chapter runs replay to a single spelling (the run whose page 1 wrote `ฮาอิมิยะ` replays to 4× `ฮาอิมิยะ`).
- **Live:** two full chapter runs still show both spellings (3:2), and the batch path logged **no** enforcement at
  all, so the batch glossary is apparently not reaching the new code in the bench configuration — that is the open
  item, not the algorithm. A live single-page run with a series context kept one spelling throughout the four
  pages it touched (no drift occurred, so it does not prove the fix either).

## Limits

- The first page of a chapter cannot be corrected retroactively (streaming): whatever it wrote is already
  delivered, so a chapter can still open with one spelling and switch after page 2.
- The specificity threshold (≥ 2 lines, ≥ 75 % confined) and the cluster/length guards are heuristics; they were
  tuned against this chapter and the existing test corpus.
- Fleet-level verification is still missing: until the batch path is observed enforcing (a log line
  `[name-glossary] enforcing {...}` should appear per page), treat the live batch benefit as unproven.
