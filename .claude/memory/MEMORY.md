# Memory Index

- [Project: Community Forum Feature](project_community_forum.md) — Community forum on feat/community-forum branch; image upload added May 2026
- [Project: Cache Phase 2 Hardening](project_cache_phase2.md) — Phase 2.1–2.5 COMPLETE (PRs #39/#49/#50/#55/#70/#71); 279 tests; see [[project-cache-quality-gaps]]
- [Project: Cache Quality Gaps](project_cache_quality_gaps.md) — จุดอ่อนที่รู้ตัวหลัง Phase 2: redis.service under-tested, ไม่มี integration test, dead-letter ไม่มี runbook
- [Project: Backend pre-existing test failures](project_backend_pre_existing_test_failures.md) — books suite มี 16 fail (14 pubsub-batch + 2 hmac) ที่ค้างมาก่อน อย่าไล่เป็น regression
- [Project: Dev machine commit memory ตึง](project_dev_commit_memory.md) — Qwen3 โหลดพังด้วย OSError 1455 ถ้า commit เหลือ <15GB; MIT worker ตายเงียบ → เช็คก่อนทดสอบ translator
- [Feedback: บันทึก MD เป็น history](feedback_md_history_log.md) — แก้โค้ด/ทำ feature เสร็จ ให้ log ลง DONE.md (+PIPELINE.md §5 สำหรับ MIT) ทุกครั้ง
- [Feedback: test ทุกรอบ รวม frontend](feedback_test_every_round.md) — จบงานทุกชิ้นต้อง test ครบ unit + frontend E2E (Playwright tunnel) เทียบ original↔แปล ไม่ใช่แค่ unit
- [Feedback: ล้าง cache ก่อน test](feedback_clear_cache_before_test.md) — E2E การแปลต้องล้าง 3 ชั้น + browser ก่อน; หลัง deploy fix ต้องล้าง L3 + reload browser ด้วย ไม่งั้น replay ของเก่า
- [Feedback: แก้ command/tool ต้องอัปเดต README](feedback_update_readme_on_command_change.md) — เปลี่ยน command/script หรือเพิ่ม tool ใหม่ ต้องอัปเดต README.md (+ service README + CLAUDE.md) ทุกครั้ง
- [Feedback: แจ้งเตือนเมื่อเสร็จ/ต้องถาม](feedback_notify_on_done_or_question.md) — แจ้งเตือนทุกครั้งที่เสร็จ/ต้องถาม ผ่าน `scripts/notify.ps1` (WinRT toast; built-in PushNotification ไม่เด้งบนเครื่องนี้)
- [Project: ทิศทาง render parity](project_render_parity_direction.md) — ตัดสินแล้ว (2026-06-08) ให้ render เหมือน MangaTranslator: narrow-column (wrap ตาม mask interior) + supersampling 4× + vertical จริง + SFX #168 (VRAM เหลือ 5-7/12GB)
- [Project: Render knob gating](project_render_knob_gating.md) — in-app render ดีต่อเมื่อ backend ตั้ง MIT_* ครบ; MIT_BUBBLE_AREA_FIT gate #166/#179 (ไม่ตั้ง=legacy overflow); วิธี drive benchmark E2E ผ่าน MCP_DOCKER
- [Project: AnimeText approved](project_animetext_approved.md) — user อนุมัติ download deepghs/AnimeText_yolo (#168 SFX) 2026-06-09; .pt gate ผ่านเฉพาะ model นี้
- [Feedback: tech-debt ต้องคิด scenario ครบ](feedback_techdebt_all_scenarios.md) — refactor core/shared module ต้องสร้าง characterization net ครอบทุก scenario ก่อนแตะโค้ด (core error = กระทบทั้งระบบ)
