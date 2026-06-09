<!-- lang:th -->
# Pipeline ปัจจุบันของเรา — Baseline ก่อนปรับปรุง (snapshot 2026-06-08)

> **จุดประสงค์:** บันทึกสภาพ pipeline ของ MangaDock **ก่อน**เริ่มงานยกระดับคุณภาพ (PRD #169: #170 bubble seg → #168 SFX → #166 sizing → P3 OCR rescue) เพื่อใช้เทียบ before/after ในรายงาน
> **Anchor:** branch `feat/context-aware-translation` @ commit `150febd` · วัดจริงจากโค้ดทุกบรรทัด (file:line ในส่วนภาษาอังกฤษ)
> **เครื่องอ้างอิง:** RTX 4070 SUPER 12GB · translator ปัจจุบัน = custom_openai gateway (qwen3.6-35b)

## ภาพรวม pipeline ปัจจุบัน (โหมด patch ที่ใช้จริง)

```
Reader กดแปล
  → Backend (fetch รูป CDN/disk → buildMitConfig → POST MIT)
  → MIT worker 12 ขั้น:
      1 colorize(ปิด) 2 upscale(ปิด) 3 load 4 DETECT(DBNet-r34)
      5 OCR(48px) 6 textline-merge 7 TRANSLATE(+post-check เปิด)
      8 filter-lang 9 group regions(pad40+extra80) 10 mask
      11 INPAINT(LaMa) 12 RENDER(fit textline box) → PNG patch รายกรอบ
  → webhook รายหน้า (HMAC) → Backend cache v6 + PatchStore
  → SSE → Reader วาง overlay ตาม %
```

## โมเดล/อัลกอริทึมที่ใช้ตอนนี้ (จุดสำคัญสำหรับรายงาน)

| ขั้น | ของเราตอนนี้ | ข้อจำกัดที่จะแก้ |
|---|---|---|
| **Detection** | DBNet-ResNet34 (`detect-20241225.ckpt`) @ 2048px | เจอ "บรรทัดข้อความ" ไม่เจอ SFX สไตล์จัด (#168) ไม่รู้รูปทรงบับเบิล (#170) |
| **OCR** | Model48px CNN | ทิ้งบรรทัดยาวผอม (แก้บางส่วนด้วย `MIT_OCR_PROB` #167) |
| **Translate** | GPT-family (ตอนนี้ custom_openai gateway) + **post-translation check เปิด default** (จับตัวซ้ำ + สัดส่วนภาษา + retry 3) + series_context (#157) | — |
| **Inpaint** | LaMa @ 1536px bf16 | เร็ว/เบา/ดีกับ screentone (ข้อดีที่เก็บไว้) |
| **Render** | `resize_regions_to_font_size` — fit ลง**กล่อง textline ต้นฉบับ**, font ขั้นต่ำ auto `(กว้าง+สูง)/200` | **ตัวจิ๋ว/ล้นขอบ** เพราะไม่มี bubble mask + ไม่ binary-search + ไม่ supersampling (#166/#170) |

## สิ่งที่ Backend ส่งให้ MIT ตอนนี้ (config จริง)

ส่งแค่: `translator{target/source/model/series_context}` · `detector{detection_size + knob #167}` · `ocr{prob}` · `inpainter{3 ค่า}` · `render{direction,rtl}`

**ไม่ส่ง:** font sizing, bubble mask, renderer choice — ทั้งหมดปล่อยให้ MIT default (= ต้นเหตุที่คุมคุณภาพ render ไม่ได้)

## ระบบรอบ pipeline ที่มีอยู่แล้ว (ข้อแข็งที่เก็บไว้)

- **Patch output รายกรอบ** + Reader สลับ HD/ต้นฉบับได้ทันที (#156 derivative-coherent)
- **Cache v6** keyed by chapter:page:src:tgt:model:derivative · PatchStore ชื่อ deterministic · TTL 7 วัน
- **Webhook รายหน้า** HMAC + idempotent lock + Redis fan-out + listener replay
- **Cancellation** + **progress events** (stage รายหน้า) + **readiness probe** (#132)
- **5 ภาษาเป้าหมาย**: TH/EN/ZH/JA/KO · **series context** (#157) จาก catalog

## งานยกระดับที่จะวัดเทียบ (roadmap PRD #169)

| เฟส | Issue | จะแก้อะไร |
|---|---|---|
| P0 | #170 | bubble segmentation — ให้รูปทรงลูกโป่ง |
| P1 | #168 | AnimeText YOLO — เจอ SFX |
| P2 | #166 | area-driven sizing — ตัวอักษรไม่จิ๋ว/ไม่ล้น |
| P3 | — | OCR rescue ladder — บรรทัดที่อ่านพลาด |

> รายละเอียดเชิงลึกของระบบเขา (เป้าหมายที่จะไปให้ถึง) อยู่ใน [`mangatranslator-internals.md`](mangatranslator-internals.md)

---

<!-- lang:en -->
# Our Current Pipeline — Pre-Improvement Baseline (snapshot 2026-06-08)

> **Purpose:** factual "before" snapshot of MangaDock's translation pipeline, captured before the quality-uplift work (PRD #169) begins, for an engineering before/after report.
> **Anchor:** branch `feat/context-aware-translation` @ `150febd`. Every claim verified against the real code; file:line below. Reference box: RTX 4070 SUPER 12 GB; active translator = custom_openai gateway (qwen3.6-35b).

## A. MIT patch-mode pipeline — the 12 stages (`manga_translator.py:translate_patches`, line 2043)

1. **Colorization** (`_run_colorizer`, 678-689) — `Colorizer.none` default, OFF.
2. **Upscaling** (`_run_upscaling`) — `upscale_ratio=None` default, OFF.
3. **Image load** — PIL→RGB+alpha (line 734); source ICC profile captured (line 2054) and carried into every patch PNG (#156).
4. **Detection** (`_run_detection`, dispatch line 699) — **DBNet-ResNet34** (`detection/default.py` → `default_utils/DBNet_resnet34`, ckpt `detect-20241225.ckpt`). Config default 2560px but Backend sends **2048**; `text_threshold=0.5, box_threshold=0.7, unclip_ratio=2.3` (config.py:308-323). Returns `textlines, mask_raw, mask` (line 481). **mask = text-pixel mask, NOT a bubble shape.**
5. **OCR** (`_run_ocr`, 737-779) — **48px model** (`Ocr.ocr48px`, config.py:344). Enriches each textline with `.text`.
6. **Textline merge** (`_run_textline_merge`, 778-927) — groups lines into `text_regions` (TextBlock), saves `text_raw` (line 788), pre-dict + language/length filter.
7. **Translation** (`_run_text_translation`, 1061-1363) — translator family from `TRANSLATOR_TYPE` env (default `Translator.gemini`, config.py:235; this box runs `custom_openai`). **Post-translation check ON by default** (`enable_post_translation_check=True`, config.py:263): repetition-hallucination (≥20 repeats, 1240-1246), page-level target-lang ratio (1256-1324), retry up to 3 (1248-1319). Writes `.translation, .target_lang, ._alignment, ._direction`. **Text layer #158**: `src/dst` per region (`text_layer.py:13-21`).
8. **Source-lang filter** (1846-1880) — `source_lang_only` opt.
9. **Region grouping** (1979-2029) — union-find on padded bboxes; **pad=40px, render_extra=80px** (lines 2082-2083), merge threshold 120px.
10. **Per-group mask** (`_create_text_only_mask`, 1897-1925) + mask refinement (2135-2147).
11. **Per-group inpaint** (`_run_inpainting`, 2150-2156) — **LaMa `lama_large`** (config.py:326), config default 2048 but Backend sends **1536**, bf16.
12. **Per-group render** (`_run_text_rendering`, 2162-2168) — `Renderer.default`; **`resize_regions_to_font_size`** (rendering/__init__.py:48-233): fits text into the **original textline box**, auto floor `font_size_minimum = round((w+h)/200)` when -1 (line 65), length-ratio scaling with 30% damping capped at 1.1× (lines 164-202). **No bubble mask, no binary search, no default supersampling.** → PNG encode (compress level 1, 2170-2184).

**Result dict:** `{img_width, img_height, patches: [{x,y,w,h,img_png}], regions: [{src,dst}]}` (line 2205).

## B. Backend → MIT request path

**Lifecycle:** Reader `startTranslate/translateCurrentPage` (`useChapterTranslation.ts:165-362`) → POST `/books/chapters/{id}/batch-translate-patches` (controller 207-266) → `startOrAttachBatchJob`→`_runMitBatch` (`books.service.ts:930-1317`) → fetch images (`loadPageBytes`, disk/CDN) → `buildMitConfig` (563-607) → POST MIT `/translate/with-form/patches/batch` → 202 → per-page webhook `/webhooks/mit/callback` (`mit-webhook.controller.ts:20-113`) → `handleMitCallback` (175-288): HMAC verify, idempotent lock, PatchStore persist, cache, notify → SSE `data:{pageIndex,patches,error}` (controller 235-246) → Reader positions overlays by xPct/yPct/wPct/hPct.

**buildMitConfig — exact JSON sent today** (`books.service.ts:563-607`):
```json
{ "translator": {"target_lang","source_lang","source_lang_only","model?","series_context?"},
  "detector":   {"detection_size":2048, "text_threshold?","det_invert?","det_gamma_correct?"},
  "ocr":        {"prob?"},
  "inpainter":  {"inpainter":"lama_large","inpainting_size":1536,"inpainting_precision":"bf16"},
  "render":     {"direction":"auto","rtl":<bool>} }
```
Env knobs: `MIT_DETECTION_SIZE`(2048), `MIT_TEXT_THRESHOLD`/`MIT_DET_INVERT`/`MIT_DET_GAMMA_CORRECT`/`MIT_OCR_PROB`(#167, opt-in), `MIT_INPAINTER`/`MIT_INPAINTING_SIZE`(1536)/`MIT_INPAINTING_PRECISION`(bf16), `MIT_SEND_SOURCE_LANG`(true). `series_context` from `seriesContextFor(mangaId)` (local-first, ≤500-char synopsis). **NOT sent: font sizing, bubble mask, renderer choice** — these are MIT defaults; the Backend has no lever over render quality today.

## C. Cache + storage

- **Patch cache key v6** (`books.service.ts:509-521`): `translate:manga-patches:v6:{chapterId}:{pageIndex}:{srcMIT}:{tgtMIT}:{model}:{derivative}` (v4 added model #87; v5 derivative #156; v6 series-context awareness #157). TTL **7 days** (line 245).
- **PatchStore** (`patch-store.ts:44-92`): deterministic `uploads/patches/{chapterId}/{src}__{tgt}__{model}__p{N}__r{R}.png`; legacy random-name files swept on boot+daily (#137).
- Cache tiers: L1 in-memory → L2 Redis(optional) → L3 disk.

## D. Reliability machinery (current)

- **Idempotent webhooks**: `processingPages` lock set synchronously before await (188-192); persistence try/catch always releases the lock (204-253).
- **Notify fan-out**: direct `originalListener` (guaranteed) + Redis `translate:{jobKey}` + latecomer listeners (255-270).
- **Cancellation**: user abort → `removeBatchListener` → `activeCallerCount==0` → `cancelController.abort()` + best-effort POST `/cancel/{jobKey}` to MIT (888-917).
- **Progress events**: `{taskId,pageIndex,stage}` with no patches → `notifyBatchProgress` → SSE `type:progress` (154-173).
- **HMAC** SHA-256 over raw bytes; enforced in production, open in local dev (`mit-webhook.controller.ts:20-67`).
- **Readiness**: probes worker `/health`, 503 on dead worker, reports resolved translator (#132).

## E. Frontend surface (current)

- **Targets** (`targetLangs.ts:10-16`): TH/EN/ZH/JA/KO; `fallbackTarget` prevents target==source.
- **Derivative #156** (`translationSources.ts:22-36`): `buildTranslationSources(data, useSaver)` → `{sources, derivative:'hd'|'saver'}`, threaded through cache + jobKey so HD/saver patches never mix.
- **Series context #157**: Reader sends `mangaId`; Backend composes title+synopsis into `translator.series_context`.
- **Menu** (#162): fully-translated chapter shows one view toggle, not dead translate buttons. **Status pill #164** rendered view-mode-agnostic.

## F. Config capabilities present but OFF / unused in our patch path

colorization (`mc2`), upscaling (esrgan/waifu2x), `manga2eng` renderer, pre/post dictionaries, `skip_lang`/`source_lang_only`, multi-page `context_size`, batch_size>1 — all default OFF. Post-translation check is the only non-default-trivial feature ON. (Full inventory: [`mit-hidden-capabilities.md`](mit-hidden-capabilities.md).)

## G. The improvement roadmap this baseline anchors (PRD #169)

| Phase | Issue | Target |
|---|---|---|
| P0 | #170 | bubble segmentation → balloon mask (the boundary we lack) |
| P1 | #168 | AnimeText YOLO second pass → detect stylized SFX |
| P2 | #166 | area-driven font sizing → no tiny text / no overflow |
| P3 | — | OCR rescue ladder → fix barely-read lines |

The "after" target — meangrinch/MangaTranslator's techniques, algorithm-level — is documented in [`mangatranslator-internals.md`](mangatranslator-internals.md); the executive comparison is in [`mangatranslator-study.md`](mangatranslator-study.md).
