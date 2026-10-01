# Translation-quality eval (MVE) — `eval/translation_eval.py`

Master Plan 2 Phase 0 (#526). We measure render-parity but had **no** measure of translation
*accuracy* — so no translation-side cluster (P2 context, P6 SFX, P7 contract/voice) could be shown to
move quality. BLEU/COMET don't fit manga (no aligned corpus); the 4-reviewer consensus was a
**rubric-based blind human-eval**. This module is the reproducible scaffolding around that human
judgement — the human grades, the harness makes the set/blinding/aggregation deterministic.

## The protocol (agy's MVE — a 2-person team, ~1 week)

- **Source:** 3–5 chapters (~60–100 pages) of a series that has an **official English translation**
  (the reference), or Manga109.
- **Sample:** 100 bubbles spanning dialogue + narration + SFX.
- **Rubric — score 0-2 per axis:**
  1. **faithfulness** — 2 accurate meaning · 1 minor nuance lost · 0 hallucination/garble
  2. **cohesion / reading-order** — 2 flows, correct pronouns, connected multi-bubble clauses · 1 minor
     pronoun slips · 0 broken syntax
  3. **style / naturalness** — 2 matches character voice + semantic SFX · 1 stilted / romaji SFX · 0
     untranslated JP / unreadable
- **Blind:** person A generates the MIT output (and toggles like RollingContext ON/OFF); person B,
  **blind** to config and to which side is MIT, grades each item vs the official reference.

## How the harness supports it

```python
from eval.translation_eval import (
    load_eval_set, make_blind_pairs, unblind_preference,
    RubricScore, aggregate, render_scorecard,
)

items = load_eval_set('eval/my_chapter_set.json')      # (source, MIT candidate, official ref) triples
pairs = make_blind_pairs(items, seed=20260704)          # candidate vs reference → seeded, balanced A/B
# → person B reads pair.left ("A") / pair.right ("B"), records a RubricScore + an A/B preference.
scores = [RubricScore('ch1-p3-b2', 2, 2, 1), ...]       # 0-2 per axis, validated on aggregate
prefs  = {'ch1-p3-b2': 'A', ...}                        # blind choice: 'A' | 'B' | 'tie'
agg = aggregate(items, scores, blind_pairs=pairs, preferences=prefs)
open('docs/reports/benchmarks/2026-..-translation-eval-contextON.md', 'w').write(
    render_scorecard(agg, meta={'title': 'context ON', 'date': '2026-..'}))
```

- `make_blind_pairs` is **seeded + balanced** (⌈n/2⌉ candidates on the left, rest on the right) so the
  grader can't exploit a position bias and every run reproduces. `unblind_preference` maps the grader's
  `A`/`B`/`tie` back to `candidate`/`reference`/`tie` after grading.
- `aggregate` gives per-axis means, an overall mean, per-bubble-type means, and the candidate **win-rate**
  (how often MIT beat the official reference) from the blind A/B.
- `render_scorecard` emits the committed markdown gate.

## Using it as the A/B for a change (P2/P6/P7)

Generate two candidate sets (e.g. RollingContext ON vs OFF) for the same source items, grade both
blind, and compare the scorecards. A cluster's translation claim is "done" when its scorecard shows a
real per-axis lift with no regression — the same discipline the render clusters get from the offline
replay harness.

## Files
- `translation_eval.py` — the harness (stdlib only; `test/test_translation_eval.py`, 9 tests, <0.1s).
- `sample_eval_set.json` — **illustrative** synthetic set (format demo, not real data / not a claim).
- `docs/reports/benchmarks/2026-07-04-translation-eval-harness-demo.md` — an illustrative scorecard from
  the sample set (synthetic — demonstrates the output only).

## Not yet done (the real eval run)
Assembling the 100-bubble set (source + MIT candidate + official EN reference) and the human grading are
the **next** step — that produces the first *real* scorecard and the P2 context ON/OFF A/B. The harness
above is the reusable, tested machinery for it.
