"""LLM-judged translation audit over Pipeline Doctor pages (quality loop, 2026-10-22).

    <MIT/.venv>/python.exe tools/judge_translations.py <out.json> [doctor_json ...]

Sends each page's (SOURCE, TRANSLATION) pairs — in the pipeline's reading order — to the
custom_openai gateway with a strict editor prompt and stores a 0-2 faithfulness score per segment.
Segments are judged in chunks of 6 because a whole dense page can exceed the completion budget
(a qwen3-style thinking model truncated 21/39 pages at 2048 tokens in the first run).

CAVEAT (measured): the judge is reliable at the MEANING level (dropped words, nuance shifts,
wrong sense, garbled Thai) but its character-level 'typo' notes are noise — it flagged correctly
stacked Thai marks as misspellings while a code-point scan found zero doubled marks. Filter its
notes by those categories before acting on them."""
import argparse
import glob
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
MIT = os.path.dirname(HERE)
sys.path.insert(0, MIT)

from manga_translator import initialize as _initialize_env  # noqa: E402

_SYSTEM = (
    "You are a strict bilingual editor for manga translations into Thai. You receive the source "
    "segments of ONE page (any source language) and the Thai translation of each. Grade EACH segment's "
    "faithfulness on 0-2: "
    "2 = meaning fully preserved and idiomatic Thai; 1 = mostly preserved but awkward/literal/missing "
    "nuance; 0 = wrong/garbled/meaning lost/duplicated. Also give the main problem type when score < 2: "
    "'garbled', 'literal', 'wrong', 'dup', 'name', 'fragment' (a cut-off word like 'AGAI-' or 'W-' "
    "handled badly), 'other'. Reply with ONLY a JSON array: "
    '[{"i":0,"score":2,"problem":null,"note":""}, ...] No prose, no code fences.'
)


def _pairs(doctor):
    return [(r.get("src") or "", r.get("dst") or "") for r in doctor["regions"]
            if (r.get("src") or "").strip() and (r.get("dst") or "").strip()]


def _judge(pairs, off, base, key, model, timeout=180):
    import requests
    user = "SOURCE AND TRANSLATION:\n" + "\n".join(
        f'<|{off + i}|> SR: {en}\n     TH: {th}' for i, (en, th) in enumerate(pairs))
    body = {"model": model, "max_tokens": 4096, "temperature": 0,
            "messages": [{"role": "system", "content": _SYSTEM},
                         {"role": "user", "content": user}]}
    resp = requests.post(base, headers={"Authorization": "Bearer " + key}, json=body, timeout=timeout)
    content = resp.json()["choices"][0]["message"]["content"] or ""
    match = re.search(r'\[.*\]', content, re.S)
    if not match:
        return None
    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError:
        return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("doctor_json", nargs="*")
    ap.add_argument("--glob", default="", help="e.g. result/doctor/*/*_THA_final.doctor.json")
    ap.add_argument("--chunk", type=int, default=6)
    args = ap.parse_args()

    _initialize_env()
    from manga_translator.translators import keys
    base = keys.CUSTOM_OPENAI_API_BASE.rstrip("/") + "/chat/completions"
    paths = args.doctor_json or sorted(glob.glob(os.path.join(MIT, args.glob)))
    report = {}
    for path in paths:
        with open(path, encoding="utf-8") as fh:
            doctor = json.load(fh)
        pairs = _pairs(doctor)
        if len(pairs) < 2:
            continue
        key = os.path.basename(path).split("_THA")[0]
        scores = []
        for off in range(0, len(pairs), args.chunk):
            part = _judge(pairs[off:off + args.chunk], off, base, keys.CUSTOM_OPENAI_API_KEY,
                          keys.CUSTOM_OPENAI_MODEL)
            if part is None:
                scores = None
                break
            scores.extend(part)
        report[key] = {"n": len(pairs), "scores": scores}
        print(f"{key[:44]:46s} n={len(pairs):3d} " + ("ok" if scores else "PARSE-FAIL"), file=sys.stderr)
    with open(args.out, "w", encoding="utf-8") as fh:
        json.dump(report, fh, ensure_ascii=False, indent=1)

    scored = [s for rec in report.values() for s in (rec["scores"] or []) if isinstance(s.get("score"), int)]
    if scored:
        mean = sum(s["score"] for s in scored) / len(scored)
        print(f"segments {len(scored)} mean {mean:.2f}/2")


if __name__ == "__main__":
    main()