"""Context-carry page accounting (#187 seam S7).

Folds the identical block that single dispatch (``_dispatch_with_context``) and
concurrent dispatch (``_batch_translate_texts``) each ran to decide how many recent
non-empty pages to carry as context and how many expected pages were skipped for having
no sentences — so the logged ``Carrying N`` / ``Skipped N`` numbers can never disagree
between the two paths.
"""
from typing import List, Tuple


def context_page_counts(context_size: int, done_pages: List[dict]) -> Tuple[int, int]:
    """Return ``(pages_used, skipped)`` — how many recent non-empty pages will be
    carried as context, and how many of the expected pages were skipped for having no
    sentences. A page is non-empty iff any of its sentences is non-blank. Verbatim the
    original accounting (both counts capped at ``context_size``)."""
    if context_size > 0 and done_pages:
        pages_expected = min(context_size, len(done_pages))
        non_empty_pages = [
            page for page in done_pages
            if any(sent.strip() for sent in page.values())
        ]
        pages_used = min(context_size, len(non_empty_pages))
        skipped = pages_expected - pages_used
    else:
        pages_used = skipped = 0
    return pages_used, skipped
