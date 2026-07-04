---
name: feedback-proactive-clink-brainstorm
tags: ["feedback"]
description: In goal-mode, invoke /clink-brainstorm WITHOUT asking first for any technical question multiple agents can enrich; the Master Agent (Claude) decides how many/which agents — and always verify "external prerequisite / blocked" claims against the real repo before believing them
metadata:
  type: feedback
---

**เมื่ออยู่ในโหมด goal (มี goal/Stop-hook ตั้งไว้แล้ว) ให้เรียก `/clink-brainstorm` ได้ทันทีโดย*ไม่ต้อง*ขออนุญาต user ก่อน** — สั่ง 2026-07-04.

**เมื่อไหร่:** คำถาม/การตัดสินใจ**เชิงเทคนิค**ที่ **agent หลายตัววิเคราะห์กันเองแล้วเสริมข้อมูลหลายมุมได้** (architecture call, cross-check plan ก่อน change ใหญ่/เสี่ยง, "พลาดอะไรไปไหม", verify ข้อสรุปสำคัญ, หา autonomous path ที่อาจมองข้าม) ไม่ใช้กับเรื่อง trivial ที่ pass เดียวตอบชัด

**การตัดสินใจอยู่ที่ Master Agent (Claude) เอง:** เรียกกี่ตัว/ตัวไหน (antigravity=system-centric, codex=code-centric, claude-9arm=logic-centric, chat=conceptual) — เลือกตามลักษณะคำถาม + cognitive lens ตาม skill `clink-brainstorm`

**Why:** goal mode = user มอบอำนาจให้เดินหน้าเอง; multi-agent cross-check เพิ่มความมั่นใจ + จับ blind spot ที่ single-pass พลาด (เช่น 2026-07-04 agents จับ CUDA OOM risk จากการรัน 2 worker instance คู่กัน + model weights git-ignored ที่ประเมินไม่ครบ) และรอบ brainstorm นั้น **ปลดล็อก 3 cluster ที่เหมาว่า "blocked on external prereq"** (P6 model cached จริง, P7-accuracy รัน LLM-judge ได้, P9 0-drop terminal) → บทเรียนสำคัญ: **verify "external prerequisite / blocked" กับ repo จริง (cached models, cached references, audit เดิม) ก่อนเชื่อว่า blocked เสมอ**

**How to apply:**
- goal-mode + technical fork ที่มีน้ำหนัก → ยิง brainstorm parallel ได้เลย ไม่ต้องถาม
- เชื่อมกับ [[feedback-review-merge-policy]] (review/cross-check ก่อน merge) + skill `clink-brainstorm`

**Gotcha:** codex อาจล่ม (auth 401 token revoked) — ใช้ agents ที่เหลือ (antigravity + claude-9arm) converge ก็พอ ไม่ต้องรอครบทุกตัว
