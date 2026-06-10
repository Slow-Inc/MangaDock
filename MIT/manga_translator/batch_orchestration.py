"""Pure helpers for batch-mode translation (#187 seam S26a).

`translate_batch` runs a 3-phase pre/translate/post pipeline over many pages.
Two pieces of it are `self`-free and were duplicated/inlined: the placeholder
Context appended when a page fails pre-processing (so the page still flows through
post-processing as an empty result), and the per-page translation record appended
to TranslationMemory afterwards (the #136/#140 cross-page context, landmine L7).
They live here as plain functions so they can be golden-unit-tested without the
ML stack; the driver keeps the surrounding orchestration.
"""
from .utils import Context


def placeholder_context(image):
    """An empty Context standing in for a page that failed pre-processing.

    `text_regions` is initialized to [] so downstream phases skip it cleanly.
    """
    ctx = Context()
    ctx.input = image
    ctx.text_regions = []  # 确保text_regions被初始化为空列表
    return ctx


def build_page_translation_record(text_regions):
    """Build the per-page records appended to TranslationMemory after a batch.

    Returns ``(page_translations, page_original_texts)``:
    - ``page_translations``: ``{raw_text: translation}`` — fed as prior-page
      context to later pages.
    - ``page_original_texts``: ``{index: raw_text}`` — the originals kept for the
      concurrent mode's context.

    Raw text is ``region.text_raw`` when present, else ``region.text``.
    """
    page_translations = {r.text_raw if hasattr(r, "text_raw") else r.text: r.translation
                         for r in text_regions}
    page_original_texts = {i: (r.text_raw if hasattr(r, "text_raw") else r.text)
                           for i, r in enumerate(text_regions)}
    return page_translations, page_original_texts
