---
name: feedback_definition_of_done
description: Definition of Done — gate บังคับทุก task (code discipline ไม่พอ ต้องครบ doc/report/notify ทุกครั้ง)
metadata:
  type: feedback
---

ทุก task ที่ "เสร็จ" ต้องผ่าน **Definition of Done ครบทุกข้อ ทุกครั้ง** ไม่ใช่แค่โค้ด+เทสต์ผ่าน (2026-06-28 user ตรวจแล้วพบว่า code discipline ครบแต่ doc/report พลาดหลายข้อ → สั่ง "ให้ทำทั้งหมดทุกครั้ง")

**Why:** discipline การเขียนโค้ด (TDD/scrutinize/seam) ทำครบไม่พอ — กฎ documentation/reporting เขียนว่า "เสมอ" แต่ถูกข้ามบ่อย ทำให้ trace ย้อนไม่ได้ + คนถัดไปหลงทาง (เช่น torch 998 → anchor HVCI ผิดเพราะไม่มี post-mortem)

**How to apply — DoD checklist (ทุก task):**
1. **โค้ด** — simplest/seam/surgical ([[feedback_core_boundary]], karpathy-guidelines)
2. **เทสต์** — unit + **frontend E2E ผ่าน tunnel** เทียบ original↔แปล ไม่ใช่แค่ unit ([[feedback_test_every_round]]); E2E การแปลล้าง cache 3 ชั้น ([[feedback_clear_cache_before_test]])
3. **/scrutinize ก่อน merge** ([[feedback_review_merge_policy]])
4. **DONE.md log** (+ `MIT/PIPELINE.md §5` ถ้าเป็น MIT) ([[feedback_md_history_log]])
5. **impact-report เสมอ** ตอนปิด issue/เปิด PR → `docs/reports/system-impact-report.md` required-fields ครบ (What&where/Why/Before→After/Perf Δ/Quality/Validation/Risk/Links); bug→post-mortem ([[feedback_impact_report]])
6. **ADR** (`docs/adr/NNN`) บังคับทุก change ที่กระทบคุณภาพ/perf หรือ decision ไม่เล็ก; decision ที่ overturn ของเก่า → mark old ADR Superseded
7. **อัปเดต DESIGN/spec + Resume note** ([[feedback_md_update_every_change]]); README ถ้าเปลี่ยน command/tool ([[feedback_update_readme_on_command_change]])
8. **notify.ps1** ping ทุก milestone/ต้องตัดสินใจ ([[feedback_notify_on_done_or_question]])

ถ้าข้อไหนยัง = task **ยังไม่ done** — แจ้ง user ว่าเหลืออะไร ไม่ใช่รายงานว่าเสร็จ
