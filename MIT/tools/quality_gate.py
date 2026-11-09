"""Deterministic quality gate for a translated chapter (#980 follow-up).

Usage:
    <MIT/.venv>/python.exe tools/quality_gate.py page1.doctor.json [page2.doctor.json ...]

Runs the loop's deterministic checks over the pages **in reading order** (foreign script, runaway, Thai
orthography, control/Latin leaks, dropped punctuation, cross-page name spellings) and exits 1 if anything is
flagged. No judge model needed — suitable for replay gates and CI.
"""
import argparse
import json
import os
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(_HERE))

from manga_translator.quality_gate import check_chapter  # noqa: E402


def load(path):
    data = json.load(open(path, encoding='utf-8'))
    return [{'src': r.get('src') or '', 'dst': r.get('dst') or ''} for r in data.get('regions', [])]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('pages', nargs='+', help='doctor JSONs, one per page, in reading order')
    ap.add_argument('--json', action='store_true', help='print the report as JSON')
    args = ap.parse_args()
    pages = [(os.path.basename(p), load(p)) for p in args.pages]
    report = check_chapter(pages)
    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=1))
    else:
        for v in report['violations']:
            if v['kind'] == 'inconsistent_name':
                print(f"  inconsistent_name: {v['name']} -> {v['spellings']}")
            else:
                print(f"  {v['kind']}: page={v['page']} index={v['index']} detail={v['detail']}")
        print(f"pages={report['pages']} violations={len(report['violations'])} ok={report['ok']}")
    return 0 if report['ok'] else 1


if __name__ == '__main__':
    sys.exit(main())
