"""Cross-page translation memory (#187 seam S16, #136/#140).

Names the two cross-page lists that lived directly on the god object — the per-page
translated-sentence dicts (``all_page_translations``) and their parallel original-text
dicts (``original_page_texts``) — plus ``reset``. The append sites stay driven by the
caller (preserving the L7 per-mode asymmetry) and ``reset`` is still only called from
``translate_patches`` (the L9 asymmetry); this seam only makes the #136/#140 bleed
boundary an explicit object, byte-identical.
"""


class TranslationMemory:
    def __init__(self):
        self.all_page_translations = []
        self.original_page_texts = []

    def reset(self) -> None:
        """Drop the cross-page context by rebinding both lists to empty (verbatim the old
        ``reset_page_context`` — rebind, not ``.clear()``, so a caller holding an old list
        keeps its contents)."""
        self.all_page_translations = []
        self.original_page_texts = []
