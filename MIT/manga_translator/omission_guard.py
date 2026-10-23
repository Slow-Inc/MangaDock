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

_SYSTEM = 'You are a strict bilingual editor for manga translations into Thai. For each numbered pair you get the SOURCE segment and its THAI translation. Decide ONLY whether the Thai translation OMITS a whole clause or piece of content that the source states (e.g. a sentence part dropped, a listed item missing). Ignore style, typos, wording preferences and slight nuance shifts - those are not omissions. Reply with ONLY a JSON array [{"i":0,"omitted":true,"missing":"..."},{"i":1,"omitted":false}] with one entry per pair. No prose, no code fences.'

_EN_WORD = re.compile(r"[A-Za-z][A-Za-z']+")


def enabled(env=None):
    """MIT_OMISSION_VERIFY=1/true/on enables the pass; unset keeps the old byte-identical path."""
    value = str((env or os.environ).get('MIT_OMISSION_VERIFY', '')).strip().lower()
    return value in ('1', 'true', 'yes', 'on')


def passes(env=None):
    """MIT_OMISSION_VERIFY_PASSES (default 2): verifier passes that must agree; 1 halves the cost."""
    raw = str((env or os.environ).get('MIT_OMISSION_VERIFY_PASSES', '')).strip()
    try:
        value = int(raw) if raw else 2
    except ValueError:
        return 2
    return min(max(value, 1), 3)


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
    text = (content or "").strip()
    if not text:
        return None
    for candidate in (text, text[text.find("{"): text.rfind("}") + 1], text[text.find("["): text.rfind("]") + 1]):
        if not candidate:
            continue
        try:
            data = json.loads(candidate)
        except Exception:
            continue
        if isinstance(data, list):
            return data
        if isinstance(data, dict):
            if "i" in data or "omitted" in data:
                return [data]
            for value in data.values():
                if isinstance(value, list):
                    return value
    return None

def distribute(verdicts, candidates):
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
    """{region_idx: missing} for candidates every pass agrees dropped a clause.

    Each candidate is sent in its OWN request: the model returned a single-item, wrongly-indexed array when two
    pairs shared a prompt (2026-10-23), so per-line verification trades token count for reliability. The requests
    run concurrently, so the wall cost is still about one round-trip.
    """
    if not candidates:
        return {}

    sem = asyncio.Semaphore(3)  # the gateway rejects a burst of parallel verifier calls

    async def one(cand, pass_no):
        verdicts = None
        for _attempt in range(2):
            async with sem:
                verdicts = await asyncio.to_thread(_call, base, key, model, build_prompt([cand]))
            if verdicts is not None:
                break
        return cand["idx"], distribute(verdicts, [cand])

    jobs = [one(cand, n) for cand in candidates for n in range(max(1, passes))]
    results = await asyncio.gather(*jobs)
    per_candidate = {}
    for idx, page in results:
        per_candidate.setdefault(idx, []).append(page)
    agreed = {}
    for idx, pages in per_candidate.items():
        if len(pages) != max(1, passes):
            continue
        if all(idx in page for page in pages):
            agreed[idx] = next(page[idx] for page in pages if page.get(idx))
    return agreed


