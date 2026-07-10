"""Post-translation region filtering (#187 seam S1).

Drop regions whose translation is unusable — blank, numeric, matches the configured
`re_filter_text`, or is identical to the source. This block was duplicated
verbatim-identically in three MangaTranslator paths (single / batch / concurrent);
extracting it collapses the three drift surfaces into one tested function. Verbatim
logic, including the `none` (only-blank-filtered) and `original` (no identical-check)
carve-outs.
"""
import logging
from typing import List

import regex as re

from .config import Translator

logger = logging.getLogger('manga_translator')


def filter_translated_regions(text_regions: List, config) -> list:
    """Return the regions to keep after translation. Kept behavior byte-identical;
    delegates to :func:`filter_translated_regions_with_drops` (#535 Phase-0a)."""
    kept, _ = filter_translated_regions_with_drops(text_regions, config)
    return kept


def filter_translated_regions_with_drops(text_regions: List, config):
    """#535 Phase-0a drop telemetry: like :func:`filter_translated_regions` but also
    returns ``dropped`` as ``[(region, reason), …]`` and logs EVERY drop — including
    blank translations, which the legacy logger silently skipped. A dropped region's
    text can still be erased by a patch's refined inpaint mask (the empty-white-bubble
    defect), so downstream needs the full drop list, not just the survivors."""
    new_text_regions = []
    dropped = []
    for region in text_regions:
        should_filter = False
        filter_reason = ""

        # #168: a vision-OCR-rescued SFX carries text == translation (both the English
        # onomatopoeia, e.g. "LOOM"), which would trip the identical-to-source drop
        # below. Keep it as long as it has something to render, so the localized SFX
        # survives and its detection mask inpaints the original art.
        if getattr(region, 'sfx_rescued', False):
            if region.translation.strip():
                new_text_regions.append(region)
            else:
                filter_reason = "Translation contain blank areas"
                dropped.append((region, filter_reason))
                _log_drop(region, filter_reason)
            continue

        if not region.translation.strip():
            should_filter = True
            filter_reason = "Translation contain blank areas"
        elif config.translator.translator != Translator.none:
            if region.translation.isnumeric():
                should_filter = True
                filter_reason = "Numeric translation"
            elif config.filter_text and re.search(config.re_filter_text, region.translation):
                should_filter = True
                filter_reason = f"Matched filter text: {config.filter_text}"
            elif not config.translator.translator == Translator.original:
                text_equal = region.text.lower().strip() == region.translation.lower().strip()
                if text_equal:
                    should_filter = True
                    filter_reason = "Translation identical to original"

        if should_filter:
            dropped.append((region, filter_reason))
            _log_drop(region, filter_reason)
        else:
            new_text_regions.append(region)

    return new_text_regions, dropped


def _log_drop(region, reason: str) -> None:
    """One diagnosable line per dropped region: reason + box + source-text head."""
    xyxy = getattr(region, 'xyxy', None)
    src = (getattr(region, 'text', '') or '')[:40]
    dst = (region.translation or '')[:40]
    logger.info(f"[RegionDrop] reason={reason!r} xyxy={xyxy} src={src!r} dst={dst!r}")
