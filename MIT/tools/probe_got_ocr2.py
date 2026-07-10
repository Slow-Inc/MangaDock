"""Probe (#168 ぬ→LOOM, quality-first ladder rung 1): can GOT-OCR2 (native to
transformers 5.9, OCR-specialized) read the stylized ぬ that our 48px OCR drops?
OCRs the ぬ crop + a dialogue + the フッ crop. Throwaway. Run from MIT/."""
import time
from pathlib import Path

import torch
from PIL import Image

PAGE = Path(__file__).parent.parent.parent / "Backend" / "uploads" / "chapters" / \
    "752fc515-72ce-4890-9369-0337ea3a8224" / "d8658a92-f12d-44ad-99ff-9701793a7110.jpg"
CROPS = {"nu_sfx": (67, 366, 326, 518), "dialogue": (86, 23, 258, 274), "futt_sfx": (394, 996, 424, 1053)}
REPO = "stepfun-ai/GOT-OCR-2.0-hf"


def main():
    from transformers import AutoModelForImageTextToText, AutoProcessor
    dev = "cuda" if torch.cuda.is_available() else "cpu"
    t0 = time.time()
    print(f"loading {REPO} on {dev} ...")
    proc = AutoProcessor.from_pretrained(REPO)
    model = AutoModelForImageTextToText.from_pretrained(
        REPO, dtype=(torch.bfloat16 if dev == "cuda" else torch.float32),
        low_cpu_mem_usage=True).to(dev).eval()
    print(f"loaded {time.time()-t0:.1f}s  vram={torch.cuda.memory_allocated()/1e9:.2f}GB")
    page = Image.open(PAGE).convert("RGB")
    for name, box in CROPS.items():
        crop = page.crop(box)
        inputs = proc(crop, return_tensors="pt").to(dev)
        t1 = time.time()
        with torch.no_grad():
            ids = model.generate(**inputs, do_sample=False, max_new_tokens=128,
                                 tokenizer=proc.tokenizer, stop_strings="<|im_end|>")
        text = proc.decode(ids[0, inputs["input_ids"].shape[1]:], skip_special_tokens=True).strip()
        print(f"  [{name}] {time.time()-t1:.1f}s -> {text!r}  ascii={text.encode('ascii','backslashreplace').decode()}")


if __name__ == "__main__":
    main()
