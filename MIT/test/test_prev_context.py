"""Previous-context string builder (#187 seam S6).

`build_prev_context(all_page_translations, original_page_texts, context_size, *,
use_original_text, current_page_index, batch_index, batch_original_texts) -> str` is the
pure extraction of `MangaTranslator._build_prev_context` — the per-mode index policy
(single / current_page_index slice / concurrent batch append) becomes explicit args
instead of implicit self-state. Preserves the L7 quirks verbatim: the concurrent
`available_pages.index(page)` **first-match** when mapping a translated page back to its
original, and the `pages_used == 0 -> ""` short-circuit.

A "page" is a dict of {key: sentence}. The output format is
`Here are the previous {translation results|original text} for reference:` followed by
`<|n|>sentence` lines.
"""
from manga_translator.prev_context import build_prev_context


def _page(*sentences):
    return {str(i): s for i, s in enumerate(sentences)}


def test_numbered_translation_results_in_order():
    pages = [_page('a1', 'a2'), _page('b1')]
    out = build_prev_context(pages, [], 5)
    assert out == (
        "Here are the previous translation results for reference:\n"
        "<|1|>a1\n<|2|>a2\n<|3|>b1"
    )


def test_context_size_non_positive_returns_empty():
    assert build_prev_context([_page('x')], [], 0) == ""
    assert build_prev_context([_page('x')], [], -1) == ""


def test_no_pages_returns_empty():
    assert build_prev_context([], [], 5) == ""


def test_blank_pages_skipped_and_context_size_caps_tail():
    pages = [_page('keep1'), _page('  ', ''), _page('keep2'), _page('keep3')]
    # non_empty = [keep1, keep2, keep3]; context_size 2 -> tail = last 2
    out = build_prev_context(pages, [], 2)
    assert out == (
        "Here are the previous translation results for reference:\n"
        "<|1|>keep2\n<|2|>keep3"
    )


def test_all_blank_pages_returns_empty():
    assert build_prev_context([_page(''), _page('   ')], [], 5) == ""


def test_current_page_index_slices_pages_before_it():
    pages = [_page('p0'), _page('p1'), _page('p2')]
    out = build_prev_context(pages, [], 5, current_page_index=2)  # pages[:2]
    assert out == (
        "Here are the previous translation results for reference:\n"
        "<|1|>p0\n<|2|>p1"
    )


def test_use_original_text_pulls_from_parallel_original_store():
    translated = [_page('T-a'), _page('T-b')]
    originals = [_page('O-a'), _page('O-b')]
    out = build_prev_context(translated, originals, 5, use_original_text=True)
    assert out == (
        "Here are the previous original text for reference:\n"
        "<|1|>O-a\n<|2|>O-b"
    )


def test_duplicate_content_pages_map_original_via_first_match_L7():
    # two translated pages with IDENTICAL content; available_pages.index() returns the
    # FIRST, so BOTH map to originals[0] — the L7 first-match quirk, preserved verbatim
    translated = [_page('same'), _page('same')]
    originals = [_page('ORIG-0'), _page('ORIG-1')]
    out = build_prev_context(translated, originals, 5, use_original_text=True)
    assert out == (
        "Here are the previous original text for reference:\n"
        "<|1|>ORIG-0\n<|2|>ORIG-0"
    )


def test_use_original_text_falls_back_to_translations_when_no_originals():
    out = build_prev_context([_page('T0')], [], 5, use_original_text=True)
    # original_page_texts empty -> original_lines empty -> lines stays = translated
    assert out == "Here are the previous original text for reference:\n<|1|>T0"


def test_concurrent_appends_prior_batch_pages_when_using_original_text():
    done = [_page('done0')]
    batch_orig = [_page('bo0'), _page('bo1')]
    # batch_index=1 -> append batch_orig[0] only; use_original_text=True
    out = build_prev_context(done, [], 5, use_original_text=True,
                             batch_index=1, batch_original_texts=batch_orig)
    # available = [done0, bo0]; originals empty -> fall back to those page sentences
    assert out == (
        "Here are the previous original text for reference:\n"
        "<|1|>done0\n<|2|>bo0"
    )


def test_concurrent_without_original_text_does_not_append_batch():
    done = [_page('done0')]
    batch_orig = [_page('bo0'), _page('bo1')]
    # use_original_text=False -> the `pass` branch -> batch pages NOT appended
    out = build_prev_context(done, [], 5, use_original_text=False,
                             batch_index=2, batch_original_texts=batch_orig)
    assert out == "Here are the previous translation results for reference:\n<|1|>done0"
