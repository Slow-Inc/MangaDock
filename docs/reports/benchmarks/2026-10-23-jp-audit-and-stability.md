# JP→TH audit: one real page (uploaded twice), gate-clean, one model-ceiling sense flip, duplicate lines already consistent

- **Date:** 2026-10-23 · **Data:** `result/jp/jp_chapter_p0.jpg` (== `_p1.jpg`, byte-identical), HEAD, tag `_jp73`.

## Corpus fact (corrected)

The two uploaded JP "pages" are the **same image** (same sha1). All JP→TH work so far therefore used **one page,
run multiple times**, not two pages.

## Fresh run

| page | wall | translation | gate |
|---|---|---|---|
| jp_chapter (cold) | 13.1 s | 1.2 s | 0 violations |
| jp_chapter (warm) | 5.2 s | 2.8 s | 0 violations |

Judge audit of both runs: **14 segments, mean 1.57/2** (earlier 1.64 baseline was the same page; the delta is judge
noise). Flags were model-level nuance: rhetorical じゃねーか flattened to a statement (2x), あ？ rendered as
`อ่ะ?` vs `หือ?`, and one **sense flip**:

| source | run A | run B |
|---|---|---|
| `でも可愛くないなコイツ` | `แต่ไอ้นี่ไม่ได้น่ารักเลยนะ` (not cute — correct) | `แต่ตัวนี้ดูไม่ไร้เดียงสาเลยนะ` (**not innocent** — wrong concept) |

The two runs translate the same text differently at temperature 0.5; one of them flips the adjective while keeping
the negation, so `negation_lost` cannot catch it and there is no deterministic licence for "cute". This is recorded
as a **model-ceiling limitation**, not a guard candidate. (If desired later: self-consistency sampling — translate
twice and pick the agreeing translation — costs +1 call/page, so it would be opt-in.)

## Negative result: duplicate source lines

Across **1,241 stored pages**, 73 pages contain duplicate source lines (same text in two balloons) and **all 73
groups already translate identically** — the pipeline/model keeps in-page duplicates consistent, so a
source->translation dedupe/memory feature is not needed (no evidence of a defect).