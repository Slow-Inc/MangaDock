---
name: feedback_md_history_log
description: ทุกครั้งที่แก้โค้ด/ทำ feature เสร็จ ให้บันทึกลง MD (DONE.md) เป็น history เสมอ
metadata:
  type: feedback
---

User สั่ง (2026-06-08): **บันทึกการแก้ไขลง MD ทุกครั้งเพื่อเป็น history** — ไม่ใช่แค่ตอนจบ session ใหญ่ แต่ทุกครั้งที่ทำงาน/แก้ไขเสร็จ

**Why:** ต้องการ trail ของการเปลี่ยนแปลงเพื่อทำรายงาน + ให้ทีม/agent คนต่อไปตามได้ว่าทำอะไรไปบ้าง เมื่อไหร่ ทำไม

**How to apply:** ไฟล์ history หลักคือ `DONE.md` (ราก repo) — รูปแบบ newest-first, หัวข้อ `## <title> — <date>` แล้ว bullets สรุป slice/ผลวัด/scope/สถานะ commit ภาษาอังกฤษตาม entry เดิม ใส่: issue#, สิ่งที่ทำแต่ละ slice, ผลวัด/E2E จริง, ไฟล์ที่แตะ, dep ใหม่, บทเรียน, และสถานะ (committed/merged หรือยัง). สำหรับงาน MIT ให้ลง provenance ใน `PIPELINE.md §5` ด้วย. งานวิจัย/ออกแบบลง `docs/research/` หรือ PRD. เชื่อมโยงกับ [[feedback_bilingual_issues]] (issue/PR ต้อง EN+TH แต่ DONE.md entry เดิมเป็น EN ล้วน)
