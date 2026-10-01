# PRD: Source-agnostic line-break / wrap parity (EN→other equals JP→other)

> Draft preserved locally because the `gh` API token is currently 401 (publish to the tracker once re-authed). Apply `ready-for-agent` on publish.

## Problem Statement

When a reader translates a manga page, the translated text should break lines the way a human typesetter would — narrow columns that sit cleanly inside speech balloons and caption boxes, matching the visual rhythm of the original page. Today this only happens when the **original is Japanese**. For Japanese-source pages the line-breaking looks right; for **English-source pages translated to another language (e.g. EN→Thai), the line-breaking comes out wrong** — text wraps into wide lines that don't reference the original's layout, narration/caption blocks spread across the panel instead of forming tidy columns, and the page reads worse than the JP-source equivalent.

The reason (confirmed in code): the renderer derives its wrap width from the **source text's bounding-box width**. Japanese is set vertically, so a source column's bounding box is narrow → the translation inherits a narrow column. English is set horizontally, so a source line's bounding box is wide → the translation inherits a wide wrap. The "reference the original" behaviour is therefore an accident of the source being vertical, not a real layout algorithm — and it silently degrades every EN-source (and any horizontal-source) translation. MIT is the product's headline feature, so EN-source pages looking visibly worse than JP-source pages is a quality gap that shows up in demos.

## Solution

Give the renderer a **source-agnostic** line-break/layout path that produces tidy narrow columns from the **target space and the translated text**, never from the source's orientation — mirroring how MangaTranslator does it:

- **Width-squeeze**: try progressively narrower column widths (≈ ×0.90, up to a few steps) and only shrink the font once even the squeezed width won't fit — so a column becomes narrow-and-tall before it becomes small.
- **Optimal line breaking** (Knuth–Plass-style): choose break points that minimise raggedness for the *translated* text, language-aware (CJK kinsoku, Latin hyphenation), instead of greedy first-fit.
- **Fit to the target region/balloon**, not the source footprint.

Because the existing source-orientation reference is "good enough" for JP today and we are **not yet sure the new path is strictly better**, the new path ships **behind a flag, off by default (byte-identical when off)**, and is compared against the current behaviour with **A/B testing** on real pages before any switch of the default. The source-orientation reference stays in place as the baseline.

## User Stories

1. As a reader translating an English-source chapter to Thai, I want the translated text to form tidy narrow columns inside each balloon, so that the page reads as cleanly as a Japanese-source chapter.
2. As a reader, I want narration/caption blocks (outside balloons) to wrap into compact columns rather than spanning the whole panel, so that captions look intentional, not auto-generated.
3. As a reader, I want line breaks chosen to minimise ragged/awkward wrapping, so that no line is jarringly short or long next to its neighbours.
4. As a reader of any source language (JP, EN, KO, ZH), I want consistent layout quality, so that the product feels uniformly polished regardless of the original language.
5. As the developer, I want the new wrap path behind an opt-in flag that is byte-identical when off, so that enabling it never silently changes existing JP-source output until proven.
6. As the developer, I want to A/B render the same page with the source-orientation baseline vs the source-agnostic path, so that I can judge with my own eyes (and measured metrics) whether the new path is actually better before changing any default.
7. As the developer, I want the A/B comparison to run through the real backend render config (not a hand-written config), so that the test reflects production behaviour.
8. As the developer, I want the wrap-width and squeeze decisions to be pure, dependency-light functions, so that I can unit-test the layout logic in isolation in well under a second without loading the ML stack.
9. As the developer, I want the new path to reuse the existing balloon mask / region geometry already carried on each region, so that I don't add a new detection or data dependency.
10. As the developer, I want the source-orientation reference kept as the baseline path, so that I can fall back instantly if the A/B result is inconclusive or negative.
11. As the developer, I want the change scoped to the render/layout seam only, so that detection, OCR, inpainting, and translation are untouched.
12. As the developer, I want clear A/B acceptance criteria (e.g. EN-source narration forms columns; JP-source output unchanged when flag off; dialogue still fills balloons), so that "better" is decided against explicit checks, not vibes.
13. As a maintainer, I want the layout decision to be source-agnostic (no `if source is vertical` branching), so that the code has one path to maintain rather than per-orientation special-cases.
14. As a maintainer, I want target render-orientation (vertical vs horizontal of the *translated* text) to remain a separate concern decided by the translated text's aspect, so that the wrap-width fix doesn't entangle with vertical-text rendering.
15. As the developer, I want the work decomposed into thin vertical slices each demoable via a benchmark render, so that progress is verifiable page-by-page.
16. As the developer, I want the new path to compose with the existing bubble-area-fit and clean-layout paths rather than replace them wholesale, so that the proven dialogue-fills-balloon behaviour (#175) is preserved.
17. As the developer, I want documented A/B results (before/after images + metrics) attached to the issue, so that the default-switch decision is auditable later.
18. As a reader on a higher-resolution page, I want the narrow-column behaviour to scale with page resolution, so that columns aren't too narrow or too wide at 2× resolution.

## Implementation Decisions

- **Seam (preferred, highest, ideally one):** the pure render-geometry module that already houses `processing_scale`, `font_bounds`, `display_sfx`, `clamp_box_to_neighbors`, and `clean_wrap_width`. The new source-agnostic column-width derivation and the width-squeeze step are added there as **pure functions** (stdlib only, no ML/numpy/`self`), unit-tested in isolation. This is the same seam the #175 sizing primitives already use.
- **A/B toggle:** a new opt-in render config flag (e.g. `MIT_WRAP_SOURCE_AGNOSTIC` → `render.wrap_source_agnostic`), surfaced through the backend's single render-config builder so the Reader path and the direct-render benchmark share it. **Absent/false → byte-identical to today** (source-orientation reference preserved). The flag participates in the render-config hash so toggling it busts the per-page patch cache.
- **Baseline preserved:** the current `clean_wrap_width(source-bbox-width)` path remains the default. The new path is selected only when the flag is on.
- **Source-agnostic column width:** derive the wrap width from the **target balloon/region interior** (the geometry already tagged on each region via bubble segmentation), then apply **width-squeeze**: iteratively narrow the trial width (≈ ×0.90, bounded number of steps) choosing the narrowest width at which the translated text still fits the region height before reducing font size. No reference to source orientation or source-bbox width.
- **Optimal line breaking (#180):** wire the Knuth–Plass DP line-break module (badness = slack^exponent + hyphen penalty; CJK kinsoku; Latin midpoint-out hyphenation) as the wrapper used by the source-agnostic path, replacing greedy first-fit *within that path only*.
- **Compose with squeeze (#183):** reuse the squeeze-on-collision / pre-warp bounds work rather than re-implement.
- **Target orientation kept separate (#182):** whether the *translated* text renders vertically is decided by the translated text's aspect/fit (auto-orientation), independent of this wrap-width work.
- **Relationship to #432 (S4 unify):** this PRD's source-agnostic path is the concrete mechanism behind the "unify fit path" goal; #432 should reference this PRD (or be folded to depend on it).
- **No new detection/data dependency:** uses geometry already present on regions; does not add models, masks, or stages.

## Testing Decisions

- **What makes a good test here:** assert observable layout behaviour through the pure functions' public interface — given a region/balloon width, a translated string length, a page size, and a flag, the chosen column width / squeeze steps / break points are correct — not the internal iteration mechanics. Tests must survive refactors of the loop internals.
- **Unit (pure module):** the new column-width-derivation and width-squeeze functions, mirroring the existing prior art in the render-overlap test suite (`processing_scale`, `font_bounds`, `display_sfx`, `clean_wrap_width`, `clamp_box_to_neighbors` tests) — fast, no ML imports. Cover: narrow balloon → narrow column; wide caption box → squeezed-narrow column (the EN regression); flag off → identical to baseline `clean_wrap_width`; resolution scaling; degenerate tiny/huge widths clamped.
- **Line-break unit (#180):** Knuth–Plass break-point selection on representative strings (Latin with/without hyphenation, CJK kinsoku), asserting break positions, independent of the renderer.
- **Render regression net:** the existing golden/guard render suites must stay byte-identical with the flag off (proves opt-in safety).
- **A/B end-to-end (manual, documented):** render the same real page through the backend render config with the flag off vs on, on at least one EN-source page (Gal Yome no Himitsu EN ch1 p4) and one JP-source page (One-Punch benchmark). Acceptance: EN-source narration/dialogue forms tidy columns with the flag on; JP-source output unchanged with the flag off; dialogue still fills balloons; attach before/after images + a simple metric (e.g. mean line-width / column-aspect). This is a decision gate, not an automated assertion.

## Out of Scope

- Switching the default to the source-agnostic path — that is a follow-up decision gated on the A/B result; this PRD only ships it opt-in and produces the comparison.
- Target vertical-text rendering / per-character stacking (#182) beyond keeping it a separate, independent concern.
- Detection, OCR, inpainting, translation quality, SFX classification (#431), and the stylized-SFX-split residual.
- Removing or rewriting the existing `clean_wrap_width` source-orientation reference (kept as baseline).
- Non-MIT surfaces (frontend, backend other than the render-config flag passthrough).

## Further Notes

- Grounding: `docs/research/` — `translator-deep-dissection.md` ("Layout is pure algorithm — HarfBuzz + Skia + Knuth-Plass; ours FreeType + greedy"), `mangatranslator-internals.md` (Knuth-Plass DP `badness = slack³ + 1000·hyphen`), `render-parity-port-plan.md` (row C width-squeeze ×0.90 up-to-3×, row D KP DP), `mangatranslator-round2-deep.md` (auto-vertical from translated text aspect). MangaTranslator has **no** source-orientation branch — narrow columns come from squeeze + KP, source-agnostic.
- Engineering North Star alignment: prefer **removing** the source-dependency over **adding** a per-orientation branch — but gated behind A/B so we don't trade a known-OK baseline for an unproven path prematurely.
- Confirmed-finding context lives in memory `project_mit_175_dialogue_path.md` (residual #2 narration-wrap rw/bw discriminator, residual #3 EN-source wrap is JP-only). The rw/bw discriminator (dialogue ≈0.88–0.90 vs narration ≈0.40–0.59) is an alternative cheaper lever worth A/B-ing alongside the full source-agnostic path.
- `gh` API write currently returns 401 (Bad credentials) — re-auth needed to publish this PRD and the child issues.
