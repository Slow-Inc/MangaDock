---
name: feedback-test-every-round
tags: ["feedback"]
description: ทำงานเสร็จทุกครั้งต้อง test ครบทุกรอบ รวม frontend E2E (Playwright ผ่าน tunnel) ไม่ใช่แค่ unit
metadata:
  type: feedback
---

User สั่ง (2026-06-08): **ทำเสร็จแล้วให้ test ทุกรอบ รวมถึง frontend ด้วย** — หลังจบงานทุกชิ้น (ทุก slice/ทุก fix) ต้องรัน test ให้ครบ ไม่ใช่แค่ unit test ฝั่งที่แก้

**Why:** "โค้ดผ่าน unit + ไม่ error" ไม่พอ — บั๊กจริง (เช่น stale-patch-cache 2026-06-08) โผล่เฉพาะตอนรันจริงผ่าน UI เท่านั้น การ test ครบทุกชั้นทุกรอบกันงานที่ "คิดว่าเสร็จ" แต่พังจริง

**How to apply:** เมื่อทำงานชิ้นหนึ่งเสร็จ ให้รัน:
1. **unit/spec** ของฝั่งที่แก้ (MIT pytest / Backend jest / Frontend bun test) — และเทียบ regression baseline ([[project-backend-test-baseline]] = 15 pubsub fails)
2. **frontend E2E** ผ่าน Playwright + tunnel `hayateotsu.space` ตาม skill `frontend-testing` — เปิดจริง แปลจริง ดู overlay/ผลจริง **เทียบ original ↔ ฉบับแปล**
3. ล้าง cache ก่อน E2E การแปลเสมอ ([[feedback-clear-cache-before-test]])
4. บันทึกผล test ลง history ([[feedback-md-history-log]])

ครอบทุกรอบ ไม่ใช่แค่ตอนจบ session
