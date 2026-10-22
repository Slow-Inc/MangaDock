# MIT latency profile (8 real pages, HEAD) + ranked opportunities

- **Date:** 2026-10-23 · from the round's live sweeps (`baseline71`, `jp73`, guard-check logs).

## Stage averages (wall = end-to-end `translate_patches`)

| stage | avg | notes |
|---|---|---|
| wall | **8.98 s** | includes one cold page (16-17 s); warm pages 3.6-7.9 s |
| translation | **1.91 s** | gateway-bound, 1 call/page |
| detection | 0.5 s warm / 5-6 s cold | cold includes weight load |
| OCR | ~1.4 s | cuDNN off (quality choice, #884) |
| mask_refinement + inpainting | **0.70 s** | independent of translation |
| textline_merge | 0.2-1.2 s | |
| rendering | 0.1-1.9 s | supersampling 4 |

## Ranked opportunities

1. **Overlap mask+inpaint with the translation wait** — up to **0.70 s/page (7.8 % wall, 14 % warm)**. Blocked on
   proving the region list cannot change between translation and `_finish_patches`; filed as #1050 with a byte-identical
   acceptance gate.
2. **First-page cold start** — weight load ≈5 s; solve by preloading at boot: **implemented opt-in** (#1047), e2e
   21.5 s -> 18.1 s first page.
3. **Translation wait (1.9 s)** — already the batch pipeline's target (#905, opt-in, 1.37x in-process); no
   single-page lever left without changing quality.
4. **OCR ~1.4 s** — cuDNN is off for a quality reason (#884); re-enabling would trade quality for speed, so it stays.
5. **Rendering** — supersampling 4 is a quality choice; lowering it is a tradeoff, not a free win.
## Probe: can the mask/inpaint overlap be built safely? (round 78, #1050)

Added an env-gated `[region-filter] before=N after=M` log to `_finish_patches` (`MIT_LOG_REGION_FILTER=1`) and
ran 7 real pages:

| page | before filter | after filter |
|---|---|---|
| Boku p0 | 13 | **12** |
| Horimiya p0 | 25 | 25 |
| Mieruko p0 | 11 | 11 |
| Akuyaku p0 | 11 | 11 |
| Otome p0 | 11 | **10** |
| JP page probed as ENG | 7 | **0** |
| Mairimashita Iruma p1 | 8 | 8 |

**Verdict: the region list is NOT stable** — the post-translation filter really drops regions on 2 of 7 pages (and
all of them on a mixed-source JP page probed with the wrong source language). A mask built before translation
would therefore erase text that is never re-rendered (blank balloons). The overlap (#1050) is blocked as designed;
the shared fix is to move the filter to the front stage, which is a behaviour change split into **#1051**
(translate only the regions that will be rendered — fewer tokens/latency on mixed pages, and it makes the region
list stable so the overlap becomes possible).
## Experiment: deterministic front-stage source-language drop (#1051) — **rejected, output changes**

Tried dropping regions whose text is non-Latin (CJK/Kana/Hangul/Cyrillic/Thai) BEFORE translation when the
requested source is Latin-script, to stop translating lines the post-translation filter discards. Replay A/B
(same recorded translations, so only the region set can differ) on real pages:

| page | early filter | rendered PNG |
|---|---|---|
| Boku p0 | translated 13, dropped 1 | **byte-identical** |
| Otome p0 | translated 10, dropped 1 | **byte-identical** |
| JP page probed as ENG | translated 0, dropped 7 | **byte-identical** (both empty) |
| Kage p0 | translated 7, dropped 1 | **byte-identical** |
| **Kage p1** | translated 6, dropped 2 | **DIFFERENT** (off renders the ザワ/「平ク」 SFX, on dropped them) |

Verdict: **a script-only pre-drop is not equivalent to the real filter** — the post-translation filter keeps
non-Latin regions in some cases (vision-rescued SFX, UNKNOWN language detection), and dropping them early removes
rendered text from the page. The whole experiment was reverted (uncommitted); no code shipped.

Revised design for #1051 if it is revisited: run the **real** `_filter_regions_by_source_lang` early (same
predicate, not a script heuristic) and gate on byte-identical replay across a corpus that includes Kage p1; if the
only safe version changes the model's line set, an A/B with the judge is required before any default decision.