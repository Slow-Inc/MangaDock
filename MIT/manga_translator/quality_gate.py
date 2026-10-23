"""Deterministic quality gate for a translated chapter (#990 follow-up).

Consolidates the checks that this quality loop built and validated on real pages, so a chapter replay can be
gated without a judge model:

- foreign-script leaks and runaway repetition (#903 / #901),
- Thai orthography: doubled combining marks and a leading combining mark,
- control/zero-width characters, unexpected Latin words, English source words kept untranslated (#1057) and
  far-too-short answers / content loss (#1058),
- dropped `!` / `?` / `…` punctuation (an interrobang covers both marks, `...` covers `…`, and a Thai question
  particle anywhere in the answer carries a question without the mark),
- cross-page character-name spellings (`name_glossary`).

Regions the payload marks `rendered: False` were dropped for attribution (#535) and are never checked.

Pure logic, so it unit-tests without the ML stack.
"""
import re

from .name_glossary import extract_glossary
from .translation_quality import is_retort_question, is_tag_question
from .translation_quality import (content_loss, foreign_script, normalize_common_typos, runaway_translation,
                                  untranslated_source_word)

_COMBINING = set('\u0E31\u0E34\u0E35\u0E36\u0E37\u0E38\u0E39\u0E3A\u0E47\u0E48\u0E49\u0E4A\u0E4B\u0E4C\u0E4D\u0E4E')
_DOUBLED = re.compile(r'([\u0E31\u0E34-\u0E3A\u0E47-\u0E4E])\1')
_CTRL = re.compile(r'[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]')
_LATIN = re.compile(r'[A-Za-z]{3,}')
_ALNUM = re.compile(r'[A-Za-z0-9]{3,}')
#: Names/codes use lookalike digits (`ZER0`); normalise before comparing a kept name with its source.
_DIGIT_TO_LETTER = str.maketrans({'0': 'O', '1': 'I', '2': 'Z', '3': 'E', '4': 'A', '5': 'S', '7': 'T', '8': 'B', '9': 'G'})


def _norm_alnum(token):
    return re.sub(r'[^A-Z]', '', token.upper().translate(_DIGIT_TO_LETTER))
_THAI = re.compile(r'[\u0E00-\u0E7F]')
_PUNCT = ('!', '?', '…')
#: Thai manga often drops the '?' when the sentence ends on a question particle; those count as preserved.
#: OCR sometimes lands punctuation INSIDE a word ('IF?YOU THINK') - not a real question mark.
_OCR_EMBEDDED_PUNCT = re.compile(r'(?<=[A-Za-z0-9])\?(?=[A-Za-z0-9])')
#: Thai question markers can sit near the end rather than at the very end ('...คืออะไร', '...หรือไง'),
_THAI_QUESTION = re.compile(r'(เหรอ|หรอ|หรือ|ไหม|มั้ย|รึ|เปล่า|ไหน|อะไร|ทำไม|ยังไง|เท่าไหร่|แค่ไหน)', re.UNICODE)
#: A source `!` can be carried by a Thai emphasis particle instead of the mark (measured: all 44 corpus lines
#: with a source `!` carry either the mark or one of these; `ไอ้เทพธิดาพวกนั้นมันแย่จริงๆ` is the flagging case).
_THAI_EMPHASIS = re.compile(r'(นะ|สิ|เลย|จริงๆ|จริง ๆ|มาก|เหลือเกิน|เต็มที่|สุดๆ|สุด ๆ|เนี่ย|นี่นะ|ล่ะ|ซะ|จัง|โว้ย|วะ|เชียว|งั้นเหรอ|เหรอ|หรอ|ไม่ใช่เหรอ|ไม่ใช่|นั่น)')


def _thai_target(query, dst):
    return bool(_THAI.search(dst or '')) and not _THAI.search(query or '')


def check_page(regions, page='?'):
    """Return a list of violation dicts for one page's ``{src, dst}`` regions."""
    out = []
    for i, region in enumerate(regions or []):
        if region.get('rendered') is False:
            # #535: the payload also carries dropped regions for attribution (rendered=False); they
            # were never drawn, so an empty translation there is expected - not a missing translation.
            continue
        src = (region.get('src') or '').strip()
        dst = (region.get('dst') or '').strip()
        if not src or not dst:
            if src and not dst:
                out.append({'page': page, 'index': i, 'kind': 'empty_translation', 'detail': src[:60]})
            continue
        thai = _thai_target(src, dst)
        if thai and foreign_script(dst, 'THA', src):
            out.append({'page': page, 'index': i, 'kind': 'foreign_script', 'detail': dst[:60]})
        if thai and runaway_translation(src, dst):
            out.append({'page': page, 'index': i, 'kind': 'runaway', 'detail': f'{len(src)}->{len(dst)}'})
        if thai and normalize_common_typos(dst) != dst:
            out.append({'page': page, 'index': i, 'kind': 'common_typo', 'detail': dst[:60]})
        if thai and content_loss(src, dst, 'THA'):
            out.append({'page': page, 'index': i, 'kind': 'content_loss', 'detail': f'{len(src)}->{len(dst)}'})
        if thai and untranslated_source_word(src, dst, 'THA'):
            out.append({'page': page, 'index': i, 'kind': 'untranslated_word', 'detail': dst[:60]})
        if thai and _DOUBLED.search(dst):
            out.append({'page': page, 'index': i, 'kind': 'doubled_mark', 'detail': dst[:60]})
        if thai and dst[0] in _COMBINING:
            out.append({'page': page, 'index': i, 'kind': 'leading_combining', 'detail': dst[:60]})
        if _CTRL.search(dst):
            out.append({'page': page, 'index': i, 'kind': 'control_chars', 'detail': repr(dst[:60])})
        if thai and _LATIN.search(dst):
            # credits and names legitimately stay in Latin ("TRANSLATED BY DALE" -> "แปลโดย DALE");
            # only Latin words the source never had are an added-language leak.
            _src_latin = {w.upper() for w in _LATIN.findall(src)}
            _src_alnum = {_norm_alnum(t) for t in _ALNUM.findall(src)}
            _added = []
            for _word in _LATIN.findall(dst):
                if _word.upper() in _src_latin:
                    continue
                # A digit-suffixed name (`ZER0`) makes the letter token (`ZER`) look added; compare the whole
                # alphanumeric token with lookalike digits normalised (`ZER0` -> `ZERO`).
                _host = next((m.group(0) for m in _ALNUM.finditer(dst) if _word.upper() in m.group(0).upper()), None)
                if _host is not None and _norm_alnum(_host) in _src_alnum:
                    continue
                _added.append(_word)
            if _added:
                out.append({'page': page, 'index': i, 'kind': 'added_latin', 'detail': ','.join(_added[:3])})
        src_punct = _OCR_EMBEDDED_PUNCT.sub('', src)
        for mark in _PUNCT:
            if src_punct.count(mark) >= 1 and dst.count(mark) == 0:
                if mark in ('?', '!') and ('⁈' in dst or '⁉' in dst):
                    continue  # one interrobang covers both marks
                if mark == '!' and '?' in dst:
                    continue  # a Thai rhetorical question keeps only the ?
                if mark == '?' and (is_tag_question(src_punct) or is_retort_question(src_punct)):
                    continue  # discourse tag or a long rhetorical retort needs no question marker
                    continue  # discourse tag (..., y know? / right?) needs no question marker
                if mark == '!' and _THAI_EMPHASIS.search(dst):
                    continue  # Thai emphasis particle carries the source exclamation
                if mark == '?' and _THAI_QUESTION.search(dst):
                    continue  # final Thai question particle carries the question
                if mark == '…' and '...' in dst:
                    continue
                out.append({'page': page, 'index': i, 'kind': f'dropped_{mark}', 'detail': dst[:60]})
    return out


def check_names(pages):
    """Cross-page name spellings: ``pages`` is a list of (page_label, regions)."""
    out = []
    per_page = [(label, extract_glossary(regions)) for label, regions in pages]
    names = set()
    for _label, glossary in per_page:
        names |= set(glossary)
    for name in sorted(names):
        spellings = [(label, g[name]) for label, g in per_page if name in g]
        if len(spellings) < 2:
            continue
        if len({sp for _label, sp in spellings}) > 1:
            out.append({'kind': 'inconsistent_name', 'name': name, 'spellings': spellings})
    return out


def check_chapter(pages):
    """Run every check over ``[(page_label, regions), ...]``; returns a report dict."""
    violations = []
    for label, regions in pages:
        violations.extend(check_page(regions, label))
    violations.extend(check_names(pages))
    return {'pages': len(pages), 'violations': violations, 'ok': not violations}
