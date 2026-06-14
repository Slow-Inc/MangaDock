"""Flux.2 Klein-4B (GGUF Q4) optional, VRAM-neutral inpainter — ADR 003.

Default OFF; selected with ``MIT_INPAINTER=flux_klein``. Where large source text sat over complex/dark
art, LaMa leaves a luminance "band" + a texture gap no classical lever fixes; Klein is an instruction
image-editor ("remove all text, keep art") that reconstructs the texture. We run it on the page and let
the base-class blend keep only the masked patches, so pixels outside the erase mask stay byte-identical
(the #156 patch contract, ADR 004).

VRAM-neutral via three levers (ADR 003): the fixed prompt is encoded ONCE and cached to disk
(:mod:`manga_translator.flux_embed_cache`) so the 8 GB text-encoder never reloads in the per-page loop;
the steady pipeline holds only the Q4 transformer (~2.6 GB) + VAE; and the whole thing is loaded/unloaded
around the inpaint pass. Heavy deps (torch / diffusers / gguf) are imported LAZILY in :meth:`_load`, so
importing this module — and the ``INPAINTERS`` registry — never requires them.
"""
import os

import numpy as np

from .common import OfflineInpainter
from ..config import InpainterConfig
from .. import flux_embed_cache
from ..flux_image_prep import pad_to_multiple, unpad


class FluxKleinInpainter(OfflineInpainter):
    _MODEL_MAPPING = {}   # weights pulled from the HF hub lazily on first load, not a single URL

    _GGUF_REPO = "unsloth/FLUX.2-klein-4B-GGUF"
    _GGUF_FILE = "flux-2-klein-4b-Q4_K_M.gguf"
    _BASE_REPO = "black-forest-labs/FLUX.2-klein-4B"
    _STEPS = 4                 # Klein is step-distilled — ~4 steps is the intended count
    _MAX_SIDE = 1024           # cap the long side so VRAM/latency stay bounded on big pages
    _PROMPT = (
        "Remove all Japanese text, sound effects and speech-bubble lettering from this manga page. "
        "Leave the speech bubbles empty and white. Keep the original line art, screentones, hair, "
        "and character artwork completely intact and unchanged."
    )

    def _build_transformer(self):
        """Load the Q4 GGUF transformer + return (transformer, base_dir). Lazy-downloads on first use."""
        import torch
        from diffusers import Flux2Transformer2DModel, GGUFQuantizationConfig
        from huggingface_hub import hf_hub_download, snapshot_download

        gguf_path = hf_hub_download(self._GGUF_REPO, self._GGUF_FILE)
        base_dir = snapshot_download(
            self._BASE_REPO, ignore_patterns=["transformer/*", "flux-2-klein-4b.safetensors"])
        transformer = Flux2Transformer2DModel.from_single_file(
            gguf_path, quantization_config=GGUFQuantizationConfig(compute_dtype=torch.bfloat16),
            config=os.path.join(base_dir, "transformer"), torch_dtype=torch.bfloat16)
        return transformer, base_dir

    def _encode_prompt_numpy(self, base_dir, prompt):
        """Encode `prompt` with the full text-encoder (CPU-offloaded) and return a numpy embedding.

        Builds its OWN throwaway transformer so the cpu-offload hooks never touch the steady transformer.
        This is the one-time ~9 GB VRAM spike; afterwards the encoder is discarded.
        """
        import torch
        from diffusers import Flux2KleinPipeline
        transformer, _ = self._build_transformer()
        enc = Flux2KleinPipeline.from_pretrained(
            base_dir, transformer=transformer, torch_dtype=torch.bfloat16)
        enc.enable_model_cpu_offload()
        with torch.no_grad():
            prompt_embeds, _ = enc.encode_prompt(prompt=prompt, device=enc._execution_device)
        arr = prompt_embeds.float().cpu().numpy()
        del enc, transformer
        torch.cuda.empty_cache()
        return arr

    async def _load(self, device: str):
        try:
            import torch
            from diffusers import Flux2KleinPipeline
            import gguf  # noqa: F401  (diffusers needs it for the GGUF quant config)
        except ImportError as e:
            raise RuntimeError(
                "MIT_INPAINTER=flux_klein needs `diffusers` + `gguf` (pip install diffusers gguf). "
                "Unset MIT_INPAINTER to fall back to the default LaMa inpainter."
            ) from e

        self.device = device
        cache_dir = self._get_file_path("flux_klein_embed")
        # Encode the fixed prompt once (cached to disk) — the VRAM-neutral lever.
        base_dir_holder = {}

        def _encode(prompt):
            transformer, base_dir = self._build_transformer()
            base_dir_holder["dir"] = base_dir
            return self._encode_prompt_numpy(base_dir, prompt)

        embed = flux_embed_cache.get_embed(_encode, self._PROMPT, cache_dir)
        base_dir = base_dir_holder.get("dir")
        if base_dir is None:                       # embed was a cache hit → still need the base dir
            from huggingface_hub import snapshot_download
            base_dir = snapshot_download(
                self._BASE_REPO, ignore_patterns=["transformer/*", "flux-2-klein-4b.safetensors"])

        embed_dtype = torch.bfloat16
        embed_device = device if device.startswith("cuda") else "cpu"
        self._embed = torch.from_numpy(embed).to(embed_device, dtype=embed_dtype)

        # Steady pipeline: Q4 transformer + VAE only, no text-encoder.
        transformer, _ = self._build_transformer()
        pipe = Flux2KleinPipeline.from_pretrained(
            base_dir, transformer=transformer, text_encoder=None, tokenizer=None,
            torch_dtype=torch.bfloat16)
        if device.startswith("cuda"):
            pipe.to(device)
        self.pipe = pipe

    async def _unload(self):
        for attr in ("pipe", "_embed"):
            if hasattr(self, attr):
                delattr(self, attr)
        try:
            import torch
            torch.cuda.empty_cache()
        except Exception:
            pass

    async def _infer(self, image: np.ndarray, mask: np.ndarray, config: InpainterConfig,
                     inpainting_size: int = 1024, verbose: bool = False) -> np.ndarray:
        import torch
        from PIL import Image

        h, w = image.shape[:2]
        scale = min(1.0, self._MAX_SIDE / max(h, w))
        proc = image
        if scale < 1.0:
            import cv2
            proc = cv2.resize(image, (round(w * scale), round(h * scale)), interpolation=cv2.INTER_AREA)

        padded, orig_hw = pad_to_multiple(proc, 32)
        H, W = padded.shape[:2]
        with torch.no_grad():
            result = self.pipe(
                image=Image.fromarray(padded), prompt_embeds=self._embed, height=H, width=W,
                num_inference_steps=self._STEPS, guidance_scale=4.0,
                generator=torch.Generator().manual_seed(0)).images[0]
        edited = unpad(np.asarray(result), orig_hw)
        if scale < 1.0:
            import cv2
            edited = cv2.resize(edited, (w, h), interpolation=cv2.INTER_AREA)

        # Keep the Klein edit only inside the erase mask; everything else is byte-identical original.
        keep = (mask >= 127)
        if keep.ndim == 2:
            keep = keep[:, :, None]
        return np.where(keep, edited, image).astype(np.uint8)
