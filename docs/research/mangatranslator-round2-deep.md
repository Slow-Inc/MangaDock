<!-- lang:th -->
# MangaTranslator — รอบ 2: เทคนิคซ่อนที่เพิ่งเจอ (นอกเหนือจาก internals doc)

> สำรวจรอบ 2 เมื่อ 2026-06-08 ด้วย 5 agent อ่านขนานทั้ง 33K LOC (`/MangaTranslator`, Apache-2.0)
> companion ของ [[mangatranslator-internals]] — ตัวนี้เก็บเฉพาะ**สิ่งที่ยังไม่ได้บันทึก** (รอบแรกได้ top-10 ไปแล้ว: binary-search sizing, OSB AnimeText, LAB, prev-page, conjoined split, Knuth-Plass, supersampling, luminance outline, 6-layer cache, glossary contract)
> file:line เป็นของ clone ณ เวลาอ่าน

## 🎯 สิ่งที่ "เอามาใช้ได้เลย คุ้มสุด" (จัดอันดับ)

| # | เทคนิค | ทำไมคุ้ม | issue/where |
|---|---|---|---|
| 1 | **ค่าคงที่ binary-search ครบ** (low=8 high=16 dialogue / 10–64 OSB, fit-test, collision 4-มุม, squeeze ×0.90×3) | เติม #166 ให้ทำ "ของจริง" ได้เลย ไม่ต้องเดา | #166 |
| 2 | **mask edge feathering** (distance-transform gradient alpha แทน hard mask) | seam patch หาย — แก้ "ขอบ patch เห็นชัด" โดยไม่ต้องเปลี่ยน inpainter | #156/render |
| 3 | **emphasis markdown contract** `*i* **b** ***bi***` + Giongo/Gitaigo + no-period | คือ #171 P2 (emphasis) ครบสูตร — prompt-only ไม่ต้องโมเดล | #171 P2 |
| 4 | **solid-bg → flat-fill** (white/black ratio ≥0.95 ข้าม inpaint) | เร็วขึ้น + ไม่เพี้ยนบนพื้นขาวล้วน (caption box เราเลย!) | render/inpaint |
| 5 | **bubble_min_side_pixels=128 upscale ก่อน OCR** | OCR แม่นขึ้นบน text เล็ก — แก้ "ตัวอักษรเพี้ยน" ที่ต้นเหตุ | #172 |
| 6 | **determinism gate + cache-key 30 fields + 2px quantize + 64×64 mask-sig** | cache เสถียร ไม่ pollute จาก config สุ่ม | cache |
| 7 | **temp 0.1 + numbered parser + [Missing item N] repair + ellipsis …→...** | quick win คุณภาพแปล (เราใช้ default translator อยู่) | translator |

## 1) Detection — ค่าคงที่/heuristic ที่ไม่เคยบันทึก

- **เกณฑ์ overlap หลายตัว** (`detection.py:15-34`): `IOU_DUPLICATE=0.7` (NMS), `IOA_THRESHOLD=0.5` (containment), `SYNTHETIC_CONJOINED_IOA=0.15` (กาว primary ที่ทับกัน), `OSB_TEXT_MATCH_IOA=0.2`, `AXIS_DOMINANCE_RATIO=3.0`, nested removal IoA `0.9`
- **confidence-sorted NMS** (ไม่ใช่ NMS มาตรฐาน) — เรียงตาม conf แล้วทิ้งตัว IoU>0.7
- **synthetic conjoined** via union-find บน primary ที่ทับกัน (กู้บับเบิลติดที่ primary แตกเป็นชิ้น)
- **conf ต่างกันต่อโมเดล**: primary 0.6 (yolo_2 → imgsz **1600**, yolo_1 → 640), secondary/conjoined **0.35** @1024, OSB 0.6 @640, **panel 0.25** @640 (class `frame`)
- **reading-order dual-veto** (`sorting.py`): panel root = ไม่มี panel เหนือใน column เดียว (tol 50px, x-overlap>0.2); bubble sort: `y_overlap≥0.25` หรือ center band `0.5×h` = แถวเดียว; `x_overlap≥0.2` = column; snap bubble เข้า panel ถ้า <300px
- **text proximity grouping 2%** ของ min(w,h) = จับ caption cluster อัตโนมัติ; group >1568px แตกเป็นชิ้น
- **safe-area pole-of-inaccessibility** (`image_utils.py:173-348`): distance-transform + 1px padding (ขอบภาพ=กำแพง), centroid; ถ้า centroid อยู่คอคอด (dist<70% ของ max) → ย้าย anchor ไปจุด dist สูงสุด; ray-cast 4 ทิศหา radius → safe box สมมาตร

## 2) Text rendering — สูตร "ของจริง" สำหรับ #166

- **binary search** (`layout_engine.py:726-809`): `low=min(8) high=max(16 dialogue / 64 OSB)`, `mid=(low+high)//2`, fit→`low=mid+1` else `high=mid-1`
- **fit-test** (`:585`): `max_line_width ≤ max_render_width` **AND** `block_height ≤ max_render_height`
- **collision** (`:607-653`): สุ่ม **4 มุม** ของ text block — ทุกมุมต้อง `cleaned_mask[py,px]≠0` (อยู่ในบับเบิล) ถึงผ่าน
- **squeeze บน collision** (`:737-795`): `max_squeezes = 3 if mask else 1`; ชน → `width ×= 0.90` วนใหม่
- **line height** = `(-fAscent + fDescent + fLeading) × line_spacing` (Skia metrics จริง ไม่เดา 1.2×); fallback `font_size×1.2`
- **auto-vertical** (`text_renderer.py:27-31`): aspect≥**1.6** ∧ ≤**12** chars ∧ ≤**1** word ∧ horizontal fill ≤0.45 ∧ vertical gain ≥0.20; spacing `VERTICAL_ADVANCE_TRACKING=0.90`
- **fallback padding 8%** เมื่อ safe-area ล้มเหลว
- HarfBuzz 26.6 fixed-point, เปิด feature `kern/liga/calt` ตามที่ฟอนต์มีจริง (อ่านจาก GSUB/GPOS)
- **Hangul `` NO_SPACE marker** กัน space แทรกตอน wrap พยางค์เกาหลี

## 3) Translation/LLM — เยอะสุด เอามาใช้ได้หลายอย่าง

- **temp 0.1 ทุก provider** (`llm_defaults.py`)
- **emphasis contract** (`translation.py:194-216`): `*italic*`=คิด/flashback/เสียงไกล, `**bold**`=SFX/ตะโกน/timestamp, `***bi***`=ดังมาก+mediated; **Giongo**(เสียง)แปลเป็น onomatopoeia, **Gitaigo**(บรรยากาศ)แปลเป็น verb/adj **ห้ามใส่ period**
- **ellipsis normalize** `…`→`...` (token เดียว→สาม token), ใส่ใน prompt
- **SAM whiteout เพื่อนบ้าน** (`:1835-1859`): crop บับเบิลแล้วเอา mask เพื่อนบ้าน − mask ตัวเอง → ทาขาว = OCR ไม่หลอน text ข้างเคียง
- **SAM tight bbox** (`:1816-1831`): crop = union(YOLO bbox, SAM mask bbox)
- **upscale ก่อนส่ง LLM** ถ้า min side < **128px** (`bubble_min_side_pixels`) — method: model/model_lite/lanczos
- **dialogue vs OSB hints** ใน prompt: "Items [..] = dialogue, [..] = SFX/narration"
- **RTL no-reorder**: "crops are in {rtl/ltr} reading order. Do not reorder"
- **numbered parser** (`:856-883`): regex MULTILINE|DOTALL รับ `1:` `1.` `1 ` มี quote ก็ได้; ขาด item → `[Missing item N]`; `[OCR FAILED]` exact-match (case-sensitive)
- **dual media_resolution**: bubbles=high, context=low (ประหยัด token)
- **three-tier prev-page context**: images+text / images-only / text-only — "reference only ห้ามแปล/นับ"
- provider quirks: Anthropic 4.7 ตัด temp/top_k, OpenAI ใช้ `/v1/responses` (ไม่ใช่ chat), Gemini safety BLOCK_NONE + v1alpha สำหรับ gemini-3, reasoning budget %  (high 80% / med 50% / low 20%)

## 4) Inpaint/cleaning — แม้เราใช้ LaMa ก็ยืมได้

- **edge feathering** (`inpainting.py:361-367`): `ramp = clip(1 - d_out/blur_radius, 0, 1)` (distance_transform_edt) → alpha ไล่ระดับที่ขอบ = **ไม่มี seam** (ใช้กับ LaMa patch เราได้เลย แก้ขอบ patch เห็นชัด)
- **solid-bg → flat-fill** (`outside_text_processor.py:1012-1055`): `white_thresh=250 black_thresh=5 ratio=0.95` → border ขาว/ดำล้วน ≥95% ข้าม Flux ใช้ cv2 fill (caption box ขาวล้วนของเราเข้าเงื่อนไขนี้พอดี)
- **colored-bubble 4-part** (`cleaning.py:389-460`): bright/dark ratio 0.65, dom 0.40, opposite ≤0.10 → White/Black/Colored
- **LAB luminance + chroma drift** (`inpainting.py:1187-1256`): `L'=(L-gen_mean)×scale+orig_mean` (scale=orig_std/gen_std clamp 0.5–2.0); skip ถ้า drift เล็ก; neutralize a/b ถ้า drift>1.0 (กันสีเพี้ยนบนขาวดำ)
- **junction-aware shrink** (`cleaning.py:159-211`): zone 10px รอบรอยต่อบับเบิลติด → shrink แค่ `1.0` แทนเต็ม กันตัดเส้นบางขาด
- **text mask**: dilate ellipse **(7,7)** + threshold 200/Otsu + distance-transform shrink `roi_shrink_px=5`
- **OSB color via KMeans** (k=2) + luminance 128 → render สีกลับ; **wave scheduling** จัด region ไม่ทับเป็น batch parallel

## 5) Pipeline/cache/models

- **determinism gate** (`caching.py:207`): cache แปลเฉพาะเมื่อ `temp=0 ∨ top_k=1 ∨ top_p=0`
- **cache key แปล = 30+ fields** (provider/model/lang/direction/mode/temp/top_k/top_p/ocr_method/instructions/max_tokens/reasoning/media_resolution×3/upscale/min_side/...) + hash prev-context (image data + text ด้วย sep `␞`/`␟`)
- **inpaint cache เสถียร**: bbox quantize เป็น grid **2px**, mask signature downsample **64×64** bilinear+threshold 0.5, seed=-1 → ไม่ cache
- **context padding**: `0.5×max(w,h)` cap **80px** → snap เข้า 17 preferred Flux resolutions
- **event-based OCR chaining** (parallel batch): หน้าแรกรัน sequential warm-up, ที่เหลือ parallel + `ocr_text_ready_events[i]` รอ OCR หน้าก่อนก่อนเรียก LLM (timeout 0.2s/รอบ) = #159 ของเราเป๊ะ
- **triple-retry render**: main → Otsu re-segment → padded-bbox; ถ้า translation==source → คืน crop เดิม (ไม่ render ทับ)
- **model repo ids ครบ** (`model_manager.py:169-245`): speech-bubble `kitsumed/yolov8m_seg-speech-bubble`, conjoined `ogkalu/comic-speech-bubble-detector-yolov8m`, OSB `deepghs/AnimeText_yolo` (`yolo12x_animetext/model.pt`), panel `deepghs/manga109_yolo`, upscale `Kim2091/2x-AnimeSharpV4`, manga-ocr `kha-white/manga-ocr-base@refs/pr/4`, PaddleOCR-VL `PaddlePaddle/PaddleOCR-VL-1.5`

## map เข้า roadmap เรา (อัปเดต)

| เทคนิคใหม่ | issue | หมายเหตุ |
|---|---|---|
| binary-search constants + collision + squeeze + safe-area pole | **#166** ← ทำใหม่ให้แรง | สูตรครบแล้ว |
| AnimeText YOLO + conf/imgsz + IoA-merge constants | **#168** | ต้องอนุมัติโมเดล |
| emphasis contract + Giongo/Gitaigo | **#171 P2** | prompt-only |
| bubble_min_side 128 upscale + numbered parser + [Missing item] | **#172** | OCR rescue |
| event-based OCR chaining | **#159** | ตรงกับ design #140 |
| **edge feathering** (patch seam) | **#173** (PRD #169 P4) ← เปิดแล้ว | ใช้กับ LaMa ได้ เห็นผลกับ #156 |
| **solid-bg flat-fill** | **#174** (PRD #169 P5) ← เปิดแล้ว | caption box ขาวล้วน |
| temp 0.1 + ellipsis normalize + RTL no-reorder | translator gpt_config | quick win |
| determinism-gate cache + 2px quantize | cache tech-debt | เสถียรขึ้น |
