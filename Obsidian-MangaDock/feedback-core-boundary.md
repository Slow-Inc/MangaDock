---
name: feedback-core-boundary
tags: ["feedback"]
description: New features attach at a stage/module seam with a stable interface + tests — never grow the core monolith (MangaTranslator orchestrator / shared modules) or copy per-model/per-translator boilerplate. The antidote to compounding tech debt.
metadata:
  type: feedback
---

The user's explicit goal (2026-06-09): **don't become like LINE** — features bolted onto the core until tech debt multiplies ("เอา Feature มาพ่วงกับ Core หลักเรื่อย ๆ จน Tech Debt ทวีคูณ").

**Rule:** when adding a feature, attach it at a defined **seam** — a stage orchestrator, a strategy interface (e.g. the #186 line-break seam, the `sfx_detector`/`bubble_detector` wrappers), or a base abstraction — and ship it **with tests**. Do **not** add another method/branch to the ~3,200-line `MangaTranslator` god object (#187) or copy per-detector/per-translator/per-inpainter boilerplate (#188).

**If no clean seam exists for the feature, extracting the seam first is part of the feature's cost, not optional** — extract it small, under a characterization net ([[feedback-techdebt-all-scenarios]]), then add the feature on top.

**Why this drives the tech-debt priority:** the core is where features compound debt, so the highest-leverage debt work is the **core decomposition (#188 model/translator abstractions → #187 god-object stage seams)**, not peripheral cleanup (#190/#191/#193/bare-excepts). Peripheral fixes are worth doing opportunistically but do not stop the compounding. The foundation work already shipped (characterization nets, pure-module extractions, the #186 seam) is the scaffolding that makes the core decomposition safe to do incrementally.

Pairs with [[feedback-impact-report]] (report on close) and [[feedback-techdebt-all-scenarios]] (net before refactor).
