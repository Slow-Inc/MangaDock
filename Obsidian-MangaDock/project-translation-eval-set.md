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
- **Judge typo noise ~30%:** judge ลดคะแนนให้สตริงที่เหมือนกัน (`ฉัน→ฉัน`) = Thai tokenizer artefact. ใช้ `MIT/tools/audit_summary.py` แยก noise → บน 480 segment: raw **1.44/2** → **adjusted 1.70/2**, distribution **10/125/345 = broken 2.1% / partial 26% / perfect 72%**. Quote ค่า adjusted เสมอ
- **Final end-state baseline (2026-10-23, 39-page sweep, 367 segment):** raw **1.44/2** → **adjusted 1.68/2**, distribution **11/97/259 = broken 3.0% / partial 26.4% / perfect 70.6%**; 1 หน้าไม่มี segment ที่ judge ให้คะแนนได้ (all-filtered)
- Final full-corpus sweep (39/39 หน้า, defaults สุดท้าย): **guard ยิงจริง 9 ครั้ง** (foreign_script 3, content_loss 3, untranslated_word 2, dropped_question 1) และ **leftover 0**; gate เหลือ 2 (dropped_! nuance + name inconsistency ที่ต้องมี series_context); wall avg 7.65s / median 6.96s

### Guard inventory (default ON ทั้งหมด, มี env ปิด)
- `foreign_script` + leaked-script salvage (#903) · `negation_lost` (#898) · `runaway` (#901) · `spurious_filler` (#1039) · `lost_as_rare` (#1052) · `dropped_question` (#1056) · `untranslated_word` (#1057) · `content_loss` (#1058) · numbered-contract (#1026) · series name memory (#980)
- ต้นทุนรวมทุก predicate: **0.025 ms/segment, 0.43 ms/หน้า** — คุณภาพไม่แลกความเร็ว; จ่ายเฉพาะ retry เมื่อยิง
- วินัย: predicate → trigger (`_is_glitched`) → note (`_modify_invalid_translation_query`) + direct trigger test; default ต้องมี **forced-injection proof** (`tools/forced_guard_bench.py`) หรือ natural sweep; threshold อิงหางที่วัด (content_loss 0.45 vs p10 0.66)

### Performance ที่ตัดสินแล้ว
- **Default ON:** source-language filter ย้ายไปหลัง `_strip_source_noise` ก่อน translation (#1051): replay byte-identical + translation 3.62→2.12s
- **Opt-in:** batch pipeline (#905) วัดได้ 1.46× + ชื่อสม่ำเสมอ แต่ไม่มี per-page progress; preload (#1047 หน้าแรก 21.5→18.1s); widen columns (#1006); segment retry (#1055 20-25% เร็วขึ้นแต่เสี่ยง context)
- **Rejected with evidence:** detection_size 2048 (region sets เปลี่ยน = recall change), 3200 (คุณภาพ), in-page mask/inpaint overlap (#1050 ปิดเป็น superseded — batch pipeline overlap อยู่แล้ว), JP rhetorical prompt (A/B ไม่ต่าง), hedging guard (FP สูง), exclamation guard (เจอ 2/15,578 segment)

### เอกสารอ้างอิง
- `docs/reports/benchmarks/2026-10-23-*.md` (quality-loop-status, final-corpus-sweep, judge-noise-adjusted-profile, guard-cost-and-gate-dashboard, prod-wiring-verification, 1057/1058 guards, 1050-overlap-decision, jp-prompt-ab, detection-size-ab)
- `DONE.md` entries round 87–120 = ลำดับงานทั้งหมดของลูป
