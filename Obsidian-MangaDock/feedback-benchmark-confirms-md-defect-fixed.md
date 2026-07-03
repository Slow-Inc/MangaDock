---
name: feedback-benchmark-confirms-md-defect-fixed
tags: ["feedback"]
description: A defect documented in an md (defect list / checklist / master plan / issue) is not "done" until a benchmark ties back to THAT defect and proves the exact documented symptom is gone — not just "looks better"
metadata:
  type: feedback
---

เมื่อแก้ defect ที่ **ระบุไว้ใน md** (defect checklist / master plan / benchmark report / issue) — defect นั้น**ยังไม่นับว่า "แก้แล้ว"** จนกว่าจะมี **benchmark ที่ผูกกลับไปยัง defect entry นั้นโดยตรง และพิสูจน์ว่าอาการที่ md ระบุไว้หายจริง** (before = เห็นอาการตาม md, after = อาการหาย) — ไม่ใช่แค่ "ดูดีขึ้น" หรือ "test เขียว" (user สั่ง 2026-07-03)

**Why:** benchmark ทั่วไปพิสูจน์แค่ "เปลี่ยนแล้วไม่พัง" แต่ไม่ได้พิสูจน์ว่า **defect ที่ตั้งใจแก้** หายจริงเทียบ target ที่เขียนใน md การผูก benchmark ↔ defect entry บังคับให้ปิดลูป: อ้าง defect ไหน → แสดง before ที่มีอาการนั้น → แสดง after ที่อาการหาย ป้องกันการเคลม "แก้แล้ว" ทั้งที่ยังไม่ได้พิสูจน์กับ defect list (บทเรียน 2026-07-02: เคย over-claim garble แล้ว verify full-res เจอว่าเป็น translation ไม่ใช่ render)

**How to apply:**
- benchmark report ต้อง **cite defect ID/คำอธิบายจาก md** ที่กำลังปิด (เช่น "checklist item 2 under-fill", "master plan §7f narration-oversize")
- before ต้อง reproduce อาการตาม md; after ต้องแสดงอาการหาย (เทียบ target ใน md); deterministic ถ้าได้
- ถ้าปิดหลาย defect ต้อง benchmark ครบทุกตัว (ตาม [[feedback-benchmark-defect-checklist]] — เทียบทุกมิติ)
- ไม่มี benchmark ผูก defect = defect นั้นยัง open ใน DoD ต่อจาก [[feedback-verify-before-claiming]] · [[feedback-benchmark-patch-not-image-endpoint]] (ต้องยิง patch endpoint) · [[feedback-impact-report]]
