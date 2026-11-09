"""Cross-page character-name consistency check (#980).

Usage:
    <MIT/.venv>/python.exe tools/name_consistency.py <page1.doctor.json> <page2.doctor.json> [...]

Reads pipeline doctor JSONs (each file = one page), extracts romaji names and the Thai spelling each page used,
and reports names whose spelling differs across the given pages. Exit code 1 if any name is inconsistent, so it
can gate a regression check.
"""
import argparse
import json
import os
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(_HERE))

from manga_translator.name_glossary import candidate_names, extract_glossary  # noqa: E402


def page_pairs(path):
    data = json.load(open(path, encoding='utf-8'))
    return [{'src': r.get('src') or '', 'dst': r.get('dst') or ''} for r in data.get('regions', [])]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('pages', nargs='+', help='doctor JSONs, one per page, in reading order')
    args = ap.parse_args()
    per_page = [(p, extract_glossary(page_pairs(p))) for p in args.pages]
    names = set()
    for _p, glossary in per_page:
        names |= set(glossary)
    bad = 0
    for name in sorted(names):
        spellings = [(p, glossary.get(name)) for p, glossary in per_page if glossary.get(name)]
        if len(spellings) < 2:
            continue
        distinct = {sp for _p, sp in spellings}
        status = 'CONSISTENT' if len(distinct) == 1 else 'INCONSISTENT'
        if status == 'INCONSISTENT':
            bad += 1
        print(f'{name}: {status} -> ' + ', '.join(f'{sp}' for _p, sp in spellings))
    print(f'names checked: {len(names)}, inconsistent: {bad}')
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())