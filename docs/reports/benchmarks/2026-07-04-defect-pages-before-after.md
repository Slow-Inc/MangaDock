# Defect-pages benchmark — every page where a defect was caught, before → after

All renders: live worker (branch `landing/render-phase0`, all Phase-0 + slices B/C/D + SFX fixes),
`/translate/with-form/patches`, prod-faithful config incl. `ocr.vlm_rescue`.

## 1) Otome Game Sekai p10 (the page that exposed everything) — EN→THA
Source recovered from the Reader's chapter cache (`img-cache/_chapters/.../ds9.jpg`, official-EN source →
this page doubles as the **EN-source discriminator verification** the plan owed).

![before/after](./2026-07-04-otome-p10-before-after.jpg)

| # | defect the user caught (BEFORE) | AFTER |
|---|---|---|
| 1 | **empty white boxes** (text erased, nothing drawn) | ✅ **every box/bubble carries text** (girl bubble, DON'T-COME-NEAR, both narration boxes, TCH, PHEW, IRIS-CHAN) |
| 2 | **very small text** in boxes | ✅ narration/dialogue at readable sizes (clean_layout 20-23px, bubble_fit 15-27px) |
| 7 | **tiny text over text** | 🔶 the *dedup class* (same-text duplicate) is fixed; **a NEW dominant class shows: `det_sfx` false-positives** — the SFX detector fires on the girl's bubble text + a narration box; the VLM "rescues" them into phantom overlays (8px over the bubble; big ก๊ากก eating the STARTING-WITH box). **The scorecard caught it itself: overlaps=49** — the gate works. This is exactly pending task #19 (the phantom-เงียบ class), now with a reproducible page + per-region payload evidence. |
| — | scorecard | `{regions:14, empty:0, size:4, overlap:49, asym:4}` — page FAILS the gate on the #19 class (as it should) |

## 2) One-Punch p1 (user-annotated narration asymmetry/width/size + SFX) — JA→EN

![before/after](./2026-07-04-onepunch-p1-before-after.jpg)

| defect (BEFORE) | AFTER |
|---|---|
| narrations unequal (left small / right big, tagging luck) | ✅ both clean_layout, sizes track original (35→29 / 39→25) |
| narration wide, not the original's tall column | ✅ tall narrow columns, line breaks ≈ target |
| a bit smaller than target | ✅ sizes toward original lettering |
| ぬ SFX untranslated | ✅ SQUELCH, one big line (rescue + filter carve-out + sfx_display) |
| HMPH./HUH? force-broken (found during iteration) | ✅ single-line (hyphenation-aware floor) |

## 3) One-Punch p2 — EN+THA sweep entries
`2026-07-04-sweep-p2-{eng,tha}.jpg`; scorecards: empty=0, overlap=0.

## Honest verdict
- **The user's original defect classes (empty / tiny / same-text overlay / asymmetry / SFX-untranslated) are fixed
  and hold on the wild page.**
- **Next dominant class, with evidence:** `det_sfx` false positives → phantom VLM overlays / an eaten narration
  box (task #19). The metric gate + enriched payload now catch and attribute it automatically — the exact
  regression-guard loop the plan was built to create.
