# Selective Flux repair for text over art — adopted (on by default), with the cost measured

**The defect.** Haimiya ch. 6 p2: the hand-lettered `HUH ... ?` sits on the character's hair and the motion
strokes. LaMa repaints the mask area flat, leaving a grey smear where the hair should be — the reader sees a
smudge, not art. The pipeline already had the fix (#421, `selective_flux`): after the full-page LaMa pass, only the
erase-mask components that sit over *textured art* are routed to Flux Klein and pasted mask-only into the LaMa
result. It was off.

**Measured on the actual page** (same config otherwise, live MIT):

| page | LaMa | selective Flux | what happened |
|---|---|---|---|
| p2 (HUH over hair) | 12.0 s | 27.6 s | 1 text-over-art region repaired; **the grey smear is replaced by plausible hair and panel** |
| p9 (dialogue on flat balloons) | 24.5 s | 22.2 s | 0 candidates — no cost |
| p10 (balloon over hair edge) | 15.7 s | 16.7 s | 1 candidate, +1 s |

The p2 crop was compared side by side: LaMa leaves a grey band across the dark hair and around the `?`; Flux
reconstructs the hair strands and the panel edge. That is the difference the reader actually notices.

**Chapter cost (14 pages, two runs):** 43.2 / 58.5 s with LaMa only → **151.4 / 177.3 s with the pass on**
(≈3.5×). The pass engaged on 4 pages per run (1–2 regions each; 28 pass invocations over two runs, 0 failures), so
the price is roughly 20 s per page that has text over textured art — pages without such a component pay nothing.

**Adopted** under the standing "quality first" direction: `Inpainter.selective_flux` now defaults to **True**, and
`MIT_SELECTIVE_FLUX=0` turns it off for a worker without the VRAM. (The Backend already maps that env knob, so a
deployment can opt out without a code change.)

**Optimisation path recorded, not done:** the per-page Flux load is most of the cost. Keeping the model warm, or
running the repair for a whole chapter in one Flux session, should cut the 20 s/page substantially — a performance
task, not a quality one.

**Limits:** the art comparison is by eye on one page (there is no art-quality metric in the repo); the chapter
timing is two runs on this workstation; the pass relies on the #421 texture discriminator, so flat-background pages
are unaffected by design.
