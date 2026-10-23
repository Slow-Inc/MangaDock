"""#980 follow-up: series-scoped character-name memory for the single-page production path.

Production translates one page per request, so a character name can be spelled differently on every page. The
Backend already sends a stable `translator.series_context` string (#157) — enough to key a small in-process LRU:
after a page is translated its name spellings are remembered for the series, and the next page of the same series
has them applied deterministically before rendering.

Opt-in (`MIT_SERIES_GLOSSARY=1`) because it changes output and can freeze an imperfect spelling for the whole
series — the same consistency-vs-correctness tradeoff the batch glossary carries.
"""
import hashlib
import os
from collections import Counter, OrderedDict

from .name_glossary import _THAI_RUN, apply_glossary, candidate_names, glossary_enabled

_MAX_SERIES = 32
_memory = OrderedDict()


def series_memory_enabled(env=None) -> bool:
    """True when MIT_SERIES_GLOSSARY is explicitly on (and the base glossary feature is enabled)."""
    value = str((env or os.environ).get('MIT_SERIES_GLOSSARY', '')).strip().lower()
    if not value or value in ('0', 'false', 'no', 'off'):
        return False
    return glossary_enabled(env)


def _key(series_context) -> str:
    return hashlib.sha1(str(series_context).encode('utf-8')).hexdigest()[:16]


def reset_memory() -> None:
    """Test hook: forget every remembered series."""
    _memory.clear()


def _mapping(item):
    if isinstance(item, dict):
        return (item.get('src') or ''), (item.get('dst') or '')
    return ((getattr(item, 'src', '') or getattr(item, 'text', '')),
            (getattr(item, 'dst', '') or getattr(item, 'translation', '')))


def _learn(regions, existing) -> dict:
    """Name -> spelling votes from one page; existing spellings always win.

    Only name-focused lines are used (a single candidate in the source and a translation whose Thai run is short,
    i.e. the line is mostly the name), so a clause that merely mentions the name cannot poison the memory.
    """
    glossary = dict(existing or {})
    votes = {}
    for item in regions or []:
        src, dst = _mapping(item)
        names = candidate_names([src])
        if len(names) != 1:
            continue
        name = names[0]
        if name in glossary:
            continue
        runs = [r for r in _THAI_RUN.findall(dst) if 3 <= len(r) <= 12]
        if not runs:
            continue
        spelling = min(runs, key=len)
        if len(dst) > len(spelling) + 6:
            continue
        votes.setdefault(name, Counter())[spelling] += 1
    for name, counter in votes.items():
        if name not in glossary:
            glossary[name] = counter.most_common(1)[0][0]
    return glossary


def remember_and_apply(regions, series_context) -> int:
    """Apply the series' remembered spellings to this page, then learn from it; returns fixes applied."""
    if not regions or not series_context:
        return 0
    key = _key(series_context)
    stored = _memory.get(key) or {}
    fixed = apply_glossary(regions, stored) if stored else 0
    merged = _learn(regions, stored)
    if merged:
        _memory[key] = merged
        _memory.move_to_end(key)
        while len(_memory) > _MAX_SERIES:
            _memory.popitem(last=False)
    return fixed
