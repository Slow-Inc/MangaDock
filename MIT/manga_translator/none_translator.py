"""None-translator front-matter guards (#187 seam S9).

Two landmine-bearing pieces of ``_run_text_translation``'s front-matter, named and
documented so they can be tested in isolation. The call site preserves the exact order
(override → ``tracker.touch`` → if-none stamp + return-all).
"""
from .config import Translator


def apply_prep_manual_override(config, prep_manual) -> None:
    """**L12** — when ``prep_manual`` is set, force the translator to ``none`` (to avoid
    token waste) by mutating ``config.translator.translator`` **in place**. Preserved
    verbatim; this poisons a reused ``Config`` by design, it is not "fixed" here."""
    if prep_manual:
        config.translator.translator = Translator.none


def stamp_none_translations(text_regions, config) -> None:
    """**L3** — the none-translator path: blank every region's translation (empty
    translations create blank areas) and stamp ``target_lang`` / ``_alignment`` /
    ``_direction``. The caller then returns **all** regions unfiltered — the asymmetry
    vs the filtered normal path."""
    for region in text_regions:
        region.translation = ""
        region.target_lang = config.translator.target_lang
        region._alignment = config.render.alignment
        region._direction = config.render.direction
