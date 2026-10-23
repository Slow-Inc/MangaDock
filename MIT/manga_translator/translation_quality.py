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


#: #889 — Thai combining marks, in the order a shaper expects them: above/below vowels first, then
#: tone marks. Unicode canonical ordering puts vowels (ccc 103) before tones (ccc 107); the model
#: occasionally emits the reverse ('ท่ี'), which no shaper can render.
_THAI_TONES = frozenset('\u0E48\u0E49\u0E4A\u0E4B')
_THAI_MARKS = frozenset('\u0E31\u0E34\u0E35\u0E36\u0E37\u0E38\u0E39\u0E47') | _THAI_TONES


def normalize_thai_marks(text: str) -> str:
    """Put Thai combining marks into canonical order and drop an exact duplicate in one cluster.

    Only runs of combining marks that follow a base character are touched: vowels keep their relative
    order and move before the tone marks ('ท่ี' -> 'ที่'); an exactly repeated mark in the same cluster is
    dropped ('ก้้' -> 'ก้'). Everything else (Latin, other scripts, spacing vowels like 'ำ') is untouched.
    Pure."""
    if not text or not any(ch in _THAI_MARKS for ch in text):
        return text
    out = []
    run = []

    def flush():
        if not run:
            return
        ordered = [c for c in run if c not in _THAI_TONES] + [c for c in run if c in _THAI_TONES]
        deduped = []
        for mark in ordered:
            if not deduped or deduped[-1] != mark:
                deduped.append(mark)
        out.extend(deduped)
        run.clear()

    for ch in text:
        if ch in _THAI_MARKS:
            run.append(ch)
        else:
            flush()
            out.append(ch)
    flush()
    return ''.join(out)


#: #898 — a Japanese clausal negation (measured on the real JP->TH path: 可愛くない came out as น่ารักดีนะ in
#: 2 of 4 runs). Clause-final forms only: a bare ず/ぬ would match ordinary words like まず/はず.
_JA_NEGATION = re.compile(r'(ない|ません|なかった|なかっ|じゃない|ではない|ありません|ないで|なくて|なく|ずに|まい)')
_THAI_NEGATION = re.compile(r'(ไม่|ไม่ได้|ไม่ใช่|อย่า|ห้าม|ไม่เคย|มิได้|ไร้)')
_JA_CHARS = re.compile(r'[\u3040-\u30FF\u4E00-\u9FFF]')


def negation_lost(src: str, dst: str, target: str = 'THA') -> bool:
    """True when a JAPANESE source has a clausal negation and the Thai output has none (#898).

    Only Japanese-source segments are checked on purpose: the EN->TH path legitimately loses the word in
    idioms ("like there's no tomorrow" -> ราวกับวันสุดท้ายของชีวิต — corpus scan: 1/372 regions, that idiom).
    A hit makes the translator's existing re-ask loop ask the segment again, so the cost of a false
    positive is one retry, not a wrong page."""
    s, d = (src or ''), (dst or '')
    if not s or not d:
        return False
    if not _JA_CHARS.search(s) or not _THAI_CHAR.search(d):
        return False
    if not _JA_NEGATION.search(s):
        return False
    return not _THAI_NEGATION.search(d)


#: #901: a repetition loop cycles a short pattern, so the consecutive-repeat check misses it. No faithful
#: translation of a short line is thousands of characters: longer than 3x the source AND over 120 chars.
_RUNAWAY_MIN_LEN = 120
_RUNAWAY_RATIO = 3.0


def runaway_translation(src: str, dst: str) -> bool:
    """True when dst is far too long to be a translation of src (#901).

    Observed on real EN->TH output: YOU WERE SPOT ON, GOD- MOTHER! came back as 4,462 characters of a
    cycling phrase, and check_repetition_hallucination (consecutive repeats only) passed it. A runaway
    length is the cheap, source-anchored signal that catches it without flagging normal dialogue.
    """
    s, d = (src or '').strip(), (dst or '').strip()
    if len(d) < _RUNAWAY_MIN_LEN:
        return False
    if not s:
        return False
    return len(d) > _RUNAWAY_RATIO * len(s)


#: #903: scripts that leaked into the output while absent from the source (the model transliterated the name
#: Tsukuyomi into Cyrillic: ЦУКУ + Thai โยมิ). Ordered most-specific first.
_LEAKED_SCRIPT_RANGES = (
    ('cyrillic', re.compile(r'[\u0400-\u04FF]')),
    ('hangul', re.compile(r'[\uAC00-\uD7AF\u1100-\u11FF]')),
    ('cjk', re.compile(r'[\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF]')),
)


def leaked_script(trans: str, query: str) -> str | None:
    """Name of a script present in the output but not in the source (#903), else None."""
    t, q = (trans or ''), (query or '')
    for name, rx in _LEAKED_SCRIPT_RANGES:
        if rx.search(t) and not rx.search(q):
            return name
    return None


#: English source words that legitimately license a Thai endurance verb (ทน).

_ENDURE_WORDS = ("ENDURE", "ENDURED", "BEAR", "BEARS", "BORE", "STAND", "STOOD", "TOLERATE", "TOLERATED",
                 "SUFFER", "SUFFERED", "TOLERANCE", "PUT UP WITH", "TAKE IT", "HANDLE IT")
#: Only clearly broken shapes: a name/pronoun glued to ทน followed by an object-ish verb, or a bare "pronoun + ทน + verb". "ทนไม่ได้" (cannot bear to) and "ทนไม่ไหว" are natural Thai idioms and are NOT flagged.
_THAI_TOLERANCE = re.compile(r"(ฉันทน(?!ที|ไม่|ได|ทาน)(?=[ก-๙])|เธอทน(?!ที|ไม่|ได|ทาน)(?=[ก-๙])|เราทน(?!ที|ไม่|ได|ทาน)(?=[ก-๙])|ข้าทน(?!ที|ไม่|ได|ทาน)(?=[ก-๙])|ทน(?:ฟัง|ดู|อยู่|มานาน|มาแล้ว)(?=[ก-๙]?))")
_THAI_NOT_IN_TIME = re.compile(r"(?:ฉัน|เธอ|เรา|ข้า|แก|คุณ)ทัน(?!ที)(?=[\u0E01-\u0E2E])")
_TIME_WORDS = ("IN TIME", "ON TIME", "JUST IN TIME", "TIMELY", "BEFORE IT", "IN THE NICK OF TIME")


def spurious_filler(dst: str, query: str) -> bool:
    """True when the Thai adds a filler word the source never said (hallucinated ทน / ทัน).

    Same class as #1039: the model inserts seemly little words that make the sentence ungrammatical.
    """
    # the licence check reads English words, so it must not run on a non-Latin source (a JP line that
    # really says 我慢 would otherwise be flagged as an invented filler).
    src_text = query or ''
    if not re.search(r'[A-Za-z]', src_text) or re.search(r'[\u3040-\u30FF\u4E00-\u9FFF]', src_text):
        return False
    if spurious_tolerance(dst, query):
        return True
    if not dst or not _THAI_NOT_IN_TIME.search(dst):
        return False
    src = (query or '').upper()
    return not any(word in src for word in _TIME_WORDS)


def spurious_tolerance(dst: str, query: str) -> bool:
    """True when the Thai adds an endurance verb the source never said (hallucinated "ทน").

    Measured (#1039): `I HEARD YOUR CONVERSATION WITH THE GODDESS.` came back as
    `ฉันทนฟังบทสนทนาของเธอกับเทพธิดาแล้ว` on every run, prompt version and temperature tried — the model
    inserts `ทน` (endure). A re-ask with a note fixes it; only Thai targets use the token, so an English source
    without an endurance word is the licence check. `ทนทาน` (durable) is a different word and is left alone.
    """
    if not dst or 'ทน' not in dst:
        return False
    if not _THAI_TOLERANCE.search(dst):
        return False
    src = (query or '').upper()
    if any(word in src for word in _ENDURE_WORDS):
        return False
    return True


#: Thai for "rare" — the observed wrong rendering of LOST (#1052).
_RARE_TH = 'หายาก'


def lost_as_rare(dst: str, query: str) -> bool:
    """True when LOST was rendered as หายาก ("rare") — a measured, meaning-changing swap.

    A judge audit of a real page caught `LOST ITEMS.` -> `ของหายาก` (rare items) and a second line
    with the same swap, intermittently (1 of 4 runs). The licence check is exact: the English
    source says LOST and not RARE/SCARCE, while the Thai contains หายาก. The retry gets a note.
    """
    if not dst or _RARE_TH not in dst:
        return False
    src = (query or '').upper()
    if 'LOST' not in src:
        return False
    return not any(word in src for word in ('RARE', 'RARELY', 'SCARCE'))


#: Characters of scripts that must never appear in a Thai (or other non-CJK) target unless the source used them.
_LEAK_SCRIPT_CHARS = {
    'cjk': re.compile('[㐀-䶿一-鿿々-〇]'),
    'kana': re.compile('[぀-ヿ]'),
    'hangul': re.compile('[가-힯ᄀ-ᇿ]'),
    'cyrillic': re.compile('[Ѐ-ӿ]'),
}


def strip_leaked_script(trans: str, query: str = '', to_lang: str = '') -> str:
    """Last-resort salvage: delete leaked-script characters when the retries could not fix them.

    The guards re-ask a segment that leaks a foreign script, but when the repeat budget is exhausted the last
    answer ships as-is (measured: a CJK leak survived two retries on a real page). Removing the leaked
    characters leaves broken-but-thai text instead of foreign glyphs on the artwork; it never touches a script
    the source itself uses (a JP kana SFX copied into a Thai line is legitimate).
    """
    if not trans:
        return trans
    src = query or ''
    out = trans
    for script, pattern in _LEAK_SCRIPT_CHARS.items():
        if pattern.search(src):
            continue  # the source uses this script; copied text is not a leak
        out = pattern.sub('', out)
    if out == trans:
        return trans
    cleaned = re.sub(r'[ 	]{2,}', ' ', out).strip()
    return cleaned or trans


#: Thai question markers: explicit '?' or a question particle/word.
_THAI_Q_MARKERS = re.compile(
    r'\?|หรือ(?:เปล่า|ไม่|ไง)|ไหม|มั้ย|เหรอ|หรอ|หรือ|อะไร|ทำไม|ยังไง|อย่างไร|เท่าไหร่|แค่ไหน|ที่ไหน|ใคร|เมื่อไหร่')


def dropped_question(src: str, dst: str, to_lang: str = '') -> bool:
    """True when the source asks a question but the target has no question marker at all.

    A source '?' on a retort (`FOR NO REASON?`) is a meaning-bearing nuance; Thai may realise it with a particle
    rather than '?', so only a total absence of any marker counts. Only applied to Thai targets.
    """
    if to_lang and str(to_lang).upper() not in ('THA', 'TH'):
        return False
    # A '?' embedded between letters/digits is an OCR artefact (titles like `Episode?3`) or an interrobang
    # style, never a question; only a standalone '?' counts (gate has the same licence).
    standalone = re.sub(r'(?<=[A-Za-z0-9])\?+(?=[A-Za-z0-9])', '', src or '')
    if '?' not in standalone and '？' not in standalone:
        return False
    return _THAI_Q_MARKERS.search(dst or '') is None


#: #1057: Latin words that survived into a Thai line (the model left an English word untranslated).
_LATIN_WORD = re.compile(r'[A-Za-z]{4,}')
_THAI_CHAR = re.compile('[\u0E00-\u0E7F]')
_CREDIT_SRC = re.compile(
    r'(TRANSLAT|TRANSLATED BY|WRIT|DRAW|DESIGN|LETTER|EDITING|EDITOR|AUTHOR|STORY|THANKS|SPECIAL|CREDIT|CLEAN|TYPESET|PUBLISH|ART BY)',
    re.I)
_VOWELS = set('AEIOUaeiou')


def untranslated_source_word(src: str, dst: str, to_lang: str = '') -> bool:
    """True when a Thai answer kept an English source word instead of translating it (#1057).

    Observed: `DID ANYONE BRING THE RESOURCE MATERIALS?` -> `มีใครเอามATERIALS มาบ้างไหม?` (the word glued to
    Thai). Licensed-copy rules keep the known benign cases out:

    - the answer must be mostly Thai (credits/titles/logos that stay Latin are skipped),
    - credit lines are skipped (`TRANSLATED BY DALE` legitimately keeps the name),
    - words without a vowel (`RTSD`, `TV`) are acronyms and skipped,
    - only words that the SOURCE actually contains count (words the source never had are the gate's
      `added_latin` class).
    """
    if to_lang and str(to_lang).upper() not in ('THA', 'TH'):
        return False
    src, dst = src or '', dst or ''
    if not src or not dst:
        return False
    thai = _THAI_CHAR.findall(dst)
    if len(thai) < max(4, len(dst) // 2):
        return False  # mostly-Latin answer: title/credit/logo/licensed copy
    if _CREDIT_SRC.search(src):
        return False
    src_words = {w.upper() for w in _LATIN_WORD.findall(src)}
    for word in _LATIN_WORD.findall(dst):
        upper = word.upper()
        # exact source word, or a partial copy glued into the Thai (observed: MATERIALS -> 'ATERIALS' after the
        # Thai 'ม' swallowed the M). Partial copies must cover most of the source word to stay specific.
        matched = upper in src_words or any(
            len(upper) >= 4 and upper in src_word and len(upper) >= 0.6 * len(src_word)
            for src_word in src_words)
        if not matched:
            continue
        if not (set(word) & _VOWELS):
            continue
        return True
    return False

#: #1058: a Thai answer far shorter than the source line means content loss/truncation.
_ASCII_LETTER = re.compile(r'[A-Za-z]')


def content_loss(src: str, dst: str, to_lang: str = '') -> bool:
    """True when the Thai answer is far too short for the source line (#1058).

    Measured over 8,423 real segments: median dst/src length ratio 0.86, p10 0.66; the 0.6 % below 0.45 are real
    losses (a truncated Thai phrase, a completely different short line), not terse styling.
    """
    if to_lang and str(to_lang).upper() not in ('THA', 'TH'):
        return False
    src, dst = src or '', dst or ''
    # Retry attempts append '[note: ...]' to the query; that text is not part of the source line and would
    # inflate the denominator (observed as spurious content_loss triggers on already-retried segments).
    src = src.split(chr(10) + chr(10) + '[note:')[0]
    if len(src) < 24 or not dst or not _ASCII_LETTER.search(src):
        return False
    return len(dst) / len(src) < 0.45

#: Thai typos the model produces often and whose correction is unambiguous (measured 45x in the corpus:
#: แล่ว carries mai ek where แล้ว needs mai tho; there is no Thai word spelled แล่ว).
_COMMON_THAI_TYPOS = (('แล่ว', 'แล้ว'), ('แลว', 'แล้ว'))


def normalize_common_typos(trans: str) -> str:
    """Fix the few Thai misspellings that have exactly one correct form (deterministic, no ambiguity)."""
    if not trans:
        return trans
    for wrong, right in _COMMON_THAI_TYPOS:
        trans = trans.replace(wrong, right)
    return trans
