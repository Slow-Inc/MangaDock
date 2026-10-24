# Translation-quality audit, LLM-judged — 372 segments across the corpus, mean 1.51/2

- **Date:** 2026-10-22 · **Tool:** `MIT/tools/judge_translations.py` (new) · **Judge:** the same production
  gateway model, strict-editor prompt, 0-2 faithfulness per segment, chunks of 6 segments (a whole page
  truncates a thinking model at 2048 tokens — the first run lost 21/39 pages).
- **Sample:** every `_THA_final` page (39) and every segment with source + translation (372).

## Result

| | |
|---|---|
| mean | **1.51 / 2** |
| perfect (2) | 202 segments (54 %) |
| minor (1) | 159 (43 %) |
| broken (0) | 11 (3 %) |
| problem tags on < 2 | other 112, garbled 24, literal 13, wrong 8, name 7, fragment 6 |

Lowest pages: Iruma p1 **0.88**, Taida p0 1.00, Kage p0 1.00, Kumo p1 1.00, Otome p1 1.00, Tsuki p1 1.00.

## Judged caveat — trust the meaning, not the spelling notes

The judge repeatedly reported "typos" in Thai that are **correctly stacked marks** (it printed e.g.
`แต่→แต่`). A code-point scan of all 372 translations found **zero doubled tone/vowel marks**; the judge's
character-level notes are noise. Its meaning-level notes (dropped words, nuance, wrong sense, garbled Thai)
matched the payload and are the usable signal.

## Actionable patterns (for prompt v3, issue #888)

1. **Stammer/hesitation is flattened:** `U-UM` → `อ-อ๋อ` (realisation), `UNo?!` → `เอ๋?!` (loses the No). The
   model treats a broken-word start as a different interjection.
2. **Cut-off fragments are dropped or given a wrong initial:** `AGAI-` → `ไม-`, `W-` → `ฉ-`, `BA` / `THE`
   dropped from a title. These are mid-word cuts; the Thai should start the same word or a natural stammer.
3. **Names guessed from a familiar reading:** `Plicia` -> `อลิเซีย` (Alicia). Also honorific spelling (`คุง`).
4. **Sense slips:** `carefree` -> `ไร้เดียงสา` (naive), `paragons of evil` -> `สัญลักษณ์` (symbols),
   `a little something` -> `นิดหน่อย` (a bit), `On the spot` -> `เอาล่ะ` (alright).
5. One **inverted self-correction**: `NO, I MEAN, ITS FINE!` -> "doesn't mean it's okay".

## Baseline use

This scorecard is the reference for prompt A/Bs: a candidate prompt must beat 1.51 on the same sample, and
the per-pattern list above says where to look. The tool is committed so the measurement is repeatable.
