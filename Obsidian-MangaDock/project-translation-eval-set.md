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

## กฎ

1. ก่อนสรุปเรื่องคุณภาพคำแปล ต้องบอกว่า corpus เป็นภาษาอะไร และ production path ตรงกันหรือไม่
2. judge เป็นโมเดลเดียวกับผู้แปล → เชื่อถือได้ระดับความหมาย, micro-style เป็น noise
3. ถ้าจะปรับ prompt/sample/temperature ต่อ ต้องมี **ชุดประเมิน JP→TH จริง** ก่อน

เกี่ยวข้อง: [[project-art-text-handling]] · [[feedback-verify-before-claiming]] · [[feedback-benchmark-md-report-with-image]]
