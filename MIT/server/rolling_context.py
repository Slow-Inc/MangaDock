"""Rolling cross-page translation context for a Batch Job (#159, PRD #155 / P2).

The Translation Session of #140 realised as the batch loop's local state: each page's
translated dialogue is accumulated, and the next page's prompt is seeded with the recent
pages' lines as the upstream numbered ``<|n|>sentence`` block. Bounded by:

- ``max_pages`` — how many recent pages to carry; ``0`` disables (render is always ``""``,
  so the batch path is byte-identical to today).
- ``max_chars`` — a character cap on the rendered block so the local tokenizer never
  truncates the actual per-page queries; when over, the oldest lines are dropped first.

Import-light (stdlib only), no ML / ``self`` / worker state — born and dies with the
batch loop, so the #136 cross-job bleed class stays structurally impossible.
"""
from typing import Iterable, List

_HEADER = 'Here are the previous translation results for reference:\n'


class RollingContext:
    def __init__(self, max_pages: int, max_chars: int):
        self.max_pages = int(max_pages)
        self.max_chars = int(max_chars)
        self._pages: List[List[str]] = []

    def add_page(self, sentences: Iterable[str]) -> None:
        """Append one page's translated sentences (blanks dropped). An all-blank page
        contributes nothing. Page-count cap is enforced on render, not here, so the
        full history stays available if the cap is later widened."""
        clean = [s.strip() for s in (sentences or []) if s and s.strip()]
        if clean:
            self._pages.append(clean)

    def render_block(self) -> str:
        """Emit the numbered reference block from the most recent pages, or ``""`` when
        disabled / empty. Applies the page cap, then the character cap (oldest-first)."""
        if self.max_pages <= 0 or not self._pages:
            return ''

        pages = self._pages[-self.max_pages:]
        lines = [s for page in pages for s in page]
        if not lines:
            return ''

        if self.max_chars > 0:
            kept: List[str] = []
            total = 0
            for s in reversed(lines):                 # newest first
                if kept and total + len(s) > self.max_chars:
                    break
                kept.append(s)
                total += len(s)
            lines = list(reversed(kept))

        numbered = '\n'.join(f'<|{i + 1}|>{s}' for i, s in enumerate(lines))
        return _HEADER + numbered
