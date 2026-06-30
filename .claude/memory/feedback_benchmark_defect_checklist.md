---
name: feedback_benchmark_defect_checklist
description: ทุก MIT render benchmark ต้องเทียบภาพกับ original ทุกครั้ง ทุกมิติ ตาม checklist ข้อบกพร่องที่ user เคย flag (living doc — append ข้อพิจารณาใหม่เสมอ)
metadata:
  type: feedback
---

ทุกครั้งที่ benchmark งาน render (MIT), การประเมินผลต้อง **เทียบภาพ benchmark กับ original ทุกครั้ง และเทียบทุกมิติ** — ไล่ตรวจตาม checklist ข้อบกพร่องด้านล่างทุกข้อ แล้วรายงานทีละข้อใน MD report (pass/fail + จุดที่เจอ) — ไม่ใช่แค่บอก "ดีขึ้น/OK" รวมๆ. user เคย flag ข้อพวกนี้ทีละข้อในรอบ Gal Yome EN→TH; เป็น regression-watch list.

**กฎ meta (ผู้ใช้สั่ง):** (1) เทียบ benchmark↔original ทุกครั้ง ทุกมิติ เสมอ; (2) checklist นี้เป็น **living document** — ทุกครั้งที่ผู้ใช้ให้ "ข้อพิจารณา" ใหม่สำหรับการประเมิน ต้อง **append เข้า checklist นี้ทันที** เพื่อใช้ประเมินรอบต่อไป.

**Checklist (เทียบ original ทุกบับเบิล/ทุก caption):**
1. **text ว่าง/หาย** — บับเบิลที่ original มีคำแต่ฉบับแปลว่าง (มัก = บับเบิลซ้อน/ถูก patch อื่นบัง #436, หรือ region ถูก drop). เทียบจำนวนบับเบิลที่มีคำ original↔แปล
2. **ตัวเล็กกว่า original** — (a) display caption ที่ original ตัวใหญ่ (LOVE IS FORBIDDEN) แต่ render เล็ก = clean_layout flat font (แก้ #175: track orig_fs); (b) dialogue ในบับเบิลใหญ่ถูก route ไป clean_layout flat แทน bubble-fit (fills_bubble_width discriminator) — เทียบสัดส่วน font↔บับเบิล
3. **garbled/หลอน** — text มั่วที่ไม่ตรง original (มัก = det_sfx false-positive → VLM hallucinate, แก้ #278 ocr_read_real_text)
4. **fade/จาง** — text จางบนพื้นมืด/ขอบ patch (เช็ค dark-bg โดยเฉพาะ — content-alpha เคยทำ fade ใน #266)
5. **multi-lobe ไม่กระจาย** — 1 ประโยคที่ original แยกลงหลาย bubble lobe เชื่อมกัน (PRESIDENT!/WE ARE GOING TO GET MARRIED) แต่เรายัดรวม lobe เดียว lobe อื่นว่าง
6. **romaji/script ค้าง** — ชื่อ/SFX ไม่ถูก transliterate (TOUJOU FUYUKI, "파이" Korean leak, TAA-)
7. **overlap ซ้อนทับ** — SFX ซ้อน dialogue / 2 patch render ทับกัน garbled
8. **clipped/ล้นกรอบ** — text ล้นออกนอกบับเบิล/โดนตัด (บับเบิลทรงแคบ/ถูกบัง)

**Why:** "คิดว่าแก้แล้ว" หลายรอบเพราะประเมินภาพแบบผ่านๆ ไม่ไล่ทุก class — user ต้อง flag เองทีละข้อ. checklist นี้ทำให้ประเมิน benchmark เป็นระบบ + จับ regression ที่ fix หนึ่งอาจสร้างอีกที่. ต่อยอด [[feedback_verify_before_claiming]] + [[feedback_benchmark_md_report_with_image]].
