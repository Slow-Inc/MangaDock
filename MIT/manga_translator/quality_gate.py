"""Deterministic quality gate for a translated chapter (#990 follow-up).

Consolidates the checks that this quality loop built and validated on real pages, so a chapter replay can be
gated without a judge model:

- foreign-script leaks and runaway repetition (#903 / #901),
- Thai orthography: doubled combining marks and a leading combining mark,
- control/zero-width characters and unexpected Latin words,
- dropped `!` / `?` / `…` punctuation (an interrobang covers both marks, `...` covers `…`, and a final Thai
  question particle such as เหรอ/ไหม carries a question without the mark),
- cross-page character-name spellings (`name_glossary`).

Pure logic, so it unit-tests without the ML stack.
"""
import re

from .name_glossary import extract_glossary
from .translation_quality import foreign_script, runaway_translation

_COMBINING = set('\u0E31\u0E34\u0E35\u0E36\u0E37\u0E38\u0E39\u0E3A\u0E47\u0E48\u0E49\u0E4A\u0E4B\u0E4C\u0E4D\u0E4E')
_DOUBLED = re.compile(r'([\u0E31\u0E34-\u0E3A\u0E47-\u0E4E])\1')
_CTRL = re.compile(r'[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]')
_LATIN = re.compile(r'[A-Za-z]{3,}')
_THAI = re.compile(r'[\u0E00-\u0E7F]')
_PUNCT = ('!', '?', '…')
#: Thai manga often drops the '?' when the sentence ends on a question particle; those count as preserved.
#: OCR sometimes lands punctuation INSIDE a word ('IF?YOU THINK') - not a real question mark.
_OCR_EMBEDDED_PUNCT = re.compile(r'(?<=[A-Za-z0-9])\?(?=[A-Za-z0-9])')
#: Thai question markers can sit near the end rather than at the very end ('...คืออะไร', '...หรือไง'),
_THAI_QUESTION = re.compile(r'(เหรอ|หรอ|หรือ|ไหม|มั้ย|รึ|เปล่า|ไหน|อะไร|ทำไม|ยังไง|เท่าไหร่|แค่ไหน)', re.UNICODE)


def _thai_target(query, dst):
    return bool(_THAI.search(dst or '')) and not _THAI.search(query or '')


def check_page(regions, page='?'):
    """Return a list of violation dicts for one page's ``{src, dst}`` regions."""
    out = []
    for i, region in enumerate(regions or []):
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
            _added = [w for w in _LATIN.findall(dst) if w.upper() not in _src_latin]
            if _added:
                out.append({'page': page, 'index': i, 'kind': 'added_latin', 'detail': ','.join(_added[:3])})
        src_punct = _OCR_EMBEDDED_PUNCT.sub('', src)
        for mark in _PUNCT:
            if src_punct.count(mark) >= 1 and dst.count(mark) == 0:
                if mark in ('?', '!') and ('⁈' in dst or '⁉' in dst):
                    continue  # one interrobang covers both marks
                if mark == '!' and '?' in dst:
                    continue  # a Thai rhetorical question keeps only the ?
                if mark == '?' and _THAI_QUESTION.search(dst[-16:]):
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
