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


SFX_UPLOAD_MAX_SIDE = 768

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


_LINE_ART_READS = 'ーｰ-—―~〜・.○◯'


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
    n = len(stripped_text.strip())
    # #881: a read of only dashes / rings is a balloon arc or a line in the art; 60 live calls, 0 text
    if n and not (set(stripped_text.strip()) - set(_LINE_ART_READS)):
        return False
    # If the line-OCR read real ASCII text it did NOT drop a stylized glyph (#278). A det_sfx box read
    # as 1-2 ASCII marks ('14', 'T') is still junk: hand-lettered lines read that way (#881), and the
    # rescue now transcribes - it answers NONE instead of inventing an SFX.
    if ocr_read_real_text(stripped_text) and not (from_sfx_detection and n <= 2):
        return False
    if n > (4 if from_sfx_detection else 2):
        return False
    if box_w * box_h < area_min or min(box_w, box_h) < side_min:
        return False
    return True


def _to_data_url(crop_rgb: np.ndarray) -> str:
    """HWC RGB uint8 array -> a data URL, downscaled and JPEG-encoded for the vision call.

    The gateway's vision model normalises input to roughly a few hundred pixels anyway, so shipping the full-resolution
    PNG only made the upload large (a 9-candidate SFX page spent 14 s waiting on the batch). 768 px max side keeps the
    lettering legible while cutting the payload several-fold.
    """
    image = Image.fromarray(crop_rgb).convert("RGB")
    if max(image.size) > SFX_UPLOAD_MAX_SIDE:
        scale = SFX_UPLOAD_MAX_SIDE / max(image.size)
        image = image.resize((max(1, int(image.width * scale)), max(1, int(image.height * scale))),
                             Image.LANCZOS)
    buf = io.BytesIO()
    image.save(buf, format="JPEG", quality=85)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


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


#: #881 review: ``swallows_dialogue`` was deleted when the rescue learned to take a container over — its rule
#: lives on as `_containment` inside `resolve_rescue` (one implementation, one threshold).

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
            headers={**_gateway_headers(), "Authorization": "Bearer " + api_key},
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


def _gateway_headers() -> dict:
    """CUSTOM_OPENAI_EXTRA_HEADERS as a dict. OpenCode Go rejects a request without x-opencode-session
    (400 MissingSessionID), which silently failed every rescue call (#881). Read per call so a bad value is
    visible in one place (and testable) rather than frozen at import."""
    import os
    from .extra_headers import parse_extra_headers
    # Read the env var directly: importing translators.keys would pull the translator package (and torch) into
    # the rescue's import path, which the torch-free CI logic gate runs in.
    return parse_extra_headers(os.environ.get('CUSTOM_OPENAI_EXTRA_HEADERS', '')) or {}


TRANSCRIBE_PROMPT = (
    "Transcribe exactly the text lettered in this cropped manga region, in its original language, keeping "
    "punctuation. If it is a sound effect, start the line with 'SFX: '. If there is no lettering, reply NONE. "
    "Reply with the text only.")
TRANSCRIBE_MAX_TOKENS = 512   # the gateway default is a thinking model (#881): leave room before the answer


def parse_transcription(content) -> str:
    """The vision model's transcription on one line; '' for NONE / a refusal / nothing. Pure."""
    if not isinstance(content, str):
        return ''
    text = ' '.join(part.strip() for part in content.strip().splitlines() if part.strip())
    text = re.sub(r'^SFX:\s*', '', text, flags=re.IGNORECASE).strip()
    if text.upper().strip(' .') in _SFX_REFUSALS or text.strip(' .') in _SFX_REFUSALS:
        return ''
    return text


def vlm_transcribe(crop_rgb: np.ndarray, *, api_base: str, api_key: str, model: str,
                   timeout: float = 60.0, post_fn: Optional[Callable] = None, check_lettering: bool = True) -> str:
    """One vision call: crop -> the source text lettered in it, or '' (no lettering / any failure).

    #881: the rescue used to ask for a target-language onomatopoeia, so a hand-lettered DIALOGUE line
    (`I'm glad.`) came back empty and dropped. Transcribing keeps it, and the translator - which sees the
    page image - translates it like any other line, SFX included."""
    if not (api_base and api_key and model):
        return ''
    if check_lettering and not crop_has_lettering(crop_rgb):
        return ''
    if not _breaker.allows():
        return ''
    try:
        if post_fn is None:
            import requests
            post_fn = requests.post
        from .anthropic_messages import (ENV_ANTHROPIC_MODEL, anthropic_endpoint, anthropic_model,
                                        protocol_from_env)
        # #881 review: with the protocol set to anthropic but the model unset, every call would send the OpenAI
        # model id to /messages and fail with a 400 for ever - say so once instead of failing silently.
        anthropic = protocol_from_env() == 'anthropic'
        anthropic_target = anthropic_model('')
        if anthropic and not anthropic_target:
            logger.warning("[OcrVLM] rescue is off: CUSTOM_OPENAI_PROTOCOL=anthropic but %s is unset",
                           ENV_ANTHROPIC_MODEL)
            return ''
        headers = {**_gateway_headers(), "Authorization": "Bearer " + api_key}
        data_url = _to_data_url(crop_rgb)
        if anthropic:
            # Same transport and model as the translator: haiku does not think, so the answer is not lost
            # to a reasoning budget (deepseek returned finish=length now and then, pausing the rescue).
            body = {"model": anthropic_target, "max_tokens": TRANSCRIBE_MAX_TOKENS,
                    "messages": [{"role": "user", "content": [
                        {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg",
                                                     "data": data_url.split(',', 1)[1]}},
                        {"type": "text", "text": TRANSCRIBE_PROMPT}]}]}
            url = anthropic_endpoint(api_base)
            request_headers = {**headers, "anthropic-version": "2023-06-01"}
        else:
            body = {"model": model, "max_tokens": TRANSCRIBE_MAX_TOKENS, "temperature": 0,
                    "messages": [{"role": "user", "content": [
                        {"type": "text", "text": TRANSCRIBE_PROMPT},
                        {"type": "image_url", "image_url": {"url": data_url}}]}]}
            url = api_base.rstrip('/') + "/chat/completions"
            request_headers = headers
        resp = post_fn(url, headers=request_headers, json=body, timeout=timeout)
        # #881 review: the status was never checked, so a 400/401/429 body parsed to content='' and the rescue
        # dropped the line while telling the breaker everything was fine - the original #881 failure, silently.
        status = int(getattr(resp, 'status_code', 200) or 200)
        if status != 200:
            logger.warning("[OcrVLM] transcription HTTP %s: %s", status,
                           str(getattr(resp, 'text', ''))[:200])
            _breaker.fail(model)
            return ''
        data = resp.json()
        if anthropic:
            blocks = data.get('content') or []
            content = ''.join(b.get('text', '') for b in blocks if b.get('type') == 'text')
            finish = {'end_turn': 'stop', 'stop_sequence': 'stop'}.get(data.get('stop_reason'), data.get('stop_reason'))
            if not blocks:   # a 200 with no content blocks is not an answer
                content = None
        else:
            choice = data["choices"][0]
            content = choice["message"]["content"]
            finish = choice.get("finish_reason")
        if content is None or (finish is not None and finish != 'stop'):
            logger.warning("[OcrVLM] transcription unusable: finish_reason=%s content=%r", finish, content)
            _breaker.fail(model)
            return ''
        _breaker.ok()
        return parse_transcription(content)
    except Exception:
        logger.warning("[OcrVLM] transcription failed - region will drop as before", exc_info=True)
        _breaker.fail(model)
        return ''


async def transcribe_candidates(crops, *, api_base, api_key, model, check_lettering=None, worker=None):
    """Transcribe independent crops concurrently (threads), preserving order. ``check_lettering`` is one flag
    per crop (default all True): placeholders already proved their ink and skip the SFX ink gate."""
    import asyncio
    worker = worker or vlm_transcribe
    checks = check_lettering or [True] * len(crops)
    return list(await asyncio.gather(*[
        asyncio.to_thread(worker, crop, api_base=api_base, api_key=api_key, model=model, check_lettering=check)
        for crop, check in zip(crops, checks)]))


def _norm(text: str) -> str:
    return re.sub(r'[^0-9a-z\u0080-\uffff]', '', (text or '').lower())


def transcription_covers(transcript: str, swallowed_texts) -> bool:
    """True when a container's transcription repeats every dialogue line it swallows, so the container
    can replace them (#881: `Kurose -kun, you...` swallowed the separately read `Kurose`). Pure."""
    texts = [t for t in swallowed_texts if _norm(t)]
    return bool(texts) and all(_norm(t) in _norm(transcript) for t in texts)


def guessed_box(region) -> bool:
    """A region a detector GUESSED rather than read: det_sfx provenance or an empty-balloon / ink-cluster
    placeholder (#881: the `Kurose -kun, you...` lettering came in as an ink-cluster placeholder read '14').
    Such boxes get the transcription rescue. Pure."""
    return bool(getattr(region, 'from_sfx_detection', False) or getattr(region, 'rescue_placeholder', False))


def keep_ocr_line(line, below_floor: bool) -> bool:
    """Whether an OCR'd textline goes on to the merge (#881). A read line needs text; a box a detector only
    GUESSED (det_sfx, empty-balloon / ink-cluster placeholder) is kept even when its line read failed, so
    the transcription rescue can read it - the 48px OCR cannot read big hand-lettered or stylised text. Pure."""
    if getattr(line, 'is_sfx', False) or getattr(line, 'rescue_placeholder', False):
        return True
    return not below_floor and bool(str(getattr(line, 'text', '') or '').strip())


def _containment(inner, outer) -> float:
    iw = min(inner[2], outer[2]) - max(inner[0], outer[0])
    ih = min(inner[3], outer[3]) - max(inner[1], outer[1])
    if iw <= 0 or ih <= 0:
        return 0.0
    return iw * ih / max(1.0, float((inner[2] - inner[0]) * (inner[3] - inner[1])))


def resolve_rescue(box, transcript: str, dialogue):
    """What to do with a transcribed rescue box (#881). ``dialogue`` is ``[(box, text, key), ...]`` of the
    regions the OCR read normally. Returns ``(verdict, keys_to_remove, reason)`` — the reason is logged, so a
    drop says WHY it dropped (#881 review: every non-kept transcript used to log "repeats an overlapping line",
    which was not true of the container cases). Pure.

    - nothing transcribed -> drop (as before);
    - the box swallows dialogue lines (>=70 % inside it): it replaces them only when its transcription
      repeats all of them and adds text (`Kurose -kun, you...` over a separately read `Kurose`), else drop
      (#887 r3; a panel-sized ink cluster that just repeats a bubble);
    - it overlaps a line and the two texts repeat each other -> the #278 phantom over a bubble, drop;
    - otherwise it is text the OCR lost -> keep."""
    if not _norm(transcript):
        return 'drop', [], 'nothing read'
    swallowed = [(t, k) for b, t, k in dialogue if _containment(b, box) >= 0.7]
    if swallowed:
        texts = [t for t, _ in swallowed]
        # it must repeat them AND add text the OCR lost; a box that only repeats them adds nothing
        adds = len(_norm(transcript)) >= sum(len(_norm(t)) for t in texts) + 3
        if adds and transcription_covers(transcript, texts):
            return 'takeover', [k for _, k in swallowed], 'replaces the lines it swallows'
        return 'drop', [], 'swallows a dialogue line it does not repeat'
    mine = _norm(transcript)
    for b, t, _ in dialogue:
        # #881 review: "any overlap at all" dropped a real two-letter Latin SFX that clipped a bubble edge
        # ('HA' over 'WHAT?!'). The phantom sits INSIDE the line it repeats, so require half of the box to be in it.
        if _containment(box, b) >= 0.5:
            theirs = _norm(t)
            if theirs and (mine in theirs or theirs in mine):
                return 'drop', [], 'repeats an overlapping line'
    return 'keep', [], 'transcribed'


async def localize_candidates(crops, *, api_base, api_key, model, target_lang, worker=None):
    """Localize independent SFX crops concurrently, preserving order.

    The pipeline used to call vlm_localize_sfx once per candidate in a loop: a page with seven SFX candidates spent
    ~32 s in textline_merge because each blocking vision call takes 4-5 s. The calls are independent, so they run in
    threads and the stage waits once. `worker` is injectable for tests.
    """
    import asyncio

    worker = worker or vlm_localize_sfx
    tasks = [
        asyncio.to_thread(worker, crop, api_base=api_base, api_key=api_key, model=model,
                          target_lang=target_lang)
        for crop in crops
    ]
    return list(await asyncio.gather(*tasks))
