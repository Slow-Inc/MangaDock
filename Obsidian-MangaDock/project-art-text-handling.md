---
name: project-art-text-handling
type: project
description: How MIT handles stylised art text (logos, bubble-letter SFX) read as text - the three guards, which one wins, and the rule for adding a new one.
---

# Art text ที่ถูกอ่านเป็นข้อความ: guard สามตัวและลำดับความสำคัญ

Detection/OCR ของ MIT อ่านงานอาร์ต (โลโก้หัวเรื่อง, SFX ตัวพอง) เป็น textline ได้ และถ้าปล่อยให้แปลตรง ๆ
จะได้ junk ทับภาพ ตัวอย่างที่เจอจริงใน corpus 39 หน้า:

| อาการ | ตัวอย่าง | guard |
|---|---|---|
| translator สะกดชื่อตัวอักษร | `Siiig` -> `ซีไอไอ` | `is_letter_name_spelling` (#882) — drop, เก็บภาพ |
| glyph เดี่ยวขนาดอาร์ต (>=100 px) | โลโก้ `月が導く…` ถูกจับเป็น `月` -> `เดือน` | `is_oversized_art_glyph` (#886) — drop, เก็บภาพ |
| SFX ญี่ปุ่นที่ควรแปล | `ぬ`, `ドン` | vision rescue (`vlm_localize_sfx`, #168/#881) — แปลเป็นคำไทย |

**ลำดับความสำคัญ: rescue ชนะ guard ทุกตัว** — region ที่ `sfx_rescued=True` จะไม่ถูกมองเป็นอาร์ต


## SFX rescue: ลำดับ guard ทั้งหมด (อัปเดต 2026-10-22)

ก่อนจะเรียก vision gateway เพื่อ localize SFX ต้องผ่านทั้งชุดนี้ (ทั้งหมดอยู่ใน `ocr_vlm.py`):

1. `should_rescue_sfx(text, from_sfx, w, h, enabled)` — provenance det_sfx หรือขนาด/ความยาวผ่านเกณฑ์ + `ocr_read_real_text` (read ที่เป็นตัวอักษรจริง = ไม่ใช่ SFX)
2. `crop_has_lettering(crop)` — **std >= 75, พิกเซลเข้มมาก >= 12 %, และ component ของหมึก >= 2 อัน (>=1% ของ crop)**; ภาพว่าง/เส้นขอบ/เกราะ → ข้าม (ไม่เรียก VLM, ประหยัด ~2.3 s)
3. `swallows_dialogue(box, dialogue_boxes)` — region ที่กินพื้นที่ >= 70 % ของกล่องบทพูดอื่น = ไม่ใช่ SFX (กันเหมียวซ้ำในบับเบิล)

ผลรวมบน corpus 39 หน้า: SFX ที่ถูกวาดลดจาก 20 → 5 และทั้ง 5 เป็นตัวอักษรจริง, phantom = 0

## กฎเมื่อจะเพิ่ม guard ใหม่

1. ต้องมีสัญญาณอย่างน้อย 2-3 อย่างร่วมกัน (ขนาด/สคริปต์/รูปแบบคำ) ไม่ใช่ heuristic เดียว
2. ห้ามแตะ region ที่ `sfx_rescued` (จะตัดของที่ rescue ทำได้แล้ว)
3. วัด false positive กับ **ทุก region ใน 39 หน้า** ก่อนเปิด default — วิธีที่ใช้ได้: scan `result/doctor/**/*.doctor.json`
4. ยืนยันด้วย deterministic replay + เก็บรูป before/after (ดู `feedback-benchmark-md-report-with-image`)

เกี่ยวข้อง: [[concept-mit-render-pipeline]] · [[feedback-verify-before-claiming]] · [[feedback-root-cause-before-fix]]
