---
name: feedback_benchmark_defect_checklist
description: ทุก MIT render benchmark ต้องเทียบภาพกับ original ทุกครั้ง ทุกมิติ ตาม checklist ข้อบกพร่องที่ user เคย flag (living doc — append ข้อพิจารณาใหม่เสมอ)
metadata:
  type: feedback
---

ทุกครั้งที่ benchmark งาน render (MIT), การประเมินผลต้อง **เทียบภาพ benchmark กับ original ทุกครั้ง และเทียบทุกมิติ** — ไล่ตรวจตาม checklist ข้อบกพร่องด้านล่างทุกข้อ แล้วรายงานทีละข้อใน MD report (pass/fail + จุดที่เจอ) — ไม่ใช่แค่บอก "ดีขึ้น/OK" รวมๆ. user เคย flag ข้อพวกนี้ทีละข้อในรอบ Gal Yome EN→TH; เป็น regression-watch list.

**กฎ meta (ผู้ใช้สั่ง):** (1) เทียบ benchmark↔original ทุกครั้ง ทุกมิติ เสมอ; (2) checklist นี้เป็น **living document** — ทุกครั้งที่ผู้ใช้ให้ "ข้อพิจารณา" ใหม่สำหรับการประเมิน ต้อง **append เข้า checklist นี้ทันที** เพื่อใช้ประเมินรอบต่อไป; (3) **เมื่อ benchmark (spot/per-page) ดู OK แล้ว ต้อง benchmark ทั้งแชปเตอร์ (ทุกหน้า) เพื่อ confirm ว่าทั้งหมดไม่มีปัญหา + benchmark กับ One Punch (manga อื่น) ด้วยเสมอ** — กัน fix ที่ดูดีบนหน้า/manga เดียวแต่ regress หน้า/manga อื่นที่ไม่ได้ดู (โดยเฉพาะ render-parity/discriminator/territory ที่กระทบทุก content).

**Checklist (เทียบ original ทุกบับเบิล/ทุก caption):**
1. **text ว่าง/หาย** — บับเบิลที่ original มีคำแต่ฉบับแปลว่าง (มัก = บับเบิลซ้อน/ถูก patch อื่นบัง #436, หรือ region ถูก drop). เทียบจำนวนบับเบิลที่มีคำ original↔แปล
2. **ตัวเล็กกว่า original** — (a) display caption ที่ original ตัวใหญ่ (LOVE IS FORBIDDEN) แต่ render เล็ก = clean_layout flat font (แก้ #175: track orig_fs); (b) dialogue ในบับเบิลใหญ่ถูก route ไป clean_layout flat แทน bubble-fit (fills_bubble_width discriminator) — เทียบสัดส่วน font↔บับเบิล. **⚠️ นี่คือ class ที่ user flag บ่อยสุด** — EN→TH dialogue ใน egg/oval bubble ใหญ่ render เล็ก ไม่เต็มบับเบิลแบบ original bold (Gal Yome p25 ล่าง "เราไม่ได้ไปกินข้างนอกมานานแล้ว", p26 ทั้ง 2 "เป็นอะไรไป?"+"เรากินข้างนอกได้แต่...", p12 "เธอไม่อยากกินข้าวด้วยกันเหรอ?", p18). ต้องให้ Thai เต็มบับเบิลเท่า footprint อังกฤษเดิม
3. **garbled/หลอน** — text มั่วที่ไม่ตรง original (มัก = det_sfx false-positive → VLM hallucinate, แก้ #278 ocr_read_real_text)
4. **fade/จาง** — text จางบนพื้นมืด/ขอบ patch (เช็ค dark-bg โดยเฉพาะ — content-alpha เคยทำ fade ใน #266). instance: Gal Yome p11 คำว่า "ภาย" (ใน "ภายในบริษัท") จางหาย
5. **multi-lobe ไม่กระจาย** — 1 ประโยคที่ original แยกลงหลาย bubble lobe เชื่อมกัน (PRESIDENT!/WE ARE GOING TO GET MARRIED) แต่เรายัดรวม lobe เดียว lobe อื่นว่าง
6. **romaji/script ค้าง** — ชื่อ/SFX ไม่ถูก transliterate (TOUJOU FUYUKI, "파이" Korean leak, TAA-)
7. **overlap ซ้อนทับ** — SFX ซ้อน dialogue / 2 patch render ทับกัน garbled
8. **clipped/ล้นกรอบ** — text ล้นออกนอกบับเบิล/โดนตัด (บับเบิลทรงแคบ/ถูกบัง)
9. **ตัดคำผิด/ขึ้นบรรทัดผิด (word-break)** — สำหรับภาษาที่ไม่มีช่องว่างระหว่างคำ (ไทย/ญี่ปุ่น/เขมร/ลาว) การ wrap ต้องตัดตาม **ขอบเขตคำ (dictionary/ICU segmentation)** — **ห้ามหักกลางคำ/กลาง cluster**. เช่น Gal Yome p25 "ข้างนอก"→"ข้า"/"งนอก", p18 "พยายาม"→"พยาย"/"ามให้" + "ไม่เป็น"→"ไม่เป็"/"น"(หัก cluster เป็น+น) + กล่อง "ทำอาหารเย็น..." ตัดกลางคำ. เทียบ: คำเดียวต้องไม่ถูกหักครึ่ง; พยัญชนะ+สระ/วรรณยุกต์ต้องอยู่บรรทัดเดียวกัน. **⚠️ class เด่นคู่กับ item 2** — EN→TH wrap ตัดกลางคำเพราะ wrapper ตัดตาม char/space ของอังกฤษ ไม่รู้จักขอบเขตคำไทย
10. **patch แตก pixel/low-res** — patch ที่ render (มัก = SFX) ขอบหยักแตกเป็น pixel/aliasing ต่างจาก dialogue ที่คมชัด = patch ถูก resample/upscale จาก low-res หรือ supersampling ไม่ทำกับ patch นั้น. instance: Gal Yome p11 SFX "ฮึย" แตก pixel. เทียบความคมของ glyph patch↔dialogue ในหน้าเดียวกัน
11. **inpaint ไม่สะอาด/ghost original text** — พื้นหลัง patch ลบ text เดิมไม่หมด เหลือเงา/เศษ original โผล่หลัง text แปล (ต่างจาก #436 overlap=2 patch ชน, อันนี้คือ inpaint mask ไม่ครอบ original เต็ม). instances: Gal Yome p19 มี original EN หลัง "ช่วงนี้เราไม่ค่อยได้คุยกันเท่าไหร่"; p27 บับเบิล cursive "What…here?" ไม่ถูกลบเลย. เช็คทุก patch ว่าพื้นหลังสะอาด ไม่มี ghost

**Why:** "คิดว่าแก้แล้ว" หลายรอบเพราะประเมินภาพแบบผ่านๆ ไม่ไล่ทุก class — user ต้อง flag เองทีละข้อ. checklist นี้ทำให้ประเมิน benchmark เป็นระบบ + จับ regression ที่ fix หนึ่งอาจสร้างอีกที่. ต่อยอด [[feedback_verify_before_claiming]] + [[feedback_benchmark_md_report_with_image]].
