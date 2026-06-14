"""Feasibility probe v2 — real Flux.2 Klein-4B edit on the RAW One-Punch page.

v1 proved the per-page transformer footprint fits (~5.8GB, transformer resident).
v2 downloads the 8GB text-encoder, encodes the fixed "remove all text" instruction
ONCE, runs a real 4-step Klein edit on the raw JP benchmark page, and saves the
output so we can eyeball band/hair texture + the big SFX removal.

Run: MIT/.venv/Scripts/python.exe tools/probe_flux_klein_v2.py
"""
import os, time, traceback
import torch
from PIL import Image
from huggingface_hub import hf_hub_download, snapshot_download

GGUF_REPO = "unsloth/FLUX.2-klein-4B-GGUF"
GGUF_FILE = "flux-2-klein-4b-Q4_K_M.gguf"
BASE_REPO = "black-forest-labs/FLUX.2-klein-4B"
SRC = "tools/_bubble_proof/benchmark_before.png"     # raw JP One-Punch page
OUT = "tools/_flux_proof/klein_remove_text.png"
PROMPT = ("Remove all Japanese text, sound effects and speech-bubble lettering from "
          "this manga page. Leave the speech bubbles empty and white. Keep the original "
          "line art, screentones, hair, and character artwork completely intact and unchanged.")
STEPS = 4

def vram():
    free, total = torch.cuda.mem_get_info(); return (total-free)/1e9
def banner(s): print(f"\n=== {s} ===", flush=True)

def main():
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    print("baseline VRAM GB", round(vram(),2), flush=True)

    banner("download full Klein-4B (text_encoder 8GB + vae + configs) — transformer from GGUF")
    gguf_path = hf_hub_download(GGUF_REPO, GGUF_FILE)
    base_dir = snapshot_download(BASE_REPO, ignore_patterns=[
        "transformer/*", "flux-2-klein-4b.safetensors"])   # skip fp16 transformer (use GGUF)
    print("base:", base_dir, flush=True)

    banner("build full pipeline (GGUF transformer + fp16 text_encoder) + cpu offload")
    from diffusers import (Flux2Transformer2DModel, GGUFQuantizationConfig, Flux2KleinPipeline)
    transformer = Flux2Transformer2DModel.from_single_file(
        gguf_path, quantization_config=GGUFQuantizationConfig(compute_dtype=torch.bfloat16),
        config=os.path.join(base_dir, "transformer"), torch_dtype=torch.bfloat16)
    pipe = Flux2KleinPipeline.from_pretrained(
        base_dir, transformer=transformer, torch_dtype=torch.bfloat16)
    pipe.enable_model_cpu_offload()

    banner("load page + size")
    img = Image.open(SRC).convert("RGB")
    w, h = img.size
    scale = 1024 / max(w, h)
    W, H = (round(w*scale)//32*32, round(h*scale)//32*32)
    img = img.resize((W, H), Image.LANCZOS)
    print(f"src {w}x{h} -> {W}x{H}", flush=True)

    banner(f"real Klein edit, {STEPS} steps")
    torch.cuda.reset_peak_memory_stats()
    t0 = time.time()
    out = pipe(image=img, prompt=PROMPT, height=H, width=W,
               num_inference_steps=STEPS, guidance_scale=4.0,
               generator=torch.Generator().manual_seed(0)).images[0]
    dt = time.time()-t0
    peak = torch.cuda.max_memory_allocated()/1e9
    out.save(OUT)
    print(f"RESULT: {dt:.1f}s/page ({STEPS} steps), peak_alloc={peak:.2f}GB, peak_used={vram():.2f}GB", flush=True)
    print("saved ->", OUT, flush=True)

if __name__ == "__main__":
    try: main()
    except Exception: traceback.print_exc()
