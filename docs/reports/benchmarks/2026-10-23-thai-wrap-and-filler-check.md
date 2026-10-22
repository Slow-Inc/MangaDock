# Thai line-break audit — 0 mid-word breaks on real translations (negative result)

- **Date:** 2026-10-23 · **Method:** 71 real Thai translations from the `_live37` corpus, each wrapped by
  `text_render.calc_horizontal` at widths 160/240 px and font sizes 18/22 px, then checked against the renderer's
  own ZWSP segmentation (`_insert_thai_word_breaks`): every line boundary must sit on a ZWSP/space, never inside a
  token.

| texts | configurations | mid-word breaks |
|---|---|---|
| 71 | 284 | **0** |

So the Thai wrapping path (pythainlp tokenization + ZWSP insertion) is sound on real output — no fix needed and no
guard added (an earlier version of the audit flagged 147 cases; the bug was in the checker, which treated the word
boundary after a skipped ZWSP as a mid-word break).

## Companion live check: the #1039 filler guard

Fresh HEAD runs of the pages whose historical output contained the hallucinated `ทน/ทัน` filler: **0 spurious-filler
flags** in the new output (the guard re-asks such segments) and gate-clean. Historical stored runs of the same
pages had 24 unique flagged pairs.
### Correction on the filler check's scope

The fresh run listed three pages but the third (`corpus2/en_Dungeon_..._p0.png`) does not exist in that folder
(mixed extensions) — the doctor aborted on it before the gate step. So:

- the fresh **two Tsuki pages** were produced and contain **0 spurious-filler flags**;
- the quality gate was run **separately** on those two pages: `pages=2 violations=0 ok=True`;
- no claim is made about the Dungeon page from this run (its historical outputs did carry the filler; the same
  guard path applies, but it was not re-measured here).