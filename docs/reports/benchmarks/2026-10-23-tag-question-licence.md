# `dropped_question` tag-question licence (measured false positive)

- **Date:** 2026-10-23 · `translation_quality.dropped_question`.

## The false positive

The v3 default sweep left one `dropped_question` leftover that the retry loop could not fix:

- source `ITS JUST AINT FAIR, YKNOW?` -> shipped `มันไม่แฟร์เลยนะเนี่ย!`

The `?` is a **discourse tag** (`..., y'know?`), and Thai realises it with a particle/exclamation (`นะเนี่ย`) rather
than a question marker. The guard retried twice, the model kept the idiomatic line, and the retry budget was spent.

## Fix

`dropped_question` now returns False when the source ends in a tag-question word: `YKNOW | YOU KNOW | RIGHT | EH |
HUH | OK | OKAY | HMM`. Real questions are unaffected (`IS THAT SO?` still fires when the Thai has no marker;
questions whose Thai marker exists were never flagged).

- Re-ran the dashboard on the same outputs: **leftover `{}`** (was `dropped_question: 1`), gate unchanged otherwise.
- Tests: tag licence + real-question control (`test_tag_questions_are_licensed_1024`); full suite 962 passed.
## Gate alignment

The deterministic gate had its **own** question-marker check and still flagged the same line. It now imports the same
licence (`is_tag_question`) before flagging `dropped_?`. Re-ran the dashboard on the same outputs:

- gate: `{dropped_?: 1}` -> **`{dropped_!: 1}`** (the one remaining is a real lost exclamation),
- leftover: `{}`.
- Gate test added (`test_tag_questions_are_licensed_in_the_gate_1025`); full suite 963 passed.