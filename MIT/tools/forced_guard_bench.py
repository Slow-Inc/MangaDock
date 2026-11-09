"""Forced guard verification (#1039 filler, #1052 LOST->หายาก) — dev tool, needs ML stack + gateway.

Injects a known-bad translation for one prompt line on the first request, so the quality guard must fire and the
retry must produce a clean line. Verifies *live* that:

- the guard re-asks (request count >= 2),
- the final payload no longer contains the bad pattern.

    <MIT/.venv>/python.exe tools/forced_guard_bench.py [--pattern lost|filler|both]
"""
import argparse
import asyncio
import copy
import json
import os
import re
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
MIT = os.path.dirname(HERE)
sys.path.insert(0, MIT)
sys.path.insert(0, HERE)

from manga_translator import initialize as _initialize_env  # noqa: E402

_initialize_env()

from bench_render_tuned import TUNED  # noqa: E402
from manga_translator import Config, MangaTranslator  # noqa: E402
from manga_translator.translators.custom_openai import CustomOpenAiTranslator  # noqa: E402
from PIL import Image  # noqa: E402

PAGE = "result/corpus/en_Otome_Game_Sekai_wa_Mob_ni_Kib_c3_p0.png"
_orig = CustomOpenAiTranslator._request_translation
_state = {"armed": True, "pattern": None, "hits": 0, "requests": 0}

_PROMPT_LINE = re.compile(r"<\|(\d+)\|>([^\n]*)")


def _install(pattern):
    async def patched(self, to_lang, prompt):
        _state["requests"] += 1
        resp = await _orig(self, to_lang, prompt)
        if not _state["armed"]:
            return resp
        idx = None
        for m in _PROMPT_LINE.finditer(prompt):
            src = m.group(2).upper()
            if pattern == "lost" and "LOST" in src and "RARE" not in src:
                idx = int(m.group(1))
            elif pattern == "filler" and idx is None and len(src.strip()) > 8 and "LOST" not in src:
                idx = int(m.group(1))
        if idx is None:
            return resp
        bad = "ของหายาก" if pattern == "lost" else "ฉันทันทำแบบนั้น"
        pat = re.compile(r"(<\|%d\|>)([^\n]*)" % idx)
        new = pat.sub(lambda mm: mm.group(1) + bad, resp, count=1)
        if new != resp:
            _state["armed"] = False
            _state["hits"] += 1
        return new

    CustomOpenAiTranslator._request_translation = patched


async def _run(pattern):
    _state.update({"armed": True, "pattern": pattern, "hits": 0, "requests": 0})
    cfg = copy.deepcopy(TUNED)
    cfg["translator"]["target_lang"] = "THA"
    cfg["translator"].update(source_lang="ENG", source_lang_only=True)
    font = os.path.join(MIT, "fonts", "Prompt-Regular.ttf")
    tr = MangaTranslator({"use_gpu": True, "kernel_size": 3, "model_dir": os.path.join(MIT, "models"),
                          "font_path": font})
    img = Image.open(os.path.join(MIT, PAGE)).convert("RGB")
    t0 = time.perf_counter()
    payload = await tr.translate_patches(img, Config(**cfg))
    wall = (time.perf_counter() - t0) * 1000
    dumps = [(r.get("src") or "", r.get("dst") or "") for r in payload.get("regions") or []]
    bad_left = [d for d in dumps if ("ของหายาก" in d[1] if pattern == "lost" else "ฉันทัน" in d[1])]
    return {"pattern": pattern, "wall_ms": round(wall), "requests": _state["requests"],
            "injected": _state["hits"], "bad_left": bad_left,
            "target_lines": [d for d in dumps if "LOST" in d[0].upper()][:3]}


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pattern", choices=["lost", "filler", "both"], default="both")
    args = ap.parse_args()
    out = []
    for pattern in (["lost", "filler"] if args.pattern == "both" else [args.pattern]):
        _install(pattern)
        res = await _run(pattern)
        out.append(res)
        print(json.dumps(res, ensure_ascii=False), flush=True)
    print("SUMMARY", json.dumps({"runs": out}, ensure_ascii=False))


if __name__ == "__main__":
    asyncio.run(main())
