---
name: feedback-benchmark-md-report-with-image
tags: ["feedback"]
description: ทุก benchmark ต้องเขียน MD report + ฝังภาพเทียบ (committed); งาน MIT ทุกชิ้นต้อง benchmark ยืนยัน result เสมอ (part of done)
metadata:
  type: feedback
---

ทุกครั้งที่ทำ **benchmark** (E2E หรือ offline/deterministic ก็ตาม) ต้องเขียนผลลง **MD report พร้อมฝังภาพเปรียบเทียบ (comparison image) ที่ commit ไว้ในรีโป** เสมอ — ไม่ใช่แค่รายงานในแชตแล้วทิ้งภาพ.

**งาน MIT ทุกชิ้น (เมื่อเสร็จ) ต้อง benchmark เพื่อยืนยัน result เสมอ — เป็นส่วนหนึ่งของ "done" ไม่ใช่ทางเลือก.** code+test ผ่านอย่างเดียวยังไม่นับว่าเสร็จ; ต้องมี benchmark (deterministic ถ้าทำได้ ไม่งั้น E2E) + MD report + ภาพ ยืนยันว่าผลลัพธ์จริงดีขึ้น/ไม่ regress ก่อน.

**Why:** ภาพเทียบใน chat หายไปกับ session; report ที่ commit เป็นหลักฐาน auditable ของคุณภาพการแปล/เรนเดอร์ ที่ทีม + session ใหม่ย้อนดูได้ และเทียบ before/after ข้าม change ได้ (เหมือน [[feedback-impact-report]] แต่เน้น "ผล benchmark + ภาพ").

**How to apply:**
- เก็บภาพไว้ที่ `docs/reports/benchmarks/<YYYY-MM-DD>-<topic>.png` (committed; อย่าทิ้งใน worktree root/scratchpad/`.playwright-mcp` ที่ถูก gitignore แล้วหาย).
- เขียน `docs/reports/benchmarks/<YYYY-MM-DD>-<topic>.md`: method (ทำไม deterministic/ผ่านอะไร), ตารางตัวเลข (before→after, ratio), `![caption](./<image>.png)` ฝังภาพ, ตารางประเมิน "ดีแค่ไหน" (fix-root / no-regression / completeness / limitation).
- benchmark ที่ดี = **deterministic** ถ้าทำได้ (เลี่ยง translate non-deterministic — ดู [[project-mit-translate-nondeterministic]]); ถ้าเทียบ before/after ของ render ให้ isolate เฉพาะ knob/โค้ดที่เปลี่ยน.
- commit + push พร้อม change; อ้าง report ใน DONE.md / issue / ADR.

ตัวอย่างแรก: `docs/reports/benchmarks/2026-06-30-clean-layout-page-scale.png` + `.md` (#175 narration 18→35px, ~1.94×).
