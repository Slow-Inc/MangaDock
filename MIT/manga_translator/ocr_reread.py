"""Second-pass OCR for low-confidence lines (opt-in `MIT_OCR_REREAD=1`).

Measured (2026-10-23): the 48px OCR read `TO DEEEND` (prob 0.51) because the detector's textline box clipped the F
edge; re-reading the SAME pixels with the box padded by 30 % gives `TO DEFEND` (prob 0.90), and the translation stops
saying the opposite (`ทำลาย` -> `ปกป้อง`). The fix is a box trim, not extra resolution — so it is cheap and local.

This pass re-reads only Latin lines whose OCR confidence is below a threshold and keeps the new text only when its
confidence improves materially. Pure helpers are unit-tested without the OCR model.
"""
import logging
import os

import numpy as np

logger = logging.getLogger('manga_translator')

#: Re-read a line below this OCR confidence (normal reads sit around 0.85-0.99; the measured misread was 0.51).
PROB_THRESHOLD = 0.65  # tuned: 0.65-0.78 was mostly punctuation churn (round 176 measurements)
#: How much of the line width/height to pad on each side (the measured fix needed ~0.2-0.3).
PAD_RATIO = 0.3
#: The new read must beat the old confidence by this margin before it replaces the text.
PROB_MARGIN = 0.12
#: Never re-read more than this many lines per page (bounds the stage cost).
MAX_REREADS = 6  # tuned with the batched dispatch (one model call per page, so a larger cap is cheap)
#: Latin-ish lines only: letters must dominate and no Thai/CJK may be present (a JP/SFX line is not our target).
_THAI_CJK = set()  # filled lazily below


def reread_enabled(env=None):
    """MIT_OCR_REREAD=1/true/on enables the second pass; unset stays byte-identical."""
    value = str((env or os.environ).get('MIT_OCR_REREAD', '')).strip().lower()
    return value in ('1', 'true', 'yes', 'on')


def _is_latin_line(text):
    text = (text or '').strip()
    letters = [c for c in text if c.isalpha()]
    if len(letters) < 4:
        return False
    if any('\u0E00' <= c <= '\u0E7F' for c in text):
        return False
    if any('\u3040' <= c <= '\u30FF' or '\u4E00' <= c <= '\u9FFF' or '\uAC00' <= c <= '\uD7AF' for c in text):
        return False
    latin = sum(1 for c in letters if c.isascii())
    return latin >= 0.8 * len(letters)


def needs_reread(text, prob, threshold=PROB_THRESHOLD):
    if prob is None:
        return False
    if not _is_latin_line(text):
        return False
    return float(prob) < threshold


def expand_box(pts, width, height, pad_ratio=PAD_RATIO):
    """Return [x1, y1, x2, y2] of the axis-aligned box expanded by pad_ratio and clipped to the image."""
    x1, y1 = pts.min(axis=0)
    x2, y2 = pts.max(axis=0)
    bw, bh = max(1.0, x2 - x1), max(1.0, y2 - y1)
    return (max(0, int(x1 - bw * pad_ratio)), max(0, int(y1 - bh * pad_ratio)),
            min(width, int(x2 + bw * pad_ratio)), min(height, int(y2 + bh * pad_ratio)))


def better_read(old_text, old_prob, new_text, new_prob, margin=PROB_MARGIN):
    """True when the re-read is a different, confident Latin line that clearly beats the first read."""
    new_text = (new_text or '').strip()
    if not new_text or not _is_latin_line(new_text):
        return False
    if new_prob is None or old_prob is None:
        return False
    if new_text == (old_text or '').strip():
        return False
    return float(new_prob) >= float(old_prob) + margin


async def reread_textlines(image, textlines, ocr_key, ocr_config, device, dispatch, verbose=False,
                           threshold=PROB_THRESHOLD, pad_ratio=PAD_RATIO, max_rereads=MAX_REREADS):
    """Re-read low-confidence Latin lines in place; returns the number of replaced reads.

    All candidate crops of one page are pasted into a single canvas and dispatched once - one model call per page
    instead of one per line (measured: a per-crop dispatch costs ~0.27 s of overhead).
    """
    from .utils.generic import Quadrilateral

    candidates = []
    height, width = image.shape[:2]
    for textline in textlines:
        if len(candidates) >= max_rereads:
            break
        old_text = getattr(textline, 'text', '') or ''
        old_prob = getattr(textline, 'prob', None)
        if not needs_reread(old_text, old_prob, threshold):
            continue
        x1, y1, x2, y2 = expand_box(np.array(textline.pts), width, height, pad_ratio)
        crop = image[y1:y2, x1:x2]
        if crop.size == 0:
            continue
        candidates.append({'line': textline, 'old_text': old_text, 'old_prob': old_prob, 'crop': crop})
    if not candidates:
        return 0

    gap = 12
    side = 8
    canvas_w = max(c['crop'].shape[1] for c in candidates) + side * 2
    canvas_h = sum(c['crop'].shape[0] for c in candidates) + gap * (len(candidates) - 1) + side * 2
    canvas = np.full((canvas_h, canvas_w, 3), 255, dtype=np.uint8)
    quads = []
    top = side
    for c in candidates:
        ch, cw = c['crop'].shape[:2]
        canvas[top:top + ch, side:side + cw] = c['crop']
        c['slot'] = (top, top + ch)
        quads.append(Quadrilateral(np.array([[side, top], [side + cw - 1, top], [side + cw - 1, top + ch - 1], [side, top + ch - 1]],
                                               dtype=np.float32), '', 1.0))
        top += ch + gap

    out = await dispatch(ocr_key, canvas, quads, ocr_config, device, verbose)
    changed = 0
    for quad_out in out or []:
        pts = np.array(quad_out.pts)
        cy = float(pts[:, 1].mean())
        slot = None
        for c in candidates:
            a, b = c['slot']
            if a - 2 <= cy <= b + 2:
                slot = c
                break
        if slot is None:
            continue
        new_text = getattr(quad_out, 'text', '') or ''
        new_prob = getattr(quad_out, 'prob', None)
        if not better_read(slot['old_text'], slot['old_prob'], new_text, new_prob):
            continue
        slot['line'].text = new_text.strip()
        slot['line'].prob = new_prob
        changed += 1
        if os.environ.get('MIT_LOG_OCR_REREAD'):
            import sys
            print(f"[ocr-reread] {slot['old_text'].strip()!r} ({slot['old_prob']:.2f}) -> {new_text.strip()!r} "
                  f"({new_prob:.2f})", file=sys.stderr, flush=True)
    if os.environ.get('MIT_LOG_OCR_REREAD'):
        import sys
        print(f'[ocr-reread] page candidates={len(candidates)} accepted={changed}', file=sys.stderr, flush=True)
    return changed
