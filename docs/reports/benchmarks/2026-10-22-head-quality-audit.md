# Quality audit at HEAD — EN 1.55/2, JP 1.64/2 (no regression), plus the translation ceiling

- **Date:** 2026-10-22 · **Method:** `tools/judge_translations.py` (source-agnostic since #897) over **fresh live
  runs at HEAD** — no replay.

## EN→TH (12 live page runs, 8 unique pages, 113 segments)

| metric | HEAD (live) | prior baseline (39 pages, 372 segs) |
|---|---|---|
| mean | **1.55 / 2** | 1.51 / 2 |
| perfect (2) | 58 % | 54 % |
| minor (1) | 40 % | 43 % |
| broken (0) | 3 % | 3 % |

Problem types the judge assigned: other 25, literal 6, wrong 6, garbled 6, fragment 5.

## JP→TH (2 real uploaded pages, 14 segments)

| metric | HEAD | baseline (pre-#898/#901/#903) |
|---|---|---|
| mean | **1.64 / 2** | 1.57 / 2 |
| inversions | **0** | 1 |

Remaining JP notes are nuance-level: added emphasis (`ด้วยซ้ำ`, `เลยสักนิด`), one register miss (`あ？` -> `อ่ะ?`).

## The remaining score-0 cases (all 3, for the record)

- Iruma p1 #0: `I- I DONT WANT THEM.` -> `ท้องไม่` (garbled). The stammer+fragment pattern makes the model guess
  across the break; a deterministic fix would have to judge semantics, so this is recorded as a translation
  ceiling item, not a guard.
- Iruma p1 #3: `W-` -> `ฉ-` (a wrong initial — the model mapped W to the Thai pronoun prefix).
- Tsuki p1: judge called it "heavily garbled ... should be 'พูดจริงหรือ?'" while the text **is** `พูดจริงหรือ?` —
  the judge's own Thai spell-check noise (known limitation, first documented in round 26).

## Limitations (recorded)

- The gateway exposes **one model** (`qwen3.8-27b-fp8`), so judge and translator are the same model — no
  independent second opinion is available in this environment; judge noise is bounded by the #902 null
  calibration (~+1.4σ on identical inputs).
- Per #902, differences under ~5 page-votes at 12 pages are noise; this audit is a **status check**, not an A/B.

## Conclusion

HEAD is not worse than the loop's baseline on either path, the guards added this loop (#898 negation, #901
runaway, #903 script leak) do not show up as quality cost, and the remaining defects are model-ceiling cases
rather than pipeline bugs.