---
name: feedback-log-every-experiment-to-md
tags: ["feedback"]
description: Write EVERYTHING tried or done (experiments, measurements, dead-ends, decisions) into MD as durable knowledge every time — not just successes
metadata:
  type: feedback
---

ทุกครั้งที่ลองอะไรหรือทำอะไร (experiment, การวัด, ทางตัน/dead-end, การตัดสินใจ, brainstorm result) ให้**เขียนลง MD เป็น knowledge เสมอ** — ไม่ใช่แค่ผลที่สำเร็จ รวมถึงสิ่งที่ลองแล้วไม่เวิร์ค + เหตุผล (user สั่ง 2026-07-02)

**Why:** ความรู้ที่มีค่าที่สุดหลายอย่างคือ dead-end + การวัดที่ล้มล้างสมมติฐาน (เช่น benchmark ผิด endpoint ทั้ง session, shrink-to-min over-correct, threshold ที่วัดได้จริง 1.4 ไม่ใช่ที่เดา 1.8) — ถ้าไม่จด session/คนถัดไปจะไล่ผีซ้ำ เสีย effort เท่าเดิม การจดทำให้ error เกิดครั้งเดียว

**How to apply:**
- ลง `docs/prd/*` (execution log ของ campaign — §7x running log), `docs/reports/benchmarks/*` (การวัด + ภาพ), master plan learnings section, หรือ vault note ถ้าเป็นกฎ/decision ถาวร
- จดทั้ง: อะไรที่ลอง, ตัวเลขที่วัดได้, ทำไมมันเวิร์ค/ไม่เวิร์ค, ตัดสินใจอะไร, next step
- reconcile external MD เข้า vault index ([[reference-external-docs-index]]) เพื่อไม่ให้ตกหล่นตอนอ่าน
- ต่อเนื่องจาก [[feedback-md-update-every-change]] (spec/resume) + [[feedback-md-history-log]] (DONE.md) + [[feedback-benchmark-patch-not-image-endpoint]] (บทเรียนจากการไม่จด/จดผิด)
