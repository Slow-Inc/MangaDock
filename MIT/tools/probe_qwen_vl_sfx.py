"""Probe (#168 ぬ→LOOM, quality ladder rung 2): can a local vision-LLM (Qwen2.5-VL-3B,
native to transformers 5.9) *localize* the stylized ぬ SFX in context — i.e. produce an
English onomatopoeia like "LOOM" the way MangaTranslator's ocr_method=LLM does — where a
pure OCR only yields "ぬ"? Tests 3 crops (tight glyph / glyph+looming figure / full panel)
× an SFX-localization prompt. Throwaway. Run from MIT/ (worker should be unloaded for VRAM)."""
import time
from pathlib import Path

import torch
from PIL import Image

PAGE = Path(__file__).parent.parent.parent / "Backend" / "uploads" / "chapters" / \
    "752fc515-72ce-4890-9369-0337ea3a8224" / "d8658a92-f12d-44ad-99ff-9701793a7110.jpg"
REPO = "Qwen/Qwen2-VL-2B-Instruct"
OUT = Path(__file__).parent / "_bubble_proof" / "qwen_sfx_probe.txt"
# tight ぬ glyph / glyph + the looming creature below it / the whole lower-left panel
CROPS = {"nu_tight": (67, 366, 326, 518), "nu_context": (30, 350, 430, 900), "panel": (24, 340, 440, 1140)}
PROMPT = ("This image is a panel from a Japanese manga. There is a large stylized sound effect "
          "(SFX / onomatopoeia) drawn in the art. Give the English onomatopoeia that an official "
          "English manga translation would letter in its place, matching the mood of the scene. "
          "Reply with ONLY the English SFX word(s), uppercase, nothing else.")


def main():
    from transformers import Qwen2VLForConditionalGeneration, AutoProcessor
    dev = "cuda" if torch.cuda.is_available() else "cpu"
    t0 = time.time()
    print(f"loading {REPO} on {dev} ...")
    proc = AutoProcessor.from_pretrained(REPO)
    model = Qwen2VLForConditionalGeneration.from_pretrained(
        REPO, dtype=(torch.bfloat16 if dev == "cuda" else torch.float32)).to(dev).eval()
    print(f"loaded {time.time()-t0:.1f}s  vram={torch.cuda.memory_allocated()/1e9:.2f}GB")
    page = Image.open(PAGE).convert("RGB")
    OUT.write_text("", encoding="utf-8")
    for name, box in CROPS.items():
        crop = page.crop(box)
        messages = [{"role": "user", "content": [
            {"type": "image", "image": crop}, {"type": "text", "text": PROMPT}]}]
        text = proc.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        inputs = proc(text=[text], images=[crop], return_tensors="pt").to(dev)
        t1 = time.time()
        with torch.no_grad():
            out = model.generate(**inputs, max_new_tokens=48, do_sample=False)
        res = proc.decode(out[0][inputs.input_ids.shape[1]:], skip_special_tokens=True).strip()
        line = f"[{name}] ({box[2]-box[0]}x{box[3]-box[1]}) {time.time()-t1:.1f}s -> {res!r}"
        with OUT.open("a", encoding="utf-8") as f:
            f.write(line + "\n")
        print("  " + line.encode("ascii", "backslashreplace").decode())
    print(f"peak vram={torch.cuda.memory_allocated()/1e9:.2f}GB  -> {OUT}")


if __name__ == "__main__":
    main()
