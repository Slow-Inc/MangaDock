# Branch-Reconciliation + Git Tech-Debt Plan / แผนรวม branch + เคลียร์ git tech debt

> **⚡ EXECUTION UPDATE 2026-07-10 (supersedes parts of §2 Phase C + §10 below):**
> - **Phases B, C, D DONE** on `integrate/render-reconcile` @ `908edba9` (off main ← merged landing, 25 conflicts, net 159 green). Full per-slice record: `docs/reports/RECONCILE-626-decisions.md`.
> - **PHASE C PIVOTED — render-geometry = landing's EXACT code, NOT main's spine.** Mid-execution the dev sharpened the constraint to *"คุณภาพต้องเหมือน baseline เท่านั้น"* (quality must EQUAL baseline). The first attempt (main spine + landing grafts) rendered dialogue 3.96% larger than the tuned landing baseline, so the render subsystem (rendering/__init__.py, render_overlap, text_render, patch_geometry, patch_renderer, text_layer, stages + tests + goldens) was reset to **landing's exact code**. Deterministic dump-replay A/B: **render == landing 0.0000% byte-identical**. This REVERSES §2 Phase C items 2 & 5 ("keep main's layout spine / reference_layout / KP"): **main's render campaign (#178 reference_layout / #180 KP / #183 squeeze) is SHELVED** (inert flags + orphaned reference_layout.py / render_replay.py / sizing_trace.py). Kept from main: **non-render** work only (translators + #623 thinking, Backend/Frontend, config, CI-infra #359/ADR 029, textline_merge is_sfx).
> - **Both quality gates PASS**: render (0.0000% vs baseline) + translation (#623 thinking-off == baseline quality, `docs/reports/benchmarks/2026-07-10-626-*`). Caveat: 9arm gateway is flaky (intermittent empty content, both thinking modes = infra, not a regression).
> - **Branch/git tech-debt DONE (§6 / #627 closed):** 4 abandoned worktrees + local branches removed; 3 closed-superseded origin branches archived as tags (`archive/mit-180-kp-425`, `archive/mit-183-squeeze-424`, `archive/chore-triage-422`) + deleted. KEPT: `#423` vertical (unique, default-off), baselines, `#360`, not-ours.
> - **REMAINING = dev-gated only:** Phase A (perf-WIP freeze, #625) + Phase E (merge integrate→main, ff main→perf, bump MIT_RENDER_VERSION). Agent self-merge to main is classifier-blocked. Follow-ups: #628 (telemetry — partly moot, landing sets render_branch), #629 (is_sfx helper).
>
> **Status:** authored 2026-07-10 · epic **#548** · supersedes the "landing = the only render" premise in earlier handoffs.
> **Hard constraint (dev, 2026-07-10):** *render AND translation quality must EQUAL baseline (landing) — not merely "not regress".* Render is now byte-identical; translation verified equal. This is a blocking gate.
> Grounded in: `git merge-tree` (read-only), full commit-log read (main 291 / landing 118), two code-read deep-dives, and a 2-agent clink-brainstorm (antigravity + codex converged). Detailed evidence: `docs/OPEN-WORK-LEDGER.md`, issues #548 / #624.
> **Visual companion: `docs/RECONCILIATION-PLAN.html`** — an interactive branch map (fork / merge / rebase / deploy timeline) + conflict budget + phase plan, with an EN / ไทย language toggle. Open it in a browser.

---

## EN

### 0. The corrected picture (why this is hard)

| Branch | role | unique work | render axis |
|---|---|---|---|
| **origin/main** | **TRUE TRUNK** | ALL app progress (frontend F1–F7, dashboard V2, LLM #507, wallet #463, backend B1–B5, CI #356–361) + render campaign **v2** | layout/fit: reference_layout #178, KP #180, width-squeeze #183, sizing-trace/replay, VRAM telemetry #279, #278 SFX gate |
| **origin/landing/render-phase0** | render R&D fork (+118, ~all render) | render campaign **v1** | inpaint/erase/rescue: selective-Flux #421, WIRED empty-balloon/white-box rescue, own_work_alpha overlap, white-caption flatten, #535 parse, display-SFX + page-frac cap |
| **origin/perf/mit-layout-fit-and-merge** | **PROD** (app-frozen 07-03) | Stage A, thinking-fix #623 (d05fb4dc), guards, ledger + **320-file uncommitted WIP** | old/WIP render (divergent from both) |

**The two render campaigns are COMPLEMENTARY, not duplicate.** main has the layout/fit spine; landing has the wired inpaint/rescue. main carries the *pure helpers* for landing's rescue work but left them UNWIRED (dead code) — landing actually ships them. Neither dominates → reconciliation is a **feature-merge at function granularity**, not a branch pick. Crux = the single function `resize_regions_to_font_size` in `rendering/__init__.py` (take-landing loses KP/#178/#183; take-main loses display-SFX/cap/dedup — both must survive).

Topology: `main` forked at `31f7b4d8` (07-02, +291); `perf`+`landing` share ancestor `efdf9c3c` (07-03), then `perf` +8 / `landing` +118.

### 1. Decision (clink-consensus + analysis)
- **Integration direction:** `main` is the base; `landing` merges ONTO it. Never invert (main owns irreplaceable app work; keep conflict contained to the MIT render subsystem).
- **Reject #624-first** (bounded render port → perf). It spawns a 4th render stream and widens perf↔main divergence. Allowed ONLY as a time-boxed emergency hotfix if prod is actively broken — it is not.
- **End state:** one trunk (main) with the reconciled render; `perf` becomes a thin deploy pointer that fast-forwards to main; WIP frozen, its unique bits cherry-picked only if a benchmark proves they matter.

### 2. Staged execution

**Phase A — Freeze & clean (DEV-gated; the one human blocker).** Dev commits perf-WIP to `wip/perf-freeze` (audit snapshot), restores a clean `perf`. Adopt worktree-budget + issue-ref guards so WIP can't re-accumulate. Nothing else can proceed while the 320-file WIP is live.

**Phase B — Integration branch (agent, off main).** `integrate/render-reconcile` from `origin/main`. Cherry-pick perf's small unique winners FIRST so they aren't lost: **#623 thinking-fix (d05fb4dc)**, Stage A correctness/observability. Then merge `origin/landing/render-phase0 --no-squash` (~23 conflicts).

**Phase C — Manual render reconciliation (agent, characterization-first / TDD).** Resolve in this ORDER:
1. **`config.py` + `Backend/src/books/mit-config.ts` together** — define the flag contract; every new key gets a Backend env mapping or is intentionally internal. Prod defaults: Flux OFF.
2. **`rendering/__init__.py`** — hand-merge `resize_regions_to_font_size`: keep main's layout spine (reference_layout fit / KP / width-squeeze / #430) AND import landing's display-SFX single-line, page-fraction SFX cap, equal-translation dedup, suppressed-region skip, `bubble_fit_tall`, render_branch/font_px/dst_box telemetry.
3. **inpaint/rescue wiring unit** — `manga_translator.py`, `patch_renderer.py`, `detection_postproc.py`, `patch_geometry.py`, `render_overlap.py`, `stages.py`: take landing's WIRED versions; graft main's VRAM telemetry (#279), #278 det_sfx FP-drop, synth-bubble fallback (#170/#178), replay harness (#462).
4. Take landing wholesale for isolated wired helpers where main's copy is dead: `selective_flux.py` (new), `sfx_merge.should_sfx_rescue`, numbered_contract tolerant parse, text_layer telemetry.
5. Keep main's `reference_layout.py` / KP / text_render line-breaker unless a landing test disproves it.

**Phase D — Deterministic quality gate (agent, GPU — one worker at a time).** Regenerate golden `.npz` from the RECONCILED code (never pick a binary side). Two gates, both blocking:
- **Render gate:** `bench_dump`/`bench_replay` vs the confirmed landing baseline on the One-Punch page + the 8-point defect checklist. No regression; commit PNG + MD report.
- **Translation gate (see below):** translation text must match baseline quality.

**Phase E — Promote & deploy (agent build, DEV merge-to-main gate).** Merge `integrate/render-reconcile` → main (classifier hard-blocks agent self-merge to default). Fast-forward main → perf. Bump `MIT_RENDER_VERSION` (code-only changes don't bust the patch cache). Enforce `MIT_INPAINTER=lama_large`, `MIT_SELECTIVE_FLUX=off`, KP gated by `render.knuth_plass` only. Keep a rollback branch.

### 3. Translation-Quality Gate (dev hard constraint — BLOCKING)
The reconciliation touches translation-affecting code; it must not regress translation quality vs baseline.
- **Translation-affecting files in scope:** `translators/custom_openai.py` (#623 thinking toggle), `translators/numbered_contract.py` + `parse_numbered_translations` (#535 index-based parse vs main's stricter parse), `translators/common_gpt.py` / `config_gpt.py`, and the OCR-VLM text path (`ocr_vlm.py`, `ocr_rescue.py`).
- **Gate:** before Phase E, run a deterministic translation comparison on the One-Punch benchmark page (and one Thai EN→TH page) — the reconciled branch's translated text must be **equal-or-better** than the baseline's, judged on: no dropped/garbled bubbles, correct index alignment (no page-wide misalignment), no romaji leakage, no empty content. Commit the before/after text diff + PNG.
- **Open translation item (do NOT bake a regression):** #623 disabled qwen3 thinking to stop the `content=None` 500. The dev reported this *felt* worse for translation. Keep `CUSTOM_OPENAI_ENABLE_THINKING` configurable; benchmark translation quality **thinking-off vs thinking-on-with-raised-max_tokens** and pick whichever matches/beats baseline — do not silently ship thinking-off as a quality trade. Resolve as its own slice, gated by this section.
- Baseline = the confirmed landing tuned render + its translation output on the One-Punch page (protect `MIT/example_translation.jpg`, `docs/images/render-quality/after-onepunch-eng.png`).

### 4. Merge-order conflict budget (verified, read-only)
| merge | real conflicts | notes |
|---|---|---|
| landing → perf | 1 (test_sfx_merge.py) | clean but WRONG base (perf app-frozen) |
| main → perf | ~11 | not used |
| **landing → main (integration)** | **~23** | the real set; solve ONCE |
| commit WIP first | landing→perf 1→9 | reason to freeze, not commit-then-merge |

### 5. WIP triage — 320 files → 5 buckets
1. **Discard, take main (25):** `.claude/memory/*.md` deletions — main already migrated to Obsidian (#531).
2. **Trash (264):** untracked screenshots (.png/.jpeg) + logs (.log/.out) at repo root & MIT/ → gitignore/delete.
3. **Reconcile vs landing (13):** MIT/manga_translator/* render modules — divergent; NOT a copy of landing. Cherry-pick a WIP-unique file (e.g. `safe_area.py` +22) only if the Phase-D benchmark proves it load-bearing.
4. **Review individually (~6):** mit-config.ts, .gitignore, bun.lock, Frontend/app/docs/*, docs/* edits.
5. **Keep, low-risk (11):** MIT/tools/*.py benchmark scripts.

Rule: port functions cleanly (copy WIP hunk → integration branch); never merge the dirty checkout; never `git add -p` the entangled tree.

### 6. Branch cleanup (clear git tech debt)
- **Squash-merged into main → DELETE (verify PR merged first):** ci/dispatcher-gate, feat/548-render-quality-port, refactor/f7-fetch-consistency, refactor/phase-4-backend-specs, fix/mit-encoding-542, fix/backend-readtimeout-544, test/green-heavy-ml-616-618, docs/pre-merge-rebase-rule, docs/tech-debt-batch-log, docs/finish-memory-migration, feat/588-scrutinize-gate, feat/608-restore-clobber, feat/610-append-only-guard, docs/ledger-sync-542-544, fix/548-scrutinize-followup.
- **Keep until reconciled:** landing/render-phase0 (baseline — never force-push/delete), perf, integrate/render-reconcile.
- **Investigate before delete:** fix/jest-skiplist (7), sync/mit-layout-fit-into-dashboard (10), feat/mit-lama-lum-reground (7), worktree-feat-mit-{knuth-plass,squeeze,vertical} (9/1/1 — abandoned 06-29, likely superseded), bench/* (baseline locks — keep as tags).
- **Not ours (leave):** feat/multi-provider-llm (akkanop), feat/frontend-ui, feat/mobile-*.
- Prune 4 abandoned local worktrees under `.claude/worktrees/`.

### 7. Landmine checklist (Phase C/E)
1. **is_sfx vs from_sfx_detection** — main's #431 display-SFX arm is DEAD (wrong attr). Merging landing's attr silently activates it. Introduce one `is_display_sfx_region(region)` helper; test 3 cases.
2. **flux_klein enum** — 500s on any branch without #277; Backend/.env shared → prod MUST default lama_large; log active inpainter at startup.
3. **VRAM OOM (12GB)** — selective_flux/empty-balloon OFF by default; one GPU worker at a time.
4. **KP gate** — `render.knuth_plass` ONLY, never `bubble_area_fit` (already ON); test toggling knuth_plass true→false in one process.
5. **Golden .npz** — regenerate from reconciled code; review by metric summary, never accept a side.
6. **config.py ↔ mit-config.ts drift** — resolve as one unit.
7. **Dead helpers** — for each imported helper, require one test/call-site proving reachability under its flag.
8. **Deploy** — bump MIT_RENDER_VERSION; `panel/lib/*` is an untracked gitignored runtime dep (#359) — copy like models/.
9. **Doc gap (corrected 2026-07-10)** — ADRs 022–028 **DO exist on `main`** (the earlier "they don't exist" note came from reading the `perf` working tree, which is app-frozen at 07-03 and lacks them). Genuinely missing: **ADR 020** (CI test gates for the merged #355 — sits unmerged on PR #360). Minor: `main` has a **numbering collision — two ADR 023 files** (`023-mit-bubble-area-fit-on-bounded.md` and `023-mit-lazy-package-import-boundary.md`); renumber one during Phase C.

### 8. What strictly needs the DEV (human gates)
1. Freeze the 320-file WIP (only the dev knows what to keep). 2. Merge integration → main (classifier hard-blocks agent self-merge to default). Everything else the agent can do.

### 9. Coverage / scope boundaries (what this plan does and does NOT cover)
This plan covers the **render/translation reconciliation** (main ↔ landing ↔ perf) and the MIT worktree/baseline branches. Coverage audit 2026-07-10:
- **In scope & tracked:** #625 (WIP freeze), #626 (integration; includes the unique **#182 vertical** slice via PR #423), #627 (branch cleanup + worktree PR disposition — #424/#425/#422 closed-superseded, #423 kept). Baseline locks (`bench/*`) kept. `feat/mit-lama-lum-reground` (PR #419 closed) = keep-as-tag-or-delete decision pending.
- **Ours but separately tracked:** **PR #360** (`docs/ci-gate-adr`) — the missing ADR 020 for merged #355; needs rebase (keep only the ADR + index line) + human merge.
- **⚠️ 2nd-axis divergence — NOT in this plan: `feat/dashboard` (PR #607).** A ~714-commit observability/infra fork (Prometheus/Grafana Alloy, redis-exporter, BusinessMetricsService, dashboard metrics) that forked from `main` back on **2026-03-13** — authored xeno 401 / akkanop 240, but the **open PR #607 is akkanop-led**, so per the ownership rule we do NOT drive it. It is a genuine second large divergence that will also need reconciling with `main` eventually; the dev should be aware it exists in parallel to the render fork. Flag-only here; not this plan's job.
- **Not ours (leave):** `feat/frontend-ui` (PR #606, akkanop role-mapping-v2), `feat/multi-provider-llm` (PR #523, akkanop), `feat/mobile-*` (PR #534, mobile team).

### 10. Model selection (2026-07-10)
- **Core judgment (Phase B/C/D) → Opus 4.8** (fast mode fine). Long-horizon agentic + hard code-merge + render/translation quality verdicts.
- **Mechanical work → cheaper** (qwen-agent / Sonnet 5): branch deletes, boilerplate, log/grep summaries.
- **Fable 5 → A/B on ONE crux file only** (`resize_regions_to_font_size()`), scored through the same deterministic gate; adopt only if it measurably wins. Never swap the whole-pipeline model on a hunch — a wrong core-merge regresses the baseline. Tracked in #626.

---

## TH / ภาษาไทย

### 0. ภาพที่ถูกต้อง (ทำไมยาก)
render campaign **2 สายเสริมกัน** ไม่ใช่ซ้ำ:
- **origin/main = trunk แท้** — app progress ทั้งหมด (frontend F1–F7, dashboard V2, LLM #507, wallet, backend, CI) + render campaign v2 (layout/fit: reference_layout #178, KP #180, width-squeeze #183, sizing-trace, VRAM #279, #278 SFX gate)
- **origin/landing/render-phase0** — render R&D fork (+118, render แทบทั้งหมด): inpaint/erase/rescue (selective-Flux #421, empty-balloon/white-box rescue ที่ wired จริง, own_work_alpha, white-caption flatten, #535 parse, display-SFX + page-frac cap)
- **origin/perf** — **PROD** (app แช่แข็ง 07-03) + thinking-fix #623 + **WIP 320 ไฟล์**

**main มี helper ของ rescue แต่ไม่ได้ wire (dead code) — landing ship จริง.** ไม่มีสายไหนชนะขาด → reconcile = **feature-merge ระดับฟังก์ชัน** ไม่ใช่ branch pick. คอขวด = `resize_regions_to_font_size` เดียวใน `rendering/__init__.py` (take landing เสีย KP/#178/#183; take main เสีย display-SFX/cap/dedup)

### 1. การตัดสินใจ
- **main เป็นฐาน, merge landing ทับ** — ห้าม invert (main มี app work ที่แทนไม่ได้; กัน conflict ไว้ที่ render subsystem)
- **reject #624-first** — สร้าง render stream ที่ 4 + ถ่างช่องว่าง; เก็บเป็น emergency hotfix เท่านั้น
- end state: **1 trunk (main)** พร้อม render ที่ reconcile แล้ว; perf = deploy pointer

### 2. แผน 5 เฟส
- **A Freeze** (🔴 DEV): commit WIP → `wip/perf-freeze`, คืน perf สะอาด, เปิด guards
- **B Integration** (agent): `integrate/render-reconcile` off main; cherry-pick #623+StageA ก่อน; merge landing --no-squash (~23 conflict)
- **C Feature-merge** (agent, characterization-first): `config.py`+`mit-config.ts` ก่อน → `rendering/__init__` → inpaint/rescue unit → helper ที่ landing wired → เก็บ reference_layout/KP ของ main
- **D Quality gate** (agent, GPU): regenerate golden .npz; **render gate** (bench vs baseline One-Punch + checklist 8 ข้อ) + **translation gate** (ดูข้อ 3); commit PNG+MD
- **E Promote** (🔴 DEV merge): integration → main; main → perf (bump MIT_RENDER_VERSION, flux OFF, KP gate ถูก)

### 3. Translation-Quality Gate (constraint แข็งของ dev — BLOCKING)
reconciliation แตะโค้ดการแปล → ห้าม regress คุณภาพการแปลเทียบ baseline
- **ไฟล์การแปลใน scope:** `custom_openai.py` (#623 thinking), `numbered_contract.py`+`parse_numbered_translations` (#535 index parse vs main strict), `common_gpt.py`/`config_gpt.py`, OCR-VLM text path
- **Gate:** ก่อน Phase E รัน deterministic translation compare บนหน้า One-Punch (+ 1 หน้า EN→TH) — text ต้อง **เท่าหรือดีกว่า** baseline: ไม่มี bubble ตก/garbled, index ตรง (ไม่ misalign ทั้งหน้า), ไม่มี romaji หลุด, ไม่มี content ว่าง; commit text diff + PNG
- **Open item (ห้ามฝัง regression):** #623 ปิด thinking เพื่อกัน content=None 500 แต่ dev รู้สึกว่าการแปลแย่ลง → เก็บ `CUSTOM_OPENAI_ENABLE_THINKING` ให้ config ได้; benchmark thinking-off vs thinking-on-เพิ่ม-max_tokens แล้วเลือกอันที่เท่า/ดีกว่า baseline — อย่า ship thinking-off เป็น trade เงียบๆ

### 4–8: ดู EN ข้างบน (budget conflict, WIP triage 5 กอง, branch cleanup, landmines 9 ข้อ, dev gates) — เนื้อหาเดียวกัน
