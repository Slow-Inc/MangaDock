# RESUME HERE (written by Fable 5, 2026-07-05 — for the next session/model)

**Where things stand:** branch `landing/render-phase0` in worktree
`C:\Users\xenod\AppData\Local\Temp\mp2-deploy-build` (~88 commits ahead of perf tip `efdf9c3c`).
Worker: launch from `<worktree>/MIT` with `MIT/.venv` python, port 5003, poll `/ready`.
**Stage A is MERGED into perf** (`1857a3bc`, user-authorized; WIP 312 files intact).

## Queue (in priority order)
1. **Stage B reconciliation** — GATED on the developer: commit their 312-file WIP (then do a real 3-way
   merge of landing's 9 overlap files + patch_renderer), or they designate per-file authority.
   Plan + measured divergence: `2026-07-05-phase3-convergence-plan.md`.
2. **Lever 1 — adaptive mask dilation** (approved direction, not yet built): per-mask-component, measure
   local background flatness in a ring around the component; FLAT → dilate 10-15px (kills LaMa ghost
   seeding), TEXTURED → keep tight (preserves #248). Pure cv2 + TDD; wire where the erase mask is built
   (full-page block in `manga_translator.py` + per-crop in `patch_renderer.py`, next to
   `union_refined_with_fallback`). Rationale: `2026-07-05-page-review-defects.md` (LaMa-ghost follow-up).
3. **Boy-ghost flaky CRF defect** — filed with evidence in `2026-07-05-render-clip-fix-plan.md` (OUTCOME):
   a legit region overlaps the figure; CRF sometimes flags hair strokes as text → erased → LaMa smear.
   Happens at prod threshold; non-deterministic. Needs stroke-vs-art work in refinement; characterize first.
4. **Docs debt:** PIPELINE §5 + system-impact-report entries for the post-review fixes
   (`own_work_alpha`, `flatten_white_captions`, white-box art gate, SFX cap+dedup, render-loop blank skip).
   ADR 022 may warrant an addendum.
5. Deferred with rationale: Slice E `_bubble_fit_layout`, 0d dump-replay rig, Stage C (perf↔main 123/27),
   pushing perf to origin (ask user).

## Hard-won rules (do not relearn these)
- Every "leftover text" symptom has 4 distinct mechanisms: mask-not-covering / patch-overlap stomp /
  alpha-threshold leak / LaMa reconstruction. Isolate with the 4-up method (original|patch-RGB|alpha|composite)
  before fixing. Playbook: `2026-07-05-page-review-defects.md`.
- NO pixel heuristic separates line-art from text inside a bubble (CC size and ink-fraction both failed and
  destroyed a character figure). Only erase inside VERIFIED white caption boxes, art-gated (both-dims CC cap).
- `render()` draws IN-PLACE on img_inpainted — snapshot backgrounds before diffing.
- Probes: `text_threshold=0.3` was an EXPERIMENT — prod uses default 0.5; 0.3 causes detection FPs on art.
  Use prod-faithful configs for benchmarks (rule: /patches endpoint, full MIT_* mirror incl. ocr section).
- Worker restarts: TaskStop own background task → relaunch → poll /ready. Never two GPU workers.
