"""Assign translations to text regions (#187 seam S2).

The happy-path "assign each translated sentence to its region + stamp
target_lang / alignment / direction" loop was duplicated in four MangaTranslator
paths (single / batch-memory-fallback / batch / concurrent); the render-casing
logic appeared a fifth time in the retry path; and an error-fallback "use the
source text as its own translation" loop appeared in three more. Extracting these
collapses the drift surfaces into one tested place. Behaviour preserved verbatim,
including the L10 ``zip``-truncation invariant and the uppercase/lowercase casing.
"""
from typing import List


def apply_render_casing(region, config) -> None:
    """Apply ``render.uppercase`` / ``render.lowercase`` to ``region.translation`` in
    place (the retry path re-cases an already-assigned translation)."""
    if config.render.uppercase:
        region.translation = region.translation.upper()
    elif config.render.lowercase:
        region.translation = region.translation.lower()


def apply_translations(text_regions: List, translations: List, config,
                       *, apply_casing: bool = False) -> int:
    """Assign each translated sentence to its region (``zip``-truncated, preserving
    the L10 invariant: a short ``translations`` leaves trailing regions untouched),
    stamping ``target_lang`` / ``_alignment`` / ``_direction``. When ``apply_casing``
    is set, render uppercase/lowercase is applied (the single-page path does this;
    batch/concurrent/memory-fallback do not). Returns the number of regions assigned
    (== translations consumed), so a caller threading a shared index across contexts
    can advance it."""
    count = 0
    for region, translation in zip(text_regions, translations):
        region.translation = translation
        region.target_lang = config.translator.target_lang
        region._alignment = config.render.alignment
        region._direction = config.render.direction
        if apply_casing:
            apply_render_casing(region, config)
        count += 1
    return count


def apply_original_as_translation(text_regions: List, config) -> None:
    """Error-fallback: keep each region's own source text as its translation, stamping
    the same ``target_lang`` / ``_alignment`` / ``_direction``. No casing, no
    truncation — every region is touched."""
    for region in text_regions:
        region.translation = region.text
        region.target_lang = config.translator.target_lang
        region._alignment = config.render.alignment
        region._direction = config.render.direction
