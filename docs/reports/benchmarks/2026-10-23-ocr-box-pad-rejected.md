# Global OCR box padding: measured and rejected (pulls neighbouring text in)

- **Date:** 2026-10-23 · 39-page sweep with every detected textline box padded 15 % before the first OCR pass, then a
  text-level A/B against the unpadded baseline (`MIT_OCR_BOX_PAD=0.15`, reread off).

## Idea

The re-read pass proves that a 30 % padded box repairs a clipped-edge misread. Doing the padding **before** the first
OCR pass would fix those lines with zero extra model calls — if it does not pull neighbouring text into the box.

## Measurement

| metric | result |
|---|---|
| source strings changed | **159/348 (45.7 %)** |
| pages with region-count changes | **24/39** |
| text-level A/B (42 index-aligned changed lines) | padded better 25, **baseline better 13**, tie 4 |

Padding every box merges neighbouring lines/balloons on a quarter of the pages, and while 60 % of the aligned changes
improve, **31 % get worse** — a coin-flip with chapter-wide layout churn. The re-read pass is the right shape: pad only
the low-confidence line, and only after the first read says it is unreliable.

## Decision

**No global box-padding knob.** The experiment code was removed (it shipped nothing), the re-read pass stays the shipped
path. Recorded so the idea is not rebuilt without a *per-line, confidence-gated* shape.