# #1026 — a split numbered block shifted every later balloon; block-count guard + re-ask

- **Date:** 2026-10-23 · **Issue:** #1026 · **Files:** `translators/numbered_contract.py`,
  `translators/custom_openai.py`, tests.

## Observed on a real chapter

A 2-page batch run (Tsuki c2 p1) produced a page whose Thai translations were shifted one balloon down:

| balloon | source | shipped translation (bad run) |
|---|---|---|
| #1 | `I HEARD YOUR CONVER-SATION WITH THE GODDESS.` | `ข้าได้ยินบทสนทนาของเธอ` (head only) |
| #2 | `I WANTED TO SEE YOU AGAIN, TSUKU-YOMI!` | `กับเทพธิดา` (the tail of #1) |
| #3 | `TSUKU-YOMI!` | `ข้าอยากพบเธออีกครั้ง` (translation of #2) |

A direct translator call on the same 21 lines returned correct alignment in 3/3 runs, so the corruption is
intermittent and model-side: the model **split line 1 into two numbered blocks** and continued numbering, so the
response held N+1 blocks. `normalize_numbered_output` guarantees exactly N strings by index, but the extra block
silently shifted every later balloon.

## Fix

- `numbered_contract.contract_gap(raw, n)` — pure check that a response carries exactly indices `1..n`, once
  each (missing / duplicate / extra block all count).
- `custom_openai._translate` checks it **before** normalizing and re-asks that batch — bounded at 2 retries,
  then falls back to the previous normalizer so a persistently broken model cannot loop.

## Evidence

- `contract_gap`: clean response false, dropped index true, extra block true, duplicate index true, single-query
  shortcut false.
- Mocked gateway returning a 3-block answer for 2 lines: translator re-asks once and returns the aligned
  translation (`call_count == 2`); a persistently broken contract stops after 2 retries (`call_count == 3`) and
  the output keeps the old length.
- Live rerun of the failing page pair after the guard: page-2 alignment correct, TSUKUYOMI consistent across the
  pair, gate clean. Full suite **896 passed**.

## Note

This is the merge/split class the original contract normalizer was not designed for (it targeted dropped
indices). The guard costs one extra request only when the model actually breaks the contract.
## Verification on clean pages + residual-risk audit (round 70)

- **No spurious retries:** three live pages (Horimiya p0, Mieruko p0, Tsuki p0) with the guard active ->
  **0 contract-mismatch re-asks**, gate 0 violations, translation time unchanged within noise (9.4 s / 4.4 s / 2.5 s
  under machine load; the guard is a pure block count).
- **Residual risk audited:** a count-equal corruption (one merged + one split block) would pass the guard. A
  digit-anchor scan for it (a source number missing from its own translation but present in the next balloon's)
  over **12,004 stored regions** found **0 cases** — no such artifact in the corpus, so no further guard is added
  (avoids a heuristic that would cost retries without evidence).
- Persistent breakage fallback stays the previous normalizer: missing items become empty translations
  (blank balloon), never literal `[Missing item N]` text.