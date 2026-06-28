---
name: feedback-ultracode-issue-triage
description: ก่อนปิด/เริ่มทำ issues ที่ค้างเยอะ ให้ verify กับ codebase จริงด้วย ultracode adversarial workflow ก่อนเสมอ — กัน duplication
metadata:
  type: feedback
---

ก่อนปิดหรือเริ่มทำ issues ที่ค้างเยอะ **verify กับ codebase จริงก่อนเสมอ** — อย่าเชื่อ issue title หรือ triage รอบเดียว งานอาจถูกทำไปแล้วใน branch/PR อื่น (หรือทำไปด้วยวิธีที่ดีกว่า)

**Why:** PR #419 (reground epic #268-271) เกือบ merge ทั้งที่ #277 (c31ff81) ทำไปแล้ว — และ #277 มี reground version ที่ครบกว่า (feather + Poisson seamless-clone + tighten) merge #419 = regress main; แถม `.env.example:113` flux force-on bug ทำ E2E branch พัง 500 ทั้งคู่จับได้เพราะ verify ลึก ไม่ใช่อ่าน title

**How to apply:** ใช้ ultracode `Workflow` — `pipeline` per issue (verify → adversarial, ไม่ barrier):
1. **verify agent**: หา concrete deliverable (file/class/knob/env/test) ใน `origin/main` + branch ที่ทำงานค้าง (เช่น `origin/feat/dashboard`) → verdict {DONE/PARTIAL/TODO/OBSOLETE} + cite commit/file:line
2. **skeptic agent**: พยายาม refute — DONE→หา deliverable ที่ขาด, TODO→หาว่าจริงๆ ทำแล้ว → final verdict + confidence + recommendation {close/close-superseded/keep-open/needs-human}
- **judge เทียบ `origin/main`** (integration target) ไม่ใช่ working tree (อาจเป็น branch เก่าตามหลัง main)
- **rate-limit กลางทาง** ("Server is temporarily limiting requests") → `Workflow({scriptPath, resumeFromRunId})` — completed agents return cached, failed re-run live (resume ได้หลายรอบ)
- ปิด issue เฉพาะที่ skeptic ยืนยัน; bulk-close โดน auto-mode classifier บล็อก → ปิดทีละอันพร้อม evidence comment (single gh ผ่าน)

**ผล 2026-06-29 (27 issues, 54 agents):** ปิด 9 (DONE #273/274/275/181, superseded #268-271/306), keep-open 16, needs-human 2 (#281 เสร็จบน feat/dashboard, #356 อยู่ใน PR #361). Findings: #275 `.env.example` flux force-on, reground regress white box, #277 ครอบ Flux+render ครบ. รายละเอียดใน `DONE.md` (2026-06-29). Related: [[project-mit-translate-nondeterministic]], [[project-mit-inpainter-flux-branch]]
