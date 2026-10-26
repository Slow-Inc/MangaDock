# Rolling cross-page dialogue context with gpt-6-luna — measured, rejected (MIT_CONTEXT_PAGES=0)

**What it is.** `MIT_CONTEXT_PAGES` (#159) keeps the previous pages' translated dialogue and injects it into the
next page's prompt (`translator.prev_context`). It is the existing lever for cross-page continuity — pronouns,
how a character was addressed, what was just said — and it was off (`0`) while everything else was retuned.

**Setup.** Haimiya ch. 6, production batch path, `series_context` set so the name memory also runs (the setup that
made name spellings consistent last round). Two chapter runs with `MIT_CONTEXT_PAGES=2` and two without, same
pages, same config otherwise.

**Cost: unacceptable.**

| arm | chapter wall (14 pages) |
|---|---|
| baseline (`MIT_CONTEXT_PAGES=0`) | 43.2 s / 58.5 s |
| rolling context (2 pages) | **284.8 s / 264.3 s** |

Roughly 6× slower. Injecting two pages of dialogue into every prompt both grows the prompt and loses prompt
caching on the gateway, so the translator's latency dominates the chapter. (Recorded for whoever revisits this:
the lever may become affordable if only the *speakers' names and addresses* are injected instead of full dialogue.)

**Quality: no gain.** Blind judge (deepseek-v4.1-flash, same protocol as every other A/B here) over the 20
randomly sampled differing lines out of 53: **context 9 : baseline 10 : tie 1**. Within noise, and if anything
slightly against.

**Decision:** keep it off (`MIT_CONTEXT_PAGES=0`). The continuity lever that *did* work is the name memory, which
is deterministic, costs nothing per page, and fixed 4 of 5 occurrences last round.

**Limits:** one chapter, two runs per arm; the judge sees single lines, so a genuine cross-page improvement (e.g.
a pronoun that only makes sense two pages later) could be invisible to it; the 6× cost is the dominant term
either way.
