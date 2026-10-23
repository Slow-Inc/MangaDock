"""Opt-in omission verification for long lines (MIT_OMISSION_VERIFY=1).

The word-ratio guard cannot see a dropped clause (measured 2026-10-23), so this pass asks the gateway once per page
whether a long source line's Thai translation omitted a clause, then re-asks only the agreed lines with a note
naming what was missing. Report-only by construction until the flag is set; every failure keeps the original text.
"""
import asyncio
import json
import logging
import os
import re

logger = logging.getLogger('manga_translator')

_SYSTEM = (
    "You are a strict bilingual editor for manga translations into Thai. For each numbered pair you get the "
    "SOURCE segment and its THAI translation. Decide ONLY whether the Thai translation OMITS a whole clause or "
    "piece of content that the source states. Ignore style, typos, wording preferences and slight nuance shifts. "
    "Reply with ONLY a JSON array of objects with i (0-based) and omitted (true/false); include missing (the "
    "omitted words) when omitted is true. No prose, no code fences."
)
_EN_WORD = re.compile(r"[A-Za-z][A-Za-z']+")


def enabled(env=None):
    """MIT_OMISSION_VERIFY=1/true/on enables the pass; unset keeps the old byte-identical path."""
    value = str((env or os.environ).get('MIT_OMISSION_VERIFY', '')).strip().lower()
    return value in ('1', 'true', 'yes', 'on')


def collect_candidates(regions, min_words=8):
    """[{"idx", "src", "dst"}] for long source lines with a non-empty Thai answer."""
    out = []
    for idx, region in enumerate(regions or []):
        src = (getattr(region, 'text', '') or '').strip()
        dst = (getattr(region, 'translation', '') or '').strip()
        if not src or not dst:
            continue
        if len(_EN_WORD.findall(src)) < min_words:
            continue
        out.append({'idx': idx, 'src': src, 'dst': dst})
    return out


def build_prompt(candidates, offset=0):
    lines = ['SOURCE AND TRANSLATION:', '']
    for i, cand in enumerate(candidates):
        lines.append(f"<|{offset + i}|> SR: {cand['src']}")
        lines.append(f"     TH: {cand['dst']}")
    return chr(10).join(lines)


def parse_verdicts(content):
    m = re.search(chr(92) + '[' + '.*' + chr(92) + ']', content or '', re.S)
    if not m:
        return None
    try:
        data = json.loads(m.group(0))
    except Exception:
        return None
    return data if isinstance(data, list) else None


def distribute(verdicts, candidates):
    """{region_idx: missing_text} for verdicts that mark an omission."""
    out = {}
    for item in verdicts or []:
        if not isinstance(item, dict) or not item.get('omitted'):
            continue
        i = item.get('i')
        if isinstance(i, int) and 0 <= i < len(candidates):
            out[candidates[i]['idx']] = str(item.get('missing') or '')
    return out


def build_query(src, missing):
    """Retry query: the source plus a note naming what the previous answer dropped."""
    note = '[note: the previous answer omitted part of this line'
    if missing:
        note += ' (missing: ' + missing[:80] + ')'
    note += '. Translate the WHOLE line; do not drop clauses.]'
    return src + chr(10) + chr(10) + note


def better_translation(old, new):
    """Accept only a longer, non-empty answer (a dropped clause means the retry carries more content)."""
    new = (new or '').strip()
    if not new:
        return False
    return len(new) >= len((old or '').strip()) + 3


def apply_results(regions, missing_by_idx, translated):
    """Write accepted retries onto the regions; returns the number applied."""
    applied = 0
    for pos, region_idx in enumerate(missing_by_idx):
        if pos >= len(translated or []):
            break
        region = regions[region_idx]
        old = getattr(region, 'translation', '') or ''
        new = translated[pos]
        if better_translation(old, new):
            region.translation = new.strip()
            applied += 1
    return applied


def _call(base, key, model, user, timeout=120):
    import requests
    body = {'model': model, 'max_tokens': 2048, 'temperature': 0,
            'response_format': {'type': 'json_object'},
            'messages': [{'role': 'system', 'content': _SYSTEM}, {'role': 'user', 'content': user}]}
    resp = requests.post(base, headers={'Authorization': 'Bearer ' + key}, json=body, timeout=timeout)
    if resp.status_code != 200:
        return None
    return parse_verdicts(resp.json()['choices'][0]['message']['content'])


async def verify_candidates(candidates, base, key, model, passes=2):
    """{region_idx: missing} agreed by every pass; {} when the verification could not run."""
    if not candidates:
        return {}
    user = build_prompt(candidates)

    async def one_pass():
        return await asyncio.to_thread(_call, base, key, model, user)

    # Run the passes concurrently: they are independent requests, so two-pass agreement costs one round-trip.
    results = await asyncio.gather(*[one_pass() for _ in range(max(1, passes))])
    agreed = None
    for verdicts in results:
        page = distribute(verdicts, candidates)
        agreed = page if agreed is None else {k: v for k, v in agreed.items() if k in page}
    return agreed or {}
