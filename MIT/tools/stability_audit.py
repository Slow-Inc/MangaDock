"""Translation-stability audit (quality loop): translate the same page N times and measure how much each
segment's Thai answer changes across runs. A low similarity means the model's wording (and sometimes the
meaning) is not reproducible at the default sampling temperature.

    <MIT/.venv>/python.exe tools/stability_audit.py [--runs 3] [--out stability.json]

Needs the ML stack + the custom_openai gateway. Pages are the three real corpus pages used by the quality loop.
"""
import argparse
import asyncio
import copy
import difflib
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
MIT = os.path.dirname(HERE)
sys.path.insert(0, MIT)
sys.path.insert(0, HERE)

from manga_translator import initialize as _initialize_env  # noqa: E402

_initialize_env()

from bench_render_tuned import TUNED  # noqa: E402
from manga_translator import Config, MangaTranslator  # noqa: E402
from PIL import Image  # noqa: E402

PAGES = [
    ("Boku p0", "result/corpus3/en_Boku_no_Kokoro_no_Yabai_Yatsu_c9_p0.png"),
    ("Otome p0", "result/corpus/en_Otome_Game_Sekai_wa_Mob_ni_Kib_c3_p0.png"),
    ("Maou p0", "result/corpus3/en_Maou_no_Ore_ga_Dorei_Elf_o_Yom_c10_p0.jpg"),
]


def _config():
    cfg = copy.deepcopy(TUNED)
    cfg["translator"]["target_lang"] = "THA"
    cfg["translator"].update(source_lang="ENG", source_lang_only=True)
    return Config(**cfg)


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--runs", type=int, default=3)
    ap.add_argument("--out", default="stability.json")
    args = ap.parse_args()
    font = os.path.join(MIT, "fonts", "Prompt-Regular.ttf")
    tr = MangaTranslator({"use_gpu": True, "kernel_size": 3, "model_dir": os.path.join(MIT, "models"),
                          "font_path": font})
    report = {}
    for name, rel in PAGES:
        image = Image.open(os.path.join(MIT, rel)).convert("RGB")
        runs = []
        for _ in range(args.runs):
            payload = await tr.translate_patches(image, _config())
            runs.append({(x.get("src") or "").strip(): (x.get("dst") or "").strip()
                         for x in payload.get("regions") or []})
        common = set.intersection(*(set(r) for r in runs)) if runs else set()
        buckets = {"stable": [], "moderate": [], "unstable": []}
        for src in common:
            values = [r[src] for r in runs]
            worst = min(difflib.SequenceMatcher(None, values[i], values[j]).ratio()
                        for i in range(len(values)) for j in range(i + 1, len(values)))
            row = {"src": src, "dst": values, "min_ratio": round(worst, 2)}
            buckets["stable" if worst >= 0.85 else "moderate" if worst >= 0.5 else "unstable"].append(row)
        report[name] = {"segments": len(common),
                        **{k: len(v) for k, v in buckets.items()},
                        "unstable_examples": buckets["unstable"][:8]}
        print(f"{name}: segs={len(common)} stable={len(buckets['stable'])} "
              f"moderate={len(buckets['moderate'])} unstable={len(buckets['unstable'])}", flush=True)
    with open(args.out, "w", encoding="utf-8") as fh:
        json.dump(report, fh, ensure_ascii=False, indent=1)


if __name__ == "__main__":
    asyncio.run(main())
