"""Rolling cross-page translation context (#159, PRD #155 / P2).

The accumulator is the Batch Job's local memory of recent pages' dialogue: pages are
added in order, and `render_block` emits the upstream numbered `<|n|>sentence` block
for the next page's prompt — bounded by a page-count cap (`max_pages`, 0 disables) and
a character cap (so the local tokenizer never truncates the real queries). Pure: no ML
imports, no `self`/worker state — born and dies with the batch loop.
"""
from server.rolling_context import RollingContext


def test_renders_numbered_block_in_page_order():
    rc = RollingContext(max_pages=5, max_chars=10_000)
    rc.add_page(['Hello', 'World'])
    rc.add_page(['Foo'])
    block = rc.render_block()
    assert block == (
        'Here are the previous translation results for reference:\n'
        '<|1|>Hello\n<|2|>World\n<|3|>Foo'
    )


def test_empty_or_disabled_renders_nothing():
    assert RollingContext(max_pages=5, max_chars=10_000).render_block() == ''      # no pages
    off = RollingContext(max_pages=0, max_chars=10_000)
    off.add_page(['Hello'])
    assert off.render_block() == ''                                                # max_pages 0 → disabled


def test_page_cap_keeps_only_the_most_recent_pages():
    rc = RollingContext(max_pages=2, max_chars=10_000)
    rc.add_page(['p1'])
    rc.add_page(['p2'])
    rc.add_page(['p3'])
    block = rc.render_block()
    assert 'p1' not in block                                                       # oldest page dropped
    assert block == (
        'Here are the previous translation results for reference:\n'
        '<|1|>p2\n<|2|>p3'
    )


def test_char_cap_drops_oldest_lines_keeping_recent_context():
    rc = RollingContext(max_pages=10, max_chars=12)
    rc.add_page(['aaaaa', 'bbbbb', 'ccccc'])     # 3 × 5 chars; cap 12 keeps the last 2
    block = rc.render_block()
    assert 'aaaaa' not in block                                                    # oldest line dropped
    assert block == (
        'Here are the previous translation results for reference:\n'
        '<|1|>bbbbb\n<|2|>ccccc'
    )


def test_blank_sentences_are_ignored():
    rc = RollingContext(max_pages=5, max_chars=10_000)
    rc.add_page(['  ', '', 'real'])
    rc.add_page([])                              # an all-blank page contributes nothing
    assert rc.render_block() == (
        'Here are the previous translation results for reference:\n<|1|>real'
    )
