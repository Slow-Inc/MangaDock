"""Forced-failure benchmark for the retry path (#1055) — dev tool, needs the ML stack + gateway.

Windows one page once per arm with a deliberately corrupted first translation, so the quality guards fire on the
first attempt and the translator must re-ask. Compares the default whole-page retry against `MIT_SEGMENT_RETRY=1`:

    <MIT/.venv>/python.exe tools/forced_glitch_retry_bench.py [--reps 3]

Environment: uses MIT/.env for the custom_openai gateway; GPU via CUDA_VISIBLE_DEVICES.
"""
import argparse
import asyncio
import copy
import json
import os
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

IMG = "result/corpus3/en_Boku_no_Kokoro_no_Yabai_Yatsu_c9_p0.png"
_orig = CustomOpenAiTranslator._request_translation
_state = {"armed": True}


def _install():
    async def patched(self, to_lang, prompt):
        resp = await _orig(self, to_lang, prompt)
        if _state["armed"] and "<|1|>" in resp:
            _state["armed"] = False
            return resp.replace("<|1|>", "<|1|>\u8fde", 1)  # CJK char -> foreign_script guard fires
        return resp

    CustomOpenAiTranslator._request_translation = patched


async def _run(segment_retry):
    os.environ["MIT_SEGMENT_RETRY"] = "1" if segment_retry else "0"
    _state["armed"] = True
    font = os.path.join(MIT, "fonts", "Prompt-Regular.ttf")
    tr = MangaTranslator({"use_gpu": True, "kernel_size": 3, "model_dir": os.path.join(MIT, "models"),
                          "font_path": font})
    cfg = copy.deepcopy(TUNED)
    cfg["translator"]["target_lang"] = "THA"
    cfg["translator"].update(source_lang="ENG", source_lang_only=True)
    img = Image.open(os.path.join(MIT, IMG)).convert("RGB")
    t0 = time.perf_counter()
    payload = await tr.translate_patches(img, Config(**cfg))
    return (time.perf_counter() - t0) * 1000, payload


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--reps", type=int, default=3)
    args = ap.parse_args()
    _install()
    results = {"whole": [], "segment": []}
    for rep in range(args.reps):
        for segment in (False, True):
            wall, payload = await _run(segment)
            arm = "segment" if segment else "whole"
            results[arm].append(round(wall))
            line = next((r for r in payload.get("regions") or []
                         if "60NNA" in (r.get("src") or "") or "JUST" in (r.get("src") or "")), None)
            print(f"rep{rep} {arm}: wall={wall:.0f}ms | {line and line.get('src')!r} -> {line and line.get('dst')!r}",
                  flush=True)
    for arm, values in results.items():
        print(arm, "median", sorted(values)[len(values) // 2])
    print(json.dumps(results))


if __name__ == "__main__":
    asyncio.run(main())
