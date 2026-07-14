---
name: feedback-techdebt-all-scenarios
tags: ["feedback"]
description: When refactoring tech debt in shared/core modules, enumerate and characterization-test EVERY scenario you can imagine BEFORE touching code — a refactor error there breaks the whole system.
metadata:
  type: feedback
---

When doing a tech-debt refactor — especially in core/shared modules (the MIT render/translate pipeline, anything many callers depend on) — first build a **comprehensive characterization net** covering every scenario you can think of, THEN refactor and prove byte-identical at each step.

**Why:** these modules are shared; a single missed branch in a "behaviour-preserving" extraction breaks the whole pipeline, often silently. The user called this out directly (2026-06-09): "คิด scenario ทั้งหมดที่นึกออก เพราะถ้ามี error มันจะส่งผลกับทั้งระบบแน่นอน."

**How to apply:**
- Before extracting/moving anything, enumerate the full scenario matrix and capture golden outputs: all language paths (EN / Thai-pythainlp+zwsp / CJK), empty / single-token / over-wide inputs, the rarely-hit branches (e.g. `calc_horizontal`'s height-overflow `max_width` expansion, `max_width < 2*font_size` clamp), hyphenate on/off, tiny vs huge widths, trailing/leading/multiple spaces, punctuation.
- For non-ASCII golden capture on Windows, write to a UTF-8 file and Read it — printing Thai/CJK to the cp1252 console raises `UnicodeEncodeError` (the calc_horizontal call itself is fine).
- Assert the golden, refactor under its protection, re-run the FULL net after every step (a partial net gives false confidence).
- Treat any "behaviour-preserving" claim as unproven until the comprehensive net is green.

Pattern in use: `MIT/test/test_calc_horizontal_characterization.py` (#186). Related: [[project-render-knob-gating]].
