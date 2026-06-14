"""Feasibility probe — Flux.2 Klein-4B (GGUF Q4) as an optional MIT inpainter.

Decision question: does a per-page Flux edit fit alongside the 12GB box with the
text-encoder excluded (prompt embeds cached once)?  We load ONLY the Q4 transformer
+ VAE, feed synthetic prompt embeds, run a few denoise steps at a manga-page size,
and report PEAK VRAM + latency.  No 8GB text-encoder download in v1.

Run: MIT/.venv/Scripts/python.exe tools/probe_flux_klein.py
"""
import os, time, gc, traceback
import torch
from huggingface_hub import hf_hub_download, snapshot_download

GGUF_REPO = "unsloth/FLUX.2-klein-4B-GGUF"
GGUF_FILE = "flux-2-klein-4b-Q4_K_M.gguf"          # 2.60 GB
BASE_REPO = "black-forest-labs/FLUX.2-klein-4B"
H, W, STEPS = 768, 512, 4

def vram():
    free, total = torch.cuda.mem_get_info()
    return (total - free) / 1e9

def banner(s): print(f"\n=== {s} ===", flush=True)

def main():
    print("torch", torch.__version__, "cuda", torch.cuda.is_available())
    print("baseline VRAM used GB", round(vram(), 2), flush=True)

    banner("download transformer Q4 GGUF (2.6GB) + base configs/vae (skip 8GB text_encoder)")
    gguf_path = hf_hub_download(GGUF_REPO, GGUF_FILE)
    print("gguf:", gguf_path, flush=True)
    base_dir = snapshot_download(
        BASE_REPO,
        allow_patterns=["model_index.json", "transformer/config.json",
                        "vae/*", "scheduler/*", "tokenizer/*"],
    )
    print("base:", base_dir, flush=True)

    banner("load Q4 transformer from GGUF")
    from diffusers import Flux2Transformer2DModel, GGUFQuantizationConfig, AutoencoderKL, Flux2KleinPipeline
    torch.cuda.reset_peak_memory_stats()
    t0 = time.time()
    transformer = Flux2Transformer2DModel.from_single_file(
        gguf_path,
        quantization_config=GGUFQuantizationConfig(compute_dtype=torch.bfloat16),
        config=os.path.join(base_dir, "transformer"),
        torch_dtype=torch.bfloat16,
    )
    print("transformer loaded in %.1fs" % (time.time() - t0), flush=True)
    print("transformer.config keys sample:", {k: getattr(transformer.config, k, None)
          for k in ["in_channels", "joint_attention_dim", "num_layers", "attention_head_dim"]}, flush=True)

    banner("build pipeline (text_encoder=None, tokenizer=None)")
    pipe = Flux2KleinPipeline.from_pretrained(
        base_dir, transformer=transformer, text_encoder=None, tokenizer=None,
        torch_dtype=torch.bfloat16,
    )
    pipe.to("cuda")                       # transformer resident on GPU (Q4 ~2.6GB) — realistic per-page mode
    print("VRAM after pipeline .to(cuda) GB", round(vram(), 2), flush=True)

    # synthetic prompt embeds — bypass the text encoder (shape derived from transformer config)
    hidden = getattr(transformer.config, "joint_attention_dim", None) or getattr(transformer.config, "in_channels", 64)
    print("using prompt_embeds hidden dim:", hidden, flush=True)

    banner("run %d denoise steps at %dx%d (synthetic embeds)" % (STEPS, W, H))
    from PIL import Image
    img = Image.new("RGB", (W, H), (128, 128, 128))
    torch.cuda.reset_peak_memory_stats()
    t0 = time.time()
    for seq in (32, 64, 256, 512):
        try:
            pe = torch.zeros(1, seq, hidden, dtype=torch.bfloat16, device="cuda")
            out = pipe(image=img, prompt_embeds=pe, height=H, width=W,
                       num_inference_steps=STEPS, guidance_scale=4.0,
                       generator=torch.Generator().manual_seed(0))
            dt = time.time() - t0
            peak = torch.cuda.max_memory_allocated() / 1e9
            print(f"OK seq={seq}: {dt:.1f}s, peak_alloc={peak:.2f}GB, peak_used={vram():.2f}GB", flush=True)
            print("RESULT latency/page (%d steps) = %.1fs ; scale to 28 steps ~= %.0fs" % (STEPS, dt, dt/STEPS*28), flush=True)
            break
        except Exception as e:
            print(f"seq={seq} failed: {type(e).__name__}: {e}", flush=True)
    else:
        print("all synthetic embed shapes failed — see errors above", flush=True)

if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc()
