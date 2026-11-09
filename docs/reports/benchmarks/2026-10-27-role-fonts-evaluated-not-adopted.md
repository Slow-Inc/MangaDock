# Role-aware emphasis for lettering — implemented behind a flag, not adopted (MIT_ROLE_FONTS=0)

**Idea (Track A1).** The page analyst already labels every line `dialogue|thought|narration|sfx|annotation` and gives
a one-or-two-word emotion, and nothing used that for the *look* of the page: a shout and an inner monologue were
typeset identically. This adds a heavier face for raised-voice lines (role `sfx`, or an emotion word like
angry/shouting/furious/screaming/excited), leaving everything else in the lighter body face the product already
uses (Prompt-Regular).

**What was built.** `manga_translator/role_fonts.py` (pure: `wants_bold(role, emotion)`, `role_fonts_enabled`,
`bold_font_path`, `font_for_region`) with six tests; the analyst hook marks each region `region.emphasis`; the
freetype renderer switches to Prompt-Bold for those regions and restores the base face afterwards (glyph-cache swap
is the existing #680 path).

**Why it is not on.**

1. **It works against a stated product preference.** The worker deliberately injects **Prompt-Regular** as the
   Thai face — "user preference: less-bold Thai" (`mode/share.py`). Making a third of a page bold for shouts runs
   against the look the developer asked for.
2. **The labels are not stable enough to drive typography.** The same pages analysed twice produced
   `6/15`, `3/7`, `0/15`, `4/7` emphasised lines — the analyst's emotion words change between runs, so the same
   balloon is bold on one render and regular on the next. For a *type* decision that reads as random.
3. **The visual check cannot separate the change from translation sampling.** Rendering p1/p3 with and without the
   feature changed the translations between the two requests (the model is sampled), so the side-by-side diff was
   dominated by different words, not different weight — no reliable evidence that the heavier face even reaches the
   reader the way it was intended.

**Kept in the tree behind the flag** (`MIT_ROLE_FONTS=1` turns it on, default off): if the analyst's labels become
deterministic (temperature 0, or a per-page consensus pass) the experiment can be repeated cheaply; the pure
decision and the renderer seam are already tested.

**Note for a future attempt:** the reliable lever on "looks typeset" is probably not weight per line but a
per-*region* decision that is stable across runs (e.g. a region whose source is all-caps and short is a shout —
deterministic from the source text, no analyst needed).
