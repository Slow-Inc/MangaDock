"""LLM/gateway contract probes — the layer nothing in the repo looks at today (#688, part of #685).

Four contracts over one SFX rescue call: what we **sent** (request), what the model was actually
**shown** (image), what came **back** (response), and what survived **sanitising**. Together they
are what makes the three defects of 2026-07-28 visible; each is cited at the threshold it justifies
(`docs/reports/benchmarks/2026-07-28-679-sfx-gate.md`).

Two design choices carry the value:

* **The request is captured from the real call.** `capture_sfx_call` runs `vlm_localize_sfx` with
  its `post_fn` seam filled by a recorder, so the probes report on production code. A probe reading
  a hand-written copy of the payload would stay green through exactly the edit it exists to catch.
* **Nothing here calls the gateway.** These contracts inspect what we build and what we parse, so
  they run in the torch-free `mit_logic` gate. Asking the live model whether it can see — the B3
  control probe — is #689's job and is opt-in by construction.

Importing the pipeline is this module's business, not the core's: `ocr_vlm` is torch-free through
#359's lazy package API, which is what lets a probe touch production code and still be gateable.
"""

import base64
import io
import math
from dataclasses import dataclass
from typing import Any, Dict, Optional, Tuple

from PIL import Image

from manga_translator.ocr_vlm import sanitize_sfx, vlm_localize_sfx

from .report import FAIL, OK, WARN, StageReport
from .runner import doctor

# --- thresholds: every one is a measurement, and says so ---------------------------------------

#: The largest completion budget **measured to truncate**: B1 tried 24, 256, 2048 and 8192 and got
#: `finish_reason: length` with `content: None` from each. 8192 is excluded because it burned 59 s
#: rather than returning short, so 2048 is the largest budget with a clean truncating result.
BUDGET_MEASURED_TRUNCATING = 2048

#: The smallest completion budget **measured to complete**: 4096 answered in 795 tokens (B2).
#: Between the two the behaviour is simply unmeasured, and a probe must not claim a boundary
#: nobody located — that band is a `WARN`.
BUDGET_MEASURED_COMPLETING = 4096

#: Visual tokens for the crop the model **did** answer on. The pipeline sends the SFX crop at its
#: native 220x130 (40 tokens by the grid below) and the model reads it as empty; the same crop
#: upscaled x3 (660x390, 336 tokens) is answered. So the true floor lies somewhere in (40, 336]
#: and 336 is only the point measured to work — hence `WARN`, never `FAIL` (#688 U1).
VISION_TOKENS_MEASURED_ANSWERING = 336

#: Qwen2/3-VL packs a 14 px ViT patch and merges 2x2 of them into one visual token, so one token
#: covers a 28 px square. Estimate, not a tokeniser: it is the crop's contribution to the prompt,
#: which is the part a resize changes.
_PX_PER_VISION_TOKEN = 28

#: Refusal forms the model actually emitted, per target script. `sanitize_sfx` filters only
#: NONE / N A / NA / EMPTY, so the prompt's own wording — "reply with an empty line" — returns as a
#: lettered token and gets rendered onto the page. The already-filtered forms stay in the corpus as
#: controls: a change that starts leaking `NONE` should fail this contract too.
_REFUSAL_CORPUS = {
    'LATIN': ('EMPTY LINE', '(no sound effect)', 'NONE', 'N/A', 'NA', 'EMPTY'),
    # B3, live replies to a blank canvas and to a speech bubble: "no sound found", "(speech)",
    # "unrelated". The non-Latin branch guards Latin refusals only, so these come straight through.
    'THA': ('ไม่พบเสียง', '(เสียงพูด)', 'ไม่เกี่ยว', 'NONE', 'NA'),
}


def _vision_tokens(width: int, height: int) -> int:
    """The crop's estimated visual-token count on a 28 px grid."""
    return math.ceil(width / _PX_PER_VISION_TOKEN) * math.ceil(height / _PX_PER_VISION_TOKEN)


@dataclass
class SfxCall:
    """One SFX rescue call, as the code built it and as the parse read it back.

    `request` is the JSON body only. The Authorization header is deliberately not captured: these
    reports are committed to benchmark files and pasted into issues, and a captured header would
    put a live gateway key in git.
    """

    request: Dict[str, Any]
    response: Dict[str, Any]
    result: str
    target_lang: str = 'ENG'
    image_size: Tuple[int, int] = (0, 0)
    image_mode: str = ''
    image_is_blank: bool = False

    @property
    def budget(self) -> int:
        return self.request.get('max_tokens') or 0

    @property
    def thinking(self) -> str:
        """`unset` is itself the finding: `ocr_vlm` never calls the thinking helpers the
        translator path uses, so the model reasons by default and spends the budget doing it."""
        kwargs = self.request.get('chat_template_kwargs') or {}
        if 'enable_thinking' not in kwargs:
            return 'unset'
        return 'on' if kwargs['enable_thinking'] else 'off'

    @property
    def vision_tokens(self) -> int:
        return _vision_tokens(*self.image_size)

    def to_metrics(self) -> Dict[str, Any]:
        """The request-side summary the `vlm-send` row reports. Key-free by construction."""
        return {
            'model': self.request.get('model') or '(unset)',
            'max_tokens': self.budget,
            'thinking': self.thinking,
        }


@dataclass
class DoctorPage:
    """What a Doctor walk carries. A probe reads the field it needs and stands down (returns
    `None`) when the page does not carry it, so the LLM contracts and #687's dump-replay probes
    can share one registry without either inventing rows about a stage it never saw."""

    sfx_call: Optional[SfxCall] = None


def capture_sfx_call(crop_rgb, *, response: Dict[str, Any], target_lang: str = 'ENG',
                     model: str = 'qwen3.6-35b-a3b', api_base: str = 'https://gateway.invalid/v1',
                     api_key: str = 'doctor-placeholder') -> SfxCall:
    """Run the real `vlm_localize_sfx` against a recorded `response` and keep what it built.

    The HTTP call is the only thing replaced. Prompt assembly, PNG encoding, response parsing and
    sanitising are all production code, so every contract below is measured against the shipping
    implementation rather than a description of it.
    """
    captured: Dict[str, Any] = {}

    class _Recorded:
        @staticmethod
        def json():
            return response

    def _record(url, headers=None, json=None, timeout=None):
        captured.update(json or {})
        return _Recorded()

    result = vlm_localize_sfx(crop_rgb, api_base=api_base, api_key=api_key, model=model,
                              target_lang=target_lang, post_fn=_record)
    size, mode, blank = _inspect_image(captured)
    return SfxCall(request=captured, response=response, result=result, target_lang=target_lang,
                   image_size=size, image_mode=mode, image_is_blank=blank)


def _inspect_image(request: Dict[str, Any]) -> Tuple[Tuple[int, int], str, bool]:
    """Decode the image the request carries, the way the gateway would."""
    try:
        parts = request['messages'][0]['content']
        url = next(p['image_url']['url'] for p in parts if p.get('type') == 'image_url')
        image = Image.open(io.BytesIO(base64.b64decode(url.split(',', 1)[1])))
        low, high = image.convert('L').getextrema()
        return image.size, image.mode, low == high
    except Exception:
        return (0, 0), '', False


# --- the four contracts -------------------------------------------------------------------------

@doctor.probe('vlm-send')
def _request_contract(page) -> Optional[StageReport]:
    """Is the call we build one the configured model can answer at all?"""
    call = getattr(page, 'sfx_call', None)
    if call is None:
        return None
    metrics = call.to_metrics()
    if not call.request.get('model'):
        return StageReport('vlm-send', FAIL, metrics, 'no model configured — the call cannot run')
    if call.budget <= BUDGET_MEASURED_TRUNCATING:
        return StageReport(
            'vlm-send', FAIL, metrics,
            f'budget {call.budget} <= {BUDGET_MEASURED_TRUNCATING} measured to truncate; '
            f'{BUDGET_MEASURED_COMPLETING} completed. thinking={call.thinking} — reasoning tokens '
            'are spent from this budget before any answer is written')
    if call.budget < BUDGET_MEASURED_COMPLETING:
        return StageReport(
            'vlm-send', WARN, metrics,
            f'budget {call.budget} is between the measured truncating ({BUDGET_MEASURED_TRUNCATING}) '
            f'and completing ({BUDGET_MEASURED_COMPLETING}) points — unmeasured')
    return StageReport('vlm-send', OK, metrics)


@doctor.probe('vlm-image')
def _image_contract(page) -> Optional[StageReport]:
    """Is the model shown something it can read? B3 is why this cannot be checked downstream:
    the model answers confidently over a blank canvas, so a bad crop produces a plausible SFX."""
    call = getattr(page, 'sfx_call', None)
    if call is None:
        return None
    width, height = call.image_size
    metrics = {'size': f'{width}x{height}', 'mode': call.image_mode,
               'vision_tokens_est': call.vision_tokens}
    if not width or not height:
        return StageReport('vlm-image', FAIL, metrics, 'no image in the request, or it did not decode')
    if call.image_mode != 'RGB':
        return StageReport('vlm-image', FAIL, metrics, f'mode {call.image_mode!r}, expected RGB')
    if call.image_is_blank:
        return StageReport('vlm-image', FAIL, metrics,
                           'blank canvas — a uniform crop still draws a confident onomatopoeia (B3)')
    if call.vision_tokens < VISION_TOKENS_MEASURED_ANSWERING:
        return StageReport(
            'vlm-image', WARN, metrics,
            f'~{call.vision_tokens} visual tokens, below the {VISION_TOKENS_MEASURED_ANSWERING} '
            'measured to be answered (same crop upscaled x3). Provisional: one measurement, so the '
            'floor is somewhere above this size, not at that number')
    return StageReport('vlm-image', OK, metrics)


@doctor.probe('vlm-recv')
def _response_contract(page) -> Optional[StageReport]:
    """Did a reply actually arrive? Today a truncated one collapses to `''`, which is
    indistinguishable from "this region has no SFX" — the silence that cost 2026-07-11 its
    diagnosis."""
    call = getattr(page, 'sfx_call', None)
    if call is None:
        return None
    try:
        choice = call.response['choices'][0]
        finish = choice.get('finish_reason')
        content = choice['message']['content']
    except (KeyError, IndexError, TypeError):
        return StageReport('vlm-recv', FAIL, {'payload': 'unreadable'},
                           'response is not an OpenAI chat completion — nothing to parse')
    metrics = {'finish_reason': str(finish), 'content': str(content)}
    if content is None or finish != 'stop':
        return StageReport('vlm-recv', FAIL, metrics,
                           f'no usable reply (finish_reason={finish}, content={content}) at '
                           f'max_tokens={call.budget} — the rescue returns {call.result!r}, which '
                           'reads downstream as "no SFX here"')
    return StageReport('vlm-recv', OK, metrics)


@doctor.probe('sanitize')
def _sanitise_contract(page) -> Optional[StageReport]:
    """Does a refusal survive as a lettered token? Anything that does gets rendered onto artwork."""
    call = getattr(page, 'sfx_call', None)
    if call is None:
        return None
    corpus = _REFUSAL_CORPUS.get(call.target_lang, _REFUSAL_CORPUS['LATIN'])
    leaked = [(form, out) for form, out in
              ((f, sanitize_sfx(f, call.target_lang)) for f in corpus) if out]
    metrics = {'target': call.target_lang, 'checked': len(corpus), 'leaked': len(leaked)}
    if leaked:
        return StageReport('sanitize', FAIL, metrics,
                           '; '.join(f'{form!r} -> {out!r}' for form, out in leaked))
    return StageReport('sanitize', OK, metrics)
