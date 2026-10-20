"""Judge-free translation glitch detection (quality loop, 2026-10-20). Pure, torch-free.

An LLM translator sometimes leaks another script into the target ('Чит', '甚至连', '체인' inside
Thai), leaves a segment untranslated, or returns it empty — measured at random across every
prompt tried on 17 real pages. All three are countable, so the translator can re-ask
(`custom_openai`) and Pipeline Doctor / the A/B harness can report them.
"""
import re
from typing import Optional

from .utils.lang_ratio import _SCRIPT_RANGES, _in_ranges

_ALL_SCRIPTS = tuple({r for ranges in _SCRIPT_RANGES.values() for r in ranges})
#: '・' (U+30FB) and 'ー' (U+30FC) sit in the kana block but are punctuation that legitimately
#: survives into other languages.
_NEUTRAL = {0x30FB, 0x30FC}
_REAL_WORD = re.compile(r'[A-Za-z]{4,}')


def foreign_script(text: str, target: str) -> bool:
    """True when ``text`` uses a script that is neither the target's nor Latin."""
    own = _SCRIPT_RANGES.get(target)
    if own is None:
        return False
    return any(cp not in _NEUTRAL and not _in_ranges(cp, own) and _in_ranges(cp, _ALL_SCRIPTS)
               for cp in map(ord, text or ''))


def classify_glitch(src: str, dst: str, target: str) -> Optional[str]:
    """'empty', 'untranslated' (identical to a source holding a real word), 'foreign_script',
    or None for a segment that looks translated."""
    d = (dst or '').strip()
    if not d:
        return 'empty'
    if d.upper() == (src or '').strip().upper() and _REAL_WORD.search(d):
        return 'untranslated'
    if foreign_script(d, target):
        return 'foreign_script'
    return None
