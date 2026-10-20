# #754 + #797 junk-read drop, #796 2-line merge — replay A/B

- **Date:** 2026-10-20 · **Issues:** #754 (det_sfx false-positive DROP), #797 (rescue placeholders), #796 (2-line merge at normal leading)
- **Before:** `911dd753` · **After:** `37d0ed41` — prod font + prod render knobs, EN corpus (16 pages) → THA
- **Defects tied to:** a stray one-letter OCR read of art or of a whole balloon translated and drawn as a huge Thai glyph (`w → ว` over `อ่า...`, `I → ฉัน` over SFX art, `n → น`, `v → ว`, `S → ซ`); a two-line credit sentence split into two regions, translated as two halves with one phrase repeated, and the blocks overlapping.

![before/after crops of every dropped junk region and the merged credit lines](./2026-10-20-754-796-797-false-positives-and-split.png)

## Why this rule and not main's

A probe over the corpus logged every det_sfx box and every rescue placeholder with its OCR read
(2026-10-20). Every junk read was **one ASCII character** (`I`, `v`, `n`, `S`, `1`, `w`, `V`, `7`).
Multi-character ASCII reads were real lettering — `CHAINSAWMAN`, `Yamai`, `Omake`, `491`,
`LEAK OUTSIDE`, `TO CHECK` — which `main`'s blanket "any real-text read" DROP would also have
thrown away. So the DROP is: a speculative box (det_sfx or rescue placeholder) whose read is one
ASCII char, or real text sitting on a dialogue line (`THE` over a bubble, Gal Yome 2026-06-30).

The same probe logged every 2-line merge decision: one split on the whole corpus (the credit pair,
pitch 1.68× the cap-height font); every merged pair was ≤ 1.29×. Raising the 2-line limit from 1.5×
to 2× changes only that pair.

## Result

| | before | after |
|---|---|---|
| junk one-letter regions rendered | 6 (`w`, `I` ×2, `n`, `v`, `S`) | **0** |
| overlapping rendered pairs (corpus) | 4 | **1** (the JP `、題` region prod filters) |
| Chainsaw credit sentence | 2 regions, phrase repeated, overlapping | 1 region, no repeat, no overlap |
| real multi-char lettering kept | — | yes (`CHAINSAWMAN`, `Yamai`, `LEAK OUTSIDE`, …) |

## Caveats

- **Replay is not fully deterministic here.** A region whose text changed (the merged credit
  sentence) is translated live, and when the page-level Thai-ratio check fires, its batch retry
  re-translates the page live, bypassing the replay. On Chainsaw p0 that retry returned
  `CHAINSAWMAN` untranslated, so the title was filtered as "identical to original"; on Lv2 p1 the
  same mechanism flipped which of `HOW DO I CALL I OUT?` / `ー` survived. Neither is caused by the
  DROP or the merge — both are LLM non-determinism in the retry path. Fixed afterwards in the
  doctor (#756): the replay now also answers the batch retry, and two replays of Chainsaw p0 give
  identical output with the title kept. In that deterministic run the merged credit sentence is
  dropped instead — the model echoes the garbled OCR (`CONSIDFR … THF … RFGION`, a 9 px typewriter
  font read E→F) untranslated, so the original English stays visible. OCR of tiny lettering is the
  next defect on that page.
- **`S` was a real SFX (`CHOMP`).** Dropping it shows the original English lettering instead of a
  meaningless `ซ`; translating it needs the VLM rescue, which the current gateway model cannot serve
  (#771).
- **Hidden by the overlap until now:** the credit line `PLEASE DON'T SUPPORT WEBSITES THAT DO`
  (Chainsaw p0) is never detected — a detection miss that the overlapping blocks used to cover.
