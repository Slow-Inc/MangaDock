"""Feasibility probe (#168 ぬ→LOOM): does PaddleOCR-VL-1.5 (local VLM OCR, the
method MangaTranslator uses) read the stylized ぬ SFX that our 48px manga-OCR
drops? Loads the model on whatever device fits, OCRs the ぬ crop + a dialogue
crop for comparison, prints VRAM. Throwaway. Run from MIT/."""
import os
import time
from pathlib import Path

import torch
from PIL import Image

PAGE = Path(__file__).parent.parent.parent / "Backend" / "uploads" / "chapters" / \
    "752fc515-72ce-4890-9369-0337ea3a8224" / "d8658a92-f12d-44ad-99ff-9701793a7110.jpg"
# (x1,y1,x2,y2): the big ぬ SFX (SFX detector found it, 48px OCR dropped it) + a dialogue box for control
CROPS = {"nu_sfx": (67, 366, 326, 518), "dialogue_what": (86, 23, 258, 274), "futt_sfx": (394, 996, 424, 1053)}
REPO = "PaddlePaddle/PaddleOCR-VL-1.5"


def vram():
    if torch.cuda.is_available():
        return f"{torch.cuda.memory_allocated()/1e9:.2f}GB alloc / {torch.cuda.memory_reserved()/1e9:.2f}GB reserved"
    return "cpu"


def main():
    print(f"page exists={PAGE.exists()} cuda={torch.cuda.is_available()}")
    from transformers import AutoModelForImageTextToText, AutoProcessor
    dev = "cuda" if torch.cuda.is_available() else "cpu"
    t0 = time.time()
    print(f"downloading+loading {REPO} on {dev} ...")
    processor = AutoProcessor.from_pretrained(REPO, trust_remote_code=True)
    model = AutoModelForImageTextToText.from_pretrained(
        REPO, trust_remote_code=True,
        torch_dtype=(torch.bfloat16 if dev == "cuda" else torch.float32),
    ).to(dev).eval()
    print(f"loaded in {time.time()-t0:.1f}s  vram={vram()}")

    page = Image.open(PAGE).convert("RGB")
    for name, (x1, y1, x2, y2) in CROPS.items():
        crop = page.crop((x1, y1, x2, y2))
        messages = [{"role": "user", "content": [
            {"type": "image", "image": crop}, {"type": "text", "text": "OCR:"}]}]
        inputs = processor.apply_chat_template(
            messages, add_generation_prompt=True, tokenize=True,
            return_dict=True, return_tensors="pt").to(model.device)
        t1 = time.time()
        with torch.no_grad():
            out = model.generate(**inputs, max_new_tokens=256)
        text = processor.decode(out[0][inputs["input_ids"].shape[-1]:-1]).strip()
        # ascii-safe so Windows cp1252 console doesn't choke on JP
        print(f"  [{name}] ({x2-x1}x{y2-y1}) {time.time()-t1:.1f}s -> {text!r}  ascii={text.encode('ascii','backslashreplace').decode()}")
    print(f"peak vram={vram()}")


if __name__ == "__main__":
    main()
