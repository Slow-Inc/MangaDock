"""Context-carry page accounting (#187 seam S7).

`context_page_counts(context_size, done_pages) -> (pages_used, skipped)` folds the
identical block that single dispatch (`_dispatch_with_context`) and concurrent dispatch
(`_batch_translate_texts`) each ran to decide how many recent non-empty pages to carry
as context and how many expected pages were skipped for having no sentences — so the
logged `Carrying N` / `Skipped N` numbers can never disagree between the two paths.

A "page" is a dict of sentences; it is non-empty iff `any(sent.strip() for sent in
page.values())`.
"""
from manga_translator.context_counts import context_page_counts


def _page(*sentences):
    return {str(i): s for i, s in enumerate(sentences)}


def test_context_size_zero_uses_no_pages():
    assert context_page_counts(0, [_page('x'), _page('y')]) == (0, 0)


def test_no_done_pages_uses_nothing():
    assert context_page_counts(5, []) == (0, 0)


def test_all_non_empty_under_budget_uses_all_none_skipped():
    # context_size 5 > 2 pages, both non-empty → use 2, skip 0
    assert context_page_counts(5, [_page('x'), _page('y')]) == (2, 0)


def test_blank_pages_are_skipped():
    # one all-blank page → expected min(5,3)=3, non_empty=2, used=2, skipped=1
    pages = [_page('x'), _page('   ', ''), _page('z')]
    assert context_page_counts(5, pages) == (2, 1)


def test_budget_caps_both_counts_so_an_empty_page_is_not_skipped():
    # context_size 2 < pages; expected=min(2,4)=2, non_empty=3, used=min(2,3)=2,
    # skipped=2-2=0 — the blank page falls outside the budget, so it is NOT counted skipped
    pages = [_page('x'), _page('  '), _page('z'), _page('w')]
    assert context_page_counts(2, pages) == (2, 0)


def test_budget_above_non_empty_count_skips_the_remainder():
    # context_size 3; expected=min(3,4)=3, non_empty=2, used=min(3,2)=2, skipped=1
    pages = [_page('x'), _page(''), _page(''), _page('w')]
    assert context_page_counts(3, pages) == (2, 1)


def test_page_is_empty_only_when_every_sentence_is_blank():
    # a page with one blank + one real sentence is non-empty
    assert context_page_counts(5, [_page('', 'real')]) == (1, 0)
