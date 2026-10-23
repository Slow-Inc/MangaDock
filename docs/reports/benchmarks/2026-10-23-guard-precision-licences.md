# Two guard/gate precision licences: rhetorical retorts and Thai emphasis particles (#1071)

- **Date:** 2026-10-23 · `translation_quality.is_retort_question`, `quality_gate._THAI_EMPHASIS`.

## What the v5 sweep exposed

Both remaining page-gate findings were false positives (the Thai preserved the source meaning):

| case | output | why it was flagged |
|---|---|---|
| `FOR NO REASON? I WONT LEND TO PEOPLE WHO SAY THAT.` -> `ไม่มีเหตุผลเลย! ...` | the `?` is a rhetorical retort; the Thai carries it with `!` | `dropped_question` retried twice, shipped the same line, and the gate repeated the finding |
| `... ARE TRULY AWFUL!` -> `...แย่จริงๆ` | the `!` is carried by the Thai emphasis particle `จริงๆ` | gate `dropped_!` |

## Fix

- **`is_retort_question(src)`**: a **long (>= 8 words)** statement ending in `?` that starts with no question form
  (question word / inverted auxiliary: WHAT WHY HOW WHERE WHEN WHO WHICH DO DOES DID ARE IS WAS WERE CAN COULD WILL
  WOULD SHOULD MAY MIGHT HAVE HAS HAD …) and has no WHAT/WHY/HOW/WHERE/WHEN anywhere (WHO/WHICH only when they are
  the second word, i.e. asked directly) is a retort. Used by both `dropped_question` and the gate.
  The threshold is 8 words on purpose: the original #1056 case (`FOR NO REASON? I WONT LEND.`, 6 words) stays guarded.
- **Gate emphasis licence**: a source `!` with a Thai emphasis particle (นะ/สิ/เลย/จริงๆ/จริง ๆ/มาก/เหลือเกิน/สุดๆ/เนี่ย/…)
  counts as preserved.

## Evidence

- 44 corpus regions have a source `!`; **all 44** carry either the mark or an emphasis particle -> no real losses there.
- v5 dashboard after the licences: **`gate_violations {}`**, `leftover {}` (the only remaining item is the
  chapter-level name variance, which `series_context` fixes in production).
- Tests: retort true/false matrix + guard/gate cases + the 6-word control (`test_rhetorical_retorts_are_not_questions_1033`,
  `test_rhetorical_retorts_are_not_flagged_for_dropped_question_1033`, `test_exclamation_carried_by_a_thai_emphasis_particle_1032`).
## Live validation (2 pages, 2026-10-23 round 230)

Ran the two pages whose lines had motivated the licences (Horimiya p1 with the retort, Tsuki p0 with the emphasis line)
with `MIT_LOG_GLITCH` and `--gate`:

- **No `dropped_question` trigger** on the retort page any more (previously it retried twice on every run), and the
  emphasis line produced no gate finding.
- Gate: **pages=2 violations=0**.
- The only glitches were two `foreign_script` Chinese leaks (model variance) which the existing guard retried/salvaged —
  gate stayed clean, so the retries did their job.