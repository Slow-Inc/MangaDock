"""One-command quality dashboard for a directory of doctor payloads (#990 follow-up).

Combines what this loop measured by hand: deterministic gate violations per class, leftover instances of the live
guard classes (foreign script / content loss / untranslated word / dropped question), render/layout telemetry sums and
- when a judge audit is supplied - the raw and noise-adjusted judge mean.

    <MIT/.venv>/python.exe tools/quality_dashboard.py --doctor-dir result/doctor/f56 \
        --audit D:/Github/MangaDock/tmp/final56_audit.json --json /tmp/dashboard.json

Pure aggregation over JSON files (no ML imports), so the logic is unit-tested without the stack.
"""
import argparse
import glob
import json
import os
import re
import sys
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
MIT = os.path.dirname(HERE)
sys.path.insert(0, MIT)
sys.path.insert(0, HERE)

from manga_translator.quality_gate import check_page  # noqa: E402
from manga_translator.translation_quality import (  # noqa: E402
    content_loss, dropped_question, foreign_script, untranslated_source_word,
)
from audit_summary import _is_noise  # noqa: E402

_PREDICATES = {
    'foreign_script': lambda s, d: foreign_script(d, 'THA', s),
    'content_loss': lambda s, d: content_loss(s, d, 'THA'),
    'untranslated_word': lambda s, d: untranslated_source_word(s, d, 'THA'),
    'dropped_question': lambda s, d: dropped_question(s, d, 'THA'),
}


def summarise(payloads, audit=None):
    """Aggregate loaded doctor payloads (list of dicts) and an optional judge audit dict."""
    pages = len(payloads)
    gate = Counter()
    leftover = Counter()
    regions = 0
    timing = Counter()
    for payload in payloads:
        if payload.get('rendered') is False:
            continue
        regs = payload.get('regions') or []
        regions += len(regs)
        for v in check_page(regs, payload.get('page', '?')):
            gate[v['kind']] += 1
        for r in regs:
            src, dst = (r.get('src') or ''), (r.get('dst') or '')
            if not src or not dst:
                continue
            for name, pred in _PREDICATES.items():
                if pred(src, dst):
                    leftover[name] += 1
        for key, value in (payload.get('timing_ms') or {}).items():
            timing[key] += value
    report = {'pages': pages, 'regions': regions,
              'gate_violations': dict(gate), 'leftover': dict(leftover),
              'timing_ms': dict(timing)}
    if audit:
        n = total = noise = 0
        adj = adj_total = 0
        for rec in audit.values():
            for x in rec.get('scores', []):
                score = x.get('score')
                if score not in (0, 1, 2):
                    continue
                n += 1
                total += score
                if _is_noise(x.get('note', '')):
                    noise += 1
                    score = 2
                adj += 1
                adj_total += score
        report['judge'] = {'segments': n, 'raw_mean': round(total / max(n, 1), 2),
                           'noise_flags': noise, 'adjusted_mean': round(adj_total / max(adj, 1), 2)}
    return report


def load_payloads(doctor_dir):
    payloads = []
    for path in sorted(glob.glob(os.path.join(doctor_dir, '*.doctor.json'))):
        try:
            payloads.append(json.load(open(path, encoding='utf-8')))
        except Exception:
            continue
    return payloads


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--doctor-dir', required=True)
    ap.add_argument('--audit')
    ap.add_argument('--json')
    args = ap.parse_args()
    payloads = load_payloads(args.doctor_dir)
    audit = json.load(open(args.audit, encoding='utf-8')) if args.audit else None
    report = summarise(payloads, audit)
    print(json.dumps(report, ensure_ascii=False, indent=1))
    if args.json:
        with open(args.json, 'w', encoding='utf-8') as fh:
            json.dump(report, fh, ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
