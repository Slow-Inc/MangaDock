# Open-issue audit — done-but-open (issue-lifecycle gap)

Triggered by the developer: past sessions forgot the `/to-prd → /to-issues → close-on-done` workflow (the
close-on-done rule lived only in the on-demand `/to-prd` skill, now promoted to a DoD gate). This audits the
~55 open issues authored by `xenodeve` against code/impact-report/test evidence.

## Closed this pass (high-confidence: impl + impact-report "green" + tests)
- **#175** bubble-fit overflow (line-height/margin/cap) — `_LINE_HEIGHT/_FIT_MARGIN/_MAX_FONT_BOX_RATIO`,
  `test_font_fit.py`, impact-report green. **CLOSED.**
- **#183** squeeze-on-collision + dst-bounds clamp — `squeeze_width`, render() bounds clamp, impact-report
  green. **CLOSED.**

## Candidate done-but-open — needs a developer call (impl exists, but a caveat blocks an auto-close)
| # | Title | Evidence | Caveat → why not auto-closed |
|---|---|---|---|
| #436 | in-bubble double-detect overlap + giant-bubble co-occupant | commit `1410c4df` "#436 dedup kills text-over-text duplicates" (slice B) + engulf dedup (#19) | overlap half FIXED; the "giant bubble_box misplaces co-occupant (occupancy=3)" half — balloon_occupancy gates bubble_fit to sole occupants but not verified against this exact panel. Verify on Gal Yome p4 then close. |
| #172 | OCR rescue ladder (split over-long + vision re-read) | `ocr_vlm.vlm_localize_sfx` + `MIT_OCR_VLM_RESCUE` shipped | vision re-read DONE; "split over-long textlines" step not confirmed. Partial. |
| #180 | Knuth-Plass line-breaking | `KnuthPlassLineBreaker` in text_render + `line_break.py` | impl DONE but GATED OFF (`MIT_KNUTH_PLASS` absent from prod .env — rolled back for narration bloat). "Done-impl, disabled." Close-as-implemented or keep for the bloat fix — dev's call. |

## Likely NOT done (keep open)
- **#278** gate SFX rescue on `is_sfx` provenance not ≤4-char heuristic — `is_sfx` grep = 0 in
  `manga_translator.py`; the length heuristic appears to still gate. **Open.**
- **#537** Phase 0c+0d — 0c done, **0d dump-replay rig NOT built**. Open (partial).
- **#538** Phase 1 slices — B/C/D done, A partial, **E deferred**. Open (partial).
- **#539** Phase 1b — DONE on `landing`, not yet merged to perf → close after the PR/Stage-B promotion.
- **#540** boy-ghost — pending.
- **#420** non-deterministic pipeline (boxes drop) — index-parse fix helps text alignment, but detection
  non-determinism itself remains. Open.

## PRD / epic umbrellas — keep open until children close
#535, #528, #178, #268, #169, #171, #155, #434, #304, #279, #143.

## Not audited this pass (older / other-domain — needs its own read against evidence)
Dashboard/Staff: #280–#285, #305, #279. CI: #356/#357/#358. Backend: #140, #141 (MitClient extracted →
`Backend/src/books/mit-client.ts` exists → likely done, verify BatchJobRegistry), #160/#161.
MIT older: #418, #421, #430/#431/#432, #459/#460, #503, #527, #269/#270/#271/#276, #174/#182/#437.

## Recommendation
Close #175/#183 (done here). For #436/#172/#180 the dev picks close-as-is vs finish. The PRD umbrellas
stay open by design. The "not audited" set is a follow-up sweep (each needs a code read, not a grep).
