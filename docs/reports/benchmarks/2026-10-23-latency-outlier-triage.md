# Latency-outlier triage of the final 39-page sweep: spikes are transient host/gateway variance, not code

- **Date:** 2026-10-23 · data: `final56` (39 pages, sequential doctor run), plus repeated runs of the same pages.

## Stage budget (39 pages)

| stage | total | share |
|---|---|---|
| wall | 298.4 s (avg 7.65 s) | — |
| translation | 116.1 s | 39 % |
| textline_merge | 52.3 s | 18 % |
| ocr | 48.7 s | 16 % |
| detection | 30.2 s | 10 % |
| inpainting | 16.3 s | 5 % |
| mask_refinement | 12.4 s | 4 % |
| rendering | 9.7 s | 3 % |

## Outliers

- `Chainsaw p0` 15.2 s: detection 5.7 s — **cold model load** on the first page (preload #1047 addresses it, opt-in).
- `Mushoku p1` 14.2 s: translation **10.9 s** vs ~3 s typical — gateway variance (external).
- `Kage p1` 13.7 s: textline_merge **8.8 s** vs 0.3-1 s typical.

## The merge spikes are not content-specific

- Same page across runs: `Kage p1` merge = **315 ms** (b48) / 358-367 ms (fast) vs **8 787 ms** (final56); `sweep42` had
  other pages at 9.8 s / 4.3 s / 4.8 s / 5.8 s / 5.6 s. The spikes move between pages and runs.
- Image size does not explain it: a 1.8 MP page hit 8.8 s while a 5.3 MP page ran 1.1 s.
- Models are not being reaped (`models_ttl = 0`), so it is not a model reload inside the stage.
- Conclusion: transient host/GPU/CPU contention (no reproducible content trigger), not a fixable code path. The
  earlier 8-page profile (merge 0.2-1.2 s typical) matches the fast runs.

## Action

None. Recorded so a future session does not chase the same spikes; the only actionable latency items remain the
opt-in preload (cold first page) and the gateway's own translation variance.
## Re-triage on the v3 defaults (2026-10-23, OCR second pass ON)

Per-page stage breakdown from the latest 39-page sweep (median wall 6.63 s):

| page | wall | detection | ocr | merge | translation |
|---|---|---|---|---|---|
| Chainsaw p0 | **19.2 s** | **6.1 s** | 3.9 s | 0.3 s | 5.4 s |
| Komi p1 | 15.2 s | 0.6 s | 4.6 s | **6.0 s** | 2.2 s |
| Kage p1 | 14.0 s | 0.6 s | 1.6 s | **8.8 s** | 1.9 s |
| Tsuki p1 | 12.3 s | 0.5 s | 2.2 s | **4.7 s** | 3.5 s |
| Mushoku p0 | 10.3 s | 0.6 s | 0.9 s | **6.7 s** | 1.1 s |

- **Chainsaw p0 is the cold-start page of this sweep** (model loading lands on whichever page runs first): detection
  6.1 s + OCR 3.9 s are lazy-load costs, not per-page work — production workers pay this once (`MIT_PRELOAD` moves it
  to boot, opt-in).
- **Merge spikes persist at 4.7-8.8 s** on pages whose Kumiko itself is only 0.8-1.2 s; they move between runs and
  do not correlate with page size or region count — the earlier conclusion stands (transient CPU/GPU contention from
  the modelling stack's background threads, not a pipeline bug).
- **Translation spikes** (5.4-5.9 s vs ~2.5 s median) are gateway-side latency.

Nothing actionable: the deterministic floor is ~6.5 s median and the spikes are environment/contention, matching the
first triage. The only lever that removes the cold start is `MIT_PRELOAD`, still opt-in because it holds VRAM/RAM while
idle.