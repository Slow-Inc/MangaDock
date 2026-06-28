---
name: project-mit-translate-nondeterministic
description: MIT translate pipeline is non-deterministic run-to-run (text + patch geometry) → in-app ON/OFF render A/B is confounded; use the offline dump for pixel band measurement
metadata:
  type: project
---

The MIT translate pipeline is **non-deterministic across runs**: the same page + same render config produces
**different translated wording** (e.g. "เกษตรกรรม" vs "การเกษตร") AND **different patch geometry** (one run
clusters the left column into a single tall 680×1580 patch, the next splits the top box out as a tight 451px
patch). Source = the OCR-VLM rescue + the LLM translate/cluster steps (sampling), not a bug.

**Consequence:** an *in-app* A/B (re-translate the same page with a knob ON vs OFF, compare the rendered patch
PNGs) is **confounded** — the patches don't correspond 1:1 and the text differs, so you cannot isolate a
pixel-level effect (luminance, band, alpha) by diffing ON-run vs OFF-run patches.

**How to isolate a render-stage effect cleanly:** use the **deterministic offline dump**. `MIT_DEBUG_REGROUND_DUMP`
(see [[project-render-knob-gating]]) saves `(pristine crop, pre-correction inpaint, mask)` per group; load the npz
and apply the transform vs not on the *same* arrays. This is what #271 used to measure the reground band; an
in-app A/B for #271 was attempted and abandoned as confounded (2026-06-29 Reader E2E). For knob *wiring* (env →
Backend → MIT → render → patch → browser) the in-app E2E is still the right tool — just not for pixel deltas.

**Why:** verified live — ON r0 `?v=78615a96…`, OFF r0 `?v=ff1e0361…` (renderConfigHash busts correctly on the
knob), but r0 geometry and the Thai text both changed between runs. Related: [[project-benchmark-e2e-flow]],
[[project-cache-reset-ordering]].
