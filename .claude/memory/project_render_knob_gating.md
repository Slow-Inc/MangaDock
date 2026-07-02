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

**Update 2026-06-12 — full parity verified live + font-size knob + SFX-OCR ceiling:**
- The full dev set now is `MIT_EN_COMIC_FONT=1 MIT_EN_UPPERCASE=1 MIT_BUBBLE_SEG=1 MIT_BUBBLE_AREA_FIT=1 MIT_SUPERSAMPLING=4 MIT_FONT_MAX_BOX_RATIO=0.5 MIT_OCR_PROB=0.03` (in `Backend/.env`, dev-only, **not committed**). `MIT_FONT_MAX_BOX_RATIO=0.75` oversized text (esp. the bottom-right panel) → **0.5 matches the reference**.
- All of #176/#179/#180/#181 were **already built behind these knobs** — closing the benchmark gap was *enable + tune*, not implement. Verified ~90–95% parity END-TO-END through the live tunnel (Playwright drove hayateotsu.space → translate → EN), patches served from local disk (needs `STORAGE_DRIVER=disk`, PR #222).
- **SFX-OCR ceiling:** `MIT_SFX_DETECTOR=1` detects the big ぬ but the 48px line-OCR can't read the stylized glyph (garbage prob 0.03–0.08 → dropped). フッ→"Heh." works. ぬ→LOOM needs a VLM OCR (MangaTranslator's `paddleocr-vl`); **PaddleOCR-VL-1.5 is blocked on transformers 4.55-vs-5.9 incompat**. Full write-up: `DONE.md`/`BENCHMARK.md` 2026-06-12. Don't assume the SFX detector alone yields ぬ→LOOM.
- Per-region OCR/translation can be dumped (no GPU re-load) via the worker's `POST /translate/with-form/json` (returns box + src OCR + tgt translation per region) — the decisive diagnostic for "which region dropped / mis-OCR'd".

**Driving the benchmark E2E via MCP_DOCKER:** the benchmark manga `/books/{id}` 404s (not in public catalog) and is **not deep-linkable** (book page reads `sessionStorage`). Reach it: navigate `hayateotsu.space/search?q=one%20punch` → click the 2nd "One Punch-Man" result → "อ่านตอนที่ Benchmark" → reader → translate dropdown → "→ EN" → "แปลหน้านี้". Note: MCP_DOCKER container screenshots do NOT sync to the host filesystem — use the worker-direct composite (`ab_parity.py` → host PNG) to view pixels instead.
