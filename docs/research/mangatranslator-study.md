<!-- lang:th -->
# ผลศึกษา meangrinch/MangaTranslator — สรุปภาษาไทย

> ศึกษา 2026-06-07 จาก clone ที่ `/MangaTranslator` (gitignored) — Apache-2.0 จึงยืมไอเดีย/โค้ดเข้า fork GPL ของเราได้
> รายละเอียดเชิงลึกพร้อม file:line อยู่ในส่วนภาษาอังกฤษด้านล่าง (reference เต็ม)

## ทำไมผลเขาดูดีกว่า — 4 คำตอบสั้น

1. **ขนาดฟอนต์** — เขาไม่ได้ "คงขนาดต้นฉบับ" แต่**หาขนาดใหญ่สุดที่ใส่ได้จริง**ด้วย binary search ภายใน safe-area ของบับเบิล (คำนวณจาก SAM mask ด้วย distance transform) โดยมี bound สองชั้น: บทพูด 8–16pt แต่ **SFX/OSB 10–64pt** — นี่คือเหตุผลที่ LOOM ใหญ่ได้ และทุกอย่างคูณ `processing_scale = sqrt(ล้านพิกเซล)` ตามขนาดภาพ
2. **LOOM** — เป็น **pipeline แยก (OSB)**: ตรวจด้วย AnimeText YOLOv12x → inpaint พื้นหลังด้วย FLUX/OpenCV → render ตัวพิมพ์ใหญ่ + ขอบ 3px สีตาม luminance ของพื้น
3. **ข้อความขาวบนดำไม่หลงเหลือ** — ฝั่ง detection ใช้โมเดลที่**เทรนมาเพื่อ anime text โดยตรง** (ไม่มีเทคนิค preprocessing) ส่วนฝั่ง cleaning ใช้ trick **invert ก่อน threshold เมื่อพื้นมืด** — ตัวหลังเราลอกได้ทันที ตัวแรกชี้ว่า det_invert ของ upstream เราคือ lever ที่ถูกต้อง (#167)
4. **คุณภาพแปล** — one-step multimodal (ส่ง**ภาพ crop ทุกบับเบิล + ภาพทั้งหน้า + หน้าก่อนหน้า N หน้า**ให้ LLM เห็น) พร้อม contract เคร่งครัด `i: <OCR> || <แปล>` + temp 0.1 + กลไก repair เมื่อ LLM ตอบขาด

## ของที่ map เข้า issues เราโดยตรง

| ของเขา | ไป issue ไหน | สาระ |
|---|---|---|
| Binary-search sizing + safe-area จาก mask + bound สองชั้น + processing_scale + supersampling 4x + ขอบสีตาม luminance | **#166** | เปลี่ยน driver จาก "หดให้พอดีกล่อง textline" เป็น "ขยายให้ใหญ่สุดในพื้นที่จริง" |
| AnimeText YOLO เป็น detector เสริม + invert-เมื่อพื้นมืด + Otsu fallback | **#167** | ระยะสั้น: เปิด `det_invert`/`det_gamma_correct`; ระยะกลาง: เสียบ AnimeText YOLO (Apache) เป็น detector ตัวที่สอง |
| **Previous-pages context**: แนบภาพ+transcript ของ N หน้าก่อนหน้า พร้อมกฎ "ใช้เป็นบริบทเท่านั้น ห้ามแปล/ห้ามนับ" + ระบบรอ OCR หน้าก่อนใน parallel batch | **#159** | นี่คือ rolling context ของเราเป๊ะ — เขาพิสูจน์แล้วว่า format ไหนเวิร์ค และ text layer จาก #158 ของเราคือวัตถุดิบที่ต้องใช้พอดี |
| Glossary: `## SPECIAL INSTRUCTIONS` + Rosetta format บรรทัดละ `- X -> Y` | **#160/#161** | ยืนยัน schema glossary ของ PRD #155 และให้ format injection สำเร็จรูป |

## ไอเดียใหม่ที่ยังไม่มี issue (ตัดสินใจทีหลัง)

- **Emphasis markers** `*เอียง*`/`**หนา**` ไหลครบ OCR→แปล→renderer (ของเราทิ้ง emphasis หมด)
- **ส่งภาพทั้งหน้าเป็น context** ให้ LLM (เราส่งแต่ข้อความ)
- **Page-number filtering** (กรองเลขหน้าออกก่อนแปลด้วย regex+OCR)
- **Deterministic-only translation cache** (cache เฉพาะเมื่อ temp=0) + per-stage cache คีย์ด้วย content hash
- **Rosetta เป็น translator self-host ทางเลือก** (ตรวจ HF 2026-06-07 จากทั้ง 3 collection — ดูตาราง lineup เต็มในส่วนภาษาอังกฤษ §6): `YanoljaNEXT-Rosetta` = LLM เฉพาะทางการแปลล้วน มี **3 collection ใหญ่** — ดั้งเดิม Sep'25 (4B/12B/20B, 11 ภาษา **ไม่มีไทย**) → **2510** (4B/12B, 32 ภาษา **รวมไทย**) → **2511** (4B/27B, 32 ภาษา) + ตัวใหม่สุดนอก collection: **EEVE-Rosetta-7B-2602** (ก.พ. 2026, base Seed-X-PPO-7B, ไม่ประกาศชุดภาษา — เช็คก่อนใช้) แต่ละรุ่นมี variant ย่อย base/FP8/GGUF · **เรือธง = `4B-2511-GGUF`** (105K downloads, Q8 ~4.3GB) และ **`12B-2510-GGUF`** (Q4 ~7GB) — **ทั้งคู่ใส่เครื่อง dev 12GB ได้ ทดลองได้ทันที** · glossary contract ในตัว (`- คำ -> คำแปล` + JSON) · เสียบ `custom_openai` ผ่าน llama.cpp ศูนย์โค้ด · คำถามที่เหลือ: คุณภาพ vs qwen3.6-35b (ต้อง head-to-head) + text-only · use case: ตัดค่า API เป็นศูนย์/ออฟไลน์

---

<!-- lang:en -->
# meangrinch/MangaTranslator — Deep Study (2026-06-07)

> Studied from the local clone at `/MangaTranslator` (gitignored). License Apache-2.0 — ideas and code may flow into our GPL fork; not the reverse. Line numbers refer to that clone at the time of study.
> Four parallel deep-reads: text rendering, detection+cleaning, LLM translation, pipeline orchestration. This document is the synthesis; it intentionally records exact constants and formulas because those are the hard-won parts.

## 1. Font sizing & rendering (→ our #166)

**The core insight: size is *searched*, not preserved.** `find_optimal_layout()` (core/text/layout_engine.py:656-835) binary-searches the largest font size that fits:

- Bounds: dialogue **8–16pt**, OSB/SFX **10–64pt** (core/config.py:102-103, 147-148) — the two-tier bound is what lets "LOOM" be huge while dialogue stays tasteful.
- All sizes/padding/outlines multiply by `processing_scale = sqrt(megapixels)` (pipeline.py:694-702; 1MP→1.0, 4MP→2.0), clamped via `scale_font_size(min=4, max=512/640)`.
- Fit check = layout attempt + mask **collision detection**, with up to 3 "squeeze" retries at width×0.90 before dropping a size.

**The render area comes from the segmentation mask, not the text box.** 5-step safe-area: `cv2.distanceTransform` on the SAM bubble mask → centroid of safe area → ray-cast to edges → symmetric box (text_renderer.py:99-182; impl `calculate_centroid_expansion_box()` in image_utils.py). Fallback = bbox minus 8% padding per side (`FALLBACK_PADDING_RATIO = 0.08`).

**Line breaking is Knuth–Plass-style DP** (text_processing.py:489-579): `badness = slack^3 + 1000·hyphen`, language-aware (kinsoku for CJK at 222-305, Hangul word rules at 100-159, midpoint-out hyphenation for Latin at 345-427).

**Polish that matters:**
- Supersampling ×4: crop → LANCZOS upscale → render → downscale → paste (text_renderer.py:366-517).
- Outline color by luminance: `lum = 0.299r+0.587g+0.114b; outline = BLACK if lum ≥ 80 else WHITE` (drawing_engine.py:190-194); stroke join round; OSB outline width 3.0, dialogue 0.0.
- Text color by background brightness: white text if bubble mean < 128 (text_renderer.py:339-356).
- Styled segments `*italic*` / `**bold**` / `***both***` parsed into per-segment font variants (text_processing.py:183-219); font packs discovered by a 6-pass keyword search (font_manager.py:231-443).

**Adoption for #166** (ordered by leverage):
1. Replace "fit-shrink into source textline box" with **area-driven search**: our patch path already has region masks (`mask_raw`) — compute a safe area and binary-search the size upward.
2. Two-tier bounds: classify region as dialogue vs display (source font height ≥ 2× page median is a cheap proxy we already record via OCR `font_size`).
3. `processing_scale` by megapixels — our knobs (`font_size_minimum`) are absolute pixels today.
4. Supersampling + luminance outline are cheap quality wins inside `_run_text_rendering` patches.

## 2. Detection & cleaning (→ our #167)

**Models, not preprocessing.** Bubble detection: `kitsumed/yolov8m_seg-speech-bubble` (conf 0.6, imgsz 640/1600) + secondary `ogkalu/comic-speech-bubble-detector-yolov8m` (conf 0.35, imgsz 1024) for conjoined/text-free classes; **SAM 2.1/3 refines each YOLO box into an instance mask** (`SAM_MASK_THRESHOLD 0.5`, detection.py:503). OSB text: `deepghs/AnimeText_yolo` yolov12x, imgsz 640 — *this model is simply trained for white-on-black/stylized anime text*; there is **no inversion/multi-scale trick at detection time**.

**The inversion trick lives in cleaning** (cleaning.py:292-320): classify bubble interior black/white by mean<128, **invert grayscale before thresholding for black bubbles**, threshold 200 or Otsu fallback, AND with dilated mask → text-only mask. Edge-aware shrink via distance transform (≥5px), adaptive at conjoined junctions (cleaning.py:159-211). Bubble fill = flat color; FLUX inpaint only for *colored/gradient* bubbles (classified by interior histogram, cleaning.py:389-460).

**FLUX usage** (when it is used): Kontext prompt is literally `"Remove all text."`, guidance 2.5, 8 steps, 17 preferred AR resolutions; Klein guidance 1.0, 4 steps, 2× context padding, optional LAB luminance-match of the generated patch (inpainting.py:1187-1256). Non-overlapping regions are inpainted in parallel "waves" (batch_coordinator.py:121-152).

**Reading order**: graph/topological panel sort with veto rules + band/column bubble sort, RTL/LTR aware (sorting.py:4-377).

**Adoption for #167** (ordered):
1. Short term (already filed): enable upstream `det_invert`/`det_gamma_correct`/`text_threshold` knobs — their existence in our fork is validated by meangrinch handling the same problem at model level; inversion is the classical rescue.
2. Mid term: **AnimeText YOLO as a secondary detector** for what our DBNet misses (Apache license OK); merge boxes via IoA like their `OSB_BUBBLE_MATCH_IOA_THRESHOLD = 0.2` rules.
3. Cleaning-stage idea: our `_create_text_only_mask` could adopt their invert-when-dark + Otsu-fallback combination (cleaning.py:683-715).

## 3. LLM OCR/translation (→ our #155/#159/#160/#161 + quality)

**One-step multimodal is their default quality path**: every bubble crop (b64, upscaled to ≥128px min side) + optionally the **full page image** + optionally **N previous page images** go to the LLM with a strict numbered contract: `i: <transcription> || <translation>` (translation.py:1687-1737). Two-step (local manga-ocr / PaddleOCR-VL → text-only LLM) is the budget path.

**Their "rolling context" = our #159, proven**: `previous_context_image_count` (0–10) and `previous_context_text_count` (0–50) attach prior pages oldest→newest; transcripts go in a `## PREVIOUS PAGE TRANSCRIPTS` section; an explicit rule tells the model the context is *reference only — do not transcribe, translate, number, or count it* (translation.py:168-186, 972-1006). In parallel batch mode each page **waits for the prior pages' OCR** via per-page events before its LLM call (pipeline.py:1952-1990) — exactly the dependency our batch loop + #158 text layer enables.

**Glossary = our #160/#161, format settled**: free-text `## SPECIAL INSTRUCTIONS` section for normal LLMs (translation.py:1009-1024); for Rosetta-family models each line becomes a glossary entry auto-prefixed `- ` (`- X -> Y`), injected as `Glossary:\n…` (translation.py:1027-1058).

**Contract & repair worth copying** (we will need this for #159):
- Parse regex `^\s*(\d+)\s*[:.]\s*"?(.*?)"?$` per line; missing items filled with `[Provider: Missing item N]`; `[OCR FAILED]` is a first-class token that must round-trip unchanged; counts padded/truncated to exactly N (translation.py:834-891, 1162-1170).
- Sampling: temperature **0.1** across all 10 providers (llm_defaults.py:10-21); 4096 tokens (16384 for reasoning models).
- Emphasis markers `*italic*`/`**bold**` flow OCR→translation→renderer — typography survives translation. We currently drop all emphasis.
- Translation cache only when deterministic (temp 0 / top_k 1), keyed by SHA256(images+full page+config) and **stores OCR texts too** so cached pages can still feed forward context (caching.py:198-341).

## 4. Pipeline/ops notes

- Stage order: pre-upscale (optional) → bubble detect → panels → **OSB pipeline (detect→inpaint→queue)** → cleaning → bubble crops upscaled for LLM → reading-order sort → one LLM call per page → render (with per-region fallbacks: Otsu mask retry → vertical stack → restore original crop) → optional final upscale.
- VRAM discipline: lazy singleton model manager; upscaler explicitly unloaded right after use (pipeline.py:1014); per-image error isolation in batches; warm-up first image before parallel fan-out.
- "If OCR == translation, restore the original patch" (pipeline.py:1355-1373) — don't re-render text that didn't change. Cute, applicable to us when src==dst.

## 5. Idea backlog (not yet filed as issues)

| Idea | Where it would land | Notes |
|---|---|---|
| Emphasis markers end-to-end | MIT prompts + renderer | needs renderer variant support first |
| Full-page image as LLM context | `translate_patches` one-step path | cost/quality trade — measure on gateway |
| Page-number filter | MIT patch path | regex + OCR check before translating tiny edge regions |
| Deterministic-only result cache keyed by content hash | MIT server | complements Backend patch cache |
| src==dst → skip render, keep original | `_process_group` | trivial |
| **Rosetta as a self-host translator option** | deployment only — `custom_openai` via llama.cpp, zero code | HF-verified 2026-06-07 across all three collections — full lineup below. Native glossary contract (`- X -> Y` + JSON in/out — the format MangaTranslator auto-detects). Open question: specialist-4B/12B quality vs the gateway's qwen3.6-35b (needs a head-to-head on the reference pages); text-only forecloses multimodal. Use case: zero-API-cost/offline deployments. |

### Rosetta lineup (yanolja on HF, three collections + one successor — verified 2026-06-07)

| Collection / model | Sizes & variants | Languages | Fits 12 GB dev box? |
|---|---|---|---|
| `yanoljanext-rosetta` (Sep 2025, original) | 4B, 12B (Gemma-based, license gemma) · 20B (gpt-oss base, Apache-2.0) — base safetensors only | **11 langs — NO Thai** | irrelevant (no Thai) |
| `yanoljanext-rosetta-2510` (Oct 2025) | 4B-2510 (+GGUF) · 12B-2510 (+GGUF, +FP8) | **32 langs incl. Thai** | **12B-2510-GGUF Q4 ≈7 GB** — benchmark-only here (co-residency note below) |
| `yanoljanext-rosetta-2511` (Nov 2025) | 4B-2511 (+FP8, +GGUF — **flagship, 105K downloads**) · 27B-2511 (+FP8, +GGUF) | **32 langs incl. Thai** | 4B Q4 ≈2.5 GB ✓ · 27B Q4 ≈16 GB ✗ (offload only) |

**2510 vs 2511** = monthly iterations of the same recipe (Gemma-3 `-pt` base, synthesized FineWeb Edu/FineWeb2 data, JSON-in/out + glossary-in-system-prompt usage) — only the training round and the size lineup differ (12B not refreshed in 2511; 27B added). Model-card benchmarks, CHrF++ WMT24++ EN→KO: **12B-2510 = 37.36 (beats GPT-4o 36.08)** · 4B-2511 = 35.64 · 4B-2510 = 35.09 · Gemini-2.5-Flash = 35.25 · plain Gemma-3-4b-it = 27.53 — specialization is worth ~8 points at 4B.
| `EEVE-Rosetta-7B-2602` (Feb 2026, successor, outside the three collections) | 7B (8.3B params, +FP8) — base ByteDance Seed-X-PPO-7B, license openmdw-1.0 | **not declared in metadata — verify before use** | Q8 ≈8.8 GB ✓ (tight) |

Note: 12B was not refreshed in 2511 and 20B never got a Thai-capable refresh — for Thai the candidates are 4B-2511, 12B-2510, 27B-2511, and (pending language verification) EEVE-7B-2602.

**Co-residency reality check (user-corrected 2026-06-07):** the "fits" column above is for the model *alone*. Running the translator NEXT TO the MIT stack (DBNet + 48px OCR + LaMa inpaint peaks + desktop ≈ 7.7 GB measured on the 12 GB box) is the real constraint — the team already lived this with Qwen3.5-4B local: FP8/Q8 (~4–5 GB incl. KV cache) pushes past 12 GB. Per the proven Qwen3.5 sizing guidance in `MIT/.env.example` (int4 quality loss is negligible on short manga sentences for a 4B instruct model), the production-viable options on this box are **4B-2511 Q4_K_M ≈2.5 GB** (≈10.2 GB total ✓) or CPU-only llama.cpp (zero VRAM, short bubbles tolerate it). **12B-2510 is out for co-residency here** — quality benchmarking can still use it with MIT idle. |
