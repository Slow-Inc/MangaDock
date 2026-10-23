# Translation-stability audit: dialogue is mostly reproducible, short/interjection segments are not

- **Date:** 2026-10-23 · tool: `tools/stability_audit.py` (`--runs 3` over three real pages, real gateway).
- **Method:** translate the same page three times, match segments by source text, compare the three Thai answers
  with a character-level similarity; buckets: stable (min pairwise ratio >= 0.85), moderate (0.5-0.85), unstable
  (< 0.5).

## Results

| page | segments | stable | moderate | unstable |
|---|---|---|---|---|
| Boku p0 | 16 | 6 | 3 | **7** |
| Otome p0 | 11 | 6 | 5 | 0 |
| Maou p0 | 11 | 5 | 6 | 0 |

- **Dialogue pages are stable or paraphrase-level:** Otome/Maou have no unstable segment; their moderate
  differences are synonym choices (`ไอเทมที่หายากอย่างยิ่ง` / `หายากมาก` / `หายากยิ่ง`).
- **Boku's instability is concentrated in short, low-information lines** (`SOR`, `MAN..`, `OH..`, `Siiig`, `AH`) —
  interjection wording naturally varies and carries little meaning.
- **One real semantic drift observed:** `IVE GOT ALLERGIES SO I DONT EAT SNACKS.` produced
  `ฉันแพ้ของกินเล่น...` (two runs) and `ฉันแพ้สารอาหารในขนม...` (wrong sense: allergic to nutrients *in* snacks).
- One unstable run also contained a garbled fragment (`ฉันจะทักคู้บเขาเองละกัน` for `ILL OFFER THEM ON MY OWN`),
  i.e. instability and garbling co-occur on the same segment class.

## Takeaways

1. The at-temperature=0.5 wording variance is acceptable for dialogue but **short/interjection segments are the
   unstable class** — exactly the segments with the least context to anchor them.
2. A self-consistency scheme (translate twice and reconcile) would target mostly low-value lines while costing a
   second page call, so it stays an **idea**, not a default; if tried, restrict it to short segments.
3. The audit is reusable (`tools/stability_audit.py`) as a regression metric: track unstable count per page over
   prompt/config changes.