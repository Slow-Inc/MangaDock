# Inpainting sweep — FLUX.2-klein vs LaMa-large on the same pages

**Question:** the PRD's inpainting row names MangaInpainting (structure lines + ScreenVAE) as the candidate and
warns that generative Flux must stop swapping models on pages with nothing to repair. MangaInpainting has no
weights here; the model this box can actually run today is the existing `flux_klein` inpainter
(`FLUX.2-klein-4B`, already in the local HF cache). So: does Flux repair what LaMa smears?

**Setup:** the same live MIT, same page, two configs through `/translate/with-form/patches`:
`inpainter.inpainter = 'lama_large'` (today) vs `'flux_klein'`; patches composited over the source and compared
side by side, then zoomed on the hand-lettered `HUH ... ?` over hair and screentone (ch. 6 p2).

| page | LaMa-large | Flux Klein |
|---|---|---|
| p2 (2 patches) | 5.7 s | 26.1 s |
| p9 (8 patches) | 12.8 s | 21.6 s |

**What the zoom shows**
- On the erasure over hair + screentone both models leave a soft grey patch; Flux is not visibly better at
  rebuilding the screentone, and neither reconstructs the hair strands under the letters.
- Both erase the hand-drawn motion strokes beside the text: the strokes fall inside the region's patch and are
  inpainted away. That is a **mask/region problem, not an inpainting-model problem** — no model choice fixes it,
  and it is the bigger visible loss in this crop.
- The Thai text drawn over the dark hair renders dark-on-dark in both arms: a colour-choice issue from the
  region's fg/bg estimate, again independent of the inpainter.

**Verdict: not adopted.** 4.6× the time on p2 and 1.7× on p9 for no visible gain on the defects this chapter
has. The PRD's MangaInpainting (screentone-aware) remains the untested candidate; it needs weights that are not
on this box. Two mask-level follow-ups came out of this instead, both cheaper than a model swap:
1. grow the erase mask with the *drawn ink*, not the rectangular text box, so motion lines outside the letters
   survive;
2. pick the text colour by contrast against the repaired patch, so white-on-dark lettering stays legible.

**Limits:** two pages, one zoom each, read by eye. Screentone-heavy pages from other chapters were not covered.
