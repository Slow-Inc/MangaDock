# JP rhetorical-prompt A/B: no measurable difference; rule not shipped (#897 follow-up, negative result)

- **Date:** 2026-10-23 · JP page (`jp_chapter_p0.jpg`), real gateway, 2 runs per arm, source JPN.
- **Question:** can a prompt rule for Japanese rhetorical/tag endings (じゃないか/じゃねーか/じゃん/だろ/よね/かよ)
  stop the reported flattening (`、そうだよどうでもいい事じゃねーか` -> a plain Thai statement)?

## Variant

An experimental seam (`MIT_PROMPT_EXTRA`) appended one instruction to the shipped Thai system prompt: keep the
attitude with a sentence-final Thai particle (นี่, สิ, เหรอ, หรอก, นะ) instead of flattening.

## Results (the target line, 2 runs per arm)

| arm | run 1 | run 2 |
|---|---|---|
| baseline | `ใช่แล้ว เรื่องไร้สาระนี่จะสนใจไปทำไม` | `ก็จริงสิ เรื่องไม่เกี่ยวกับเราสักหน่อย` |
| + rule | `ใช่แล้ว เรื่องไร้สาระแบบนี้ไม่สนใจก็ได้สิ` | `ใช่แล้ว เรื่องไร้สาระนี่ไม่เกี่ยวกับฉันสักหน่อย` |

Both arms already keep the attitude (ไปทำไม / สิ / สักหน่อย); the flat sample from the earlier audit did not
reproduce. No measurable improvement from the rule, so it is **not shipped** and the experiment seam was reverted
(shipped prompt stays byte-identical).

## Note

All four runs show the same single gate finding: an `X` source region (Latin glyph on a JP page) arrives with an
empty translation because `source_lang_only` filtered it — expected filtered-region behaviour in the doctor payload,
not a render defect.