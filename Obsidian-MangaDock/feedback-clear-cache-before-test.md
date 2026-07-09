---
name: feedback-clear-cache-before-test
tags: ["feedback"]
description: ก่อน test การแปลทุกครั้งต้องล้าง cache ก่อน — และหลัง deploy fix ต้องล้าง L3 + reload browser ด้วย
metadata:
  type: feedback
---

ก่อนการ test การแปล (E2E/live) ทุกครั้ง ให้ล้าง cache ก่อนเสมอ (user สั่ง 2026-06-07; ย้ำ 2026-06-08 "จดไว้ด้วยว่าต้องล้างก่อน test")

**Why:** patch เก่าใน cache จะ replay แทนการแปลจริง → ผลทดสอบของโค้ด/knob ใหม่ไม่สะท้อนความจริง

**How to apply — 3 ชั้น + browser (ทั้ง 3 ข้อ บังคับ ทำไม่ครบ = ได้ผลลวง):**
1. **`cd Backend && npm run cache:reset`** — ล้าง L2 (`uploads/patches/*`) + L3 (`.cache/*manga-patches*`) + Redis `translate:manga-patches:*` ในคำสั่งเดียว (ลบเฉพาะ patch cache, forum/search/glossary รอด; `-- --dry-run` ดูก่อนได้). logic อยู่ใน `src/cache/translation-cache-reset.ts` (unit-tested). มาแทนการลบมือทีละ glob (เสี่ยง nuke namespace อื่น)
2. **⚠ ต้อง restart backend เสมอ — cache:reset ลบ disk+Redis แต่ NOT L1 in-memory ของ process ที่รันอยู่** ถ้าไม่ restart: L1 ยัง HIT คืน URL ของ patch ที่เพิ่งลบไป → frontend โหลด PNG **404** (เคสจริง 2026-06-08: MCP_DOCKER แปลแล้ว patch 404 เพราะลืม restart; restart แล้วหาย). รัน `dist` ไม่ใช่ watch — แก้โค้ด backend ต้อง `npm run build` ก่อน. **L1 เคลียร์ได้ทางเดียวคือ restart process** (script เตือนท้าย output แล้ว)
3. bust browser cache + reload (frontend เก็บ `patchedPages` ใน memory → ต้อง reload tab ก่อน ไม่งั้น short-circuit คืน patch เก่า)

**สำคัญ — หลัง deploy โค้ด/fix:** L3 เก็บ **response เก่า** → replay ของก่อน fix (เช่น patch url ที่ยังไม่มี `?v=` cache-bust ของ patch-store) ทำให้ fix "เหมือนไม่ติด". ต้องล้าง **ครบทั้ง 3 ชั้น (รวม L3) + restart backend + reload browser** เพราะ frontend เก็บ `patchedPages` ใน memory → "แปลหน้านี้" จะ short-circuit คืน patch เก่าไม่เรียก backend (หรือ test บนหน้าที่ยังไม่เคยแปลใน session). เคส #170: ลืมล้าง L3 หลัง fix → browser โชว์ strip เก่า natH=1492 (จับได้ด้วยเทียบ naturalHeight เก่า/ใหม่). เชื่อมกับ [[feedback-test-every-round]]
