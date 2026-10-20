"""Judge-free translation glitch detection (quality loop, 2026-10-20). Pure, torch-free.

An LLM translator sometimes leaks another script into the target ('Чит', '甚至连', '체인' inside
Thai), leaves a segment untranslated, or returns it empty — measured at random across every
prompt tried on 17 real pages. All three are countable, so the translator can re-ask
(`custom_openai`) and Pipeline Doctor can report them.
"""
import re
from typing import List

#: Script ranges per target language code. Kana stops at U+30FA: '・' (U+30FB) and 'ー' (U+30FC)
#: are punctuation that legitimately survive into other languages.
_SCRIPTS = {
    'THA': '\u0E00-\u0E7F', 'RUS': '\u0400-\u04FF', 'UKR': '\u0400-\u04FF',
    'KOR': '\uAC00-\uD7AF\u1100-\u11FF', 'JPN': '\u3040-\u30FA\u4E00-\u9FFF',
    'CHS': '\u4E00-\u9FFF', 'CHT': '\u4E00-\u9FFF', 'ARA': '\u0600-\u06FF',
}
_ALL_SCRIPTS = re.compile('[\u0E00-\u0E7F\u0400-\u04FF\uAC00-\uD7AF\u1100-\u11FF'
                          '\u3040-\u30FA\u4E00-\u9FFF\u0600-\u06FF]')
_REAL_WORD = re.compile(r'[A-Za-z]{4,}')


def foreign_script(text: str, target: str) -> bool:
    """True when ``text`` uses a script that is neither the target's nor Latin."""
    own = _SCRIPTS.get(target)
    if own is None:
        return False
    return bool(_ALL_SCRIPTS.search(re.sub(f'[{own}]', '', text or '')))


def glitch_score(sources: List[str], outputs: List[str], target: str) -> int:
    """Segments that are empty, left untranslated (identical to a source with a real word),
    or leak a foreign script."""
    score = 0
    for src, dst in zip(sources, outputs):
        d = (dst or '').strip()
        if not d:
            score += 1
        elif d.upper() == (src or '').strip().upper() and _REAL_WORD.search(d):
            score += 1
        elif foreign_script(d, target):
            score += 1
    return score
