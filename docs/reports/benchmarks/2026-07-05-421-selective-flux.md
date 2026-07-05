# #421 Selective Flux — live benchmark (One-Punch p1 hair vs target)

## Result 1 — the Flux repair MECHANISM works (matches target)
![hair reconstruct](./2026-07-05-421-flux-hair-reconstruct.png)

ORIGINAL(target) | LaMa-only | selective-Flux. Text 「そうだよ…」 sits directly over the man's hair. LaMa
leaves a gray smear (can't synthesise hair). **Selective Flux reconstructs the hair with strand detail and
the ear — matching the target with the text removed.** This is the win: the routed crop → Flux Klein on the
ORIGINAL → mask-only grayscale paste back into the LaMa page. `+6.6s` over baseline (Flux cold-start + repair).

## Result 2 — no cost regression on flat pages (after tightening)
Otome ds9 (dialogue in white bubbles) with `MIT_SELECTIVE_FLUX=1`: **0 regions routed, 14.3s ≈ baseline** —
LaMa handles it, no Flux cost. Achieved by the dark-ink gate at `min_dark_frac=0.25` (a mostly-paper ring
does not route). At the initial 0.05 it FALSE-POSITIVED 4 regions on this flat page (23.8s) — the benchmark
caught it.

## Honest limitation — the discriminator is a single-threshold v1 (precision/recall tradeoff)
A scalar `min_dark_frac` cannot cleanly separate the two classes:
- **0.05:** catches BOTH hair regions (beautiful full repair) BUT over-routes flat pages (4 FP, wasted Flux).
- **0.25:** flat pages clean (0 routed) BUT under-routes the hair (1 of 2 regions → partial repair, some
  smear remains — see `2026-07-05-discriminator-tradeoff.png`).

(Confounded by the non-deterministic OCR/translate changing the mask per run — the 1-vs-2 region count is
partly run variance.) **The fix is a better routing SIGNAL, not a better threshold:** measure whether the
text sits over a LARGE contiguous dark-textured region (hair) vs a flat bubble with a thin/distant dark
border — e.g. dark-textured AREA under the component's dilated footprint, not a fixed 6px ring. Filed as the
remaining work on #421.

## Status
Repair pass + wiring PROVEN and committed (gated `MIT_SELECTIVE_FLUX`, off = byte-identical, LaMa-unload +
lock + try/finally fail-open). Discriminator v1 shipped with a documented tradeoff (default 0.25, conservative
= fewer false Flux calls). **#421 stays OPEN for the discriminator-v2 signal.**
