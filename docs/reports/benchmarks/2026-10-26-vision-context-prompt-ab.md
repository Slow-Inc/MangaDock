# Scene notes in the translation prompt (MIT_VISION_CONTEXT) — tested, not adopted

**What was built:** a per-page analyst pass. With `MIT_VISION_CONTEXT=1`, `_run_text_translation` sends the page
image plus the OCR lines to **claude-haiku-5-5** (the analyst chosen in round 4), asks for one JSON object of
per-line `corrected` text, `speaker`, `gender`, `role` and `emotion`, and prepends that as a compact
"SCENE NOTES" block to the numbered segments the translator (gpt-6-luna) receives. It fails open: a gateway or
parse failure logs one warning and translates without notes.

**Run:** pages 9 and 10 of Haimiya ch. 6, same OCR/rescue/model as the adopted stack, only the notes differ.
The analyst produced notes for 8 and 7 lines (logged), so the path is live.

**Blind judge** (12 differing segments, A/B order shuffled, deepseek-v4.1-flash, same method as the model A/B):

| with scene notes | without | tie |
|---|---|---|
| 5 | **7** | 0 |

Not a win. Reading the pairs by hand agrees it is a wash: the notes help where they should — the girl
addressing the boy comes out as `คุโรเสะคุง นาย...` instead of `เธอ`, the stutter keeps its shape, "worried the
whole time" reads more naturally — but they also flatten one line (`ดีจังที่ทุกอย่างกลับมาเป็นปกติ` loses the
"ดีใจจัง" of the plain run) and the judge preferred the plain version overall.

**Cost:** the analyst call runs before translation and is measured inside the translation stage:
**7.8 s → 17.4 s p50** on these pages. Paying ~10 s/page for a 5:7 wash is not defensible.

**Verdict: the code stays, the flag stays off.** `MIT_VISION_CONTEXT=1` is available for the next evaluation
(e.g. selective use: only lines the analyst marks ambiguous, or only pages with more than two speakers), but the
default stack keeps today's prompt. This matches the PRD's own warning that published results show book-level
context does not help consistently.

**Where the analyst output is still worth trying**
1. **Selective notes**: only lines where the analyst disagrees with the OCR reading or marks the speaker unknown.
2. **Corrected OCR only**: feed the corrected English as the source line and measure translation quality alone
   (page 9/10 corrections were 7/7 and 3/3 right, so this is the part with real signal).
3. Human judge on a larger sample; a text-only LLM judge may not be sensitive to pronoun/addressee correctness,
   which is exactly what the notes change.
