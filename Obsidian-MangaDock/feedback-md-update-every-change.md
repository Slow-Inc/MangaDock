---
name: feedback-md-update-every-change
tags: ["feedback"]
description: อัปเดต MD (DESIGN/spec + "Resume here" note) ทุกครั้งที่แก้ เพื่อ session ใหม่เปิดมาทำงานต่อได้ทันที
metadata:
  type: feedback
---

แก้โค้ด/feature/decision **ทุกครั้ง** → อัปเดต MD ที่เกี่ยวข้อง (DESIGN.md spec, build-out/status, "Resume here" note) ให้ตรงกับ state ปัจจุบัน **ทันที** ไม่รอจบงานใหญ่.

**Why:** session ถูก summarize/ขาดได้ทุกเมื่อ. ถ้า MD เป็น single source of truth ที่ current + มี resume note (อะไรเสร็จ · เหลืออะไร · uncommitted ตรงไหน · next step) → session ใหม่เปิดมาอ่าน MD แล้วทำต่อได้เลย ไม่ต้องไล่ย้อน transcript.

**How to apply:** หลังทุก increment — (1) อัปเดต DESIGN.md/spec ให้สะท้อนสิ่งที่เพิ่ง build (2) มี/อัปเดต **"Resume here" block** (done · remaining · uncommitted · next when resumed) (3) สำหรับ dashboard งานนี้ canonical = `dashboardv2/DESIGN.md`. เกี่ยวกับ [[feedback-md-history-log]] (log ลง DONE.md) แต่อันนี้เน้น **spec ปัจจุบัน + continuity** ไม่ใช่ log ย้อนหลัง.
