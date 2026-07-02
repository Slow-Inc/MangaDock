# MIT Speed Optimization — Detailed Execution Plan (hand-off)

> **Audience:** any agent/developer executing this WITHOUT prior session context. Everything needed is here + the two companion docs. Read them first:
> 1. `MIT/OPTIMIZATION.md` — the full perf reference (measured data, surviving/rejected optimizations, landmines). **This plan implements its backlog #1, #2, #5 + optimizations M1/M2 + the layout_fit fix.**
> 2. `docs/reports/2026-07-02-mit-speedup-e2e-measurements.md` — how the numbers were measured.
>
> **Status when this plan was written (2026-07-03):** Phase −1 (already done, uncommitted in working tree). Phases 0–3 not started.

---

## Model assignment (per phase — do not downgrade)

| Phase | Minimum model | Effort | Why |
|---|---|---|---|
| 0 — Instrument | **Sonnet 4.6** | medium-high | Mechanical, code sketches + line refs provided; py_compile + log output catch mistakes |
| 1 — Characterization tests | **Sonnet 4.6** | medium | Pure pattern-following from `test_render_golden.py`; seam + construction snippets provided |
| 2a — merge M1+M2 | **Sonnet 4.6** | high | Single function, byte-identity proof given; characterization test is the net |
| **2b — layout_fit fix** | **Opus 4.8** | **high/auto** | The ONLY real judgment point: interpret Phase 0 breakdown, pick the lever, and **know when to STOP and ask the user** (auto-grow / pack outcomes are parity items). Do not run this phase on Sonnet/Haiku. |
| 2c — T1 token log | Haiku 4.5 acceptable | low | Two lines, zero risk |
| 3 — Verify E2E + docs | **Sonnet 4.6** | high | Playwright navigation is fiddly (recipe in `frontend-testing` skill) but no deep reasoning |

**If running the whole plan on one model:** use Sonnet 4.6 effort high for Phases 0/1/2a/2c/3, and **switch to Opus 4.8 for Phase 2b** — or, if staying on Sonnet, hard rule: *when Phase 0 data points at the auto-grow loop or `pack`, STOP after writing findings and wait for the user; implement nothing.*

**Never:** Haiku for Phases 0/2a (too many landmines in the touched code), or effort low on any phase that edits MIT code.

---

## 0. Why (measured, not guessed)

| Fact | Number | Where measured |
|---|---|---|
| Render **layout_fit** is bottleneck #1 | **12–14s for ONE hard-to-fit region** (stage total 61.5s on dense page = several such regions) | `[timing-render] phase=layout_fit` log line, E2E 2026-07-02 |
| Render **raster_loop** (glyph draw + 4× supersample) is CHEAP | ~1s | `[timing-render] phase=raster_loop` |
| **textline_merge** is bottleneck #2 | 0.7s sparse → **10.2s dense/SFX page** | `[timing] stage=textline_merge` |
| Everything else | translation 2.8-4.3s (network), OCR ~2s, detection 1.2s warm, **inpaint 0.3s** | `[timing] stage=*` |

**Critical unknown:** WHY layout_fit takes 12-14s. The obvious suspects were **debunked** by adversarial review (see OPTIMIZATION.md §1): `select_hyphenator` is a no-op for Thai targets; pythainlp newmm caches its Trie. Known sub-costs sum to an order of magnitude LESS than 12-14s. **Therefore: instrument first (Phase 0), optimize second (Phase 2b). Do NOT skip to optimizing.**

## 0.1 Hard gates (violating any of these = do not merge)

1. **Render-parity is DECIDED** (narrow-column wrap + 4× supersampling + true vertical + SFX). Any change that alters chosen `font_size`, wrap width (`used_w`), or `dst_points` geometry is a parity break → needs explicit user sign-off, never silent.
2. **No full-run A/B measurement.** OCR-VLM + LLM sampling make two runs of the same page produce different regions/text. Validate ONLY via (a) per-stage timers on the same run, (b) fixed-input characterization tests.
3. **Module-global font:** `text_render.set_font()` sets a process-global face; `calc_horizontal` reads it implicitly. Any cache whose key omits font identity is WRONG across regions with different fonts (#176). Caches must be per-region-scoped (cleared between regions) or keyed on font id.
4. **#183 no-force-break contract:** words must not be broken mid-word when avoidable (`HMPH` must never become `HM/PH`). Guarded by the `_longest_word_w` reject at `rendering/__init__.py:111`.
5. **1 seam = 1 commit** (team convention) — every optimization is its own revertable commit, tests green at every commit.
6. **`quadrilateral_can_merge_region` output is semantic**, not cosmetic: different merge → different region grouping → different text sent to the translator. Byte-identical or bust.

## 0.2 Current working-tree state (IMPORTANT — handle before starting)

Repo is on branch `docs/wire-agent-skills-config` with **many uncommitted changes**, most UNRELATED to this work (Obsidian memory migration, CLAUDE.md, Frontend files). The MIT-relevant uncommitted changes that BELONG to this plan:

- `MIT/manga_translator/manga_translator.py` — `_timed_stage` decorator (module level, after `set_main_logger`) + `@_timed_stage("...")` on 9 `_run_*` methods. Logs `[timing] stage=X elapsed_ms=Y`.
- `MIT/manga_translator/rendering/__init__.py` — `import time` + two `[timing-render]` phase timers (layout_fit / raster_loop) inside `dispatch()`.

**Step 1 of execution:** `git checkout -b perf/mit-layout-fit-and-merge` (branch from current HEAD is fine — do NOT try to move to main with this dirty tree), then commit ONLY those two files as commit #1 ("feat(mit): standing per-stage + render-phase timers"). Leave all other dirty files untouched — they belong to other workstreams.

Note: `MIT/manga_translator/config.py, detection_postproc.py, ocr_vlm.py, patch_geometry.py, patch_renderer.py, render_overlap.py, rendering/text_render.py, stages.py, textline_merge/__init__.py, utils/generic.py, utils/textblock.py` also show as modified in `git status` — those are PRE-EXISTING modifications from earlier workstreams, NOT part of this plan. Do not commit them in commit #1. `git diff` each file if unsure; the timers are only in the two files listed above.

---

## Phase 0 — Instrument `calc_horizontal` internals + textline_merge breakdown

**Goal:** attribute the 12-14s to a specific sub-step, and the 10.2s merge to step-1 vs split. Numbers, not guesses.

### 0-A. `calc_horizontal` breakdown — `MIT/manga_translator/rendering/text_render.py`

Structure of `calc_horizontal` (line numbers as of 2026-07-03 — **anchor by symbol, lines may drift**):

| Sub-step | Location |
|---|---|
| `_insert_thai_word_breaks` / `_insert_cjk_word_breaks` | :855-856 |
| `get_char_offset_x` (space/hyphen) | :860-861 |
| `_split_words_and_widths(text, font_size)` | :864 |
| auto-grow `while True` (rescales `max_width` ×≥1.05 until fits) | :867-876 |
| `_split_into_syllables(words, font_size, max_width, language)` | :879 |
| `select_hyphenator(language)` | :881 |
| `breaker.pack(...)` (step-1 greedy width packing) | :887-890 |
| steps 2-4: backward hyphenation / single-char shuffle / assemble (many `get_string_width`) | :916-1042 |

**Implementation — module-level accumulator (logging only, zero logic change):**

```python
# text_render.py, module level (#speed-study Phase 0)
_CALC_H_STATS = {"calls": 0, "autogrow_iters": 0, "seg_s": 0.0, "words_s": 0.0,
                 "syll_s": 0.0, "hyph_s": 0.0, "pack_s": 0.0, "post_s": 0.0,
                 "gsw_calls": 0}

def reset_calc_h_stats():
    for k in _CALC_H_STATS: _CALC_H_STATS[k] = 0 if isinstance(_CALC_H_STATS[k], int) else 0.0

def get_calc_h_stats():
    return dict(_CALC_H_STATS)
```

Inside `calc_horizontal`: `_CALC_H_STATS["calls"] += 1`; wrap each sub-step listed above with `t=time.perf_counter()` … `_CALC_H_STATS["seg_s"] += time.perf_counter()-t`; count auto-grow iterations; steps 2-4 wrapped as one `post_s` block. For `gsw_calls`, increment a counter inside `get_string_width` itself (1-line addition). `import time` at top if missing.

**Report per region** — in `rendering/__init__.py:resize_regions_to_font_size`, around each region's layout work (the per-region loop at ~:298), OR simpler: in `dispatch()` where `[timing-render] phase=layout_fit` is already logged, call `text_render.reset_calc_h_stats()` before `resize_regions_to_font_size(...)` and log after:

```python
stats = text_render.get_calc_h_stats()
logger.info(f"[timing-render] phase=layout_fit_breakdown {' '.join(f'{k}={v:.1f}' if isinstance(v,float) else f'{k}={v}' for k,v in stats.items())}")
```

(Per-dispatch granularity is enough — each patch group renders few regions; if attribution is ambiguous, upgrade to per-region reset/log inside the loop.)

### 0-B. textline_merge breakdown — `MIT/manga_translator/textline_merge/__init__.py` + `MIT/manga_translator/utils/generic.py`

- Wrap **step-1** (the `itertools.combinations` loop building the merge graph in `merge_bboxes_text_region`) and **`split_text_region`** calls with `perf_counter`; log `[timing-merge] step1_ms=… split_ms=… n_boxes=… pairs=…`.
- Add a call counter on `quadrilateral_can_merge_region` (module-level int in `generic.py`, reset/read from merge dispatch) → `pairs=` in the log line.

### 0-C. Measure (real E2E, dense page)

```powershell
# 1) sanity: commit memory >= 15GB free (Qwen dies silently otherwise — team memory)
Get-CimInstance Win32_OperatingSystem | % { [math]::Round($_.FreeVirtualMemory/1MB,1) }

# 2) syntax check
cd D:\Github\MangaDock\MIT
.\.venv\Scripts\python.exe -m py_compile manga_translator\rendering\text_render.py manga_translator\rendering\__init__.py manga_translator\textline_merge\__init__.py manga_translator\utils\generic.py

# 3) restart MIT — MUST kill by PORT OWNER (process name is python, not python3.11 — see team memory)
foreach ($port in 5003,5004) { $c=Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue; if($c){ Stop-Process -Id ($c|Select-Object -First 1).OwningProcess -Force } }
Start-Process -FilePath "D:\Github\MangaDock\MIT\.venv\Scripts\python.exe" -ArgumentList "-u","server/main.py","--host","127.0.0.1","--port","5003","--use-gpu","--start-instance" -WorkingDirectory "D:\Github\MangaDock\MIT" -RedirectStandardOutput "D:\Github\MangaDock\MIT\logs\p0-out.log" -RedirectStandardError "D:\Github\MangaDock\MIT\logs\p0-err.log" -WindowStyle Hidden
# poll http://localhost:5003/ready until {"ready":true} (NOT /health) — model load takes ~1-2 min

# 4) cache reset — ORDER MATTERS (team memory: L1 re-flushes L3 if backend alive):
#    kill backend (port 4001) -> npm run cache:reset (in Backend/) -> relaunch backend:
#    node --enable-source-maps dist\src\main   (from Backend/; it runs dist, not watch)
```

E2E: open `https://hayateotsu.space/` (NEVER localhost — cloudflared tunnel is the test surface, team rule) via Playwright → search "Otome" → card "Otome Game Sekai wa Mob ni Kibishii Sekai desu" → อ่านตอนที่ 1 → navigate to **page 2** (dense story page; page counter shows `2 / 37`) → เมนูแปล → "แปลหน้านี้" → poll MIT log for `[timing] stage=rendering`. Full click-recipe: `.claude/skills/frontend-testing/SKILL.md` (elements move — use `browser_evaluate` with Thai-text button matching, click visible `offsetParent!==null` elements).

Collect from `MIT/logs/p0-err.log` (strip `\0` bytes: `tr -d '\000'`): all `[timing]`, `[timing-render]` (incl. new `layout_fit_breakdown`), `[timing-merge]` lines.

**Exit criteria:** a table where layout_fit's 12-14s ≈ sum of sub-steps (nothing "unattributed" bigger than ~20%), and merge's ~10s split into step1 vs split_text_region. **Commit #2** (instrumentation).

### 0-D. ACTUAL RESULT (2026-07-03, real E2E on Otome ch.1 p.2, 6× re-measured through progressively deeper instrumentation)

**The exit criteria above was NOT met — and that's the finding.** Five full instrumentation+measure passes systematically ruled out every algorithmic hypothesis, including the ones OPTIMIZATION.md's original scan proposed:

| Layer instrumented | Result | Verdict |
|---|---|---|
| `calc_horizontal` internals (seg/words/autogrow/syll/hyph/pack/post, `get_string_width` call counter) | 68 calls, **~23ms total** (vs 23.7s `layout_fit` stage) | ❌ not it |
| `calc_vertical` (separate function, untouched by original scan) | **0 calls** — this page has no vertical regions | ❌ ruled out entirely |
| `_bubble_fit_layout` internals (preseg / `bubble_fit_bounds` / `fit_font_size` / `squeeze_width` / final measure, each wrapped separately) | 3 calls, **~22ms total** | ❌ not it |
| `_bubble_interior_box` → `safe_area_box` → `cv2.distanceTransform` + `_ray_len` (pure-Python per-pixel walk — the strongest suspect, mask was a real 3.9M-px page-sized array) | 3 calls, dt≈0ms, ray≈0ms (1445 total ray steps) | ❌ not it, even at real page-mask size |
| `anti_overlap` block (`_region_territory`/`clamp_box_to_neighbors`, `render_overlap.py`) | Pure O(n≤6) float arithmetic, no numpy/cv2 | ❌ ruled out by code inspection (not worth instrumenting — provably microseconds) |
| Per-region wall-clock (`_t_region` at loop top → exit log at each of the 3 `continue`s + fallthrough) | **bubble_fit_sole regions: 6-9s EACH**, legacy regions: ~330ms, clean_layout: 320ms-4s (inconsistent) | ✅ confirms the time is real and per-region, but... |

**Every sub-component of the `bubble_fit_sole` branch is individually fast, yet the branch's own wall-clock is 6-9 seconds per region.** This is not an algorithmic hot path — it's something *extrinsic* to the measured code: GIL contention with a concurrent thread (`patch_renderer.py`'s only concurrency is one `run_in_executor` for PNG encoding — plausible if a previous group's encode overlaps this group's layout_fit), OS-level scheduling, or something no `perf_counter` probe placed *inside* this function can see. Logging overhead was checked and ruled out (each `perf_counter()` read happens before the corresponding `logger.info()` call, so log I/O time isn't folded into any reported number).

**Consequence for Phase 2b: do not implement any of L1/L2/L3 from OPTIMIZATION.md** — the mechanism they targeted (`calc_horizontal`'s internal cost) is now proven negligible. **Before touching layout_fit code, the next step must be a sampling profiler (`py-spy dump`/`py-spy record` attached to the live MIT worker PID during a slow translate, or `python -X importtime`/`cProfile` around just `resize_regions_to_font_size`), not another perf_counter probe** — Python-level instrumentation has exhausted what it can distinguish here; whatever is consuming the wall-clock is invisible to code-level timers, which means it's happening *between* Python bytecodes (GIL wait) or *outside* this process's Python-level control entirely.

**Textline_merge (0-B) result:** measured cleanly, no anomaly — `[timing-merge] step1_ms=~10-4500 split_ms=~0 n_boxes=9-14 pairs=~40-90` across runs, consistent with the O(n²) step-1 hypothesis. **M1/M2 (Phase 2a) are still valid to implement** — that finding was not disturbed by the layout_fit mystery.

**Commit status — deliberately NOT committed (do not force it):** unlike commit #1 (the two standing timers, cleanly separable from HEAD), the deeper Phase 0 instrumentation (calc_horizontal breakdown, `_bubble_fit_layout`/`safe_area_box` internal timers, per-region diagnostic+exit logs, textline_merge step1/split breakdown) is **textually interleaved with the pre-existing uncommitted #175/#183 bubble-fit-layout rework** — `_bubble_fit_layout`, `safe_area_box`'s call sites, etc. don't exist in HEAD at all, only in the dirty working tree. Committing would mean bundling someone else's unfinished, unreviewed feature work into this branch's history without authorization. It's left as uncommitted working-tree state; call this out explicitly to the user before Phase 3's final commit pass — either get sign-off to commit #175/#183 together with the instrumentation, or hand-extract the instrumentation lines once #175/#183 lands on its own branch/commit upstream.

---

## Phase 1 — Characterization tests (lock seams BEFORE optimizing)

Existing assets (reuse the patterns):
- `test/test_render_golden.py` — golden `.npz` pattern: first run generates + `pytest.skip`, later runs `np.array_equal`. Fixed `TextBlock`s + `text_render.set_font('fonts/Arial-Unicode-Regular.ttf')`.
- `test/test_calc_horizontal_characterization.py` — GOLDEN table of `(font_size,text,mw,mh,lang,hyphenate)→lines`. **Any Phase 2b change must keep this green.**
- Runner: `pytest test/` (pytest.ini has `pythonpath=.`, pyproject has `testpaths=["test"]`). Use `.venv`: `.\.venv\Scripts\python.exe -m pytest test/<file> -x -q`.

### 1-A. New `test/test_resize_regions_characterization.py`

Seam (confirmed): `rendering/__init__.py:resize_regions_to_font_size` — **returns** `dst_points_list` (list of int64 `(-1,4,2)` ndarrays, :537) and **mutates** `region.font_size` (:335/:363/:392/:535) + possibly `region.translation` (#436 dedup, :295).

Build ~6 fixed `TextBlock`s covering: legacy path (bubble_fit=False), bubble_fit=True path, clean_layout=True narration, a hard-to-fit case (long Thai translation in a small box — the 12-14s shape), a vertical region, an SFX-flagged region. Construction pattern (from `test_render_golden.py:27-48`):

```python
r = TextBlock([[[x1,y1],[x2,y1],[x1,y2],[x2,y2]]], texts=['src'],
              translation='ข้อความยาวๆ …', direction='h', target_lang='THA', font_size=40)
r.set_font_colors([255,255,255],[0,0,0])
```

Call `resize_regions_to_font_size(img, regions, font_size_fixed=None, font_size_offset=0, font_size_minimum=-1, bubble_fit=<case>, ..., clean_layout=<case>, page_shape=img.shape)` directly; snapshot to `test/golden/resize_regions_golden.npz`: each region's `dst_points`, final `font_size`, final `translation`. Assert exact equality.

**Gotcha:** goldens are pinned to `fonts/Arial-Unicode-Regular.ttf` + local freetype — same caveat as the existing characterization file (copy its docstring note).

### 1-B. New `test/test_textline_merge_characterization.py`

`merge_bboxes_text_region` is deterministic (combinations/kruskal/connected_components are order-stable) → membership snapshot is valid. Build a dense synthetic case: ~50-80 `Quadrilateral`s in several clusters + a few rotated/vertical quads + far-apart outliers (this exercises both the merge accept AND the reject paths that M1 short-circuits). Snapshot: for each output region, the sorted set of input indices it absorbed (derive by matching `region.lines` back to input quads, or refactor-free: snapshot the count + each region's line coordinates array). Store as npz/json golden.

Follow `test/test_textline_merge.py` for how to construct inputs and call `dispatch` (async — use `pytest.mark.asyncio` or `asyncio.run` like that file does).

**Exit criteria:** both new tests green **twice in a row** (run 1 generates goldens + skips; run 2 passes; run 3 passes again). **Commit #3.**

---

## Phase 2 — Optimize (each lever = own commit, all characterization green before AND after)

### 2a. textline_merge M1+M2 — `MIT/manga_translator/utils/generic.py:quadrilateral_can_merge_region` (:656-673)

Current shape: builds `Polygon(a.pts)`, `Polygon(b.pts)` and runs GEOS `.distance()` FIRST, then checks scalar gates (`font_size_ratio_tol` :668, aspect :670-673).

**M2 (do first, trivial):** hoist the scalar gates (pure arithmetic on cached properties, side-effect-free, early-return-False) ABOVE the Polygon construction. Byte-identical because all gates are ANDed rejects — order doesn't change the boolean.

**M1:** before constructing any Polygon, compute the axis-aligned rect gap from `a.aabb` / `b.aabb` (already `cached_property`, generic.py:441-446):

```python
# rect gap between two AABBs (0 if overlapping)
dx = max(bx1 - ax2, ax1 - bx2, 0)
dy = max(by1 - ay2, ay1 - by2, 0)
aabb_gap = (dx*dx + dy*dy) ** 0.5
if aabb_gap > threshold:   # SAME threshold the existing GEOS-distance check uses
    return False
```

**Proof of byte-identity:** AABB ⊇ polygon ⇒ `dist(aabbA, aabbB) ≤ dist(polyA, polyB)`. So `aabb_gap > T` ⇒ `poly_dist > T` ⇒ the existing distance gate would return False anyway. Only the reject is short-circuited; accepts fall through to the EXACT original code path. **Read the actual current threshold expression in the function (something like `discard_connection_gap * char_size`) and reuse it verbatim** — do not invent a new threshold.

Verify: merge characterization green; then `pytest test/test_textline_merge.py test/test_textline_merge_characterization.py`. **Commit #4.**

### 2b. layout_fit fix — SUPERSEDED BY 0-D. Do not implement L1/L2/L3 below; they targeted a mechanism now proven negligible.

> ⚠️ **MODEL GATE: this phase requires Opus 4.8 (effort high/auto)** — see *Model assignment* at the top.

**Read §0-D first.** Five instrumentation passes proved `calc_horizontal`, `calc_vertical`, `_bubble_fit_layout`, `_bubble_interior_box`/`safe_area_box`, and the `anti_overlap` math are ALL fast (~tens of ms combined), yet `bubble_fit_sole` regions cost 6-9 real seconds each. The original decision table below (kept for reference — **do not act on it**) assumed the cost was inside one of these functions; it isn't.

<details><summary>Original (superseded) decision table</summary>

| If Phase 0 shows… | Then implement… | Parity risk |
|---|---|---|
| `gsw_calls` (get_string_width volume) dominates | Per-region width memo | none |
| `autogrow_iters` explodes | Diagnose convergence — PARITY ITEM | yes — ask first |
| `seg_s`/`syll_s` dominates | L1: memoize word-break functions | none |
| `pack_s` dominates | Profile `GreedyLineBreaker.pack` | tbd |

*(All four premises falsified by 0-D — calc_horizontal's total across all sub-steps was ~23ms, not the dominant cost.)*
</details>

**What to do instead, in order:**
1. **Attach a sampling profiler to the live MIT worker** during a slow translate of Otome ch.1 p.2 — `py-spy dump --pid <worker-pid>` (repeated snapshots during the 6-9s window) or `py-spy record -o profile.svg --pid <worker-pid> --duration 15` timed to overlap a `bubble_fit_sole` region. `py-spy` samples real stack frames including C-extension/GIL-wait time, which `time.perf_counter()` inside Python code cannot see.
2. **If py-spy shows the worker's Python stack genuinely idle/blocked** (not executing user code) during the gap — check for concurrent work on the SAME process: another patch group's `run_in_executor(None, _encode_png)` (patch_renderer.py:305) overlapping this group's synchronous layout_fit, or the `ModelReaper` background task, or something in `server/myqueue.py`'s queue/executor bookkeeping.
3. **If py-spy shows it stuck IN a specific C call** (cv2/freetype/shapely) — that call needs its OWN wrapper timer next, using the same accumulator pattern already established in this codebase (text_render.py/safe_area.py both have working examples to copy).
4. Only once the actual mechanism is confirmed by (1)-(3) should a code fix be written — and it still needs a parity check per the hard gates in §0.1.

**Do NOT implement** (already adversarially rejected — OPTIMIZATION.md §1 "Rejected"): binary-search squeeze_width; replacing `_longest_word_w`'s calc_horizontal with get_string_width; blanket lru on calc_horizontal; territory-pass hoisting. These remain rejected regardless of the 0-D finding (still wrong on their own merits).

Verify after ANY lever: `pytest test/test_calc_horizontal_characterization.py test/test_resize_regions_characterization.py test/test_render_golden.py test/test_font_fit.py test/test_render_overlap.py` all green. **Commit #5.**

### 2c. T1 token split — `MIT/manga_translator/translators/custom_openai.py` (:241-242)

Where it currently logs only total tokens, also log `response.usage.prompt_tokens` / `completion_tokens` (guard with `getattr(..., None)` — the 9arm/ollama gateway may not populate them; log `n/a` if absent). Zero-risk. **Commit #6.**

---

## Phase 3 — Verify, measure, document, hand back

1. **Full test suite:** `.\.venv\Scripts\python.exe -m pytest test/ -q` — everything green (NOTE: some `test/test_translation_manual.py` tests need CLI opts/network; if they error without opts, scope to the rendering/merge/layout files + whatever ran green before your change — establish the baseline BEFORE Phase 2 so you can tell pre-existing failures from regressions).
2. **Restart stack with correct cache ordering** (Phase 0-C commands: MIT restart → kill backend → cache:reset → relaunch backend).
3. **E2E before/after table:** translate the SAME pages (Otome ch.1 p.2 dense + p.4) via tunnel; collect `[timing] stage=*`, `[timing-render] phase=*`, `[timing-merge]` lines; build a before→after table (before numbers are in `docs/reports/2026-07-02-mit-speedup-e2e-measurements.md`).
4. **Visual parity:** screenshot original + translated for both pages; **send the images to the user and WAIT for confirmation** (team rule: user-in-the-loop, never self-certify "fixed"). Also verify patch overlays aren't stale-cached (bust with `?r=Date.now()` — see frontend-testing skill).
5. **Documentation (Definition of Done — ALL required):**
   - `docs/reports/system-impact-report.md` — append full-field change record (what/where, why, before→after per-stage ms, risk, validation).
   - New ADR in `docs/adr/NNN-*.md` (perf change of this size requires one; follow existing ADR format; number = next free).
   - Update `MIT/OPTIMIZATION.md`: mark backlog #1/#2/#5 done, replace layout_fit "mechanism unattributed" with the measured answer, record M1/M2 as implemented + measured gain.
   - Append to `DONE.md` (history log) — team rule.
   - Update this file's Status line at top.
6. **Notify:** `pwsh -NoProfile -File scripts/notify.ps1 -Message "MIT optimize: <headline numbers>"` (built-in PushNotification does NOT surface a toast on this machine).
7. **Do NOT merge** — leave the branch for human review (team policy: /scrutinize review before any merge).

## Success criteria

- [ ] Phase 0: layout_fit 12-14s attributed (sub-step sums ≈ total ±20%); merge 10.2s attributed step1-vs-split
- [ ] Phase 1: both characterization tests green ×2 consecutive runs
- [ ] Phase 2a: dense-page `[timing-merge]` step1 measurably lower; merge characterization byte-identical
- [ ] Phase 2b: `[timing-render] phase=layout_fit` on the hard page measurably lower; ALL characterization + render_golden green
- [ ] Phase 3: E2E screenshots confirmed by user; impact report + ADR + OPTIMIZATION.md + DONE.md updated; notify sent
- [ ] Every optimization is its own commit; branch not merged

## Known environment gotchas (from team memory — will bite you)

- MIT MUST run on `MIT/.venv` python (cu121 CUDA torch). Poll `/ready` not `/health`; 503 `starting` = still loading models; 503 `workers_unreachable` = worker died (often OSError 1455 when commit memory < 15GB — close apps first).
- MIT worker process name is plain `python` on ports 5003 (front) + 5004 (worker) — kill by PORT OWNER or you orphan a worker serving stale code.
- PAL/config-style caching: MIT loads code at process start — every code edit needs a worker restart before it's live.
- Backend runs `dist\src\main` (compiled) — backend code changes need `npm run build`; but this plan doesn't touch Backend code.
- Reader E2E of a CODE change (renderConfigHash unchanged) MUST cache:reset with backend DOWN, else live L1 re-flushes L3 and you'll see 3ms cached responses instead of a real 30-40s translate.
- Log files contain `\0` bytes — `tr -d '\000'` before grepping.
- Browser patch overlays cache for 4h (`max-age=14400`) — bust with query param when comparing renders.
