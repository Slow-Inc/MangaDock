---
name: project-mit-translate-nondeterministic
tags: ["project"]
description: MIT translate is non-deterministic (OCR-VLM/LLM sampling) → running it twice yields different text AND patch geometry, so in-app render ON/OFF A/B is confounded; use the offline worker-direct dump to measure pixels, use in-app E2E only to verify wiring
metadata:
  type: project
---

Running the MIT translate pipeline **twice on the same page yields different results** — not just different translated text, but different **patch geometry** (bbox sizes/positions). Root cause: the OCR-VLM and the translator LLM both **sample** (non-greedy), so detection→OCR→layout drifts run to run.

**Consequence — in-app render A/B is confounded.** You cannot toggle a render knob (e.g. `MIT_BUBBLE_AREA_FIT` ON vs OFF), translate the page each way in the app, and compare the two images to judge the render change — the *inputs* (text, geometry) differ between the two runs, so any pixel difference mixes the knob effect with sampling noise.

**How to actually measure a render change:**
- Use the **offline worker-direct dump/replay harness** (`MIT/tools/ab_parity.py` / `bench_dump.py` + `bench_replay_kp.py`) — it replays a *fixed* dumped payload through the render code, so geometry/text are held constant and the pixel band difference isolates the render change. This is the deterministic path.
- Use **in-app E2E** only to **verify wiring** (knobs reach the worker, the request/patch flow works end-to-end) — not to compare render quality quantitatively.

Related: [[concept-mit-render-pipeline]] · [[project-render-knob-gating]] · [[feedback-verify-before-claiming]] · [[feedback-benchmark-patch-not-image-endpoint]]
