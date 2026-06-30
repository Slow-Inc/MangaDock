---
name: feedback_verify_before_claiming
description: อย่าเชื่อว่า "แก้แล้ว" จนกว่าจะ verify เห็นผลจริงทุกครั้ง (ภาพ/E2E/telemetry) + ส่งภาพ result ให้ user confirm ทุกรอบเสมอ ก่อนบอกว่าเสร็จ
metadata:
  type: feedback
---

ห้ามเคลมว่า "แก้แล้ว/เสร็จแล้ว" จนกว่าจะ **verify เห็นผลจริงด้วยตาทุกครั้ง** — โดยเฉพาะงาน render/MIT ต้องดู **ภาพจริง** (re-render + view), ไม่ใช่แค่ test เขียว, ไม่ใช่แค่ log บอกว่า "น่าจะหาย", ไม่ใช่แค่เหตุผลว่าโค้ดน่าจะถูก.

**🔴 USER-CONFIRM GATE (สั่งตรง 2026-07-01):** "ให้แสดง result ให้ผมเสมอ เพื่อให้ผม confirm ทุกรอบ" — ทุกครั้งที่ทำเสร็จ/จะเคลมว่าแก้ได้ ต้อง **ส่งภาพ result จริงให้ user ดู (SendUserFile) แล้วรอ user confirm** ก่อนถือว่าจบ. ห้ามสรุปเองว่า "เสร็จ/หายแล้ว" แล้วเดินหน้าต่อโดย user ยังไม่เห็นภาพ. verify ด้วยตาตัวเอง = จำเป็นแต่ไม่พอ — user ต้องได้เห็นและ confirm ด้วย (user-in-the-loop). ใช้ render จริง (worker) เสมอ ไม่ใช่ diagnostic replay (ดู caveat ล่างเรื่อง replay artifact).

**Why:** เกิดซ้ำหลายรอบที่ "คิดว่าแก้แล้ว" แต่ยังไม่หาย — เช่น (1) SFX gate-only fix หยุด VLM hallucination แต่ภาพยังโชว์ "ไอ"/literal fragment ทับ dialogue (ต้องเพิ่ม drop region), (2) benchmark รอบแรกโทษ 9arm gateway ทั้งที่จริงเป็น det_sfx false-positive. ทุกครั้งที่ verify ด้วยภาพจริงถึงเจอว่ายังไม่จบ. เชื่อ test/log/เหตุผลอย่างเดียว = ส่งของเสียให้ user.

**How to apply:** หลังแก้ทุกครั้ง → re-run บน worker จริง → **ดูผลลัพธ์จริง** (ภาพ before/after, telemetry per-region, E2E) → ยืนยัน defect หายจริง + ไม่ regress → ค่อยบอก user ว่าเสร็จ. แก้หลายชั้นต้อง verify ทุกชั้น (gate fix ≠ render fix). ต่อยอด [[feedback_benchmark_md_report_with_image]] + [[feedback_definition_of_done]].
