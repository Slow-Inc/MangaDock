# ADR 023 — Re-enable MIT bubble-area-fit with bounded binary-search sizing

- **Status:** Accepted (2026-06-30)
- **Supersedes:** the prior implicit decision to keep `MIT_BUBBLE_AREA_FIT` **off** (recorded only as an `.env`/`.env.example` comment: *"OFF: fill-balloon sizing made dialogue too big/overlapping"*).
- **Issues:** #175 (bubble-fit font sizing), #430 (S2 dialogue fills bubble), #431 (S3 SFX bounded).
- **Area:** MIT render — `manga_translator/rendering/__init__.py`, `manga_translator/render_overlap.py`, `Backend/.env*`.

## Context

`resize_regions_to_font_size` routes each text region to one of three sizing paths:

1. **bubble-fit** (`MIT_BUBBLE_AREA_FIT`, #166) — size the font to fill the balloon.
2. **clean-layout** (`MIT_CLEAN_LAYOUT`, #263) — non-balloon narration/caption laid as a small upright block.
3. **legacy** length-ratio — everything else.

`MIT_BUBBLE_AREA_FIT` was turned **off** because the original fill-balloon code grew the font to fill the whole balloon height, so short dialogue lines in tall balloons came out oversized and overlapped neighbours. With it off, **balloon dialogue falls to the legacy length-ratio path**, which sizes the font from the *source* text footprint. That is fine for JP-source vertical narration (handled by clean-layout) but produces **dialogue far smaller than its balloon when the source is English** (Latin source boxes are already "full", and the more-compact target shrinks the ratio). Verified end-to-end: *Gal Yome no Himitsu* EN→TH ch1 p4 — every speech balloon rendered tiny Thai text; the One-Punch JA→EN benchmark looked fine only because its dialogue is JP narration routed through clean-layout, masking the defect.

Two render changes made the original objection obsolete:

- **#430 / S2** — `_bubble_fit_font_size` no longer uses the box-relative `h_box × 0.5` cap. It binary-search-fits the largest font whose wrapped translation fits the balloon **safe interior**, bounded by the two-tier *processing-scaled* bounds (dialogue `[8,16]×√MP`), and is clamped against neighbours by `anti_overlap` (`clamp_box_to_neighbors`). It can no longer grow unbounded.
- **#431 / S3** — `display_sfx(sfx_rescued, is_sfx, has_bubble)`: a region only enters the oversized display/SFX regime (`[10,64]` range, font-cap exemption) when **free-floating** (no `bubble_box`). Bubble-internal text flagged by the `len(src)≤4` heuristic ("DRINKING PARTY") is dialogue and stays within dialogue bounds.

## Decision

Set **`MIT_BUBBLE_AREA_FIT=1`** by default (requires `MIT_BUBBLE_SEG=1`, already on). Balloon dialogue is sized by the bounded binary-search fit; non-balloon text continues through clean-layout; free-floating SFX continues through the legacy display path.

## Consequences

- **Positive:** EN-source (and any compact-target) dialogue fills its balloon instead of rendering tiny. The `renderConfigHash` change busts the per-page patch cache, so the new sizing is visible on the next translate.
- **Validated:** Gal Yome EN→TH p4 — all dialogue fills; the "ปาร์ตี้" SFX-misclassification no longer overflows the art (#431). One-Punch JA→EN — **no regression**: narration small (clean-layout), balloons fill, the free-floating "GULP"/"NEH" SFX stays large (`has_bubble=False`). Render golden/guard suites byte-identical; `test_render_overlap.py` 25 tests green.
- **Negative / residual:** a stylized in-bubble word the SFX **detector (YOLO)** splits into its own region without associating it to the balloon can still render larger than the surrounding dialogue (it has no `bubble_box`, so `display_sfx` keeps it big). That is a detection/region-merge concern, not a sizing one — tracked separately (S4 / #432 classification unification).
- **Reversibility:** drop the knob (`MIT_BUBBLE_AREA_FIT` unset) to fall back to legacy sizing; the code paths remain byte-identical when the flag is absent.
