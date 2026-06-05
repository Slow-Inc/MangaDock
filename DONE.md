# DONE — Claude Code Review Fix Session (2026-05-27)

---

## ✅ #95 S2 + #87 UI + #129 RESOLVED (2026-06-05 รอบสอง, user มอบหมายให้ตัดสินใจ)

**#95 S2 — enforce secret เฉพาะ production (TDD):**
- ตัดสินใจ option (c): no-secret + `NODE_ENV=production` → 401 (fail loudly) · dev/test → accept unauthenticated (คงการตัดสินใจ 2026-06-04 เรื่อง local dev)
- 2 tests baseline เดิมถูกเขียนใหม่เป็น production context + เพิ่ม dev-accept test → `mit-webhook-hmac.spec.ts` **เขียวทั้ง suite (7) เป็นครั้งแรก** → baseline เหลือ 14 (pubsub เท่านั้น) — อัปเดต memory ทั้ง repo+local แล้ว
- **#95 ครบทั้ง S1+S2+S3 → ปิดได้**

**#87 — Reader model selector UI (เสร็จ ปิดได้):**
- section "โมเดล AI" ในทั้ง desktop translate dropdown และ mobile more-menu (chip pattern เดียวกับ LANGS) — list จาก `fetchAvailableMangaModels()` (fetch lazy ตอนเมนูเปิดครั้งแรก) + ปุ่ม "อัตโนมัติ" (= ลบ key → operator env default ชนะ)
- เขียน `MANGA_IMAGE_TRANSLATE_MODEL_KEY` ลง localStorage · tsc EXIT 0 · eslint pre-existing เดิมเท่านั้น
- ค้างเฉพาะ manual e2e (ต้อง restart MIT)

**#129 — ตัดสินใจ option (a): accept + document (ปิดได้):**
- ADR ใน `MIT/ARCHITECTURE.md` §6 — cancel = page-boundary by design; เหตุผล: interrupt กลาง inference เสี่ยง forrtl 200, checkpoint ต้อง plumb taskId ข้าม process, worker ที่สอง = VRAM ×2; latency ยอมรับได้ ≤1 หน้า (~60-100s); revisit เมื่อมี multi-GPU/worker pool
- `CONTRACT.md` §3a — เตือน caller ว่า window นี้ไม่ใช่ "MIT down"
- UX: toast ใน `cancelTranslate` ("หน้าที่กำลังประมวลผลอยู่จะหยุดเมื่อจบหน้านั้น") — `useToast` (no-op ถ้าไม่มี provider)

---

## 🔄 #87 IMPLEMENTED (backend+MIT+lib; Reader UI ค้าง) — per-request Gemini model (2026-06-05, TDD)

**Slice A — Backend (เขียวครบ):**
- `imageModelKey()` (sanitize `[\w.-]`, strip `models/`) + `patchCacheKey()` — cache **v3→v4** มี model segment (`:model|default`); v3 เดิมหมดอายุเอง (TTL 7 วัน)
- `buildMitConfig(..., imageModel?)` → `translator.model` เมื่อ valid · `buildJobKey` รวม model (กัน cross-model collision — เกิน PRD แต่จำเป็น: jobKey เดิมจะชนกันเมื่อ 2 คนเลือกคนละ model)
- plumbing ครบสาย: controller (ทั้ง 2 endpoints + removeBatchListener) → startOrAttachBatchJob → _runMitBatch → NDJSON cache write → fallback → _retryMissingPagesIndividually
- Test: `books-image-model.spec.ts` (4, RED→GREEN) · `books-retry.spec.ts` อัปเดตตาม signature ใหม่ (spec ผูก private method) · nest build EXIT 0 · books suite = baseline เดิม

**Slice B — MIT (เขียวครบ):**
- `TranslatorConfig.model: Optional[str]` (config.py) — contract test `test_image_model_config.py` (2, RED→GREEN)
- `gemini.py`: `_model_override` set ใน `parse_args` ทุก dispatch · `_model()` = override หรือ `GEMINI_MODEL` · แทนที่เฉพาะ request path (count_tokens, generate_content ×2 รวม JSON helper) · **`useCache` คืน False เมื่อ override ≠ default** (cached_content ผูกกับ model ที่สร้าง — bypass ปลอดภัยสุด, ช้าลงเฉพาะ request ที่ override) · `caches.create`/`_CONFIG_KEY`/validation ตอน init คงใช้ env default โดยตั้งใจ
- ไม่เขียน gemini unit test (ต้อง network — precedent #107); MIT unit suite 69 passed

**Slice C — Frontend (plumbing เสร็จ; UI ค้าง):**
- `getSelectedMangaImageTranslateModel()` — key ใหม่ `mangaImageTranslateModel` → fallback key text เดิม (selector เดียวขับทั้งสอง ตาม PRD option แรก) → ไม่เลือก = `undefined` (operator env default ชนะ — user story 9)
- `mangaTranslatePage.ts` ทั้ง 2 fn + `MangaReader` ทั้ง 3 จุดเรียก ส่ง `imageModel` · tsc EXIT 0 · eslint = pre-existing errors เดิมเท่านั้น

**ค้างก่อนปิด #87:** (1) selector UI ใน Reader ที่ user ทั่วไปเห็น — ตอนนี้ขับผ่าน `DevMangaTranslateModelToggle` ที่ gate ด้วย `NEXT_PUBLIC_MANGA_TRANSLATE_DEV_TOOLS` เท่านั้น (2) manual end-to-end กับ MIT จริง (ต้อง restart MIT)

---

## ✅ #95 S1 IMPLEMENTED — webhook HMAC over raw request bytes (2026-06-05, TDD)

- **Root cause:** Backend verify HMAC บน `JSON.stringify(parsed body)` แต่ MIT sign raw bytes (`json.dumps(separators=(',',':'), ensure_ascii=False)`) → byte ไม่ stable (เช่น float `1280.0` → JS stringify เป็น `1280`) → ถ้าเปิด `MIT_WEBHOOK_SECRET` จะ mismatch
- **Fix:** `main.ts` json() `verify` hook เก็บ `req.rawBody` · controller verify บน `req.rawBody` (fallback stringify เฉพาะ direct invocation ที่ไม่มี Express req)
- **Test:** เพิ่ม raw-bytes test ใน `mit-webhook-hmac.spec.ts` (RED→GREEN ด้วย payload `1280.0`) · `nest build` EXIT 0
- **สถานะ #95:** S1 ✅ ตอนนี้ · S3 (5MB bound) มีผลอยู่แล้ว · **S2 (enforce secret) ถูก revert โดยตั้งใจ** ใน session 2026-06-04 (HMAC optional เพื่อ local dev) — 2 tests ที่ encode S2 strict behavior ยัง fail อยู่ใน baseline (จงใจไม่แตะ รอตัดสินใจ: enforce เฉพาะ production หรือ update tests ตาม behavior ปัจจุบัน)
- **Docs:** `MIT/CONTRACT.md` §5 — ย้าย S1 จาก open hazards → resolved

---

## ✅ #127 + #128 IMPLEMENTED — cancel→re-translate poisoning (2026-06-05, TDD)

อาการที่ผู้ใช้แจ้ง: cancel แล้วกดแปลใหม่ → "แปลทั้งตอน" ไม่ดึง cache + MIT ไม่ทำงาน · "แปลเฉพาะหน้า (ยังไม่แปล)" MIT ไม่ทำงาน · MIT รับ cancel ช้า → trace แล้วแตกเป็น 3 issues (#127 AFK, #128 AFK, #129 HITL-รอตัดสินใจ)

**#127 — Backend: all-cached batch job leak ใน `activeBatchJobs`**
- Root cause: `startOrAttachBatchJob` early-return ตอน `uncachedPages.length === 0` โดยไม่ลบ placeholder ออกจาก registry (cleanup อยู่ใน `finally` ที่ไม่ถูกแตะ) → request ถัดไปของ jobKey เดิม attach กับ resolved job → replay `completedPages` ว่าง → คืนทันที ไม่ serve cache ไม่เรียก MIT
- Fix: ลบ jobKey ออกจาก registry (guarded identity check) ก่อน early-return — mirror ของ finally-cleanup
- Test: `books-batch-registry.spec.ts` (2) — RED→GREEN; books suite baseline เดิม (16 pre-existing: pubsub 14 + hmac 2 — ตรง memory); `nest build` EXIT 0

**#128 — MIT: stale cancel flag วางยา batch ใหม่ของ taskId เดิม**
- Root cause: taskId deterministic (`chapterId:src:tgt`) + `/cancel` ที่มาถึง**หลัง** `run_batch_with_callbacks` `discard()` ใน finally ไปแล้ว → taskId ค้างใน `_cancelled` ถาวร → run ถัดไป `is_cancelled` ตั้งแต่หน้าแรก → break เงียบ ไม่ส่ง webhook เลย
- Fix: `discard(taskId)` ตอนเริ่ม run — submission ใหม่ supersede stale cancel; cancel ระหว่าง run ยังทำงานเหมือนเดิม (#101 ไม่ถดถอย — มี regression tests)
- Refactor เพื่อ testability (precedent #100 webhook.py): extract loop → **`server/batch_runner.py`** (deps เบา; heavy imports อยู่หลัง seam `_translate_page`) — `main.py` import จาก module ใหม่ + trim orphan imports (`send_webhook`, `is_cancelled`, `discard`)
- Test: `test/test_batch_runner.py` (4: stale-flag-no-poison, cancel-mid-page-drop, cancel-between-pages-stop, discard-on-exit) — import <1s ไม่ลาก ML stack · MIT unit suite รวม **67 passed**
- Docs sync: `ARCHITECTURE.md` §6 + `CONTRACT.md` §3a — ระบุ semantic "new submission clears stale cancel flag"

**ตั้งใจไม่แตะ:** #129 (page-granular cancel latency + single-worker starvation) เป็น HITL — รอเลือกแนวทาง (a) accept+doc / (b) checkpoint ใน pipeline / (c) worker ที่ 2 · pre-existing fails: Backend pubsub/hmac 16 ตัว, MIT upstream `test_translation*`/`test_textline_merge` (async-def, ไม่มี pytest-asyncio) — ยืนยันด้วย stash-run แล้วว่าไม่เกี่ยวกับ change นี้

**สำหรับ Gemini re-review:** attach path ยังไม่ pre-check cache ให้ latecomer (ได้เฉพาะ `completedPages` replay) — พฤติกรรมเดิม ไม่ใช่ scope #127 · ยังไม่ commit (รอ user สั่ง)

---

## 🐛 Cancel-propagation + Thai wrap + VRAM pass (2026-06-05, /debug-mantra /scrutinize)

อาการที่ผู้ใช้แจ้ง: (1) กดยกเลิกแปล "ทั้งตอน" แล้ว MIT ยังแปลต่อ, (2) ตัวอักษรไทยขึ้นบรรทัดกลางคำ, (3) ขอลด VRAM/เพิ่ม perf

**#cancel — แปลต่อทั้งตอนหลังกดยกเลิก** (commit `e8a246f`)
- Root cause หลัก: `Frontend/app/api/proxy/[...path]/route.ts` ไม่ forward `req.signal` เข้า upstream fetch → browser abort ไม่ถึง NestJS → `res.on('close')` ไม่ fire → ไม่ยิง `/cancel` ไป MIT. Fix: `signal: req.signal`
- Root cause รอง: `removeBatchListener` สร้าง jobKey เองโดยไม่ผ่าน `shouldSendMitSourceLang()` → ตอน `MIT_SEND_SOURCE_LANG=false` (ค่าใน .env.example!) key ไม่ตรงกับ start path → cancel branch ไม่ทำงาน. Fix: extract `mitLangPair()`/`buildJobKey()` single source
- Test: `books-batch-cancel.spec.ts` (2) — cancel fire ทั้ง default และ `=false`

**#thai — ขึ้นบรรทัดกลางคำ** (commit `be2b01d`)
- Root cause: pythainlp ไม่อยู่ใน requirements → `_HAS_PYTHAINLP=False` → ZWSP no-op → ทั้งประโยคเป็น "1 คำ" → `calc_horizontal` fallback `list(word)` แตกทีละ code point ("จะ"→"จ"+"ะ")
- Fix: เพิ่ม `pythainlp` (newmm, no torch) + `_safe_char_split` cluster-safe fallback (มาร์ค U+0E31/0E34-3A/0E47-4E ติดพยัญชนะฐานเสมอ) wired 2 จุดใน calc_horizontal
- Reproduced จริงก่อนแก้ (debug-mantra step 1). Test: `test/test_thai_wrap.py` (8)

**#vram — env-configurable knobs** (commit `bd70698`)
- รวม mitConfig (เดิม duplicate 2 ที่) เป็น `buildMitConfig()` single source
- ลด default: detection 2560→2048, inpainting 2048→1536 (activation ∝ size²) + expose `MIT_DETECTION_SIZE/INPAINTING_SIZE/INPAINTER/INPAINTING_PRECISION`
- ชี้ชัด: int4/int8/fp8 ใช้ได้เฉพาะ LLM translator (Qwen3, `QWEN3_PRECISION` มีอยู่แล้ว) ไม่ใช่ CNN detector/OCR/LaMa. แนะนำ int4 สำหรับ 4B translator บนการ์ด ≤12GB. default translator = Gemini API = 0 local VRAM
- Test: `books-mit-config.spec.ts` (4). Backend baseline ไม่เพิ่ม regression (pre-existing 14 pubsub + 2 hmac เท่าเดิม)

---

## 🐛 Batch Translation End-to-End Fix Session (2026-06-04)

อาการ: แปลทีละหน้าได้ปกติ แต่ "แปลทุกหน้า" (Batch Translation) frontend ไม่แสดง patch — สุดท้าย frontend ได้ HTTP **524** (Cloudflare timeout)

พบและแก้ bug 4 ตัวตามลำดับ (debug จาก log ไฟล์ backend/MIT):

| # | Root Cause | Fix | Files |
|---|---|---|---|
| 1 | MIT Webhook ส่งไป Backend Public Origin (Cloudflare) ที่ MIT บน localhost reach ไม่ได้ | เพิ่ม `MIT_CALLBACK_ORIGIN` env + `mitCallbackOrigin` getter (`http://localhost:4001`) | `books.service.ts`, `.env`, `.env.example` |
| 2 | Webhook controller reject ทุก request เมื่อ `MIT_WEBHOOK_SECRET` ไม่ได้ตั้ง | ทำ HMAC เป็น optional — ไม่มี secret → accept unauthenticated | `mit-webhook.controller.ts` |
| 3 | ส่ง `signal` เข้า `fetch(mitUrl)` → user cancel → kill TCP กลางคัน → MIT BLAS crash (`forrtl error 200`) | ถอด `signal` ออกจาก MIT POST + เพิ่ม pre-check `signal.aborted` ก่อน submit | `books.service.ts` |
| 4a | MIT webhook body (base64 PNG ~1-3MB) เกิน body-parser default 100KB → `PayloadTooLargeError` | ตั้ง `json({ limit: '50mb' })` + `bodyParser: false` ตอน create app | `main.ts` |
| 4b | **Contract mismatch**: MIT ส่ง flat payload `{taskId,pageIndex,imgWidth,imgHeight,patches,error}` แต่ controller คาด `body.result` → `result.imgWidth` crash (undefined) | controller อ่าน flat fields แล้วประกอบ `result` object เอง (anti-corruption layer) — ตรงกับ NDJSON path ที่อ่าน flat อยู่แล้ว | `mit-webhook.controller.ts` |
| 5 | SSE endpoint ไม่มี heartbeat → ระหว่างรอ MIT แปลหน้าแรก (~62s, ใกล้ 100s) ไม่มี byte ไหล → Cloudflare 524 | เพิ่ม initial `: connected` byte (บังคับ proxy เข้า streaming mode) + periodic `: ping` ทุก 15s, clear บน close/end | `books.controller.ts` |

**Verified:** `npx nest build` EXIT 0 (production build สะอาด; spec files มี error เดิมที่ไม่เกี่ยว)

### 🔍 MIT Scrutiny → GitHub Issues (2026-06-04)

scrutinize ทั้ง server/orchestration layer ของ MIT แล้วเปิด 6 issues:

| Issue | Severity | สรุป |
|---|---|---|
| [#100](https://github.com/Slow-Inc/MangaDock/issues/100) | 🔴 critical | `send_webhook` ไม่ retry + กลืน error → Patch Set ที่คำนวณเสร็จหายถาวร (สาเหตุแท้จริงของ "0/20") |
| [#101](https://github.com/Slow-Inc/MangaDock/issues/101) | 🔴 critical | ยกเลิก batch ไม่ propagate ไป MIT (`DummyRequest.is_disconnected→False`) → zombie job เผา GPU |
| [#102](https://github.com/Slow-Inc/MangaDock/issues/102) | 🟠 security | path traversal + unauth บน `/result(s)/...` → read/delete นอก RESULT_ROOT |
| [#103](https://github.com/Slow-Inc/MangaDock/issues/103) | 🟠 security | worker รับ pickle ผ่าน HTTP + bind 0.0.0.0 → RCE risk; ต้อง bind 127.0.0.1 |
| [#104](https://github.com/Slow-Inc/MangaDock/issues/104) | 🟡 major | batch endpoints พัง (sent_batch arity + stub execute_batch) — dead/broken |
| [#105](https://github.com/Slow-Inc/MangaDock/issues/105) | 🟢 cleanup | dead code: duplicate imports, `String(e)` JS leftover, `start_instance=True` override, no-op if/else, dead `__del__`, `==‘cancel’` |

**เฟส 3 — สแกน logic layer เพิ่ม (ข้ามไฟล์ model AI):**
- [#106](https://github.com/Slow-Inc/MangaDock/issues/106) 🟡 — event-loop blocking (`requests.get` ใน async), lock-across-await, streaming ไม่มี timeout
- [#107](https://github.com/Slow-Inc/MangaDock/issues/107) 🟡 **bug จริงใน gemini.py (default translator!)** — `server_error_attempt` UnboundLocalError ทำ retry path พังเมื่อ Gemini error + bare raise + `lstrip` prefix misuse + JSON sample IndexError
- `#105` comment — dead code เพิ่มใน translator dispatch (langid ทิ้ง, branch redundant, shared mutable cache)
- `translators/__init__.py dispatch`, `TranslatorChain`, `_run_text_translation` — ตรวจแล้ว ไม่มี critical (แค่ dead code)

**เฟส 4 — สแกน GPT shared layer + validation (ข้าม model AI):**
- [#108](https://github.com/Slow-Inc/MangaDock/issues/108) 🟡 — `config_gpt.py` few-shot sample cache (`langSamples`) ไม่ key ตามภาษา/ชนิด → แปลภาษาแรกค้าง sample กระทบ multi-lang gemini + common_gpt JSON-mode helpers พัง (text2json ขาด self, chat_sample int-index)
- [#109](https://github.com/Slow-Inc/MangaDock/issues/109) 🟡 — `_check_target_language_ratio` ใช้ langid reject ทั้งหน้า (เปราะกับ SFX/credits ที่ไม่แปล) + dead `min_ratio` param + threshold region ไม่ตรงกัน (5 vs 10)
- `#105` comment เพิ่ม — dead code: `OfflineTranslator._load` ประกาศซ้ำ, `reload` param ไม่ parse, dead `_json_sample` local
- `common.py CommonTranslator.translate`, `_validate_translation`/retry, `_check_repetition_hallucination` — ตรวจแล้ว logic ถูกต้อง

**เฟส 5 — rendering + orchestration glue:**
- [#110](https://github.com/Slow-Inc/MangaDock/issues/110) 🟡 — `render()` ใช้ `region.horizontal` (raw) ทำ box padding แต่วาดด้วย `render_horizontally` (forced) → เพี้ยนเมื่อ force direction (MangaDock ใช้ auto เลย dormant) + homography None ไม่ guard
- `_translate_until_translation` (detect→ocr glue ที่ patch path เรียก) — try/except + ignore_errors ทุก stage, early-return ปลอดภัย **ไม่มีบั๊ก**

**✅ สถานะ: ตรวจ MangaDock-relevant logic ครบ end-to-end แล้ว** — patch path traced ตั้งแต่ entry (server endpoints) → queue/executor → worker → translate_patches → detect/ocr glue → translator dispatch → gemini/qwen3 → GPT shared layer → post-translation validation → rendering → webhook → SSE

**Issues ทั้งหมด: #100-#110 (11 issues) + #105 (2 comments)**

**เฟส 6 — สแกน logic ที่เหลือทั้งหมด (ยกเว้น model AI):**
- [#111](https://github.com/Slow-Inc/MangaDock/issues/111) 🟡 — `textline_merge` prob normalize หารผิด denominator (`textlines` แทน `txtlns`) + `TextBlock` `texts[0]` default พัง + mutable default
- `#110` comment — `generic.py` `findHomography` ไม่ guard (อีก site)
- `#106` comment — `gemini_2stage.py` ใช้ sync OpenAI block event loop
- dispatch glue ทั้ง 6 (detection/ocr/inpainting/mask_refinement/upscaling/colorization) — สะอาด
- retry-pattern check: gemini.py เป็นไฟล์**เดียว**ที่ไม่ init `server_error_attempt` (chatgpt/deepseek/custom_openai/sakura init ถูกต้อง) → ยืนยัน #107

**วิธีครอบคลุม:**
- **Deep-read (ทีละบรรทัด):** server/ ทั้งหมด · MangaDock patch path ใน manga_translator.py · translators/__init__+common+common_gpt+config_gpt+gemini+qwen3+gemini_2stage · textblock+textline_merge · rendering · dispatch glue ทั้ง 6
- **Pattern-swept (grep crash-class: undefined-var-in-except, bare except, mutable default, lstrip-misuse, findHomography unguarded, sync-in-async):** ไฟล์ที่เหลือทั้งหมด รวม chatgpt/chatgpt_2stage/sakura/nllb/sugoi/m2m100/etc + mode/local+ws + utils ที่เหลือ → bug ทั้งหมด isolate อยู่ในไฟล์ที่ deep-read แล้ว
- **ไม่ได้ line-read แบบเต็ม (pattern-swept เท่านั้น):** body ของ translator ที่ MangaDock ไม่ใช้ (chatgpt_2stage, sakura, nllb ฯลฯ ~5,000 บรรทัด), CLI mode (local.py, ws.py), geometry helpers (generic.py ที่เหลือ, sort.py, inference.py)
- **ข้ามถาวร:** OCR/detection/inpainting/diffusion **model AI** (~7,500 บรรทัด)

**Issues ทั้งหมด: #100-#111 (12 issues) + comments บน #105(×2), #106, #110**

---

## ✅ #100 IMPLEMENTED — Webhook retry + dead-letter (2026-06-05, TDD)

**Design (grill-locked, user approved ทั้งหมด):** retry เฉพาะ transient (5xx/429/conn) ไม่ retry 4xx · 4 attempts (max_retries=3) · exp backoff 0.5→1→2s · timeout 20s/attempt · sequential await + cap · dead-letter = structured JSON log · env-configurable

**Approach:** แยก `send_webhook` → **`server/webhook.py`** (deps: httpx/json/hmac/hashlib เท่านั้น → test import 0.26s vs main.py 22s) เพื่อ testability/maintainability ระยะยาว

**ไฟล์ที่แก้:**
- `MIT/server/webhook.py` (ใหม่) — `send_webhook` + `_sign` + `_is_retryable_status` + `_dead_letter`
- `MIT/server/main.py` — import จาก webhook.py + ลบ def เดิม + ลบ orphan imports (hmac/hashlib/httpx ×2 — รวม duplicate ของ #105 ที่ change นี้ทำให้ orphan)
- `MIT/test/test_send_webhook.py` (ใหม่) — **10 tests, fake httpx, asyncio.run (ไม่ต้อง pytest-asyncio)**
- `MIT/.env.example` — section 5: `MIT_WEBHOOK_MAX_RETRIES`, `MIT_WEBHOOK_RETRY_BACKOFF_MS`

**Verify (ทุกขั้นผ่าน):** TDD RED→GREEN · `pytest test/test_send_webhook.py` = **10 passed 0.21s** · py_compile OK · main.py ยัง import ได้ (send_webhook re-exported)

**ติดตั้ง:** `pytest 9.0.3` ลงใน MIT `.venv` แล้ว

**สำหรับ Gemini re-review:** dead-letter ปัจจุบันเป็น log อย่างเดียว (ไม่ persist/replay) — ตาม scope #100; การ persist เพื่อ reconciliation เป็นงานแยก (เกิน #100) · ยังไม่ commit (รอ user สั่ง)

## ✅ #107 IMPLEMENTED — GeminiTranslator error-handling (2026-06-05)

- **G1** `server_error_attempt = 0` ก่อน retry loop (ตกหายไป — chatgpt/deepseek/sakura มีอยู่แล้ว) → APIError ไม่ crash UnboundLocalError แต่ retry ตามตั้งใจ
- **G2** `raise` เปล่า → `raise ValueError(...)` (model misconfig ได้ error ชัด)
- **G3** `.lstrip('models/')` → `.removeprefix('models/')` (lstrip ตัด char ในเซ็ต — `models/embedding`→`bedding`)
- **G4** JSON-mode: ย้าย `loggerVals[...] = lang_JSON_samples[0]` เข้าใน `if` guard (กัน IndexError) + ลบ trailing-comma tuple
- **Verify:** py_compile OK · G3 demo (`bedding-001` vs `embedding-001`) · 25 unit tests ยังเขียว · **ไม่เขียน gemini unit test** (สร้าง translator ต้อง network = disproportionate ต่อ mechanical fix ที่ตรงกับ 3 sibling translators)

---

## ✅ #101 IMPLEMENTED — Batch cancellation propagation (2026-06-05, TDD, grilled)

Design grill-locked (ทุกข้อยึดหลักการ simplest+sustainable+perf):
- **MIT** `server/cancellation.py` — process-global `set()` registry (`mark_cancelled`/`is_cancelled`/`discard`)
- **MIT** `POST /cancel/{taskId}` endpoint → `mark_cancelled` (idempotent, no-op unknown)
- **MIT** `run_batch_with_callbacks` — double-check: ต้น loop (กันเริ่มหน้าใหม่) + ก่อน `send_webhook` (drop หน้าค้าง) + `discard(taskId)` ใน `finally` (ไม่ leak)
- **Backend** `removeBatchListener` — เมื่อ caller สุดท้ายออก → fire-and-forget `POST MIT /cancel/{jobKey}` ที่จุด abort เดิม (best-effort, swallow error)
- **Test:** `test/test_cancellation.py` — 6 tests · MIT unit suite รวม **25 passed** · Backend `nest build` EXIT 0
- commit + closed #101 · docs (ARCHITECTURE §6 + CONTRACT) อัปเดตให้ตรง

---

## ✅ #108 IMPLEMENTED — GPT sample selection (2026-06-05, TDD, Option C)

- **CG-1 (หลัก):** แทน `langcodes` fuzzy-match + per-instance cache (`langSamples`) ด้วย **direct lookup** (normalize code→name + case-insensitive) → ไม่มี cache = ไม่มี staleness ข้ามภาษา/chat-json, ไม่ต้องลง `language_data`, ลบ `self.logger` crash — ตามหลักการ "simplest + sustainable" (ลบความซับซ้อน ไม่ใช่ค้ำมันไว้)
- **พบระหว่างทาง:** sample matching **พังจริงในเครื่องนี้** (langcodes ต้องการ `language_data` ที่ไม่ได้ลง) → Gemini ได้ few-shot = ว่าง การ fix นี้แก้ทั้ง #108 + ปัญหานี้พร้อมกัน
- **CG-2:** fix JSON-mode helpers ใน `common_gpt.py` — `text2json` ขาด self, `chat_sample[0]` index dict ด้วย int → ใช้ `chatSample`, `min([])` guard (JSON mode off by default — ไม่ได้ unit-test แยก)
- **Test:** `test/test_gpt_samples.py` — 4 tests (no-staleness, code→name, unknown→[], chat/json ไม่ปน) · RED→GREEN · **ไม่ต้องลง dependency**
- รวม unit tests MIT ทั้งหมด: **19 passed** (webhook 10 + region 5 + samples 4)

---

## ✅ #111 IMPLEMENTED — Region utils (2026-06-05, TDD)

- **U-1** `textline_merge/__init__.py` — `region.prob` หารด้วยพื้นที่ของ region ตัวเอง (`txtlns`) ไม่ใช่ทั้งหน้า (`textlines`)
- **U-2** `utils/textblock.py` — `texts=None`/`[]` ไม่ crash (text="")
- **U-3** `utils/textblock.py` — `shadow_offset` ไม่ใช่ mutable default ที่แชร์กัน
- **Test:** `test/test_region_utils.py` — 5 tests (TextBlock construction + merge prob 2-region) · RED→GREEN ครบ
- commit + closed #111

---

## ✅ #109 IMPLEMENTED — Target-language check robustness (2026-06-05, TDD)

- **ปัญหา:** `_check_target_language_ratio` เดิมเอา translation ของทุก region มา merge แล้ว `langid.classify(merged)` ทั้งก้อน → SFX/credits ที่ตั้งใจไม่แปล ("SETSU SCANS") ทำให้ langid พลิกเป็นภาษาผิด → reject หน้าที่แปลถูกทั้งหน้า. `min_ratio` param ก็ dead (doc บอก "ไม่ใช้"). gate ภายใน `<=10` ขัดกับ caller page-level `>5` (หน้า 6–10 region log ว่า "starting check" แต่ฟังก์ชัน return True เงียบๆ)
- **Fix แบบ simplest+sustainable (North Star):** แทน langid-classify-merged (เปราะ) ด้วย **target-script char ratio** — นับสัดส่วนตัวอักษรที่อยู่ในสคริปต์ของภาษาเป้าหมาย แยกเป็น pure helper `utils/lang_ratio.py` (`target_script_ratio`) — ไม่มี ML import, unit-test เร็ว
  - ลบ internal `<=10` gate → ฟังก์ชันเป็น pure verdict, caller เป็นเจ้าของ policy ว่าจะเช็กเมื่อไร (page `>5`, batch `>10` — คนละ scope จงใจต่างกัน)
  - `min_ratio` กลับมาใช้จริง (`ratio >= min_ratio`)
  - langid ยังคง import (ใช้ที่อื่น line 786/1831) — ไม่แตะ
- **Test:** `test/test_lang_ratio.py` — 6 tests (Thai+SFX>0.8, untranslated-latin-when-THA<0.1, English-when-ENG>0.9, Japanese-when-ENG<0.1, empty/symbol==1.0, unknown→latin fallback) · RED→GREEN ครบ
- **Files:** `manga_translator/utils/lang_ratio.py` (new), `test/test_lang_ratio.py` (new), `manga_translator/manga_translator.py` (รื้อ body + import)
- commit + closed #109

---

## ✅ #102 IMPLEMENTED — Path traversal in result file endpoints (2026-06-05, TDD)

- `safe_result_folder(root, name)` ใน `server/path_utils.py` — reject `..`, `/`, `\`, empty, แล้ว verify `resolved.relative_to(root)` (ครอบ symlink attack)
- Wire ใน GET `/result/{folder}/final.png` + DELETE `/results/{folder}` → HTTP 400 สำหรับ invalid name
- `/results/clear` — disable by default via `MIT_ENABLE_RESULT_CLEAR=0` (unauthenticated+destructive, iterate RESULT_ROOT เองไม่ traversal แต่ต้อง opt-in)
- **Test:** `test/test_path_utils.py` — 7 tests, 0.04s, no ML
- commit `5d26ed8` + closed #102

---

## ✅ #103 IMPLEMENTED — Worker bind 0.0.0.0 RCE risk (2026-06-05, TDD)

- Extract `_build_worker_cmd(params, port, nonce)` จาก `start_translator_client_proc` — hardcode `--host 127.0.0.1` เสมอ (worker bind loopback เท่านั้น)
- ADR: `ARCHITECTURE.md` §2 + §9 อัปเดต — worker endpoints are loopback-trusted
- **Test:** `test/test_worker_bind.py` — 6 tests (loopback always, port/nonce propagated, gpu flags)
- commit `0d88711` + closed #103

---

## ✅ #104 + #105 IMPLEMENTED — Dead batch endpoints + dead code (2026-06-05)

- **#104 Decision: Remove** — production ใช้ `/translate/with-form/patches/batch` เท่านั้น. ลบ: `/translate/batch/json`, `/translate/batch/images`, `/simple_execute/translate_batch`, `/execute/translate_batch`, `BatchTranslateRequest`, `get_batch_ctx`, `BatchQueueElement`, `sent_batch`, `sent_batch_stream`
- **#105 Dead code:** collapse no-op if/else ใน `QueueElement.__init__`, remove dead `__del__` (image ไม่เคยเป็น str), remove `args.start_instance = True` override, remove `import os`
- ลบ 152 lines สุทธิ, 44 tests passing
- commit `af18459` + closed #104/#105

---

## ✅ #106 IMPLEMENTED — Async-correctness in queue/streaming (2026-06-05, TDD)

- `streaming.py` — `stream(messages, timeout=300)`: `asyncio.wait_for` + yield error frame on TimeoutError (ป้องกัน hang forever)
- `request_extraction.py` — `to_pil_image` URL path: `requests.get` (blocking) → `httpx.AsyncClient(timeout=30)` (async)
- `instance.py` — `find_executor` release lock ก่อน `event.wait()` (ป้องกัน serialise concurrent callers บน lock)
- **Test:** `test/test_async_correctness.py` — 7 tests (stream terminate, timeout, progress, httpx called, executor deadlock-safe)
- commit `1de61ff` + closed #106

---

## ✅ #110 IMPLEMENTED — Rendering direction mismatch + None homography (2026-06-05, TDD)

- **R-1** `rendering/__init__.py` line 333: `if region.horizontal:` → `if render_horizontally:` (ใช้ effective direction ไม่ใช่ raw detected — dormant ตอนนี้แต่จะพังเมื่อ forced direction ถูกใช้)
- **R-2** Guard `if M is None: logger.debug(...); return img` ก่อน `cv2.warpPerspective` (degenerate regions skip cleanly แทนที่จะ raise แล้วถูก swallow)
- **Test:** `test/test_rendering_guard.py` — 4 tests (collinear → None homography, valid → non-None, None guard, direction logic). No ML needed
- commit `93c31e6` + closed #110

---

**MIT unit suite สุดท้าย (2026-06-05): 49 tests passing** (เพิ่มจาก 25 ตอนเริ่ม session)

**ทุก issue #100–#111 ปิดหมดแล้ว**

---

### 📘 MIT documentation (blueprint สำหรับ team + agent) — 2026-06-05
- `MIT/ARCHITECTURE.md` — พิมพ์เขียว 12 sections (2-process model, directory map, patch path, translator subsystem, webhook, known issues #100–111). frame model folders เป็น black box หลัง `dispatch()` (codebase ใหญ่เพราะ model upstream — ไม่ต้อง doc ต่อโมดูล)
- `MIT/SETUP.md` — runbook: install/run/test + troubleshoot จริง (forrtl 200, model load 150s, CUDA OOM, port, webhook unreachable)
- `MIT/CONTRACT.md` — wire format MIT↔Backend; เด่นที่ **casing footgun** (single=snake_case `img_width` vs batch/webhook=camelCase `imgWidth`) + HMAC raw-bytes hazard (#95 S1) + size limits — กันบั๊กคลาส contract-drift
- **ตั้งใจไม่ทำ:** ADR log เต็ม, per-module model docs, Swagger (FastAPI มี `/docs` อยู่แล้ว) — กัน doc bloat

---

**เฟส 2 — สแกนส่วนที่เหลือ** (`mode/share.py`, `streaming.py`, `qwen3.py`, patch helpers, `config.py`):
- `translate_patches` + patch helpers (union-find grouping, mask crop/scale) — สะอาด ไม่มีบั๊ก
- `qwen3.py` (โค้ดใหม่ commit e1979cd) — แข็งแรง; default `Qwen/Qwen3.5-4B` ตรงกับ `.env.example`; ยืนยันทำงานจาก MIT log จริง
- **ข้อสังเกตเล็กน้อย (ยังไม่ filed):** `streaming.py stream()` รอ `messages.get()` ไม่มี timeout — ถ้า worker ไม่ส่ง terminal frame (code 0/2) SSE generator ค้าง (กระทบเฉพาะ streaming path ไม่ใช่ webhook path)
- **ขอบเขต:** ไม่ได้ line-audit deep ML pipeline (detection/OCR/inpaint/render/diffusion models) — เป็นโค้ด upstream และไม่ใช่จุดที่ reliability bug ของฟีเจอร์นี้อยู่

**ทดสอบ end-to-end:** ยังไม่ได้รัน — ต้อง **restart MIT** (run-server.bat) แล้วลองแปลทุกหน้าใหม่ Backend hot-reload เอง

**สำหรับ Gemini re-review (ทิ้งไว้ตั้งใจ ไม่แก้ในรอบนี้):**
- **#95 S1**: HMAC ยังคำนวณบน `JSON.stringify(body)` (parsed) ไม่ใช่ raw request bytes — MIT คำนวณบน `json.dumps(separators=(',',':'))` → ถ้าเปิด secret จะ mismatch ต้องเก็บ raw body buffer (เช่น `rawBody` express verify)
- **Latent**: ใน `handleMitCallback` ถ้า throw หลัง `processingPages.add(pageIndex)` (เช่น storage fail) page จะ lock ถาวร retry ไม่ได้ — ควรห่อ try/finally เพื่อ delete จาก processingPages เมื่อ error

---

## 🔖 Pending Issues (GitHub MCP no access — publish manually when token updated)

| # | Title | Priority |
|---|---|---|
| #89 | fix(books): notify() ต้อง publish ไป Redis ใน NDJSON sync path | ✅ done |
| #90 | fix(webhook): security hardening — raw HMAC, enforce secret, img_b64 bound | ✅ done (S2+S3; S1 raw HMAC pending) |
| #91 | fix(misc): listener tracking, observability, fetch short-circuit | ✅ done |
| #92 | PRD: Qwen3 offline translator (see below) | 📋 PRD ready |

---

## 📋 PRD #92 — Qwen3 Offline Translator (2026-06-04)

### Problem Statement

ผู้ใช้ที่มี GPU (RTX 4070 Super 12GB) ต้องการรัน manga translation แบบ offline ไม่พึ่ง Gemini API แต่ MIT hardcode translator เป็น `gemini` และไม่มี Qwen3 translator class Qwen3 ยังมี thinking mode ที่ต้องปิดก่อนใช้งาน

### Solution

1. `MIT` — Qwen3Translator class ใหม่ที่ปิด thinking mode + config ผ่าน env vars
2. `MIT config.py` — เพิ่ม `qwen3`, `qwen3_big` ใน Translator enum + OFFLINE_TRANSLATORS
3. `Backend` — อ่าน `MIT_TRANSLATOR` env var แทน hardcode `gemini`

### Env Vars (MIT)

| Var | Default | Description |
|---|---|---|
| `QWEN3_MODEL` | `Qwen/Qwen3-4B-Instruct` | HuggingFace model ID |
| `QWEN3_4BIT` | `false` | INT4 quantization |
| `QWEN3_TORCH_DTYPE` | `auto` | auto/bfloat16/float16 |
| `QWEN3_MAX_NEW_TOKENS` | `4096` | Max output tokens |
| `QWEN3_BIG_MODEL` | `Qwen/Qwen3-8B-Instruct` | Model for qwen3_big key |
| `QWEN3_BIG_4BIT` | `false` | INT4 for big model |

**Backend:**
```
MIT_TRANSLATOR=gemini   # gemini | qwen3 | qwen3_big | nllb | sugoi
```

### Key Implementation Notes

- `apply_chat_template(..., enable_thinking=False)` — requires transformers >= 4.51.0; strip `<think>.*</think>` as fallback
- Qwen3-4B BF16 = ~8GB VRAM → fit ใน 12GB, ~4GB เหลือสำหรับ KV cache
- Cold start บน SN850X NVMe (~7GB/s): ~1 วินาที หลัง download ครั้งแรก

### Testing

- MIT (Python unittest): thinking tag stripping, env var reading, response parsing
- Backend (Jest): `MIT_TRANSLATOR` env → correct translator field ใน MIT config JSON; default = `gemini`
- Prior art: `books-pubsub-batch.spec.ts` สำหรับ mock `_runMitBatch`

### Out of Scope

- Frontend translator selector UI
- Qwen3 MoE 235B
- Automatic VRAM detection/quantization selection
| #91 | fix(misc): listener tracking log, observability, fetch short-circuit | 🟡 medium |

---

## Files Modified

### Frontend
- `app/lib/communityApi.ts` — Always append `limit` param (removed `!== 20` condition)
- `app/lib/apiCache.ts` — `cacheClearByTag`: collect keys before iterating (Map mutation bug fix)
- `app/components/VoteButtons.tsx` — Added resync `useEffect` on `targetId` change; moved auth check before loading guard
- `app/hooks/useForumStream.ts` — Changed SSE URLs to `/api/proxy/` prefix; added non-empty catch blocks with console.warn; fixed `esRef.current = null` in `useFeedStream` cleanup
- `app/community/page.tsx` — Added `if (!user) { showLoginPrompt(); return; }` to `handleCreatePost`; fixed SVG paths `l18 18` → `L18 18`
- `app/community/p/[id]/page.tsx` — XSS sanitization for imageUrls (`/^https?:\/\//` guard); added `mountedRef` to prevent setState after unmount in handlePostComment; removed redundant `fetchData(true)` after optimistic comment add

### Backend
- `src/auth/auth.guard.ts` — Removed duplicate `OptionalAuthGuard` class
- `src/auth/optional-auth.guard.ts` — Now the single source of truth for `OptionalAuthGuard`
- `src/forum/forum.controller.ts` — Updated import to use `optional-auth.guard`; added `Math.min(100, ...)` limit cap; fixed `getTrendingManga` parseInt; added `fs.unlink` temp file cleanup in both upload handlers; added `import * as fs`
- `src/forum/forum.service.ts` — Added `file-type` magic-byte validation for uploads (replaces client-header check); `listComments` `.limit(500)` cap; `createComment` parent check adds `.is('deleted_at', null)`; replaced all `throw new Error()` with `InternalServerErrorException`; fixed `String(err)` for unknown error types; `recalculateVotes` now uses `recalculate_votes_atomic` RPC
- `src/forum/forum-events.service.ts` — Wrapped `redis.publish` in try/catch; guarded `next()` with `!postSubject.closed`
- `src/wallet/wallet.service.ts` — Replaced `addCoins`/`spendCoins` with atomic Supabase RPC calls; removed TOCTOU `getOrCreateWallet` (upsert now handled inside RPC); all `throw new Error()` → `InternalServerErrorException`
- `src/wallet/wallet.controller.ts` — Added DEV ONLY comment to `/wallet/topup` endpoint
- `src/unlock/unlock.service.ts` — Restructured `purchaseUnlock` to insert unlock record BEFORE `processRevenueSplit`; rolls back unlock on payment failure
- `supabase-migration.sql` — Added Section 8: `add_coins_atomic`, `spend_coins_atomic`, `recalculate_votes_atomic` RPC functions

### Spec Files (fixed to compile)
- `src/forum/forum.controller.spec.ts` — Updated `OptionalAuthGuard` import to `optional-auth.guard`
- `src/forum/forum.service.spec.ts` — Added 3rd constructor arg + `rpc` mock to `makeService`
- `src/wallet/wallet.service.spec.ts` — Rewrote to test new RPC-based `addCoins`/`spendCoins`; removed `getOrCreateWallet` tests

### DB (Supabase MCP applied live)
- `atomic_wallet_and_vote_rpcs` migration — `add_coins_atomic`, `spend_coins_atomic`, `recalculate_votes_atomic` created
- `update_wallet_rpcs_with_balance_after` migration — Updated RPCs to include `balance_after` and `reference_id` in transaction insert

### Package
- `file-type` installed in Backend (`npm install file-type`)

### Verified & Hardened (Pre-Phase 2 Audit)
- **Soft Deletion:** Verified `deleted_at` implementation in `forum.service.ts` across 9 points (Update & Filter).
- **Spoiler Blur:** Verified `spoiler` category integration in `PostCard`, `PostDetail`, and `Community` page with blur filters and click-to-reveal logic.

## What Was NOT Changed
- Pre-existing spec errors in `hardware-id.middleware.spec.ts`, `unlock.controller.spec.ts`, `wallet.controller.spec.ts` (INestApplication import) — out of scope
- Storage-before-DB order in uploadBanner/uploadImage — was already correct

## Gemini Re-review Suggestions
- `file-type` magic-byte validation: verify CJS interop on deployed Node version
- `recalculate_votes_atomic` RPC: confirm `data[0]?.upvotes` always populated after UPDATE
- `unlock.service.ts` rollback: best-effort delete — consider logging if rollback also fails

---

## ✅ Phase 1.5 Completion Verification (2026-05-27)

### Phase 1.5 Status: COMPLETE

#### Community Forum (PR #9 — merged 2026-05-27)
- `Frontend/app/community/layout.tsx` — Shared layout + mobile drawer
- `Frontend/app/community/trending/page.tsx` — Trending manga grid
- `Frontend/app/community/manga/[mangaId]/page.tsx` — Manga community feed
- `Frontend/app/community/profile/[uid]/page.tsx` — User profile page
- `Frontend/app/components/ForumSideMenu.tsx` — Sidebar navigation
- `Frontend/app/components/PostCard.tsx` — Reddit compact view + spoiler transitions
- `Frontend/app/components/SmoothScrolling.tsx` — Scroll reset on pathname change
- `Frontend/app/community/page.tsx` — Bottom sheet modal animation
- `Frontend/app/community/p/[id]/page.tsx` — Sticky header, spoiler fade, XSS fix
- `Frontend/app/lib/communityApi.ts` — Round position before send
- `Backend/src/forum/forum.dto.ts` — @IsNumber replaces @IsInt

#### Task A — Creator Earnings API + UI (pre-existing, verified complete)
- `Backend/src/wallet/wallet.service.ts` — `getCreatorEarnings(uid)` queries `translator_earnings` VIEW; returns zero values when no row exists
- `Backend/src/wallet/wallet.controller.ts` — `GET /wallet/earnings` with AuthGuard
- `Frontend/app/lib/studioApi.ts` — `CreatorEarnings` type + `getCreatorEarnings(token)`
- `Frontend/app/studio/wallet/page.tsx` — Earnings section visible only for translator/creator roles

#### Task B — HWID Middleware Enforcement (pre-existing, verified active enforcer)
- `Backend/src/common/middleware/hardware-id.middleware.ts` — Active enforcer: rejects 401 `{ statusCode: 401, message: 'Missing hardware ID' }` for protected routes; warns at logger level; whitelist covers auth/forum/wallet/public browse

### What Was NOT Changed (Phase 1.5 close-out)
- `supabase-migration.sql` — translator_earnings VIEW already existed, no migration needed
- Any file in `Documents/`, `unlock.service.ts`, `books/*`

### Notes for Gemini
- Phase 1.5 is fully closed — all 4 pillars (Forum, HWID, Earnings, Zero-Trust) verified in codebase
- Ready to begin Phase 2 planning (Architectural Scaling & Cloud Readiness)

---

## ✅ Phase 2 — 2-Layer Cache Upgrade (Branch: feat/2-layer-cache-upgrade, Commit: ad72574)

### Phase 2 Cache Status: IMPLEMENTED — Pending PR

#### New Files
- `Backend/src/status/metrics.service.ts` — Node heartbeat: CPU sampling (500ms), freeMem, Supabase HEAD ping, publishes `cluster_metrics:{nodeId}` ทุก 10s (ยิงทันทีตอน startup ด้วย)
- `Backend/src/status/election.service.ts` — Redis NX Lock election: `SET cache:leader NX PX` สำหรับ acquisition, `SET XX PX` สำหรับ renewal ทุก 15s, LEADER_TTL = 37.5s (2.5× interval)
- `Backend/src/cache/batch-sync.worker.ts` — Reliable Queue: `RPOPLPUSH cache:dirty cache:processing` → sync → `LREM` ack; crash recovery ด้วย `LRANGE cache:processing` บน onModuleInit; leader-only guard ใน flush()
- `Backend/src/status/metrics.service.spec.ts` — 2 tests: startup publish, interval tick
- `Backend/src/status/election.service.spec.ts` — 7 tests: NX acquisition, contention, renewal, failover, logging
- `Backend/src/cache/batch-sync.worker.spec.ts` — 8 tests: rpoplpush, lrem ack, crash recovery, markDirty, corrupt data

#### Modified Files
- `Backend/src/cache/cache-orchestrator.service.ts` — write-behind set(): Redis write + markDirty; ลบ DEFAULT_TTL_SEC (dead code); ลบ markDirty จาก setMangaCacheWithTiers
- `Backend/src/cache/cache.module.ts` — import StatusModule, register BatchSyncWorker
- `Backend/src/status/status.module.ts` — register + export MetricsService, ElectionService

#### Key Architecture Decisions
- **Leader Election:** Redis NX Mutex แทน metric scoring — ป้องกัน split-brain และ leader thrashing
- **Reliable Queue:** RPOPLPUSH+LREM แทน LPOP — ป้องกัน data loss เมื่อ leader crash กลางคัน
- **MetricsService:** เก็บ CPU/mem/latency เพื่อ observability เท่านั้น ไม่ใช้ตัดสิน leadership
- **METRICS_STALE_MS:** 35,000ms (เพิ่ม 5s buffer จาก Redis TTL 30s)

#### What Was NOT Changed
- `books/*`, `forum/*`, `unlock.service.ts`, `wallet/*` — out of scope
- BullMQ / Supabase Edge Function — over-engineering สำหรับ stage นี้
- Pub/Sub cross-node L1 sync — scaffolding สำหรับ Phase 3

#### Bugs Found by TDD
- `flush()` เช็ค `isLeader` แค่ใน interval callback — แก้: ย้าย guard เข้าใน flush() เอง
- `onModuleInit()` ของ BatchSyncWorker ต้องเป็น `async` เพื่อให้ crash recovery เสร็จก่อน interval เริ่ม

#### Test Count: 134 passing (เพิ่มจาก 117 → 134)

#### Notes for Gemini
- Phase 2 Cache branch พร้อม review ก่อน merge — รอ PR
- `cache:processing` list ควร empty ตลอดในสภาวะปกติ; non-empty หลัง flush cycle = WARN signal
- Dirty queue consumer (syncKey → JsonCache) ยังเป็น scaffolding; Supabase RPC handlers จะเพิ่มทีละ feature ใน Phase 2 ถัดไป

---

## ✅ Phase 2b — Issue #13: L3DiskService Extraction (TDD, Branch: feat/2-layer-cache-upgrade)

### Status: COMPLETE — 147 tests passing

#### New Files
- `Backend/src/cache/l3-disk.service.ts` — Deep module สำหรับ disk I/O ทั้งหมด: `write(key, entry)` (sanitize filename + embed original key) + `readAll(): Map` (skip corrupt, swallow errors); รับ cacheDir ผ่าน `@Optional() @Inject('L3_CACHE_DIR')` เพื่อ testability
- `Backend/src/cache/l3-disk.service.spec.ts` — 5 tests: empty dir, round-trip, key sanitization, corrupt JSON skip, disk error swallow
- `Backend/src/cache/json-cache.service.spec.ts` — 3 tests: `set()` ไม่เขียน disk, `syncEntry()` ไม่เขียน disk, `onModuleInit()` warm L1 จาก L3

#### Modified Files
- `Backend/src/cache/json-cache.service.ts` — **แก้ bug หลัก**: ลบ `writeToDisk()` ออก + `set()` / `syncEntry()` เป็น in-memory เท่านั้น + `onModuleInit()` ใช้ `l3.readAll()` แทน direct `fs.readdirSync`; constructor รับ `L3DiskService` ผ่าน DI
- `Backend/src/cache/cache.module.ts` — เพิ่ม `L3DiskService` เป็น provider (ก่อน `JsonCacheService` เพราะ DI dependency)

#### Key Fix (from grill session 2026-05-28)
**Bug:** `JsonCacheService.set()` เรียก `writeToDisk()` ทุก L1 update — disk I/O overflow เพราะ L1 update บ่อยมาก
**Fix:** L3 (disk) เขียนโดย `L3DiskService.write()` เท่านั้น ซึ่งจะถูกเรียกโดย `L3BatchWriter` (Issue #14) ตาม Flush Frequency ต่อ data type — ไม่เคยเขียนใน `set()` path

#### Test Count: 147 passing (เพิ่มจาก 139 → 147)

#### What Was NOT Changed
- `CacheOrchestratorService` — interface `set()`/`syncEntry()` เหมือนเดิม
- `BatchSyncWorker` — `syncEntry()` ยังทำงานปกติ (ตอนนี้ update L1 in-memory เท่านั้น — correct)
- `batch-sync.worker.spec.ts` — mock `JsonCacheService` ไม่ได้รับผลกระทบ

---

## ✅ Phase 2b — Issues #14+#15: L3BatchWriter + Leader flush wire (TDD)

### Status: COMPLETE — 155 tests passing

#### New Files
- `Backend/src/cache/l3-batch-writer.ts` — periodic L2→L3 batch บนทุก node; FLUSH_CONFIG: wallet: 2s, stats: 5s, default: 60s; fires immediate flush on startup; skips L2-missing keys; skips when Redis unavailable
- `Backend/src/cache/l3-batch-writer.spec.ts` — 6 tests: startup flush, L2 miss skip, wallet 2s interval, manga only at 60s, destroy stops intervals, Redis unavailable

#### Modified Files (#15)
- `Backend/src/cache/batch-sync.worker.ts` — `syncKey()` ตอนนี้เรียก `l3.write(key, entry)` แทน `jsonCache.syncEntry()`; inject `L3DiskService` แทน `JsonCacheService`
- `Backend/src/cache/batch-sync.worker.spec.ts` — อัปเดต mock ใช้ `L3DiskService`; assertions เปลี่ยนจาก `jsonCache.syncEntry` เป็น `l3.write`
- `Backend/src/cache/cache.module.ts` — เพิ่ม `L3BatchWriter` provider

#### Final Write-behind Architecture
```
set(key)  →  L1 in-memory  →  L2 Redis  →  markDirty

L3BatchWriter (all nodes):   L2 → L3  (per Flush Frequency per type)
BatchSyncWorker (Leader):    L2 → L3  (re-sync before future Supabase write)
```

#### Design Note (per grill)
- `L3DiskService.write()` swallows disk errors — L3 = best-effort backup
- Ack (lrem) always happens after write attempt; JSON parse fail = no ack (retry)
- `L3BatchWriter` re-attempts on next cycle ถ้า disk ชั่วคราว unavailable

#### Test Count: 155 passing (เพิ่มจาก 147 → 155)

---

## ✅ Phase 2c — Issues #18–#21: Dirty Queue Bug Fixes (TDD, Branch: feat/2-layer-cache-upgrade)

### Status: COMPLETE — 161 tests passing (Commits: bba4a76, 6154a2d)

#### Context
PR #16 scrutiny (Issues #17 PRD) found 3 major bugs + 1 minor in the dirty-queue path. Broken into 4 issues (#18–#21) and fixed via TDD.

#### Fixes

**Issue #18 — Processing queue leak (bba4a76)**
- `recoverOrphans()` previously called `lrange` → `del` → individual `rpush` per key
- Missing: `del` was never called → orphans piled up in `cache:processing` across restarts
- Fix: Added `del(PROCESSING_QUEUE)` before `rpush` loop
- Tests: "clears cache:processing with DEL before re-queuing"; "does not call DEL when empty"

**Issue #19 — Expired key orphan (bba4a76)**
- `syncKey()` silently skipped when L2 key expired (`if (!raw) return;`)
- Expired key stayed in `cache:processing` forever → permanent orphan after crash
- Fix: `await client.lrem(PROCESSING_QUEUE, 1, key)` before early return
- Tests: "calls lrem to ack even when key is expired in L2 — prevents permanent orphan"

**Issue #20 — Shutdown durability (bba4a76)**
- `onApplicationShutdown()` was syncing L1↔L2 timestamps — useless (in-memory data lost on exit)
- Fix: replaced with `l3BatchWriter.flush()` — actually persists to disk before exit
- `CacheOrchestratorService` now takes `L3BatchWriter` as 4th constructor param
- `setMangaCacheWithTiers()` now calls `markDirty()` (was missing from write-behind path)
- New spec: `cache-orchestrator.service.spec.ts` (4 tests)
- Tests: "calls l3BatchWriter.flush() on graceful shutdown"; "does not call jsonCache.syncEntry() on shutdown"

**Issue #21 — Non-atomic crash recovery (6154a2d)**
- DEL → RPUSH sequence has a crash window where keys can be silently dropped
- Fix: single `RECOVER_SCRIPT` Lua EVAL — LRANGE + DEL + RPUSH atomically in one round-trip
- Follows RENEW_SCRIPT / DELETE_SCRIPT pattern from ElectionService
- Logs count only (not per-key) since keys not iterable client-side after Lua exec
- Tests: "uses EVAL to atomically move orphans"; "does not call DEL or RPUSH directly during recovery"

#### Architecture Decisions
- **Lua CAS pattern** for all atomic multi-step Redis operations: RENEW_SCRIPT (election renewal), DELETE_SCRIPT (lock release), RECOVER_SCRIPT (crash recovery)
- **R2 for translated manga images**, Supabase for structured metadata → `setMangaCacheWithTiers()` now participates in write-behind (markDirty)
- **L3BatchWriter.flush()** is the correct shutdown hook — L1 sync was a false guarantee

#### Test Count: 161 passing (เพิ่มจาก 155 → 161, -1 test cleanup)

#### Notes for Gemini
- All 4 issues (#18–#21) closed; PR #16 branch (`feat/2-layer-cache-upgrade`) ready for final review and merge
- `RECOVER_SCRIPT` Lua script named constant lives in `batch-sync.worker.ts` alongside the queues it uses
- `cache-orchestrator.service.spec.ts` is a new file added alongside the orchestrator source

---

## ✅ Phase 2.4–2.5 — Cache Hardening (2026-05-29, PRs #60 / #61 closed)

### Status: COMPLETE — 277 tests passing

---

### Phase 2.4 — CatastrophicRecoveryService (#38)

#### New Files
- `Backend/src/cache/catastrophic-recovery.service.ts` — `OnModuleInit`: เมื่อ Redis ไม่ขึ้นตอน boot → อ่าน L3 → เปรียบเทียบ timestamp ต่อ key กับ Supabase (batch 100) → buffer winners → register reconnect callback (fire-once); `pushToL2()`: jitter 0–5s + pipeline chunk 500
- `Backend/src/cache/catastrophic-recovery.service.spec.ts` — 18 tests: T1-T10 (core + fire-once), S1-S5 (Supabase comparison), D1-D3 (smart dirty queuing)

#### Modified Files
- `Backend/src/cache/batch-sync.worker.ts` — `syncKey()` RPC params เปลี่ยนจาก `{ p_key, p_entry }` → `{ p_key, p_data, p_updated_at, p_ttl_ms }` (conditional upsert)
- `Backend/src/cache/batch-sync.worker.spec.ts` — เพิ่ม U1-U2: verify correct RPC param shape; `p_entry` absent
- `Backend/src/cache/cache.module.ts` — register `CatastrophicRecoveryService`

#### Key Architecture Decisions
- **Smart Dirty Queuing:** `source: 'l3' | 'supabase'` tracking — skip RPUSH เมื่อ Supabase wins (data อยู่ DB แล้ว) → เฉพาะ L3 winners เท่านั้นที่ต้อง re-sync
- **Fire-once callback:** `onReconnect()` return `unregister fn` → เรียกหลัง push สำเร็จครั้งแรก → ป้องกัน stale L3 data ทับ L2 บน reconnect ครั้งที่ 2+
- **Thundering herd:** jitter `Math.random() * 5000ms` ก่อน pipeline push
- **Supabase fallback:** ถ้า Supabase unavailable → ใช้ L3-only winners (log WARN)

#### Scrutinize Finding Fixed (post-PR)
- **Blocker:** `onReconnect` callback ไม่ unregister → push stale boot-time L3 data ทับค่าใหม่กว่าใน L2 บน reconnect ครั้งที่ 2
- **Fix (commit bcfd68d):** `const unregister = this.redis.onReconnect(() => this.pushToL2(winners).then(() => unregister()).catch(...))`
- **T10 test:** verify `unregister()` ถูก call exactly once หลัง push สำเร็จ

---

### Phase 2.4+ Round 1 — BatchSyncWorker Retry Budget + Dead-letter (#64–#66)

#### Modified Files
- `Backend/src/cache/batch-sync.worker.ts`
  - Export: `MAX_RETRIES = 5`, `RETRY_COUNTS_KEY = 'cache:retry_counts'`, `DEAD_LETTER_SET = 'cache:dead_letter'`
  - On RPC fail: `HINCRBY cache:retry_counts <key> 1`; if count >= MAX_RETRIES → `SADD cache:dead_letter <key>` + `LREM` + `logger.error`
  - On RPC success: `HDEL cache:retry_counts <key>` ก่อน `LREM`
  - On L2 expiry: `HDEL cache:retry_counts <key>` ป้องกัน stale counter สะสม
- `Backend/src/cache/batch-sync.worker.spec.ts` — เพิ่ม 6 tests R1-R6

#### Key Architecture Decision
- Keys ที่ fail Supabase ซ้ำๆ วนลูป dirty→processing→dirty ไม่มีที่สิ้นสุด → ระบบ retry budget + dead-letter set ป้องกัน single bad key กิน flush budget ทั้งหมด
- Dead-lettered keys inspectable ด้วย `SMEMBERS cache:dead_letter`; re-queue ด้วย `SMOVE cache:dead_letter cache:dirty <key>`

---

### Phase 2.4+ Round 2 — mangaId Propagation in Stats Pipeline

#### Modified Files
- `Frontend/app/components/MangaReader.tsx` — สร้าง URL ด้วย `URLSearchParams` รวม `?mangaId=` param เมื่อ prop มีค่า

#### Context
- `StatsIncrementService.recordChapterView()` ตั้ง `stats:chapter:{id}:manga:{date}` key ถูกต้องอยู่แล้ว
- `BooksController.getMangaChapterPages()` รับ `@Query('mangaId')` อยู่แล้ว
- ปัญหา: `MangaReader.tsx` ไม่ส่ง `?mangaId=` ทำให้ `manga_id` ใน `chapter_daily_stats` เป็น `''` เสมอ
- ทุก component caller (`BookDetailModal`, `ContinueReadingRow`, `MangaGrid`, `BookRow`) ส่ง `mangaId={book.id}` ครบแล้ว

---

### Phase 2.4+ Round 3 — Timer Hygiene + Cache Health Endpoint (#67–#69)

#### New Files
- `Backend/src/cache/cache-health.service.ts` — `getHealth(): Promise<CacheHealthSnapshot>`: LLEN dirty/processing, SCARD dead_letter, L3 keyCount, isLeader; คืน 0 ทุกตัวเมื่อ Redis unavailable
- `Backend/src/cache/cache-health.service.spec.ts` — 6 tests H1-H6

#### Modified Files
- `Backend/src/cache/batch-sync.worker.ts` — `.unref()` บน `setInterval` timer
- `Backend/src/cache/stats-flush.worker.ts` — `.unref()` บน `setInterval` timer
- `Backend/src/cache/redis.service.ts` — เพิ่ม `llen(key)` + `scard(key)` methods
- `Backend/src/cache/l3-disk.service.ts` — เพิ่ม `keyCount()` → count `.json` files ไม่ parse JSON
- `Backend/src/cache/cache.module.ts` — register + export `CacheHealthService`
- `Backend/src/status/status.controller.ts` — `GET /status/cache` → `CacheHealthService.getHealth()`

#### Key Architecture Decisions
- **Timer `.unref()`:** ป้องกัน Jest process leak warning; production ไม่มีผลกระทบ
- **`GET /status/cache`:** เปิดเหมือน `/status/stream` (ไม่มี auth guard) — ข้อมูลไม่ sensitive
- **`CacheHealthService`:** deep module — dependency inject ได้, mock ได้ง่าย, interface ไม่เปลี่ยน

---

### Test Count: 277 passing (เพิ่มจาก 265 → 277)

| Batch | Tests Added |
|-------|------------|
| T1-T10 (CatastrophicRecovery core + fire-once) | +10 |
| S1-S5 (Supabase comparison) | +5 |
| D1-D3 (smart dirty queuing) | +3 |
| U1-U2 (RPC param shape) | +2 |
| R1-R6 (retry budget + dead-letter) | +6 |
| H1-H6 (cache health service) | +6 |

### Notes for Gemini
- PR #60 (feat/cache-phase-2-4) ปิดแล้ว — งานทั้งหมดรวมอยู่ใน PR ใหม่
- `cache:dead_letter` Redis Set ควร empty เสมอในสภาวะปกติ; non-empty = signal ว่ามี key ที่ต้องตรวจสอบ Supabase schema/constraint
- `GET /status/cache` endpoint: operator ใช้ตรวจสอบ queue depths; ไม่มี auth เหมือน `/status/stream`
- `L3DiskService.keyCount()` นับแค่ไฟล์ ไม่ parse JSON — ถูกใช้เฉพาะ health snapshot, ไม่กระทบ critical path
- `mangaId` ใน `chapter_daily_stats` จะมีค่าถูกต้องตั้งแต่ session นี้เป็นต้นไป; ข้อมูล historical ที่มี `''` ยังอยู่ใน DB แต่ไม่กระทบ future data

---

## ✅ Translation System Overhaul (2026-06-04, Session: Claude + Gemini multi-perspective)

### Status: COMPLETE (backend) — Batch refactor (Option A') pending

#### Bugs Fixed & Tested (issues #73–#78, all closed)
- **#73** `startOrAttachBatchJob`: `.finally()` deleted job before webhooks arrived → replaced with `try/finally` + 15-min timeout + abort-signal listener
- **#74** `handleMitCallback`: raw pixel coords stored as percentages → normalized with `imgWidth/imgHeight`; patch URL uses `backendOrigin`
- **#75** HMAC mismatch (Python spaces vs JS compact) → `json.dumps(separators=(',',':'), ensure_ascii=False)`; NestJS length-checks before `timingSafeEqual`
- **#76** Idempotency race in `handleMitCallback` → `processingPages: Set<number>` locks synchronously before any `await`
- **#77** Latecomer listener added after replay loop → add before iterating `completedPages`
- **#78** TOCTOU in `startOrAttachBatchJob` → register placeholder in `activeBatchJobs` before first `await cache.get()`

#### Dead Code Removed (#81, closed)
- `BooksService.translateMangaPage()` — full-image path (never called by frontend)
- `BooksController POST /chapters/:id/pages/:idx/translate` — endpoint removed
- `Frontend translateMangaPage()` — exported but never imported

#### Other Fixes (#82–#84, closed)
- **#82** `_retryMissingPagesIndividually` now accepts `AbortSignal`; passes `maxStartupRetries:3` to limit fallback wait from 150s → 15s per page
- **#83** `checkMitHealth` calls `/ready` (not root `/`); MIT server gains `/ready` endpoint returning 503 until first worker registered
- **#84** `fetchAvailableMangaModels()` fetches from `/api/proxy/books/models` with 5-min cache + hardcoded fallback

#### New Issues Created
- **#85** fix: `translateMangaEpisode` hardcodes Thai — add `targetLang` parameter
- **#86** feat: expand target language options to all 17 MIT-supported languages
- **#87** PRD: user-selectable Gemini model for MIT image translation

#### Architecture Decision: Option A' (Redis pub/sub batch translation)
After Gemini 10-perspective scrutiny + roadmap comparison:
- Option A (in-memory job registry) — compliant but 6 bugs stem from Map-based state
- Option B (sync NDJSON only) — simpler but violates Roadmap Fire-and-Forget + Pillar 4
- Option C (sequential+cache) — violates Pillar 4 and Phase 2 GPU cloud requirement
- **Option A' chosen**: replace `activeBatchJobs` Map with Redis pub/sub; `handleMitCallback` = `cache.set` + `redis.publish`; eliminates all 6 bug classes without losing fire-and-forget/webhook pattern

#### Test Count: 299 passing (was 295)

#### Notes for Gemini
- `books-batch-webhook.spec.ts` (13 tests) + `books-retry.spec.ts` (2) + `books-health.spec.ts` (2) + `mit-webhook-hmac.spec.ts` (3) added
- Option A' implementation issue pending — will replace `startOrAttachBatchJob` (~500 lines) with Redis pub/sub (~50 lines)
- `processingPages: Set<number>` added to `BatchJobState` interface (temporary, removed with Option A')

---

## 🛠️ V5 Final Hardening (Commit 69712f9)
- **Error Handling:** เปลี่ยน `throw new Error()` เป็น `InternalServerErrorException` ทั้งหมดใน `UnlockService` เพื่อมาตรฐานความปลอดภัย
- **Runtime Validation:** ติดตั้ง `forum.dto.ts` และเปิดใช้งาน `ValidationPipe` (class-validator) แบบ Global ใน `main.ts` ป้องกัน Payload ที่ผิดโครงสร้าง
- **Test Integrity:** แก้ไข `forum.controller.spec.ts` ให้ Mock ข้อมูลตรงตาม Contract จริง `{ items, total }`
