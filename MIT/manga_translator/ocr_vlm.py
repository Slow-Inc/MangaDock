"""Vision-LLM OCR rescue for stylized SFX (#168 / PRD #172).

The 48px line-OCR can read dialogue but drops big stylized SFX (e.g. ぬ) — it
returns garbage below the prob floor, so the region vanishes before render. This
module sends that region's crop to an OpenAI-compatible **vision** endpoint (the
same gateway the translator already uses — `custom_openai` / 9arm, which accepts
images) and gets back the English onomatopoeia an official translation would
letter there (ぬ → "LOOM"-style). It is the "ocr_method=LLM" idea MangaTranslator
uses, applied surgically to the regions our line-OCR loses.

Kept dependency-light + the HTTP call injectable (`post_fn`) so the
parse/sanitize logic is unit-testable with no network. Any failure returns ''
so the pipeline degrades to its stage-off behaviour (region just drops as before).
"""
import base64
import io
import logging
import re
import time
import unicodedata
from typing import Callable, Optional

import numpy as np
from PIL import Image

logger = logging.getLogger('manga_translator')

#: After this many consecutive unusable or failed rescue calls (truncated / no content / error —
#: the configured model cannot serve the rescue, #693) stop calling: each call cost ~2.5-3 s of
#: page latency for nothing (doctor timing, 2026-10-20). After the cooldown one trial call is let
#: through, so a transient gateway outage does not disable rescue for the life of the server.
#: Completion budget for one rescue call. The configured gateway default is a thinking model
#: (qwen3.8-27b-fp8): measured on the #881 Boku crop it spends ~154 tokens on reasoning before any
#: visible content, so the old 24-token cap was consumed entirely by reasoning — content='' with
#: finish_reason='length', which the caller reads as "no SFX here" (the rescue was a silent no-op).
#: Disabling thinking is not the alternative: the same crop then reads as a junk transliteration.
SFX_MAX_TOKENS = 512
SFX_UNSERVED_LIMIT = 3
SFX_BREAKER_COOLDOWN_S = 300.0
_now = time.monotonic


class _Breaker:
    def __init__(self):
        self.streak = 0
        self.opened_at = 0.0

    def allows(self) -> bool:
        if self.streak < SFX_UNSERVED_LIMIT:
            return True
        if _now() - self.opened_at < SFX_BREAKER_COOLDOWN_S:
            return False
        self.opened_at = _now()  # half-open: one trial call; concurrent pages wait for its verdict
        return True

    def fail(self, model: str) -> None:
        self.streak += 1
        if self.streak >= SFX_UNSERVED_LIMIT:
            logger.warning("[OcrVLM] %d unusable SFX replies in a row — rescue paused for %.0f s "
                           "(if model %s cannot serve it, set MIT_OCR_VLM_RESCUE=0)",
                           self.streak, SFX_BREAKER_COOLDOWN_S, model)
            self.opened_at = _now()

    def ok(self) -> None:
        self.streak = 0


_breaker = _Breaker()


def reset_sfx_breaker() -> None:
    _breaker.ok()

# Languages that letter SFX in Latin script (UPPERCASE convention). CJK/Thai/etc. use their own
# script and have no case — mirrors the CJK-vs-Latin split in manga_translator.py.
_LATIN_SFX_LANGS = {
    'ENG', 'FRA', 'DEU', 'ESP', 'ITA', 'POR', 'NLD', 'POL', 'SWE', 'NOR', 'DAN', 'FIN',
    'CES', 'ROM', 'HUN', 'TUR', 'IND', 'MSA', 'VIE', 'FIL', 'MAL',
}
_SFX_LANG_NAMES = {
    'ENG': 'English', 'THA': 'Thai', 'CHS': 'Chinese', 'CHT': 'Chinese', 'KOR': 'Korean',
    'JPN': 'Japanese', 'FRA': 'French', 'DEU': 'German', 'ESP': 'Spanish', 'VIE': 'Vietnamese',
}
# #278: refusal phrases a vision model returns when it can't read a SFX. English variants are
# compared upper-cased; target-language phrases (Thai/Chinese/Korean/Japanese) compared as-is.
_SFX_REFUSALS = {
    'NONE', 'NA', 'N A', 'EMPTY', 'NO SFX', 'NO TEXT', 'UNKNOWN',
    'ไม่มี', 'ไม่ทราบ', 'ไม่รู้', '无', '無', '没有', '沒有', '없음', '없다', 'なし',
}
# Explicit script instruction so the vision model writes the TARGET script, not the Japanese kana
# of the source SFX (qwen-VL tends to echo Japanese onomatopoeia for a Chinese/Korean request).
_SFX_SCRIPT_HINT = {
    'THA': ' Write it in Thai script only.',
    'CHS': ' Write it in Simplified Chinese characters (汉字) only, never Japanese kana.',
    'CHT': ' Write it in Traditional Chinese characters (漢字) only, never Japanese kana.',
    'KOR': ' Write it in Korean Hangul only, never Japanese kana.',
}


def build_sfx_prompt(target_lang: str = 'ENG') -> str:
    """The vision prompt asking for an onomatopoeia in ``target_lang`` (e.g. 'THA' → Thai SFX).

    For ENG (and Latin-script langs) it keeps the UPPERCASE lettering convention; for non-Latin
    scripts (Thai/Chinese/Korean) it drops UPPERCASE since those scripts have no case and adds an
    explicit script instruction. ENG output is byte-identical to the original hardcoded prompt."""
    name = _SFX_LANG_NAMES.get(target_lang, 'English')
    upper = 'UPPERCASE, ' if target_lang in _LATIN_SFX_LANGS else ''
    return (
        "This image is a cropped sound effect (SFX / onomatopoeia) from a Japanese manga panel. "
        f"Reply with ONLY the {name} onomatopoeia an official {name} manga translation would letter "
        f"in its place, matching the mood of the scene. 1-3 words, {upper}no quotes, no punctuation, "
        "no explanation. If it is not a sound effect, reply with an empty line."
        + _SFX_SCRIPT_HINT.get(target_lang, '')
    )


def ocr_read_real_text(stripped_text: str) -> bool:
    """True when the 48px line-OCR returned readable ASCII letters/digits.

    The stylized SFX the rescue is FOR are the ones the line-OCR DROPS — they come back as
    non-ASCII garbage/CJK ('ぬ', 'サ', 'ぎい'). A clean ASCII read ('W', 'THE', 'M', '8') is
    proof the OCR succeeded on real characters: a dialogue fragment or a det_sfx false-positive
    sitting on a speech bubble — NOT a dropped glyph. Used to (a) skip the vision rescue and
    (b) drop the det_sfx false-positive so its literal fragment ('W'→'ว') is not translated and
    rendered over the dialogue bubble (#278; (b) is ``sfx_false_positive``, #754). Pure."""
    return bool(re.search(r'[A-Za-z0-9]', stripped_text or ''))


def speculative_box(region) -> bool:
    """A region whose every line is a detector's guess rather than a found text line — det_sfx
    boxes or empty-balloon / ink-cluster placeholders (``TextBlock.speculative``, set by the merge).
    Its line-OCR read gets the false-positive DROP."""
    return bool(getattr(region, 'speculative', False))


#: Rescue placeholders: a junk OCR read of a whole box scored <= 0.657, real text >= 0.959
#: (16-page probe, 2026-10-21).
PLACEHOLDER_MIN_PROB = 0.9


def placeholder_junk(region) -> bool:
    """An empty-balloon / ink-cluster placeholder whose line-OCR read is low-confidence — a guess
    at a whole box, not text (#797: 'LIt', 'TAF', 'V' rendered as Thai). Real reads score high."""
    return bool(getattr(region, 'rescue_placeholder', False)) and         float(getattr(region, 'prob', 1.0)) < PLACEHOLDER_MIN_PROB


def sfx_false_positive(stripped_text: str, speculative: bool, box, dialogue_boxes) -> bool:
    """#754 — ADR 026 Addendum DROP: a speculative box (``speculative_box``) the line-OCR read as
    real text that is not an SFX to keep. Narrowed by the 2026-10-20 corpus probe (16 EN pages): every false-positive read a
    single ASCII char off the art ('I', 'v', 'S', '1'), while multi-char reads were real lettering
    ('CHAINSAWMAN', 'Yamai', '491'). A real-text read lying mostly INSIDE a dialogue line ('THE', a
    fragment of a bubble's text) is a false-positive whatever its length; a big SFX merely
    surrounding a small line is not. Pure."""
    if not (speculative and ocr_read_real_text(stripped_text)):
        return False
    if len(stripped_text.strip()) <= 1:
        return True
    from .render_overlap import box_containment
    return any(box_containment(box, d) > 0.5 for d in dialogue_boxes)


def should_rescue_sfx(stripped_text: str, from_sfx_detection: bool, box_w: float, box_h: float,
                      vlm_rescue: bool, area_min: int = 3600, side_min: int = 24) -> bool:
    """#278: gate the vision-gateway SFX rescue on det_sfx PROVENANCE, not a bare length heuristic.

    A region is a stylized-SFX candidate when it came from the det_sfx second pass
    (``merge_sfx_detections`` → ``TextBlock.from_sfx_detection``) — there a short OCR read (≤4 chars)
    is a *misread* SFX worth localizing to the target language. WITHOUT that provenance, fall back to
    a TIGHT ≤2-char rule so a short dialogue line ('HUH?', 'おい', 'は？') sitting in a large bubble is
    not misread as SFX and shipped to the gateway (the bug: any ≤4-char region was rescued, mangling
    short dialogue + adding a ~1-2 s round-trip per region). The box must also be reasonably large
    (area + min side) — a real SFX glyph, not a stray mark. Pure."""
    if not vlm_rescue:
        return False
    # If the line-OCR read real ASCII text it did NOT drop a stylized glyph — rescuing it makes
    # the vision model hallucinate a phantom target-language SFX over the dialogue (#278).
    if ocr_read_real_text(stripped_text):
        return False
    n = len(stripped_text.strip())
    if n > (4 if from_sfx_detection else 2):
        return False
    if box_w * box_h < area_min or min(box_w, box_h) < side_min:
        return False
    return True


def _to_data_url(crop_rgb: np.ndarray) -> str:
    """HWC RGB uint8 array → `data:image/png;base64,...`."""
    buf = io.BytesIO()
    Image.fromarray(crop_rgb).convert("RGB").save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def _is_sfx_refusal(line: str, target_lang: str) -> bool:
    """True when a model reply is a refusal (not a sound effect), so it is dropped rather than
    rendered. A real SFX is never (a) wrapped in parentheses — the model uses parens for
    meta-commentary, e.g. '(no sound effect)' — (b) a restatement of the prompt's own "reply with
    an empty line" instruction, or (c) an explicit negation in the target language (Thai 'ไม่').
    Pure."""
    s = line.strip()
    if s.startswith('(') and ')' in s:
        return True
    letters = re.sub(r'[^a-z]', '', s.lower())
    if 'empty' in letters and 'line' in letters:
        return True
    if target_lang == 'THA' and 'ไม่' in s:
        return True
    return False


def sanitize_sfx(raw: str, target_lang: str = 'ENG') -> str:
    """Reduce a model reply to a single lettered SFX token: first non-empty line, strip quotes/
    punctuation, collapse spaces, cap at 24 chars. For Latin-script targets it keeps Latin (incl.
    accented) letters and UPPERCASEs (byte-identical to the original ENG behaviour); for non-Latin
    targets (Thai/Chinese/Korean) it keeps that script's letters and does not uppercase (no case).
    Returns '' for empty/refusal-ish replies."""
    if not raw:
        return ''
    line = next((l.strip() for l in raw.splitlines() if l.strip()), '')
    if _is_sfx_refusal(line, target_lang):
        return ''
    if target_lang in _LATIN_SFX_LANGS:
        line = re.sub(r'[^A-Za-zÀ-ɏ !\-]', ' ', line)   # letters (incl. accented) + space/!/-
        line = re.sub(r'\s+', ' ', line).strip().upper()
        if not line or line in ('NONE', 'N A', 'NA', 'EMPTY'):
            return ''
    else:
        # Keep letters (L*) AND combining marks (M*) of any script — Thai vowels/tone marks are
        # nonspacing marks that `\w` would strip, breaking the word — plus space/!/-; drop the rest.
        line = ''.join(
            c if (c in ' !-' or unicodedata.category(c)[0] in ('L', 'M')) else ' '
            for c in line
        )
        line = re.sub(r'\s+', ' ', line).strip()
        # #278: refusal guard for the non-Latin branch — a model that declines often replies in
        # Latin ('NONE'/'NA') even for a Thai/Chinese/Korean target; drop it so it isn't kept as a
        # SFX token (the Latin branch already guards this above).
        if not line or line.upper() in ('NONE', 'N A', 'NA', 'EMPTY'):
            return ''
    # #278: refusal guard for BOTH branches — the non-Latin branch keeps L-category letters
    # so an English 'None'/'N A' or a target-language refusal ('ไม่มี'/'没有'/'없음') would
    # otherwise pass as a SFX token.
    if line.strip().upper() in _SFX_REFUSALS or line.strip() in _SFX_REFUSALS:
        return ''
    return line[:24]


def restore_sfx_translations(regions) -> None:
    """Run right after the translate stage's ``apply_translations``: for each region
    the SFX rescue flagged (``region.sfx_rescued``), restore ``translation`` to the
    rescued English text. The translator blanks an already-English single word, which
    would make ``filter_translated_regions`` drop the region before render — this keeps
    the localized SFX. Untagged regions are left exactly as the translator set them."""
    for region in regions:
        if getattr(region, 'sfx_rescued', False):
            region.translation = region.text


#: #887 — a crop with no lettering (blank art, panel borders, clothing lines) must never reach the
#: vision call: the model invents an onomatopoeia for it and the page renders a phantom SFX
#: (Taida p0: 'ฟู่' over plain armour). Measured over the corpus' 20 rescued crops, the 5 real
#: katakana SFX score std >= 78 and >= 15% very-dark pixels; the 15 art/blank crops score lower.
_SFX_MIN_STD = 75.0
_SFX_MIN_DARK = 0.12
#: Lettering is SEVERAL separate strokes: real katakana crops measured 2-7 components >= 1% of the
#: crop, while the single thick arcs/ovals that still slipped through the contrast test scored 1
#: (round 2 of #887).
_SFX_MIN_COMPONENTS = 2
_LUMA = (0.299, 0.587, 0.114)


def crop_has_lettering(crop_rgb: np.ndarray) -> bool:
    """True when a crop has the ink profile of lettering: high contrast and a solid dark core.

    Blank art, panel borders and clothing lines have low contrast and a thin dark fraction - exactly
    the crops the vision model hallucinates SFX on (#887). Pure (numpy only), so the guard is
    testable without a network call."""
    if crop_rgb is None or getattr(crop_rgb, 'size', 0) == 0:
        return False
    gray = np.asarray(crop_rgb, dtype=np.float32)
    if gray.ndim == 3:
        gray = gray[..., :3] @ np.asarray(_LUMA, dtype=np.float32)
    if gray.size == 0:
        return False
    if not (gray.std() >= _SFX_MIN_STD and (gray < 128).mean() >= _SFX_MIN_DARK):
        return False
    return _ink_stroke_count(gray) >= _SFX_MIN_COMPONENTS


def _ink_stroke_count(gray: np.ndarray) -> int:
    """How many separate dark strokes cover at least 1% of the crop: lettering is several, a
    single thick arc or oval - the phantoms that survived the contrast test - is one.

    cv2 is a MIT dependency already; it is imported here so the module stays cheap to import and
    the guard falls back to the contrast verdict rather than dropping rescues if it is missing."""
    try:
        import cv2
    except Exception:  # pragma: no cover - cv2 ships with MIT
        return _SFX_MIN_COMPONENTS
    dark = (gray < 128).astype(np.uint8)
    _count, _labels, stats, _centroids = cv2.connectedComponentsWithStats(dark, connectivity=8)
    min_area = max(8, int(dark.size * 0.01))
    return sum(1 for area in stats[1:, cv2.CC_STAT_AREA] if area >= min_area)

def vlm_localize_sfx(
    crop_rgb: np.ndarray,
    *,
    api_base: str,
    api_key: str,
    model: str,
    target_lang: str = 'ENG',
    timeout: float = 60.0,
    post_fn: Optional[Callable] = None,
) -> str:
    """One vision call: crop → an SFX token in ``target_lang`` (e.g. Thai onomatopoeia) or '' on
    any failure.

    `post_fn(url, headers=, json=, timeout=)` defaults to `requests.post`; inject
    a fake in tests. The response is parsed as an OpenAI chat completion."""
    if not (api_base and api_key and model):
        return ''
    if not crop_has_lettering(crop_rgb):
        logger.debug('[OcrVLM] SFX crop has no lettering - skipped (#887)')
        return ''
    if not _breaker.allows():
        return ''
    try:
        if post_fn is None:
            import requests
            post_fn = requests.post
        body = {
            "model": model,
            "max_tokens": SFX_MAX_TOKENS,
            "temperature": 0,
            "messages": [{"role": "user", "content": [
                {"type": "text", "text": build_sfx_prompt(target_lang)},
                {"type": "image_url", "image_url": {"url": _to_data_url(crop_rgb)}},
            ]}],
        }
        resp = post_fn(
            api_base.rstrip('/') + "/chat/completions",
            headers={"Authorization": "Bearer " + api_key},
            json=body,
            timeout=timeout,
        )
        data = resp.json()
        choice = data["choices"][0]
        content = choice["message"]["content"]
        result = sanitize_sfx(content if isinstance(content, str) else '', target_lang)
        # #694: '' here reads downstream as "no SFX in this region". Say why instead, so a
        # truncated reply is visible without a Doctor run. Degrade-to-'' itself is unchanged.
        finish = choice.get("finish_reason")
        where = f"max_tokens={body['max_tokens']} crop={crop_rgb.shape[1]}x{crop_rgb.shape[0]}"
        if content is None or (finish is not None and finish != 'stop'):
            logger.warning("[OcrVLM] SFX reply unusable: finish_reason=%s content=%s %s",
                           finish, 'None' if content is None else repr(content), where)
            _breaker.fail(model)
            return result
        _breaker.ok()
        if not result:
            logger.warning("[OcrVLM] SFX reply sanitised to empty: %r %s", content, where)
        return result
    except Exception:
        logger.warning("[OcrVLM] SFX localize failed — region will drop as before", exc_info=True)
        _breaker.fail(model)  # a failing call wastes the same page time as a truncated one
        return ''
