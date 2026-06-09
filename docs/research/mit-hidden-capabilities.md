<!-- lang:th -->
# ขุมความสามารถที่ซ่อนอยู่ใน MIT fork ของเราเอง — สรุปภาษาไทย

> สำรวจ 2026-06-07 หลังพบโดยบังเอิญว่า MIT มี "ระบบปรับความหนาฟอนต์" ที่ทีมไม่เคยรู้ — เลยไล่เก็บทั้งหมด
> Backend ปัจจุบัน expose แค่เศษเสี้ยว: `translator.{target_lang, source_lang, model, series_context}` · `detector.{detection_size + #167 knobs}` · `ocr.prob` · `inpainter.{3 ค่า}` · `render.{direction, rtl}` — ที่เหลือทั้งหมดข้างล่างนี้**มีอยู่แต่ไม่เคยถูกใช้**
> รายละเอียด file:line อยู่ส่วนภาษาอังกฤษด้านล่าง

## 🏆 ห้าอันดับที่ควรรู้ก่อน

1. **ระบบ glossary + dictionary มีอยู่แล้วครบวงจร** — ไม่ต้องรอ #160!
   - `dict/mit_glossary.txt` (โหลดผ่าน `OPENAI_GLOSSARY_PATH`) ฉีดเข้า system prompt ของ GPT-family ทุกตัวผ่าน `glossary_system_template`
   - `--pre-dict` / `--post-dict` = regex replacement ก่อน/หลังแปล (รองรับ capture group เช่น `第([0-9]+)话 → Episode $1`)
   - **เคส "HARA-KUN → ฮาร่า-คุง" แก้ได้วันนี้**: เพิ่มบรรทัดใน post-dict หรือ glossary แล้ว restart — ศูนย์โค้ด
2. **ระบบตรวจคำแปลหลังแปล (เปิดอยู่แล้วโดย default!)** — `enable_post_translation_check`: จับ hallucination แบบตัวซ้ำ (เกิน 20 ตัวติด), เช็คสัดส่วนภาษาเป้าหมายทั้งหน้า (≥50%), retry อัตโนมัติสูงสุด 3 ครั้ง — ทำงานใน patch mode ของเราอยู่เงียบๆ มาตลอด
3. **"ระบบความหนาฟอนต์" ที่คุณเจอ** = FreeType **stroker** วาดขอบตัวอักษรรัศมี 7% ของขนาดฟอนต์ (`text_render.py:505`) + ปิดได้ด้วย `disable_font_border` + bold/italic ต่อท้ายชื่อฟอนต์ใน gimp renderer — และมี knob render อีกเพียบ: `font_color` (override สี fg:bg), `alignment`, `uppercase/lowercase`, `line_spacing`, `no_hyphenation`, `font_size/offset/minimum`, เลือก **renderer** ได้ (`default` / `manga2eng` typesetting อังกฤษ / `none`)
4. **ขั้นตอน pipeline ที่ไม่เคยเปิด**: upscaling (esrgan/waifu2x/4xultrasharp), **colorization มังงะขาวดำเป็นสี** (mc2), export เป็น **PSD/PDF/XCF** (เลเยอร์ข้อความแยก!), `--save-text`/`--prep-manual` (workflow นักแปลมนุษย์: ดึง JSON ข้อความ+พิกัด แล้ว inpaint เปล่าไว้ให้ typeset เอง)
5. **Knob คุณภาพที่เกี่ยว issue เปิดอยู่ตรงๆ**: `mask_dilation_offset` (ขยาย mask ลบหมึกตกค้าง — เกี่ยว #167-class), `min_text_length`/`ignore_bubble` (กรอง noise/ข้อความนอกบับเบิล), `unclip_ratio`/`box_threshold`/`det_rotate`/`det_auto_rotate` (จูนกล่อง detection), `filter_text` (regex ตัดคำแปลที่ไม่เอา), `translator_chain` (แปลต่อสองทอด), `selective_translation` (เลือก translator ตามภาษาที่ detect)

## วิธีใช้ทันที (ตัวอย่างจริง)

```bash
# แก้เคส kun ไม่แปลเป็นไทย — เพิ่มใน dict ของ deployment แล้วชี้ worker:
echo "KUN\.	คุง" >> dict/post_dict.txt
# worker args: --post-dict dict/post_dict.txt
```

⚠️ ก่อน expose knob ใดเพิ่มผ่าน Backend: ทำตาม pattern #167 (env opt-in, ไม่ตั้ง = config byte-identical, spec ใน books-mit-config) และไฟล์ MIT ที่แตะต้องลงทะเบียน PIPELINE.md §5

---

<!-- lang:en -->
# Hidden Capabilities of Our Own MIT Fork (inventory 2026-06-07)

> Trigger: the team discovered by accident that MIT has a "font thickness system" nobody knew about. This is the full sweep. Two very-thorough parallel reads: the complete Config tree, and the hidden subsystems. Backend exposure today is tiny (see Thai summary); everything below exists upstream-side and is unused unless noted.

## 1. The "font thickness system" — and the rest of RenderConfig

The discovered feature = **FreeType stroker** text border: radius `64 * max(int(0.07 * font_size), 1)` (text_render.py:505), drawn to a border canvas and blended with `cv2.max` for AA (text_render.py:560+). Toggle: `render.disable_font_border`. Bold/italic = font-name concatenation in the GIMP renderer (gimp_render.py:95-97), not variant files.

| Knob | Default | Effect | Notes |
|---|---|---|---|
| `renderer` | default | rendering engine: `default` / `manga2eng` / `manga2eng_pillow` (English typesetting w/ word spacing, stroke_width) / `none` | manga_translator.py:1378-1389 |
| `alignment` | auto | left/center/right inside region | rendering/__init__.py:303 |
| `disable_font_border` | False | kill the stroker border | rendering/__init__.py:261 |
| `font_size` / `font_size_offset` / `font_size_minimum` | None / 0 / -1(auto=(w+h)/200) | fixed size / offset / floor | rendering/__init__.py:252 — #166 quick knobs |
| `font_color` | None | hex override `fg` or `fg:bg` | manga_translator.py:774-777 |
| `line_spacing` | None (0.01 h / 0.2 v) | line gap multiplier | rendering/__init__.py:244 |
| `uppercase` / `lowercase` | False | case-transform translations | manga_translator.py:1125-1128 |
| `no_hyphenation` | False | forbid `-` wrapping | rendering/__init__.py:261 |
| `direction` | auto | force h/v | manga_translator.py:1131 |
| `--font-path` (worker flag) | — | custom font file | args.py:90 |

## 2. Glossary & dictionary machinery (ALREADY SHIPPED — overlaps #160/#161)

- **GPT glossary**: `OPENAI_GLOSSARY_PATH` → `dict/mit_glossary.txt` (keys.py:21), injected via `glossary_system_template` (`config_gpt.py:177-181`, `{glossary_text}` placeholder) for the whole ConfigGPT family. Format: `source<TAB>target`, regex + capture groups supported, underscore for multi-word, lone word = delete.
- **Pre/post dicts**: `--pre-dict` applies to `region.text` before translation (manga_translator.py:538-545); `--post-dict` to `region.translation` after (1217-1224). Loader/applier at manga_translator.py:68-98. Order: pre → translate → post → punctuation correction.
- Five example dicts in `dict/`: mit_glossary, sakura_dict, pre_dict, post_dict, galtransl_dict.
- **Implication for PRD #155 P3 (#160/#161)**: persistence + auto-generation remain ours to build, but the *injection seams already exist* — per-series glossary could be written to a file (or merged OmegaConf) and fed through `glossary_system_template`/post-dict rather than inventing a new seam.

## 3. The gpt_config YAML override system (deployment prompt engineering)

`TranslatorConfig.gpt_config` = path to an OmegaConf YAML; per-translator nesting via CONFIG_KEY traversal (deepest-first: `chatgpt.en.temperature` → `chatgpt.temperature` → `temperature`) (config_gpt.py:193-209). Overridable keys: `chat_system_template` (the seam our deployment ALREADY uses for the custom "Doujin Translator" prompt + where series_context #157 appends), `prompt_template`, `chat_sample` (few-shots per language), `json_mode` + `json_sample`, `temperature` (default 0.5!), `top_p`, `verbose_logging`, `rgx_capture` (response extraction regex), `include_template`, `glossary_system_template`.

## 4. Post-translation validation & retry (ON BY DEFAULT — running in our patch mode today)

`enable_post_translation_check` (default True): (a) repetition-hallucination check — ≥`post_check_repetition_threshold` (20) consecutive repeats fails the region (manga_translator.py:3090-3125); (b) page-level target-language ratio ≥0.5 when ≥5 regions; (c) `_retry_translation_with_validation` re-translates up to `post_check_max_retry_attempts` (3). Patch-mode call site: manga_translator.py:2478-2490. We have been silently protected by this all along — and it spends LLM retries we never accounted for.

## 5. Detection/OCR/mask knobs not yet exposed

| Knob | Default | Why it matters |
|---|---|---|
| `detector.detector` | default(DBNet-r34) | alternatives: `dbconvnext`, `ctd` (comic text detector!), `craft`, `paddle` — ctd is manga-specific and untested by us; relevant to #168 comparisons |
| `detector.box_threshold` / `unclip_ratio` | 0.7 / 2.3 | bbox formation tightness/expansion |
| `detector.det_rotate` / `det_auto_rotate` | False | rotated/vertical text assist — could matter for the ゴゴゴ class (#168) before YOLO work |
| `ocr.ocr` | 48px | alternatives `32px`, `48px_ctc`, `mocr` (manga-ocr, JP-only) |
| `ocr.min_text_length` | 0 | drop ultra-short noise regions |
| `ocr.ignore_bubble` | 0 (off) | 1–50: drop text outside bubbles (rec 5–10) — note: the OPPOSITE of what we want for #168 |
| `kernel_size` / `mask_dilation_offset` | 3 / 20 | text-erasure mask cleanup — residual ink around inpainted text (#167-adjacent) |
| `filter_text` | None | regex to discard matching translations |
| `translator.skip_lang` / `no_text_lang_skip` | None / False | skip translating given source langs / don't skip same-lang text |
| `translator.translator_chain` / `selective_translation` | None | two-hop translation; per-detected-language translator choice |

## 6. Dormant pipeline stages & modes

- **Upscaling**: `esrgan` / `waifu2x` / `4xultrasharp`, `upscale_ratio`, `revert_upscaling` (manga_translator.py:464-474).
- **Colorization**: `mc2` manga colorization with `denoise_sigma`, runs pre-upscale (manga_translator.py:448-459) — B/W → color manga as a product feature someday.
- **Export formats**: png/webp/jpg plus **xcf/psd/pdf via GIMP with separate text + mask layers** (save.py:62-66).
- **Manual-typesetting workflow**: `--save-text`/`--load-text`/`--save-text-file` (JSON of text+coords+colors), `--prep-manual` (translator=none, blank inpainted output + `-orig` copies) — a human-scanlator product mode hiding in the CLI (args.py:125-128, mode/local.py:284-328).
- **WebSocket mode** (mode/ws.py): server-driven streaming translation with per-stage progress — predates our webhook design.
- **Worker flags**: `--models-ttl` (auto-unload idle models — relevant to #168 VRAM plan), `--use-gpu-limited` (GPU for everything except the local LLM), `--batch-size`/`--batch-concurrent`, `--attempts`, `--ignore-errors`, `--disable-memory-optimization`.

## 7. Exposure policy reminder

Before exposing any of these through the Backend: follow the #167 pattern — env-gated opt-in, absent env = byte-identical config, spec coverage in `books-mit-config`, and register touched MIT files in PIPELINE.md §5.
