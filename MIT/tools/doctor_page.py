"""Pipeline Doctor, page mode (#756): run one real page and attribute each defect to its stage.

    <MIT/.venv>/python.exe tools/doctor_page.py <page.png> [more pages...] [--target THA] [--set sec.key=val] [--tag _x] [--out DIR] [--json]

Runs the production patches path (`MangaTranslator.translate_patches` — the one `/translate/
with-form/patches` serves, so bubbles are tagged as in prod) in-process with the tuned config of
`tools/bench_render_tuned.py`, then runs the page probes (`tools/pipeline_doctor/page_probes.py`)
on the returned payload. Writes `<stem>_<target>.rendered.png`, `.doctor.png` (rendered page and
the source with every flagged region outlined by its root stage) and `.doctor.json`.

Reads the pipeline's output only; it does not change the pipeline (feedback-core-boundary).
"""
import argparse
import asyncio
import copy
import io
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
MIT = os.path.dirname(HERE)
sys.path.insert(0, MIT)
sys.path.insert(0, HERE)

from bench_render_tuned import TUNED  # noqa: E402  (also loads MIT/.env via initialize())
from PIL import Image, ImageDraw, ImageFont  # noqa: E402
from manga_translator import MangaTranslator, Config  # noqa: E402
import manga_translator.manga_translator as mt_mod  # noqa: E402
from tools.pipeline_doctor import FAIL, WARN  # noqa: E402
from tools.pipeline_doctor.page_probes import diagnose, replay_translations, snapshot_from_payload  # noqa: E402

_COLOURS = {FAIL: (220, 30, 30), WARN: (240, 150, 0)}


def _spy_textlines(stats):
    """Count what reaches textline_merge: lines, det_sfx lines, empty OCR reads."""
    original = mt_mod.dispatch_textline_merge

    async def spy(textlines, width, height, verbose=False, **kwargs):
        stats['textlines'] = len(textlines)
        stats['sfx_lines'] = sum(1 for t in textlines if getattr(t, 'is_sfx', False))
        stats['empty_reads'] = sum(1 for t in textlines if not (getattr(t, 'text', '') or '').strip())
        return await original(textlines, width, height, verbose, **kwargs)

    mt_mod.dispatch_textline_merge = spy


def _install_replay(tr, recorded):
    """Answer the translation call from a recorded doctor run; only unseen texts go live."""
    live = tr._dispatch_with_context

    async def replay(config, texts, ctx):
        out, missing = replay_translations(list(texts), recorded)
        if missing:
            print(f'[replay] {len(missing)}/{len(texts)} texts unseen -> live translator')
            fresh = await live(config, [texts[i] for i in missing], ctx)
            for i, t in zip(missing, fresh):
                out[i] = t
        return out

    tr._dispatch_with_context = replay


def _composite(source, payload):
    page = source.copy()
    for p in payload.get('patches', []):
        # patches carry an alpha of only their own work (#535 overlap-safe) — composite with
        # it, exactly as the Reader overlays them; pasting the full rectangle hides neighbours.
        patch = Image.open(io.BytesIO(p['img_png'])).convert('RGBA')
        page.paste(patch.convert('RGB'), (p['x'], p['y']), patch.getchannel('A'))
    return page


def _measure_ink(page, rendered):
    """Luminance spread inside each region's dst box on the final page (blank = ~0)."""
    import numpy as np
    gray = np.asarray(rendered.convert('L'), dtype=np.float32)
    h, w = gray.shape
    for r in page.regions:
        if r.render_dst_box is None:
            continue
        x1, y1, x2, y2 = (int(round(v)) for v in r.render_dst_box)
        x1, y1, x2, y2 = max(0, x1), max(0, y1), min(w, x2), min(h, y2)
        if x2 - x1 >= 2 and y2 - y1 >= 2:
            r.dst_ink_std = float(gray[y1:y2, x1:x2].std())


def _overlay(source, rendered, page, flags):
    marked = source.copy()
    draw = ImageDraw.Draw(marked)
    try:
        font = ImageFont.truetype('arial.ttf', max(14, page.height // 70))
    except OSError:
        font = ImageFont.load_default()
    for r in page.regions:
        if r.index not in flags:
            continue
        stage, status = flags[r.index][0]
        colour = _COLOURS.get(status, (0, 160, 0))
        draw.rectangle(r.xyxy, outline=colour, width=4)
        draw.text((r.xyxy[0], max(0, r.xyxy[1] - font.size - 2)), f'{r.index} {stage}', fill=colour, font=font)
    side = Image.new('RGB', (source.width * 2 + 10, source.height), 'white')
    side.paste(marked, (0, 0))
    side.paste(rendered, (source.width + 10, 0))
    return side


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('pages', nargs='+')
    ap.add_argument('--target', default='THA')
    ap.add_argument('--out', default=os.path.join(MIT, 'result', 'doctor'))
    ap.add_argument('--json', action='store_true', help='print the JSON report instead of the table')
    ap.add_argument('--set', action='append', default=[], metavar='SECTION.KEY=VALUE',
                    help='override one config knob, e.g. --set detector.det_bubble_merge=true')
    ap.add_argument('--tag', default='', help='suffix for output files (A/B runs)')
    ap.add_argument('--replay', metavar='DOCTOR_JSON',
                    help='reuse the translations a previous run recorded (deterministic render A/B; '
                         'single page). Unseen texts still go to the live translator.')
    args = ap.parse_args()

    stats = {'textlines': 0, 'sfx_lines': 0, 'empty_reads': 0}
    _spy_textlines(stats)
    cfg = copy.deepcopy(TUNED)
    cfg['translator']['target_lang'] = args.target
    for item in args.set:
        key, value = item.split('=', 1)
        section, name = key.split('.', 1)
        cfg.setdefault(section, {})[name] = json.loads(value) if value[:1] in '[{"0123456789-tfn' else value
    font = os.path.join(MIT, 'fonts', 'Prompt-Bold.ttf')
    tr = MangaTranslator({'use_gpu': True, 'kernel_size': 3, 'model_dir': os.path.join(MIT, 'models'),
                          'font_path': font if os.path.isfile(font) else None})
    if args.replay:
        _install_replay(tr, json.load(open(args.replay, encoding='utf-8')))

    os.makedirs(args.out, exist_ok=True)
    worst = 0
    for path in args.pages:
        source = Image.open(path).convert('RGB')
        payload = await tr.translate_patches(source, Config(**cfg))

        page = snapshot_from_payload(payload, args.target, **stats)
        rendered = _composite(source, payload)
        _measure_ink(page, rendered)
        run, flags = diagnose(page)

        stem = os.path.join(args.out, f'{os.path.splitext(os.path.basename(path))[0]}_{args.target}{args.tag}')
        rendered.save(stem + '.rendered.png')
        _overlay(source, rendered, page, flags).save(stem + '.doctor.png')
        report = {**run.to_json(), 'page': path, 'flags': {str(k): v for k, v in flags.items()},
                  'regions': [{'index': r.index, 'xyxy': r.xyxy, 'src': r.text, 'dst': r.translation,
                               'container': r.bubble_idx, 'container_box': r.bubble_box,
                               'branch': r.render_branch, 'font_px': r.render_font_px,
                               'dst_box': r.render_dst_box} for r in page.regions],
                  'dropped': page.dropped}
        with open(stem + '.doctor.json', 'w', encoding='utf-8') as fh:
            json.dump(report, fh, ensure_ascii=False, indent=1)
        print(f'== {os.path.basename(path)}')
        print(json.dumps(report, ensure_ascii=False, indent=1) if args.json else run.to_table())
        print(f'-> {stem}.doctor.png / .doctor.json\n')
        worst = max(worst, run.exit_code)
    return worst


if __name__ == '__main__':
    sys.exit(asyncio.run(main()))
