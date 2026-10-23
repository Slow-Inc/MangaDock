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
## Retry budget re-evaluation (2026-10-23, round 232): keep 2

The v6 sweep's one real leftover was an `untranslated_word` case where **both** retries leaked an English variant
(`material` -> `ATERIAL`) and the budget was spent. We evaluated raising `_INVALID_REPEAT_COUNT` (custom_openai = 2, i.e.
3 attempts) for this:

- Frequency: 1 shipped leak in 370 regions; the guard fires rarely (2 lines across the corpus in v6) and direct sampling
  showed the model normally returns fully Thai on the first retry (0 Latin leaks in 9/9 A/B samples).
- Cost: every guard hit (and a bad model batch can hit many lines) would buy one more gateway call; the stress run showed
  glitches are transient and usually fixed on the first retry, so the third attempt mostly adds latency.
- Decision: **keep 2**. Revisit only if future sweeps show repeated leaks surviving two retries (then the fix should name
  the leaked token in the retry note rather than just raising the budget).
## Opinion tags: `SEE?` / `UNDERSTAND?` licensed (round 211, from unseen-page testing)

Generalization test on four unseen Kaguya pages (chapter 11) found `THATS WHY EVERYONES READING, SEE?` retried twice
(19 s of translation on that page) while both attempts shipped the same meaning with the Thai assertion particle `ไง`.
`SEE?` is an opinion tag like `RIGHT?`/`HUH?`, so `is_tag_question` now also accepts a standalone or comma-attached
`SEE` / `UNDERSTAND` / `GOT IT` / `CAPEESH` / `DIG` tag. Real questions are untouched (`CAN YOU SEE?` is not a tag).

- Re-ran the page: **no guard trigger**, gate 0, translation time 5.4 s (was 19.2 s when the retries fired).
- Other three pages: gate 0, render telemetry all zeros. Tests added; suite **990 passed**.
## Reader-site credits and rhetorical exclamations (round 271, #1098)

Unseen Kaiju pages surfaced two false positives that cost retries but changed nothing:

1. `READ MORE CHAPTERS AT KDTSCANS.COM` -> `อ่านตอนต่อได้ที่ KDTSCANS.COM`: keeping the domain is the only correct
   answer, yet `untranslated_word` fired in the guard and gate (two retries per page). `untranslated_source_word` now
   ignores words inside a URL/domain (`https://`, `www.`, dotted token); real lost words are still caught
   (`MATERIALS` -> `ATERIALS` remains a true positive).
2. `... SUCCESS!` -> `...ความสำเร็จงั้นเหรอ`: the Thai question particle carries the exclamation; the gate's emphasis
   licence now also accepts `งั้นเหรอ`/`เหรอ`/`หรอ`/`ไม่ใช่เหรอ`.

Evidence: the three affected pages re-run with **no guard triggers and gate 0**; translation 2.7-4.7 s vs 6.6-11.1 s
before. Tests added; suite **993 passed**.
## Digit-suffixed kept names and strong negation (round 274, #1099)

v10's two gate findings were false positives:

- `TYPESETTING BY RTSD, ZERO` -> `จัดหน้าโดย RTSD, ZER0`: the model kept the same credit but wrote a lookalike digit;
  the gate's letter token `ZER` looked like added Latin. `added_latin` now compares the whole alphanumeric token with
  lookalike digits normalised (`ZER0` -> `ZERO`); genuinely new Latin (`BONJOUR`) is still flagged.
- `T THATS NOT IT!` -> `ฉ- ไม่ใช่อย่างนั้น`: the strong negation carries the emphasis; the emphasis licence now accepts
  `ไม่ใช่`.

Re-scanning the v10 outputs with the fixed rules gives **gate `{}` and leftover `{}`**. Tests added; the dashboard fixture
was updated because its Iruma payload is one of the licensed cases; suite **995 passed**.