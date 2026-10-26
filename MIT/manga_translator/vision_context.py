"""Scene context for the translator (#1143 Track B5): a per-page analyst pass.

The translator already sees the page image, but it is never told *who* speaks, whether a line is dialogue, a
thought, narration or a sound effect, or how intense it is. A cheap analyst model (claude-haiku-5-5, measured at
9-12 s/page against Luna's 30 s for the same job) reads the page image plus the OCR lines and returns that
structure; the translations then get it as a short block in front of the numbered segments.

Opt-in: ``MIT_VISION_CONTEXT=1``. Everything here fails open - a missing key, a bad JSON answer or a gateway
error returns no context, so a page is never lost because the analyst failed. The pure helpers are torch-free.
"""
import base64
import contextlib
import contextvars
import io
import json
import os

_ANALYST_TIMEOUT_S = 120.0
_block = contextvars.ContextVar('mit_vision_context', default='')


#: ``MIT_VISION_CONTEXT`` values: 'notes' (scene notes in the prompt), 'correct' (the analyst's corrected
#: English replaces the OCR text as the source line), 'both', or 'off'. '1'/'on' mean 'notes'.
_MODES = ('off', 'notes', 'correct', 'both')


def vision_context_mode(env=None) -> str:
    """Which use of the analyst pass is on: 'off' | 'notes' | 'correct' | 'both'."""
    value = str((env if env is not None else os.environ).get('MIT_VISION_CONTEXT', '')).strip().lower()
    if value in ('1', 'true', 'yes', 'on'):
        return 'notes'
    if value in ('correct', 'notes+correct', 'both'):
        return 'both' if value in ('notes+correct', 'both') else 'correct'
    return value if value in _MODES else 'off'


def vision_context_enabled(env=None) -> bool:
    """``MIT_VISION_CONTEXT`` turns the analyst pass on; unset/0 keeps today's prompt byte-identical."""
    return vision_context_mode(env) != 'off'


def _mostly_ascii(text: str) -> bool:
    letters = [c for c in text if not c.isspace()]
    if not letters:
        return False
    return sum(1 for c in letters if ord(c) < 128) / len(letters) >= 0.7


def apply_corrections(regions, hints) -> int:
    """Replace each region's OCR text with the analyst's corrected reading where the fix is safe (pure).

    Only two kinds of change are accepted: the corrected line must be mostly ASCII (the source page is English),
    and its length may not leave the original's 0.5-2x band - that keeps a hallucinated or truncated answer from
    becoming the source line. Returns how many regions were corrected."""
    applied = 0
    for index, region in enumerate(regions or [], start=1):
        hint = (hints or {}).get(index) or {}
        corrected = str(hint.get('corrected') or '').strip()
        current = str(getattr(region, 'text', '') or '').strip()
        if not corrected or not _mostly_ascii(corrected):
            continue
        ratio = len(corrected) / max(1, len(current))
        if not (0.5 <= ratio <= 2.0):
            continue
        if corrected == current:
            continue
        region.text = corrected
        applied += 1
    return applied


def current_vision_context() -> str:
    return _block.get()


@contextlib.contextmanager
def vision_context_scope(block):
    token = _block.set(block or '')
    try:
        yield
    finally:
        _block.reset(token)


PROMPT = """You are a manga analyst. The image is one page from an English manga scan.
Below are OCR lines from that page in reading order, numbered. Some are misread.

Return EXACTLY ONE JSON object, no prose:
{"lines":[{"n":1,"corrected":"<the line as lettered on the page>","speaker":"<short description, e.g. boy in suit>","gender":"m|f|unknown","role":"dialogue|thought|narration|sfx|annotation","emotion":"<1-2 words>"}],"missing":["<lettering the OCR missed>"]}

Rules: use the image to correct OCR; keep the original English; gender is the speaker's; role describes how the
lettering functions on the page."""


def analyst_lines(lines) -> str:
    """The numbered lines block the analyst sees (pure)."""
    return '\n'.join(f'{i + 1}. {str(text or "").strip()}' for i, text in enumerate(lines))


def parse_analyst(text) -> dict:
    """The analyst's JSON as {line number: {corrected, speaker, gender, role, emotion}} (pure, tolerant).

    Models sometimes wrap JSON in a code fence or add a sentence; take the outermost object and ignore the rest.
    A line the analyst could not read keeps an empty corrected field and is dropped by format_context."""
    raw = str(text or '')
    start, end = raw.find('{'), raw.rfind('}')
    if start < 0 or end <= start:
        return {}
    try:
        data = json.loads(raw[start:end + 1])
    except ValueError:
        return {}
    out = {}
    for item in data.get('lines') or []:
        try:
            n = int(item.get('n'))
        except (TypeError, ValueError):
            continue
        out[n] = {
            'corrected': str(item.get('corrected') or '').strip(),
            'speaker': str(item.get('speaker') or '').strip(),
            'gender': str(item.get('gender') or 'unknown').strip().lower(),
            'role': str(item.get('role') or '').strip().lower(),
            'emotion': str(item.get('emotion') or '').strip(),
        }
    return out


def format_context(hints: dict, max_chars: int = 1400) -> str:
    """The block that goes in front of the numbered segments (pure).

    Only lines with a usable role or speaker are listed; a corrected reading is included when the analyst
    disagreed with the OCR (the translator sees both and decides)."""
    rows = []
    for n in sorted(hints or {}):
        h = hints[n]
        bits = [b for b in (h.get('speaker'), h.get('gender') if h.get('gender') in ('m', 'f') else '',
                            h.get('role'), h.get('emotion')) if b]
        if not bits and not h.get('corrected'):
            continue
        line = f"- line {n}: " + ", ".join(bits) if bits else f"- line {n}:"
        if h.get('corrected'):
            line += f" | reads: {h['corrected']}"
        rows.append(line)
    if not rows:
        return ''
    block = ('SCENE NOTES (from the page image: who speaks, what kind of line it is, how it sounds; '
             'use them for pronouns, particles and tone):\n' + '\n'.join(rows))
    return block[:max_chars]


def _encode(img_rgb) -> str:
    from PIL import Image
    im = Image.fromarray(img_rgb).convert('RGB')
    im.thumbnail((1568, 1568))
    buf = io.BytesIO()
    im.save(buf, 'JPEG', quality=85)
    return base64.b64encode(buf.getvalue()).decode()


async def analyse_page(img_rgb, lines) -> dict:
    """One analyst call: the page image + the numbered OCR lines -> parsed hints ({} on any failure)."""
    if img_rgb is None or not len(lines):
        return {}
    import httpx
    from .anthropic_messages import anthropic_endpoint, anthropic_model
    from .extra_headers import parse_extra_headers
    from .translators.keys import (CUSTOM_OPENAI_API_BASE, CUSTOM_OPENAI_API_KEY,
                                   CUSTOM_OPENAI_EXTRA_HEADERS)
    from .tls import ssl_context
    model = anthropic_model('claude-haiku-5-5')
    payload = {'model': model, 'max_tokens': 3000,
               'messages': [{'role': 'user', 'content': [
                   {'type': 'image', 'source': {'type': 'base64', 'media_type': 'image/jpeg',
                                                'data': _encode(img_rgb)}},
                   {'type': 'text', 'text': PROMPT + '\n\nLINES:\n' + analyst_lines(lines)}]}]}
    headers = {'Authorization': 'Bearer ' + CUSTOM_OPENAI_API_KEY, 'anthropic-version': '2023-06-01',
               **(parse_extra_headers(CUSTOM_OPENAI_EXTRA_HEADERS) or {})}
    url = anthropic_endpoint(str(CUSTOM_OPENAI_API_BASE))
    async with httpx.AsyncClient(timeout=_ANALYST_TIMEOUT_S, verify=ssl_context()) as client:
        resp = await client.post(url, headers=headers, json=payload)
    if resp.status_code != 200:
        raise RuntimeError(f'analyst HTTP {resp.status_code}: {resp.text[:200]}')
    data = resp.json()
    text = ''.join(b.get('text', '') for b in data.get('content') or [] if b.get('type') == 'text')
    return parse_analyst(text)
