# docs/research — index & status

Deep-dive analyses (reference material, mostly archival). **Not rendered on the public docs site** (README is site-skipped). Status: `LIVING` = keep current · `SNAPSHOT` = point-in-time, don't edit · `ARCHIVED` = superseded/historical.

> **Start here:** for the reference-translator render gap → `translator-deep-dissection.md` (the canonical THEIRS-vs-OURS comparison). For the MIT decomposition map → `mit-core-decomposition-analysis.md`.

| File | Status | What it is |
|------|--------|-----------|
| `translator-deep-dissection.md` | LIVING | Canonical 12-agent THEIRS(MangaTranslator)-vs-OURS(MIT) comparison — the render-parity reference |
| `mangatranslator-study.md` | SNAPSHOT (06-07) | Executive summary "why theirs looks better" — top-4 |
| `mangatranslator-internals.md` | SNAPSHOT (06-08) | Companion deep-dive to study.md — reimplement-level algorithms/constants |
| `mangatranslator-round2-deep.md` | SNAPSHOT (06-08) | Companion to internals — only the newly-found techniques (no round-1 repeat) |
| `mit-vs-upstream-quality-divergence.md` | LIVING | Where/why MIT lowered quality vs zyddnys upstream |
| `inpaint-cleanliness-vs-upstream.md` | LIVING | Inpaint-cleanliness half of the upstream divergence (paired with the above) |
| `mit-core-decomposition-analysis.md` | LIVING | Static map: 26 seams (S1–S26) + landmines + safe order (companion to ADR 008) |
| `mit-hidden-capabilities.md` | LIVING | Undocumented MIT capabilities (font-weight system etc.) |
| `render-parity-port-plan.md` | ARCHIVED | Port plan for render-parity work (largely landed) |
| `translation-northstar.md` | LIVING | "As close to a human translator as possible" — the guiding principle |
| `pipeline-baseline-2026-06-08.md` | SNAPSHOT (06-08) | Pipeline baseline capture — reference point, don't edit |

> Note: the 4 `mangatranslator-*` docs are a deliberate chain (summary → internals → round-2 delta → comparative). Read `translator-deep-dissection.md` first; open the others only for algorithm-level detail.
