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

## 4. The real fix plan — a LANDING plan, not master plan 3

**Phase 0 — nets (prerequisite, per `feedback_techdebt_all_scenarios`):**
- Characterization tests for the routing table: {tagged, untagged} × {narration, dialogue} × {occupancy 1, >1}
  × {horizontal, vertical} → which branch + font. Locks current behavior before touching it.
- **Render-defect metric harness** (the thing that's been missing): given (original, rendered, regions payload) →
  counts: empty-bubble (original had text, render blank), size-ratio vs original lettering (catch tiny AND
  bloat), overlap-count (two rendered blocks intersecting), sibling-narration size-Δ. Run on full chapters.
  This becomes the regression gate every render change must pass.

**Phase 1 — land the WIP in slices (1 seam = 1 commit, each full-chapter benchmarked):**
1. `#436 dedup` (kills text-over-text) — smallest, independent.
2. `fills_bubble_width` discriminator + `clean_layout_target_fs` (kills narration ballooning + asymmetry class).
3. `page_shape` threading + scaled clean-layout font (kills patch-path tiny narration).
4. `_bubble_fit_layout` #175/#183 (bounded fit + squeeze) — biggest; last.
Each slice: characterization net stays green → full-chapter /patches render (One-Punch + 2nd manga) → metric
harness + 12-item eyeball → **user confirm → only then next slice.**
⚠️ The WIP is the user's working tree — slicing/committing is done WITH the user (the OPTIMIZATION-PLAN itself
says the entangled #175/#183 + instrumentation "needs a decision, not a silent merge").

**Phase 2 — close the gaps the WIP doesn't cover:**
- Empty-bubble guard: never erase strokes we don't re-render — subtract dropped-region pixels from the refined
  mask (or re-render the original text there). Requires the Phase-0 capture to confirm the exact bleed path.
- Region-drop telemetry: log every dropped region + reason on every request (1 line each) so future text-loss
  is diagnosable from logs instead of archaeology.

**Phase 3 — deploy + converge branches:**
- Land the slices on the perf branch → cutover the worker → full-chapter live A/B vs pre-landing baseline.
- Reconcile perf↔main so there is ONE stream; adopt the metric harness as the standing gate (a render change
  that worsens any defect count does not ship).

## 5. Evidence index
- Running-code routing: worktree `MIT/manga_translator/rendering/__init__.py` (resize routing, `_clean_layout_dst`).
- WIP-only fixes: diff main-checkout ↔ worktree (`fills_bubble_width`, `box_containment`/dedup,
  `clean_layout_target_fs`, `page_shape`, `_bubble_fit_layout`).
- Live reproduction: `/translate/with-form/patches` on One-Punch (7 regions, BubbleSeg "5 balloons, 4/7 tagged");
  narration glyph heights measured 26px vs 22px on one run, visibly unequal on the user's run → run-to-run
  branch instability.
- User captures: Otome Game Sekai p10 (empty bubbles + tiny + overlap), One-Punch narration annotation.
