---
name: project-render-knob-gating
description: In-app translation render quality depends on the FULL set of MIT_* env knobs on the backend; MIT_BUBBLE_AREA_FIT gates the #166/#179 anti-overflow + narrow-column path
metadata:
  type: project
---

The actual app reader render is only as good as the MIT_* env knobs set on the **backend** process (buildMitConfig reads `process.env` per request; opt-in, byte-identical when unset). Setting only some knobs silently falls back to the legacy render path.

**Symptom seen 2026-06-09:** backend started with only `MIT_EN_COMIC_FONT=1 MIT_SUPERSAMPLING=4` → reader showed text **overflowing/clipped at panel edges** (legacy path). Looked like a code regression but was a config gap.

**Root cause:** the #166 binary-search fit, #170 bubble tagging, and #179 safe-area narrow-column all run **only inside the `bubble_area_fit` branch** of the renderer. Without `MIT_BUBBLE_AREA_FIT=1` the renderer uses the legacy single-axis path that overflows.

**Full parity knob set (all must be on the backend together):**
`MIT_BUBBLE_SEG=1 MIT_BUBBLE_AREA_FIT=1 MIT_EN_COMIC_FONT=1 MIT_SUPERSAMPLING=4 MIT_OCR_PROB=0.03`
Verify propagation in the worker log: a parity run prints `[BubbleSeg] N balloons, k/m regions tagged`. If BubbleSeg is absent, the knobs didn't reach the worker.

Mirrors the worker-direct harness `MIT/tools/ab_parity.py` (same render code + config). See [[project_render_parity_direction]].

**Driving the benchmark E2E via MCP_DOCKER:** the benchmark manga `/books/{id}` 404s (not in public catalog) and is **not deep-linkable** (book page reads `sessionStorage`). Reach it: navigate `hayateotsu.space/search?q=one%20punch` → click the 2nd "One Punch-Man" result → "อ่านตอนที่ Benchmark" → reader → translate dropdown → "→ EN" → "แปลหน้านี้". Note: MCP_DOCKER container screenshots do NOT sync to the host filesystem — use the worker-direct composite (`ab_parity.py` → host PNG) to view pixels instead.
