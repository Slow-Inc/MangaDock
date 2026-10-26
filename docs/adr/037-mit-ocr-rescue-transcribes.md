# ADR 037 — MIT's OCR rescue transcribes the line; it no longer localises an SFX

- Status: Accepted, 2026-10-26 (#881, #1144). Evidence:
  [benchmark report](../reports/benchmarks/2026-10-26-phase0-ch6-defects.md).
- Scope: `MIT/manga_translator/ocr_vlm.py`, `manga_translator.py` (textline-merge rescue, `_empty_or_failed`),
  `stage_runner.py`, `text_layer.py`, `ocr/model_48px.py`, `region_filter.py`, `detection_postproc.py`,
  `utils/log.py`.
- Supersedes the premise of [ADR 026](026-mit-sfx-rescue-provenance-gate.md): the *gate* it built (det_sfx
  provenance, then the #693 real-text guard) is kept; the *answer* the rescue asks for is not.

## Context

ADR 026 (#168 / #278 / #693) built the rescue as a **target-language SFX localiser**: a det_sfx box the line OCR
could not read was sent to a vision model, which answered with the sound effect already written in the target
language, and the pipeline pre-set `text` + `translation` so the translate stage skipped it.

Phase 0 measured that design on a real chapter (Haimiya ch. 6, pages 10–11) and it failed in four ways at once:

1. **The call never reached the gateway.** `ocr_vlm` built its own headers and never sent
   `CUSTOM_OPENAI_EXTRA_HEADERS`, so OpenCode Go answered 400 MissingSessionID on every rescue call: **0 of 925**
   boxes rescued across three session logs. The header had only ever been wired into the translator client.
2. **The answer shape was wrong even when the call worked.** A hand-lettered *dialogue* line (`I'm glad.`,
   `Kurose -kun, you...`) is not a sound effect; asked for a target-language onomatopoeia, the model answered
   empty and the line was dropped.
3. **The box never reached the rescue.** The 48 px OCR dropped a guessed box whose read fell below the prob
   floor before the rescue gate ran (`I'm glad.` is 70 px glyphs).
4. **A thinking model could silence the rescue for 5 minutes.** deepseek spent the 512-token budget reasoning
   (`finish_reason=length`, empty content); three in a row tripped the breaker, which pauses the rescue for 300 s.

## Decision

1. **The rescue transcribes the source text** in the crop (`vlm_transcribe`, `TRANSCRIBE_PROMPT`, `parse_transcription`
   for `NONE` / refusals / `SFX:` prefixes). Translating it is the translate stage's job — and the translator already
   sees the page image (ADR 036), so it picks pronouns and register with the scene in front of it.
2. **It rides the translator's transport and model** when `CUSTOM_OPENAI_PROTOCOL=anthropic`: the same
   `/anthropic/v1/messages` endpoint and `claude-haiku-5-5` as the translator, which does not think, so a one-line
   answer is not lost to a reasoning budget (probe: 1.9–2.1 s, clean answers). The OpenAI path is kept for other
   deployments.
3. **A guessed box survives OCR.** `keep_ocr_line` keeps det_sfx and placeholder boxes (empty-balloon, ink-cluster)
   with `text=''` even below the prob floor, so the rescue sees them; a normally read line still needs its text.
4. **`resolve_rescue` decides the outcome as pure data**: nothing transcribed → drop (as before); a box that swallows
   ≥70 % of dialogue lines replaces them only when the transcription repeats **all** of them and adds text
   (`Kurose` → `Kurose -kun, you...` = container takeover), otherwise it drops (the #887 r3 phantom); a box that
   overlaps a line whose text repeats its own → drop; otherwise keep, and the line goes through translation like any
   other. Every outcome is logged with its reason.
5. **Reads of only dashes and rings are not sent** (balloon arcs: 60 live calls, 0 text). Placeholders skip the SFX
   ink gate they already passed when they were created.
6. **A failed page is an error, not an empty page** (#1144): `stage_runner` records the stages that failed and fell
   back, per request; `text_layer.page_failure` calls a page failed when a stage failed or ≥2 lines came back
   identical to the source (two is the live repro — ch. 6 p2 echoed twice, and the first cut-off of three missed
   its own defect); `translate_patches` raises `PageTranslationFailed`, the worker answers **422** (not 500, which
   the Backend retries 30 times as "MIT is still starting"), and the Backend never caches a page error. The
   pipelined batch path records the same failure per page and hands it back with the page's own result instead of
   raising for the whole chapter.

## Alternatives considered

- **Fix the missing header and keep localising.** Rejected: cause 2 is independent of the header — the answer shape
  is what lost the hand-lettered dialogue.
- **Ask for a translation directly in the rescue call.** Rejected: it duplicates the translator's job with a weaker
  context (no page image, no rolling glossary, no series context) and would render in a style the translate stage
  then has to re-do.
- **Retry on `finish_reason=length` with a bigger budget.** Rejected: a thinking model burns seconds per box and the
  failure returns under load; changing the transport removes the failure mode.
- **Keep the old localiser for other deployments.** Not kept: leaving two rescue designs in the tree is exactly the
  trap ADR 026's own 2026-07-28 amendment recorded (two implementations, one without the guard).

## Consequences

- **Live evidence:** ch. 6 p.10 `I'm glad.` → ดีใจนะ on 6/6 page runs; p.11 `Kurose -kun, you...` → container
  takeover on 3/3; no `400 MissingSessionID`, no `transcription unusable`, no breaker pause in the 9,370-line
  verification log.
- **Cost:** the chapter wall time is unchanged within run-to-run noise — 17.6 / 23.2 / 27.4 s on the fixed branch
  against 18.6–26.3 s pre-fix and 16.6–23.7 s on `main`. The added vision calls are prefetched concurrently with
  the rest of textline_merge, so they overlap instead of adding turns.
- **Still noisy:** on pages 10–11, 98 of 153 transcription calls read nothing (single kana, `I`, `O`, art). They
  are dropped correctly, but each costs a vision round-trip. A cheaper pre-gate is the next obvious step.
- **The page-failure cut-off is a heuristic** (≥3 echoed lines), chosen so a page whose only text is a sign or a name
  is not reported as an error. Pages whose source legitimately equals the target (a page of romanised SFX) would
  trip it if they also lost every line.
- **The #693 real-text guard stays**, but it now applies only to non-guessed boxes: a det_sfx box read as 1–2 ASCII
  marks is still rescued (the transcription answers `NONE` instead of inventing an SFX), which is what recovered
  `Kurose -kun, you...` from an ink-cluster placeholder read as `14`.
- **Known limits, stated rather than hidden:** the stage-crash half of the rule only records stages when
  `ignore_errors` is on (with it off the pipeline raises anyway); a page whose only `n` lines legitimately
  translate to themselves and produce no render now reports a failure instead of an empty page; and with the
  balloon-less pages now reaching the ink-cluster rescue (#1147), a bright panel with line art can become a
  placeholder — it is transcribed and kept like any other guessed box.

## Review (2026-10-26) — what two independent reviewers changed before merge

The branch was reviewed by two agents that traced the call paths rather than the diff. Six changes came out of it:

1. **The batch path was unfixed** — `translate_batch_pipelined` never began a page, and its back phase returned an
   empty success. It is the path whose results the Backend caches, so the #1144 bug survived there. Each phase now
   owns its page (`begin_page` / `failed_stages` per phase task, since a ContextVar copies the list reference, not
   the list) and a failed page rides its own result as `error`.
2. **500 vs 422** — a settled page failure raised `RuntimeError`, became HTTP 500, and the Backend retried it 31
   times, re-running the whole GPU pipeline. It is now `PageTranslationFailed` → 422, and the front server keeps the
   worker's status instead of collapsing every failure to 500.
3. **`is_translator_note` dropped real translations** — "wholly in brackets" also matched `(BAM!)`, `(sigh)`,
   `(DING DONG)`: ordinary translated asides and SFX that `main` rendered. It now requires a phrase that says the
   line is empty or unreadable.
4. **A guessed box could blank the line it merged with** — the rescue keeps an unread box with `text=''`, and
   `TextBlock` took `texts[0]` verbatim; the first non-empty text is the line now.
5. **The splitter cut a line that merely overhung its own balloon** into an overlapping neighbour. It now requires
   at least one line height of the line to lie outside the first balloon.
6. **The transcription call never checked its HTTP status** — a 400 body parsed to "no text" and the breaker stayed
   closed: the original #881 failure, silently. Non-200 now fails the breaker and logs; a 200 with no content blocks
   is not an answer; and an Anthropic protocol with no Anthropic model set says so once instead of 400-ing for ever.

Smaller: `resolve_rescue`'s phantom check now requires the box to be half inside the line it repeats (a real
two-letter SFX clipping a bubble survives), the drop log carries the verdict's reason instead of calling every drop
"repeats an overlapping line", the dead `swallows_dialogue` helper and a #1146 test that passed on `main` were
deleted, and the rescue's gateway headers are read per call (torch-free — importing `translators.keys` would have
dragged torch into the CI logic gate).
