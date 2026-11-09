---
name: project-translation-eval-set
type: project
description: How MIT Thai translation quality is measured (tool, baseline, blind A/B protocol) and the EN-corpus / JP-production language gap that limits every translation conclusion.
---

# ชุดวัดคุณภาพคำแปลไทยของ MIT (และข้อจำกัดเรื่องภาษา)

## เครื่องมือ

- `MIT/tools/judge_translations.py` — ให้คะแนน faithfulness 0-2 ต่อ segment (ผ่าน gateway เดียวกับ production, chunk 6 segment เพื่อไม่ให้ชน token budget)
- `MIT/tools/translation_ab.py` — translate (สอง arm จาก gpt_config YAML) → packet (blind ต่อหน้า) → tally
- judge pairwise: `tmp/judge_pairwise_generic.py` ในเซสชัน (chunked, ตอบ X/Y/T)

## Baseline (2026-10-22)

39 หน้า corpus (372 segment): **mean 1.51/2**, perfect 54%, minor 43%, broken 3%
วันที่แย่สุด: Iruma p1 0.88, Taida/Kage/Kumo/Otome/Tsuki หน้า p1 = 1.00

## ข้อจำกัดสำคัญ: corpus EN→TH แต่ production JP→TH

Corpus ใน repo เป็นหน้า scanlation **อังกฤษ** แต่ path production ของตอนญี่ปุ่นคือ **JP→TH** (few-shot ไทย
ที่ฝังมาเป็น JP→TH) → ผล A/B คำแปลทั้งหมด (prompt v3 แพ้ 6-2, temperature 0 แพ้ 7-4, concise เสมอ 5-5,
few-shot EN แพ้ 5-7) วัด path EN→TH เท่านั้น **ห้ามเหมาว่าใช้กับ JP→TH**

## HEAD audit (2026-10-22, round 52)

- EN→TH สดที่ HEAD: **113 segment, mean 1.55/2** (58% perfect / 40% minor / 3% broken) — baseline เดิม 1.51/372
- JP→TH 2 หน้าจริง: **14 segment, mean 1.64/2**, inversion 0 (baseline 1.57 มี 1)
- guard ที่เพิ่มในลูป (#898 negation, #901 runaway, #903 script leak) ไม่มีต้นทุนคุณภาพ
- defect ที่เหลือเป็น **model ceiling**: stammer/fragment hallucination (`I- I DONT WANT THEM.` -> `ท้องไม่`, `W-` -> `ฉ-`) — guard แบบ deterministic จับไม่ได้
- **ข้อจำกัด:** gateway มีโมเดลเดียว (`qwen3.8-27b-fp8`) → judge = translator; ไม่มี independent judge ใน environment นี้

## Null calibration (2026-10-22, #902)

รัน config เดียวกันสองครั้งบน 11 หน้า (ต่างแค่ sampling) แล้ว judge แบบ blind: **โหวตระดับหน้า A 8 / B 3**, ระดับ
segment **50 / 37 / tie 29** (50/87 = 57.5% ≈ +1.4σ) → **margin ≤5 หน้าใน 11-12 หน้า = noise**
ผล A/B คำแปลก่อนหน้าทั้งหมด (few-shot 7-5, temperature 7-4, concise 5-5, JP prompt 2-2) แยกจาก noise ไม่ได้
→ ทุกครั้งจบด้วย "ไม่เปลี่ยน default" ซึ่งถูกต้อง

**กฎใหม่:** A/B คำแปลต้อง ≥40 หน้า หรือรันซ้ำหลายรอบรวมผล หรือใช้จำนวน segment ที่ตัดสินได้ + binomial check

## กฎ

1. ก่อนสรุปเรื่องคุณภาพคำแปล ต้องบอกว่า corpus เป็นภาษาอะไร และ production path ตรงกันหรือไม่
2. judge เป็นโมเดลเดียวกับผู้แปล → เชื่อถือได้ระดับความหมาย, micro-style เป็น noise
3. ถ้าจะปรับ prompt/sample/temperature ต่อ ต้องมี **ชุดประเมิน JP→TH จริง** ก่อน

เกี่ยวข้อง: [[project-art-text-handling]] · [[feedback-verify-before-claiming]] · [[feedback-benchmark-md-report-with-image]]

- **JP corpus caveat (2026-10-23):** `result/jp/jp_chapter_p0.jpg` and `_p1.jpg` are byte-identical — the JP→TH baseline is one real page run multiple times, not two pages (same sha1, 343,806 bytes).

## Quality-loop consolidation (2026-10-23, branch `feat/mit-quality-loop`, PR #794)

### ตัวเลขที่ต้องใช้
- **Judge typo noise:** judge ลดคะแนนให้สตริงที่เหมือนกัน/ใกล้กัน = Thai tokenizer artefact. ใช้ `MIT/tools/audit_summary.py` แยก noise; classifier ถูก tighten ให้ถือ real pair = real finding (conservative) → 480 segment: raw **1.44/2**, adjusted **1.55 (strict) / 1.70 (lenient)**; 367 segment end-state: raw **1.44**, strict **1.55** (13/138/216 = broken 3.5% / partial 37.6% / perfect 58.9%) — quote ช่วง 1.55-1.70 พร้อม caveat
- **Final end-state baseline (2026-10-23, 39-page sweep, 367 segment):** raw **1.44/2** → strict-adjusted **1.55/2** (lenient 1.68), distribution **13/138/216 = broken 3.5% / partial 37.6% / perfect 58.9%**; 1 หน้าไม่มี segment ที่ judge ให้คะแนนได้ (all-filtered)
- Final full-corpus sweep (39/39 หน้า, defaults สุดท้าย): **guard ยิงจริง 9 ครั้ง** (foreign_script 3, content_loss 3, untranslated_word 2, dropped_question 1) และ **leftover 0**; wall avg 7.65s / median 6.96s
- **อัปเดต v3 (หลัง OCR pass + tag licence):** gate เหลือ **1 (`dropped_!` จริง)** + **leftover {}**; wall 8.03s (รันเดียว, variance)

### Guard inventory (default ON ทั้งหมด, มี env ปิด)
- `foreign_script` + leaked-script salvage (#903) · `negation_lost` (#898) · `runaway` (#901) · `spurious_filler` (#1039) · `lost_as_rare` (#1052) · `dropped_question` (#1056) · `untranslated_word` (#1057) · `content_loss` (#1058) · `consider_as_please` (2026-10-23, CONSIDER→กรุณา) · numbered-contract (#1026) · series name memory (#980)
- ต้นทุนรวมทุก predicate: **0.025 ms/segment, 0.43 ms/หน้า** — คุณภาพไม่แลกความเร็ว; จ่ายเฉพาะ retry เมื่อยิง
- วินัย: predicate → trigger (`_is_glitched`) → note (`_modify_invalid_translation_query`) + direct trigger test; default ต้องมี **forced-injection proof** (`tools/forced_guard_bench.py`) หรือ natural sweep; threshold อิงหางที่วัด (content_loss 0.45 vs p10 0.66)

### Performance ที่ตัดสินแล้ว
- **Default ON:** source-language filter ย้ายไปหลัง `_strip_source_noise` ก่อน translation (#1051): replay byte-identical + translation 3.62→2.12s
- **Opt-in:** batch pipeline (#905) วัดได้ 1.46× + ชื่อสม่ำเสมอ แต่ไม่มี per-page progress; preload (#1047 หน้าแรก 21.5→18.1s); widen columns (#1006); segment retry (#1055 20-25% เร็วขึ้นแต่เสี่ยง context)
- **Rejected with evidence:** detection_size 2048 (region sets เปลี่ยน = recall change), 3200 (คุณภาพ), in-page mask/inpaint overlap (#1050 ปิดเป็น superseded — batch pipeline overlap อยู่แล้ว), JP rhetorical prompt (A/B ไม่ต่าง), hedging guard (FP สูง), exclamation guard (เจอ 2/15,578 segment)\n- **Temperature 0.5 vs 0.2 (2026-10-23):** paired ทั้ง corpus — 0.2 raw 1.45/adj 1.58 + guard hits 10→6 เทียบ 0.5 raw 1.41/adj 1.51; แต่ paired page wins 17-12-8 อยู่ที่ noise boundary → **คง default 0.5**, เปิดเป็น opt-in `MIT_TEMPERATURE` (Backend → translator.temperature → ConfigGPT; absent = 0.5)

### เอกสารอ้างอิง
- `docs/reports/benchmarks/2026-10-23-*.md` (quality-loop-status, final-corpus-sweep, judge-noise-adjusted-profile, guard-cost-and-gate-dashboard, prod-wiring-verification, 1057/1058 guards, 1050-overlap-decision, jp-prompt-ab, detection-size-ab)
- `DONE.md` entries round 87–120 = ลำดับงานทั้งหมดของลูป

## Round 3 additions (2026-10-23 late) — OCR second pass + v3 state

### OCR second pass (default ON, `MIT_OCR_REREAD=0` ปิด)
- **Root cause:** detector box ที่ `detection_size 2560` ตัดขอบตัวอักษร (`F` ใน DEFEND) → 48px OCR อ่าน `DEEEND` → คำแปลกลายเป็นความหมายตรงข้าม (`ทำลาย` แทน `ปกป้อง`)
- **Fix:** re-read เฉพาะบรรทัดละตินที่ confidence < 0.75 ด้วย box pad 30% (pixel เดิม) รวม candidate ทั้งหน้าเป็น canvas เดียว → **1 model call/หน้า**; cap 8; รับค่าใหม่เมื่อ confidence ดีขึ้น ≥0.12
- **หลักฐาน:** text-level A/B 88% ของบรรทัดที่เปลี่ยนดีขึ้น (30/34); sweep: ~10% ของ source strings ถูกซ่อม, layout เปลี่ยน 1-2 หน้า (จาก merge), OCR stage +69ms/หน้า (batching; per-line version แพง +1.45s/หน้า)
- **Tools:** `MIT/tools/ocr_text_ab.py` (A/B OCR text ระหว่าง doctor dirs), `tools/acceptance` prod run 2 หน้า gate 0
- **Tuning record:** threshold 0.65→0.75 ให้ net +8 บรรทัดดีขึ้น (A/B 11/3/6, รันซ้ำ 10/4/6) ที่ +69ms/หน้า

### คลาสที่ทดสอบแล้วไม่สำเร็จ (อย่าสร้างซ้ำ)
- pad box ทุกหน้า (`MIT_OCR_BOX_PAD`): 45.7% source เปลี่ยน, 24/39 layout เปลี่ยน, A/B 25 vs 13 → **reject + ลบโค้ด**
- `unclip_ratio` 2.6: แก้ DEFEND ได้เฉพาะจุด แต่ 32.6% source/8 หน้า layout เปลี่ยน, judge parity → **default คง 2.3**
- same-crop re-read: ได้ junk (`TODe`) → ยืนยันว่าปัญหาอยู่ที่ box geometry ไม่ใช่ resolution

### Guard/gate consistency
- เพิ่ม licence **tag question** (`YKNOW/RIGHT/EH/HUH/OK/OKAY/HMM`) ให้ `dropped_question` **และ** gate ใช้ `is_tag_question` ตัวเดียวกัน → leftover เหลือ {} (เคสจริง: `..., YKNOW?` → `นะเนี่ย!` ไม่ใช่คำถาม)
- typo normalizer: `แล่ว/ไม/ให/ไมใช` แก้ token-level 219/15,590 region (1.4%), live-validated 0 occurrence; gate มี `common_typo`
- leak-script salvage ครอบ **22 scripts** (Arabic ฯลฯ) + `_TARGET_OWN_SCRIPTS` กันตัดสคริปต์ target; fast path ทำให้ guard cost 0.40ms/หน้า

### ตัวเลข v3 (ต้อง quote เป็นช่วง)
- raw **1.42–1.44/2**; strict-adjusted **1.53–1.60** (v7: broken 2.2% ต่ำสุด) (v2 dashboard 1.60; movement มาจาก noise-flag count 77 vs 138 ไม่ใช่หลักฐาน OCR gain)
- 39 หน้า / 369 region, leftover {}, gate 1 (`dropped_!`), wall 8.03s (run เดียว)
- defect คงเหลือ: model-ceiling sense/nuance ในบรรทัดที่ลื่น + ชื่อที่ `series_context` แก้ใน production

เกี่ยวข้อง: [[project-art-text-handling]] · [[feedback-verify-before-claiming]] · [[feedback-root-cause-before-fix]]
### v4 end state (2026-10-23, หลัง round 200) — gate 0 / leftover 0

- 39 หน้า / **365 region**, **gate violations 0**, **leftover 0** (foreign/content/typo/filler/rare), guard ยิง 5 ครั้ง
- wall avg **7.80s** / median **6.62s**; OCR (มี second pass) 1.63s/หน้า
- fix เพิ่มรอบท้าย: interjection ไม่ถูกนับเป็นชื่อ (`HEHE` เคยทำให้ series memory เรียน `HEHE→เข่า`), `ไม→ไม่` กันชื่อ Mai, OCR pass fail-open/float hardening, gate+guard ใช้ tag-question licence เดียวกัน
- ตัวเลข judge ยังคง raw **1.44** / strict-adjusted **1.55–1.60** (v4 ไม่ได้ re-judge; การเปลี่ยนกระทบเฉพาะ OCR source และ retry ที่หายาก)
- CI เขียวทุก job (Vercel เหลือ external rate limit); PR #794 draft/mergeable, base #642 ยังไม่ merge
- **`consider_as_please` (2026-10-23):** `CONSIDER BUYING ...` -> `กรุณาซื้อ...` (suggestion -> request) เกิด 2/6 renderings; predicate ตรวจ exact licence (src CONSIDER ไม่มี PLEASE, Thai กรุณา ไม่มี พิจารณา) — สแกน 19,327 regions เจอเฉพาะ 2 เคสจริง **FP 0**; natural run guard ยิงแล้ว retry ได้ `ลองพิจารณาซื้อฉบับพิมพ์`
### v5 end state + late fixes (2026-10-23, round 160s)

- **v5 sweep**: 39 หน้า/369 region, **leftover 0 ทุก scan**, **guard triggers 4 (ต่ำสุด)**, wall 7.80/6.62s; gate 3 จุดที่อธิบายครบ (lost `!` จริง 1, rhetorical retort ตั้งใจ, name variance ที่ series_context แก้)
- **series memory bug (#1065)**: `apply_glossary` เช็ค substring ทำให้ variant ที่มีชื่อเดิมฝังอยู่ (`ทสึคุโยมิ` มี `สึคุโยมิ` ข้างใน) ไม่ถูกแก้ → แก้เป็น token-level; production run ยืนยัน page 2 `applied 2 name fix(es)` และสะกดตรง page 1
- **Vercel deploy (#1064)**: docs function trace รูปใน `docs/` รวม 253MB → เกิน limit; เพิ่ม `outputFileTracingExcludes` ให้ `/docs` แล้ว deploy ผ่าน (คืนรูปต้นฉบับ)
- **omission pass (opt-in)**: schema 2 passes, replay proof clause กลับมา, clean-page FP 0/19, cost ~2 verifier requests + re-ask
- suite **989 passed**; PR #794: CI เขียว (Vercel ติด external quota เป็นช่วง)

### v6–v11 end state + latency/perf (2026-10-23 late)

- **sweeps v7–v11**: 39 หน้า / 369–371 region, dashboard **gate `{}` + leftover `{}` ทุกครั้ง** (หลัง re-scan ด้วย licence ล่าสุด); guard triggers 1–14 ตาม model window; wall 6.1–10.3s (retry-bound ใน window แย่)
- **judge**: raw **1.38–1.44/2** (window-dependent), strict-adjusted **1.53–1.60**, broken **2.2–2.4%** — ควร quote เป็นช่วง + โครงสร้าง (gate/lleftover) ไม่ใช่ run เดียว
- **latency win หลัก**: SFX vision calls batch concurrent + อัปโหลด 768px JPEG → `textline_merge` **32–37s → 8.4s**, หน้า SFX-heavy **54–68s → 26s** (quality-neutral จาก A/B); knob `MIT_RETRY_SUBSET_LAST` เป็น opt-in (A/B หน้า dense: คำตอบต่าง 4/9 → ไม่ promote)
- **OCR single-letter garble**: `N`→`NOT` (negation หาย) แก้ด้วย re-read + wider crop, 3/3 รัน; กัน garbled→garbled
- **precision licences ใหม่**: opinion tags (SEE/UNDERSTAND), URL/credit, digit-suffixed names (ZER0), strong negation, `นั่น`/`งั้นเหรอ` — ทำให้ gate/guard FP หมด
- **series memory** token-level (#1065) + production path re-verified (gate 0, applied 2 name fixes, spelling ตรงข้ามหน้า)
- **unseen validation**: 6 ซีรีส์ / 31 หน้า — 30/31 gated clean (ข้อยกเว้น = ชื่อ Latin ถูกต้อง); render spills 2 เคสบันทึกใน #642
- tests **997 passed**; CI (logic/heavy/backend) + Vercel เขียวหลาย head; merge vs main เหลือ conflict 3 docs; blocker เดียว **#642** (open draft, CONFLICTING)
- do-not-repeat: number guard, EN negation guard, temperature 0.2, attempt-3 subset default, panel downscale/micro-opt, OCR box pad, laughter normaliser