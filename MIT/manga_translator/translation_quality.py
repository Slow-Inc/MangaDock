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


#: #882 — Thai letter-name syllables. A translator that reads stylized art lettering as separate
#: letters spells them out ('Siiig' -> 'ซีไอไอ'), which renders as unreadable junk over the artwork.
#: The list is the standard Thai consonant/vowel/letter names a Thai speaker reads a Latin word with.
_THAI_LETTER_NAMES = tuple(
    'กอ ขอ คอ ฆอ งอ จอ ฉอ ชอ ซอ ฌอ ญอ ฎอ ฏอ ฐอ ฑอ ฒอ ณอ ดอ ตอ ถอ ทอ ธอ นอ บอ ปอ ผอ ฝอ พอ ฟอ ภอ มอ '
    'ยอ รอ ลอ วอ ศอ ษอ สอ หอ ฬอ ออ ฮอ เอ บี ซี ดี อี เอฟ จี เอช ไอ เจ เค แอล เอ็ม เอ็น โอ พี คิว '
    'อาร์ เอส ที ยู วี ดับเบิลยู เอ็กซ์ วาย แซด'.split()
)
_THAI_CHAR = re.compile(r'[\u0E00-\u0E7F]')
_ASCII_TOKEN = re.compile(r'^[A-Za-z]{4,10}$')
_REPEATED_CHAR = re.compile(r'(.)\1')


def _letter_name_count(thai: str):
    """How many letter-name syllables cover ``thai`` completely (None when they cannot).

    Dynamic programming because the names are not prefix-free ('เอ' vs 'เอฟ', 'เอส'): a greedy
    scan would either miss a valid split or count one syllable twice."""
    n = len(thai)
    best = [None] * (n + 1)
    best[0] = 0
    for i in range(n):
        if best[i] is None:
            continue
        for name in _THAI_LETTER_NAMES:
            if thai.startswith(name, i):
                j = i + len(name)
                cand = best[i] + 1
                if best[j] is None or cand > best[j]:
                    best[j] = cand
    return best[n]


def is_letter_name_spelling(source: str, translation: str) -> bool:
    """#882: True when a stylized-looking source token was translated by SPELLING it out in Thai
    letter names ('Siiig' -> 'ซีไอไอ').

    All four signals are needed, measured against the 39-page corpus (only the one real case passes;
    'SOR'->'ขอ...', 'OMG'->'โอเอ็มจี', 'OK'->'โอเค' are not flagged):

    - the translation is Thai-only and splits COMPLETELY into letter names, at least three of them;
    - the source is a single 4-10 letter ASCII token that is not all-caps (all-caps tokens are
      abbreviations, which legitimately get spelled: OMG, RTSD);
    - the source repeats a letter, the shape of a stylized-art read ('Siiig', 'Aaaah').
    """
    src = (source or '').strip()
    if not _ASCII_TOKEN.match(src) or src == src.upper() or not _REPEATED_CHAR.search(src):
        return False
    thai = ''.join(_THAI_CHAR.findall(translation or ''))
    if len(thai) < 3:
        return False
    return (_letter_name_count(thai) or 0) >= 3


#: #886 — a single CJK/Hangul glyph detected at ART scale. Detection often picks up one glyph of a
#: logo/title artwork (the rest of the lettering was never detected), so translating it replaces one
#: glyph of the logo and mangles it (the `月` of Tsuki's logo rendered as `เดือน`). Below this font
#: size the glyph is ordinary readable text and must be translated normally.
_ART_GLYPH_MIN_FONT = 100
_CJK_HANGUL = re.compile(r'[\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uAC00-\uD7AF]{1,2}')


def is_oversized_art_glyph(text: str, font_size: float, rescued: bool = False) -> bool:
    """#886: True for one or two CJK/Hangul glyphs at art scale (>=100 px source lettering).

    Such a region is a piece of a logo/title, not dialogue: keep the art instead of replacing a
    single glyph of it. A region the vision rescue already localized (``rescued``) is excluded —
    that IS the SFX path and it produced a target-language onomatopoeia; only when it could not
    serve is the glyph left as art."""
    s = (text or '').strip()
    if rescued or not s or not _CJK_HANGUL.fullmatch(s):
        return False
    return float(font_size or 0) >= _ART_GLYPH_MIN_FONT
