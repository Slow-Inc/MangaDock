---
name: project-gal-yome-en-benchmark
tags: ["project"]
description: Gal Yome no Himitsu มี 2 version (ไทย+EN) — ต้องเลือก EN ก่อน benchmark EN→ไทย; วิธี + chip ที่ถูก
metadata:
  type: project
---

**Gal Yome no Himitsu มี 2 source version: ภาษาไทย (scanlation Blazer) และ EN.** เป้าหมาย benchmark #175/#183 คือ **EN → ไทย** (เคสที่ text ไทยเคย "เล็กมาก") — ต้องเลือก **EN version** ให้ถูก ไม่งั้นจะกลายเป็น Thai→EN (ผิด เพราะ source เป็นไทยอยู่แล้ว).

**วิธีเลือก EN version ใน BookDetailModal (สำคัญ — เคยพลาดเลือกไทยซ้ำๆ):**
- chip ภาษาที่ถูกคือ chip ข้างหัวข้อ **"ตอนทั้งหมด (N)"**: `ทั้งหมด / ภาษาไทย / EN` — default คือ **ภาษาไทย** (จึงโหลด Thai version ถ้าไม่กด). คลิก **"EN"** ก่อน.
- chip "ภาษาไทย/English" ที่อื่น (meta ของเรื่อง) **ไม่ใช่** ตัวสลับ version ของตอน — กดแล้ว reader ยังโหลดไทย.
- เปิดตอนโดยคลิก **row "ตอนที่ 1...EN...หน้า"** (row อาจมี "อ่านค้างไว้" แทรก → match แบบยืดหยุ่น `^ตอนที่ 1\D ... EN ... หน้า`, เลือก element เล็กสุด) ไม่ใช่ปุ่ม CTA "อ่านตอนที่ 1" (อาจ default ไทย).

**ยืนยันว่าได้ EN version แล้ว:** counter reader = **"1 / 30"** (EN 30 หน้า; ไทย = 29 หน้า) + dropdown ทิศทางแปลขึ้น **"แปล → TH"** (ถ้าขึ้น → EN/ZH/JA/KO แปลว่าโหลด Thai version มา = ผิด เพราะ source ไทยแปลเป็นไทยไม่ได้ เลยไม่มี → ไทย).

**หน้าทดสอบ:** **page 4** มีบับเบิลทรงสูง "PEOPLE FROM OTHER DEPARTMENTS ARE WELCOME, DON'T YOU WANNA COME?" (EN, 6 บรรทัด) → แปลไทย "เปิดรับนักศึกษาจากภาควิชาอื่นๆ..." ต้องเต็มบับเบิลเป็น ~6 บรรทัดแคบ (ไม่ใช่ 2 บรรทัดเล็ก). EN chapter id = `78e4caf1-1382-45dd-a861-9cebd8dc60d8` (Thai chapter = a81eccd7...).

**Gotchas (พิสูจน์ 2026-06-30):** translate รอบแรก (uncached) มักโดน **Cloudflare 524** (>100s: full-page inpaint + render + LLM) → frontend ไม่ขึ้น overlay; แต่ backend cache patch ไว้แล้ว → กด **แปลซ้ำ = cache hit เร็ว** overlay ขึ้น. ดู patch จริงที่ `Backend/uploads/patches/<chapterId>/ANY__<TGT>__default__p3__rN.png` (p3 = หน้า 4). translator live = `custom_openai` คุณภาพไม่นิ่ง (เคยคืนขยะ "65วงหห"/"HROK") = คนละเรื่องกับ render. ดู [[project-benchmark-e2e-flow]], [[feedback-clear-cache-before-test]].
