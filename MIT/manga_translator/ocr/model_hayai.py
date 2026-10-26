"""Hayai OCR v2.5 Nova as MIT's line recogniser (#1143 Track C candidate).

Crop-level vision-to-text model (SigLIP2 NaFlex + 12-layer decoder, ~150M parameters, Apache-2.0) that reads
dense, stylised, vertical and horizontal text in Japanese, Chinese, Korean and English at native resolution.

Why it is worth a stage slot: the 48 px recogniser warps every crop to a 48 px straight line, which is where
hand-lettered dialogue is lost (Haimiya ch. 6: `I'm glad.` came back empty and `Kurose -kun, you...` as `14`,
so both needed a vision-gateway rescue). Hayai reads those crops directly.

Loaded from the Hugging Face hub into `models/ocr/hayai-ocr-v2.5-nova` on first use; selected per request with
`ocr.ocr = 'hayai'` until it wins the per-stage benchmark and becomes the default.
"""
import math
import os
from typing import List

import numpy as np
import torch
from PIL import Image

from .common import OfflineOCR
from .hayai_post import HAYAI_MIN_CONF, accept_read, clean_text, colors_from_crop
from ..config import OcrConfig
from ..utils import Quadrilateral

REPO_ID = 'JustANormalTinkerer/hayai-ocr-v2.5-nova'
VISION_PROCESSOR = 'google/siglip2-base-patch16-naflex'
LOCAL_DIR_NAME = 'hayai-ocr-v2.5-nova'
PATCH_BUDGET = 512   # the model card's "max quality" setting (CER 3.10 %, small glyphs)
MAX_NEW_TOKENS = 128


def min_confidence() -> float:
    """``MIT_OCR_HAYAI_MIN_CONF`` or the measured floor (-0.35). Env-read so a page can be A/B'd without a deploy."""
    try:
        return float(os.environ.get('MIT_OCR_HAYAI_MIN_CONF', HAYAI_MIN_CONF))
    except ValueError:
        return HAYAI_MIN_CONF


class ModelHayaiOCR(OfflineOCR):
    _MODEL_SUB_DIR = 'ocr'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.model = None
        self.tokenizer = None
        self.processor = None

    @property
    def _local_dir(self):
        return self._get_file_path(LOCAL_DIR_NAME)

    async def _load(self, device: str):
        from huggingface_hub import snapshot_download
        from transformers import AutoModel, AutoProcessor, PreTrainedTokenizerFast
        os.makedirs(self.model_dir, exist_ok=True)
        if not os.path.exists(os.path.join(self._local_dir, 'model.safetensors')):
            # The repo is public; an expired stored token makes the hub answer 401, so ask for anonymous access.
            os.environ.setdefault('HF_HUB_DISABLE_IMPLICIT_TOKEN', '1')
            snapshot_download(REPO_ID, local_dir=self._local_dir)
        self.tokenizer = PreTrainedTokenizerFast.from_pretrained(self._local_dir)
        self.processor = AutoProcessor.from_pretrained(VISION_PROCESSOR)
        # The model's CUDA-graph engine binds to the process's default device, so always load on the plain
        # device string ('cuda'); a '.to("cuda:1")' weight move yields one-character answers.
        self.model = AutoModel.from_pretrained(self._local_dir, trust_remote_code=True).to(device).eval()
        self.device = device

    async def _unload(self):
        self.model = None
        self.tokenizer = None
        self.processor = None

    def _read(self, crop_rgb: np.ndarray):
        """(text, mean token log-likelihood). The likelihood is the confidence the model does not return itself:
        it is what separates real lettering (-0.01 to -0.09 on ch. 6) from text invented over artwork
        (-0.55 to -2.58). One extra forward pass, no second vision call."""
        inputs = self.processor(images=[Image.fromarray(crop_rgb)], max_num_patches=PATCH_BUDGET,
                                return_tensors='pt').to(self.device)
        with torch.no_grad():
            out = self.model.generate(pixel_values=inputs['pixel_values'],
                                      pixel_attention_mask=inputs['pixel_attention_mask'],
                                      spatial_shapes=inputs['spatial_shapes'],
                                      tokenizer=self.tokenizer, max_new_tokens=MAX_NEW_TOKENS,
                                      repetition_penalty=1.0)
        text = clean_text(out[0] if out else '')
        ids = self.tokenizer(text, add_special_tokens=False)['input_ids'] if text else []
        if not ids:
            return '', float('-inf')
        seq = torch.tensor([[self.tokenizer.bos_token_id] + ids], device=self.device)
        with torch.no_grad():
            logits = self.model(pixel_values=inputs['pixel_values'],
                                pixel_attention_mask=inputs['pixel_attention_mask'],
                                spatial_shapes=inputs['spatial_shapes'], text_token_ids=seq)
        logp = torch.log_softmax(logits[0].float(), dim=-1)
        targets = ids + [self.tokenizer.eos_token_id]
        confidence = float(np.mean([float(logp[i, targets[i]]) for i in range(len(targets))]))
        return text, confidence

    def read_crop(self, crop_rgb: np.ndarray) -> str:
        """Read one crop for the rescue path: the text, or '' when the read is below the confidence floor.

        Used by ``manga_translator.ocr_rescue`` in place of the vision gateway (a ~0.13 s local read instead of a
        ~2 s HTTP call), so it applies the same gate the OCR stage does - the caller only ever sees trusted text."""
        text, confidence = self._read(crop_rgb) if getattr(crop_rgb, 'size', 0) else ('', float('-inf'))
        return text if text and accept_read(confidence, min_confidence()) else ''

    @staticmethod
    def _crop(image: np.ndarray, q: Quadrilateral, direction: str) -> np.ndarray:
        """The page pixels inside the detection box, unwarped whenever the box is axis-aligned.

        A crop-level reader wants the picture a human would cut out. The pipeline's usual helper warps the quad
        to a rectangle, which is right for a 48 px line recogniser and wrong here: on ch. 6 p11 it turned
        `Kurose -kun, you...` into `...mob, whats soomy ...now, s soomy`, while the plain box crop reads it
        exactly. Only a genuinely rotated quad keeps the warp (vertical text stays a tall crop; the model reads
        it as it is). Pure."""
        pts = np.asarray(q.pts, dtype=np.float32)
        dx, dy = float(pts[1][0] - pts[0][0]), float(pts[1][1] - pts[0][1])
        angle = abs(math.degrees(math.atan2(dy, dx)))
        if angle <= 8 or angle >= 172:
            box = q.aabb
            x1, y1 = max(0, int(box.x)), max(0, int(box.y))
            return image[y1:int(box.y + box.h), x1:int(box.x + box.w)]
        h = int(q.aabb.h) if direction == 'h' else int(q.aabb.w)
        return q.get_transformed_region(image, direction, max(h, 16))

    async def _infer(self, image: np.ndarray, textlines: List[Quadrilateral], config: OcrConfig,
                     verbose: bool = False) -> List[Quadrilateral]:
        out: List[Quadrilateral] = []
        for q, direction in self._generate_text_direction(textlines):
            # Native resolution on purpose: the model's NaFlex preprocessing handles scaling, while warping the
            # crop to a fixed 48 px strip is exactly what loses hand lettering.
            crop = self._crop(image, q, direction)
            if crop.ndim == 3 and crop.shape[2] == 4:
                crop = crop[:, :, :3]
            text, confidence = self._read(crop) if getattr(crop, 'size', 0) else ('', float('-inf'))
            trusted = bool(text) and accept_read(confidence, min_confidence())
            q.text = text if trusted else ''
            # ``prob`` is the pipeline's quality signal (thresholds, region prob, art-glyph guards); map the
            # likelihood onto it so a junk read ranks below anything the gates expect.
            q.prob = float(np.exp(confidence)) if trusted else 0.0
            fg, bg = colors_from_crop(crop)
            q.fg_r, q.fg_g, q.fg_b = fg
            q.bg_r, q.bg_g, q.bg_b = bg
            if verbose:
                print(f'[hayai] {q.aabb} -> {text!r}')
            out.append(q)
        return out
