---
name: feedback-decomposition-method
description: Why the MIT god-object decomposition is done byte-identical / characterization-first / one-seam-per-commit, with the measured benefit — keep doing it this way
metadata:
  type: feedback
---

The MIT god-object decomposition (#187/#188) is deliberately done as **byte-identical, characterization-first, one seam per commit** — not a big-bang rewrite. When asked "why this way / is it worth it", this is the answer, and the method must continue for the remaining seams.

**Why this method:**
- The god object (`manga_translator.py`) is the **hottest path in the product** — every translated page flows through it. A silent behaviour change there breaks translation system-wide and is hard to catch. So each seam ships a **characterization net first** (locks current behaviour), then a **verbatim** extraction proven against that net.
- **One commit per seam** → independently reviewable, rollback = a single revert, blast radius = one seam.
- **Landmines preserved verbatim, fixed only later behind opt-in flags** (L6 0.5/0.3 + ≥6/>10, L15 `**ctx` splat, L2 `exit(-1)`, the cp1252 encode bug, …). Separates "move code" (safe) from "change behaviour" (flagged) so neither hides in the other.
- **Don't force-unify load-bearing duplication** — when "N copies" are structurally divergent on purpose (the S18 finding: pad+enumerate vs filter+text_idx vs region_mapping), relocate + pin the divergence as explicit params; merging would change output and adding callbacks to prop up a false merge violates the North Star.
- **E2E per output-touching seam** through the production tunnel (per [[feedback-test-every-round]]), not just unit — proves byte-identity end-to-end.

**Measured benefit (pre-decomposition `73251c5` → 2026-06-10):** god object **3040 → 2235 lines (−26.5%)**; **21** dependency-light unit-tested modules carved out (0 before); MIT test cases **180 → 319 (+77%)**; **4 consecutive byte-identical E2E runs** (2 patches, 649×1492+451×1489) = zero behaviour change. The durable win is **testability**: leaf logic (e.g. a 12-arg `dispatch_detection`) that previously needed a full instance + the 22s ML stack now unit-tests in <1s by stubbing.

Pairs with [[feedback-techdebt-all-scenarios]], [[feedback-core-boundary]], [[feedback-impact-report]], [[project-mit-refactor-resume]]. Full record: `docs/reports/system-impact-report.md` (2026-06-10 §"Tech-debt outcome").
