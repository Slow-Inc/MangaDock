<!-- lang:th -->
# MangaTranslator — เจาะลึกระดับ algorithm (ไม่มี black box)

> สำรวจ 2026-06-08 จาก clone ที่ `/MangaTranslator` (gitignored, Apache-2.0). อ่านโค้ดจริงทุกบรรทัด 6 ระบบขนานกัน
> เอกสารนี้คือ **companion เชิงลึก** ของ [`mangatranslator-study.md`](mangatranslator-study.md) (ตัวนั้นเป็น executive summary) — ตัวนี้เก็บ algorithm/constant/formula ระดับ reimplement ได้
> รายละเอียด file:line ครบในส่วนภาษาอังกฤษด้านล่าง

## ภาพรวม pipeline เขา (เทียบของเรา)

```
เขา (bubble-first, full-image):
  detect YOLO×2 + SAM → คัด conjoined → clean (fill/FLUX) → OSB pipeline แยก
  → sort reading-order → LLM (multimodal, batch ทั้งหน้า) → render Skia → save รูปเต็ม

เรา (textline-first, patch):
  DBNet detect → 48px OCR → GPT translate → LaMa inpaint รายกรอบ → render → ส่ง PNG patch รายภูมิภาค
```

**ความต่างเชิงปรัชญา**: เขามองหา "บับเบิล" เป็นรูปทรง (mask จาก SAM) เรามองหา "บรรทัดข้อความ" — ทุกความเหนือกว่าของเขาสืบจากจุดนี้

## เทคนิคเด่นที่เราไม่มี (เรียงตามคุณค่า)

1. **ขนาดฟอนต์ = binary search ในพื้นที่ปลอดภัยของ mask** — ไม่ใช่หดให้พอดีกล่อง: หาขนาดใหญ่สุดที่ไม่ชน mask ด้วย distance-transform safe-area + centroid (มี **pole-of-inaccessibility fallback** เมื่อ centroid ตกในคอคอด bubble เชื่อม), bound สองชั้น dialogue 8–16 / OSB 10–64, retry squeeze ×0.90 สามครั้ง
2. **OSB pipeline แยกสำหรับ SFX** — AnimeText YOLO → KMeans probe สีพื้น/ตัวอักษร → FLUX inpaint (prompt "Remove all text.") → render ตัวพิมพ์ใหญ่ขอบ 3px → ที่มา LOOM
3. **LAB luminance-match หลัง inpaint** — แก้ FLUX ทำพื้นหลังเพี้ยนสี: จับสถิติ L channel ของ context แล้ว remap `L' = (L-gen_mean)*scale + orig_mean` + neutralize chroma a/b (กันสีเพี้ยนบนมังงะขาวดำ)
4. **บริบทหน้าก่อนหน้า** — แนบภาพ+transcript N หน้า (cap 10 ภาพ/50 text) ใน section "PREVIOUS PAGE TRANSCRIPTS" + กฎ "reference only ห้ามนับ/ห้ามแปล" + parallel batch รอ OCR หน้าก่อนผ่าน event (= #159 เรา)
5. **Conjoined bubble splitting** — บับเบิลติดกันถูกแยก mask ด้วยเส้นทแยง/แกน + ป้องกันไม่ให้ตัดทับ text box (tiered: strict→own-side corners)
6. **Knuth-Plass DP line break** — `badness = slack^3 + 1000·hyphen` ต่อภาษา (kinsoku CJK, พยางค์เกาหลี, hyphenate ละติน midpoint-out)
7. **Supersampling 4× ตอน render** — crop→upscale LANCZOS→render→downscale→paste = ตัวอักษรคมขึ้น
8. **ขอบตัวอักษรเลือกสีตาม luminance** — `lum = 0.299r+0.587g+0.114b; ขอบดำถ้า lum≥80 ไม่งั้นขาว`
9. **Cache 6 ชั้น keyed by content hash** + determinism gate (cache เฉพาะ temp=0/top_k=1/top_p=0) + เก็บ OCR text ด้วยเพื่อ feed บริบทหน้าถัดไป
10. **Glossary contract** — `## SPECIAL INSTRUCTIONS` + Rosetta auto-detect → JSON + `- X -> Y` (= #160/#161 เรา)

## สิ่งที่เราทำได้ดีกว่า/เท่ากัน

- **Patch output** — ส่ง PNG รายกรอบ + สลับ HD/ต้นฉบับได้ทันที (เขา flatten รูปเดียว)
- **Post-translation check ของเราเปิด default** (#167 doc) — repetition + lang-ratio + retry; เขาก็มีแต่เป็น parse-time repair (`[Missing item N]`, enforce `[OCR FAILED]`)
- **temperature 0.1 + numbered contract + repair** — เขาทำเป็นมาตรฐาน เราใช้ default ของ translator → **quick win: ตั้ง temp/contract เองได้ผ่าน gpt_config** (ดู mit-hidden-capabilities.md)
- LaMa เร็ว/VRAM ต่ำ/ดีกับ screentone — FLUX ของเขาสวยกว่าบนพื้นซับซ้อนแต่กิน VRAM หนักและช้ากว่ามาก

## map เข้า issues

| เทคนิค | Issue |
|---|---|
| binary-search sizing + safe-area + bound สองชั้น + supersampling + luminance outline | **#166 (P2 PRD #169)** |
| AnimeText YOLO + inject-before-merge | **#168 (P1 PRD #169)** |
| previous-pages context + format + wait-for-OCR | **#159 (PRD #155)** |
| glossary contract `- X -> Y` | **#160/#161 (PRD #155)** |
| LAB luminance-match, conjoined split, OSB render, page-number filter | idea backlog (ยังไม่เปิด issue) |

---

<!-- lang:en -->
# MangaTranslator Internals — Algorithm-Level Deep Read (no black boxes)

> Read 2026-06-08 from the `/MangaTranslator` clone (gitignored, Apache-2.0 → adoptable into our GPL fork). Six parallel agents read the real code line by line. This is the **deep companion** to `mangatranslator-study.md`; constants/formulas here are reimplementation-grade. Line numbers are the clone's at read time.

## 1. Detection (`core/image/detection.py`, `ocr_detection.py`, `sorting.py`)

**Dual-YOLO + SAM.** Primary speech-bubble YOLO at imgsz 1600 (or 640) → `boxes.xyxy` tensor (N,4); secondary conjoined YOLO at imgsz 1024 emits `text_bubble`/`text_free` classes. SAM refines each YOLO box into an instance mask via `_process_simple_bubbles` (detection.py:483-519): boxes batched (1,K,4), `pred_masks` (K,1,H,W), binarized at `SAM_MASK_THRESHOLD = 0.5` (line 17), clipped to bbox. A **detection record** is `{bbox:(x0,y0,x1,y1), confidence, class, sam_mask:HxW uint8, conjoined_neighbor_bboxes?, panel_id?}`.

**Conjoined logic.** IoA is asymmetric: `_calculate_ioa(inner,outer)=intersection/area(inner)` (detection.py:212-217). A primary is a conjoined parent if ≥2 secondaries pass `IoA > IOA_THRESHOLD=0.50` (line 16). **Synthetic conjoined** (primary YOLO itself split a bubble): union-find over primaries that overlap at `SYNTHETIC_CONJOINED_IOA_THRESHOLD=0.15` either direction (line 29). Dedup: IoU-NMS at `IOU_DUPLICATE_THRESHOLD=0.7` keep-higher-confidence, plus contained-box removal at IoA>0.9. **Mask splitting** (`_split_conjoined_mask`, 995-1059): detect arrangement (horizontal if `|dx|>3.0·|dy|`, `AXIS_DOMINANCE_RATIO=3.0`), pick split line order [perpendicular, diagonal, parallel], split overlap zone with signed-distance-to-line; **text-safe** in two tiers — Tier1 all inset corners (`TEXT_NUDGE_BOX_INSET_RATIO=0.08`), Tier2 own-side corners + validation; each child must keep `MIN_OVERLAP_SPLIT_SHARE=0.08` of overlap pixels.

**OSB wiring** (ocr_detection.py): AnimeText YOLO `animetext_yolov12x.pt` at imgsz 640 (line 361-368); fallback to secondary's `text_free` boxes. Each OSB box matched to best-overlapping bubble; kept as outside-text unless `text_box_meaningfully_matches_bubble` — IoA(text in bubble) ≥ `OSB_BUBBLE_MATCH_IOA_THRESHOLD=0.2` (line 16) OR text-center inside bubble. Ambiguous if 2nd-best ≥ `AMBIGUOUS_TEXT_MATCH_RATIO=0.85`. OSB text also **expands** its bubble to contain it (min/max corner merge).

**Reading order** (sorting.py): panels topo-sorted with a dual veto — graph "is above" edge if `parent.y1 ≤ node.y0+50` AND column overlap `_iou_x>0.2`; traversal prefers same-column-below (y-banded at 50px) then same-row-neighbor (`cand.x1 ≤ cur.x0+50` RTL), vetoing a candidate if an unvisited panel sits above it or blocks on the right with y-overlap>0.3. Bubbles within a panel: band by `y_overlap≥0.25 OR center_Δy≤0.5·min(h)`, then column by `x_overlap≥0.2 OR center_Δx≤0.5·min(w)`, RTL/LTR sort. Unassigned bubbles bind to nearest panel within 300px.

## 2. Cleaning + inpainting (`cleaning.py`, `inpainting.py`, `image_utils.py`)

**Text-only mask** (process_single_bubble, 214-505): `is_black_bubble = mean(masked_pixels) < GRAYSCALE_MIDPOINT=128`; dilate base mask with `(7,7)` ellipse (scaled); **invert grayscale ROI when black bubble** before threshold; threshold = fixed 200 or Otsu; AND with ROI; distance-transform shrink keep `dist ≥ roi_shrink_px=5` (L2); contour-filter `MIN_CONTOUR_AREA=50`, centroid-in-eroded-base validation; keep largest component. **Conjoined adaptive shrink** (`_build_adaptive_shrink_mask`, 159-211): uniform 5px shrink everywhere, but in junction zones (bbox-intersection ± `JUNCTION_ADJACENCY_MARGIN=10`) relax to `JUNCTION_MIN_SHRINK=1.0` so narrow passages survive.

**Colored-bubble classification** (389-460): sample non-text interior pixels → histogram → `bright_ratio`(≥245), `dark_ratio`(≤15), `dominant_ratio`. WHITE if `bright_ratio≥0.65` OR (mode≥245 & dom≥0.40 & dark≤0.10); BLACK symmetric; else COLORED → FLUX. Non-colored = flat fill, never FLUX.

**FLUX** (inpainting.py): **Kontext** prompt `"Remove all text."`, guidance 2.5, 8 steps, 17 preferred AR resolutions (672×1568…1568×672, multiples of 16, line 138-157), padding `min(0.5·max(w,h), 80)`. **Klein** prompt is a long detail-preserving paragraph (991-996), guidance 1.0, 4 steps, padding ×2.0. Mask→tensor is **inverted** (1.0 keep / 0.0 inpaint). **Distance-transform alpha ramp** at edges: `alpha=clip(1 - d_out/blur_radius,0,1)`, blur=`clip(0.1·max(w,h),1,10)`. **LAB luminance-match** (Klein, 1187-1256): on context pixels compute L mean/std orig vs gen; skip if `|Δmean|<1.3 & |Δstd|<2.0`; else `scale=clip(orig_std/gen_std,0.5,2.0)`, remap inpainted L `=(L-gen_mean)·scale+orig_mean`, then per-channel a/b shift if `|shift|>1.0` → kills FLUX colour cast on B&W manga.

**Parallel inpaint waves** (batch_coordinator.py:121-153): greedily group items whose bboxes don't overlap (`bboxes_overlap` = standard AABB test) into waves; waves run sequentially, items within a wave in parallel under a `BoundedSemaphore(max_requests)`.

**Safe-area box** (image_utils.py `calculate_centroid_expansion_box`, 173-348): pad mask 1px → `distanceTransform L2 PRECISE` → safe zone = `dist ≥ padding_pixels(5)` → centroid via moments → **pole-of-inaccessibility fallback**: if `dist_at_centroid < 0.70·max_dist`, use the max-distance pixel (avoids conjoined necks) → ray-cast to nearest unsafe pixel in 4 dirs → symmetric box = `2·(min_dist−1)` per axis, centered on centroid. Fallback when it fails: bbox minus `FALLBACK_PADDING_RATIO=0.08` per side.

## 3. Text layout + rendering (`layout_engine.py`, `drawing_engine.py`, `text_renderer.py`, `text_processing.py`, `font_manager.py`)

**find_optimal_layout** (656-835): binary search `low=min(8) high=max(16)`; at each `mid`, `check_fit` then collision-check text corners vs mask; if collision, squeeze `width *= 0.90` up to 3× (only when mask present); success → `low=mid+1`, else `high=mid-1`; returns largest `best_fit_size`. No-mask path accepts first fit.

**Line break DP** (text_processing.py find_optimal_breaks_dp, 489-578): cost recurrence `min_cost[i]=min_j(min_cost[j]+badness)`, `badness=slack^badness_exponent(3.0)` with `slack=max_width−line_width`, `+hyphen_penalty(1000)` if line ends `-`; prune when line>max_width; backtrack via `path[]`. CJK per-char with kinsoku (`。，！？` not at start, `（【「` not at end); Hangul word-level avoiding forbidden line-start syllables; Latin midpoint-out hyphenation (try existing hyphens first, then candidate indices 2..len-2 expanding from center).

**Vertical** (_build_vertical_layout, 166-318): `step_height=max(unit_h, advance_h·line_spacing·VERTICAL_ADVANCE_TRACKING(0.90))`; last unit uses advance_h not step.

**Drawing** (drawing_engine.py): **supersampling** = crop bbox → LANCZOS upscale ×`supersampling_factor(4)` → scale all layout metrics ×factor → render → LANCZOS downscale → paste (text_renderer.py 367-517). HarfBuzz shape (26.6 fixed-point, `scale=int(font_size·64)`), Skia `setSubpixel`/`setHinting`. **Outline stroker** (188-202): `lum=0.299r+0.587g+0.114b; outline=BLACK if lum≥80 else WHITE`, `kStroke_Style kRound_Join`, drawn before fill. Per-line centering `line_start_x=block_start_x+(max_line_width−line_w)/2`. **Text color** by bubble brightness: WHITE if `mean(bgr)<128` else BLACK.

**Font manager** (231-442): 6-pass variant pick (bold-italic → single → explicit-regular → infer-regular → first-unassigned → any). Styled segments parsed by `(\*{1,3})(.*?)(\1)` → italic/bold/bold_italic.

## 4. LLM translation (`services/translation.py`, `llm_defaults.py`, `validation.py`, `caching.py`)

**One-step** (default): bubble crops (SAM-masked, neighbors whited out, upscaled to `bubble_min_side_pixels=128`, base64) + optional full-page + optional previous-page images → prompt asks `i: <transcribe> || <translate>`; parser splits on first `||`, missing `||` → OCR marked `[OCR FAILED]`. **Two-step**: local manga-ocr / PaddleOCR-VL / LLM-OCR first, then text-only translate; **Rosetta auto-detected** → JSON `{"1":...}` in/out + `Glossary:` lines.

**Numbered contract parser** (834-890): regex `^\s*(\d+)\s*[:.]\s*"?\s*(.*?)\s*"?\s*(?=\s*\n\s*\d+\s*[:.]|\s*$)`; missing items filled `[{provider}: Missing item N]`; `[OCR FAILED]` round-trips; per-page count padded/truncated to exactly N.

**Providers** (10) via `_call_llm_endpoint`; `llm_defaults.py` table all `temperature=0.1`, top_p 0.95/1.0, top_k 0/64/40; reasoning models get 16384 tokens else 4096; per-provider param-name differences (Google `topP/topK/thinkingConfig`, Anthropic temp≤1.0 + `thinking`, etc.).

**Previous context**: images dropped unless `send_full_page_context AND ocr_method=="LLM"`; texts cleaned (drop empty/`[OCR FAILED]`), clamped last N (caps: images 0-10, texts 0-50, validation.py:19-22), formatted in `## PREVIOUS PAGE TRANSCRIPTS` "reference only" section; system-prompt rule enforces "do not transcribe/translate/number/count". Parallel batch waits on prior pages' OCR-ready events.

**Glossary**: `## SPECIAL INSTRUCTIONS` block appended to OCR + translate prompts; Rosetta maps each line to `- X -> Y` under `Glossary:`.

**Cache** (caching.py): `_is_deterministic = temp==0 OR top_k==1 OR top_p==0` else no cache; key = SHA256(images_hash + full_image_hash + config_hash + prev-context hashes); entry stores `{translations, ocr_texts}` so cached pages still feed forward context. Single-entry translation LRU; OCR caches 20-entry.

## 5. Pipeline orchestration (`pipeline.py`, `outside_text_processor.py`, `scaling.py`, `model_manager.py`, `sdcpp_server.py`)

**Stage order** (translate_and_render, 568-1793): convert mode → pre-upscale → **[upscaling_only exit]** → `processing_scale=sqrt(w·h/1e6)` → bubble detect (YOLO+SAM) → panel detect → **OSB pipeline** → full-page context encode → bubble clean → **[cleaning_only exit]** → font scaling → reading-order sort → **[test_mode exit]** → LLM batch → render loop (Otsu-retry → padded-bbox → restore fallbacks) → final upscale → save. **VRAM lifecycle**: upscalers load→use→`clear_cache()` immediately (lines 817,1014,1442); YOLO/SAM held per page; FLUX via persistent sd.cpp subprocess.

**OSB** (outside_text_processor.py 31-1516): detect → min-area filter → page-number filter (regex `^\s*(?:page\.?|p\.?)?\s*\d+\s*$` on MangaOCR of margin crops) → bbox expand (aspect<0.4 narrow / area<0.005 tiny multipliers, panel buffer 5px, collision-avoid) → KMeans(2) color probe → `is_dark_text = bg_lum<128` → FLUX wave inpaint → record `{bbox, original_bbox, image_b64, is_dark_text, text_color_rgb, needs_text_background, original_crop_pil, ...}`. Solid-color regions (border white/black ratio≥0.95) skip FLUX → flat fill.

**Scaling** (scaling.py): `scale_length=int(round(v·s))` clamp[1]; `scale_area=v·s²`; `scale_font_size` clamp[4,256]; `scale_kernel` odd[1,63]. processing_scale feeds fonts/padding/kernels.

**Model manager**: singleton RLock, ~22 ModelType registry, lazy load + per-type unload + `empty_cache`; sd.cpp driven as subprocess (release `master-669-2d40a8b`), cache modes spectrum/cache-dit/taylorseer/dbcache with `warmup=(steps+3)//4`, FLUX serialized by a lock (CPU offload not thread-safe).

**Parallel batch**: warm-up first image serial (loads models), rest in asyncio `Semaphore(n)` + ThreadPoolExecutor; per-page `ocr_text_ready_events` enforce context dependency; per-image try/except isolation.

## 6. Config + entry (`config.py`, `main.py`, `app.py`, `device.py`, `ocr_detection.py`)

Eight config dataclasses, ~120 fields total (full table available in the agent dumps; highlights): **DetectionConfig** confidence 0.6 / conjoined 0.35 / panel 0.25, seg_model yolo|sam2|sam3, bubble_detector yolo_1|yolo_2. **CleaningConfig** thresholding 200, otsu, roi_shrink 5, inpaint_colored. **TranslationConfig** ~50 fields incl. provider(10), ocr_method LLM|manga-ocr|paddleocr-vl (latter two force two-step), upscale_method, previous_context_image/text_count, media_resolution tiers, special_instructions. **RenderingConfig** min/max font 8/16, supersampling 4, hyphen_penalty 1000, badness_exponent 3, outline_width 0, padding 5. **OutsideTextConfig** ~40 fields incl. inpainting_method, flux_backend sdnq|sdcpp|nunchaku, flux_sdcpp_diffusion_quant, osb font 10-64, osb_outline 3. **OutputConfig** png/jpeg, upscale_final. **PreprocessingConfig** auto_scale. Modes cleaning_only / upscaling_only / test_mode mutually exclusive. Device order CUDA(incl ROCm)→XPU→MPS→CPU; dtype bf16→fp16→fp32. Gradio app exposes the same schema via a Config tab. Default models are near-future-dated (gemini-3.1-flash-lite, gpt-5.4-nano, claude-sonnet-4-6, grok-4.3) — the clone targets unreleased model ids.

## 7. Differences vs our fork — the decisive ones

| Dimension | Them | Us |
|---|---|---|
| Detection unit | bubble shapes (YOLO+SAM instance masks) | text lines (DBNet) |
| Font sizing | **searched** to fill the mask safe-area, two-tier bounds | fit-shrink into source textline box |
| SFX / display text | dedicated OSB pipeline (detect→FLUX→big render) | none — left untranslated (#168) |
| Inpaint | FLUX (quality, heavy VRAM) + LAB luminance match | LaMa (fast, light, good on screentone) |
| OCR | LLM-vision or manga-ocr/PaddleOCR-VL | 48px CNN |
| Translation contract | numbered `i:OCR||TL`, temp 0.1, repair, glossary, prev-page context | per-translator default; series_context (#157) shipped |
| Output | flattened image (+PSD/PDF layers option) | per-region PNG patches (HD/saver toggle) |
| Rendering polish | supersampling 4×, luminance outline, Knuth-Plass DP | basic |
| Post-translate guard | parse-time repair | repetition+lang-ratio+retry ON by default |
| Deployment shape | single-user app (Gradio/CLI) | multi-user inference service (webhooks, cache, cancel) |

**Net:** their advantage is entirely in per-page visual fidelity (sizing, SFX, inpaint quality, typography). Ours is in service architecture (patches, multi-user, caching, cancellation) and the context-aware roadmap (#155). The adoptable wins are all visual-fidelity techniques that drop into our existing stages — none require their bubble-first rewrite.
