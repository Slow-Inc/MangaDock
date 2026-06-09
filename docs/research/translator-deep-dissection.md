# Translator Deep Dissection — MangaTranslator vs our MIT/Backend

> Comparative technical reference (2026-06-08). Produced by a 12-agent dissection workflow reading both codebases at `C:/Github/MangaDock/MangaTranslator` (meangrinch) and `C:/Github/MangaDock/MIT` + `/Backend`, plus a gap-fill pass for detection. Every claim cites real file:line; verify against code before relying on it. Companion to [[mangatranslator-internals]] and [[mangatranslator-round2-deep]].

**Decided direction (see memory project_render_parity_direction):** match MangaTranslator — narrow-column mask-aware wrap, 4× supersampling, real vertical Latin, SFX detector (#168) opt-in. The "why ours is worse" + "black boxes" sections below are the evidence base for that work.

---

## MangaTranslator — Full Pipeline Dissection

### Detection — bubble segmentation, text-line detection, SFX/onomatopoeia, OSB routing

#### Models & Architecture Comparison

| **Stage** | **THEIRS (MangaTranslator)** | **OURS (MIT)** |
|-----------|---------------------------|--------------|
| **Bubble Segmentation** | YOLOv8m-seg `kitsumed/yolov8m_seg-speech-bubble` (~490 MB transient) | YOLOv8m-seg `kitsumed/yolov8m_seg-speech-bubble` (`bubble_detector.py:18`) |
| **Primary YOLO Config** | `yolo_1` @ imgsz=640 or `yolo_2` @ imgsz=1600; conf=0.6 (`config.py:14`) | N/A — replaced by DBNet |
| **Text-line Detector** | Two-stage: Primary YOLO (kitsumed) + Secondary YOLO (conjoined fallback, imgsz=1024, conf=0.35) | Single-stage DBNet (ResNet-34, `detect-20241225.ckpt`); text_threshold=0.5, box_threshold=0.7 (`config.py:314,332`) |
| **Detection Size / Input** | Primary: 640 or 1600 px; Secondary: 1024 px | 2560 px (`config.py:312`) via `det_rearrange_forward` (`default.py:60`) |
| **SFX/Onomatopoeia** | AnimeText YOLO v12 (`deepghs/AnimeText_yolo`, imgsz=640, conf=0.6) — OSB detector (`model_manager.py:193`) | **UNSHIPPED stub** `det_sfx` (#168, `sfx_merge.py:1`) — dedup-only (`:22–33`) |
| **Area Filter (small text)** | OSB text matched to bubbles @ IoA ≥ 0.2 (`detection.py:20–21`) | Textlines area > 16 px² (`default.py:89`) |
| **Conjoined Bubble** | Primary IoU-NMS @ 0.7 (`detection.py:19`); Secondary IoA ≥ 0.5 (`detection.py:16`) | Dual-balloon assoc: centroid → smallest-area; fallback IoA ≥ 0.5 (`bubble_association.py:151`) |

#### THEIRS (`core/image/detection.py` + `ocr_detection.py`)
- **Bubble seg (YOLOv8m-seg):** `load_yolo_speech_bubble()` :1349, imgsz=640, `retina_masks=True` :1362–69; dedup IoU>0.7 :1382 (`_deduplicate_primary_boxes` :227–262); remove-contained IoA>0.9 :1395.
- **Secondary YOLO (conjoined):** `load_yolo_conjoined_bubble()` :1418, imgsz=1024, conf=0.35; categorize by IoA :353 (≥50% contained :380–387) → `conjoined_indices` + `simple_indices` :408.
- **OSB / AnimeText:** `deepghs/AnimeText_yolo` (yolov12x) imgsz=640 conf=0.6 (`ocr_detection.py:361–368`); each OSB box matched to nearest bubble — IoA ≥ 0.2 OR centroid-inside → expand bubble bbox (`:90–104`); `OutsideTextDetector` subtracts speech bubbles to isolate SFX (`:71`); text-free fallback uses secondary YOLO `text_free` class (`:319–322`).
- **Conjoined mask split (SAM2/SAM3):** simple bubbles SAM2 masks :483–519 (thresh 0.5); conjoined split along group arrangement :817–851 with text-safe constraints :754–775; `MIN_OVERLAP_SPLIT_SHARE=0.08` :28.
- **Key thresholds:** IOA=0.50 (:16), OSB_TEXT_MATCH_IOA=0.2 (:20–21), IOU_DUPLICATE=0.7 (:19), SAM_MASK=0.5 (:17).

#### OURS (`detection/default.py` + `bubble_detector.py` + `sfx_merge.py`)
- **Bubble seg:** `detect_bubbles()` (`bubble_detector.py:34`) model.predict(imgsz=1024, conf=0.30) :45 → polygons; **no SAM refinement** (polygon is final).
- **Text-line (single-pass DBNet):** `TextDetectionDefault` ResNet-34 from `detect-20241225.ckpt` (`default.py:43–46`); `_infer()` :56 → `det_rearrange_forward` :60; bilateral-filtered @ 2560 :64; text_threshold=0.5 box_threshold=0.7 :75; filter area>16px² :89 → `Quadrilateral` list.
- **OSB/SFX (UNSHIPPED):** no SFX detector active; `dedup_sfx_boxes()` (`sfx_merge.py:22`) is dedup-only (IoA ≤ 0.2 vs DBNet :30). No AnimeText, no second pass, no text-free routing.
- **Bubble association (geometry only):** `associate_regions_to_bubbles()` :154 — centroid-in-polygon ray-cast :76–87, fallback IoA≥0.5 :66–73. `group_regions()` :90 union-find (same balloon merge :142, different+overlap reject :138).
- **Key thresholds:** MIN_IOA=0.5 (:151), dedup IoA=0.2 (:25), area>16px² (:89).

#### Why ours misses SFX & stylized small text
1. **Single-stage DBNet vs dual-model:** they run primary + secondary bubble YOLO **plus** AnimeText YOLO (3 passes); we run DBNet only — a general text-line detector with poor recall on effect fonts (フッ, ぬ, ゴゴゴ).
2. **No SFX-specific model:** AnimeText YOLO learns SFX/display-text morphology; our `det_sfx` (#168) never shipped.
3. **Small-text cutoff:** their OSB matcher (IoA ≥ 0.2) rescues tiny boxes overlapping bubbles; ours hard-filters area>16px² with no second pass.
4. **Missing OSB routing:** they isolate non-dialogue (`OutsideTextDetector` :71) and render it as effect text; we route everything as dialogue.
5. **Polygon vs bbox + mask refine:** they expand bubble bbox to contain OSB text then SAM-refine; our raw polygon centroid/IoA test drops edge text.



> **Canonical reference.** This section dissects every stage of the manga image-translation pipeline as it exists in the upstream **MangaTranslator** (meangrinch, Apache-2.0) reference implementation versus our **MangaDock MIT** fork (zyddnys/manga-image-translator lineage) plus **Backend** orchestration. For each stage: the exact models (id / size / purpose), the technique/algorithm with key constants, and the `file:line` provenance. "THEIRS" = MangaTranslator; "OURS" = MangaDock MIT + Backend.

---

### Stage 0 — Pipeline Order (Canonical)

The full single-image pipeline runs in this fixed order (`MangaTranslator/core/pipeline.py`, `MIT/manga_translator/manga_translator.py`):

```
colorization → upscaling → detection → OCR → textline_merge → translation
            → mask_refinement → inpainting → rendering → output
```

THEIRS exposes the whole flow as `MangaTranslator.translate(image, config)` (`manga_translator.py:371-441`) → `_translate()` async (`manga_translator.py:447-698`). OURS runs the same order but the **production path is `translate_patches()`** (`MIT/manga_translator/manga_translator.py:2046+`): the front-half (detection→OCR→translation) runs once per page, regions are grouped by proximity union-find, then per-group inpaint+render run under a `_PATCH_CONCURRENCY=3` semaphore, emitting one PNG patch per region.

---

### 1. Detection

#### Models

| Model | ID / Path | Size | Purpose | Provenance |
|-------|-----------|------|---------|------------|
| Speech-bubble YOLO-seg (primary) | `kitsumed/yolov8m_seg-speech-bubble` | ~490 MB GPU transient (30 ms/page on 12 GB) | Bubble-aware grouping & mask | THEIRS `model_manager.py:174`; OURS `MIT/manga_translator/bubble_detector.py:18-31` (lazy `_model` global, opt-in `MIT_BUBBLE_SEG`) |
| Conjoined-bubble YOLO | `ogkalu/comic-speech-bubble-detector-yolov8m` | ~25 MB | Splits touching bubbles | THEIRS `detection.py` (secondary pass, imgsz 1024) |
| Panel YOLO | `deepghs/manga109_yolo` (`v2023.12.07_l`, YOLOv11l) | ~64 MB | Panel/frame ordering | THEIRS `detection.py` (class `frame`, conf 0.25) |
| OSB / SFX text YOLO | `deepghs/AnimeText_yolo` (`yolo12x_animetext/model.pt`) | ~400 MB | Out-of-bubble SFX/display text | THEIRS `ocr_detection.py:350-368` (imgsz 640, conf 0.6); OURS opt-in `MIT_SFX_DETECTOR` (#168, AFK-gated) |
| SAM2 | `facebook/sam2.1-hiera-large` | ~2–4 GB (est.) | Mask refinement | THEIRS `model_manager.py:200-205` |
| SAM3 | `facebook/sam3` (gated token) | ~2–4 GB (est.) | Mask refinement (alt) | THEIRS `model_manager.py` |
| DBNet (default) | `detect-20241225.ckpt`, ResNet34 backbone | ~300 MB | Textline detection (OURS default) | OURS `MIT/manga_translator/detection/default.py:28-51` |

#### Technique & Constants

| Constant | Value | Meaning | File:line |
|----------|-------|---------|-----------|
| `confidence` | 0.6 | Primary bubble detection threshold | THEIRS `core/config.py:27` |
| `conjoined_confidence` | 0.35 | Secondary conjoined-bubble threshold | THEIRS `core/config.py:27-28` |
| `panel_confidence` | 0.25 | Panel-frame detection threshold | THEIRS `core/config.py:27-28` |
| `OSB_BUBBLE_MATCH_IOA_THRESHOLD` | 0.2 | Bubble↔text intersection-over-area match | THEIRS `ocr_detection.py:16-18` |
| `SAM_MASK_THRESHOLD` | 0.5 | SAM mask binarization cutoff | THEIRS `ocr_detection.py:17` |
| AnimeText `imgsz` / `conf` | 640 / 0.6 | SFX YOLO inference | THEIRS `ocr_detection.py:361-368` |
| `detection_size` | 2048 (default) | OURS DBNet input resize | OURS Backend `books.service.ts` (`MIT_DETECTION_SIZE`) |

- **THEIRS** uses a dual-YOLO strategy (primary `kitsumed` seg + secondary `ogkalu` conjoined) and SAM refinement; conjoined bubbles are split with tiered corner text-safety validation (`detection.py:995-1059`). Panel sorting (`use_panel_sorting`) orders regions by reading order before OCR.
- **OURS** defaults to upstream **DBNet** (no YOLO unless `MIT_BUBBLE_SEG=1`); when enabled the `kitsumed` YOLO is the *same weights* as THEIRS but lazy-loaded and used only for bubble-aware grouping (#170) + font-fit (#166). No SAM, no panel sorting wired.

---

### 2. OCR

#### Models

| Model | ID / Path | Size | Purpose | Provenance |
|-------|-----------|------|---------|------------|
| 48px Roformer CNN (default) | `ocr_ar_48px.ckpt` + `alphabet-all-v7.txt` (~5 KB) | ~90 MB | Manga text recognition, fixed 48px height, XPos, beam k=5 | THEIRS `model_48px.py:27-62`; OURS **identical** `MIT/manga_translator/ocr/model_48px.py:27-62` |
| manga-ocr (fallback) | `kha-white/manga-ocr-base@refs/pr/4` | ~100–200 MB | Local two-step OCR when LLM unavailable | THEIRS only `services/translation.py:769`; **not wired in OURS** |
| PaddleOCR-VL (fallback) | `PaddlePaddle/PaddleOCR-VL-1.5` | ~200 MB–1 GB | Multimodal vision-OCR two-step | THEIRS only `services/translation.py:844`; **not wired in OURS** |

#### Technique & Constants

| Constant | Value | Meaning | File:line |
|----------|-------|---------|-----------|
| `text_height` | 48 px | Fixed OCR crop height | `model_48px.py:68` (both) |
| OCR confidence floor | `0.2 if config.prob is None else config.prob` | Lines below threshold silently dropped | `model_48px.py:70` (both) |
| `max_chunk_size` | 16 | Batch chunking by width, padded to 4-aligned max width | `model_48px.py:83-86` (both) |
| Beam search `k` | 5 | `max_finished_hypos=2`, per-sample sort key | THEIRS `model_48px.py:120, 620-676` |
| `bubble_min_side_pixels` | 128 | Upscale textlines below this before OCR | THEIRS `core/config.py:79`, `ui/ui_models.py:79`; **NOT applied in OURS** |
| FG/BG color extraction | 64-dim bottleneck, `has_fg`/`has_bg` flags | Per-char foreground/background RGB | `model_48px.py:124-153` (both) |
| `_PAGE_LANG_CHECK_MIN_REGIONS` | 6 | Min regions to trigger page-level lang-ratio gate | OURS `MIT/manga_translator/manga_translator.py:89` |

- **THEIRS preprocessing** (`pipeline.py:991-1008`): (1) **128 px minimum upscale** before OCR (method `model`/`model_lite`/`lanczos`, `image_utils.upscale_image_to_dimension`); (2) perspective-correct each quad; (3) width-batch chunk to 16, pad to 4-aligned.
- **THEIRS post-OCR repair** (`services/translation.py:834-890`): numbered-parser regex `^\s*(\d+)\s*:\s*"?\s*(.*?)\s*"?\s*(?=\s*\n\s*\d+\s*:|\s*$)` (MULTILINE|DOTALL) enforces exact item count; missing items filled `[{provider}: Missing item N]`; `[OCR FAILED]` exact-match preserved; emphasis contract (`*italic*`/`**bold**`/`***bi***`, Giongo→onomatopoeia, Gitaigo→verb-no-period) at `translation.py:194-216`.
- **OURS** sends textlines to the 48px model **at native size — no upscale**; confidence floor is the same `0.2` but tunable **only via `MIT_OCR_PROB`** (Backend `books.service.ts:605, 638`; #167 rescue can lower to 0.03). No numbered-parser repair — dropped lines vanish silently. Page-level recovery is a target-script-ratio check (`utils/lang_ratio.py`, #109) gated at ≥6 regions (`manga_translator.py:89`), plus repetition/hallucination retry in `_run_text_translation` (`manga_translator.py:336-420`). No emphasis markdown, no manga-ocr/PaddleOCR fallback.

---

### 3. Translation

#### Models

| Model | ID | Role | Provenance |
|-------|----|----|------------|
| Gemini Flash Lite | `gemini-3.1-flash-lite` (THEIRS) / `gemini-2.5-flash` + `-flash-lite` (OURS) | Primary multimodal OCR+translate | THEIRS `config.py` default; OURS Backend `books.service.ts:39-40` |
| GPT nano | `gpt-5.4-nano` (THEIRS) / GPT-4 fallback (OURS `chatgpt.py`) | Fallback | THEIRS `llm_defaults.py`; OURS `translators/chatgpt.py` |
| Claude | `claude-sonnet-4.6` (THEIRS) | Fallback | THEIRS `llm_defaults.py` |
| Grok | `grok-4.3` (THEIRS) | Fallback | THEIRS `llm_defaults.py` |
| Qwen3 / Qwen3-Big (local) | 4B–32B, fp8/bf16, via `custom_openai` gateway | OURS local LLM (#87/#92) | OURS `MIT/manga_translator/translators/qwen3.py` |
| Groq | fast inference | OURS fallback | OURS `translators/groq.py` |

#### Technique & Constants

| Constant | THEIRS | OURS | Meaning | File:line |
|----------|--------|------|---------|-----------|
| `temperature` | **0.1** (all providers) | **0.5** default | Sampling determinism | THEIRS `config_gpt.py:339-344`, `llm_defaults.py`; OURS `config_gpt.py:340` |
| `top_p` | 0.95–1.0 | 1.0 | Nucleus sampling | `config_gpt.py:344` |
| `top_k` | 0 / 40 / 64 per provider | (inherited) | Top-k sampling | THEIRS `llm_defaults.py` |
| `max_tokens` | 16384 (reasoning) / 4096 | (inherited) | Output cap | THEIRS `config.py:39-95` |
| Numbered contract | `<|1|>...<|2|>...`, split on first `||` | `<|{id}|>{query}` via `_list2prompt` | Region tagging | THEIRS `services/translation.py:59-62`; OURS `common_gpt.py:176-186` |
| Determinism cache gate | `temp==0 ∨ top_k==1 ∨ top_p==0` | **none** | Cache only deterministic runs | THEIRS `caching.py:207`; OURS absent |
| Context image cap | 0–10 (low-res) | n/a (per-series only) | Prev-page transcript images | THEIRS `validation.py:19-22` |
| Context text cap | 0–50 | n/a | Prev-page transcript texts | THEIRS `validation.py:19-22` |

- **THEIRS prompting**: 3-step method (literal → analysis → refinement) in `config_gpt.py:20-61`, role "Professional Doujin Translator". Optional `## PREVIOUS PAGE TRANSCRIPTS` (event-based OCR chaining, `batch_coordinator.py:121-153`, `ocr_text_ready_events[i]` with 0.2 s/round timeout) and `## SPECIAL INSTRUCTIONS` glossary block (Rosetta auto-detect → JSON `{"1":...}` + `Glossary: - X -> Y` lines). SAM neighbour whiteout before crop (`translation.py:1835-1859`).
- **OURS prompting**: inherits the same 3-step `config_gpt.py` template. **Series context (#157)** wired via `TranslatorConfig.series_context` (`MIT/manga_translator/config.py:261`, merged at `config.py:300-305` by `series_context.py:append_series_context`); Backend builds it in `composeSeriesContext()` and passes via `translator.series_context` (`books.service.ts:620`). **No per-page prior-context**, no emphasis markdown, no glossary injection (translation-memory #160 persists page text to Supabase `chapter_page_texts` via `savePageText()` at `books.service.ts:256` but is **write-only** — not retrieved into prompts).

---

### 4. Cleaning / Mask Generation / Inpainting

#### Models

| Model | ID / Path | Size | Purpose | Provenance |
|-------|-----------|------|---------|------------|
| LaMa large (OURS default) | `dreMaz/AnimeMangaInpainting/lama_large_512px.ckpt` | ~280 MB, VRAM ~2 GB | FFC inpainting, text removal | OURS `inpainting_lama_mpe.py:17-31`, `config.py` `Inpainter.lama_large` |
| LaMa mpe (OURS alt) | same repo, `use_mpe=True` | ~450 MB | Better on complex BG | OURS `inpainting/__init__.py:13-20` |
| FLUX.1 Kontext (THEIRS) | `black-forest-labs/FLUX.1-Kontext-dev`; quant: `Disty0/FLUX.1-Kontext-dev-SDNQ-uint4` | ~8 GB (sdnq) / ~24 GB (nunchaku) | Diffusion text-removal inpaint | THEIRS `inpainting.py:88-978`, `model_manager.py:229-237` |
| FLUX.2 Klein 4B (THEIRS default) | `Disty0/FLUX.2-klein-4B-SDNQ-4bit` | ~1.1–8 GB | Distilled inpaint | THEIRS `config.py:131` |
| FLUX.2 Klein 9B (THEIRS) | `Disty0/FLUX.2-klein-9B-SDNQ-4bit` | ~2.2–12 GB | Larger distilled inpaint | THEIRS `model_manager.py:229-237` |

#### Technique & Constants — THEIRS

| Constant | Value | Meaning | File:line |
|----------|-------|---------|-----------|
| `FLUX_GUIDANCE_SCALE` | 2.5 | Kontext guidance | `inpainting.py:29`, `config.py:160` |
| `flux_num_inference_steps` | 8 (4 for Klein) | Diffusion steps | `config.py` |
| `flux_prompt` | `"Remove all text."` | Inpaint instruction | `config.py` |
| Preferred resolutions | 17 (672×1568 … 1568×672, mult of 16) | AR-snapped inpaint sizes | `inpainting.py:139-157` |
| `padding` | `min(0.5·max(w,h), 80px)` | Context padding | `config.py:31` |
| `BLUR_SCALE_FACTOR` | 0.1 | `blur_radius=clip(0.1·max(w,h),1,10)` edge feather | `inpainting.py:22-26, 358-367` |
| Mask bbox quantize | 2 px grid | Cache stability | `inpainting.py:710-744` |
| Mask signature | 64×64 downsample (bilinear + thr 0.5) | Cache key | `inpainting.py:710-744` |
| LAB luminance-match | `L'=(L-gen_mean)·scale+orig_mean`, `scale=clip(orig_std/gen_std,0.5–2.0)` | Color-cast fix; skip if `|Δmean|<1.3 ∧ |Δstd|<2.0`, neutralize a/b if shift>1.0 | `inpainting.py:1187-1256`, round2-deep.md:62 |
| `roi_shrink_px` | 5 | Distance-transform mask shrink | `cleaning.py` / `config.py:28-31` |
| `JUNCTION_ADJACENCY_MARGIN` | 10 | Conjoined-neck preserve zone | `cleaning.py:159-211` |
| `JUNCTION_MIN_SHRINK` | 1.0 | Shrink inside junction zone | `cleaning.py:159-211` |
| `MIN_CONTOUR_AREA` | 50 | Contour filter | `cleaning.py:214-505` |
| `thresholding_value` | 200 | Bubble binarization (Otsu optional) | `config.py:28-31` |
| Color classify (WHITE) | `bright≥0.65 ∨ (mode≥245 ∧ dom≥0.40 ∧ dark≤0.10)` | Bubble bg class → flat-fill vs FLUX | `cleaning.py:389-460` |
| Solid-bg FLUX skip | edge white/black ratio ≥ 0.95 → cv2 fill | Skip diffusion | round2-deep.md:60 |
| KMeans color probe | k=2, luminance 128 split | OSB bg color | `outside_text_processor.py:391-400` |

THEIRS mask gen (`cleaning.py:214-505`): dilate base (7×7 ellipse) → invert grayscale for black bubbles → threshold 200/Otsu → AND ROI → distance-transform shrink keep `dist≥5px` → contour filter (area≥50) → centroid validation in eroded base. Three FLUX backends: **sdnq** (cross-platform), **sdcpp** (subprocess, GGUF Q4_K_M), **nunchaku** (CUDA INT4, CPU-offload, serialized by lock).

#### Technique & Constants — OURS

| Constant | Value | Meaning | File:line |
|----------|-------|---------|-----------|
| `mask_dilation_offset` | 20 | Feeds per-region dilate size | OURS `text_mask_utils.py`, PIPELINE.md §3.5 |
| `dilate_size` | `max((int((text_size+20)·0.3)//2)·2+1, 3)` | Per-region dilation kernel (odd) | OURS `text_mask_utils.py:104-200` |
| `scale_factor` | `max(min((H−h/3)/H, 1), 0.5)` | Adaptive raw-mask upsample | OURS `text_mask_utils.py:183` |
| Connected-comp overlap | 1e-2 | Region merge threshold | OURS `mask_refinement/__init__.py` |
| Bilateral filter | `(17, 80, 80)` | Context smoothing | OURS `mask_refinement` |
| CRF (optional pydensecrf) | bilateral `sxy=23, srgb=7, compat=20`, 5 iters | Mask refine (falls back to raw if absent) | OURS PIPELINE.md §5 |
| Final dilation kernel | 3 (must be odd) | Ellipse dilation | OURS PIPELINE.md §6.4 |
| `inpainting_size` | 1536 (default) | LaMa input resize | OURS Backend `MIT_INPAINTING_SIZE` |
| `inpainting_precision` | bf16 (default) | `torch.autocast` on CUDA | OURS `inpainting_lama_mpe.py:106`, `MIT_INPAINTING_PRECISION` |

OURS: LaMa forward pass, **binary 0/255 mask required** (PIPELINE.md §6.3, §6.6), **no edge feathering, no LAB luminance-match, no determinism gate, no KMeans probe, no solid-bg skip**. Patches written as per-region PNG with ICC-profile passthrough on GRAY/mode-L images (`patch_png.py:183-189`, #156), `compress_level=1` + 30 s encode timeout (PIPELINE.md §5).

---

### 5. Text Layout

> Layout is **pure algorithm** — no models. THEIRS uses HarfBuzz shaping + Skia metrics + Knuth-Plass; OURS uses FreeType + greedy wrapping.

#### Technique & Constants

| Constant | THEIRS | OURS | Meaning | File:line |
|----------|--------|------|---------|-----------|
| Font search range | `low=8 high=16` dialogue / `10–64` OSB | `low=8 high=64`, `high=max(8,int(h_box·0.5))` for bubble-fit | Binary-search font sizing | THEIRS `layout_engine.py:656-835`; OURS `font_fit.py:12-46`, `rendering/__init__.py:60-83` |
| Fit margin | corner collision vs mask | `_FIT_MARGIN=0.92` | Render-box safety | THEIRS `layout_engine.py:607-653`; OURS `rendering/__init__.py:55-57` |
| `_LINE_HEIGHT` / line_spacing | Skia `(-fAscent+fDescent+fLeading)·spacing` or `font_size×1.2` | `1.2` hardcoded | Line height | THEIRS `layout_engine.py`; OURS `rendering/__init__.py:55` |
| `_MAX_FONT_BOX_RATIO` | — | 0.5 | Max font as fraction of box | OURS `rendering/__init__.py:55-57` |
| `max_squeezes` | 3 (mask) / 1 (no mask), `width*=0.90` | **none** | Collision squeeze retry | THEIRS `layout_engine.py:737-795` |
| `badness_exponent` | 3.0 | n/a (greedy) | Knuth-Plass DP cost `slack^3 + 1000·hyphen` | THEIRS `text_processing.py:489-578` |
| `hyphen_penalty` | 1000 | n/a | Line-break penalty | THEIRS `text_processing.py:495` |
| `hyphenation_min_word_length` | 8 | n/a | Min word to hyphenate | THEIRS `config.py:98-117` |
| Kinsoku NOT_AT_START | `。，！？）】」』…` | **none** | CJK forbidden line-start | THEIRS `text_processing.py:222-226` |
| Kinsoku NOT_AT_END | `(【「『` | **none** | CJK forbidden line-end | THEIRS `text_processing.py:222-226` |
| Hangul no-line-start | `{랑,께,란,게,서,럼,면}` | **none** | Korean syllable rule | THEIRS `text_processing.py:10-18` |
| `AUTO_VERTICAL_MIN_ASPECT_RATIO` | 1.6 | n/a (vertical never called) | Auto-vertical trigger | THEIRS `text_renderer.py:27-79` |
| `AUTO_VERTICAL_MAX_CHARS` | 12 | n/a | Auto-vertical char cap | THEIRS `text_renderer.py:27-79` |
| `AUTO_VERTICAL_MAX_WORDS` | 1 | n/a | Auto-vertical word cap | THEIRS `text_renderer.py:27-79` |
| `VERTICAL_ADVANCE_TRACKING` | 0.90 | n/a | Vertical glyph advance | THEIRS `text_renderer.py:26` |
| Safe-area `padding_pixels` | 5 (distance-transform) | n/a (8% bbox fallback) | Min inscribed-box distance | THEIRS `image_utils.py:173-348` |
| Pole-of-inaccessibility threshold | 0.70·max_dist | **none** | Centroid-in-neck fallback to max-dist pixel | THEIRS `image_utils.py:247` |
| HarfBuzz scale | `int(font_size·64)` (26.6 fixed-point) | FreeType integer advance | Sub-pixel shaping | THEIRS `layout_engine.py:30-67`; OURS `text_render.py:1-200` |
| Thai combining-mark safety | n/a | `_safe_char_split()` keeps marks on base | Thai wrap safety | OURS `text_render.py:36-47` |

- **THEIRS** safe-area: pad mask 1px → `cv2.distanceTransform(L2,PRECISE)` → safe = `dist≥5` → centroid via `cv2.moments()` → **pole-of-inaccessibility fallback** if `dist_at_centroid < 0.70·max_dist` (avoids conjoined necks) → ray-cast 4 cardinal dirs → symmetric box `2·(min_dist−1)` per axis; bbox−8% fallback. Knuth-Plass DP line-breaking with per-char CJK kinsoku, word-level Hangul, midpoint-out Latin hyphenation.
- **OURS** greedy wrap (`text_render.py:664-1172`): tokenize whitespace/CJK, fit left-to-right; Thai via optional `pythainlp.word_tokenize`. `calc_vertical()` exists (`text_render.py:343-385`) but **never called** in patch rendering. No kinsoku, no hyphenation, no safe-area distance-transform, no pole fallback. Bubble-fit (#166/#175) binary-search is **opt-in + sole-occupant gated**; multi-region balloons fall to legacy crop-floor heuristic.

---

### 6. Rendering / Drawing

> Layout (§5) chooses *where/how big*; rendering rasterizes glyphs.

#### Technique & Constants

| Constant | THEIRS | OURS | Meaning | File:line |
|----------|--------|------|---------|-----------|
| `supersampling_factor` | **4** (LANCZOS crop→×4→render→downscale) | **none** (only pre-upscale if img <~1e6 px²) | Anti-alias quality | THEIRS `text_renderer.py:366-517`, `config.py:114`; OURS none |
| Outline color rule | BLACK if `lum≥80` else WHITE, `lum=0.299r+0.587g+0.114b` | same luminance rule, PIL/cv2 border dilation | Stroke color | THEIRS `drawing_engine.py:189-202`; OURS `text_render.py` |
| Stroke style | Skia `kStroke_Style kRound_Join`, `outline_width` configurable | `stroke_radius=64·max(int(0.07·font_size),1)` (~7%, not configurable) | Outline rasterization | THEIRS `drawing_engine.py:188-202`; OURS `text_render.py:316-327, 500-506` |
| `outline_width` (dialogue) | 0.0 | n/a | Default dialogue outline | THEIRS `config.py:102-114` |
| `osb_outline_width` | 3.0 | n/a (no OSB) | SFX outline | THEIRS `config.py:147-150` |
| `min_font_size` / `max_font_size` | 8 / 16 (dialogue), 10 / 64 (OSB) | via `font_size_offset` + `font_size_minimum` env | Font bounds | THEIRS `config.py:102-150`; OURS Backend `buildMitConfig` |
| Per-line centering | `line_start_x = block_start_x + (max_line_width−line_w)/2` | center per line | Horizontal alignment | THEIRS `drawing_engine.py` |
| Perspective warp | — | `cv2.findHomography()` guarded vs degenerate quads (#110) + alpha composite | Region placement | OURS `rendering/__init__.py:459-483` |
| Font hinting / subpixel | `font_hinting="none"`, `use_subpixel_rendering=False` default | FreeType defaults | Glyph hinting | THEIRS `config.py:102-117` |

- **THEIRS** renders via **Skia + HarfBuzz** with 4× supersampling, configurable outline, OSB pipeline (AnimeText YOLO → KMeans color probe → FLUX inpaint → render 10–64 px with 3 px stroke; solid-color skip FLUX).
- **OURS** renders via **FreeType + PIL + OpenCV**: no supersampling (jagged glyphs at small sizes), font-proportional stroke (~7%, thin SFX), no OSB pipeline (#168), perspective warp + alpha composite. Thai combining-mark safety preserved.

---

### 7. Orchestration, Config, Model Management, Caching

#### THEIRS (single-process Gradio app)

| Mechanism | Detail | File:line |
|-----------|--------|-----------|
| Config | Dataclass hierarchy `MangaTranslatorConfig` → Detection/Cleaning/Translation/Rendering/Output/OutsideText/Preprocessing (~120 fields, documented defaults) | `core/config.py:1-276` |
| Entry | `MangaTranslator.translate(image, config)` → `_translate()` async | `manga_translator.py:371-441, 447-698` |
| Model mgmt | `ModelManager` RLock singleton, 22 `ModelType` enums, lazy `is_loaded()` + `load_*()`; **manual unload only** (no TTL eviction — `models_ttl>0` is a stub, `manga_translator.py:727`) | `model_manager.py:54-95, 105-142, 1354-1475` |
| Batch | `BatchRequestCoordinator` reentrant `BoundedSemaphore(parallel_requests)` (default 1) | `batch_coordinator.py:18-76` |
| Cache | `UnifiedCache` singleton, per-stage LRUs: yolo/sam/translation =1, manga_ocr/upscale/inpaint =20; **determinism gate** `temp==0 ∨ top_k==1 ∨ top_p==0`; per-image isolation `set_current_image()` clears on hash change | `caching.py:12, 198-293, 599-624` |

#### OURS (Backend NestJS + MIT worker)

| Mechanism | Detail | File:line |
|-----------|--------|-----------|
| Config build | `buildMitConfig()` env-driven → JSON: `translator.{target_lang,source_lang,model,series_context}`, `detector.{detection_size=2048,text_threshold,det_invert,det_gamma_correct,det_bubble_seg,det_sfx}`, `ocr.prob`, `inpainter.{inpainter=lama_large,inpainting_size=1536,inpainting_precision=bf16}`, `render.{rtl,font_size_offset,font_size_minimum,bubble_area_fit}` | `books.service.ts:551-658` |
| ENV knobs | `MIT_DETECTION_SIZE, MIT_TEXT_THRESHOLD, MIT_OCR_PROB, MIT_DET_INVERT, MIT_DET_GAMMA_CORRECT, MIT_BUBBLE_SEG, MIT_SFX_DETECTOR, MIT_FONT_SIZE_OFFSET, MIT_FONT_SIZE_MIN, MIT_BUBBLE_AREA_FIT, MIT_INPAINTER, MIT_INPAINTING_SIZE, MIT_INPAINTING_PRECISION` (helpers: `fracEnv` 0<n≤1, `signedIntEnv`, `posIntEnv`, `flagEnv`) | `books.service.ts:583-604`; tested `books-mit-config.spec.ts:19-33` |
| Gemini catalog | In-memory `geminiModelsCatalog`, 1 h TTL (`GEMINI_MODELS_CACHE_TTL_MS`), Redis fallback; defaults `gemini-2.5-flash` / `-flash-lite` | `books.service.ts:39-42, 322-389` |
| MIT health | `getImageTranslator()` polls `/ready` (3 s timeout, 60 s cache) → translator family gate | `books.service.ts:451-469` |
| Patch naming | `{srcMIT}__{tgtMIT}__{model}__p{pageIndex}__r{regionIndex}.png`, content-hash `?v=sha1[:12]`, 5 MB/patch cap; `OWNED_NAME=/__p\d+__r\d+\.png$/`; stale-region + legacy sweep (boot + 24 h) | `patch-store.ts:16-20, 62-134` |
| Webhook | `handleMitCallback()` idempotent dual-lock (`processingPages.has` entry gate + `completedPages.set` persistence); HMAC over raw bytes `crypto.timingSafeEqual` (#95); pixel→pct `x/imgW` etc. | `books.service.ts:180-302`; `mit-webhook.controller.ts:43-67` |
| Job registry | `activeBatchJobs` Map keyed `chapterId:srcMIT:tgtMIT:imageModelKey:derivative`; `startOrAttachBatchJob` pre-checks cache per page, POSTs uncached to MIT `/translate/with-form/patches/batch` (202 Accepted), fan-out: `originalListener` + `listeners` + `redis.publish(translate:{jobKey})`; 15 min global timeout; cancel on zero `activeCallerCount` → `cancelController.abort()` + `/cancel` | `books.service.ts:118, 939-968, 981-1135, 1141-1219` |
| Cache | 3-tier `CacheOrchestratorService`: L1 JSON in-process → L2 Redis (source-of-truth, `DEFAULT_TTL_MS=20 min`) → L3 disk write-behind (`BatchSyncWorker` 20 s); patch key v6 `translate:manga-patches:v6:chapterId:pageIndex:srcMIT:tgtMIT:model:derivative` (7-day TTL); **no determinism gate** | `cache-orchestrator.service.ts:8, 59-149`; `books.service.ts:242-249, 523-535` |
| Translation memory | `translationMemory.savePageText()` fire-and-forget upsert to Supabase `chapter_page_texts` (idempotent on chapter+page+lang, `source='edited'` curation gate, #160) | `books.service.ts:256`; `translation-memory.repository.ts:24-54` |
| MIT worker | Singleton `_translator` per process; endpoints `/simple_execute/translate{,_patches,_batch}`, `/execute/translate`; progress hooks; `models_ttl=0` eager-load (TTL>0 unimplemented) | `MIT/manga_translator/mode/share.py:1-225`; `manga_translator.py:100-163, 414-423` |

**Key divergences (orchestration):** OURS adds webhook/Redis/SSE async infra (THEIRS is in-process LRU only) — buys multi-user batch + cancellation + cross-instance fan-out at the cost of network/Redis latency per callback. OURS has **no MIT-level determinism cache gate** (Backend caches all results, even stochastic temp>0 runs → possible false cache hits). `models_ttl` is read but never enforced in both (VRAM held until process restart).

---

### 8. Complete ML Model Inventory (VRAM Budgeting)

| Model | THEIRS | OURS | Size (VRAM/disk) | Stage |
|-------|--------|------|------------------|-------|
| DBNet `detect-20241225.ckpt` (ResNet34) | — | **default** | ~300 MB | Detection |
| `kitsumed/yolov8m_seg-speech-bubble` | yes (primary) | opt-in `MIT_BUBBLE_SEG` | ~490 MB transient, 30 ms/page | Detection |
| `ogkalu/comic-speech-bubble-detector-yolov8m` | yes (conjoined) | — | ~25 MB | Detection |
| `deepghs/manga109_yolo` (YOLOv11l panel) | yes | — | ~64 MB | Detection |
| `deepghs/AnimeText_yolo` (YOLOv12x OSB) | yes | opt-in `MIT_SFX_DETECTOR` (#168) | ~400 MB | Detection/OSB |
| `facebook/sam2.1-hiera-large` | yes | — | ~2–4 GB | Segmentation |
| `facebook/sam3` (gated) | yes | — | ~2–4 GB | Segmentation |
| `Kim2091/2x-AnimeSharpV4` (RCAN + Fast PU) | yes | — (esrgan present, not wired) | ~31 MB / ~2 MB | Upscale |
| 48px Roformer CNN `ocr_ar_48px.ckpt` | yes | **default (identical)** | ~90 MB | OCR |
| `kha-white/manga-ocr-base@refs/pr/4` | yes | — | ~100–200 MB | OCR fallback |
| `PaddlePaddle/PaddleOCR-VL-1.5` | yes | — | ~200 MB–1 GB | OCR fallback |
| LaMa `lama_large_512px.ckpt` | — | **default** | ~280 MB, VRAM ~2 GB | Inpaint |
| LaMa mpe | — | alt | ~450 MB | Inpaint |
| FLUX.1 Kontext (full / SDNQ / nunchaku) | yes | — | ~24 GB / ~8 GB / ~6–8 GB | Inpaint |
| FLUX.2 Klein 4B / 9B (SDNQ) | yes (4B default) | — | ~1.1–8 GB / ~2.2–12 GB | Inpaint |
| FLUX support (VAE `flux2-vae`, CLIP-L `clip_l`) | yes | — | ~300 MB / ~400 MB | Inpaint |
| Gemini 2.5/3.1 Flash (+Lite) | 3.1 | 2.5 | API (no VRAM) | Translate |
| Qwen3 / Qwen3-Big (local 4-bit) | — | opt-in | ~4–8 GB | Translate |
| GPT / Claude / Grok / Groq | yes (GPT/Claude/Grok) | GPT/Groq | API | Translate |

**Peak co-resident VRAM (page mid-flight):**
- **THEIRS** ≈ YOLO ~500 MB + SAM2 ~2–4 GB + LLM + **FLUX ~8–12 GB** ≈ **11–15 GB** (FLUX dominates).
- **OURS** ≈ DBNet ~300 MB + 48px ~1.5 MB + **LaMa ~350 MB** + LLM ≈ **1–2 GB** (LaMa dominates; +~4–8 GB if Qwen3 4-bit selected, no FLUX by default).

This is the core trade: THEIRS buys photorealistic inpaint + crisp supersampled text + glossary/emphasis context at **8–15 GB VRAM**; OURS runs in **1–2 GB** with LaMa + DBNet + 48px CNN, trading inpaint fidelity (screentone artifacts, color-cast, no edge feathering) and render polish (no supersampling, no kinsoku, no OSB) for footprint and multi-user webhook orchestration.

---

I have the findings. Writing the two requested Markdown sections directly.

## Our Stack (MIT + Backend) — What We Have

Per-stage inventory of what MangaDock actually ships today (MIT Python worker + NestJS Backend orchestration), with file:line anchors.

### MIT Pipeline (Python inference)

| Stage | What we ship | Anchor |
|-------|--------------|--------|
| **Detection** | DBNet ResNet34 (`detect-20241225.ckpt`, ~300 MB), `detection_size` 2048 default. Optional speech-bubble YOLO-seg (`kitsumed/yolov8m_seg-speech-bubble`, ~490 MB transient, ~30 ms/page) gated on `det_bubble_seg` (#170). Optional SFX detector gated on `det_sfx` (#168, AFK-gated). | `detection/default.py:28-51`; `bubble_detector.py:18-31`; `manga_translator.py` |
| **OCR** | 48px Roformer/XPos CNN (`ocr_ar_48px.ckpt` + `alphabet-all-v7.txt`), fixed 48px text height, beam k=5, identical upstream weights. Confidence floor hardcoded `0.2` but exposed only via `MIT_OCR_PROB` env. Per-char FG/BG color extraction unchanged from upstream. No two-step fallback (no manga-ocr / PaddleOCR-VL wired). | `ocr/model_48px.py:27-62`, `:70`, `:124-153`; `ocr/__init__.py:11-16` |
| **OCR post-repair** | Repetition + hallucination retry; page-level target-script-ratio gate (`_PAGE_LANG_CHECK_MIN_REGIONS=6`); per-translator post-dict. No numbered parser, no `[Missing item N]` fill, no emphasis-markdown prep. | `manga_translator.py:89`, `:336-420`; `utils/lang_ratio.py` |
| **Translation** | Per-request dispatch: Gemini (`gemini.py`), Qwen3 / Qwen3-Big (`qwen3.py`, local via custom_openai gateway), GPT (`chatgpt.py`), Groq (`groq.py`). Inherits upstream 3-step prompt template; numbered `<|id|>` contract. **Temp defaults 0.5** (`config_gpt.py:340`), top_p 1.0 — no unified 0.1 enforcement, no per-request emphasis rules. | `translators/__init__.py`; `translators/config_gpt.py:20-100`; `translators/common_gpt.py:164-200` |
| **Series context** | `TranslatorConfig.series_context` (#157) merged into ConfigGPT templates via OmegaConf (`append_series_context()`). Per-series only (character names, tone) — no per-page "PREVIOUS PAGE TRANSCRIPTS", no event-based OCR chaining (designed in ARCHITECTURE.md §7.1, not wired into patch path). | `series_context.py`; `config.py:261-264`, `:300-305` |
| **Mask refinement** | Adaptive scale-factor resize, per-region dilation (`mask_dilation_offset=20` → odd kernel), connected-components (1e-2 overlap), bilateral filter (17,80,80), optional pydensecrf CRF (5 iters, raw-mask fallback), final ellipse dilation (kernel 3). No edge feathering, no distance-transform safe-area. | `mask_refinement/__init__.py:9`; `text_mask_utils.py:104-200`; PIPELINE.md §3.5, §6.3-6.4 |
| **Inpainting** | LaMa `lama_large` (`lama_large_512px.ckpt`, ~280–380 MB, bf16 autocast, ~2 GB VRAM), `inpainting_size` 1536 default. No FLUX, no quantization, no LAB luminance-match, no determinism gate, no KMeans probe, no solid-bg flat-fill skip. | `inpainting/__init__.py:13-20`; `inpainting_lama_mpe.py:17-31`, `:106`; `config.py` Inpainter enum |
| **Layout / line-break** | `fit_font_size()` pure-arithmetic binary search (`low=8 high=64 margin=0.92`), `_LINE_HEIGHT=1.2`, `_MAX_FONT_BOX_RATIO=0.5`. `_bubble_fit_font_size()` (#166/#175) opt-in + sole-occupant gated. Greedy CJK/whitespace wrap; Thai via `pythainlp` + `_safe_char_split()` combining-mark safety. No kinsoku, no hyphenation in patch path, no vertical layout (`calc_vertical()` exists but unused), no safe-area / pole-of-inaccessibility. | `font_fit.py:12-46`; `rendering/__init__.py:55-83`, `:86-291`; `text_render.py:36-47`, `:664-1172`, `:343-385` |
| **Rendering / draw** | FreeType bitmap rasterization (integer advance, no HarfBuzz shaping, no 26.6 fixed-point). Stroke via `freetype.Stroker`, radius `64·max(int(0.07·font_size),1)` (~7%, not configurable). Luminance-based outline color (same formula as theirs). cv2 perspective warp + alpha composite (`findHomography` None-guarded, #110). **No 4× supersampling.** No OSB renderer. | `text_render.py:316-327`, `:500-506`; `rendering/__init__.py:459-483` |
| **Worker / orchestration (MIT)** | Singleton `MangaTranslator` per worker (`share.py:33`). Endpoints: `/simple_execute/translate`, `/translate_patches`, `/execute/translate`, `/translate_batch`. `translate_patches()` = production path: front-half once, union-find proximity grouping (bubble-aware #170), back-half under `_PATCH_CONCURRENCY=3` semaphore, PNG encode in thread pool (`compress_level=1`, 30s timeout). `models_ttl` read but auto-unload is dead code. ICC-profile passthrough on GRAY (`patch_png.py`, #156). | `manga_translator.py:100-163`, `translate_patches`; `mode/share.py:1-225`; `utils/patch_png.py:183-189` |

### MangaDock Backend (NestJS orchestration of MIT)

| Concern | What we ship | Anchor |
|---------|--------------|--------|
| **Config building** | `buildMitConfig()` assembles a 30+-field JSON from env knobs: `MIT_DETECTION_SIZE` (2048), `MIT_INPAINTER` (lama_large), `MIT_INPAINTING_SIZE` (1536), `MIT_INPAINTING_PRECISION` (bf16), `MIT_OCR_PROB` (#167 rescue), `MIT_TEXT_THRESHOLD`, `MIT_DET_INVERT`, `MIT_DET_GAMMA_CORRECT`, `MIT_BUBBLE_SEG` (#170), `MIT_SFX_DETECTOR` (#168), `MIT_FONT_SIZE_OFFSET`, `MIT_FONT_SIZE_MIN`, `MIT_BUBBLE_AREA_FIT` (#166). Lang pair via `mitLangCode()` static map. **No translator sampling params exposed (temp/top_k/top_p).** | `books.service.ts:551-658`, `:582-604`; `books-mit-config.spec.ts:19-33` |
| **Model selection** | Gemini catalog (1 h in-memory + Redis fallback), defaults `gemini-2.5-flash` / `gemini-2.5-flash-lite`. `getImageTranslator()` polls MIT `/ready` (3 s timeout, 60 s cache) → translator family. Per-request model override via `imageModelKey()` safety filter `/^[\w.-]+$/`. | `books.service.ts:39-42`, `:322-389`, `:445-469` |
| **Webhook / patches** | `handleMitCallback()` idempotent (dual lock: `processingPages` entry gate + `completedPages` persistence). HMAC over raw bytes (`timingSafeEqual`, #95). Deterministic patch naming `{src}__{tgt}__{model}__p{N}__r{N}.png`, content-hash `?v=sha1` cache-bust, 5 MB cap, stale-region + legacy sweep (boot + 24 h). Pixel→percentage coords (zero-safe). | `books.service.ts:180-302`; `patch-store.ts:16-20`, `:62-134`; `mit-webhook.controller.ts:43-67` |
| **Batch job registry** | `activeBatchJobs` Map keyed `chapterId:srcMIT:tgtMIT:imageModelKey:derivative`. Pre-checks cache per page, emits cached pages immediately, POSTs uncached to MIT async (202 Accepted), webhook fan-out: `originalListener` direct SSE + `listeners` set + `redis.publish` cross-instance. 15 min global timeout, ref-counted cancellation → MIT `/cancel`. | `books.service.ts:981-1135`, `:1141-1219` |
| **Caching (3-tier)** | L1 JSON in-process + L2 Redis (source-of-truth, TTL) + L3 disk write-behind (`BatchSyncWorker` 20 s, survives Redis loss). Patch cache key v6 includes model + series-context segment. Default TTL 20 min; patches 7-day. **No determinism gate — caches stochastic runs.** | `cache-orchestrator.service.ts:59-149`; `books.service.ts:242-249` |
| **Translation memory** | `translationMemory.savePageText()` fire-and-forget upsert to Supabase `chapter_page_texts` (idempotent on chapter+page+lang, `source='edited'` curation gate, #160). Glossary persisted but **not retrieved/injected into in-flight translation** (#161 pending). | `books.service.ts:256-258`; `translation-memory.repository.ts:24-97` |

**Peak co-resident VRAM (ours):** DBNet ~300 MB + 48px ~minimal + LaMa ~350 MB + optional bubble-YOLO ~490 MB + optional Qwen3 4-bit ~4–8 GB ≈ **1–2 GB** without local LLM (LaMa dominates; no FLUX by default).

## Why Ours Is Worse — Per-Dimension Analysis

Ranked by visible defect impact on the rendered page. Each row gives the root cause and the concrete fix, mapped to a tracked issue (or `new`).

| # | Dimension | Why ours is worse — root cause | Concrete fix | Issue |
|---|-----------|-------------------------------|--------------|-------|
| 1 | **Inpaint patch seams** (most visible) | No edge feathering. Theirs ramps a distance-transform alpha (`inpainting.py:358-367`, `blur_radius=clip(0.1·max(w,h),1,10)`) so inpaint blends into context; our LaMa output is hard-masked → visible rectangular patch boundary. | Add distance-transform alpha ramp at the mask/context boundary before alpha-composite in `rendering/__init__.py`. | **#173** |
| 2 | **Font weight / size / supersampling** | (a) **No 4× supersampling** — theirs crop→LANCZOS×4→render→downscale (`text_renderer.py:366-517`); we render at native region size → jagged glyphs, blunt serifs. (b) Font sizing is heuristic (char-ratio inflate, ×1.1 box) not balloon-fit by default — `_bubble_fit_font_size` (#166) is opt-in *and* sole-occupant gated, so multi-region balloons fall to a crop-derived floor → text 40–50% smaller than theirs (One Punch-Man benchmark). | Add `supersampling_factor=4` to render config; make balloon-fit the default path and drop the sole-occupant gate so multi-region balloons get fitted. | **#175** (sizing) + **new** (supersampling) |
| 3 | **Overflow / vertical** | (a) Balloon overflow: patch crop sized to textlines only; Backend can't expand the crop until the bubble_box arrives *with* the response, so loose balloons clip the patch edge. Theirs pre-segments and unions the balloon box before render (`pipeline.py` `_process_group`). (b) **No vertical layout** — `calc_vertical()` exists but is never called; tall narrow boxes render horizontal and cram/overflow. Theirs auto-selects vertical at `aspect≥1.6 ∧ ≤12 chars ∧ ≤1 word`. | (a) Expand patch crop to the union balloon box in Backend `_runMitBatch` once bubble_box is known, or pre-segment balloons. (b) Wire `calc_vertical()` into the patch render path with their auto-vertical heuristic. | **#175** (overflow) + **new** (vertical) |
| 4 | **Anchoring** | No safe-area distance-transform and no pole-of-inaccessibility fallback. We grow bbox ×1.1 / pad 8% and center on the raw centroid; theirs computes `distanceTransform(L2)` → centroid → if `dist_at_centroid < 0.70·max_dist` falls back to the max-distance pixel (`image_utils.py:173-348`), avoiding conjoined-bubble necks. On thin/irregular masks our text touches or exits the bubble; on split bubbles it can center in the neck. | Port the distance-transform safe-area box + pole-of-inaccessibility fallback into `rendering/__init__.py` to replace the ×1.1 / 8%-pad heuristic. | **new** |
| 5 | **Line-breaking / narrow-column** | No kinsoku, no hyphenation in the patch path, no DP line-breaking. We greedy-wrap at any char boundary; theirs runs Knuth-Plass DP (`badness=slack³+1000·hyphen`, `text_processing.py:489-578`), enforces per-char CJK kinsoku (`KINSOKU_NOT_AT_START/END`), Hangul forbidden-start syllables, and Latin midpoint-out hyphenation. Result: uneven lines, forbidden punctuation at line edges, long Latin words forced to one line → overflow in narrow columns. | Replace greedy `calc_horizontal()` wrap with Knuth-Plass DP + kinsoku sets + Latin hyphenation; reuse upstream `text_processing.py` rules. | **new** |
| 6 | **Detection coverage (SFX/narration)** | DBNet misses stylized small high-contrast SFX and outside-bubble text; no dedicated OSB pipeline. Theirs runs AnimeText YOLO (`deepghs/AnimeText_yolo` yolo12x, imgsz 640, conf 0.6) → KMeans color probe → FLUX inpaint → big-font render (10–64 px, 3 px outline). Our `det_sfx` (#168) is merged but AFK-gated/off, and we have no OSB renderer. | Enable the AnimeText YOLO detector by default and add an OSB render path (larger font range + configurable outline). | **#168** |
| 7 | **OCR coverage (thin/small text)** | No minimum-size upscale before OCR. Theirs upscales textlines to `bubble_min_side_pixels=128` before the 48px model (`pipeline.py:991-1008`); we send native-size crops → long thin lines / small captions compress and the `0.2` floor silently drops them (no `[Missing item N]` repair). Manifests as #167 garbled chars and #172 recovered-but-mangled. | Add a `bubble_min_side=128` env knob + upscale-before-OCR step; add the numbered-parser `[Missing item N]` repair so dropped regions are visible. | **#172** + **#167** (floor) |
| 8 | **Translation tuning** (text fidelity, not glyph) | Temp defaults to **0.5** (`config_gpt.py:340`) vs their enforced **0.1**; no per-request emphasis (Giongo/Gitaigo, `*italic*`/`**bold**`) rules; glossary persisted but never injected; cache has no determinism gate so stochastic runs pollute keys. | Wire `MIT_TEMPERATURE=0.1` knob; add emphasis-markdown prompt prep; retrieve+inject glossary in the webhook path; add a determinism gate (`temp==0 ∨ top_k==1 ∨ top_p==0`) before caching. | **#171** (emphasis) + **#161** (glossary) + **new** (temp/gate) |

**One-line root cause across all dimensions:** we adopted upstream's *correct* engine but ship it **untuned** — heuristic font-fit instead of safe-area + collision binary-search, no supersampling, greedy wrap instead of DP+kinsoku, LaMa without feathering/luminance-match, and translation at temp 0.5 without emphasis/glossary context. The fixes are mostly porting upstream's already-written logic into our patch path behind opt-in seams, not new research.

---

## Black Boxes & Unknowns — What We Still Don't Understand (Both Codebases)

This section is the honest ledger of everything the static survey could **not** resolve. It consolidates every `their_blackboxes` and `ours_blackboxes` item from all six stage reports, plus a critical pass for gaps the stage authors did not flag. The hard limit to keep in mind: **a static read tells you what the code *says*, not what the model *does*, not why a constant *is what it is*, and not how a config knob *actually moves the output*.** Most ML behavior, every magic constant's rationale, and all cross-stage emergent effects sit outside what reading the source can confirm.

Each item is tagged with the cheapest credible way to close it:

- **[verify-by: read-code]** — answerable by reading more of the code we already have (un-surveyed files, deeper call traces). The cheapest tier; the only thing blocking it is that this survey did not get there.
- **[verify-by: run-experiment]** — requires running the pipeline and observing output/VRAM/latency. No amount of reading settles it.
- **[verify-by: ask-author]** — design intent or tuning history that lives only in a human's head or an unwritten ablation; neither reading nor a single experiment recovers the *why*.

---

## MangaTranslator (meangrinch) — Black Boxes

### 1. Opaque ML model behaviors (training data, why a model wins)

- **48px Roformer beam-search internals** — BeamSearch `k=5` termination (`model_48px.py:620-676`): `max_finished_hypos=2` + per-sample sort-key; the partial-beam pruning heuristic during expansion is not observable from the code alone. **[verify-by: run-experiment]**
- **Color-prediction head internals** (`model_48px.py:537-541`) — `color_pred1(decoded)` 64-dim bottleneck → per-char FG/BG; quantization/sigmoid on `fg_ind`/`bg_ind` availability flags is undocumented. **[verify-by: run-experiment]**
- **alphabet-all-v7.txt coverage on non-Latin scripts** — config claims "all" languages, but real success on Cyrillic/Thai/Arabic edge cases is non-deterministic and unverified. **[verify-by: run-experiment]**
- **SAM2 / SAM3 footprint & behavior** — `facebook/sam2.1-hiera-large` and gated `facebook/sam3`: parameter count, per-forward VRAM, latency on a 12GB box are all unspecified in the clone; SAM3's differences from SAM2 are undocumented. **[verify-by: run-experiment]**
- **PaddleOCR-VL-1.5 limits** — model-card VRAM, latency, and multimodal capability ceiling unspecified; `flash_attention_2`/`sdpa` path selection unmeasured. **[verify-by: run-experiment]**
- **manga-ocr-base (`@refs/pr/4`)** — model size, MeCab/Fugashi init overhead, and accuracy delta vs the 48px CNN are not characterized. **[verify-by: run-experiment]**
- **Nunchaku INT4 MatMul** — claimed AMD/Intel-ARC/NVIDIA compatibility with no measurements; actual VRAM savings and speedup factors unknown. **[verify-by: run-experiment]**
- **SDNQ quantization (Disty0 models)** — per-layer precision, expected vs. measured VRAM reduction, and numerical stability on edge cases are opaque. **[verify-by: run-experiment]**
- **FLUX Kontext full-precision footprint** — total VRAM when loaded is untested in the clone (only the INT4/quantized wrappers are exercised). **[verify-by: run-experiment]**
- **Gemini-3 custom sampling** (`gemini_3_custom_sampling=True`, `config.py:80`) — what custom logic is actually applied is undocumented. **[verify-by: ask-author]**
- **Config defaults reference unreleased models** — `gemini-3.1-flash-lite`, `gpt-5.4-nano`, `claude-sonnet-4.6`, `grok-4.3` are future-dated; the real deployed model IDs and their behavior are unmeasured in the clone. **[verify-by: run-experiment]**

### 2. Undocumented heuristics / magic constants with no rationale

- **YOLO secondary-bubble confidence `0.35`** (`ocr_detection.py:289-296`) — no visible ablation justifying this value. **[verify-by: ask-author]**
- **SAM mask threshold `0.5`** (`ocr_detection.py:17`, `SAM_MASK_THRESHOLD`) — impact on bubble-boundary precision unclear, no derivation. **[verify-by: ask-author]**
- **`bubble_min_side_pixels=128`** — the upscale-before-OCR floor; why 128 and not 96/160 is unexplained. **[verify-by: run-experiment]**
- **Temperature `0.1` across all 10 providers** — was this empirically tuned per-provider or applied as a blanket constant? **[verify-by: ask-author]**
- **`max_tokens_in` = 50% of output budget** — arbitrary ratio or measured for manga? **[verify-by: ask-author]**
- **Knuth-Plass `badness_exponent=3.0`** (`text_processing.py:495`) — Knuth's original is ~2; this looks tuned but is undocumented. **[verify-by: ask-author]**
- **`hyphen_penalty=1000`** — magnitude rationale absent. **[verify-by: ask-author]**
- **`VERTICAL_ADVANCE_TRACKING=0.90`** (`layout_engine.py:26`) — appears empirical, no rationale. **[verify-by: ask-author]**
- **Pole-of-inaccessibility threshold `0.70`** (`image_utils.py:247`) — the "use max-distance pixel if centroid dist < 0.70·max" cutoff has no derivation. **[verify-by: ask-author]**
- **Auto-vertical gate constants** — `AUTO_VERTICAL_MIN_ASPECT_RATIO=1.6`, `MAX_CHARS=12`, `MAX_WORDS=1`, `MAX_HORIZONTAL_FILL=0.45`, `MIN_FILL_GAIN=0.20`: a cluster of tuned thresholds with no documented basis. **[verify-by: ask-author]**
- **FLUX guidance `2.5` + 8 steps** — why 2.5 (not 1.0–3.0), why 8 (not 4/12), and prompt sensitivity of `"Remove all text."` are all opaque. **[verify-by: run-experiment]**
- **LAB luminance-match clamps** — `scale ∈ [0.5, 2.0]`, skip if `|Δmean|<1.3 & |Δstd|<2.0`, a/b neutralize if `shift>1.0`: clamp/threshold rationale and perceptual validation are claimed but unmeasured. **[verify-by: ask-author]**
- **Edge-feather `blur_radius = clip(0.1·max(w,h), 1, 10)`** — `BLUR_SCALE_FACTOR=0.1` derivation and quality tradeoff across radii not quantified. **[verify-by: ask-author]**
- **Solid-bg skip ratio `0.95`** — why white/black edge ratio ≥0.95 (not 0.90/0.99), tested against which artifacts? **[verify-by: run-experiment]**
- **KMeans color probe (`k=2`, luminance-128 split)** (`outside_text_processor.py:391-400`) — interior-vs-border classification and the 128 cutoff edge cases are unexplained. **[verify-by: ask-author]**
- **Conjoined-split tiered validation** — `TEXT_NUDGE_BOX_INSET_RATIO=0.08`, junction margin `10px`, `JUNCTION_MIN_SHRINK=1.0`: tie-breaking when both Tier-1 and own-side Tier-2 are viable, and numerical stability on irregular shapes, is opaque. **[verify-by: read-code]**
- **6-layer cache determinism gate** — `temp=0 ∨ top_k=1 ∨ top_p=0`: why this exact disjunction as the determinism proxy is unexplained. **[verify-by: read-code]**

### 3. Pipeline behaviors that need RUNTIME observation to confirm

- **Pan-page OCR-chaining latency** — the `0.2s/round` timeout in event-based chaining (`batch_coordinator.py:121-153`): how it was measured, under what network conditions, and whether it has a measured impact on page N+1 quality. **[verify-by: run-experiment]**
- **Token-budget overflow handling** — what happens when context+query exceeds `max_tokens` is not visible statically. **[verify-by: run-experiment]**
- **Cached-translation staleness policy** — code reads `cached_tokens` but never an age/TTL; the actual eviction/stale behavior must be observed. **[verify-by: run-experiment]**
- **Co-resident peak VRAM** — SAM3 + FLUX Kontext + manga-OCR + LLM stacked mid-page: individual sizes are guessed, the combined footprint is unknown. **[verify-by: run-experiment]**
- **FLUX serialization under load** — CPU-offload thread-unsafety forces a lock (`model_manager.py:93`); contention behavior under concurrent pages is unobserved. **[verify-by: run-experiment]**
- **OSB FLUX stability across genres** — generalization of the OSB inpaint+render across manga styles is asserted but not proven. **[verify-by: run-experiment]**

### 4. Parts of the code NOT yet read / verified by this survey

- **Skia rasterizer internals** — hinting, subpixel anti-alias mode, `TextBlob` execution: treated as a black box. **[verify-by: read-code]**
- **HarfBuzz feature application** — GSUB/GPOS execution, context-dependent shaping subtleties: not traced. **[verify-by: read-code]**
- **`sd.cpp` subprocess tuning** — cache modes (spectrum/cache-dit/taylorseer/dbcache), `warmup=(steps+3)//4`, serialization lock behavior: not read end-to-end. **[verify-by: read-code]**
- **Nunchaku backend internals** — proprietary residual-diffusion cache, CPU-offload heuristic, CPU↔GPU move timing: opaque by design. **[verify-by: ask-author]**
- **`ModelManager._model_usage_timestamps`** — created but apparently never populated/read; likely dead code or an incomplete feature. **[verify-by: read-code]**
- **`_detector_cleanup_task`** (`manga_translator.py:152,446`) — created but never awaited/joined; semantics unclear. **[verify-by: read-code]**
- **`_batch_contexts` / `_batch_configs`** — pre-allocated but never accessed in surveyed code; possibly dead fields. **[verify-by: read-code]**
- **`models_ttl > 0` path** — param is read, `==0` is checked, but no auto-unload logic exists; stub or incomplete PR? **[verify-by: read-code]**
- **`batch_concurrent` flag** — possibly a dead field left from refactoring. **[verify-by: read-code]**
- **`request_coordinator` gating** — how it serializes concurrent LLM requests across a batch (Semaphore? FutureSession?) is not traced. **[verify-by: read-code]**
- **`unload_model(force_gc=…)` semantics** — whether `False` is reference-count cleanup or an explicit `torch.cuda.empty_cache()` is unread. **[verify-by: read-code]**

### 5. Integration unknowns (how a config knob actually changes output)

- **Few-shot sample selection** — the gradient-descent/`langcodes` fuzzy-match recipe for picking stable few-shot examples is not transparent. **[verify-by: ask-author]**
- **Kontext vs. Klein decision criteria** — both FLUX variants "work," but the choice rule (and its prompt justification) is opaque. **[verify-by: ask-author]**
- **Glossary injection timing** — when Giongo vs. Gitaigo rules and Rosetta JSON get appended, and how that interacts with the per-call prompt, is not fully mapped. **[verify-by: read-code]**
- **30+-field cache-key collisions** — whether the 2px bbox quantize + 64×64 mask-sig ever cause *false* cache hits is a runtime question. **[verify-by: run-experiment]**

---

## Our MIT (MangaDock fork) — Black Boxes

### 1. Opaque ML model behaviors (training data, why a model wins)

- **DBNet (`detect-20241225.ckpt`)** — forked upstream with no local `model_manager.py`; the ResNet34 backbone variant, per-forward time, and VRAM at `detection_size=2048` are uncharacterized. **[verify-by: run-experiment]**
- **48px Roformer/XPos coverage** — `alphabet-all-v7.txt` token count is estimated (~300 chars), supported-language coverage is not enumerated, and batch-16 inference time is unmeasured. **[verify-by: run-experiment]**
- **Qwen3 4-bit quantization** (`qwen3.py`, `build_load_kwargs`) — the exact scheme (GPTQ/AWQ/int4-dynamic) is not deducible from code, bf16-fallback quality loss is unquantified, and the size variants (4B/32B) are not inferred. **[verify-by: read-code]** for scheme; **[verify-by: run-experiment]** for quality.
- **OCR-prob floor `0.2` default** (`model_48px.py:70`) — no comment explains the default; #167 found `0.03` rescues the worst pages, but whether 0.03 is safe across all genres has no ablation. **[verify-by: run-experiment]**
- **lang-ratio script boundaries** (`utils/lang_ratio.py`, #109) — CJK/Thai/Arabic/Cyrillic range checks; false-positive (reject valid mixed-script) and false-negative (accept mangled output) rates are unquantified. **[verify-by: run-experiment]**
- **kitsumed YOLO on non-Japanese manga** — balloon-box accuracy beyond Japanese (Korean/Chinese/Western scans) is untested. **[verify-by: run-experiment]**

### 2. Undocumented heuristics / magic constants with no rationale

- **`scale_factor = max(min((H − h/3)/H, 1), 0.5)`** (`text_mask_utils.py:183`) — why `h/3` (not h/4 or h/2)? why a `0.5` lower bound? **[verify-by: ask-author]**
- **`mask_dilation_offset=20` → `dilate_size=(int((text_size+20)·0.3)//2)·2+1`** — the `0.3` multiplier and the `//2 then ·2+1` odd-rounding are unexplained. **[verify-by: ask-author]**
- **Bilateral filter `(17, 80, 80)`** — kernel 17, sigma 80 on both channels: chosen why, tested on screentone? **[verify-by: ask-author]**
- **CRF params `sxy=23, srgb=7, compat=20, 5 iterations`** — tuned for what content, and is the ~500ms cost worth it vs. the raw-mask fallback? **[verify-by: run-experiment]**
- **`_LINE_HEIGHT=1.2`** (`rendering/__init__.py:55`) — empirical average or real font metrics? **[verify-by: ask-author]**
- **`_FIT_MARGIN=0.92` and `_MAX_FONT_BOX_RATIO=0.5`** (#175 post-hoc constants) — the optimization trace that produced them is lost. **[verify-by: ask-author]**
- **Stroke radius `64 · max(int(0.07·font_size), 1)`** — the ~7% proportion is hardcoded and not configurable; basis unknown. **[verify-by: ask-author]**
- **Patch PNG `compress_level=1` + `30s` timeout** — tuning rationale vs. level 5/9, and the timeout margin relative to measured encode times, are uncalibrated. **[verify-by: run-experiment]**
- **`_PAGE_LANG_CHECK_MIN_REGIONS=6`** (`manga_translator.py:89`) — why 6 is the gate for the page-level lang-ratio check (sparse pages below it skip the check) is unexplained, and #167 noted it may not trigger on sparse pages. **[verify-by: ask-author]**

### 3. Pipeline behaviors that need RUNTIME observation to confirm

- **Translator VLM-fallback dispatch** (`manga_translator.py:~345`) — when the lang-ratio retry fires, *which* translator endpoint is actually called (config default vs. per-series override) is not observable without tracing. **[verify-by: run-experiment]**
- **Repetition-retry termination budget** — no visible constant bounds the retry rounds per region; behavior on a stuck region is undefined until observed. **[verify-by: run-experiment]**
- **LaMa bf16 numerical stability** — `inpainting_lama_mpe.py:102-104` warns bf16 is unsupported, yet the code casts to bf16 anyway (`:106`); stability over long inference chains is unvalidated. **[verify-by: run-experiment]**
- **LaMa-512 on 1536 upscaled crops** — network saturation and artifact type by VRAM tier (2GB vs 8GB), and whether 512 is the choke point, need measurement. **[verify-by: run-experiment]**
- **Determinism-gate absence** — without MangaTranslator's `temp=0` gate, how often the cache thrashes from random-seed/config jitter, and the re-inpaint cost, are unmeasured. **[verify-by: run-experiment]**
- **bubble_detector lazy `_model` unload** — on exception the Python reference is dropped, but CUDA tensors may linger; GC timing is unspecified. **[verify-by: run-experiment]**
- **Patch PNG encode hang conditions** — what actually triggers the 30s timeout (network write? compression race?) and the fallback when `None` is returned. **[verify-by: run-experiment]**
- **Co-resident peak VRAM** — DBNet + 48px + LaMa (+ Qwen3 4-bit if selected) is *estimated* at ~1–2GB (LaMa-dominated, ~4–8GB with Qwen3); not measured mid-flight. **[verify-by: run-experiment]**

### 4. Parts of the code NOT yet read / verified by this survey

- **`calc_horizontal()` wrapping algorithm** (`text_render.py`) — upstream code; whether it is truly greedy or a hybrid DP was not fully traced. **[verify-by: read-code]**
- **Thai tokenizer graceful degradation** — behavior when `pythainlp` is absent (`text_render.py:54`) is asserted but not verified. **[verify-by: read-code]**
- **`balloon_occupancy()` tie-breaking** — behavior on equal occupant counts (`rendering/__init__.py:110-128`) is undefined or unverified. **[verify-by: read-code]**
- **Font-fallback chain glyph-index logic** (`text_render.py:305-313`) — per-character fallback is not fully documented/traced. **[verify-by: read-code]**
- **FreeType Stroker / glyph-bitmap defaults** — exact anti-alias and hinting mode when `face.load_char()` is called is not explicit in the code we read. **[verify-by: read-code]**
- **Alpha-composite rounding mode** — float math then clip to 0–255; exact rounding is unspecified. **[verify-by: read-code]**
- **`cv2.warpPerspective` quality** — `INTER_LINEAR` sub-pixel rounding that may blur is unverified. **[verify-by: run-experiment]**
- **`union_box()` degenerate-input guard** — behavior on self-intersecting/degenerate balloon polygons is unguarded and unread. **[verify-by: read-code]**
- **`series_context.py` glossary lookup** — multi-volume behavior, stale-glossary impact on later pages, and duplicate/contradictory-entry conflict resolution are undefined. **[verify-by: read-code]**

### 5. Integration unknowns (how a config knob actually changes output)

- **Knob → quality mapping** — `MIT_BUBBLE_AREA_FIT`, `MIT_OCR_PROB=0.03–0.05`, `font_size_offset=+4px` reportedly moved One-Punch-Man p1 from ~45%→65%, but the coefficient is purely empirical; there is **no ground-truth formula** for knob→quality. **[verify-by: run-experiment]**
- **Translator sampling knobs are not exposed** — `buildMitConfig()` surfaces detector/inpainter/render knobs but **no translator temp/top_k/top_p**; whether user-supplied sampling params are respected at all is unverified. **[verify-by: read-code]**
- **`series_context` string contract** — the exact format from `composeSeriesContext()` (char budget, which fields, real-manga verification) is unknown; a malformed/over-long string may be silently dropped or crash MIT. **[verify-by: read-code]**
- **L1 cache on model-switch** — set model A → translate → set model B → translate same page: is the cache consulted or bypassed? (`patchCacheKey` includes a model segment, but the end-to-end behavior is untested.) **[verify-by: run-experiment]**
- **Cache-key quantization false hits** — whether our 2px-bbox / 64×64 mask-sig key produces false cache hits *relative to* MangaTranslator's full-config hash is unverified. **[verify-by: run-experiment]**
- **#166 resize → cache-key stability** — when bubble-fit (`union_box`) expands the crop, does the output filename stay deterministic, or does the cache key drift? **[verify-by: run-experiment]**
- **`regions_payload` text-layer schema** (#158) — field names, encoding, and whether the full payload is sent to the Memory repo are not documented. **[verify-by: read-code]**
- **OCR-prob floor — which image types benefit** — whether thin lines, stylized SFX, screentone, or shadows gain most from lowering `prob` is unmeasured. **[verify-by: run-experiment]**

---

## Cross-Codebase & Backend-Orchestration Unknowns

These span both engines or live in the Backend↔MIT seam, where a static read of either side alone cannot settle the question.

### Backend orchestration of MIT

- **Redis pub/sub cross-instance fan-out** — `publish translate:{jobKey}` to latecomers on a different node: code structure is sound but **never tested on 2+ Backend nodes**; the `originalListener` (node A) vs. `listeners` set (node B) race under network partition has no distributed lock protecting `activeCallerCount`. **[verify-by: run-experiment]**
- **L3 disk write on Redis loss** — `l3.appendDirtyFallback(key)` is called, but `L3DiskService` was not examined; whether the write is async or blocks the response is unread. **[verify-by: read-code]**
- **Non-deterministic translation caching** — when temp>0, is the cache entry flagged, or will a later request wrongly receive the cached stochastic result as if deterministic? **[verify-by: read-code]**
- **`seriesContext` validation before send** — length limits, escaping, and silent-drop rules at the Backend→MIT JSON boundary are unverified. **[verify-by: read-code]**
- **`imageModelKey()` sanitization** — what happens if a Gemini model name contains invalid characters or exceeds API length: does the filter catch it, or does MIT silently ignore? **[verify-by: read-code]**
- **`sweepLegacy()` on case-insensitive filesystems** — the `OWNED_NAME` regex `__p\d+__r\d+\.png$` assumes case-sensitivity; `__p0__r0.png` vs `__P0__R0.PNG` could collide on Windows; never tested. **[verify-by: run-experiment]**
- **Storage I/O sweep edge case** — if `put()` succeeds but `list()` times out during sweep, stale files remain permanently; untested. **[verify-by: run-experiment]**
- **`seriesContextFor()` scaling** — `mangaDex.getMangaDetail()` is awaited inline per batch with no per-chapter cache; 100 concurrent users on one chapter = 100 API calls. **[verify-by: read-code]**
- **3-tier TTL race** — L1 expiry vs. Redis expiry vs. L3 write-behind: if L1 expires but L2 still holds the value, does `get()` return L2, and can L3 ever see stale data? **[verify-by: run-experiment]**
- **Gemini catalog refresh on API failure** — on a flaky 403, does it fall back to the old catalog or to hardcoded defaults, and is the pre-normalization model name preserved for audit? **[verify-by: read-code]**
- **`derivative` (hd vs saver) cache sharing** — are hd and saver separate cache entries, or does saver reuse hd's patches? **[verify-by: read-code]**
- **`mitLangCode()` coverage** — exhaustiveness over MangaDex codes; what an unmapped pair (`xx`/`unk`) resolves to is unverified. **[verify-by: read-code]**

### Cross-engine comparison gaps

- **The 45–50% quality verdict itself** (`DONE.md #175`) — "MIT ≈ 40–50% of MangaTranslator on a One-Punch-Man page" is a single-page eyeball judgment, not a measured benchmark across a representative corpus; the headline gap is itself a black box. **[verify-by: run-experiment]**
- **Color-cast root cause** — LaMa patches sometimes show a cast despite `patch_png.py` ICC carry-through; the hypothesis (GRAY profile honored only on mode-L, silently ignored on RGB) is unconfirmed and needs a color-management audit. **[verify-by: run-experiment]**
- **Series-context staleness under parallel OCR** — MangaTranslator's event-gated chaining vs. our once-per-batch `seriesContextFor()`: whether late pages in a parallel batch actually receive stale context is a runtime question (#159 unfunded). **[verify-by: run-experiment]**
- **Whether the "missing" upstream features are even wired** — emphasis markdown (#171), OCR ladder (#172), seam feathering (#173), solid-bg flat-fill (#174) are described as queued/partial; their real on/off state in the deployed config is not confirmed by the static read. **[verify-by: read-code]**

---

## Honest Limits of This Static Read

Three caveats bound everything above:

1. **No magic constant's *rationale* survives a static read.** We can see `0.35`, `0.70`, `0.92`, `badness_exponent=3.0`, `bilateral(17,80,80)` — we cannot see the ablation (if any) that chose them. Almost every `[verify-by: ask-author]` tag is an admission that the *why* was never written down, in either codebase.
2. **Every "X is better" claim about model quality is unmeasured.** FLUX-vs-LaMa, manga-ocr-vs-48px, the headline 45–50% verdict — all rest on visual impressions of a handful of pages, not a scored benchmark. The comparison is directionally credible but numerically unproven. **[verify-by: run-experiment]** for all of it.
3. **The Backend↔MIT seam hides MIT's runtime behavior from the Backend's view.** The Backend sends a config JSON and receives finished PNGs; it cannot observe which model fired, how many retries ran, or why a patch came back the size it did. A large class of integration unknowns (knob→output, stale context, retry budgets) is structurally invisible from either side alone and only a traced end-to-end run will close them.