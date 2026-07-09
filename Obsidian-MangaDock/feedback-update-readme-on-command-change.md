---
name: feedback-update-readme-on-command-change
tags: ["feedback"]
description: แก้อะไรที่กระทบ command/script หรือเพิ่ม tool ใหม่ ต้องอัปเดต README.md ด้วยทุกครั้ง
metadata:
  type: feedback
---

ทุกครั้งที่มีการเปลี่ยนแปลงที่กระทบ **command/script** (เช่น เพิ่ม npm script, เปลี่ยน flag, ย้ายคำสั่ง) หรือ **เพิ่ม tool/utility ใหม่** ให้อัปเดต `README.md` ด้วยเสมอ (user สั่ง 2026-06-08 หลังเคส `cache:reset`)

**Why:** README เป็นจุดที่คนอื่น/agent อื่นเปิดหาคำสั่งก่อน ถ้า command ใหม่อยู่แค่ใน DONE.md/CLAUDE.md จะค้นไม่เจอตอนใช้งานจริง

**How to apply:** เอกสารคำสั่งใหม่ให้ครบชุดที่เกี่ยวข้อง — `README.md` (root, bilingual EN+TH ตาม [[feedback-bilingual-issues]]), README ของ service ที่เป็นเจ้าของคำสั่ง (เช่น `Backend/README.md`), `CLAUDE.md` (commands ทั้งบล็อก EN+TH), และ log ลง `DONE.md` ตาม [[feedback-md-history-log]] เคสตัวอย่าง: `npm run cache:reset` → เขียนครบทั้ง 4 ที่ + memory [[feedback-clear-cache-before-test]]
