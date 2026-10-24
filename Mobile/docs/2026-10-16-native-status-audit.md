# Native Mobile status audit — 2026-10-16

Subsequent execution restored Supabase and started Backend/Metro; the audit below describes the earlier snapshot. [Latest execution, 220-test verification and remaining gates](2026-10-16-native-acceptance-progress.md).

ภาษาไทย: หลัง audit กู้ Supabase และเปิด Backend/Metro แล้ว เนื้อหาด้านล่างเป็น snapshot ก่อนลงมือ ดูผลล่าสุด 220 tests และงานค้างในลิงก์ด้านบน

## EN

The native implementation is present in the local `feat/mobile-native-phase4` workspace and passes fresh source checks. It is **not yet an accepted replacement release**. The immediate service blocker is the configured Supabase project reporting **INACTIVE**, with its project hostname failing DNS resolution. No remote configuration, account, source code or private environment was changed by this audit.

### What has been implemented

The source mappings below were checked against the current native entry/view wiring, controller/test files, approved PRD and implementation ledger. “Implemented” means source and automatic behavior coverage exist; it does not certify every acceptance criterion or real device interaction.

| Work / issues | Existing native implementation | Remaining acceptance |
| --- | --- | --- |
| Runtime and Auth, #725–#726 | Expo/React Native entry, hardware identity, Supabase session restore, browser OAuth/PKCE and required TOTP | Actual provider login, return, session restore and account switching |
| Reader, #727–#729 | Search/detail/chapter selection, MangaDex and published Studio content, CAPTCHA handoff, reading modes, navigation, zoom and HD/saver | Populated content, browser return, gestures and history position on a device |
| Translation, #730–#731 | Single-page native Patches, batch progress/cancel/retry, derivative/context changes and foreground lifecycle | Real Backend/MIT output, alignment, cancellation, disconnect and resource behavior |
| Wallet/payment, #732–#733 | Server balance, unlock, QR topup, pending payment persistence and banking-app/reading recovery | Provider test payment, balance/access reconciliation and real OS return |
| Discovery and personal library, #735–#736 | Home, original six destinations, categories/tags/releases, related titles, collections, ordered history, CSV/share | Populated design comparison and real share/file interactions |
| Reading social and profiles, #737–#738 | Ratings/reviews/page comments/reports, profiles, follows and banner actions | Real account permissions, picker/crop and server-backed interactions |
| Account/activity/security, #739–#743 | Check-in, notifications, preferences/history-derived statistics, recovery/linking/MFA/devices/product-data deletion, Wallet ledger | Real account lifecycle, email/provider/MFA/notification and ledger checks |
| Community, #744–#746 | Feed/trending, post CRUD and images, nested replies/votes/reports and SSE guards | Upload/picker, account permissions, reconnect and live updates on a device |
| Studio, #747–#749 | Creator workspace/drafts, ordered upload/retry/reorder/delete, publication, earnings and existing Wallet | Real roles, uploads, ambiguous-result reconciliation, publish and revenue checks |
| Staff, #750–#752 | Existing users/roles/ban/wallet, pin/delete, transactions and audit/statistics | Real role/401/403/account changes and device interaction |
| Release gates, #734 and #753 | Historical debug APK plus source review/export evidence | Beta physical-device acceptance and signed replacement APK acceptance remain open |

`Mobile/App.tsx` connects to native runtime/session views and the native feature views/controllers. Current Mobile source/entry/package scan found no WebView import/dependency or TODO/FIXME implementation placeholder. The “unsupported page” messages checked are whitelist/navigation guards; file-share readiness is an OS capability guard. These scans do not replace a full requirements or visual review. The legacy bridge was not changed by this audit.

### Infrastructure/configuration already delivered

- Existing accounts, APIs, content, payments and MIT contracts are reused. Local Mobile public env names are present, the Auth key is publishable, and the configured Supabase URL matches Backend.
- The five native Auth return URLs were added and verified on **2026-10-05**. Current acceptance cannot be repeated while the project is inactive; that historical result is not represented as a fresh live login test.
- Development CAPTCHA was deployed to https://mangadock-mobile-captcha-dev.pages.dev/. Fresh HTTPS checks return 200 for all three assets and their bodies match the staged upload. Both the deployed public key and local Backend secret remain the existing development test pair.
- Local Android wrapper specifies Gradle **9.3.1**, local SDK properties exist, and an existing **55,905,063-byte debug APK** is dated **2026-10-05 21:05:58**. A new Gradle/APK assembly was not run in this audit.
- The earlier Backend relation-shape corrections are present in reader-comments, reviews and user-follows. They are separate from the Mobile migration contract; fresh focused tests and Backend compilation pass.

### Fresh checks performed on 2026-10-16

| Check | Result | What it proves |
| --- | --- | --- |
| `npm.cmd test` in Mobile | **218/218 pass**, zero failures/skips | Current automatic behavior suite |
| `npm.cmd run typecheck` in Mobile | Exit 0 | TypeScript compatibility |
| `npm.cmd run validate:env` in Mobile | Exit 0 | Required public names/basic URL format, not service availability |
| Android Hermes export | Exit 0; **772 modules, ~3 MB, 11 assets** | Current source bundles for Android |
| `npm.cmd run build` in Backend | Exit 0 | Backend TypeScript/Nest compilation |
| Three affected Backend spec files | **12/12 pass**, three suites | Existing relation-shape corrections |
| Hosted CAPTCHA assets | **3/3 HTTP 200**, exact staged body matches | Hosting/assets remain available |
| GitHub PRD and 29 slices | **30 OPEN, 0 CLOSED** | Fresh tracker status, including #734 and #753 |
| Supabase MCP `get_project` | **INACTIVE** for `mangadock` | Management-plane project state |
| Project hostname lookup | **ENOTFOUND** | Current API hostname is unavailable from this machine |
| Configured local ports 4001/8081/5003/5004 | **No listeners** at audit time | Previously used local Backend/Metro/MIT ports are not running |

Export artifacts and service/issue receipts are under ignored `Mobile/.expo/native-audit-2026-10-16/`. Export/build tests do not demonstrate speed gains, visual parity, a running Backend/MIT, completed OAuth, a payment or a signed release. No claim of full E2E success is made.

### What remains, in execution order

1. Restore the configured Supabase project to an active state, confirm DNS/API availability and recheck public Auth settings/native return URLs. The MCP status establishes inactivity; this audit did not determine why it became inactive or resume it.
2. Start the existing configured Backend, Metro and required MIT services. Mobile currently points at `http://10.0.2.2:4001`, an Android-emulator address; physical-device/release testing requires an appropriate reachable deployment/LAN/HTTPS URL.
3. Accept the core device journey: real login → CAPTCHA/browser return → MangaDex/Studio reading → single/batch translation → provider test topup/unlock/recovery. Do not use an incidental real-money charge as an acceptance fixture.
4. Accept library/social/account/Community/Studio/staff workflows with real data, roles and OS picker/file/share/back/keyboard/lifecycle interactions; fix failures observed in these checks.
5. Compare populated native screens with the original responsive mobile design, including typography/Thai font metrics, spacing/images, gestures and accessibility. Current screenshots only cover limited earlier login/offline states. Device performance/memory/compatibility measurements remain open; no percentage completion or speed gain is justified.
6. Finish release configuration and signed physical-device APK acceptance. Current app configuration has an empty EAS project ID, a development HTTP address and cleartext setting; generated local release signing still points to debug signing. EAS profiles exist (internal APK development/preview and production app-bundle), but the profiles alone do not prove production credentials or an accepted signed artifact. Configure real Turnstile keys/hostname before production bot-protection acceptance.
7. Preserve/review and commit the approved workspace when requested, then update/close tracker items only against their acceptance evidence. Native source/assets/tests/docs and Backend specs currently include untracked entries; many related files are modified. This audit made no commit, push, PR, merge or issue-state change.

### Existing limits and deferred work

These are baseline limits or explicit later scope, not missing native UI tasks to invent: staff report-resolution queue, Studio approval API and withdrawals are unavailable contracts; known devices are historical records; product-data deletion does not delete Supabase Auth identity; Reader preferences are local and statistics derive from available history. iOS/Google Play release, offline downloads, durable background/lock-screen translation and new push infrastructure remain outside the current Android APK migration.

### Audit method and limitations

TokenSave context was attempted once with Mobile scope and did not return within 10 seconds; the SQLite fallback file was absent. Targeted current files and executed checks were used instead. One batched PowerShell source scan failed due to quoting and was corrected before any command executed. An initial Thai-heading substring probe returned false; exact full-body hashes of all three hosted files subsequently matched the staged originals, so no hosting-content regression was inferred from that probe. Supabase changelog Markdown retrieval was unsupported by the web fetcher; its official HTML changelog was read instead. No dependency/runtime/config change was made in response to the audit.

Completion notification preflight found no `pwsh` command, so the prescribed notification script could not run. No toast delivery is claimed and no notification/execution-policy setup was changed.

### References

- [Approved PRD #724](https://github.com/Slow-Inc/MangaDock/issues/724), [beta gate #734](https://github.com/Slow-Inc/MangaDock/issues/734), [replacement gate #753](https://github.com/Slow-Inc/MangaDock/issues/753).
- [Feature mapping](2026-10-04-native-full-implementation.md), [completion ledger](2026-10-03-native-completion-ledger.md), [design evidence](2026-10-02-native-responsive-design-parity.md), [Auth configuration evidence](2026-10-05-native-auth-redirects.md), [CAPTCHA setup](2026-10-05-reader-captcha-setup.md).

## TH

มี implementation native ใน workspace `feat/mobile-native-phase4` และผ่าน checks source รอบใหม่ แต่ **ยังไม่ผ่านเกณฑ์ release ที่ใช้แทนเดิมครบ** ตัวขวางบริการทันทีคือ Supabase โครงการที่ตั้งไว้มีสถานะ **INACTIVE** และ hostname ของโครงการหา DNS ไม่พบ การตรวจนี้ไม่เปลี่ยน remote config บัญชี source code หรือ env ส่วนตัว

### ทำอะไรไปแล้ว

เทียบ mapping ด้านล่างกับ entry/view wiring native ปัจจุบัน ไฟล์ controllers/tests PRD ที่อนุมัติและ ledger แล้ว คำว่ามี implementation หมายถึงมี source และ automatic behavior coverage ไม่ได้ยืนยันทุกเกณฑ์หรือ interaction อุปกรณ์จริง

| งาน / issues | Implementation native ที่มี | Acceptance ที่ยังเหลือ |
| --- | --- | --- |
| Runtime/Auth #725–#726 | Entry Expo/React Native, hardware identity, restore session Supabase, browser OAuth/PKCE และ TOTP ตามเงื่อนไข | Login provider จริง กลับแอป restore session และสลับบัญชี |
| Reader #727–#729 | ค้นหา/รายละเอียด/ตอน MangaDex และ Studio ที่เผยแพร่ CAPTCHA handoff โหมดอ่าน navigation zoom HD/saver | ข้อมูลจริง กลับจาก browser gestures และตำแหน่ง history บนอุปกรณ์ |
| แปล #730–#731 | Patches หน้าเดียว native batch progress/cancel/retry สลับ derivative/context และ foreground lifecycle | ผล Backend/MIT จริง alignment ยกเลิก การหลุดและการใช้ทรัพยากร |
| Wallet/payment #732–#733 | ยอด server unlock QR topup เก็บ pending payment และกู้หลังแอปธนาคาร/กลับอ่าน | Payment ทดสอบ provider ตรวจยอด/สิทธิ์และ OS return จริง |
| Discovery/library #735–#736 | Home หกปลายทางเดิม หมวด/tags/releases/related collections history เรียงคำขอ CSV/share | เทียบดีไซน์ที่มีข้อมูลจริงและ file/share ของอุปกรณ์ |
| Social การอ่าน/profile #737–#738 | Rating/review/ความคิดเห็นรายหน้า/report โปรไฟล์ follow และ banner | สิทธิ์บัญชี picker/crop และ interactions กับ server จริง |
| บัญชี/activity/security #739–#743 | เช็กอิน แจ้งเตือน preferences/สถิติ history recovery/linking/MFA/devices/ลบข้อมูลผลิตภัณฑ์ Wallet ledger | Lifecycle อีเมล/provider/MFA/แจ้งเตือนและ ledger จริง |
| Community #744–#746 | Feed/trending post CRUD/รูป replies/votes/reports และ guards SSE | Upload/picker สิทธิ์บัญชี reconnect และ live updates บนอุปกรณ์ |
| Studio #747–#749 | Workspace/drafts creator upload เรียง/retry/reorder/delete เผยแพร่ รายได้ Wallet เดิม | Roles/upload จริง ตรวจผลไม่แน่ชัด publish และรายได้ |
| ทีมงาน #750–#752 | Users/roles/ban/wallet pin/delete ธุรกรรม audit/statistics เดิม | Roles/401/403/สลับบัญชีและ interactions อุปกรณ์จริง |
| Release gates #734/#753 | Debug APK และหลักฐาน source review/export เดิม | ยังเปิด beta บนอุปกรณ์จริงและ signed APK สำหรับแทนเดิม |

`Mobile/App.tsx` เชื่อม runtime/session native ไปยัง feature views/controllers จริง Scan source/entry/package ปัจจุบันไม่พบ import/dependency WebView หรือ TODO/FIXME ที่เป็น implementation placeholder ข้อความหน้ายังไม่รองรับที่ตรวจเป็น guards whitelist/navigation ส่วน file-share readiness เป็น guard ความสามารถ OS ผล scan นี้ไม่แทนการตรวจ requirement หรือภาพครบทุกหน้า ไม่แก้ legacy bridge ในรอบตรวจ

### Infrastructure/config ที่ทำแล้ว

- ใช้บัญชี/API/content/payment/MIT contracts เดิม Mobile มี public env names ครบ Auth key เป็น publishable และ URL Supabase ตรง Backend
- เพิ่ม native Auth return URL ทั้งห้าและตรวจผ่านเมื่อ **2026-10-05** วันนี้ยังตรวจ acceptance ซ้ำไม่ได้ระหว่างโครงการ inactive จึงไม่ถือหลักฐานเก่าเป็น live login ใหม่
- Deploy CAPTCHA development ที่ https://mangadock-mobile-captcha-dev.pages.dev/ แล้ว ตรวจ HTTPS ใหม่สาม assets ตอบ 200 และเนื้อหาตรง staged upload ทั้งหมด Public key ที่ deploy และ secret Backend ในเครื่องยังเป็นคู่ทดสอบ development เดิม
- Wrapper Android ในเครื่องกำหนด Gradle **9.3.1** มี SDK local properties และ debug APK เดิมขนาด **55,905,063 bytes** ลงวันที่ **2026-10-05 21:05:58** ไม่รัน Gradle/APK assembly ใหม่ในการตรวจนี้
- มีการแก้ relation-shape ของ reader-comments/reviews/user-follows ใน Backend เดิม แยกจาก contract การย้าย Mobile ตรวจ focused tests และ compile Backend รอบใหม่ผ่าน

### ผลตรวจใหม่วันที่ 2026-10-16

| Check | ผล | ยืนยันอะไร |
| --- | --- | --- |
| `npm.cmd test` ใน Mobile | **218/218 ผ่าน** ไม่มี fail/skip | Automatic behavior suite ปัจจุบัน |
| `npm.cmd run typecheck` ใน Mobile | Exit 0 | ความเข้ากันได้ TypeScript |
| `npm.cmd run validate:env` ใน Mobile | Exit 0 | มี public names และรูปแบบ URL ไม่ยืนยันบริการพร้อม |
| Export Android Hermes | Exit 0 **772 modules ~3 MB 11 assets** | Source ปัจจุบัน bundle Android ได้ |
| `npm.cmd run build` ใน Backend | Exit 0 | Compile TypeScript/Nest Backend |
| Backend specs สามไฟล์ที่เกี่ยวข้อง | **12/12 ผ่าน** สาม suites | การแก้ relation-shape เดิม |
| CAPTCHA hosted assets | **3/3 HTTP 200** ตรง staged bodies | Hosting/assets ยังเข้าถึงได้ |
| PRD และ 29 slices GitHub | **30 OPEN, 0 CLOSED** | สถานะ tracker ล่าสุด รวม #734/#753 |
| Supabase MCP `get_project` | **INACTIVE** สำหรับ `mangadock` | สถานะ project จาก management plane |
| DNS hostname project | **ENOTFOUND** | เครื่องนี้เข้า API hostname ปัจจุบันไม่ได้ |
| พอร์ต local ที่ตั้งไว้ 4001/8081/5003/5004 | **ไม่มี listener** ขณะตรวจ | Backend/Metro/MIT ตามพอร์ตที่เคยใช้ยังไม่รัน |

Artifacts export และ receipts อยู่ใน `Mobile/.expo/native-audit-2026-10-16/` ที่ถูก ignore ผล export/build/tests ไม่ยืนยันความเร็ว ภาพตรงกัน Backend/MIT ที่รันจริง OAuth/payment ที่สำเร็จหรือ signed release ไม่อ้าง full E2E ผ่าน

### เหลืออะไร ตามลำดับทำต่อ

1. ให้ Supabase โครงการที่ตั้งไว้กลับ active ตรวจ DNS/API และตรวจ public Auth settings/native return URLs ใหม่ MCP ยืนยัน inactivity แต่รอบนี้ไม่สรุปสาเหตุที่ inactive และไม่ resume โครงการ
2. เปิด Backend, Metro และ MIT เดิมที่ตั้งไว้ Mobile ใช้ `http://10.0.2.2:4001` สำหรับ Android emulator การตรวจบนเครื่องจริง/release ต้องมี URL deployment/LAN/HTTPS ที่เครื่องนั้นเข้าถึงได้
3. รับเส้นทางหลักบนอุปกรณ์จริง: login → CAPTCHA/browser return → อ่าน MangaDex/Studio → แปลหน้าเดียว/ทั้งตอน → payment ทดสอบ provider/unlock/recovery ไม่ใช้การจ่ายเงินจริงโดยบังเอิญเป็น fixture
4. รับ library/social/account/Community/Studio/staff ด้วยข้อมูล roles และ picker/file/share/back/keyboard/lifecycle จริง แก้ failures ที่พบจาก checks เหล่านี้
5. เทียบหน้าจอ native ที่มีข้อมูลกับ responsive mobile เดิม รวมฟอนต์/metrics ภาษาไทย ระยะ/รูป gestures accessibility หลักฐาน screenshots ปัจจุบันครอบเพียง login/offline ก่อนหน้า Performance/memory/compatibility ของอุปกรณ์ยังเปิด ไม่อ้างเปอร์เซ็นต์เสร็จหรือเร็วขึ้น
6. ตั้ง release และรับ signed APK บนอุปกรณ์จริง app config ยังมี EAS project ID ว่าง ใช้ URL HTTP สำหรับ development และ cleartext setting ส่วน generated local release signing ยังชี้ debug มี EAS profiles แล้วคือ internal APK development/preview และ production app-bundle แต่ profile อย่างเดียวไม่ยืนยัน production credentials หรือ signed artifact ที่ผ่านรับรอง ต้องใช้ Turnstile keys/hostname จริงก่อนรับ protection production
7. เก็บ/review/commit workspace ที่อนุมัติเมื่อผู้ใช้สั่ง แล้วอัปเดต/ปิด tracker ตาม acceptance evidence ปัจจุบัน native source/assets/tests/docs และ Backend specs มี untracked entries และมี modified files หลายรายการ รอบนี้ไม่ commit/push/สร้าง PR/merge/เปลี่ยนสถานะ issue

### ข้อจำกัดเดิมและงานเลื่อนไปภายหลัง

ไม่ใช่งาน native UI ที่ให้สร้างขึ้นเอง: ไม่มี contract คิว resolve รายงานทีมงาน API อนุมัติ Studio หรือถอนเงิน รายการ devices เป็นประวัติ ลบข้อมูลผลิตภัณฑ์ไม่ลบ Supabase Auth identity preferences Reader เป็น local และสถิติมาจาก history ที่มี ส่วน iOS/Google Play release, offline downloads, durable background/lock-screen translation และ push infrastructure ใหม่อยู่นอก scope Android APK รอบนี้

### วิธีตรวจและข้อจำกัด

ลอง TokenSave context แบบจำกัด Mobile หนึ่งครั้ง ไม่ตอบใน 10 วินาที และไม่มีไฟล์ SQLite fallback จึงใช้ targeted files ปัจจุบันกับ checks ที่รันจริง คำสั่ง scan PowerShell หนึ่งรอบ parse ไม่ผ่านเพราะ quoting แก้ก่อนมีคำสั่งใดทำงาน การ probe substring heading ภาษาไทยรอบแรกได้ false แต่ hash ของเนื้อหาเต็มทั้งสามไฟล์ host ตรงกับ staged originals จึงไม่สรุปว่า hosting content เสีย Web fetcher ไม่รับ content type Markdown ของ Supabase changelog จึงอ่าน official HTML แทน ไม่เปลี่ยน dependency/runtime/config ตามผล audit นี้

ตรวจ notification เมื่อเสร็จไม่พบคำสั่ง `pwsh` จึงรัน script ที่กำหนดไม่ได้ ไม่อ้างว่าส่ง toast สำเร็จ ไม่แก้ notification/execution-policy setup

แหล่งอ้างอิง PRD/issues และเอกสารหลักเหมือนรายการ References ในส่วน EN ด้านบน
