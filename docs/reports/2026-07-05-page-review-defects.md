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

## Summary (updated after the fix pass)
| class | pages | status |
|---|---|---|
| A2 over-erase (art) | One-Punch HUH | **FIXED + verified** — interior-erase removed; boy preserved, ME-OFF still gone |
| A1 leftover caption text | p31#1/#2, p13#2 | **FIXED (safe)** — `erase_ink_in_white_caption_boxes` erases ink only inside verified white boxes (never speech balloons); SCUMULTOS clean + boy preserved. Minor: p31 name-box faint underline residual (likely a decorative ornament / partial-inpaint ghost) remains. |
| B display-SFX oversize | p13#1 | **FIXED** — display-SFX font capped to 10% of page height (was covering ~1/3) |
| B display-SFX placement | p31#3 | **not a defect** — the original has a "ニ" smirk SFX at that spot; rendering "ฮึบ" there is faithful; font now capped. ("ニ→ฮึบ" is a translation nuance, not a render issue.) |
| B display-SFX stacking | p13#1 | deferred — two จุนจุน still render; dedup crashed the full-page group earlier, needs a full-page-safe suppression |

### The key lesson
A2 was a **self-introduced regression** (the ME-OFF ghost fix erased all balloon-interior ink, which killed a
character figure drawn as line art). No pixel heuristic (CC size, ink fraction) can tell line-art from text
inside an arbitrary bubble — the safe discriminator is the **white_box_candidates** detector: erase interior
ink ONLY inside verified box-like white rectangles (caption panels), never speech balloons. The page-by-page
user review caught the art destruction before it shipped.
