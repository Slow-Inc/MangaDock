# Guard cost is negligible, and the gate dashboard is clean over the whole corpus (2026-10-23)

## 1. Latency cost of the deterministic guards

Timed every guard predicate over **15,071 real stored segments** (`src`/`dst` pairs from all doctor runs):
`foreign_script`, `negation_lost`, `runaway_translation`, `spurious_filler`, `lost_as_rare`, `dropped_question`,
`untranslated_source_word`, `content_loss` and `strip_leaked_script`.

| measure | value |
|---|---|
| all guards, per segment | **0.025 ms** |
| all guards, per 17-region page | **0.43 ms** |
| share of an 9.0 s page | ~0.005 % |

So the quality-first guard set costs effectively **nothing** in wall time; the retry cost (one extra gateway call)
is paid only on the pages/segments a guard actually fires on.

## 2. Gate dashboard over the corpus

Ran `quality_gate.check_page` over the **latest doctor output of every corpus page** (44 rendered page payloads,
39 corpus pages plus variants): **0 violations**.

This is the deterministic end state of the loop: every stored rendering of the corpus passes every gate rule the
loop built (foreign script, runaway, doubled/leading marks, control chars, added Latin, dropped punctuation), and the
judge baseline sits at 1.44-1.48/2 with the usual judge-noise caveat.