"""Summarise judge audit JSONs and strip the judge's known typo-noise flags (#990 follow-up).

The judge frequently lowers a score for 'typos' that are identical strings (`ฉัน→ฉัน`, `ไม่มี→ไม่มี`) — a Thai
tokenizer artefact. This tool classifies such notes as noise, reports the raw and noise-adjusted distribution, and
prints the remaining real flags per category, so quality decisions are not driven by the artefact.

    <MIT/.venv>/python.exe tools/audit_summary.py tmp/f24g21_audit.json tmp/b48_audit.json ...
"""
import argparse
import json
import re

_PAIR = re.compile(r'([^\s,;:()\[\]→\-]+)\s*(?:→|->)\s*([^\s,;:()\[\]→\-]+)')
_NOISE_HINTS = ('typo', 'misspelling', 'spelling error', 'not a valid thai word')
_COMPLAINTS = ('literal', 'wrong', 'mistranslat', 'omiss', 'dropped', 'missing', 'inverted', 'opposite', 'adds ', 'added ')


def _is_noise(note: str) -> bool:
    """True when the only complaints look like the judge's tokenizer artefact.

    A note that carries any REAL pair (left != right) or a complaint keyword is a real finding; a note whose only
    pairs are identical strings is the tokenizer artefact.
    """
    note = note or ''
    pairs = _PAIR.findall(note)
    if any(a.strip() and b.strip() and a.strip() != b.strip() for a, b in pairs):
        return False
    low = note.lower()
    if any(k in low for k in _COMPLAINTS):
        return False
    if pairs:
        return True  # only identical strings were claimed as typos
    if any(h in low for h in _NOISE_HINTS) and 'meaning' in low and 'preserved' in low:
        return True
    if 'typos' in low:
        return True
    return False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('audits', nargs='+')
    args = ap.parse_args()
    raw = {'n': 0, 'sum': 0, 'dist': {0: 0, 1: 0, 2: 0}}
    adj = {'n': 0, 'sum': 0, 'dist': {0: 0, 1: 0, 2: 0}}
    real = []
    noise = 0
    for path in args.audits:
        try:
            data = json.load(open(path, encoding='utf-8'))
        except Exception as exc:
            print(f'{path}: unreadable ({exc})')
            continue
        for page, rec in data.items():
            for x in rec.get('scores', []):
                score = x.get('score')
                if score not in (0, 1, 2):
                    continue
                raw['n'] += 1
                raw['sum'] += score
                raw['dist'][score] += 1
                if _is_noise(x.get('note', '')):
                    noise += 1
                    score = 2
                adj['n'] += 1
                adj['sum'] += score
                adj['dist'][score] += 1
                if score < 2:
                    real.append((x.get('problem', '?'), page, x.get('i'), (x.get('note') or '')[:130]))
    print(f"segments={raw['n']}  raw mean={raw['sum']/max(raw['n'],1):.2f}  noise flags={noise}")
    print(f"noise-adjusted mean={adj['sum']/max(adj['n'],1):.2f}  dist(0/1/2)={adj['dist'][0]}/{adj['dist'][1]}/{adj['dist'][2]}")
    print('real flags:')
    for problem, page, idx, note in real[:25]:
        print(f'  [{problem}] {page[:34]} #{idx} {note}')


if __name__ == '__main__':
    main()
