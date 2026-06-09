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
    """Return the regions to keep after translation; logs each filtered one (when its
    translation is non-blank) with the reason, exactly as the inline block did."""
    new_text_regions = []
    for region in text_regions:
        should_filter = False
        filter_reason = ""

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
            if region.translation.strip():
                logger.info(f'Filtered out: {region.translation}')
                logger.info(f'Reason: {filter_reason}')
        else:
            new_text_regions.append(region)

    return new_text_regions
