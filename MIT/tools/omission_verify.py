"""Semantic omission verifier (offline QA): asks the gateway whether a Thai line dropped a clause (#1058 follow-up).

The word-ratio guard cannot separate a dropped clause from a legitimately compact line (measured 2026-10-23), so this
tool uses one cheap verification call per page on LONG source lines only (>= --min-words English words).

    <MIT/.venv>/python.exe tools/omission_verify.py --glob "result/doctor/f56/*_final56.doctor.json" --out tmp/omission.json

Report-only: it prints/records flagged pairs and never changes a translation. Pure parse/filter helpers are
unit-tested without the gateway.
"""
import argparse
import glob
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
MIT = os.path.dirname(HERE)
sys.path.insert(0, MIT)

_SYSTEM = (
    "You are a strict bilingual editor for manga translations into Thai. For each numbered pair you get the "
    "SOURCE segment and its THAI translation. Decide ONLY whether the Thai translation OMITS a whole clause or "
    "piece of content that the source states (e.g. a sentence part dropped, a listed item missing). Ignore style, "
    "typos, wording preferences and slight nuance shifts - those are not omissions. Reply with ONLY a JSON array "
    '[{"i":0,"omitted":true,"missing":"..."},{"i":1,"omitted":false}] with one entry per pair. No prose, no code fences."'
)
_EN_WORD = re.compile(r"[A-Za-z][A-Za-z']+")


def long_pairs(doctor, min_words=8):
    """(src, dst) pairs whose English source has at least ``min_words`` words, in region order."""
    out = []
    for r in doctor.get('regions', []):
        src = (r.get('src') or '').strip()
        dst = (r.get('dst') or '').strip()
        if not src or not dst:
            continue
        if len(_EN_WORD.findall(src)) >= min_words:
            out.append((src, dst))
    return out


def build_user(pairs, offset=0):
    lines = ['SOURCE AND TRANSLATION:', '']
    for i, (src, dst) in enumerate(pairs):
        lines.append(f'<|{offset + i}|> SR: {src}')
        lines.append(f'     TH: {dst}')
    return chr(10).join(lines)


def parse_verdicts(content):
    """Parse the verifier reply into a list of dicts, or None when it is not a JSON array."""
    m = re.search(r'\[.*\]', content or '', re.S)
    if not m:
        return None
    try:
        data = json.loads(m.group(0))
    except Exception:
        return None
    return data if isinstance(data, list) else None


def flagged(pairs, verdicts):
    """[(index, src, dst, missing)] for verdicts that mark an omission."""
    out = []
    for item in verdicts or []:
        if not isinstance(item, dict) or not item.get('omitted'):
            continue
        i = item.get('i')
        if isinstance(i, int) and 0 <= i < len(pairs):
            out.append((i, pairs[i][0], pairs[i][1], str(item.get('missing') or '')))
    return out


def verify_page(pairs, offset, base, key, model, timeout=180):
    import requests
    body = {'model': model, 'max_tokens': 2048, 'temperature': 0,
            'messages': [{'role': 'system', 'content': _SYSTEM},
                         {'role': 'user', 'content': build_user(pairs, offset)}]}
    resp = requests.post(base, headers={'Authorization': 'Bearer ' + key}, json=body, timeout=timeout)
    return parse_verdicts(resp.json()['choices'][0]['message']['content'])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--glob', required=True, help='e.g. result/doctor/f56/*_final56.doctor.json')
    ap.add_argument('--out')
    ap.add_argument('--min-words', type=int, default=8)
    ap.add_argument('--limit', type=int, default=0)
    args = ap.parse_args()

    from manga_translator import initialize as _initialize_env
    _initialize_env()
    from manga_translator.translators import keys
    base = keys.CUSTOM_OPENAI_API_BASE.rstrip('/') + '/chat/completions'

    paths = sorted(glob.glob(os.path.join(MIT, args.glob)))
    if args.limit:
        paths = paths[:args.limit]
    report = {}
    total_pairs = total_flags = 0
    for path in paths:
        with open(path, encoding='utf-8') as fh:
            doctor = json.load(fh)
        pairs = long_pairs(doctor, args.min_words)
        if not pairs:
            continue
        verdicts = verify_page(pairs, 0, base, keys.CUSTOM_OPENAI_API_KEY, keys.CUSTOM_OPENAI_MODEL)
        hits = flagged(pairs, verdicts)
        total_pairs += len(pairs)
        total_flags += len(hits)
        page = os.path.basename(path)
        report[page] = {'long_pairs': len(pairs), 'parsed': verdicts is not None,
                        'flagged': [{'i': i, 'src': s, 'dst': d, 'missing': m} for i, s, d, m in hits]}
        print(f'{page[:52]:54s} long={len(pairs):2d} flagged={len(hits)} '
              + ('PARSE-FAIL' if verdicts is None else ''), file=sys.stderr)
        for i, s, d, m in hits:
            print(f'  [{i}] {m[:70]}', file=sys.stderr)
    if args.out:
        with open(args.out, 'w', encoding='utf-8') as fh:
            json.dump(report, fh, ensure_ascii=False, indent=1)
    print(f'pages={len(report)} long_pairs={total_pairs} flagged={total_flags}')


if __name__ == '__main__':
    main()
