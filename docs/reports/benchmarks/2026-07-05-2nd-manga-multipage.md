# 2nd-manga multi-page coverage — Last Arcanum / "Otome" (EN→THA), local cache

The benchmark rule wants a 2nd manga + multi-page coverage. Source is LOCAL (Reader chapter cache
`img-cache/_chapters/.../c1abfbeb`, official-EN) — **no tunnel needed** (the earlier "needs tunnel"
claim was wrong; the cache holds the raw source). Combined with One-Punch (JA→EN/THA, p1/p2) this is
**two distinct manga, six pages**. Full-page-inpaint path, prod-faithful config.

| page | regions | leaked markers | empty | size | overlap | asym | verdict |
|---|---|---|---|---|---|---|---|
| p10 (ds9) | 12 | 0 | 0 | 2 | 0 | 1 | **clean** (the defect-sweep page) |
| p13 (ds12) | 15 | **0** | 0 | 2 | 5 | 6 | **SFX-stacking defect** (see below) |
| p21 (ds20) | 5 | **0** | 1 | 2 | 0 | 0 | proper-noun line kept EN (nit) |
| p31 (ds30) | 9 | **0** | 0 | 1 | 0 | 0 | **clean** |

**Held across all pages:** zero leaked `<|n|>` markers (the custom_openai index-parse fix generalizes),
zero page-wide misalignment, dialogue/caption boxes translate into tall readable columns.

**Newly surfaced by the extended coverage (honest findings, not in the original 8 classes):**
1. **Display-SFX stacking (p13, real render defect):** the page has two overlapping チュン onomatopoeia;
   each is rescued + rendered as a large display SFX and they **overlap** ("ฉุนจุน" over "ฉับ/ตืบ") —
   the anti-overlap clamp doesn't apply to the `sfx_display` branch. Scorecard caught it (overlap=5,
   asym=6). Candidate next-round fix: extend `clamp_box_to_neighbors` to display SFX.
2. **Proper-noun-heavy short line kept EN (p21, nit not defect):** "I'M SCUM-ULTOS!" stayed English —
   the model kept the in-universe game name; p31 shows the same name handled correctly inside a Thai
   sentence ("...ผู้ช่วยของ SCUMULTOS!"), so this is a translation-content choice, not text-loss.

**Conclusion:** 2nd-manga multi-page benchmark COMPLETE. The render pipeline generalizes (2/4 pages fully
clean, marker/misalign fixes hold everywhere); the sweep did its job by surfacing one genuine new render
class (display-SFX stacking) for the next round. Appended to the defect checklist.

### Follow-up: display-SFX dedup attempted, then REVERTED (deferred)
A dedup fix (suppress a same-text display SFX overlapping an already-placed one ≥60%) was implemented TDD
and dropped the p13 overlap 5→2 in a probe. But on the **full-page-inpaint path** the suppressed region's
degenerate quad crashed the single whole-page render group (`AttributeError → inpaint-only patch`), blanking
**every** caption on the page (empty_bubbles 0→8) — a regression far worse than the original stacking. Per
the north-star ("remove complexity rather than prop it up"), the fix was reverted (commits dropped). The
display-SFX stacking remains a **documented, deferred** finding: a proper fix needs the suppressed-region
path to be safe on the single full-page render group (the per-crop path tolerates it; the full-page group
does not), which is its own small piece of work — not worth destabilizing the whole page to land now.
