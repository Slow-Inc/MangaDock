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
import unicodedata
from typing import Callable, Optional

import numpy as np
from PIL import Image

logger = logging.getLogger('manga_translator')

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


def _to_data_url(crop_rgb: np.ndarray) -> str:
    """HWC RGB uint8 array → `data:image/png;base64,...`."""
    buf = io.BytesIO()
    Image.fromarray(crop_rgb).convert("RGB").save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def sanitize_sfx(raw: str, target_lang: str = 'ENG') -> str:
    """Reduce a model reply to a single lettered SFX token: first non-empty line, strip quotes/
    punctuation, collapse spaces, cap at 24 chars. For Latin-script targets it keeps Latin (incl.
    accented) letters and UPPERCASEs (byte-identical to the original ENG behaviour); for non-Latin
    targets (Thai/Chinese/Korean) it keeps that script's letters and does not uppercase (no case).
    Returns '' for empty/refusal-ish replies."""
    if not raw:
        return ''
    line = next((l.strip() for l in raw.splitlines() if l.strip()), '')
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
        if not line:
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
    try:
        if post_fn is None:
            import requests
            post_fn = requests.post
        body = {
            "model": model,
            "max_tokens": 24,
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
        content = data["choices"][0]["message"]["content"]
        return sanitize_sfx(content if isinstance(content, str) else '', target_lang)
    except Exception:
        logger.warning("[OcrVLM] SFX localize failed — region will drop as before", exc_info=True)
        return ''
