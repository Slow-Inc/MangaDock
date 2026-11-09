# Quality audit — Haimiya ch. 6 on the current stack (2026-10-27)

Read the whole chapter through the production batch path (the one the Backend/Reader uses) and score what a reader
gets, using the data the bench already carries (`bench_1119_chapter_final_stack_*.json`, two runs).

## Completeness: every real dialogue line is translated

- 156 regions returned across 14 pages, 58 of which look like real dialogue (≥2 words, ≥8 letters, mostly Latin
  source). **53 carry Thai output; the 5 that do not are all on the credit page** (e-mail, wallet addresses,
  donation URLs, voucher codes) — content that is not meant to be translated (#1139).
- So on this chapter **58/58 real dialogue lines reach the reader in Thai** (counting the email line as
  translated: `Contact - Setsuscans@gmail.com` → `ติดต่อ - SETSUSCANS@GMAIL.COM`).
- The remaining ~98 regions are art/dash/SFX junk the pipeline drops; they are the same set the rescue measures
  every page.

## Defect found: character-name spellings drift inside one chapter

| name | run 1 | run 2 |
|---|---|---|
| `Kurose` | คุโรเสะ ×4 | คุโรเสะ ×4 (consistent) |
| `Haimiya` | ไฮมิยะ ×4, **ฮาอิมิยะ ×1** | ไฮมิยะ ×2, **ฮาอิมิยะ ×3** |

Same chapter, same character, two spellings, and which one dominates changes run to run:
`รุ่นพี่ไฮมิยะน่ากลัว` (p0) against `รุ่นพี่ฮาอิมิยะเอามาคืน` (p12).

**Why the existing glossary misses it:** `name_glossary.extract_glossary` (and the series memory's `_learn`) only
learn from *name-focused* lines — a single name candidate AND a translation barely longer than the spelling. Every
Haimiya line is a full sentence (`รุ่นพี่ไฮมิยะน่ากลัว`, `แถมผมก็ไม่ได้มีอะไรเกี่ยวข้องกับรุ่นพี่ไฮมิยะ...`), so
the name never enters the glossary and `apply_glossary` has nothing to enforce. Kurose is lucky: it also appears
in short name-focused lines.

**Next fix (designed, not built):** learn the spelling from the *whole page's* name-bearing lines, then let the
existing `apply_glossary` near-match replacement do the enforcing. The hard part is picking the name out of a Thai
run that has no spaces — a naive "most common substring" picks function words like `รุ่นพี่`. Two candidate signals
to try next round: (a) specificity of a substring to name-bearing lines versus the rest of the page, (b) one small
model call per chapter that lists the names and their rendered spellings, with `apply_glossary`'s edit-distance
guard keeping it honest.

## What the other checks said

- **Post-render QA** (`tools/render_qa.py` on pages 2/9/10): median CER 0.105 / 0.000 / 0.135; no confirmed render
  defect (both flags were recognised as recogniser noise on dense or very short lines).
- **End-to-end time**: 42.7 s / 42.6 s for the 14-page chapter (14/14 pages), with the analyst-corrected source
  inside; the 33.8/26.7 s measured for Luna without the analyst is the price reference.

## Limits

One chapter, one series, two runs. The completeness metric depends on the "dialogue-looking" heuristic (≥2 words,
≥8 letters, mostly Latin) — it deliberately ignores art/SFX junk, which is measured elsewhere.
