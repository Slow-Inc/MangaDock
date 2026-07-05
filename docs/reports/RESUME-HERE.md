# RESUME HERE (written by Fable 5, 2026-07-05 — for the next session/model)

**Where things stand:** branch `landing/render-phase0` in worktree
`C:\Users\xenod\AppData\Local\Temp\mp2-deploy-build` (~88 commits ahead of perf tip `efdf9c3c`).
Worker: launch from `<worktree>/MIT` with `MIT/.venv` python, port 5003, poll `/ready`.
**Stage A is MERGED into perf** (`1857a3bc`, user-authorized; WIP 312 files intact).


## UPDATE 2026-07-05 (AFK session) — #421 selective-Flux DONE + #540 partial
- **#421 Selective Flux — CODE-COMPLETE + verified** (`b989bc28`..`5f92b39e`, gated `MIT_SELECTIVE_FLUX`):
  routes text-over-textured-art regions to a Flux Klein repair pass (LaMa smears hair it can't synthesise).
  Discriminator data-grounded (real-mask dark_frac gap → 0.15), 11 TDD tests, live: hair→target, flat→0 cost.
  Model-safe (LaMa-unload+lock+try/finally). Remaining: prod promotion via Stage B only.
- **#540 boy-ghost — PARTIAL** (`ef14b97a`, gated `MIT_RESTRICT_FULLPAGE_MASK`): restrict fixes the
  CRF-over-reach half (regression-safe); the chibi half is a detection-FP (task #49-class, upstream) — filed.
- Team memory now encodes the full issue-workflow (GitHub Issues = task source of truth; PRD→issues→PR;
  bilingual body; update body on progress; close with reason) in always-loaded DoD + CLAUDE.md + Obsidian.
- Worker: last launched bg task on :5003 has the current landing code (0.15). Restart from worktree MIT/.

## Queue (in priority order)
1. **Stage B reconciliation** — GATED on the developer: commit their 312-file WIP (then do a real 3-way
   merge of landing's 9 overlap files + patch_renderer), or they designate per-file authority.
   Plan + measured divergence: `2026-07-05-phase3-convergence-plan.md`.
2. ~~**Lever 1 — adaptive mask dilation**~~ **DONE** (`888f9788`, gated `MIT_ADAPTIVE_DILATE`, off by
   default): `adaptive_dilate_mask` in `patch_geometry.py`; verified tight-on-texture (#248 safe). Benchmark:
   `benchmarks/2026-07-05-lever1-adaptive-dilate.md`.
3. **Boy-ghost flaky CRF defect** — filed with evidence in `2026-07-05-render-clip-fix-plan.md` (OUTCOME):
   a legit region overlaps the figure; CRF sometimes flags hair strokes as text → erased → LaMa smear.
   Happens at prod threshold; non-deterministic. Needs stroke-vs-art work in refinement; characterize first.
4. ~~**Docs debt**~~ **DONE** (`5dab6f1b`): PIPELINE §5 + impact-report batch entry + ADR 022 addendum now
   cover own_work_alpha / flatten_white_captions / white-box art gate / SFX cap+dedup / render-loop blank
   skip / adaptive_dilate / custom_openai index parse.
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
