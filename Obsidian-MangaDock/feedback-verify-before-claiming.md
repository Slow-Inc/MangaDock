---
name: feedback-verify-before-claiming
tags: ["feedback"]
description: Never claim "fixed"/"works" until visually verified on the REAL render vs target; a passing test/replay is NOT proof; always SendUserFile the real result and let the user confirm
metadata:
  type: feedback
---

ห้ามเคลม "แก้แล้ว / เวิร์ค / สำเร็จ" จนกว่าจะ **verify เห็นผลจริง** (ภาพ render จริงเทียบ target, E2E, telemetry) ทุกครั้ง — test เขียว / log / เหตุผล / replay ผ่าน **ไม่ใช่หลักฐานเพียงพอ** และต้อง **SendUserFile ภาพ result ให้ user confirm ทุกรอบ** (user-in-the-loop; อย่าสรุปเองว่าจบ)

**Why (บทเรียนตรง 2026-07-02):** demoted-bubble discriminator — deterministic replay "ผ่าน" + metric guard เขียว → ผมเคลมว่า "One-Punch แคบ ✅ Thai fill ✅ สำเร็จ end-to-end" **แต่ render จริง over-shrink** (One-Punch เล็กเกิน ไม่อ้างอิง original แนวตั้ง; Thai บับเบิลนึงจิ๋ว) user จับได้ = **over-claim**. สาเหตุ: (1) พึ่ง replay + มองผ่านๆ ไม่ eyeball render จริงเทียบ target ละเอียด (2) **metric guard เช็คแค่ over-spill ไม่เช็ค under-size** → "test ผ่าน" แต่ภาพแย่

**How to apply:**
- verify ต้อง = **eyeball render จริง (live worker, patch path — [[feedback-benchmark-patch-not-image-endpoint]]) เทียบ target ทุกมิติ** ก่อนเคลม; replay/unit ใช้ยืนยัน math เท่านั้น ไม่ใช่คุณภาพ
- **metric ต้องครอบทั้ง 2 ทิศ** (over AND under — ล้น/เล็กเกิน, ใหญ่/หาย) ไม่ใช่ทิศเดียว
- ระวัง translator non-determinism ([[project-mit-translate-nondeterministic]]) — 1 run ไม่ยืนยัน; ใช้ deterministic replay ควบภาพจริง
- **SendUserFile แล้วรอ user confirm** ก่อนถือว่าจบ; ถ้า user แก้ = ยังไม่จบ อย่าเถียง
- เชื่อมโยง [[feedback-log-every-experiment-to-md]] (จด over-claim/ปัญหาที่เจอด้วย)
