# Native Android migration — proposed issue breakdown

Date: 2026-10-02
Status: Approved breakdown published on 2026-10-03: PRD #724 and 29 slices #725–#753. Phase 1 acceptance is open; Phase 2 begins with S11 discovery/navigation. Initial S12 library/history and S20 community browsing are in progress, not fully accepted.
วันที่: 2026-10-02
สถานะ: เผยแพร่การแบ่งงานที่อนุมัติวันที่ 2026-10-03 เป็น PRD #724 และ slices 29 งาน #725–#753 ยังเปิด acceptance Phase 1; เริ่ม Phase 2 ที่ S11 discovery/navigation ส่วน S12 รายการส่วนตัว/ประวัติและ S20 การเปิดดู Community เริ่มทำแล้ว แต่ยังไม่ผ่าน acceptance ครบ

[Published PRD / PRD ที่เผยแพร่](https://github.com/Slow-Inc/MangaDock/issues/724). S1–S29 map in order to #725–#753; the exact slice URLs and types are in [publication receipts / ผลการเผยแพร่](native-migration-publish/published.json). All issues remain open. No historical hybrid parent or native parent was modified or closed during slice publication.

S1–S29 ตรงตามลำดับกับ #725–#753; URLs และประเภทแต่ละงานอยู่ใน [ผลการเผยแพร่](native-migration-publish/published.json) ทุก issue ยังเปิดอยู่ ไม่ได้แก้หรือปิด parent hybrid เดิมหรือ parent native ระหว่างเผยแพร่ slices [Implementation evidence and remaining gates / หลักฐาน implementation และเกณฑ์ที่เหลือ](2026-10-03-native-phase2-implementation.md).

## TDD method and proposed priorities / วิธี TDD และลำดับสำคัญที่เสนอ

**Visual acceptance for all slices:** implement the existing Frontend responsive mobile design natively, preserving `DESIGN.md` tokens, artwork, hierarchy and navigation. Compare the corresponding web/mobile native screens; do not invent a new product design. [Reference mapping and evidence](2026-10-02-native-responsive-design-parity.md).

**เกณฑ์ตรวจภาพของทุก slice:** implement design responsive mobile เดิมของ Frontend เป็น native รักษา tokens จาก `DESIGN.md`, artwork, ลำดับเนื้อหาและ navigation เทียบหน้าเว็บ/mobile native ที่ตรงกัน ไม่ออกแบบผลิตภัณฑ์ใหม่ [Mapping และหลักฐาน](2026-10-02-native-responsive-design-parity.md)

The user selected `$tdd`. Implement one observable behavior at a time: RED → GREEN → refactor while GREEN. Use real Mobile modules through public domain interfaces or rendered screens, mocking only external Backend/provider/OS/browser/storage/time boundaries. Never write all tests before all implementation or mock internal collaborators.

ผู้ใช้เลือก `$tdd` ให้ implement พฤติกรรมที่สังเกตได้ทีละข้อ: RED → GREEN → refactor ขณะ GREEN ใช้ Mobile modules จริงผ่าน public domain interfaces หรือหน้าจอที่ render โดย mock เฉพาะขอบ Backend/provider/OS/browser/storage/time ภายนอก ห้ามเขียน tests ทั้งหมดก่อน implementation ทั้งหมดหรือ mock collaborators ภายใน

The first tracer is email/password sign-in showing the authenticated account natively. Prioritize: (1) session/account isolation, (2) captcha and both content sources, (3) Single-Page Translation/Patch alignment, (4) Batch Translation failures/cancel/restart, (5) paid unlock server-confirmed access, and (6) banking-app/relaunch payment recovery and return to Chapter. Each later slice chooses its next meaningful behavior from the preceding cycle rather than an exhaustive up-front test matrix.

Tracer แรกคือเข้าสู่ระบบด้วยอีเมล/รหัสผ่านแล้วเห็นบัญชีที่ยืนยันตัวตนแบบ native ให้ความสำคัญกับ (1) แยก session/บัญชี (2) captcha และทั้งสองแหล่งเนื้อหา (3) Single-Page Translation/ตำแหน่ง Patch (4) Batch Translation ล้มเหลว/cancel/restart (5) สิทธิ์ปลดล็อกแบบชำระที่ server ยืนยัน และ (6) กู้รายการชำระหลังกลับจากแอปธนาคาร/เปิดใหม่และกลับ Chapter โดยแต่ละ slice ภายหลังเลือกพฤติกรรมที่มีความหมายถัดไปจาก cycle ก่อน แทน test matrix ครอบคลุมทุกอย่างที่เขียนล่วงหน้า

Record a meaningful failing behavior test and its passing result for implementation slices; test-harness/config/import failures do not constitute feature RED. APK release-only slices verify device evidence rather than inventing a code change to manufacture RED.

บันทึก behavior test ที่ fail อย่างมีความหมายและผลที่ผ่านสำหรับ slices ที่ implement โดย test-harness/config/import failures ไม่นับเป็น RED ของฟีเจอร์ ส่วน slices ที่ตรวจ release APK อย่างเดียวตรวจหลักฐานอุปกรณ์ ไม่สร้าง code change ขึ้นเพื่อทำ RED

## Modules and proposed tests / Modules และ tests ที่เสนอ

1. **Identity and Session / Identity และ Session** — observable domain/contract/screen behavior tests and relevant recovery/permission paths / tests ของพฤติกรรม domain/contract/หน้าจอที่สังเกตได้ และทางกู้/สิทธิ์ที่เกี่ยวข้อง
2. **Native Navigation and Theme / Native Navigation และ Theme** — screen navigation/theme usability smoke; behavioral tests for back/deep links / smoke การใช้ navigation/theme และ behavioral tests ของ back/deep links
3. **Backend Gateway and authenticated SSE / Backend Gateway และ SSE ที่ยืนยันตัวตน** — observable domain/contract/screen behavior tests and relevant recovery/permission paths / tests ของพฤติกรรม domain/contract/หน้าจอที่สังเกตได้ และทางกู้/สิทธิ์ที่เกี่ยวข้อง
4. **Protected Content and Captcha / Protected Content และ Captcha** — observable domain/contract/screen behavior tests and relevant recovery/permission paths / tests ของพฤติกรรม domain/contract/หน้าจอที่สังเกตได้ และทางกู้/สิทธิ์ที่เกี่ยวข้อง
5. **Reading Session and native Page/Patch renderer / Reading Session และตัว render Page/Patch native** — observable domain/contract/screen behavior tests and relevant recovery/permission paths / tests ของพฤติกรรม domain/contract/หน้าจอที่สังเกตได้ และทางกู้/สิทธิ์ที่เกี่ยวข้อง
6. **Translation Session / Translation Session** — observable domain/contract/screen behavior tests and relevant recovery/permission paths / tests ของพฤติกรรม domain/contract/หน้าจอที่สังเกตได้ และทางกู้/สิทธิ์ที่เกี่ยวข้อง
7. **Wallet Checkout / Wallet Checkout** — observable domain/contract/screen behavior tests and relevant recovery/permission paths / tests ของพฤติกรรม domain/contract/หน้าจอที่สังเกตได้ และทางกู้/สิทธิ์ที่เกี่ยวข้อง
8. **Personal Data and account lifecycle / Personal Data และ lifecycle บัญชี** — observable domain/contract/screen behavior tests and relevant recovery/permission paths / tests ของพฤติกรรม domain/contract/หน้าจอที่สังเกตได้ และทางกู้/สิทธิ์ที่เกี่ยวข้อง
9. **Community / Community** — observable domain/contract/screen behavior tests and relevant recovery/permission paths / tests ของพฤติกรรม domain/contract/หน้าจอที่สังเกตได้ และทางกู้/สิทธิ์ที่เกี่ยวข้อง
10. **Creator Workspace / Creator Workspace** — observable domain/contract/screen behavior tests and relevant recovery/permission paths / tests ของพฤติกรรม domain/contract/หน้าจอที่สังเกตได้ และทางกู้/สิทธิ์ที่เกี่ยวข้อง
11. **Role-Gated Management / Role-Gated Management** — observable domain/contract/screen behavior tests and relevant recovery/permission paths / tests ของพฤติกรรม domain/contract/หน้าจอที่สังเกตได้ และทางกู้/สิทธิ์ที่เกี่ยวข้อง
12. **APK diagnostics and parity release gate / APK diagnostics และเกณฑ์ release ที่มี parity** — typecheck, slice tests, physical APK evidence, redaction checks / typecheck, tests ของ slices, หลักฐาน APK จริง และตรวจการปิดข้อมูลสำคัญ

## Review questions / คำถามสำหรับ review

- Do these public module interfaces and the six TDD priorities match the intended migration? / Public module interfaces และลำดับสำคัญ TDD หกข้อนี้ตรงกับงานย้ายที่ต้องการหรือไม่
- Is slice granularity right, are dependencies correct, should any slices be merged/split, and are HITL/AFK classifications correct? / ขนาด slice เหมาะสมหรือไม่ dependencies ถูกต้องหรือไม่ ควรรวมหรือแยก slice ใด และการจัด HITL/AFK ถูกต้องหรือไม่

## Numbered slices / Slices ตามลำดับ

1. **S1 — feat(mobile): native sign-in and restored account tracer / เข้าสู่ระบบและกู้บัญชีแบบ native**
   - Phase: 1; Type: **AFK**
   - Blocked by / ติดบล็อกโดย: None / ไม่มี
   - User stories / เรื่องราวผู้ใช้: 1, 2, 3, 6, 48

2. **S2 — feat(mobile): system-browser OAuth and required TOTP login / OAuth ผ่าน browser ของระบบและ TOTP ที่จำเป็น**
   - Phase: 1; Type: **AFK**
   - Blocked by / ติดบล็อกโดย: S1
   - User stories / เรื่องราวผู้ใช้: 4, 5, 6, 47

3. **S3 — feat(mobile): search-to-protected MangaDex Reader with browser captcha / ค้นหาแล้วอ่าน MangaDex ที่ป้องกันพร้อม captcha ผ่าน browser**
   - Phase: 1; Type: **HITL**
   - Blocked by / ติดบล็อกโดย: S1
   - User stories / เรื่องราวผู้ใช้: 7, 8, 10, 12, 24, 48

4. **S4 — feat(mobile): published Studio versions in native Chapter selection / เลือก Chapter จาก Studio versions ที่เผยแพร่แบบ native**
   - Phase: 1; Type: **AFK**
   - Blocked by / ติดบล็อกโดย: S3
   - User stories / เรื่องราวผู้ใช้: 11, 13

5. **S5 — feat(mobile): native Reader modes zoom and Chapter navigation / โหมดอ่าน zoom และเปลี่ยน Chapter แบบ native**
   - Phase: 1; Type: **AFK**
   - Blocked by / ติดบล็อกโดย: S3, S4
   - User stories / เรื่องราวผู้ใช้: 14, 15, 16, 17, 47

6. **S6 — feat(mobile): Single-Page Translation with native Patch rendering / Single-Page Translation พร้อมแสดง Patch แบบ native**
   - Phase: 1; Type: **AFK**
   - Blocked by / ติดบล็อกโดย: S5
   - User stories / เรื่องราวผู้ใช้: 18, 20, 24, 25

7. **S7 — feat(mobile): Batch Translation progress cancel and restart / Batch Translation พร้อม progress ยกเลิกและเริ่มใหม่**
   - Phase: 1; Type: **AFK**
   - Blocked by / ติดบล็อกโดย: S6
   - User stories / เรื่องราวผู้ใช้: 19, 21, 22, 23, 25

8. **S8 — feat(mobile): coin balance and paid Chapter unlock to Reader / ยอดเหรียญและปลดล็อก Chapter แบบชำระเงินไป Reader**
   - Phase: 1; Type: **AFK**
   - Blocked by / ติดบล็อกโดย: S1, S4
   - User stories / เรื่องราวผู้ใช้: 26, 27

9. **S9 — feat(mobile): native QR topup with banking-app recovery / เติมเงิน QR native พร้อมกู้ flow หลังกลับจากแอปธนาคาร**
   - Phase: 1; Type: **AFK**
   - Blocked by / ติดบล็อกโดย: S8
   - User stories / เรื่องราวผู้ใช้: 28, 29, 30

10. **S10 — release(mobile): Phase 1 native Android APK beta verification / ตรวจและส่ง APK beta Android native ของ Phase 1**
   - Phase: 1; Type: **HITL**
   - Blocked by / ติดบล็อกโดย: S2, S5, S7, S9
   - User stories / เรื่องราวผู้ใช้: 1, 31, 48

11. **S11 — feat(mobile): native catalog discovery and related manga / ค้นพบ catalog และมังงะเกี่ยวข้องแบบ native**
   - Phase: 2; Type: **AFK**
   - Blocked by / ติดบล็อกโดย: S3
   - User stories / เรื่องราวผู้ใช้: 9, 10

12. **S12 — feat(mobile): library history and continue-reading parity / Library ประวัติ และอ่านต่อเทียบระบบเดิม**
   - Phase: 2; Type: **AFK**
   - Blocked by / ติดบล็อกโดย: S1, S5
   - User stories / เรื่องราวผู้ใช้: 32, 6

13. **S13 — feat(mobile): ratings reviews Reader comments and reports / Ratings reviews comments ใน Reader และ reports**
   - Phase: 2; Type: **AFK**
   - Blocked by / ติดบล็อกโดย: S1, S4
   - User stories / เรื่องราวผู้ใช้: 33

14. **S14 — feat(mobile): public profiles and existing follows / Public profiles และ follows เดิม**
   - Phase: 2; Type: **AFK**
   - Blocked by / ติดบล็อกโดย: S1
   - User stories / เรื่องราวผู้ใช้: 34

15. **S15 — feat(mobile): daily check-in and coin-reward states / Check-in รายวันและสถานะรางวัลเหรียญ**
   - Phase: 2; Type: **AFK**
   - Blocked by / ติดบล็อกโดย: S8
   - User stories / เรื่องราวผู้ใช้: 35

16. **S16 — feat(mobile): native in-app notifications and destination links / Notifications ภายในแอปและลิงก์ปลายทาง native**
   - Phase: 2; Type: **AFK**
   - Blocked by / ติดบล็อกโดย: S1
   - User stories / เรื่องราวผู้ใช้: 35, 47

17. **S17 — feat(mobile): profile preferences and account statistics / Profile preferences และสถิติบัญชี**
   - Phase: 2; Type: **AFK**
   - Blocked by / ติดบล็อกโดย: S1
   - User stories / เรื่องราวผู้ใช้: 36

18. **S18 — feat(mobile): account recovery linking and security lifecycle / กู้บัญชี เชื่อมบัญชี และ lifecycle ความปลอดภัย**
   - Phase: 2; Type: **AFK**
   - Blocked by / ติดบล็อกโดย: S2, S17
   - User stories / เรื่องราวผู้ใช้: 37, 6

19. **S19 — feat(mobile): Wallet transaction history and reconciliation / ประวัติธุรกรรม Wallet และ reconciliation**
   - Phase: 2; Type: **AFK**
   - Blocked by / ติดบล็อกโดย: S8, S9
   - User stories / เรื่องราวผู้ใช้: 38

20. **S20 — feat(mobile): native Community browsing tracer / Flow ดู Community แบบ native**
   - Phase: 2; Type: **AFK**
   - Blocked by / ติดบล็อกโดย: S1
   - User stories / เรื่องราวผู้ใช้: 39, 47

21. **S21 — feat(mobile): Community post creation attachments edit and delete / สร้างโพสต์ Community พร้อม attachments แก้และลบ**
   - Phase: 2; Type: **AFK**
   - Blocked by / ติดบล็อกโดย: S20
   - User stories / เรื่องราวผู้ใช้: 40

22. **S22 — feat(mobile): Community replies votes reports and live updates / Replies votes reports และ live updates ของ Community**
   - Phase: 2; Type: **AFK**
   - Blocked by / ติดบล็อกโดย: S21
   - User stories / เรื่องราวผู้ใช้: 41

23. **S23 — feat(mobile): creator workspace and draft Chapter management / Workspace ผู้สร้างและจัดการ draft Chapter**
   - Phase: 3; Type: **AFK**
   - Blocked by / ติดบล็อกโดย: S1, S4
   - User stories / เรื่องราวผู้ใช้: 42

24. **S24 — feat(mobile): Studio image upload and publication lifecycle / Upload ภาพ Studio และ lifecycle การเผยแพร่**
   - Phase: 3; Type: **AFK**
   - Blocked by / ติดบล็อกโดย: S23
   - User stories / เรื่องราวผู้ใช้: 43

25. **S25 — feat(mobile): creator account earnings and Studio Wallet / บัญชีผู้สร้าง รายได้ และ Studio Wallet**
   - Phase: 3; Type: **AFK**
   - Blocked by / ติดบล็อกโดย: S23, S19
   - User stories / เรื่องราวผู้ใช้: 44

26. **S26 — feat(mobile): role-gated user management native tracer / Flow จัดการผู้ใช้แบบ native ตาม role**
   - Phase: 3; Type: **AFK**
   - Blocked by / ติดบล็อกโดย: S1, S18
   - User stories / เรื่องราวผู้ใช้: 45

27. **S27 — feat(mobile): existing staff content reports and moderation flows / Flow เนื้อหา reports และ moderation ของ staff เดิม**
   - Phase: 3; Type: **AFK**
   - Blocked by / ติดบล็อกโดย: S26, S13, S22, S24
   - User stories / เรื่องราวผู้ใช้: 45

28. **S28 — feat(mobile): staff transactions overview and audit parity / Transactions overview และ audit ของ staff เทียบเดิม**
   - Phase: 3; Type: **AFK**
   - Blocked by / ติดบล็อกโดย: S26, S19
   - User stories / เรื่องราวผู้ใช้: 45

29. **S29 — release(mobile): full native parity and Android replacement gate / ตรวจ native ครบและเกณฑ์แทนแอป Android เดิม**
   - Phase: 3; Type: **HITL**
   - Blocked by / ติดบล็อกโดย: S10, S11, S12, S13, S14, S15, S16, S18, S19, S22, S24, S25, S27, S28
   - User stories / เรื่องราวผู้ใช้: 1, 2, 46, 47, 48

## Draft issue bodies / ร่าง bodies ของ issues

### S1: feat(mobile): native sign-in and restored account tracer

<!-- lang:en -->
## Parent

[Native migration PRD #724](https://github.com/Slow-Inc/MangaDock/issues/724)

## Delivery metadata

- Phase: 1
- Type: AFK
- User stories: 1, 2, 3, 6, 48
- Suggested triage: ready-for-agent

## What to build

Launch a native app, sign in with the existing email/password flow, display the authenticated account, restore the session after relaunch, and sign out. Introduce the Mobile-owned session, navigation/theme, and Backend Gateway seams while preserving the shared web bridge.

Scope: Mobile subsystem only; reuse existing APIs, data, permissions, and business rules. Preserve Frontend/Backend/MIT and the shared Frontend bridge.

TDD: For implementation in this slice, use real Mobile code through public interfaces with external-boundary mocks only. Develop one observable behavior per RED-GREEN cycle, record meaningful failing/passing evidence, and refactor only while GREEN. For release-only work, verify device evidence rather than manufacturing code changes.

## Acceptance criteria

- [ ] An account can sign in, survive relaunch through the existing session contract, and sign out from native screens.
- [ ] Account changes isolate cached user state and in-flight responses; API calls use the current token and existing device identity.
- [ ] The native entry has no embedded WebView; the Frontend-consumed bridge stays unchanged and Mobile typecheck plus session/gateway behavior tests pass.

## Blocked by

None - can start immediately
<!-- lang:end -->

<!-- lang:th -->
## Parent / งานหลัก

[Native migration PRD #724](https://github.com/Slow-Inc/MangaDock/issues/724)

## ข้อมูลการส่งมอบ

- Phase: 1
- Type: AFK
- User stories: 1, 2, 3, 6, 48
- Suggested triage: ready-for-agent

## สิ่งที่จะสร้าง

เปิดแอป native เข้าสู่ระบบด้วย flow อีเมล/รหัสผ่านเดิม แสดงบัญชีที่ยืนยันตัวตน กู้ session หลังเปิดใหม่ และออกจากระบบ พร้อมสร้าง seams ของ session, navigation/theme และ Backend Gateway ที่ Mobile ดูแล โดยรักษา shared web bridge

Scope: ส่วน Mobile เท่านั้น ใช้ APIs ข้อมูล สิทธิ์ และกฎธุรกิจเดิม โดยรักษา Frontend/Backend/MIT และ bridge ร่วมของ Frontend

TDD: การ implement ใน slice นี้ใช้ Mobile code จริงผ่าน public interfaces และ mock เฉพาะขอบภายนอก พัฒนาพฤติกรรมที่สังเกตได้ทีละข้อในแต่ละ RED-GREEN cycle บันทึกหลักฐาน fail/pass ที่มีความหมาย และ refactor เฉพาะขณะ GREEN ส่วนงานตรวจ release อย่างเดียวตรวจหลักฐานอุปกรณ์แทนการสร้าง code changes ขึ้นเอง

## เกณฑ์รับงาน

- [ ] บัญชีเข้าสู่ระบบ คง session หลังเปิดใหม่ผ่าน contract เดิม และออกจากระบบจากหน้าจอ native ได้
- [ ] การเปลี่ยนบัญชีแยก state ผู้ใช้ที่ cache และผลคำขอที่กำลังทำ โดย API ใช้ token ปัจจุบันและ device identity เดิม
- [ ] จุดเข้าแอป native ไม่มี embedded WebView โดย bridge ที่ Frontend ใช้คงเดิม และ Mobile typecheck กับ session/gateway behavior tests ผ่าน

## ติดบล็อกโดย

ไม่มี - เริ่มได้ทันที
<!-- lang:end -->

---

### S2: feat(mobile): system-browser OAuth and required TOTP login

<!-- lang:en -->
## Parent

[Native migration PRD #724](https://github.com/Slow-Inc/MangaDock/issues/724)

## Delivery metadata

- Phase: 1
- Type: AFK
- User stories: 4, 5, 6, 47
- Suggested triage: ready-for-agent

## What to build

Complete existing Google/Facebook sign-in through the system-browser callback and complete already-enrolled TOTP when required. Cancellation or rejected callbacks return safely to native login without changing identity.

Scope: Mobile subsystem only; reuse existing APIs, data, permissions, and business rules. Preserve Frontend/Backend/MIT and the shared Frontend bridge.

TDD: For implementation in this slice, use real Mobile code through public interfaces with external-boundary mocks only. Develop one observable behavior per RED-GREEN cycle, record meaningful failing/passing evidence, and refactor only while GREEN. For release-only work, verify device evidence rather than manufacturing code changes.

## Acceptance criteria

- [ ] Both existing providers return into the native session using the existing provider project and redirect registration.
- [ ] Unsolicited, stale, repeated, and mismatched callback results cannot replace the session; cancellation clears pending state.
- [ ] Required TOTP blocks account use until verified, and login/callback/TOTP behavioral tests pass.

## Blocked by

- [S1 - #725](https://github.com/Slow-Inc/MangaDock/issues/725)
<!-- lang:end -->

<!-- lang:th -->
## Parent / งานหลัก

[Native migration PRD #724](https://github.com/Slow-Inc/MangaDock/issues/724)

## ข้อมูลการส่งมอบ

- Phase: 1
- Type: AFK
- User stories: 4, 5, 6, 47
- Suggested triage: ready-for-agent

## สิ่งที่จะสร้าง

ทำการเข้าสู่ระบบ Google/Facebook เดิมผ่าน callback ของ browser ระบบ และทำ TOTP ที่เปิดไว้ให้ครบเมื่อจำเป็น โดยการยกเลิกหรือ callback ถูกปฏิเสธกลับหน้า login native โดยไม่เปลี่ยนตัวตน

Scope: ส่วน Mobile เท่านั้น ใช้ APIs ข้อมูล สิทธิ์ และกฎธุรกิจเดิม โดยรักษา Frontend/Backend/MIT และ bridge ร่วมของ Frontend

TDD: การ implement ใน slice นี้ใช้ Mobile code จริงผ่าน public interfaces และ mock เฉพาะขอบภายนอก พัฒนาพฤติกรรมที่สังเกตได้ทีละข้อในแต่ละ RED-GREEN cycle บันทึกหลักฐาน fail/pass ที่มีความหมาย และ refactor เฉพาะขณะ GREEN ส่วนงานตรวจ release อย่างเดียวตรวจหลักฐานอุปกรณ์แทนการสร้าง code changes ขึ้นเอง

## เกณฑ์รับงาน

- [ ] Providers เดิมทั้งสองกลับเข้า session native โดยใช้ provider project และ redirect registration เดิม
- [ ] ผล callback ที่ไม่ร้องขอ เก่า ซ้ำ และไม่ตรงเปลี่ยน session ไม่ได้ โดยการยกเลิกล้าง pending state
- [ ] TOTP ที่จำเป็นกั้นการใช้บัญชีจนยืนยันสำเร็จ และ behavioral tests ของ login/callback/TOTP ผ่าน

## ติดบล็อกโดย

- [S1 - #725](https://github.com/Slow-Inc/MangaDock/issues/725)
<!-- lang:end -->

---

### S3: feat(mobile): search-to-protected MangaDex Reader with browser captcha

<!-- lang:en -->
## Parent

[Native migration PRD #724](https://github.com/Slow-Inc/MangaDock/issues/724)

## Delivery metadata

- Phase: 1
- Type: HITL
- User stories: 7, 8, 10, 12, 24, 48
- Suggested triage: ready-for-human

## What to build

Search the existing catalog, open manga details, select a MangaDex Chapter, verify Turnstile in the system browser, and display its Pages in a basic native Reader. Supply the Mobile-owned static challenge source for the user's existing hosting and verify the real browser-to-app return.

Scope: Mobile subsystem only; reuse existing APIs, data, permissions, and business rules. Preserve Frontend/Backend/MIT and the shared Frontend bridge.

TDD: For implementation in this slice, use real Mobile code through public interfaces with external-boundary mocks only. Develop one observable behavior per RED-GREEN cycle, record meaningful failing/passing evidence, and refactor only while GREEN. For release-only work, verify device evidence rather than manufacturing code changes.

## Acceptance criteria

- [ ] Search/pagination/details/Chapter selection reach actual protected Pages; loading, empty, denied, and retry states are visible.
- [ ] The configured HTTPS challenge and fixed captcha callback use a one-time matching state, acquire existing device-bound clearance, and reject unsolicited callbacks.
- [ ] Physical Android captcha completion and expiry recovery preserve Reader context without an embedded WebView or changing Backend/Frontend/MIT.
- [ ] Catalog, clearance, callback, stale-response, and basic Page-load behavior tests pass; the actual hosting URL/device evidence is recorded.

## Blocked by

- [S1 - #725](https://github.com/Slow-Inc/MangaDock/issues/725)
<!-- lang:end -->

<!-- lang:th -->
## Parent / งานหลัก

[Native migration PRD #724](https://github.com/Slow-Inc/MangaDock/issues/724)

## ข้อมูลการส่งมอบ

- Phase: 1
- Type: HITL
- User stories: 7, 8, 10, 12, 24, 48
- Suggested triage: ready-for-human

## สิ่งที่จะสร้าง

ค้นหา catalog เดิม เปิดรายละเอียดมังงะ เลือก Chapter จาก MangaDex ยืนยัน Turnstile ใน browser ระบบ และแสดง Pages ใน native Reader พื้นฐาน พร้อมส่ง source challenge แบบ static ที่ Mobile ดูแลสำหรับ hosting เดิมของผู้ใช้ และตรวจการกลับจาก browser เข้าแอปจริง

Scope: ส่วน Mobile เท่านั้น ใช้ APIs ข้อมูล สิทธิ์ และกฎธุรกิจเดิม โดยรักษา Frontend/Backend/MIT และ bridge ร่วมของ Frontend

TDD: การ implement ใน slice นี้ใช้ Mobile code จริงผ่าน public interfaces และ mock เฉพาะขอบภายนอก พัฒนาพฤติกรรมที่สังเกตได้ทีละข้อในแต่ละ RED-GREEN cycle บันทึกหลักฐาน fail/pass ที่มีความหมาย และ refactor เฉพาะขณะ GREEN ส่วนงานตรวจ release อย่างเดียวตรวจหลักฐานอุปกรณ์แทนการสร้าง code changes ขึ้นเอง

## เกณฑ์รับงาน

- [ ] ค้นหา/แบ่งหน้า/รายละเอียด/เลือก Chapter ไปถึง Pages ที่ป้องกันจริงได้ โดยเห็นสถานะโหลด ว่าง ถูกปฏิเสธ และลองใหม่
- [ ] HTTPS challenge ที่ config และ callback captcha ที่กำหนดใช้ state ตรงกันแบบครั้งเดียว รับ clearance ผูก device เดิม และปฏิเสธ callback ที่ไม่ร้องขอ
- [ ] การทำ captcha และกู้เมื่อหมดอายุบน Android จริงรักษาบริบท Reader โดยไม่มี embedded WebView และไม่เปลี่ยน Backend/Frontend/MIT
- [ ] Behavior tests ของ catalog, clearance, callback ผลตอบกลับเก่า และโหลด Page พื้นฐานผ่าน พร้อมบันทึก URL hosting จริง/หลักฐานอุปกรณ์

## ติดบล็อกโดย

- [S1 - #725](https://github.com/Slow-Inc/MangaDock/issues/725)
<!-- lang:end -->

---

### S4: feat(mobile): published Studio versions in native Chapter selection

<!-- lang:en -->
## Parent

[Native migration PRD #724](https://github.com/Slow-Inc/MangaDock/issues/724)

## Delivery metadata

- Phase: 1
- Type: AFK
- User stories: 11, 13
- Suggested triage: ready-for-agent

## What to build

Show MangaDex Chapters and published Studio versions together with source, language, availability, and price. Select an accessible uploaded version and load its Pages through existing version/media contracts.

Scope: Mobile subsystem only; reuse existing APIs, data, permissions, and business rules. Preserve Frontend/Backend/MIT and the shared Frontend bridge.

TDD: For implementation in this slice, use real Mobile code through public interfaces with external-boundary mocks only. Develop one observable behavior per RED-GREEN cycle, record meaningful failing/passing evidence, and refactor only while GREEN. For release-only work, verify device evidence rather than manufacturing code changes.

## Acceptance criteria

- [ ] Both sources remain distinguishable, ordered, and selectable; inaccessible or unavailable versions do not pretend to be readable.
- [ ] A free or already-unlocked published uploaded version renders actual Pages; private/draft access follows existing ownership responses.
- [ ] Native resolves existing media origins and query credentials without fabricating tokens; merging/access/media behavior tests pass.

## Blocked by

- [S3 - #727](https://github.com/Slow-Inc/MangaDock/issues/727)
<!-- lang:end -->

<!-- lang:th -->
## Parent / งานหลัก

[Native migration PRD #724](https://github.com/Slow-Inc/MangaDock/issues/724)

## ข้อมูลการส่งมอบ

- Phase: 1
- Type: AFK
- User stories: 11, 13
- Suggested triage: ready-for-agent

## สิ่งที่จะสร้าง

แสดง Chapters จาก MangaDex และ Studio versions ที่เผยแพร่ร่วมกันพร้อมแหล่ง ภาษา availability และราคา แล้วเลือก version อัปโหลดที่เข้าถึงได้และโหลด Pages ผ่าน version/media contracts เดิม

Scope: ส่วน Mobile เท่านั้น ใช้ APIs ข้อมูล สิทธิ์ และกฎธุรกิจเดิม โดยรักษา Frontend/Backend/MIT และ bridge ร่วมของ Frontend

TDD: การ implement ใน slice นี้ใช้ Mobile code จริงผ่าน public interfaces และ mock เฉพาะขอบภายนอก พัฒนาพฤติกรรมที่สังเกตได้ทีละข้อในแต่ละ RED-GREEN cycle บันทึกหลักฐาน fail/pass ที่มีความหมาย และ refactor เฉพาะขณะ GREEN ส่วนงานตรวจ release อย่างเดียวตรวจหลักฐานอุปกรณ์แทนการสร้าง code changes ขึ้นเอง

## เกณฑ์รับงาน

- [ ] ทั้งสองแหล่งแยกได้ เรียงลำดับและเลือกได้ โดย versions ที่เข้าไม่ถึงหรือไม่พร้อมไม่แสดงว่าอ่านได้
- [ ] Version อัปโหลดที่เผยแพร่แบบฟรีหรือปลดล็อกแล้วแสดง Pages จริง โดยสิทธิ์ private/draft เคารพ ownership responses เดิม
- [ ] Native resolve media origins และ query credentials เดิมโดยไม่สร้าง tokens ขึ้นเอง และ behavior tests ของ merging/access/media ผ่าน

## ติดบล็อกโดย

- [S3 - #727](https://github.com/Slow-Inc/MangaDock/issues/727)
<!-- lang:end -->

---

### S5: feat(mobile): native Reader modes zoom and Chapter navigation

<!-- lang:en -->
## Parent

[Native migration PRD #724](https://github.com/Slow-Inc/MangaDock/issues/724)

## Delivery metadata

- Phase: 1
- Type: AFK
- User stories: 14, 15, 16, 17, 47
- Suggested triage: ready-for-agent

## What to build

Read both sources in paged or continuous mode, zoom/pan/reset, jump Pages, choose languages/Chapters, and navigate previous/next Chapter. Keep a bounded mounted/prefetched Page window and derivative-aware image geometry.

Scope: Mobile subsystem only; reuse existing APIs, data, permissions, and business rules. Preserve Frontend/Backend/MIT and the shared Frontend bridge.

TDD: For implementation in this slice, use real Mobile code through public interfaces with external-boundary mocks only. Develop one observable behavior per RED-GREEN cycle, record meaningful failing/passing evidence, and refactor only while GREEN. For release-only work, verify device evidence rather than manufacturing code changes.

## Acceptance criteria

- [ ] Page position, mode changes, zoom controls, Chapter picker, next/previous, and Android back work for both content sources.
- [ ] HD/saver source and display identity remain aligned, and old-Chapter image responses cannot overwrite the current Reader.
- [ ] Bounded mounting/prefetch and image geometry are verified, with behavioral tests for navigation, mode switching, and transforms.

## Blocked by

- [S3 - #727](https://github.com/Slow-Inc/MangaDock/issues/727)
- [S4 - #728](https://github.com/Slow-Inc/MangaDock/issues/728)
<!-- lang:end -->

<!-- lang:th -->
## Parent / งานหลัก

[Native migration PRD #724](https://github.com/Slow-Inc/MangaDock/issues/724)

## ข้อมูลการส่งมอบ

- Phase: 1
- Type: AFK
- User stories: 14, 15, 16, 17, 47
- Suggested triage: ready-for-agent

## สิ่งที่จะสร้าง

อ่านทั้งสองแหล่งแบบทีละหน้าหรือต่อเนื่อง zoom/pan/reset ข้าม Pages เลือกภาษา/Chapters และไป Chapter ก่อน/ถัดไป พร้อมจำกัดหน้าต่าง Page ที่ mount/prefetch และ geometry ภาพตาม derivative

Scope: ส่วน Mobile เท่านั้น ใช้ APIs ข้อมูล สิทธิ์ และกฎธุรกิจเดิม โดยรักษา Frontend/Backend/MIT และ bridge ร่วมของ Frontend

TDD: การ implement ใน slice นี้ใช้ Mobile code จริงผ่าน public interfaces และ mock เฉพาะขอบภายนอก พัฒนาพฤติกรรมที่สังเกตได้ทีละข้อในแต่ละ RED-GREEN cycle บันทึกหลักฐาน fail/pass ที่มีความหมาย และ refactor เฉพาะขณะ GREEN ส่วนงานตรวจ release อย่างเดียวตรวจหลักฐานอุปกรณ์แทนการสร้าง code changes ขึ้นเอง

## เกณฑ์รับงาน

- [ ] ตำแหน่ง Page การเปลี่ยนโหมด control zoom เลือก Chapter ก่อน/ถัดไป และปุ่มย้อนกลับ Android ทำงานทั้งสองแหล่ง
- [ ] ตัวตน source/display ของ HD/saver ตรงกัน และผลภาพของ Chapter เก่าแทน Reader ปัจจุบันไม่ได้
- [ ] ตรวจการจำกัด mount/prefetch และ geometry ภาพ พร้อม behavioral tests ของ navigation เปลี่ยนโหมด และ transforms

## ติดบล็อกโดย

- [S3 - #727](https://github.com/Slow-Inc/MangaDock/issues/727)
- [S4 - #728](https://github.com/Slow-Inc/MangaDock/issues/728)
<!-- lang:end -->

---

### S6: feat(mobile): Single-Page Translation with native Patch rendering

<!-- lang:en -->
## Parent

[Native migration PRD #724](https://github.com/Slow-Inc/MangaDock/issues/724)

## Delivery metadata

- Phase: 1
- Type: AFK
- User stories: 18, 20, 24, 25
- Suggested triage: ready-for-agent

## What to build

Translate the current Page through the existing endpoint and display its Patch Set on the native image. Expose existing language/model availability and original/translated comparison without browser helpers.

Scope: Mobile subsystem only; reuse existing APIs, data, permissions, and business rules. Preserve Frontend/Backend/MIT and the shared Frontend bridge.

TDD: For implementation in this slice, use real Mobile code through public interfaces with external-boundary mocks only. Develop one observable behavior per RED-GREEN cycle, record meaningful failing/passing evidence, and refactor only while GREEN. For release-only work, verify device evidence rather than manufacturing code changes.

## Acceptance criteria

- [ ] A successful request renders normalized Patches correctly through zoom, mode changes, and the selected HD/saver derivative.
- [ ] An empty Patch Set without error is successful; genuine errors and expired clearance show recovery while preserving Chapter/Page.
- [ ] Options follow the existing deployment's supported languages/model family, comparison works, and Patch/translation behavior tests pass.

## Blocked by

- [S5 - #729](https://github.com/Slow-Inc/MangaDock/issues/729)
<!-- lang:end -->

<!-- lang:th -->
## Parent / งานหลัก

[Native migration PRD #724](https://github.com/Slow-Inc/MangaDock/issues/724)

## ข้อมูลการส่งมอบ

- Phase: 1
- Type: AFK
- User stories: 18, 20, 24, 25
- Suggested triage: ready-for-agent

## สิ่งที่จะสร้าง

แปล Page ปัจจุบันผ่าน endpoint เดิมและแสดง Patch Set บนภาพ native พร้อม options ภาษา/model ที่มีเดิมและเปรียบเทียบต้นฉบับ/คำแปลโดยไม่ใช้ browser helpers

Scope: ส่วน Mobile เท่านั้น ใช้ APIs ข้อมูล สิทธิ์ และกฎธุรกิจเดิม โดยรักษา Frontend/Backend/MIT และ bridge ร่วมของ Frontend

TDD: การ implement ใน slice นี้ใช้ Mobile code จริงผ่าน public interfaces และ mock เฉพาะขอบภายนอก พัฒนาพฤติกรรมที่สังเกตได้ทีละข้อในแต่ละ RED-GREEN cycle บันทึกหลักฐาน fail/pass ที่มีความหมาย และ refactor เฉพาะขณะ GREEN ส่วนงานตรวจ release อย่างเดียวตรวจหลักฐานอุปกรณ์แทนการสร้าง code changes ขึ้นเอง

## เกณฑ์รับงาน

- [ ] คำขอสำเร็จแสดง normalized Patches ถูกต้องขณะ zoom เปลี่ยนโหมด และใช้ derivative HD/saver ที่เลือก
- [ ] Patch Set ว่างที่ไม่มี error ถือว่าสำเร็จ โดย errors จริงและ clearance หมดอายุแสดงทางกู้พร้อมรักษา Chapter/Page
- [ ] Options ตามภาษา/model family ที่ deployment เดิมรองรับ การเปรียบเทียบทำงาน และ behavior tests ของ Patch/translation ผ่าน

## ติดบล็อกโดย

- [S5 - #729](https://github.com/Slow-Inc/MangaDock/issues/729)
<!-- lang:end -->

---

### S7: feat(mobile): Batch Translation progress cancel and restart

<!-- lang:en -->
## Parent

[Native migration PRD #724](https://github.com/Slow-Inc/MangaDock/issues/724)

## Delivery metadata

- Phase: 1
- Type: AFK
- User stories: 19, 21, 22, 23, 25
- Suggested triage: ready-for-agent

## What to build

Submit the complete canonical Chapter page list to the existing batch endpoint, consume authenticated POST SSE, and render each returned Page. Support truthful progress/failures, foreground Reader cancellation, and deliberate restart through existing cache/context rules.

Scope: Mobile subsystem only; reuse existing APIs, data, permissions, and business rules. Preserve Frontend/Backend/MIT and the shared Frontend bridge.

TDD: For implementation in this slice, use real Mobile code through public interfaces with external-boundary mocks only. Develop one observable behavior per RED-GREEN cycle, record meaningful failing/passing evidence, and refactor only while GREEN. For release-only work, verify device evidence rather than manufacturing code changes.

## Acceptance criteria

- [ ] Both content sources receive successful Page results incrementally; stage events do not count as completion and failed Pages remain failed.
- [ ] Split/coalesced frames, duplicate events, empty successes, connection errors including negative-index events, and incomplete/timeouts are handled without false success.
- [ ] Cancel, Reader exit, and app background close the client request; UX explains page-boundary server cancellation and restart is user-initiated.
- [ ] Submissions preserve complete Chapter order, options, and derivative; Backend cache/context semantics remain authoritative and SSE/lifecycle behavior tests pass.

## Blocked by

- [S6 - #730](https://github.com/Slow-Inc/MangaDock/issues/730)
<!-- lang:end -->

<!-- lang:th -->
## Parent / งานหลัก

[Native migration PRD #724](https://github.com/Slow-Inc/MangaDock/issues/724)

## ข้อมูลการส่งมอบ

- Phase: 1
- Type: AFK
- User stories: 19, 21, 22, 23, 25
- Suggested triage: ready-for-agent

## สิ่งที่จะสร้าง

ส่งรายการ Page ของ Chapter ครบตามลำดับไป batch endpoint เดิม รับ POST SSE ที่ยืนยันตัวตน และแสดง Page ที่ส่งกลับ พร้อม progress/ความล้มเหลวตรงจริง ยกเลิกเมื่อออก Reader ด้านหน้า และเริ่มใหม่อย่างตั้งใจผ่านกฎ cache/context เดิม

Scope: ส่วน Mobile เท่านั้น ใช้ APIs ข้อมูล สิทธิ์ และกฎธุรกิจเดิม โดยรักษา Frontend/Backend/MIT และ bridge ร่วมของ Frontend

TDD: การ implement ใน slice นี้ใช้ Mobile code จริงผ่าน public interfaces และ mock เฉพาะขอบภายนอก พัฒนาพฤติกรรมที่สังเกตได้ทีละข้อในแต่ละ RED-GREEN cycle บันทึกหลักฐาน fail/pass ที่มีความหมาย และ refactor เฉพาะขณะ GREEN ส่วนงานตรวจ release อย่างเดียวตรวจหลักฐานอุปกรณ์แทนการสร้าง code changes ขึ้นเอง

## เกณฑ์รับงาน

- [ ] ทั้งสองแหล่งรับผล Page สำเร็จทีละหน้า โดย stage events ไม่ถูกนับว่าจบ และ Page ที่ล้มเหลวยังคงล้มเหลว
- [ ] จัดการ frames ที่แยก/รวม events ซ้ำ ผลสำเร็จว่าง error การเชื่อมต่อรวม index ติดลบ และผลไม่ครบ/timeout โดยไม่รายงานสำเร็จผิด
- [ ] กดยกเลิก ออก Reader และแอปไปเบื้องหลังปิดคำขอ client โดย UX อธิบายการยกเลิก server ที่ขอบหน้า และผู้ใช้เป็นผู้เริ่มใหม่
- [ ] การส่งรักษาลำดับ Chapter ครบ options และ derivative โดย semantics cache/context ของ Backend เป็นหลัก และ behavior tests ของ SSE/lifecycle ผ่าน

## ติดบล็อกโดย

- [S6 - #730](https://github.com/Slow-Inc/MangaDock/issues/730)
<!-- lang:end -->

---

### S8: feat(mobile): coin balance and paid Chapter unlock to Reader

<!-- lang:en -->
## Parent

[Native migration PRD #724](https://github.com/Slow-Inc/MangaDock/issues/724)

## Delivery metadata

- Phase: 1
- Type: AFK
- User stories: 26, 27
- Suggested triage: ready-for-agent

## What to build

Display the existing balance and Chapter price, confirm a paid uploaded-version purchase, call the existing atomic unlock API once, refresh server-derived access/balance, and open the native Reader.

Scope: Mobile subsystem only; reuse existing APIs, data, permissions, and business rules. Preserve Frontend/Backend/MIT and the shared Frontend bridge.

TDD: For implementation in this slice, use real Mobile code through public interfaces with external-boundary mocks only. Develop one observable behavior per RED-GREEN cycle, record meaningful failing/passing evidence, and refactor only while GREEN. For release-only work, verify device evidence rather than manufacturing code changes.

## Acceptance criteria

- [ ] Free, already-unlocked, and newly purchased published versions follow existing access responses and reach native reading when allowed.
- [ ] Repeated taps cannot submit duplicate purchases; already-unlocked, insufficient, unpublished/denied, and failed results are shown accurately.
- [ ] Displayed balance/access refresh from existing APIs, no client-owned price/debit logic is added, and purchase-state behavior tests pass.

## Blocked by

- [S1 - #725](https://github.com/Slow-Inc/MangaDock/issues/725)
- [S4 - #728](https://github.com/Slow-Inc/MangaDock/issues/728)
<!-- lang:end -->

<!-- lang:th -->
## Parent / งานหลัก

[Native migration PRD #724](https://github.com/Slow-Inc/MangaDock/issues/724)

## ข้อมูลการส่งมอบ

- Phase: 1
- Type: AFK
- User stories: 26, 27
- Suggested triage: ready-for-agent

## สิ่งที่จะสร้าง

แสดงยอดและราคา Chapter เดิม ยืนยันซื้อ uploaded version ที่มีราคา เรียก atomic unlock API เดิมครั้งเดียว refresh สิทธิ์/ยอดตาม server และเปิด native Reader

Scope: ส่วน Mobile เท่านั้น ใช้ APIs ข้อมูล สิทธิ์ และกฎธุรกิจเดิม โดยรักษา Frontend/Backend/MIT และ bridge ร่วมของ Frontend

TDD: การ implement ใน slice นี้ใช้ Mobile code จริงผ่าน public interfaces และ mock เฉพาะขอบภายนอก พัฒนาพฤติกรรมที่สังเกตได้ทีละข้อในแต่ละ RED-GREEN cycle บันทึกหลักฐาน fail/pass ที่มีความหมาย และ refactor เฉพาะขณะ GREEN ส่วนงานตรวจ release อย่างเดียวตรวจหลักฐานอุปกรณ์แทนการสร้าง code changes ขึ้นเอง

## เกณฑ์รับงาน

- [ ] Versions ที่เผยแพร่แบบฟรี ปลดล็อกแล้ว และซื้อใหม่เคารพ access responses เดิม และอ่าน native ได้เมื่ออนุญาต
- [ ] การกดซ้ำส่งซื้อซ้ำไม่ได้ โดยแสดงผล already-unlocked, insufficient, unpublished/denied และ failed ถูกต้อง
- [ ] ยอด/สิทธิ์ที่แสดง refresh จาก APIs เดิม ไม่เพิ่ม logic ราคา/debit ที่ client ตัดสิน และ behavior tests ของ purchase-state ผ่าน

## ติดบล็อกโดย

- [S1 - #725](https://github.com/Slow-Inc/MangaDock/issues/725)
- [S4 - #728](https://github.com/Slow-Inc/MangaDock/issues/728)
<!-- lang:end -->

---

### S9: feat(mobile): native QR topup with banking-app recovery

<!-- lang:en -->
## Parent

[Native migration PRD #724](https://github.com/Slow-Inc/MangaDock/issues/724)

## Delivery metadata

- Phase: 1
- Type: AFK
- User stories: 28, 29, 30
- Suggested triage: ready-for-agent

## What to build

From insufficient balance, choose an existing topup amount, create/display its QR, receive confirmation, and return to the intended Chapter. Persist account-scoped pending-payment identity and reconcile on foreground/relaunch using the existing status API and SSE.

Scope: Mobile subsystem only; reuse existing APIs, data, permissions, and business rules. Preserve Frontend/Backend/MIT and the shared Frontend bridge.

TDD: For implementation in this slice, use real Mobile code through public interfaces with external-boundary mocks only. Develop one observable behavior per RED-GREEN cycle, record meaningful failing/passing evidence, and refactor only while GREEN. For release-only work, verify device evidence rather than manufacturing code changes.

## Acceptance criteria

- [ ] QR creation, native display, expiry, cancellation, confirmed balance, and return-to-Chapter use existing APIs and never locally mint coins.
- [ ] Returning from a banking app or process restart restores the same payment, checks server status before local expiry, and does not create another topup automatically.
- [ ] Confirmation lost during backgrounding is recovered through the status endpoint; only pending streams reconnect and payment state is isolated by account.
- [ ] Lifecycle/payment tests pass, and sandbox or explicitly provisioned test-payment verification records the complete purchase-to-reading path.

## Blocked by

- [S8 - #732](https://github.com/Slow-Inc/MangaDock/issues/732)
<!-- lang:end -->

<!-- lang:th -->
## Parent / งานหลัก

[Native migration PRD #724](https://github.com/Slow-Inc/MangaDock/issues/724)

## ข้อมูลการส่งมอบ

- Phase: 1
- Type: AFK
- User stories: 28, 29, 30
- Suggested triage: ready-for-agent

## สิ่งที่จะสร้าง

จากยอดไม่พอ เลือกจำนวนเติมเงินเดิม สร้าง/แสดง QR รับยืนยัน และกลับ Chapter ที่ตั้งใจ พร้อมเก็บตัวตนรายการชำระที่รอแยกบัญชีและ reconcile เมื่อกลับด้านหน้า/เปิดใหม่ด้วย status API และ SSE เดิม

Scope: ส่วน Mobile เท่านั้น ใช้ APIs ข้อมูล สิทธิ์ และกฎธุรกิจเดิม โดยรักษา Frontend/Backend/MIT และ bridge ร่วมของ Frontend

TDD: การ implement ใน slice นี้ใช้ Mobile code จริงผ่าน public interfaces และ mock เฉพาะขอบภายนอก พัฒนาพฤติกรรมที่สังเกตได้ทีละข้อในแต่ละ RED-GREEN cycle บันทึกหลักฐาน fail/pass ที่มีความหมาย และ refactor เฉพาะขณะ GREEN ส่วนงานตรวจ release อย่างเดียวตรวจหลักฐานอุปกรณ์แทนการสร้าง code changes ขึ้นเอง

## เกณฑ์รับงาน

- [ ] การสร้าง QR แสดง native หมดอายุ ยกเลิก ยอดยืนยัน และกลับ Chapter ใช้ APIs เดิมและไม่สร้างเหรียญในเครื่อง
- [ ] กลับจากแอปธนาคารหรือ process restart กู้รายการเดิม ตรวจ server status ก่อน expiry ในเครื่อง และไม่สร้าง topup ใหม่อัตโนมัติ
- [ ] การยืนยันที่พลาดระหว่างเบื้องหลังกู้ผ่าน status endpoint โดยเชื่อมใหม่เฉพาะ stream ที่รอและแยกสถานะชำระตามบัญชี
- [ ] Lifecycle/payment tests ผ่าน และการตรวจด้วย sandbox หรือรายการชำระทดสอบที่จัดเตรียมชัดเจนบันทึก flow ซื้อไปอ่านครบ

## ติดบล็อกโดย

- [S8 - #732](https://github.com/Slow-Inc/MangaDock/issues/732)
<!-- lang:end -->

---

### S10: release(mobile): Phase 1 native Android APK beta verification

<!-- lang:en -->
## Parent

[Native migration PRD #724](https://github.com/Slow-Inc/MangaDock/issues/724)

## Delivery metadata

- Phase: 1
- Type: HITL
- User stories: 1, 31, 48
- Suggested triage: ready-for-human

## What to build

Build/install the internal APK and verify the full Phase 1 native reading/purchase/translation journey on physical Android. Provide beta scope and redacted diagnostics, document device evidence and baseline reader observations, and make the APK available to the team.

Scope: Mobile subsystem only; reuse existing APIs, data, permissions, and business rules. Preserve Frontend/Backend/MIT and the shared Frontend bridge.

TDD: For implementation in this slice, use real Mobile code through public interfaces with external-boundary mocks only. Develop one observable behavior per RED-GREEN cycle, record meaningful failing/passing evidence, and refactor only while GREEN. For release-only work, verify device evidence rather than manufacturing code changes.

## Acceptance criteria

- [ ] Mobile typecheck and affected behavior tests pass; a signed internal APK is built, installed, and identified by version/build metadata.
- [ ] Physical-device email/OAuth/TOTP where enrolled, browser captcha, both content sources, reader controls, both translation modes, cancel/restart, and controlled paid reading are evidenced.
- [ ] No embedded WebView is required for product or captcha screens, the shared bridge remains compatible, and secrets/full callback URLs are absent from diagnostics.
- [ ] The APK and release notes identify implemented and later-phase workflows, plus honest image/Patch/performance observations and unresolved prerequisites.

## Blocked by

- [S2 - #726](https://github.com/Slow-Inc/MangaDock/issues/726)
- [S5 - #729](https://github.com/Slow-Inc/MangaDock/issues/729)
- [S7 - #731](https://github.com/Slow-Inc/MangaDock/issues/731)
- [S9 - #733](https://github.com/Slow-Inc/MangaDock/issues/733)
<!-- lang:end -->

<!-- lang:th -->
## Parent / งานหลัก

[Native migration PRD #724](https://github.com/Slow-Inc/MangaDock/issues/724)

## ข้อมูลการส่งมอบ

- Phase: 1
- Type: HITL
- User stories: 1, 31, 48
- Suggested triage: ready-for-human

## สิ่งที่จะสร้าง

Build/ติดตั้ง internal APK และตรวจเส้นทางอ่าน/ซื้อ/แปล native ของ Phase 1 ครบบน Android จริง พร้อม scope beta และ diagnostics ที่ปิดข้อมูลสำคัญ บันทึกหลักฐานอุปกรณ์และข้อสังเกต Reader เทียบ baseline และส่ง APK ให้ทีม

Scope: ส่วน Mobile เท่านั้น ใช้ APIs ข้อมูล สิทธิ์ และกฎธุรกิจเดิม โดยรักษา Frontend/Backend/MIT และ bridge ร่วมของ Frontend

TDD: การ implement ใน slice นี้ใช้ Mobile code จริงผ่าน public interfaces และ mock เฉพาะขอบภายนอก พัฒนาพฤติกรรมที่สังเกตได้ทีละข้อในแต่ละ RED-GREEN cycle บันทึกหลักฐาน fail/pass ที่มีความหมาย และ refactor เฉพาะขณะ GREEN ส่วนงานตรวจ release อย่างเดียวตรวจหลักฐานอุปกรณ์แทนการสร้าง code changes ขึ้นเอง

## เกณฑ์รับงาน

- [ ] Mobile typecheck และ behavior tests ที่กระทบผ่าน โดย build/ติดตั้ง signed internal APK และระบุ version/build metadata
- [ ] มีหลักฐานบนอุปกรณ์จริงของ email/OAuth/TOTP เมื่อเปิดไว้ captcha ผ่าน browser ทั้งสองแหล่ง control อ่าน สองโหมดแปล cancel/restart และอ่านแบบชำระที่ควบคุม
- [ ] หน้าจอผลิตภัณฑ์หรือ captcha ไม่ต้องใช้ embedded WebView โดย shared bridge ยัง compatible และ diagnostics ไม่มี secrets/URL callback เต็ม
- [ ] APK และ release notes ระบุ workflows ที่ทำแล้วกับ phase ภายหลัง พร้อมข้อสังเกตภาพ/Patch/performance ตรงจริงและ prerequisites ที่ยังไม่ครบ

## ติดบล็อกโดย

- [S2 - #726](https://github.com/Slow-Inc/MangaDock/issues/726)
- [S5 - #729](https://github.com/Slow-Inc/MangaDock/issues/729)
- [S7 - #731](https://github.com/Slow-Inc/MangaDock/issues/731)
- [S9 - #733](https://github.com/Slow-Inc/MangaDock/issues/733)
<!-- lang:end -->

---

### S11: feat(mobile): native catalog discovery and related manga

<!-- lang:en -->
## Parent

[Native migration PRD #724](https://github.com/Slow-Inc/MangaDock/issues/724)

## Delivery metadata

- Phase: 2
- Type: AFK
- User stories: 9, 10
- Suggested triage: ready-for-agent

## What to build

Browse existing home feeds, new releases, genres, and related manga natively, then enter the same details-to-Reader flow without inventing recommendations or new Backend endpoints.

Scope: Mobile subsystem only; reuse existing APIs, data, permissions, and business rules. Preserve Frontend/Backend/MIT and the shared Frontend bridge.

TDD: For implementation in this slice, use real Mobile code through public interfaces with external-boundary mocks only. Develop one observable behavior per RED-GREEN cycle, record meaningful failing/passing evidence, and refactor only while GREEN. For release-only work, verify device evidence rather than manufacturing code changes.

## Acceptance criteria

- [ ] Existing discovery entry points fetch real server data and lead to the correct manga details/Chapter choice.
- [ ] Pagination, filters, empty/error states, and obsolete-request isolation work with reused contracts.
- [ ] Discovery navigation/contract behavior tests pass.

## Blocked by

- [S3 - #727](https://github.com/Slow-Inc/MangaDock/issues/727)
<!-- lang:end -->

<!-- lang:th -->
## Parent / งานหลัก

[Native migration PRD #724](https://github.com/Slow-Inc/MangaDock/issues/724)

## ข้อมูลการส่งมอบ

- Phase: 2
- Type: AFK
- User stories: 9, 10
- Suggested triage: ready-for-agent

## สิ่งที่จะสร้าง

ดู home feeds เรื่องใหม่ หมวด และมังงะเกี่ยวข้องเดิมแบบ native แล้วเข้า flow รายละเอียดไป Reader เดียวกัน โดยไม่สร้างคำแนะนำหรือ Backend endpoints ใหม่

Scope: ส่วน Mobile เท่านั้น ใช้ APIs ข้อมูล สิทธิ์ และกฎธุรกิจเดิม โดยรักษา Frontend/Backend/MIT และ bridge ร่วมของ Frontend

TDD: การ implement ใน slice นี้ใช้ Mobile code จริงผ่าน public interfaces และ mock เฉพาะขอบภายนอก พัฒนาพฤติกรรมที่สังเกตได้ทีละข้อในแต่ละ RED-GREEN cycle บันทึกหลักฐาน fail/pass ที่มีความหมาย และ refactor เฉพาะขณะ GREEN ส่วนงานตรวจ release อย่างเดียวตรวจหลักฐานอุปกรณ์แทนการสร้าง code changes ขึ้นเอง

## เกณฑ์รับงาน

- [ ] จุดเข้าค้นพบเดิมดึงข้อมูลจริงจาก server และไปถึงรายละเอียด/เลือก Chapter ที่ถูกต้อง
- [ ] การแบ่งหน้า filters สถานะว่าง/ผิดพลาด และแยกคำขอเก่าทำงานด้วย contracts ที่ใช้เดิม
- [ ] Behavior tests ของ discovery navigation/contract ผ่าน

## ติดบล็อกโดย

- [S3 - #727](https://github.com/Slow-Inc/MangaDock/issues/727)
<!-- lang:end -->

---

### S12: feat(mobile): library history and continue-reading parity

<!-- lang:en -->
## Parent

[Native migration PRD #724](https://github.com/Slow-Inc/MangaDock/issues/724)

## Delivery metadata

- Phase: 2
- Type: AFK
- User stories: 32, 6
- Suggested triage: ready-for-agent

## What to build

Use the existing library/bookmark and reading-history APIs to save/read personal state and resume the correct Chapter/Page across native sessions and the web account.

Scope: Mobile subsystem only; reuse existing APIs, data, permissions, and business rules. Preserve Frontend/Backend/MIT and the shared Frontend bridge.

TDD: For implementation in this slice, use real Mobile code through public interfaces with external-boundary mocks only. Develop one observable behavior per RED-GREEN cycle, record meaningful failing/passing evidence, and refactor only while GREEN. For release-only work, verify device evidence rather than manufacturing code changes.

## Acceptance criteria

- [ ] Existing library actions and continue-reading operate against the same account/server data as the web client.
- [ ] Chapter/Page progress is restored and stale requests from another identity cannot mutate or delete the current user's history.
- [ ] History/library/resume/account-isolation behavior tests pass.

## Blocked by

- [S1 - #725](https://github.com/Slow-Inc/MangaDock/issues/725)
- [S5 - #729](https://github.com/Slow-Inc/MangaDock/issues/729)
<!-- lang:end -->

<!-- lang:th -->
## Parent / งานหลัก

[Native migration PRD #724](https://github.com/Slow-Inc/MangaDock/issues/724)

## ข้อมูลการส่งมอบ

- Phase: 2
- Type: AFK
- User stories: 32, 6
- Suggested triage: ready-for-agent

## สิ่งที่จะสร้าง

ใช้ APIs library/bookmark และประวัติอ่านเดิมเพื่อบันทึก/อ่านสถานะส่วนตัว และอ่านต่อที่ Chapter/Page ถูกต้องข้าม session native กับบัญชีเว็บ

Scope: ส่วน Mobile เท่านั้น ใช้ APIs ข้อมูล สิทธิ์ และกฎธุรกิจเดิม โดยรักษา Frontend/Backend/MIT และ bridge ร่วมของ Frontend

TDD: การ implement ใน slice นี้ใช้ Mobile code จริงผ่าน public interfaces และ mock เฉพาะขอบภายนอก พัฒนาพฤติกรรมที่สังเกตได้ทีละข้อในแต่ละ RED-GREEN cycle บันทึกหลักฐาน fail/pass ที่มีความหมาย และ refactor เฉพาะขณะ GREEN ส่วนงานตรวจ release อย่างเดียวตรวจหลักฐานอุปกรณ์แทนการสร้าง code changes ขึ้นเอง

## เกณฑ์รับงาน

- [ ] Actions ของ library และอ่านต่อเดิมทำงานกับบัญชี/ข้อมูล server เดียวกับเว็บ
- [ ] กู้ progress ของ Chapter/Page และคำขอเก่าจากตัวตนอื่นแก้หรือลบประวัติของผู้ใช้ปัจจุบันไม่ได้
- [ ] Behavior tests ของ history/library/resume/account-isolation ผ่าน

## ติดบล็อกโดย

- [S1 - #725](https://github.com/Slow-Inc/MangaDock/issues/725)
- [S5 - #729](https://github.com/Slow-Inc/MangaDock/issues/729)
<!-- lang:end -->

---

### S13: feat(mobile): ratings reviews Reader comments and reports

<!-- lang:en -->
## Parent

[Native migration PRD #724](https://github.com/Slow-Inc/MangaDock/issues/724)

## Delivery metadata

- Phase: 2
- Type: AFK
- User stories: 33
- Suggested triage: ready-for-agent

## What to build

Read and perform the existing ratings/reviews, Reader comments, and related reporting actions from manga/native Reader context, preserving identity and moderation responses.

Scope: Mobile subsystem only; reuse existing APIs, data, permissions, and business rules. Preserve Frontend/Backend/MIT and the shared Frontend bridge.

TDD: For implementation in this slice, use real Mobile code through public interfaces with external-boundary mocks only. Develop one observable behavior per RED-GREEN cycle, record meaningful failing/passing evidence, and refactor only while GREEN. For release-only work, verify device evidence rather than manufacturing code changes.

## Acceptance criteria

- [ ] Supported read/write/edit/delete actions follow the current product/API baseline and retain manga/Chapter context.
- [ ] Unauthenticated, forbidden, and reported-content states follow server responses without fabricated success.
- [ ] Review/comment/report interaction and permission behavior tests pass.

## Blocked by

- [S1 - #725](https://github.com/Slow-Inc/MangaDock/issues/725)
- [S4 - #728](https://github.com/Slow-Inc/MangaDock/issues/728)
<!-- lang:end -->

<!-- lang:th -->
## Parent / งานหลัก

[Native migration PRD #724](https://github.com/Slow-Inc/MangaDock/issues/724)

## ข้อมูลการส่งมอบ

- Phase: 2
- Type: AFK
- User stories: 33
- Suggested triage: ready-for-agent

## สิ่งที่จะสร้าง

อ่านและทำ ratings/reviews, comments ใน Reader และ reporting actions ที่เกี่ยวข้องเดิมจากบริบทมังงะ/native Reader โดยรักษาตัวตนและ moderation responses

Scope: ส่วน Mobile เท่านั้น ใช้ APIs ข้อมูล สิทธิ์ และกฎธุรกิจเดิม โดยรักษา Frontend/Backend/MIT และ bridge ร่วมของ Frontend

TDD: การ implement ใน slice นี้ใช้ Mobile code จริงผ่าน public interfaces และ mock เฉพาะขอบภายนอก พัฒนาพฤติกรรมที่สังเกตได้ทีละข้อในแต่ละ RED-GREEN cycle บันทึกหลักฐาน fail/pass ที่มีความหมาย และ refactor เฉพาะขณะ GREEN ส่วนงานตรวจ release อย่างเดียวตรวจหลักฐานอุปกรณ์แทนการสร้าง code changes ขึ้นเอง

## เกณฑ์รับงาน

- [ ] Actions อ่าน/เขียน/แก้/ลบที่รองรับตาม baseline ผลิตภัณฑ์/API ปัจจุบันและรักษาบริบทมังงะ/Chapter
- [ ] สถานะไม่เข้าสู่ระบบ ไม่มีสิทธิ์ และเนื้อหาที่รายงานเคารพผล server โดยไม่รายงานสำเร็จสร้างขึ้น
- [ ] Behavior tests ของ interactions และสิทธิ์ review/comment/report ผ่าน

## ติดบล็อกโดย

- [S1 - #725](https://github.com/Slow-Inc/MangaDock/issues/725)
- [S4 - #728](https://github.com/Slow-Inc/MangaDock/issues/728)
<!-- lang:end -->

---

### S14: feat(mobile): public profiles and existing follows

<!-- lang:en -->
## Parent

[Native migration PRD #724](https://github.com/Slow-Inc/MangaDock/issues/724)

## Delivery metadata

- Phase: 2
- Type: AFK
- User stories: 34
- Suggested triage: ready-for-agent

## What to build

Open existing public profiles from native content and follow/unfollow through the current APIs, with consistent server-derived counts and account isolation.

Scope: Mobile subsystem only; reuse existing APIs, data, permissions, and business rules. Preserve Frontend/Backend/MIT and the shared Frontend bridge.

TDD: For implementation in this slice, use real Mobile code through public interfaces with external-boundary mocks only. Develop one observable behavior per RED-GREEN cycle, record meaningful failing/passing evidence, and refactor only while GREEN. For release-only work, verify device evidence rather than manufacturing code changes.

## Acceptance criteria

- [ ] Existing public profile information and supported follow actions are reachable from content/user references.
- [ ] Counts and permissions reconcile with server results on mutation failure or account change.
- [ ] Profile/follow behavior tests pass.

## Blocked by

- [S1 - #725](https://github.com/Slow-Inc/MangaDock/issues/725)
<!-- lang:end -->

<!-- lang:th -->
## Parent / งานหลัก

[Native migration PRD #724](https://github.com/Slow-Inc/MangaDock/issues/724)

## ข้อมูลการส่งมอบ

- Phase: 2
- Type: AFK
- User stories: 34
- Suggested triage: ready-for-agent

## สิ่งที่จะสร้าง

เปิด public profiles เดิมจากเนื้อหา native และ follow/unfollow ผ่าน APIs ปัจจุบัน พร้อมจำนวนตาม server ที่สอดคล้องและแยกบัญชี

Scope: ส่วน Mobile เท่านั้น ใช้ APIs ข้อมูล สิทธิ์ และกฎธุรกิจเดิม โดยรักษา Frontend/Backend/MIT และ bridge ร่วมของ Frontend

TDD: การ implement ใน slice นี้ใช้ Mobile code จริงผ่าน public interfaces และ mock เฉพาะขอบภายนอก พัฒนาพฤติกรรมที่สังเกตได้ทีละข้อในแต่ละ RED-GREEN cycle บันทึกหลักฐาน fail/pass ที่มีความหมาย และ refactor เฉพาะขณะ GREEN ส่วนงานตรวจ release อย่างเดียวตรวจหลักฐานอุปกรณ์แทนการสร้าง code changes ขึ้นเอง

## เกณฑ์รับงาน

- [ ] ข้อมูล public profile เดิมและ follow actions ที่รองรับเข้าถึงจากการอ้างอิงเนื้อหา/ผู้ใช้ได้
- [ ] จำนวนและสิทธิ์ reconcile กับผล server เมื่อ mutation ล้มเหลวหรือเปลี่ยนบัญชี
- [ ] Behavior tests ของ profile/follow ผ่าน

## ติดบล็อกโดย

- [S1 - #725](https://github.com/Slow-Inc/MangaDock/issues/725)
<!-- lang:end -->

---

### S15: feat(mobile): daily check-in and coin-reward states

<!-- lang:en -->
## Parent

[Native migration PRD #724](https://github.com/Slow-Inc/MangaDock/issues/724)

## Delivery metadata

- Phase: 2
- Type: AFK
- User stories: 35
- Suggested triage: ready-for-agent

## What to build

Claim the existing daily check-in reward from native, display server-derived eligibility/result, and refresh balance using existing reward and Wallet APIs.

Scope: Mobile subsystem only; reuse existing APIs, data, permissions, and business rules. Preserve Frontend/Backend/MIT and the shared Frontend bridge.

TDD: For implementation in this slice, use real Mobile code through public interfaces with external-boundary mocks only. Develop one observable behavior per RED-GREEN cycle, record meaningful failing/passing evidence, and refactor only while GREEN. For release-only work, verify device evidence rather than manufacturing code changes.

## Acceptance criteria

- [ ] Eligible and already-claimed states follow the existing server contract and no local coin credit is invented.
- [ ] Duplicate taps are suppressed and failures leave an honest retryable state with balance reconciled from server.
- [ ] Check-in/reward/balance behavior tests pass.

## Blocked by

- [S8 - #732](https://github.com/Slow-Inc/MangaDock/issues/732)
<!-- lang:end -->

<!-- lang:th -->
## Parent / งานหลัก

[Native migration PRD #724](https://github.com/Slow-Inc/MangaDock/issues/724)

## ข้อมูลการส่งมอบ

- Phase: 2
- Type: AFK
- User stories: 35
- Suggested triage: ready-for-agent

## สิ่งที่จะสร้าง

รับรางวัล check-in รายวันเดิมจาก native แสดง eligibility/ผลตาม server และ refresh ยอดผ่าน reward กับ Wallet APIs เดิม

Scope: ส่วน Mobile เท่านั้น ใช้ APIs ข้อมูล สิทธิ์ และกฎธุรกิจเดิม โดยรักษา Frontend/Backend/MIT และ bridge ร่วมของ Frontend

TDD: การ implement ใน slice นี้ใช้ Mobile code จริงผ่าน public interfaces และ mock เฉพาะขอบภายนอก พัฒนาพฤติกรรมที่สังเกตได้ทีละข้อในแต่ละ RED-GREEN cycle บันทึกหลักฐาน fail/pass ที่มีความหมาย และ refactor เฉพาะขณะ GREEN ส่วนงานตรวจ release อย่างเดียวตรวจหลักฐานอุปกรณ์แทนการสร้าง code changes ขึ้นเอง

## เกณฑ์รับงาน

- [ ] สถานะมีสิทธิ์และรับแล้วเคารพ contract server เดิมโดยไม่สร้างการเพิ่มเหรียญในเครื่อง
- [ ] ระงับการกดซ้ำ และความล้มเหลวคงสถานะลองใหม่ที่ตรงจริงพร้อม reconcile ยอดจาก server
- [ ] Behavior tests ของ check-in/reward/balance ผ่าน

## ติดบล็อกโดย

- [S8 - #732](https://github.com/Slow-Inc/MangaDock/issues/732)
<!-- lang:end -->

---

### S16: feat(mobile): native in-app notifications and destination links

<!-- lang:en -->
## Parent

[Native migration PRD #724](https://github.com/Slow-Inc/MangaDock/issues/724)

## Delivery metadata

- Phase: 2
- Type: AFK
- User stories: 35, 47
- Suggested triage: ready-for-agent

## What to build

List and acknowledge existing in-app notifications and navigate supported destinations into native product screens. Reuse existing refresh/event contracts without adding push infrastructure.

Scope: Mobile subsystem only; reuse existing APIs, data, permissions, and business rules. Preserve Frontend/Backend/MIT and the shared Frontend bridge.

TDD: For implementation in this slice, use real Mobile code through public interfaces with external-boundary mocks only. Develop one observable behavior per RED-GREEN cycle, record meaningful failing/passing evidence, and refactor only while GREEN. For release-only work, verify device evidence rather than manufacturing code changes.

## Acceptance criteria

- [ ] Existing notification list/unread/read behavior is preserved for the authenticated account.
- [ ] Delivered destination screens open natively; undelivered beta destinations are identified honestly and never fall back to embedded WebView.
- [ ] Notification/account-isolation/destination behavior tests pass.

## Blocked by

- [S1 - #725](https://github.com/Slow-Inc/MangaDock/issues/725)
<!-- lang:end -->

<!-- lang:th -->
## Parent / งานหลัก

[Native migration PRD #724](https://github.com/Slow-Inc/MangaDock/issues/724)

## ข้อมูลการส่งมอบ

- Phase: 2
- Type: AFK
- User stories: 35, 47
- Suggested triage: ready-for-agent

## สิ่งที่จะสร้าง

แสดงและรับทราบ notifications ภายในแอปเดิม แล้วไปปลายทางที่รองรับในหน้าจอผลิตภัณฑ์ native โดยใช้ refresh/event contracts เดิมและไม่เพิ่ม push infrastructure

Scope: ส่วน Mobile เท่านั้น ใช้ APIs ข้อมูล สิทธิ์ และกฎธุรกิจเดิม โดยรักษา Frontend/Backend/MIT และ bridge ร่วมของ Frontend

TDD: การ implement ใน slice นี้ใช้ Mobile code จริงผ่าน public interfaces และ mock เฉพาะขอบภายนอก พัฒนาพฤติกรรมที่สังเกตได้ทีละข้อในแต่ละ RED-GREEN cycle บันทึกหลักฐาน fail/pass ที่มีความหมาย และ refactor เฉพาะขณะ GREEN ส่วนงานตรวจ release อย่างเดียวตรวจหลักฐานอุปกรณ์แทนการสร้าง code changes ขึ้นเอง

## เกณฑ์รับงาน

- [ ] รักษาพฤติกรรมรายการ/unread/read ของ notifications เดิมสำหรับบัญชีที่ยืนยันตัวตน
- [ ] หน้าจอปลายทางที่ส่งมอบเปิด native โดยปลายทาง beta ที่ยังไม่ส่งมอบระบุอย่างตรงจริงและไม่ fallback embedded WebView
- [ ] Behavior tests ของ notification/account-isolation/destination ผ่าน

## ติดบล็อกโดย

- [S1 - #725](https://github.com/Slow-Inc/MangaDock/issues/725)
<!-- lang:end -->

---

### S17: feat(mobile): profile preferences and account statistics

<!-- lang:en -->
## Parent

[Native migration PRD #724](https://github.com/Slow-Inc/MangaDock/issues/724)

## Delivery metadata

- Phase: 2
- Type: AFK
- User stories: 36
- Suggested triage: ready-for-agent

## What to build

Read/edit existing profile and preferences and view existing account statistics through native settings, preserving current validation and server-backed state.

Scope: Mobile subsystem only; reuse existing APIs, data, permissions, and business rules. Preserve Frontend/Backend/MIT and the shared Frontend bridge.

TDD: For implementation in this slice, use real Mobile code through public interfaces with external-boundary mocks only. Develop one observable behavior per RED-GREEN cycle, record meaningful failing/passing evidence, and refactor only while GREEN. For release-only work, verify device evidence rather than manufacturing code changes.

## Acceptance criteria

- [ ] Existing supported profile/settings/statistics actions have native equivalents with current product copy and validation.
- [ ] Save failures, denied responses, and account changes do not leak or falsely persist another user's state.
- [ ] Settings/profile/statistics behavior tests pass.

## Blocked by

- [S1 - #725](https://github.com/Slow-Inc/MangaDock/issues/725)
<!-- lang:end -->

<!-- lang:th -->
## Parent / งานหลัก

[Native migration PRD #724](https://github.com/Slow-Inc/MangaDock/issues/724)

## ข้อมูลการส่งมอบ

- Phase: 2
- Type: AFK
- User stories: 36
- Suggested triage: ready-for-agent

## สิ่งที่จะสร้าง

อ่าน/แก้ profile และ preferences เดิม และดูสถิติบัญชีเดิมผ่าน settings native โดยรักษา validation ปัจจุบันกับ state จาก server

Scope: ส่วน Mobile เท่านั้น ใช้ APIs ข้อมูล สิทธิ์ และกฎธุรกิจเดิม โดยรักษา Frontend/Backend/MIT และ bridge ร่วมของ Frontend

TDD: การ implement ใน slice นี้ใช้ Mobile code จริงผ่าน public interfaces และ mock เฉพาะขอบภายนอก พัฒนาพฤติกรรมที่สังเกตได้ทีละข้อในแต่ละ RED-GREEN cycle บันทึกหลักฐาน fail/pass ที่มีความหมาย และ refactor เฉพาะขณะ GREEN ส่วนงานตรวจ release อย่างเดียวตรวจหลักฐานอุปกรณ์แทนการสร้าง code changes ขึ้นเอง

## เกณฑ์รับงาน

- [ ] Actions ของ profile/settings/statistics เดิมที่รองรับมีรูปแบบ native พร้อมข้อความและ validation ปัจจุบัน
- [ ] การ save ล้มเหลว ถูกปฏิเสธ และเปลี่ยนบัญชีไม่รั่วหรือเก็บ state ผู้ใช้อื่นแบบรายงานสำเร็จผิด
- [ ] Behavior tests ของ settings/profile/statistics ผ่าน

## ติดบล็อกโดย

- [S1 - #725](https://github.com/Slow-Inc/MangaDock/issues/725)
<!-- lang:end -->

---

### S18: feat(mobile): account recovery linking and security lifecycle

<!-- lang:en -->
## Parent

[Native migration PRD #724](https://github.com/Slow-Inc/MangaDock/issues/724)

## Delivery metadata

- Phase: 2
- Type: AFK
- User stories: 37, 6
- Suggested triage: ready-for-agent

## What to build

Migrate currently supported registration/recovery/password, linked-account, TOTP enrolment/removal, device/session, and danger actions into native account screens, with system-browser callbacks where existing auth requires them.

Scope: Mobile subsystem only; reuse existing APIs, data, permissions, and business rules. Preserve Frontend/Backend/MIT and the shared Frontend bridge.

TDD: For implementation in this slice, use real Mobile code through public interfaces with external-boundary mocks only. Develop one observable behavior per RED-GREEN cycle, record meaningful failing/passing evidence, and refactor only while GREEN. For release-only work, verify device evidence rather than manufacturing code changes.

## Acceptance criteria

- [ ] The current account-security parity checklist maps each supported action to a native flow using existing auth/API contracts.
- [ ] Required re-auth/TOTP and action confirmation remain enforced; failed or cancelled actions cannot leave a fabricated success or stale identity.
- [ ] Recovery/callback/security/account-isolation behavior tests pass and external provider prerequisites are documented.

## Blocked by

- [S2 - #726](https://github.com/Slow-Inc/MangaDock/issues/726)
- [S17 - #741](https://github.com/Slow-Inc/MangaDock/issues/741)
<!-- lang:end -->

<!-- lang:th -->
## Parent / งานหลัก

[Native migration PRD #724](https://github.com/Slow-Inc/MangaDock/issues/724)

## ข้อมูลการส่งมอบ

- Phase: 2
- Type: AFK
- User stories: 37, 6
- Suggested triage: ready-for-agent

## สิ่งที่จะสร้าง

ย้าย actions สมัคร/กู้บัญชี/รหัสผ่าน เชื่อมบัญชี เปิด/ปิด TOTP, device/session และ danger ที่รองรับปัจจุบันเข้าหน้าจอบัญชี native พร้อม callbacks ของ browser ระบบเมื่อ auth เดิมต้องใช้

Scope: ส่วน Mobile เท่านั้น ใช้ APIs ข้อมูล สิทธิ์ และกฎธุรกิจเดิม โดยรักษา Frontend/Backend/MIT และ bridge ร่วมของ Frontend

TDD: การ implement ใน slice นี้ใช้ Mobile code จริงผ่าน public interfaces และ mock เฉพาะขอบภายนอก พัฒนาพฤติกรรมที่สังเกตได้ทีละข้อในแต่ละ RED-GREEN cycle บันทึกหลักฐาน fail/pass ที่มีความหมาย และ refactor เฉพาะขณะ GREEN ส่วนงานตรวจ release อย่างเดียวตรวจหลักฐานอุปกรณ์แทนการสร้าง code changes ขึ้นเอง

## เกณฑ์รับงาน

- [ ] Account-security parity checklist ปัจจุบันจับคู่ทุก action ที่รองรับกับ flow native ที่ใช้ auth/API contracts เดิม
- [ ] ยังบังคับ re-auth/TOTP และยืนยัน action ที่จำเป็น โดย action ล้มเหลว/ยกเลิกไม่คงความสำเร็จสร้างขึ้นหรือตัวตนเก่า
- [ ] Behavior tests ของ recovery/callback/security/account-isolation ผ่าน และบันทึก prerequisites ของ provider ภายนอก

## ติดบล็อกโดย

- [S2 - #726](https://github.com/Slow-Inc/MangaDock/issues/726)
- [S17 - #741](https://github.com/Slow-Inc/MangaDock/issues/741)
<!-- lang:end -->

---

### S19: feat(mobile): Wallet transaction history and reconciliation

<!-- lang:en -->
## Parent

[Native migration PRD #724](https://github.com/Slow-Inc/MangaDock/issues/724)

## Delivery metadata

- Phase: 2
- Type: AFK
- User stories: 38
- Suggested triage: ready-for-agent

## What to build

View the existing account's purchase/topup transaction history natively and reconcile detail/balance after returning from checkout, without adding administrative money operations.

Scope: Mobile subsystem only; reuse existing APIs, data, permissions, and business rules. Preserve Frontend/Backend/MIT and the shared Frontend bridge.

TDD: For implementation in this slice, use real Mobile code through public interfaces with external-boundary mocks only. Develop one observable behavior per RED-GREEN cycle, record meaningful failing/passing evidence, and refactor only while GREEN. For release-only work, verify device evidence rather than manufacturing code changes.

## Acceptance criteria

- [ ] History and supported details reflect server ledger data for the current account.
- [ ] Refresh, empty/error, and user-switch states remain correct after purchase or topup.
- [ ] Wallet history/reconciliation behavior tests pass.

## Blocked by

- [S8 - #732](https://github.com/Slow-Inc/MangaDock/issues/732)
- [S9 - #733](https://github.com/Slow-Inc/MangaDock/issues/733)
<!-- lang:end -->

<!-- lang:th -->
## Parent / งานหลัก

[Native migration PRD #724](https://github.com/Slow-Inc/MangaDock/issues/724)

## ข้อมูลการส่งมอบ

- Phase: 2
- Type: AFK
- User stories: 38
- Suggested triage: ready-for-agent

## สิ่งที่จะสร้าง

ดูประวัติธุรกรรมซื้อ/เติมเงินของบัญชีเดิมแบบ native และ reconcile รายละเอียด/ยอดหลังกลับ checkout โดยไม่เพิ่ม operations เงินของ admin

Scope: ส่วน Mobile เท่านั้น ใช้ APIs ข้อมูล สิทธิ์ และกฎธุรกิจเดิม โดยรักษา Frontend/Backend/MIT และ bridge ร่วมของ Frontend

TDD: การ implement ใน slice นี้ใช้ Mobile code จริงผ่าน public interfaces และ mock เฉพาะขอบภายนอก พัฒนาพฤติกรรมที่สังเกตได้ทีละข้อในแต่ละ RED-GREEN cycle บันทึกหลักฐาน fail/pass ที่มีความหมาย และ refactor เฉพาะขณะ GREEN ส่วนงานตรวจ release อย่างเดียวตรวจหลักฐานอุปกรณ์แทนการสร้าง code changes ขึ้นเอง

## เกณฑ์รับงาน

- [ ] ประวัติและรายละเอียดที่รองรับแสดงข้อมูล ledger ของ server สำหรับบัญชีปัจจุบัน
- [ ] สถานะ refresh ว่าง/ผิดพลาด และเปลี่ยนผู้ใช้ถูกต้องหลังซื้อหรือเติมเงิน
- [ ] Behavior tests ของ Wallet history/reconciliation ผ่าน

## ติดบล็อกโดย

- [S8 - #732](https://github.com/Slow-Inc/MangaDock/issues/732)
- [S9 - #733](https://github.com/Slow-Inc/MangaDock/issues/733)
<!-- lang:end -->

---

### S20: feat(mobile): native Community browsing tracer

<!-- lang:en -->
## Parent

[Native migration PRD #724](https://github.com/Slow-Inc/MangaDock/issues/724)

## Delivery metadata

- Phase: 2
- Type: AFK
- User stories: 39, 47
- Suggested triage: ready-for-agent

## What to build

Browse existing Community feeds/categories/trending/manga discussions, open a post, and navigate its author/content references into native screens using the current public/authenticated API behavior.

Scope: Mobile subsystem only; reuse existing APIs, data, permissions, and business rules. Preserve Frontend/Backend/MIT and the shared Frontend bridge.

TDD: For implementation in this slice, use real Mobile code through public interfaces with external-boundary mocks only. Develop one observable behavior per RED-GREEN cycle, record meaningful failing/passing evidence, and refactor only while GREEN. For release-only work, verify device evidence rather than manufacturing code changes.

## Acceptance criteria

- [ ] Existing Community browsing entry points and post details use real existing data and preserve pagination/category identity.
- [ ] Restricted/removed/empty/error states follow current API responses with native back navigation.
- [ ] Community browsing/navigation behavior tests pass.

## Blocked by

- [S1 - #725](https://github.com/Slow-Inc/MangaDock/issues/725)
<!-- lang:end -->

<!-- lang:th -->
## Parent / งานหลัก

[Native migration PRD #724](https://github.com/Slow-Inc/MangaDock/issues/724)

## ข้อมูลการส่งมอบ

- Phase: 2
- Type: AFK
- User stories: 39, 47
- Suggested triage: ready-for-agent

## สิ่งที่จะสร้าง

ดู feeds/categories/trending/กระทู้มังงะของ Community เดิม เปิดโพสต์ และไปข้อมูลผู้เขียน/เนื้อหาในหน้าจอ native ด้วยพฤติกรรม API public/authenticated ปัจจุบัน

Scope: ส่วน Mobile เท่านั้น ใช้ APIs ข้อมูล สิทธิ์ และกฎธุรกิจเดิม โดยรักษา Frontend/Backend/MIT และ bridge ร่วมของ Frontend

TDD: การ implement ใน slice นี้ใช้ Mobile code จริงผ่าน public interfaces และ mock เฉพาะขอบภายนอก พัฒนาพฤติกรรมที่สังเกตได้ทีละข้อในแต่ละ RED-GREEN cycle บันทึกหลักฐาน fail/pass ที่มีความหมาย และ refactor เฉพาะขณะ GREEN ส่วนงานตรวจ release อย่างเดียวตรวจหลักฐานอุปกรณ์แทนการสร้าง code changes ขึ้นเอง

## เกณฑ์รับงาน

- [ ] จุดเข้าดู Community และรายละเอียดโพสต์เดิมใช้ข้อมูลจริงเดิมและรักษาตัวตน pagination/category
- [ ] สถานะจำกัด/ลบ/ว่าง/ผิดพลาดเคารพ API responses ปัจจุบันพร้อมปุ่มย้อนกลับ native
- [ ] Behavior tests ของ Community browsing/navigation ผ่าน

## ติดบล็อกโดย

- [S1 - #725](https://github.com/Slow-Inc/MangaDock/issues/725)
<!-- lang:end -->

---

### S21: feat(mobile): Community post creation attachments edit and delete

<!-- lang:en -->
## Parent

[Native migration PRD #724](https://github.com/Slow-Inc/MangaDock/issues/724)

## Delivery metadata

- Phase: 2
- Type: AFK
- User stories: 40
- Suggested triage: ready-for-agent

## What to build

Create a post with currently supported attachments through native selection/upload, view it in the feed, and perform existing owner edit/delete actions.

Scope: Mobile subsystem only; reuse existing APIs, data, permissions, and business rules. Preserve Frontend/Backend/MIT and the shared Frontend bridge.

TDD: For implementation in this slice, use real Mobile code through public interfaces with external-boundary mocks only. Develop one observable behavior per RED-GREEN cycle, record meaningful failing/passing evidence, and refactor only while GREEN. For release-only work, verify device evidence rather than manufacturing code changes.

## Acceptance criteria

- [ ] A supported attachment-backed post can be created and read back using existing upload/forum contracts.
- [ ] Current ownership, content validation, upload progress/failure, and edit/delete confirmations are preserved.
- [ ] Post lifecycle/upload/permission behavior tests pass.

## Blocked by

- [S20 - #744](https://github.com/Slow-Inc/MangaDock/issues/744)
<!-- lang:end -->

<!-- lang:th -->
## Parent / งานหลัก

[Native migration PRD #724](https://github.com/Slow-Inc/MangaDock/issues/724)

## ข้อมูลการส่งมอบ

- Phase: 2
- Type: AFK
- User stories: 40
- Suggested triage: ready-for-agent

## สิ่งที่จะสร้าง

สร้างโพสต์พร้อม attachments ที่รองรับปัจจุบันผ่านการเลือก/อัปโหลด native ดูใน feed และทำ actions แก้/ลบของเจ้าของเดิม

Scope: ส่วน Mobile เท่านั้น ใช้ APIs ข้อมูล สิทธิ์ และกฎธุรกิจเดิม โดยรักษา Frontend/Backend/MIT และ bridge ร่วมของ Frontend

TDD: การ implement ใน slice นี้ใช้ Mobile code จริงผ่าน public interfaces และ mock เฉพาะขอบภายนอก พัฒนาพฤติกรรมที่สังเกตได้ทีละข้อในแต่ละ RED-GREEN cycle บันทึกหลักฐาน fail/pass ที่มีความหมาย และ refactor เฉพาะขณะ GREEN ส่วนงานตรวจ release อย่างเดียวตรวจหลักฐานอุปกรณ์แทนการสร้าง code changes ขึ้นเอง

## เกณฑ์รับงาน

- [ ] สร้างโพสต์พร้อม attachment ที่รองรับและอ่านกลับได้ด้วย upload/forum contracts เดิม
- [ ] รักษา ownership การตรวจเนื้อหา progress/failure ของ upload และยืนยันแก้/ลบปัจจุบัน
- [ ] Behavior tests ของ post lifecycle/upload/permission ผ่าน

## ติดบล็อกโดย

- [S20 - #744](https://github.com/Slow-Inc/MangaDock/issues/744)
<!-- lang:end -->

---

### S22: feat(mobile): Community replies votes reports and live updates

<!-- lang:en -->
## Parent

[Native migration PRD #724](https://github.com/Slow-Inc/MangaDock/issues/724)

## Delivery metadata

- Phase: 2
- Type: AFK
- User stories: 41
- Suggested triage: ready-for-agent

## What to build

Perform existing discussion reply/vote/report actions and consume existing live events in native Community, with reconnection, deduplication, and per-account state.

Scope: Mobile subsystem only; reuse existing APIs, data, permissions, and business rules. Preserve Frontend/Backend/MIT and the shared Frontend bridge.

TDD: For implementation in this slice, use real Mobile code through public interfaces with external-boundary mocks only. Develop one observable behavior per RED-GREEN cycle, record meaningful failing/passing evidence, and refactor only while GREEN. For release-only work, verify device evidence rather than manufacturing code changes.

## Acceptance criteria

- [ ] Supported reply/vote/report actions round-trip through current APIs and preserve role/ownership rules.
- [ ] Duplicate/reconnected events and optimistic failures reconcile to server truth without double counting.
- [ ] Discussion/SSE/lifecycle/account-isolation behavior tests pass.

## Blocked by

- [S21 - #745](https://github.com/Slow-Inc/MangaDock/issues/745)
<!-- lang:end -->

<!-- lang:th -->
## Parent / งานหลัก

[Native migration PRD #724](https://github.com/Slow-Inc/MangaDock/issues/724)

## ข้อมูลการส่งมอบ

- Phase: 2
- Type: AFK
- User stories: 41
- Suggested triage: ready-for-agent

## สิ่งที่จะสร้าง

ทำ reply/vote/report actions ของกระทู้เดิม และรับ live events เดิมใน Community native พร้อม reconnect กรองซ้ำ และ state แยกบัญชี

Scope: ส่วน Mobile เท่านั้น ใช้ APIs ข้อมูล สิทธิ์ และกฎธุรกิจเดิม โดยรักษา Frontend/Backend/MIT และ bridge ร่วมของ Frontend

TDD: การ implement ใน slice นี้ใช้ Mobile code จริงผ่าน public interfaces และ mock เฉพาะขอบภายนอก พัฒนาพฤติกรรมที่สังเกตได้ทีละข้อในแต่ละ RED-GREEN cycle บันทึกหลักฐาน fail/pass ที่มีความหมาย และ refactor เฉพาะขณะ GREEN ส่วนงานตรวจ release อย่างเดียวตรวจหลักฐานอุปกรณ์แทนการสร้าง code changes ขึ้นเอง

## เกณฑ์รับงาน

- [ ] Reply/vote/report actions ที่รองรับทำครบผ่าน APIs ปัจจุบันและรักษากฎ role/ownership
- [ ] Events ซ้ำ/เชื่อมใหม่และ optimistic failures reconcile เป็นข้อมูลจริงของ server โดยไม่นับซ้ำ
- [ ] Behavior tests ของ discussion/SSE/lifecycle/account-isolation ผ่าน

## ติดบล็อกโดย

- [S21 - #745](https://github.com/Slow-Inc/MangaDock/issues/745)
<!-- lang:end -->

---

### S23: feat(mobile): creator workspace and draft Chapter management

<!-- lang:en -->
## Parent

[Native migration PRD #724](https://github.com/Slow-Inc/MangaDock/issues/724)

## Delivery metadata

- Phase: 3
- Type: AFK
- User stories: 42
- Suggested triage: ready-for-agent

## What to build

Open the existing creator's Studio works, select a manga, and manage currently supported draft/version metadata, language, and pricing through native screens and existing role-gated APIs.

Scope: Mobile subsystem only; reuse existing APIs, data, permissions, and business rules. Preserve Frontend/Backend/MIT and the shared Frontend bridge.

TDD: For implementation in this slice, use real Mobile code through public interfaces with external-boundary mocks only. Develop one observable behavior per RED-GREEN cycle, record meaningful failing/passing evidence, and refactor only while GREEN. For release-only work, verify device evidence rather than manufacturing code changes.

## Acceptance criteria

- [ ] Authorized creators list their works and create/read/edit supported draft/version data using existing contracts.
- [ ] Non-owner/unauthorized/invalid-data responses are enforced and drafts do not appear as public published Chapters.
- [ ] Creator workspace/metadata/price/permission behavior tests pass.

## Blocked by

- [S1 - #725](https://github.com/Slow-Inc/MangaDock/issues/725)
- [S4 - #728](https://github.com/Slow-Inc/MangaDock/issues/728)
<!-- lang:end -->

<!-- lang:th -->
## Parent / งานหลัก

[Native migration PRD #724](https://github.com/Slow-Inc/MangaDock/issues/724)

## ข้อมูลการส่งมอบ

- Phase: 3
- Type: AFK
- User stories: 42
- Suggested triage: ready-for-agent

## สิ่งที่จะสร้าง

เปิด Studio works ของผู้สร้างเดิม เลือกมังงะ และจัดการ metadata, ภาษา และราคาของ draft/version ที่รองรับปัจจุบันผ่านหน้าจอ native และ APIs ตาม role เดิม

Scope: ส่วน Mobile เท่านั้น ใช้ APIs ข้อมูล สิทธิ์ และกฎธุรกิจเดิม โดยรักษา Frontend/Backend/MIT และ bridge ร่วมของ Frontend

TDD: การ implement ใน slice นี้ใช้ Mobile code จริงผ่าน public interfaces และ mock เฉพาะขอบภายนอก พัฒนาพฤติกรรมที่สังเกตได้ทีละข้อในแต่ละ RED-GREEN cycle บันทึกหลักฐาน fail/pass ที่มีความหมาย และ refactor เฉพาะขณะ GREEN ส่วนงานตรวจ release อย่างเดียวตรวจหลักฐานอุปกรณ์แทนการสร้าง code changes ขึ้นเอง

## เกณฑ์รับงาน

- [ ] ผู้สร้างที่มีสิทธิ์แสดงผลงานและสร้าง/อ่าน/แก้ข้อมูล draft/version ที่รองรับด้วย contracts เดิม
- [ ] บังคับผล non-owner/unauthorized/invalid-data และ drafts ไม่แสดงเป็น Chapters ที่เผยแพร่ public
- [ ] Behavior tests ของ creator workspace/metadata/price/permission ผ่าน

## ติดบล็อกโดย

- [S1 - #725](https://github.com/Slow-Inc/MangaDock/issues/725)
- [S4 - #728](https://github.com/Slow-Inc/MangaDock/issues/728)
<!-- lang:end -->

---

### S24: feat(mobile): Studio image upload and publication lifecycle

<!-- lang:en -->
## Parent

[Native migration PRD #724](https://github.com/Slow-Inc/MangaDock/issues/724)

## Delivery metadata

- Phase: 3
- Type: AFK
- User stories: 43
- Suggested triage: ready-for-agent

## What to build

Select native images, upload the ordered Chapter Pages, and submit through the current publication/moderation lifecycle. Read the published result in the existing native version flow when server status permits it.

Scope: Mobile subsystem only; reuse existing APIs, data, permissions, and business rules. Preserve Frontend/Backend/MIT and the shared Frontend bridge.

TDD: For implementation in this slice, use real Mobile code through public interfaces with external-boundary mocks only. Develop one observable behavior per RED-GREEN cycle, record meaningful failing/passing evidence, and refactor only while GREEN. For release-only work, verify device evidence rather than manufacturing code changes.

## Acceptance criteria

- [ ] Supported native file selection/order/validation, upload progress/retry, and saved Pages use existing storage/upload contracts.
- [ ] Draft/submitted/published/rejected and existing edit/delete transitions follow server permissions and moderation states.
- [ ] Upload/publication/readback behavior tests pass and no Worker/storage/schema changes are required.

## Blocked by

- [S23 - #747](https://github.com/Slow-Inc/MangaDock/issues/747)
<!-- lang:end -->

<!-- lang:th -->
## Parent / งานหลัก

[Native migration PRD #724](https://github.com/Slow-Inc/MangaDock/issues/724)

## ข้อมูลการส่งมอบ

- Phase: 3
- Type: AFK
- User stories: 43
- Suggested triage: ready-for-agent

## สิ่งที่จะสร้าง

เลือกภาพ native อัปโหลด Pages ของ Chapter ตามลำดับ และส่งผ่าน lifecycle publication/moderation ปัจจุบัน แล้วอ่านผลที่เผยแพร่ใน flow version native เดิมเมื่อ server status อนุญาต

Scope: ส่วน Mobile เท่านั้น ใช้ APIs ข้อมูล สิทธิ์ และกฎธุรกิจเดิม โดยรักษา Frontend/Backend/MIT และ bridge ร่วมของ Frontend

TDD: การ implement ใน slice นี้ใช้ Mobile code จริงผ่าน public interfaces และ mock เฉพาะขอบภายนอก พัฒนาพฤติกรรมที่สังเกตได้ทีละข้อในแต่ละ RED-GREEN cycle บันทึกหลักฐาน fail/pass ที่มีความหมาย และ refactor เฉพาะขณะ GREEN ส่วนงานตรวจ release อย่างเดียวตรวจหลักฐานอุปกรณ์แทนการสร้าง code changes ขึ้นเอง

## เกณฑ์รับงาน

- [ ] การเลือกไฟล์/เรียงลำดับ/ตรวจไฟล์ native ที่รองรับ progress/retry upload และ Pages ที่บันทึกใช้ storage/upload contracts เดิม
- [ ] Transitions draft/submitted/published/rejected และแก้/ลบเดิมเคารพสิทธิ์ server กับสถานะ moderation
- [ ] Behavior tests ของ upload/publication/readback ผ่าน โดยไม่ต้องเปลี่ยน Worker/storage/schema

## ติดบล็อกโดย

- [S23 - #747](https://github.com/Slow-Inc/MangaDock/issues/747)
<!-- lang:end -->

---

### S25: feat(mobile): creator account earnings and Studio Wallet

<!-- lang:en -->
## Parent

[Native migration PRD #724](https://github.com/Slow-Inc/MangaDock/issues/724)

## Delivery metadata

- Phase: 3
- Type: AFK
- User stories: 44
- Suggested triage: ready-for-agent

## What to build

View the existing creator's account and earnings/Studio Wallet surfaces natively, with current validation, permissions, and server-derived revenue data.

Scope: Mobile subsystem only; reuse existing APIs, data, permissions, and business rules. Preserve Frontend/Backend/MIT and the shared Frontend bridge.

TDD: For implementation in this slice, use real Mobile code through public interfaces with external-boundary mocks only. Develop one observable behavior per RED-GREEN cycle, record meaningful failing/passing evidence, and refactor only while GREEN. For release-only work, verify device evidence rather than manufacturing code changes.

## Acceptance criteria

- [ ] All currently supported creator account/earnings actions are mapped and reachable for the correct role/account.
- [ ] Revenue and balance are read from existing contracts, with honest empty/error and denied states.
- [ ] Creator account/earnings/permission behavior tests pass.

## Blocked by

- [S23 - #747](https://github.com/Slow-Inc/MangaDock/issues/747)
- [S19 - #743](https://github.com/Slow-Inc/MangaDock/issues/743)
<!-- lang:end -->

<!-- lang:th -->
## Parent / งานหลัก

[Native migration PRD #724](https://github.com/Slow-Inc/MangaDock/issues/724)

## ข้อมูลการส่งมอบ

- Phase: 3
- Type: AFK
- User stories: 44
- Suggested triage: ready-for-agent

## สิ่งที่จะสร้าง

ดูหน้าบัญชีผู้สร้างและ earnings/Studio Wallet เดิมแบบ native พร้อม validation สิทธิ์ และข้อมูลรายได้ตาม server ปัจจุบัน

Scope: ส่วน Mobile เท่านั้น ใช้ APIs ข้อมูล สิทธิ์ และกฎธุรกิจเดิม โดยรักษา Frontend/Backend/MIT และ bridge ร่วมของ Frontend

TDD: การ implement ใน slice นี้ใช้ Mobile code จริงผ่าน public interfaces และ mock เฉพาะขอบภายนอก พัฒนาพฤติกรรมที่สังเกตได้ทีละข้อในแต่ละ RED-GREEN cycle บันทึกหลักฐาน fail/pass ที่มีความหมาย และ refactor เฉพาะขณะ GREEN ส่วนงานตรวจ release อย่างเดียวตรวจหลักฐานอุปกรณ์แทนการสร้าง code changes ขึ้นเอง

## เกณฑ์รับงาน

- [ ] Actions บัญชีผู้สร้าง/รายได้ที่รองรับปัจจุบันทั้งหมดถูกจับคู่และเข้าถึงสำหรับ role/account ถูกต้อง
- [ ] รายได้และยอดอ่านจาก contracts เดิมพร้อมสถานะว่าง/ผิดพลาดและถูกปฏิเสธที่ตรงจริง
- [ ] Behavior tests ของ creator account/earnings/permission ผ่าน

## ติดบล็อกโดย

- [S23 - #747](https://github.com/Slow-Inc/MangaDock/issues/747)
- [S19 - #743](https://github.com/Slow-Inc/MangaDock/issues/743)
<!-- lang:end -->

---

### S26: feat(mobile): role-gated user management native tracer

<!-- lang:en -->
## Parent

[Native migration PRD #724](https://github.com/Slow-Inc/MangaDock/issues/724)

## Delivery metadata

- Phase: 3
- Type: AFK
- User stories: 45
- Suggested triage: ready-for-agent

## What to build

Expose the existing authorized staff user list/detail and supported account-management actions natively. Use current Backend role guards and validation; do not create new privileges or actions.

Scope: Mobile subsystem only; reuse existing APIs, data, permissions, and business rules. Preserve Frontend/Backend/MIT and the shared Frontend bridge.

TDD: For implementation in this slice, use real Mobile code through public interfaces with external-boundary mocks only. Develop one observable behavior per RED-GREEN cycle, record meaningful failing/passing evidence, and refactor only while GREEN. For release-only work, verify device evidence rather than manufacturing code changes.

## Acceptance criteria

- [ ] The baseline identifies currently supported user-management actions, and authorized staff can execute them from native UI.
- [ ] Server-denied role/ownership changes remain denied; dangerous supported actions retain confirmation and fresh authorization.
- [ ] Role-change/ban/session-error behavior tests follow the existing contract and pass.

## Blocked by

- [S1 - #725](https://github.com/Slow-Inc/MangaDock/issues/725)
- [S18 - #742](https://github.com/Slow-Inc/MangaDock/issues/742)
<!-- lang:end -->

<!-- lang:th -->
## Parent / งานหลัก

[Native migration PRD #724](https://github.com/Slow-Inc/MangaDock/issues/724)

## ข้อมูลการส่งมอบ

- Phase: 3
- Type: AFK
- User stories: 45
- Suggested triage: ready-for-agent

## สิ่งที่จะสร้าง

แสดงรายการ/รายละเอียดผู้ใช้และ actions จัดการบัญชีที่ staff มีสิทธิ์เดิมแบบ native โดยใช้ role guards และ validation ของ Backend ปัจจุบัน ไม่สร้างสิทธิ์หรือ actions ใหม่

Scope: ส่วน Mobile เท่านั้น ใช้ APIs ข้อมูล สิทธิ์ และกฎธุรกิจเดิม โดยรักษา Frontend/Backend/MIT และ bridge ร่วมของ Frontend

TDD: การ implement ใน slice นี้ใช้ Mobile code จริงผ่าน public interfaces และ mock เฉพาะขอบภายนอก พัฒนาพฤติกรรมที่สังเกตได้ทีละข้อในแต่ละ RED-GREEN cycle บันทึกหลักฐาน fail/pass ที่มีความหมาย และ refactor เฉพาะขณะ GREEN ส่วนงานตรวจ release อย่างเดียวตรวจหลักฐานอุปกรณ์แทนการสร้าง code changes ขึ้นเอง

## เกณฑ์รับงาน

- [ ] Baseline ระบุ user-management actions ที่รองรับปัจจุบัน และ staff ที่มีสิทธิ์ทำผ่าน UI native ได้
- [ ] การเปลี่ยน role/ownership ที่ server ปฏิเสธยังถูกปฏิเสธ โดย actions อันตรายที่รองรับคงการยืนยันและ authorization ล่าสุด
- [ ] Behavior tests ของ role-change/ban/session-error ตาม contract เดิมและผ่าน

## ติดบล็อกโดย

- [S1 - #725](https://github.com/Slow-Inc/MangaDock/issues/725)
- [S18 - #742](https://github.com/Slow-Inc/MangaDock/issues/742)
<!-- lang:end -->

---

### S27: feat(mobile): existing staff content reports and moderation flows

<!-- lang:en -->
## Parent

[Native migration PRD #724](https://github.com/Slow-Inc/MangaDock/issues/724)

## Delivery metadata

- Phase: 3
- Type: AFK
- User stories: 45
- Suggested triage: ready-for-agent

## What to build

Migrate currently available staff content queues, reports, and moderation actions for Community/reader/Studio content into native role-gated screens, preserving existing state transitions and audit behavior.

Scope: Mobile subsystem only; reuse existing APIs, data, permissions, and business rules. Preserve Frontend/Backend/MIT and the shared Frontend bridge.

TDD: For implementation in this slice, use real Mobile code through public interfaces with external-boundary mocks only. Develop one observable behavior per RED-GREEN cycle, record meaningful failing/passing evidence, and refactor only while GREEN. For release-only work, verify device evidence rather than manufacturing code changes.

## Acceptance criteria

- [ ] Supported queue/report detail and moderation actions are inventoried and executed against existing APIs.
- [ ] Role restrictions, content status transitions, repeated actions, and server errors are represented accurately.
- [ ] Content/report/moderation permission and state-transition behavior tests pass.

## Blocked by

- [S26 - #750](https://github.com/Slow-Inc/MangaDock/issues/750)
- [S13 - #737](https://github.com/Slow-Inc/MangaDock/issues/737)
- [S22 - #746](https://github.com/Slow-Inc/MangaDock/issues/746)
- [S24 - #748](https://github.com/Slow-Inc/MangaDock/issues/748)
<!-- lang:end -->

<!-- lang:th -->
## Parent / งานหลัก

[Native migration PRD #724](https://github.com/Slow-Inc/MangaDock/issues/724)

## ข้อมูลการส่งมอบ

- Phase: 3
- Type: AFK
- User stories: 45
- Suggested triage: ready-for-agent

## สิ่งที่จะสร้าง

ย้ายคิวเนื้อหา reports และ moderation actions ของ staff ที่มีปัจจุบันสำหรับเนื้อหา Community/reader/Studio เข้า native screens ตาม role โดยรักษา transitions และพฤติกรรม audit เดิม

Scope: ส่วน Mobile เท่านั้น ใช้ APIs ข้อมูล สิทธิ์ และกฎธุรกิจเดิม โดยรักษา Frontend/Backend/MIT และ bridge ร่วมของ Frontend

TDD: การ implement ใน slice นี้ใช้ Mobile code จริงผ่าน public interfaces และ mock เฉพาะขอบภายนอก พัฒนาพฤติกรรมที่สังเกตได้ทีละข้อในแต่ละ RED-GREEN cycle บันทึกหลักฐาน fail/pass ที่มีความหมาย และ refactor เฉพาะขณะ GREEN ส่วนงานตรวจ release อย่างเดียวตรวจหลักฐานอุปกรณ์แทนการสร้าง code changes ขึ้นเอง

## เกณฑ์รับงาน

- [ ] ทำ inventory ของรายละเอียด queue/report และ moderation actions ที่รองรับ และทำผ่าน APIs เดิม
- [ ] แสดงข้อจำกัด role, transitions สถานะเนื้อหา actions ซ้ำ และ server errors ถูกต้อง
- [ ] Behavior tests ของสิทธิ์และ state-transition ของ content/report/moderation ผ่าน

## ติดบล็อกโดย

- [S26 - #750](https://github.com/Slow-Inc/MangaDock/issues/750)
- [S13 - #737](https://github.com/Slow-Inc/MangaDock/issues/737)
- [S22 - #746](https://github.com/Slow-Inc/MangaDock/issues/746)
- [S24 - #748](https://github.com/Slow-Inc/MangaDock/issues/748)
<!-- lang:end -->

---

### S28: feat(mobile): staff transactions overview and audit parity

<!-- lang:en -->
## Parent

[Native migration PRD #724](https://github.com/Slow-Inc/MangaDock/issues/724)

## Delivery metadata

- Phase: 3
- Type: AFK
- User stories: 45
- Suggested triage: ready-for-agent

## What to build

Provide native equivalents of currently delivered role-gated overview, transaction inspection, audit, and supported financial-management actions. Preserve the current authorization and action confirmation rules; do not invent new finance operations.

Scope: Mobile subsystem only; reuse existing APIs, data, permissions, and business rules. Preserve Frontend/Backend/MIT and the shared Frontend bridge.

TDD: For implementation in this slice, use real Mobile code through public interfaces with external-boundary mocks only. Develop one observable behavior per RED-GREEN cycle, record meaningful failing/passing evidence, and refactor only while GREEN. For release-only work, verify device evidence rather than manufacturing code changes.

## Acceptance criteria

- [ ] Every current staff overview/transaction/audit action in the parity baseline is mapped to real Backend data/actions.
- [ ] Role denial, filters/pagination, empty/error states, and confirmations reflect existing server semantics.
- [ ] Staff overview/ledger/audit permission behavior tests pass without live unintended money changes.

## Blocked by

- [S26 - #750](https://github.com/Slow-Inc/MangaDock/issues/750)
- [S19 - #743](https://github.com/Slow-Inc/MangaDock/issues/743)
<!-- lang:end -->

<!-- lang:th -->
## Parent / งานหลัก

[Native migration PRD #724](https://github.com/Slow-Inc/MangaDock/issues/724)

## ข้อมูลการส่งมอบ

- Phase: 3
- Type: AFK
- User stories: 45
- Suggested triage: ready-for-agent

## สิ่งที่จะสร้าง

ทำรูปแบบ native ของ overview ตรวจธุรกรรม audit และ financial-management actions ตาม role ที่ส่งมอบอยู่ โดยรักษากฎ authorization กับการยืนยัน actions ปัจจุบัน และไม่สร้าง finance operations ใหม่

Scope: ส่วน Mobile เท่านั้น ใช้ APIs ข้อมูล สิทธิ์ และกฎธุรกิจเดิม โดยรักษา Frontend/Backend/MIT และ bridge ร่วมของ Frontend

TDD: การ implement ใน slice นี้ใช้ Mobile code จริงผ่าน public interfaces และ mock เฉพาะขอบภายนอก พัฒนาพฤติกรรมที่สังเกตได้ทีละข้อในแต่ละ RED-GREEN cycle บันทึกหลักฐาน fail/pass ที่มีความหมาย และ refactor เฉพาะขณะ GREEN ส่วนงานตรวจ release อย่างเดียวตรวจหลักฐานอุปกรณ์แทนการสร้าง code changes ขึ้นเอง

## เกณฑ์รับงาน

- [ ] ทุก staff overview/transaction/audit action ปัจจุบันใน parity baseline จับคู่กับข้อมูล/actions Backend จริง
- [ ] การปฏิเสธ role, filters/pagination สถานะว่าง/ผิดพลาด และยืนยันเคารพ semantics server เดิม
- [ ] Behavior tests ของสิทธิ์ staff overview/ledger/audit ผ่านโดยไม่เกิดการเปลี่ยนเงินจริงโดยไม่ตั้งใจ

## ติดบล็อกโดย

- [S26 - #750](https://github.com/Slow-Inc/MangaDock/issues/750)
- [S19 - #743](https://github.com/Slow-Inc/MangaDock/issues/743)
<!-- lang:end -->

---

### S29: release(mobile): full native parity and Android replacement gate

<!-- lang:en -->
## Parent

[Native migration PRD #724](https://github.com/Slow-Inc/MangaDock/issues/724)

## Delivery metadata

- Phase: 3
- Type: HITL
- User stories: 1, 2, 46, 47, 48
- Suggested triage: ready-for-human

## What to build

Review the native-to-current-product parity matrix, verify role-specific journeys and full signed APK behavior on Android, and decide readiness to replace the released hybrid application. Record missing contracts explicitly rather than approving incomplete parity.

Scope: Mobile subsystem only; reuse existing APIs, data, permissions, and business rules. Preserve Frontend/Backend/MIT and the shared Frontend bridge.

TDD: For implementation in this slice, use real Mobile code through public interfaces with external-boundary mocks only. Develop one observable behavior per RED-GREEN cycle, record meaningful failing/passing evidence, and refactor only while GREEN. For release-only work, verify device evidence rather than manufacturing code changes.

## Acceptance criteria

- [ ] All existing product workflows/actions have a native equivalent and verified role behavior; developer docs and a separate observability product are explicitly excluded.
- [ ] Full Mobile typecheck/behavior tests and physical Android reading/payment/auth/social/creator/staff smoke evidence are recorded with APK version metadata.
- [ ] There is no embedded WebView runtime or browser-product fallback, shared Frontend bridge compatibility is preserved, and migration diffs remain Mobile-scoped.
- [ ] Replacement is approved only with complete parity and documented prerequisites/performance observations; store/iOS/background-translation work remains separate.

## Blocked by

- [S10 - #734](https://github.com/Slow-Inc/MangaDock/issues/734)
- [S11 - #735](https://github.com/Slow-Inc/MangaDock/issues/735)
- [S12 - #736](https://github.com/Slow-Inc/MangaDock/issues/736)
- [S13 - #737](https://github.com/Slow-Inc/MangaDock/issues/737)
- [S14 - #738](https://github.com/Slow-Inc/MangaDock/issues/738)
- [S15 - #739](https://github.com/Slow-Inc/MangaDock/issues/739)
- [S16 - #740](https://github.com/Slow-Inc/MangaDock/issues/740)
- [S18 - #742](https://github.com/Slow-Inc/MangaDock/issues/742)
- [S19 - #743](https://github.com/Slow-Inc/MangaDock/issues/743)
- [S22 - #746](https://github.com/Slow-Inc/MangaDock/issues/746)
- [S24 - #748](https://github.com/Slow-Inc/MangaDock/issues/748)
- [S25 - #749](https://github.com/Slow-Inc/MangaDock/issues/749)
- [S27 - #751](https://github.com/Slow-Inc/MangaDock/issues/751)
- [S28 - #752](https://github.com/Slow-Inc/MangaDock/issues/752)
<!-- lang:end -->

<!-- lang:th -->
## Parent / งานหลัก

[Native migration PRD #724](https://github.com/Slow-Inc/MangaDock/issues/724)

## ข้อมูลการส่งมอบ

- Phase: 3
- Type: HITL
- User stories: 1, 2, 46, 47, 48
- Suggested triage: ready-for-human

## สิ่งที่จะสร้าง

Review parity matrix ของ native เทียบผลิตภัณฑ์ปัจจุบัน ตรวจ journeys ตาม role และ signed APK เต็มบน Android แล้วตัดสินความพร้อมแทนแอป hybrid ที่เผยแพร่ โดยบันทึก contracts ที่ขาดชัดเจนแทนการอนุมัติ parity ที่ไม่ครบ

Scope: ส่วน Mobile เท่านั้น ใช้ APIs ข้อมูล สิทธิ์ และกฎธุรกิจเดิม โดยรักษา Frontend/Backend/MIT และ bridge ร่วมของ Frontend

TDD: การ implement ใน slice นี้ใช้ Mobile code จริงผ่าน public interfaces และ mock เฉพาะขอบภายนอก พัฒนาพฤติกรรมที่สังเกตได้ทีละข้อในแต่ละ RED-GREEN cycle บันทึกหลักฐาน fail/pass ที่มีความหมาย และ refactor เฉพาะขณะ GREEN ส่วนงานตรวจ release อย่างเดียวตรวจหลักฐานอุปกรณ์แทนการสร้าง code changes ขึ้นเอง

## เกณฑ์รับงาน

- [ ] ทุก product workflows/actions เดิมมีรูปแบบ native และพฤติกรรม role ที่ตรวจแล้ว โดย developer docs และผลิตภัณฑ์ observability แยกถูกยกเว้นชัดเจน
- [ ] บันทึก Mobile typecheck/behavior tests เต็มและหลักฐาน smoke อ่าน/ชำระ/auth/social/creator/staff บน Android จริงพร้อม APK version metadata
- [ ] ไม่มี runtime embedded WebView หรือ fallback ผลิตภัณฑ์ browser โดยรักษา compatibility ของ bridge Frontend ร่วมและ diff การย้ายอยู่ใน scope Mobile
- [ ] อนุมัติแทนแอปเมื่อ parity ครบและมี prerequisites/ข้อสังเกต performance ที่บันทึก โดยงาน store/iOS/background-translation ยังแยกต่างหาก

## ติดบล็อกโดย

- [S10 - #734](https://github.com/Slow-Inc/MangaDock/issues/734)
- [S11 - #735](https://github.com/Slow-Inc/MangaDock/issues/735)
- [S12 - #736](https://github.com/Slow-Inc/MangaDock/issues/736)
- [S13 - #737](https://github.com/Slow-Inc/MangaDock/issues/737)
- [S14 - #738](https://github.com/Slow-Inc/MangaDock/issues/738)
- [S15 - #739](https://github.com/Slow-Inc/MangaDock/issues/739)
- [S16 - #740](https://github.com/Slow-Inc/MangaDock/issues/740)
- [S18 - #742](https://github.com/Slow-Inc/MangaDock/issues/742)
- [S19 - #743](https://github.com/Slow-Inc/MangaDock/issues/743)
- [S22 - #746](https://github.com/Slow-Inc/MangaDock/issues/746)
- [S24 - #748](https://github.com/Slow-Inc/MangaDock/issues/748)
- [S25 - #749](https://github.com/Slow-Inc/MangaDock/issues/749)
- [S27 - #751](https://github.com/Slow-Inc/MangaDock/issues/751)
- [S28 - #752](https://github.com/Slow-Inc/MangaDock/issues/752)
<!-- lang:end -->

---

## Publishing rules / กฎการเผยแพร่

Publish the reviewed PRD first, then reviewed slices in dependency order; replace S references with actual issue URLs. Use ready-for-agent for AFK and ready-for-human for HITL. Do not close or edit prior hybrid PRDs or other parent issues.

เผยแพร่ PRD ที่ review ก่อน แล้วเผยแพร่ slices ที่ review ตามลำดับ dependency โดยแทน S references ด้วย URLs ของ issues จริง ใช้ ready-for-agent สำหรับ AFK และ ready-for-human สำหรับ HITL และไม่ปิดหรือแก้ PRDs hybrid ก่อนหน้าหรือ parent issues อื่น
