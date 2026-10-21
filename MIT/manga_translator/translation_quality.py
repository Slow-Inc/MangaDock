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


# OCR noise seen on English lettering: Hangul for a misread 'I', box drawing / geometric shapes for
# speckles. A denylist: real symbols ('€', '×', '→', '©', '½', emoji) and names in other scripts stay.
_NOISE_GLYPHS = re.compile(r'^[ᄀ-ᇿ㄰-㆏가-힯─-◿]+$')


# Katakana OCR reads in place of a Latin letter inside an English word (Horimiya p0: STRANGEレY).
_KANA_LOOKALIKES = {'レ': 'L', 'ロ': 'O', 'エ': 'E'}


def _fix_lookalikes(token: str) -> str:
    """Map look-alike katakana back to Latin inside a token that also has Latin letters and no other
    non-Latin letter; a Japanese word (no Latin letters) is left alone."""
    if not any(c.isascii() and c.isalpha() for c in token):
        return token
    if any(c.isalpha() and not c.isascii() and c not in _KANA_LOOKALIKES for c in token):
        return token
    return ''.join(_KANA_LOOKALIKES.get(c, c) for c in token)


def strip_noise_glyphs(text: str) -> str:
    """#857: clean OCR noise on Latin lettering before it is translated — look-alike katakana inside an
    English word go back to Latin ('STRANGEレY' -> 'STRANGELY'), and whitespace tokens made only of
    OCR-noise glyphs ('피' for a lone 'I', '╩', '○') are dropped when the text is mostly Latin letters.
    Kept as-is, the LLM was thrown off ('피 WONDER WHY..' -> 'เพราะ WONDER') or transliterated the
    glyph. Thai/CJK text is returned unchanged."""
    if not text:
        return text
    tokens = text.split()
    fixed = [_fix_lookalikes(t) for t in tokens]
    letters = [c for c in ''.join(fixed) if c.isalpha()]
    if letters and sum(c.isascii() for c in letters) / len(letters) > 0.85:
        fixed = [t for t in fixed if not _NOISE_GLYPHS.match(t)]
    return text if fixed == tokens else ' '.join(fixed)
