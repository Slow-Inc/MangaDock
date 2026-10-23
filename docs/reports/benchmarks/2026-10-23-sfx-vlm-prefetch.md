# Latency: SFX vision calls batched concurrently + smaller uploads

- **Date:** 2026-10-23 (round 264) · `manga_translator.py` textline_merge prefetch, `ocr_vlm.localize_candidates`, `_to_data_url`.

## The outlier

Unseen-page QA surfaced `textline_merge` times of 25-37 s on SFX-heavy pages. Profiling showed the merge loop making one
**blocking ~4-5 s vision request per SFX candidate, sequentially** (`vlm_localize_sfx`), plus full-resolution PNG uploads.

## Fix

1. **Concurrent prefetch:** before the merge loop, collect the candidates that pass the same gates (`swallows_dialogue`,
   `should_rescue_sfx`) and localise them with `asyncio.gather(asyncio.to_thread(...))` (`ocr_vlm.localize_candidates`),
   preserving order. The loop consumes the prefetched result; it only falls back to the blocking call when a region was
   not prefetched (text changed after the pre-pass). **Empty results are cached too** - filtering them out re-asked those
   regions sequentially and undid the batching (measured).
2. **Smaller uploads:** `_to_data_url` downscales the crop to 768 px max side and JPEG-encodes it instead of shipping a
   full-resolution PNG. Vision models normalise input size anyway.

## Evidence (same unseen page, Oshi no Ko p0, 9 SFX candidates)

| run | prefetch wait | textline_merge | page wall |
|---|---|---|---|
| before (sequential) | 14.2 s (when batched-only part was measured) | **32.4-37.4 s** | 54-68 s |
| after | **7.5 s** | **8.4-8.8 s** | **25.8-26.0 s** |

- Gate on the re-run: **0 violations**; the rescued onomatopoeia stayed plausible (`กร๊อบ`, `เฮ้อ`, ...; run-to-run wording
  varies by design).
- Tests: `localize_candidates` (order + concurrency), data-URL could be JPEG; suite **991 passed**.
## Quality A/B: full-resolution PNG upload vs 768 px JPEG (round 236)

To make sure the upload change did not degrade the onomatopoeia readings, the same unseen page was run twice per arm with
`_to_data_url` swapped between the old PNG and the new JPEG encoder (candidate selection unchanged: 9 candidates both
arms):

| arm | rescued Thai onomatopoeia (two runs) |
|---|---|
| PNG (old) | `เหมียว` / `ปัง`, `กลิ้งกลิ้ง`, `ฟึ่บ` |
| 768 px JPEG (new) | `ฟึ่บ` / `ฟึ่บ`, `เฮ้อ` |

Both arms return plausible short onomatopoeia with no garbage tokens; the run-to-run variation is the same sampling
nondeterminism seen before (candidate crops can differ slightly between detection runs). The upload optimisation is
quality-neutral, so it stays part of the default prefetch path.