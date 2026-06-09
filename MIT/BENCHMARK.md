# MIT Pipeline Benchmark — "as close to a human translator as possible"

A fixed reference page for judging the translation pipeline against a strong
external baseline (meangrinch/MangaTranslator). Re-run after any pipeline change
that could affect detection, OCR, translation, inpainting, or rendering.

## The test case

- **Manga:** One Punch-Man (`mangaId d8a959f7-648e-4c8d-8f23-f1f3f8e129f3`)
- **Chapter:** "Benchmark Pipeline MIT" (`chapterId ver:752fc515-72ce-4890-9369-0337ea3a8224`, JA, 1 page) — uploaded via Studio, owner Xeno.
- **Source page (JA):** `Backend/uploads/chapters/752fc515-.../d8658a92-...jpg`
- **Reference target (the bar):** `MIT/example_translation.jpg` — MangaTranslator's EN render of the same page. This is the quality we are chasing.

## How to run

Worker up on `:5003`, then:

```bash
.venv/Scripts/python.exe tools/ab_benchmark.py   # JA→EN, bubble_area_fit ON and OFF
```

Writes `tools/_bubble_proof/benchmark_{before,fiton,fitoff}.png` and a side-by-side
`benchmark_compare.png` (left = ours, right = reference). Full UI path is
`hayateotsu.space → One Punch-Man → Benchmark Pipeline MIT → แปล → EN` once the
upload-translate bugs below are fixed.

## Scorecard — 2026-06-08 (binary-search #166 ON)

Rough visual parity vs the reference: **~40–50%.** Translation text is comparable;
the gap is almost entirely *rendering* and *coverage*:

| Dimension | Reference (MangaTranslator) | Ours | Gap cause |
|-----------|------------------------------|------|-----------|
| Speech-bubble text fill | large, fills bubble | OK on detected bubbles | — (#166 works here) |
| **Narration-box text fill** | large, fills the box | **small, under-fills** | speech-bubble YOLO doesn't detect rectangular narration boxes → no `bubble_box` → #166 can't engage → crop-floor size |
| **SFX (ぬ → "LOOM")** | rendered | **left untranslated (JA)** | no SFX detector (#168 not implemented) |
| **Edge clipping** | text stays inside | **right column clips** | no safe-area / squeeze fallback (#166 round-2 P4) |
| Line-break / centering | polished | rougher | minor |
| Translation text | clean EN | readable EN, minor "he/she" slip | — |

**Takeaway:** #166 binary-search is correct but only lifts *detected speech
bubbles*. This page is dominated by **rectangular narration boxes + SFX**, which
are out of #166's current scope — so closing the gap needs narration-box / OSB
detection and SFX (#168), not more font-fit tuning.

## Known upload→translate bugs surfaced by this benchmark (2026-06-08)

1. **FIXED** — `loadPageBytes` couldn't load an uploaded page: the Reader sends a
   relative `/api/proxy/uploads/...` URL which `fetch` can't parse ("Failed to
   parse URL"). Now resolved from disk under the uploads root (`page-source.ts`).
2. **FIXED** — `PatchStore: unsafe chapterId segment: "ver:752fc515-..."`. Uploaded
   "version" chapters carry a `ver:` prefix whose `:` failed PatchStore's
   filesystem-segment guard, so patches couldn't be stored (UI 500'd *after* the
   worker succeeded). `PatchStore.put` now normalizes `:` → `_` before the guard
   (`toPathSegment`, patch-store.ts) so the dir becomes `ver_<uuid>`; `/`, `\`,
   `..` still throw (traversal guard unchanged). `patch-store.spec` 13 green.

Both fixed → the full `hayateotsu.space` UI translate of the uploaded chapter now
works end-to-end (verified via Playwright: toolbar shows "✓ แปลแล้ว", EN patches
overlay the page).
