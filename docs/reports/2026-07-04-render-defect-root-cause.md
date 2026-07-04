# Render-defect root cause — why 2 master plans didn't fix what users see

> **สรุปไทย (executive summary):** defect ที่เห็นใน Reader (text หาย / text ทับ text จิ๋ว / text เล็กมาก /
> narration ซ้าย-ขวาขนาดไม่เท่าทั้งที่ต้นฉบับเท่า) **ไม่ใช่เพราะ fix ไม่เคยถูกสร้าง — แต่เพราะ fix ตัวจริง
> (#175/#183 + discriminator + dedup + page_shape) นั่งอยู่ใน WIP 306 ไฟล์ที่ไม่เคย commit/deploy** ส่วน prod
> รัน perf committed tip ที่**ไม่มี fix พวกนี้เลย** และ master plan ทั้งสองไปลงแรงกับ infra/flags บน main —
> ซึ่ง prod ก็ไม่ได้รันเช่นกัน. โค้ดวิ่งกันคนละสาย 3 สาย (main / perf tip / perf WIP) โดยไม่มีอะไรบังคับให้
> converge → "แก้แล้ว" กับ "ผู้ใช้เห็น" เป็นคนละจักรวาล. แผนแก้จริงคือ **landing plan** (เอา fix ที่มีอยู่ลง
> prod อย่างปลอดภัย + ปิด gap ที่เหลือ + สร้าง metric gate กัน defect กลับมา) ไม่ใช่ master plan ใบที่ 3.

**Date:** 2026-07-04 · **Trigger:** user found a single Reader page (Otome Game Sekai p10) exhibiting the full
defect set, plus unequal narration sizing on One-Punch. · **Method:** traced the RUNNING production code
(worktree = perf committed tip `efdf9c3c` + MP2 flag port), diffed it against the perf checkout's uncommitted
WIP, reproduced on the live worker via `/translate/with-form/patches`, measured pixels.

---

## 1. The critical discovery: prod never ran the fixes

Diffing the **running code** (perf committed tip) against the perf checkout's **306-file uncommitted WIP**:

| Fix (exists in WIP only — prod does NOT have it) | Defect it fixes |
|---|---|
| `#436 dedup` (`box_containment` + substring blank) | **text-over-text tiny duplicate** (SFX det re-detects a word inside an existing region → both render) |
| `fills_bubble_width` 0.72 discriminator | **narration ballooning to fill its box** (docstring literally cites One-Punch "THIS BRAT…") |
| `clean_layout_target_fs` (orig-fs tracking) | display captions collapsing to narration size |
| `page_shape` threading + `clean_layout_font_size` (processing_scale) | **narration ~3× too small in the patch path** (crop-derived scale collapses — the #175 patch-path fix) |
| `_bubble_fit_layout` (#175/#183 bounded fit + width-squeeze) | dialogue under/over-sizing (prod runs the old `_bubble_fit_font_size`) |
| `#436 shared-occupancy branch` | regions sharing one balloon rendering tiny via clean_layout |

The main branch separately got readable-floor (#522), the polygon metric (#529), KP (#530), MP2 (#532/#533) —
**prod runs neither main nor the WIP.** Three code streams diverged (main ↔ perf tip ↔ perf WIP) with no
process forcing convergence; fixes landed in streams that never reached the worker.

## 2. Root causes per defect class (in the code prod actually runs)

### 2.1 Unequal / oversized narration (user's One-Punch annotation)
`resize_regions_to_font_size` (running version) routes each region:

```
bubble_box tagged AND horizontal AND occupancy==1 AND translation → bubble_fit (font GROWS to fill the box)
else clean_layout (FIXED font_size_max=20, no scaling)
else legacy length-ratio
```

There is **no discriminator** — whether a narration caption "balloons up" or stays 20px flat is decided by
**whether BubbleSeg happened to tag its box as a balloon**. Two same-size source captions → one tagged (grows
to fill) + one untagged (flat 20px) → **unequal render**. Balloon tagging and translation vary run-to-run →
the asymmetry flips between runs (measured: one probe run 26px vs 22px; the user's render visibly worse).
**The WIP's `fills_bubble_width` was written to fix exactly this and never shipped.**

### 2.2 Very small text
Two mechanisms in the running code:
- `_clean_layout_dst` uses a **fixed 20px** and computes `clean_wrap_width` from **`img_shape` = the group
  CROP** in the patch path (floor = 11% of the *crop* width, not the page) → narrow-crop narration wraps into
  a sliver at a small font. The WIP threads `page_shape` + scales the font (`clean_layout_font_size`) — unshipped.
- Dialogue that falls out of bubble_fit (vertical-source region, shared balloon `occupancy>1`, or untagged)
  lands in clean_layout at 20px inside a large bubble → tiny. The WIP's shared-occupancy branch fixes the
  `occupancy>1` case — unshipped.

### 2.3 Text-over-text (tiny duplicate on top)
The SFX detector re-detects a stylized word that the line detector already captured (e.g. a word inside a
sentence region) → two regions → both render, the duplicate as a small block on top of the sentence.
**The WIP's #436 dedup (substring + ≥60% containment → blank the duplicate) fixes this — unshipped.**

### 2.4 Empty white bubbles (text loss)
Not from empty translations: `filter_translated_regions` DROPS blank-translation regions **before** the patch
pipeline, so their original text is never erased (they'd show as untranslated JP, not white). The white-empty
bubbles must come from **erase-without-render**: the group's *refined* inpaint mask covers text strokes of a
region that is not rendered in that patch — a region dropped for another reason (numeric / identical-to-source /
OCR prob-floor / language filter) or belonging to another group, whose pixels sit inside this group's crop.
**Status: mechanism identified, needs one instrumented capture to confirm** (log dropped regions + overlay the
refined mask vs balloon boxes on the Otome page). This one is NOT fixed in the WIP either — a genuine gap.

## 3. Why two master plans didn't fix it (honest answer)

1. **The fixes exist but never shipped.** The perf WIP contains most of the render-quality fixes, uncommitted
   for weeks; prod ran the old renderer the whole time. MP2 invested in main (flags/eval/infra) — also not
   what prod runs.
2. **No per-defect metric gate.** We measure translation quality (LLM-judge) and polygon spill — there is no
   metric for empty-bubble / size-vs-original / overlap-count / sibling-size-Δ, so nothing ever *failed* when
   these defects appeared, and spot-check verification let them through (full-chapter rule existed but was not
   enforced as a gate).
3. **Three-branch divergence with no convergence process** — the deployment/branch process is as much the root
   cause as any single bug.

## 4. The real fix plan — a LANDING plan, not master plan 3 (v2, refined by 3-agent brainstorm)

> v2 changes after a /clink-brainstorm cross-check (antigravity/system + codex/code + 9arm/logic):
> (1) the empty-bubble guard + telemetry MOVED to Phase 0 — the only defect with no existing fix, the worst
> user-visible one, and fully independent of the WIP (9arm); (2) slices re-grouped by ACTUAL code dependencies —
> the original 4 slices don't compile independently (codex traced the real diff); (3) attribution must use
> deterministic dumps, not live full-chapter A/B (non-determinism swamps per-slice deltas); (4) deploys must
> bust the patch cache via renderConfigHash (env knob), else users keep seeing old renders (antigravity);
> (5) the WIP fixes themselves were never benchmarked — each slice benchmark VALIDATES the fix, not just
> "doesn't regress" (9arm).

**Phase 0 — independently landable, zero WIP dependency (kills the worst defect even if WIP landing stalls):**
- **0a. Region-drop telemetry:** log every dropped region + reason (blank/numeric/identical/prob-floor/lang)
  per request — future text-loss becomes diagnosable from logs.
- **0b. Empty-bubble guard (TDD):** `restrict_mask_to_render_regions()` in `patch_geometry.py` (near
  `union_refined_with_fallback`), wired in `patch_renderer.py` after refinement, before tighten/inpaint:
  constrain the erase mask to `create_text_only_mask(local_regions)` + dilation margin, and subtract
  dropped-region strokes. Narrows only the ERASE mask — the crop/context stays intact so LaMa quality is
  unaffected. Mask-subtraction over re-render-original (font mismatch would look worse; cache preserved).
- **0c. Metric harness + payload enrichment:** extend the `/patches` regions payload with per-region
  `id, xyxy, bubble_box, font_src_px, font_final_px, dst_box, branch, occupancy, rendered, drop_reason` —
  then the harness computes: empty-bubble count (source ink present, rendered ink absent), size-ratio vs
  original lettering (catches tiny AND bloat), rendered-block overlap count, sibling-narration size-Δ.
  Without the payload the metrics are detective-only; with it they are diagnostic.
- **0d. Deterministic attribution rig:** capture render dumps once per benchmark page; per-slice A/B replays
  the SAME dump offline (isolates the render change from OCR/LLM sampling noise). Live full-chapter runs are
  for detection/coverage, never attribution.

**Phase 1 — land the WIP in DEPENDENCY-CORRECT slices (codex's A→E; 1 slice = 1 commit on a clean landing
branch `perf/mit-landing-fixes` off the perf tip — never commit from the dirty checkout wholesale):**
- **A. Pure helpers + unit tests** (`render_overlap.py`: `box_containment`, `fills_bubble_width`,
  `clean_layout_font_size`, `clean_layout_target_fs`, `region_territory_box`, `bubble_fit_bounds`,
  `squeeze_width`) — additive, unused-until-wired, zero behavior change.
- **B. #436 dedup** (kills text-over-text). Note: blanking happens after the group mask is built → the
  duplicate's source ink is erased with nothing drawn (usually benign — the dup sits inside the kept region's
  box); mark duplicates pre-mask (`render_suppressed_reason='duplicate'`) so metrics don't count it as loss.
- **C. Discriminator gate** (`fills_bubble_width` on the bubble_fit branch) **keeping the committed
  `_bubble_fit_font_size`** — do NOT pull in `_bubble_fit_layout` yet (kills narration ballooning/asymmetry).
- **D. `page_shape` threading** (`stages.py` + `dispatch` + `_clean_layout_dst`) + scaled clean-layout font
  (kills patch-path tiny narration). Spans 3 files — stages.py is part of this slice, not an afterthought.
- **E. `_bubble_fit_layout` #175/#183 + shared-occupancy branch** — biggest, last; strip or gate the
  `_BUBBLE_FIT_STATS`-style mutable globals (racy under concurrent patch rendering).
Each slice: dump-replay A/B (attribution) + live full-chapter One-Punch + 2nd manga (coverage) + metric harness
+ 12-item eyeball → **user confirm → next slice.** Each benchmark must show the slice's defect class actually
improves (the WIP was never validated — "lands cleanly" ≠ "works").
⚠️ The WIP is the user's working tree — port functions cleanly (copy from WIP → landing branch), never
`git add -p` the entangled hunks; instrumentation + #175/#183 entanglement per OPTIMIZATION-PLAN §0-D.

**Phase 2 — deploy mechanics (the part that silently fails if skipped):**
- **Cache-bust:** the patch cache is keyed on `renderConfigHash` of MIT_* env — code-only changes do NOT bust
  it. Bump a dedicated knob (e.g. `MIT_RENDER_VERSION=landing-v1`) in `Backend/.env` per landing deploy.
- Audit cwd/`__file__`-relative paths (fonts/, models/, panel/lib) for worktree-launched workers; sequential
  cutover (never 2 GPU workers); poll `/ready`.

**Phase 3 — converge branches (the meta-fix):**
- Merge order: landing branch → perf (prod stream) → then reconcile perf↔main to ONE stream. Adopt the metric
  harness as the standing gate: a render change that worsens any defect count does not ship.

**Fallback if WIP landing stalls:** Phase 0 alone kills empty-bubble (the worst defect) + makes everything
diagnosable; slice B (dedup) is nearly independent and kills text-over-text.

## 5. Evidence index
- Running-code routing: worktree `MIT/manga_translator/rendering/__init__.py` (resize routing, `_clean_layout_dst`).
- WIP-only fixes: diff main-checkout ↔ worktree (`fills_bubble_width`, `box_containment`/dedup,
  `clean_layout_target_fs`, `page_shape`, `_bubble_fit_layout`).
- Live reproduction: `/translate/with-form/patches` on One-Punch (7 regions, BubbleSeg "5 balloons, 4/7 tagged");
  narration glyph heights measured 26px vs 22px on one run, visibly unequal on the user's run → run-to-run
  branch instability.
- User captures: Otome Game Sekai p10 (empty bubbles + tiny + overlap), One-Punch narration annotation.
