"""#980 follow-up: series-scoped character-name memory for the single-page production path.

Production translates one page per request, so a character name can be spelled differently on every page. The
Backend sends a stable `translator.series_context` string (#157) — enough to key a small in-process LRU: after a page
is translated its name spellings are remembered for the (series, target language) pair, and the next page has them
applied deterministically before rendering.

Default ON (same consistency tradeoff the batch glossary already carries): set `MIT_SERIES_GLOSSARY=0` to disable,
and `MIT_NAME_GLOSSARY=0` disables it together with the base glossary. No series context -> no-op.
"""
import hashlib
import os
from collections import Counter, OrderedDict

from .name_glossary import _THAI_RUN, apply_glossary, candidate_names, glossary_enabled, learn_spellings

_MAX_SERIES = 32
_memory = OrderedDict()


def series_memory_enabled(env=None) -> bool:
    """Default ON; MIT_SERIES_GLOSSARY=0/false/off disables (and so does MIT_NAME_GLOSSARY=0)."""
    value = str((env or os.environ).get('MIT_SERIES_GLOSSARY', '')).strip().lower()
    if value in ('0', 'false', 'no', 'off'):
        return False
    return glossary_enabled(env)


def _key(series_context, to_lang) -> str:
    # Spellings are target-language specific: the same series translated to THA and ENG must not share memory.
    return hashlib.sha1(f'{to_lang}|{series_context}'.encode('utf-8')).hexdigest()[:16]


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
    # #1143: names that only ever appear inside full sentences never pass the name-focused gate above, so their
    # spelling drifted (measured: HAIMIYA as ไฮมิยะ / ฮาอิมิยะ). Vote from the name-bearing lines as well; an
    # exact name-focused vote still wins.
    for name, spelling in learn_spellings(regions).items():
        votes.setdefault(name, Counter())[spelling] += 1
    for name, counter in votes.items():
        if name not in glossary:
            glossary[name] = counter.most_common(1)[0][0]
    return glossary


def remember_and_apply(regions, series_context, to_lang='') -> int:
    """Apply the series' remembered spellings to this page, then learn from it; returns fixes applied."""
    if not regions or not series_context:
        return 0
    key = _key(series_context, to_lang)
    stored = _memory.get(key) or {}
    fixed = apply_glossary(regions, stored) if stored else 0
    merged = _learn(regions, stored)
    if merged:
        _memory[key] = merged
        _memory.move_to_end(key)
        while len(_memory) > _MAX_SERIES:
            _memory.popitem(last=False)
    return fixed
