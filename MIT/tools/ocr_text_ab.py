"""A/B judge for OCR text changes between two doctor dirs (baseline vs a lever). Report-only.
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
    "You compare two OCR reads of the same manga lettering. A = baseline, B = candidate. Decide which is the correct "
    "English text of the artwork (spelling, missing letters, word boundaries). If both are equally correct or equally "
    "garbled, answer TIE. Reply with ONLY a JSON array of objects with i and better (A, B or TIE). No prose."
)


def collect_changes(a_dir, b_dir):
    """[(page, old_src, new_src)] for changed source strings, paired by region index."""

    def load(d):
        out = {}
        for f in glob.glob(os.path.join(d, '*.doctor.json')):
            page = os.path.basename(f).split('_THA')[0]
            out[page] = [(r.get('src') or '') for r in json.load(open(f, encoding='utf-8')).get('regions', [])]
        return out

    a, b = load(a_dir), load(b_dir)
    pairs = []
    for page in sorted(set(a) & set(b)):
        if len(a[page]) != len(b[page]):
            continue
        for old, new in zip(a[page], b[page]):
            if old and new and old != new:
                pairs.append((page, old, new))
    return pairs


def build_user(pairs, offset=0):
    lines = ['OCR PAIRS:', '']
    for i, (_page, old, new) in enumerate(pairs):
        lines.append(f'<|{offset + i}|> A: {old}')
        lines.append(f'      B: {new}')
    return chr(10).join(lines)


def parse_choices(content):
    pattern = chr(92) + '[' + '.*' + chr(92) + ']'
    m = re.search(pattern, content or '', re.S)
    if not m:
        return None
    try:
        data = json.loads(m.group(0))
    except Exception:
        return None
    return data if isinstance(data, list) else None


def tally(choices, n):
    out = {'A': 0, 'B': 0, 'TIE': 0, 'unparsed': 0}
    seen = set()
    for item in choices or []:
        if not isinstance(item, dict):
            continue
        i = item.get('i')
        if not isinstance(i, int) or i in seen:
            continue
        seen.add(i)
        better = str(item.get('better') or '').upper()
        if better in ('A', 'B', 'TIE'):
            out[better] += 1
        else:
            out['unparsed'] += 1
    out['unparsed'] += max(0, n - len(seen))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--a', required=True)
    ap.add_argument('--b', required=True)
    ap.add_argument('--chunk', type=int, default=25)
    args = ap.parse_args()

    from manga_translator import initialize as _initialize_env
    _initialize_env()
    from manga_translator.translators import keys
    import requests

    base = keys.CUSTOM_OPENAI_API_BASE.rstrip('/') + '/chat/completions'
    pairs = collect_changes(args.a, args.b)
    if not pairs:
        print('no source changes between the two dirs')
        return
    totals = {'A': 0, 'B': 0, 'TIE': 0, 'unparsed': 0}
    for off in range(0, len(pairs), args.chunk):
        part = pairs[off:off + args.chunk]
        body = {'model': keys.CUSTOM_OPENAI_MODEL, 'max_tokens': 2048, 'temperature': 0,
                'messages': [{'role': 'system', 'content': _SYSTEM},
                             {'role': 'user', 'content': build_user(part, off)}]}
        resp = requests.post(base, json=body, timeout=180,
                             headers={'Authorization': 'Bearer ' + keys.CUSTOM_OPENAI_API_KEY})
        choices = parse_choices(resp.json()['choices'][0]['message']['content'])
        for k, v in tally(choices, len(part)).items():
            totals[k] += v
    print('pairs:', len(pairs), 'B(better) %d | A(baseline) %d | tie %d | unparsed %d' %
          (totals['B'], totals['A'], totals['TIE'], totals['unparsed']))


if __name__ == '__main__':
    main()
