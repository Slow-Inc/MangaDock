---
name: feedback_benchmark_defect_checklist
description: "ทุก MIT render benchmark ต้องประเมินภาพเทียบ original ตาม checklist ข้อบกพร่องที่ user เคย flag (ไม่ใช่แค่ \"ดูเผินๆ OK\")"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: a585a091-2cbc-480b-bda9-3eefd1f2336f
---

ทุกครั้งที่ benchmark งาน render (MIT), การประเมินผลต้อง **เทียบภาพ benchmark กับ original ทุกครั้ง และเทียบทุกมิติ** — ไล่ตรวจตาม checklist ข้อบกพร่องด้านล่างทุกข้อ แล้วรายงานทีละข้อใน MD report (pass/fail + จุดที่เจอ) — ไม่ใช่แค่บอก "ดีขึ้น/OK" รวมๆ. user เคย flag ข้อพวกนี้ทีละข้อในรอบ Gal Yome EN→TH; เป็น regression-watch list.

**กฎ meta (ผู้ใช้สั่ง):** (1) เทียบ benchmark↔original ทุกครั้ง ทุกมิติ เสมอ; (2) checklist นี้เป็น **living document** — ทุกครั้งที่ผู้ใช้ให้ "ข้อพิจารณา" ใหม่สำหรับการประเมิน ต้อง **append เข้า checklist นี้ทันที** เพื่อใช้ประเมินรอบต่อไป; (3) **เมื่อ benchmark (spot/per-page) ดู OK แล้ว ต้อง benchmark ทั้งแชปเตอร์ (ทุกหน้า) เพื่อ confirm ว่าทั้งหมดไม่มีปัญหา + benchmark กับ One Punch (manga อื่น) ด้วยเสมอ** — กัน fix ที่ดูดีบนหน้า/manga เดียวแต่ regress หน้า/manga อื่นที่ไม่ได้ดู (โดยเฉพาะ render-parity/discriminator/territory ที่กระทบทุก content).

**Checklist (เทียบ original ทุกบับเบิล/ทุก caption):**
1. **text ว่าง/หาย** — บับเบิลที่ original มีคำแต่ฉบับแปลว่าง (มัก = บับเบิลซ้อน/ถูก patch อื่นบัง #436, หรือ region ถูก drop). เทียบจำนวนบับเบิลที่มีคำ original↔แปล
2. **ตัวเล็กกว่า original** — (a) display caption ที่ original ตัวใหญ่ (LOVE IS FORBIDDEN) แต่ render เล็ก = clean_layout flat font (แก้ #175: track orig_fs); (b) dialogue ในบับเบิลใหญ่ถูก route ไป clean_layout flat แทน bubble-fit (fills_bubble_width discriminator) — เทียบสัดส่วน font↔บับเบิล. **⚠️ นี่คือ class ที่ user flag บ่อยสุด** — EN→TH dialogue ใน egg/oval bubble ใหญ่ render เล็ก ไม่เต็มบับเบิลแบบ original bold (Gal Yome p25 ล่าง, p26 ทั้ง 2, p12, p16 narration, p20 ทั้ง 2, p19 side box, p18). ต้องให้ Thai เต็มบับเบิลเท่า footprint อังกฤษเดิม
3. **garbled/หลอน** — text มั่วที่ไม่ตรง original (มัก = det_sfx false-positive → VLM hallucinate, แก้ #278 ocr_read_real_text). **phantom "เงียบ"** = det_sfx false-positive ที่ read เป็น non-ASCII → หลุด gate #278 (ที่ drop เฉพาะ ASCII-readable) → แปลเป็น "เงียบ" แทรกใน dialogue (Gal Yome p09 ใน Notepad, p19)
4. **fade/จาง** — text จางบนพื้นมืด/ขอบ patch (เช็ค dark-bg โดยเฉพาะ — content-alpha เคยทำ fade ใน #266). instance: Gal Yome p11 คำว่า "ภาย" (ใน "ภายในบริษัท") จางหาย
5. **multi-lobe ไม่กระจาย** — 1 ประโยคที่ original แยกลงหลาย bubble lobe เชื่อมกัน (PRESIDENT!/WE ARE GOING TO GET MARRIED) แต่เรายัดรวม lobe เดียว lobe อื่นว่าง
6. **romaji/script ค้าง** — ชื่อ/SFX ไม่ถูก transliterate (TOUJOU FUYUKI, "파이" Korean leak, TAA-)
7. **overlap ซ้อนทับ** — SFX ซ้อน dialogue / 2 patch render ทับกัน garbled. instance: Gal Yome p11 บับเบิลหัวใจซ้อนแน่น 2 ใบ text ชนกัน (#436 กัน empty ได้แต่ยัง collide)
8. **clipped/ล้นกรอบ** — text ล้นออกนอกบับเบิล/โดนตัด (บับเบิลทรงแคบ/ถูกบัง)
9. **ตัดคำผิด/ขึ้นบรรทัดผิด (word-break)** — สำหรับภาษาที่ไม่มีช่องว่างระหว่างคำ (ไทย/ญี่ปุ่น/เขมร/ลาว) การ wrap ต้องตัดตาม **ขอบเขตคำ (dictionary/ICU segmentation)** — **ห้ามหักกลางคำ/กลาง cluster**. เช่น Gal Yome p25 "ข้างนอก"→"ข้า"/"งนอก", p18 "พยายาม"→"พยาย"/"ามให้" + "ไม่เป็น"→"ไม่เป็"/"น", p19 "ตลอด", เดรสถักหน้า "ความสั้น"/"เดรส"/"เครื่อง" หักกลางคำ. เทียบ: คำเดียวต้องไม่ถูกหักครึ่ง; พยัญชนะ+สระ/วรรณยุกต์ต้องอยู่บรรทัดเดียวกัน. **⚠️ class เด่นคู่กับ item 2** — EN→TH wrap ตัดกลางคำเพราะ wrapper ตัดตาม char/space ของอังกฤษ ไม่รู้จักขอบเขตคำไทย
10. **patch แตก pixel/low-res** — patch ที่ render (มัก = SFX) ขอบหยักแตกเป็น pixel/aliasing ต่างจาก dialogue ที่คมชัด = patch ถูก resample/upscale จาก low-res หรือ supersampling ไม่ทำกับ patch นั้น. instance: Gal Yome p11 SFX "ฮึย" แตก pixel. เทียบความคมของ glyph patch↔dialogue ในหน้าเดียวกัน
11. **inpaint ไม่สะอาด/ghost original text** — พื้นหลัง patch ลบ text เดิมไม่หมด เหลือเงา/เศษ original โผล่หลัง text แปล (ต่างจาก #436 overlap=2 patch ชน, อันนี้คือ inpaint mask ไม่ครอบ original เต็ม). instances: Gal Yome p19 มี original EN หลัง "ช่วงนี้เราไม่ค่อยได้คุยกันเท่าไหร่"; p27 บับเบิล cursive "What…here?" ไม่ถูกลบเลย. เช็คทุก patch ว่าพื้นหลังสะอาด ไม่มี ghost

**2 class เด่นสุด (pervasive เกือบทุกหน้า EN→TH):** item 2 (เล็กกว่า original) + item 9 (ตัดคำผิด). แก้ 2 อันนี้ก่อน impact สูงสุด.

**สถานะ + regression-watch pairing (2026-07-01):**
- **item 9 = ✅ FIXED & VERIFIED** (commit `e61771a`). 2 ชั้น: (1) clean-layout floor `wrap_w` ที่ `longest_token_width` (commit `ee2e512`/ADR 025 addendum), (2) **ROOT CAUSE จริง = supersampling**. `render()` re-wrap text ที่ scale `font*ss`, width `round(norm_h*ss)`; ที่ ss=4 การ round integer ตกต่ำกว่าคำที่กว้างสุดที่ `font*ss` 1px → หักคำกลาง cluster (undo word-floor ของ layout ที่ ss=1). **นี่คือเหตุผลว่าทำไม reproduce offline ที่ font ปกติไม่ได้ — มันโผล่เฉพาะ ss=4** (offline isolation รันที่ ss=1). fix = floor ss column ที่ `longest_token_width(font*ss)` ใน render() horizontal branch (Latin ≤ box → no-op). **verified worker จริง** (p19 ss=4, `MIT/.venv`): บับเบิลทำอาหาร = `ฉัน/ทำอาหาร/และ/งานบ้าน/ได้นะ` — ทำอาหารอยู่บรรทัดเดียว, text ครบทุกบับเบิล, ไม่ clip (`scratchpad/dumpref_p19.png`, `zoom_cooking_p19.png`). **บทเรียนใหม่ #2:** "text หาย" ใน offline replay triptych = artifact ของ replay harness (paste full-crop ไม่มี content_alpha) **โผล่เท่ากันทั้ง OFF และ ON** → ไม่ใช่จาก fix. ตรวจ render จริง (worker) ก่อนสรุปว่า fix ทำให้แย่ลง — อย่าเชื่อ diagnostic replay เป็น production. **บทเรียน #1 ยังจริง: spot-check 3 หน้าไม่พอ — full-chapter เสมอ.** ทดสอบ deterministic A/B (dump+replay) คือเครื่องมือที่งัด root cause นี้ออกมา.
- **item 2 fix → ต้อง re-benchmark One-Punch narration เสมอ**: การลด `fills_bubble_width` threshold (0.72) หรือ size clean-layout ตาม bubble จะเสี่ยง One-Punch "THIS BRAT…" narration **บวมเต็มบับเบิล** (0.72 ถูกเลือกมากันอันนี้). pair ที่ต้องเทียบ: dialogue เต็มขึ้น **กับ** narration ไม่บวม.
- **item 3 fix → ต้อง confirm real SFX ยังถูก rescue**: การ drop non-ASCII read จะฆ่า SFX จริง (stylized SFX กลับมาเป็น non-ASCII โดยธรรมชาติ). pair: phantom เงียบ หาย **กับ** SFX จริง (ฮึย/ดึ๋ง ฯลฯ) ยังอยู่.
- **non-determinism**: item 2/3 A/B ใน-app สับสนเพราะ translate สุ่ม → ใช้ offline pixel-band/dump เทียบ ([[project_mit_translate_nondeterministic]]).

**Why:** "คิดว่าแก้แล้ว" หลายรอบเพราะประเมินภาพแบบผ่านๆ ไม่ไล่ทุก class — user ต้อง flag เองทีละข้อ. checklist นี้ทำให้ประเมิน benchmark เป็นระบบ + จับ regression ที่ fix หนึ่งอาจสร้างอีกที่. ต่อยอด [[feedback_verify_before_claiming]] + [[feedback_benchmark_md_report_with_image]].
