# Readable text colour on a repaired patch — adopted (MIT_TEXT_CONTRAST, on by default)

**The defect.** In the inpainting comparison the hand-lettered `HUH ... ?` on Haimiya ch. 6 p2 rendered its Thai
translation in **dark grey over the character's black hair and dark panel** — present but nearly invisible. The
region's colour pair comes from the lettering crop (black ink on a white balloon), while the pixels the renderer
actually paints on are the *repaired art* behind it (hair).

**The rule** (`manga_translator/text_contrast.py`, pure): at render time, take the median luma of the patch pixels
inside the region, compare it with the chosen ink colour, and when they are within 45 luma switch the ink to white
on a dark background (black stroke) or black on a light background (white stroke). It only fires on a genuine
collision; normal black-on-white balloons are untouched.

**Verified by eye on the failing case:** p2's `ฮึ!!...?` renders dark-on-black before and white-with-black-stroke
after, at the same size and position; the repair itself is unchanged (the hair smudge is an inpainting issue, next
item). Render suites stay green: `test_render*`, `test_patch_renderer`, `test_patch_geometry`,
`test_text_layer` and the new `test_text_contrast` → 136 passed.

**Flag:** on by default; `MIT_TEXT_CONTRAST=0` restores the OCR-derived colours verbatim.

## Measured alongside: the analyst's image size is not the cost

The previous round paid ~10 s/page for the analyst. Four image sizes were tried on the same pages
(768/1024/1280/1568 px long side): latency 6.5–8.7 s and **9/9 corrections matched at every size** — the cost is
dominated by generation, not by image tokens. So shrinking the analyst image is not the lever; the options that
remain are (a) run it only on pages whose OCR looks degraded, or (b) accept the cost under the quality-first
direction. No change made.
