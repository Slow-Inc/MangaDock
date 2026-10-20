"""Judge-free translation glitch detection (quality loop, 2026-10-20). Pure, torch-free.

An LLM translator sometimes leaks another script into the target ('Чит', '甚至连', '체인' inside
Thai), leaves a segment untranslated, or returns it empty — measured at random across every
prompt tried on 17 real pages. All three are countable, so the translator can re-ask
(`custom_openai`) and Pipeline Doctor / the A/B harness can report them.
"""
import re
from typing import Optional

from .utils.lang_ratio import _SCRIPT_RANGES

_ALL_SCRIPTS = tuple({r for ranges in _SCRIPT_RANGES.values() for r in ranges})
#: '・' (U+30FB) and 'ー' (U+30FC) sit in the kana block but are punctuation that legitimately
#: survives into other languages.
_NEUTRAL = {0x30FB, 0x30FC}
_REAL_WORD = re.compile(r'[A-Za-z]{4,}')


def _scripts(text: str) -> set:
    return {r for cp in map(ord, text or '') if cp not in _NEUTRAL for r in _ALL_SCRIPTS
            if r[0] <= cp <= r[1]}


def foreign_script(text: str, target: str, source: str = '') -> bool:
    """True when ``text`` uses a non-Latin script that is neither the target's nor one the
    ``source`` already uses (a kana SFX the prompt says to keep is copied, not leaked). Latin
    targets are never checked: their output legitimately carries names and SFX in any script."""
    own = _SCRIPT_RANGES.get(target)
    if own is None:
        return False
    return bool(_scripts(text) - set(own) - _scripts(source))


def classify_glitch(src: str, dst: str, target: str) -> Optional[str]:
    """'empty', 'untranslated' (identical to a source holding a real word), 'foreign_script',
    or None for a segment that looks translated."""
    d = (dst or '').strip()
    if not d:
        return 'empty'
    if d.upper() == (src or '').strip().upper() and _REAL_WORD.search(d):
        return 'untranslated'
    if foreign_script(d, target, src):
        return 'foreign_script'
    return None
