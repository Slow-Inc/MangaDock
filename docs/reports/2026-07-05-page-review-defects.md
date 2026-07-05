# Page-by-page review defects (user remote-control, 2026-07-05)

The user reviewed the committed benchmark renders page by page and flagged issues on 3 pages.
Root-caused into 3 classes; status below.

## Class A2 — over-erase (ART DESTROYED) — FIXED ✅ (the worst; a self-introduced regression)
**One-Punch HUH panel:** a character figure (a boy holding a ball) under the "…HUH?" speech bubble was
inpainted away — head/face/ball faded to near-white.

**Root cause:** the empty-bubble guard blessed the WHOLE balloon interior as erasable
(`add_own_balloon_interiors`) and directly erased its ink (`erase_own_balloon_ink`) to catch the ME-OFF
ghost. But a character figure is LINE ART — thin strokes indistinguishable from text by any pixel
heuristic tried (CC size failed on line-art; whole-box ink-fraction failed because a speech bubble's
bounding box is mostly white paper with the figure a small dark fraction, e.g. the HUH box measured only
9.4% ink yet contained the boy).

**Fix:** removed both interior-erase mechanisms entirely. The ME-OFF ghost stays fixed regardless —
the detection improvements now cover the ME-OFF line in its own region, and `changed_alpha` stops
neighbouring patches from resurrecting erased text. Verified live on both paths: boy PRESERVED,
ME-OFF still GONE (per-crop and full-page). `erase_own_balloon_ink` remains in the tree (tested) but
unwired.

## Class A1 — under-erase (leftover source text) — DEFERRED (safe fix scoped)
Leftover original strokes at caption-box edges the detection line missed:
- p31#1 SCUMULTOS box (top stroke), p31#2 "ชื่อเธออะไรนะ?" (underline), p13#2 True-Ending box.

**Why deferred:** every pixel-heuristic erase (CC size / ink fraction) that fixes this ALSO destroys the
A2 character figure — there is no reliable pixel test to tell "leftover caption text" from "line-art
figure" inside an arbitrary bubble box. The only safe fix is to erase interior ink ONLY for regions that
are VERIFIED white RECTANGULAR caption boxes (from `white_box_candidates`), never speech balloons. That
needs the white-box identity threaded onto the region (a targeted change), so it is queued rather than
shipped as another art-risking heuristic. Art preservation (A2) outranks caption-edge cleanliness.

## Class B — display-SFX (oversize / stack / misplace) — PENDING
- p13#1: チュン onomatopoeia rendered huge + stacked, covering the top ~1/3 of the page.
- p31#3: "ฮึบ" SFX rendered over the character's face instead of at the original SFX's left-edge location.

**Status:** the dedup attempt for the stacking was reverted earlier (it crashed the full-page render
group). A proper fix (cap display-SFX font growth + fix placement to the source SFX centroid + safe
suppression on the full-page group) is queued.

## Summary
| class | pages | status |
|---|---|---|
| A2 over-erase (art) | One-Punch HUH | **FIXED + verified** |
| A1 leftover caption text | p31#1/#2, p13#2 | deferred — needs white-box-only erase gating |
| B display-SFX | p13#1, p31#3 | pending — font cap + placement + safe suppression |
