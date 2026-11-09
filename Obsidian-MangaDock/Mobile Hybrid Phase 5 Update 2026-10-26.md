---
name: Mobile Hybrid Phase 5 Update 2026-10-26
tags: [project, mobile, hybrid, phase5]
description: จุดทำต่อ Phase 5 บน hybrid Phase 4 ที่ push แล้ว พร้อม source commit, ผลทดสอบ, APK QA และเงื่อนไขก่อนเปิดใช้งานจริง
type: project
updated: 2026-10-26
---

# Mobile Hybrid Phase 5 Update — 2026-10-26

## ข้อกำหนดที่ผู้ใช้เลือก

- พัฒนา Phase 5 ต่อจาก **mobile hybrid Phase 4 ที่ push ล่าสุด** ใช้ WebView shell เดิม
- ไม่ใช้ native Phase 5 เป็นฐาน และไม่เขียนทับงานค้างใน worktree อื่น
- Session และ Supabase Auth อยู่ฝั่งเว็บ; native รับผิดชอบเฉพาะงาน OS ที่จำเป็น
- ผู้ใช้ขอเก็บข้อมูลอัปเดตนี้ไว้เพื่อทำงานต่อใน session ถัดไป

## Source และตำแหน่งทำงาน

| รายการ | ค่า |
|---|---|
| Repository | `Slow-Inc/MangaDock` |
| Branch ที่ทำต่อ | `feat/mobile-hybrid-phase5-20261026` |
| Implementation commit | `ae6d228` — feat(mobile): continue Phase 5 on the hybrid WebView shell |
| ฐาน hybrid Phase 4 | `feat/mobile-hybrid-phase4-20261024` / `69badd5f` |
| Source ที่ reuse | Backend/Frontend retention + durable push จาก `b168975` |
| Worktree | `C:/Users/woral/md-hybrid-phase5-20261026` |
| GitHub | https://github.com/Slow-Inc/MangaDock/tree/feat/mobile-hybrid-phase5-20261026 |

Implementation commit ถูก push แล้วในรอบพัฒนา ไม่ได้ merge เข้า main หรือ deploy production
โฟลเดอร์เริ่มต้น `C:/Users/woral/Desktop/MangaDock-feat-mobile-shell-phase3` เป็น Git HEAD ที่ยังไม่มี commit
และมีไฟล์ untracked จำนวนมาก ให้ทำงานใน worktree Phase 5 ด้านบน
เก็บงานค้างของ `md-hybrid-phase45` และ native worktrees ไว้ตามเดิม

## สิ่งที่พัฒนาแล้ว

- Following และ Personalized Feed ใช้ follow graph เดิม พร้อม pagination, retry และ empty states
- Collections: private/public, create/edit/delete, เพิ่ม/นำมังงะออก, แชร์ลิงก์และ guest read
- Hybrid deep links และ shortcuts สำหรับ feed, collections และตั้งค่าแจ้งเตือน
- หน้า `/settings/notifications` และ OS Push bridge ผ่าน Expo SDK 56 modules ใน React Native CLI shell
- Permission ขอเมื่อผู้ใช้กดเปิดรับเท่านั้น; แสดงว่าเปิดแล้วหลัง Backend ยืนยันการลงทะเบียน
- รองรับ opt-out, local preview, token rotation, cold tap, duplicate/recipient checks และ logout cleanup
- Bearer/refresh token ไม่ถูกย้ายไปเก็บใน native; กู้ ownership marker เมื่อ WebView storage ถูกล้าง
- Backend push: PostgreSQL outbox, Redis dispatch, leases, retry/dead letter และ Expo receipts
- CI เพิ่ม shell/OS boundary tests และ Phase 5 migration/authorization/worker contracts

## ผลตรวจที่บันทึกไว้

| ขอบเขต | ผล |
|---|---|
| Mobile | 91/91 tests, 17 suites; TypeScript ผ่าน; lint 0 errors / 1 warning เดิม |
| Web Push controller | 16/16 |
| Auth/cache regressions | 12/12 |
| Backend Phase 5 SQL/HTTP/worker | 18/18 |
| Backend full Jest, Node 22 ตาม CI | 114 suites / 1,179 tests ผ่าน |
| Frontend | production build, types และ focused lint ผ่าน |
| Browser QA | 390/1280 px ผ่าน Next proxy จริง → Nest/PGlite QA; จำลอง Auth/catalog และขอบ OS |
| Android | QA release + vital analysis ผ่าน; build ที่เปิด Push แต่ไม่มี EAS/Firebase ถูกปฏิเสธตามที่ออกแบบ |

ข้อจำกัดของหลักฐาน:

- Frontend broad run บน Bun 1.4.4: 510 pass / 8 fail / 2 errors; Phase 4 baseline มี 8 fail / 2 errors เหมือนกัน (494 pass)
- Bun 1.3.14 บน Windows ค้างที่ `reviewsFetch.test.ts` เดิมและหยุดการรันแล้ว ไม่อ้างว่า GitHub CI เขียว
- Backend บน Node 26 พบ timer teardown error; Node 22 ผ่านครบ ให้ใช้ runtime ตาม CI
- E2E รอบที่ผ่านใช้ Next proxy จริง แต่รันก่อน ownership-recovery additions รอบสุดท้าย ซึ่งตรวจด้วย unit/type/build แล้ว
- ระบบอนุมัติอัตโนมัติบล็อกการเปิด Next QA server ซ้ำพร้อม `INTERNAL_API_URL` override โดยไม่ระบุเหตุผลเพิ่มเติม ไม่พยายาม bypass
- ไม่มีการส่ง remote Push จริง, เปลี่ยนฐานข้อมูล production หรือรับรอง production rollout

## APK QA

- รุ่น `1.2.0-phase5-beta.1` / code `8`; package `com.mobile`
- ARM64 + x86_64; target SDK 36; ใช้ QA/debug signing เดิม; **Push ปิดอยู่**
- ไฟล์ `C:/Users/woral/md-hybrid-phase5-20261026/Mobile/build/phase5-20261026/MangaDock-1.2.0-phase5-beta.1-code8-arm64-x86_64.apk`
- ขนาด 48,264,854 bytes
- SHA-256: `164f22280cb3db6946601e3103cb23172d2eed28573ca2dbcdd02c3c608eda4c`
- APK อยู่ใน ignored build directory ไม่ได้อัปโหลดเป็น GitHub release

Multi-ABI APK ติดตั้งและเปิด native/WebView บน Android 16 emulator ได้โดยไม่พบ native/JS crash
เว็บปลายทาง `hayateotsu.space` ตอบ **Cloudflare Tunnel error 1033 ตอนตรวจ** ไม่ใช่ข้อสรุปสถานะปัจจุบัน
และไม่ใช่การตรวจรับ product flows บน production

Z Flip4 ติดตั้ง ARM64 build ก่อนหน้าทับ Phase 4 โดยไม่ uninstall/clear data แล้ว
แต่การติดตั้ง multi-ABI binary สุดท้ายไม่เสร็จและหยุด installer ไปแล้ว สาเหตุยังไม่ยืนยัน
ยังต้องตรวจรับ final binary บนโทรศัพท์จริง อย่าอ้างว่ารุ่นสุดท้ายผ่านเครื่องจริงครบ

## Resume here

1. เปิด worktree และ branch Phase 5 ที่ระบุด้านบน อ่าน delivery record ก่อนแก้โค้ด
2. ตรวจ schema จริงและลง `2026-10-24-phase5-retention.sql` ก่อน `2026-10-24-phase5-push.sql` ผ่าน workflow ฐานข้อมูลของทีม
3. Deploy Backend/Frontend ที่เข้ากันจาก branch นี้; ติดตั้ง APK อย่างเดียวไม่ทำให้เว็บมี Phase 5
4. ใช้ EAS project/Firebase ของทีมสำหรับ package **com.mobile**, สร้าง APK ที่เปิด Push แล้วตรวจ remote delivery/receipts จริง
5. ทดสอบ permission, background/cold tap, token rotation, logout/account switch, offline cleanup และ process restart
6. ตรวจ Redis multi-worker/recovery, production signing และ distribution ก่อนเปิด rollout

อย่าสร้าง cloud project ใหม่หรือแตะ private credentials โดยเดา ค่าเปิด Push และ server sending ยังต้องปิดไว้ก่อนตรวจรับ
New-chapter events ปัจจุบันครอบคลุม Studio versions ที่ publish ในระบบ ยังไม่ใช่ external MangaDex chapter polling
iOS ยังไม่อยู่ใน Android delivery รอบนี้

## เอกสารหลัก

- [Delivery record / คำสั่ง build และงานค้าง](../Mobile/docs/2026-10-26-hybrid-phase5.md)
- [QA report และภาพ](../docs/reports/hybrid-phase5-2026-10-26/README.md)
- [APK metadata](../docs/reports/hybrid-phase5-2026-10-26/apk.json)
- [ADR 034: hybrid web session / OS push](../docs/adr/034-hybrid-phase5-web-session-and-os-push.md)
- [ADR 033: retention และ push delivery](../docs/adr/033-phase5-retention-and-push-delivery.md)
- [History](../DONE.md) · [System impact](../docs/reports/system-impact-report.md)

Related: [[Home]] · [[feedback-md-history-log]] · [[feedback-impact-report]] · [[feedback-test-every-round]]
