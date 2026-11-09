"""Translation-prompt A/B on real pages (quality loop, 2026-10-20).

    <MIT/.venv>/python.exe tools/translation_ab.py translate <out.json> --gpt-config A.yaml --label A <doctor.json>...
    <MIT/.venv>/python.exe tools/translation_ab.py packet <A.json> <B.json> <packet.json> [--seed 7]
    <MIT/.venv>/python.exe tools/translation_ab.py tally <packet.json> <votes.json>

`translate` re-translates the ordered source texts that Pipeline Doctor recorded for each page
(`.doctor.json` from `tools/doctor_page.py`) through the production custom_openai translator with
one `translator.gpt_config` YAML (prompt / temperature / samples) — so arms differ only in the
prompt config, not in detection/OCR. `packet` blinds the two arms per page (seeded shuffle, key
kept in the packet) for independent judges; `tally` un-blinds their votes.
"""
import argparse
import asyncio
import json
import os
import random
import sys
from collections import Counter
from typing import Dict, List, Tuple

HERE = os.path.dirname(os.path.abspath(__file__))
MIT = os.path.dirname(HERE)
sys.path.insert(0, MIT)

from manga_translator.translation_quality import classify_glitch  # noqa: E402


def _load(path: str):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def _dump(obj, path: str) -> None:
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)


def page_texts(doctor_json: Dict) -> List[str]:
    """The page's source texts in the order the pipeline translated them (reading order)."""
    return [r['src'] for r in doctor_json.get('regions', []) if (r.get('src') or '').strip()]


def blind_pairs(a: Dict[str, List[str]], b: Dict[str, List[str]], seed: int = 7) -> Tuple[List[Dict], Dict[str, str]]:
    """Per page, put the two arms as X/Y in a seeded random order. Returns (packet, key) where
    key[page] says which arm ('A' or 'B') is X."""
    rng = random.Random(seed)
    packet, key = [], {}
    for page in sorted(set(a) & set(b)):
        x_is_a = rng.random() < 0.5
        key[page] = 'A' if x_is_a else 'B'
        packet.append({'page': page, 'X': a[page] if x_is_a else b[page],
                       'Y': b[page] if x_is_a else a[page]})
    return packet, key


def glitches(sources: List[str], outputs: List[str], target: str) -> Dict[str, int]:
    """Count judge-free translation glitches per kind (`translation_quality.classify_glitch`)."""
    kinds = Counter(classify_glitch(s, d, target) for s, d in zip(sources, outputs))
    return {'segments': len(outputs), 'foreign_script': kinds['foreign_script'],
            'untranslated': kinds['untranslated'], 'empty': kinds['empty']}


def tally(votes: Dict[str, str], key: Dict[str, str]) -> Dict[str, int]:
    """Turn per-page 'X' / 'Y' / 'TIE' votes into arm wins."""
    out = {'A': 0, 'B': 0, 'TIE': 0}
    for page, vote in votes.items():
        if vote == 'TIE':
            out['TIE'] += 1
        elif page in key:
            x_arm = key[page]
            out[x_arm if vote == 'X' else ('B' if x_arm == 'A' else 'A')] += 1
    return out


async def _translate(args):
    if args.base or args.model or args.key_env:
        # Point custom_openai at another OpenAI-compatible endpoint for THIS process only (set
        # before initialize(): load_dotenv does not override). The key is read from MIT/.env.
        from dotenv import dotenv_values
        env = dotenv_values(os.path.join(MIT, '.env'))
        if args.base:
            os.environ['CUSTOM_OPENAI_API_BASE'] = args.base
        if args.model:
            os.environ['CUSTOM_OPENAI_MODEL'] = args.model
        if args.key_env:
            os.environ['CUSTOM_OPENAI_API_KEY'] = env.get(args.key_env) or os.environ.get(args.key_env, '')
        os.environ['CUSTOM_OPENAI_ENABLE_THINKING'] = 'true'  # qwen-only extra_body off
    from manga_translator import initialize
    initialize()
    from manga_translator.config import TranslatorConfig
    from manga_translator.translators.custom_openai import CustomOpenAiTranslator

    tr = CustomOpenAiTranslator()
    tr.parse_args(TranslatorConfig(translator='custom_openai', target_lang=args.target,
                                   gpt_config=args.gpt_config))
    out = {'label': args.label, 'gpt_config': args.gpt_config, 'pages': {}, 'sources': {}, 'errors': {}}
    for path in args.doctor:
        texts = page_texts(_load(path))
        if not texts:
            continue
        page = os.path.basename(path).split(f'_{args.target}')[0]
        try:
            out['pages'][page] = await tr.translate('auto', args.target, texts)
            out['sources'][page] = texts
            print(f'[ab] {args.label} {page}: {len(texts)} segments', flush=True)
        except Exception as e:  # one page's failure (rate limit, gateway) must not lose the run
            out['errors'][page] = f'{type(e).__name__}: {e}'[:300]
            print(f'[ab] {args.label} {page}: FAILED {out["errors"][page]}', flush=True)
        _dump(out, args.out)
        await asyncio.sleep(args.delay)


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest='cmd', required=True)
    t = sub.add_parser('translate')
    t.add_argument('out')
    t.add_argument('doctor', nargs='+')
    t.add_argument('--gpt-config', default=None)
    t.add_argument('--label', required=True)
    t.add_argument('--target', default='THA')
    t.add_argument('--base', help='OpenAI-compatible base URL to use instead of CUSTOM_OPENAI_API_BASE')
    t.add_argument('--model', help='model name to use instead of CUSTOM_OPENAI_MODEL')
    t.add_argument('--key-env', help='name of the MIT/.env variable holding the API key for --base')
    t.add_argument('--delay', type=float, default=0.0, help='seconds between pages (rate limits)')
    p = sub.add_parser('packet')
    p.add_argument('a')
    p.add_argument('b')
    p.add_argument('out')
    p.add_argument('--seed', type=int, default=7)
    y = sub.add_parser('tally')
    y.add_argument('packet')
    y.add_argument('votes')
    args = ap.parse_args()
    if args.cmd == 'translate':
        asyncio.run(_translate(args))
    elif args.cmd == 'packet':
        A, B = _load(args.a), _load(args.b)
        packet, key = blind_pairs(A['pages'], B['pages'], args.seed)
        for item in packet:
            item['source'] = A['sources'][item['page']]
        _dump({'packet': packet, 'key': key}, args.out)
    else:
        print(tally(_load(args.votes), _load(args.packet)['key']))


if __name__ == '__main__':
    main()
