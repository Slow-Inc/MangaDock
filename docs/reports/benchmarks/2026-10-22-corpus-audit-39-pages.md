# Current-state corpus audit — 39 pages after the quality loop (2026-10-22)

Full replay sweep at HEAD (`_final`) over the 39-page corpus: **372 regions**, 39/39 pages rendered.

## What the audit looks for

| signal | rule | result |
|---|---|---|
| phantom SFX | `sfx_display` regions rendered | **6** (was 20 before #887), all from crops that pass the lettering + stroke guard |
| duplicate SFX in a balloon | Thai source text in a `clean_layout` region | 1 — Komi p1 `เอ๊ะ`, a rescued region that also carries a balloon box, so it is lettered as normal text; **not a duplicate** (the #887 round-3 class is gone) |
| shrunk text | rendered font < 0.6 x source | 1 — Kage p0's title (`陰の実力者になりたくて！` 156 px -> 64 px) |
| overlap / spill | doctor `render` metrics | 1 page: Chainsaw p0 `overlap=2` — the known #883 default; the opt-in `fit_below_floor` takes it to 0 |
| Latin left in Thai | `translate` WARN `latin_in_target` | 8 pages — names/brands/credits (`DALE`, `RTSD`, `ZERO`, `COMI`, `PAIZ`), accepted |
| foreign script | `translate` WARN `foreign_script` | 2 pages (Otome, Tsuki) — **stale recorded translations** replayed from dumps made before #763; live runs are clean |
| split containers | `merge` FAIL/WARN | 5 pages — the probe's flag on vertically stacked separate balloons/credits (Boku, Horimiya x2, Tsuki); the merge itself is what the probe flags, no user-visible defect found on review |
| implausible detection | `detect` FAIL | 1 — Chainsaw's title logo (`CHAINSAWMAN`, 9 % of the page); the #886 guard drops the single-glyph case, a whole-word logo still renders translated |

## Verdict

No new user-visible defect surfaced: every flag is either a documented, accepted tradeoff (Chainsaw overlap,
Latin credits, title shrink) or a replay artifact (stale recordings). The quality guards from this loop hold on
the whole corpus: SFX rescue went 20 -> 6 renders with zero phantoms, and the duplicate-over-balloon class is
gone.

## Method note

Anomaly scans over the recorded payload (font ratio vs source, Thai text in non-SFX regions, doctor stage
flags) found the two real defects of the last rounds; they are cheap and worth running after any pipeline
change. Page-image extension matters when scripting: three pages are `.jpg` and were skipped silently by a
`.png` glob.
