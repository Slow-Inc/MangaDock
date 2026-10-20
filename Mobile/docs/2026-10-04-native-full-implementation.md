# Native migration implementation and acceptance — 2026-10-04

Operational update, 2026-10-05: Mobile public env is configured; all five hosted native Auth redirects now pass live destination checks while preserving existing web settings. Actual provider sign-in/device acceptance remains open. [Latest evidence](2026-10-05-native-auth-redirects.md).

ผลติดตามวันที่ 2026-10-05: ตั้ง public env Mobile แล้ว เพิ่ม native Auth redirects ทั้งห้าและตรวจปลายทางจริงผ่าน คงเว็บเดิม ยังต้องตรวจ login บัญชีจริง/อุปกรณ์ ดูรายงานล่าสุดด้านบน

## EN

The approved native migration now has local source implementations for reader, account, Community, Studio and existing staff workflows. This is an implementation checkpoint, not acceptance of a full replacement release. PRD [#724](https://github.com/Slow-Inc/MangaDock/issues/724) and slices #725–#753 remain open; no issues were closed or republished, and no commit/push/merge was requested.

| Slice | Native source / behavior | Evidence and remaining gate |
| --- | --- | --- |
| S01–S09 | Existing native runtime/auth/catalog/Reader/translation/payment flows | Controller tests and Hermes export; provider/captcha/live payment/translation/device acceptance still open |
| S10 | Phase 1 beta acceptance | Open; prior login/offline captures do not prove populated workflows or signed APK acceptance |
| S11 | Home/discovery and original six mobile navigation destinations | Native discovery/navigation stores and views; populated mobile web/native comparison open |
| S12 | Collections, ordered history save/delete/resume, server CSV and OS sharing | `personal.ts`, `files.ts`, native library/detail actions; native sharing device check open |
| S13 | Review summary/my-review, save/delete, page comments, reports, translation quality votes | `reading-social.ts`, `translation-feedback.ts`; uses existing API and one-based page context |
| S14 | Public profiles, follower lists/follow, authored posts, owner banner upload/position | `profiles.ts`, native profile/banner; image crop and device picker comparison open |
| S15–S17 | Server check-in, notifications/count/read/destinations, profile/photo history/preferences/history statistics | `account-activity.ts`, `account-settings.ts`, `reading-stats.ts`; statistics describe stored history, not invented all-time analytics |
| S18 | Registration/verification/resend/recovery, password, linked providers, TOTP, devices, other-session logout, product-data deletion | Real Supabase public SDK; distinct PKCE callbacks, proven PASSWORD_RECOVERY event and AAL2 verification; hosted redirect acceptance verified 2026-10-05, actual provider/account flows remain open |
| S19 | Existing server wallet ledger and available analytics | Server balance/transactions; latest 50 only, no invented pagination/payout |
| S20–S22 | Feed/trending/manga feeds, post CRUD/image attachments, nested replies/edit/delete/votes/reports, SSE | `community.ts`, `forum.ts`, native composer/detail; foreground/exit stream guards; live reconnect/device comparison open |
| S23–S25 | Creator onboarding/roles, own works/drafts, metadata/price, ordered uploads/retry/page reorder/delete, publish lifecycle, earnings | `studio.ts`, native Studio; unknown create/upload outcomes require reconciliation rather than automatic duplication |
| S26–S28 | Existing staff users/roles/ban/wallet, post pin/delete, transactions/detail, audit/statistics | `staff.ts`, native staff; server authorization remains authoritative and 401/403 clears private caches |
| S29 | Complete replacement review and signed Android device acceptance | Open; source review is separate from live/visual/release acceptance |

Local verification after final review corrections: 218 Mobile tests passed; TypeScript passed. Fresh Android prebuild without clean and x86_64 debug assembly passed (204 tasks, 33 executed, 171 up-to-date), with file-system/sharing/image-picker native modules. Fresh Hermes Android export passed: 772 modules, approximately 3 MB and 11 assets. These checks do not initialize real services, prove image picker/sharing interactions, or validate a signed release. One fresh whole-workspace review completed. Six Important findings and the regraded Reader-preference issue were corrected using observed behavior RED->GREEN; all 218 tests pass. Rendered React integration tests exercise real native component/controller wiring with OS boundaries substituted, so actual device interaction remains a separate gate. See the completion ledger for all findings and rulings.

Scope: implementation and dependencies are in Mobile. Frontend, Backend and MIT native-migration source contracts are preserved, including the shared bridge. Earlier Backend profile-join compilation fixes already present in the workspace are separate. New native media modules require rebuilding the development binary; reloading JS into an older binary is insufficient.

Design reference: existing responsive mobile Frontend and root DESIGN.md. Home, library, Reader, profile, Community and Studio use the original hierarchy, actions, dark/indigo/amber tokens and artwork. Staff currently has a desktop management reference, so native adapts its tokens/actions rather than claiming an original mobile layout. Exact font metrics, corresponding populated screen captures, touch/keyboard/Back/image/share behavior and accessibility acceptance remain open.

Preserved baseline limits: no staff report queue/resolution, Studio approval endpoint or withdrawal contract exists. Known devices are historical records, not live session inventory. DELETE users/me removes product data and does not delete Supabase Auth identity. Upload metadata retains the existing locked chapter/language behavior; chapter title is optional, description/price editable. Backend avatar-file deletion exists but current Frontend profile has no deletion flow, so no new product action was invented.

TDD limitation: initial missing-import failures in five new module tracers were not behavior RED. Subsequent actual behavior failures and fixes are recorded; do not reconstruct or claim perfect test-first history. See [completion ledger](2026-10-03-native-completion-ledger.md).

To run against real services, EXPO_PUBLIC_API_BASE_URL, EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY must belong to the same existing deployment/account project. The missing public env checkpoint was resolved during subsequent diagnostics; the configured MangaDock project now accepts all five native Auth return URLs. Do not copy service-role secrets into public variables or combine projects. Run `npm.cmd run validate:env`, then the existing Backend and `npm.cmd run android`. Required provider redirect allowlist includes `mangadock://auth/callback`, `/signup`, `/recovery`, `/link` and `/reauth` under the same scheme/host; use the exact strings exported by the corresponding Auth controllers. CAPTCHA uses its existing HTTPS endpoint and native callback. Incoming product links use the mangadock scheme and whitelist existing destinations; Auth callbacks stay with their respective Auth flow.

## TH

งาน native ที่อนุมัติมี source ในเครื่องสำหรับ workflows ผู้อ่าน บัญชี Community Studio และทีมงานที่ระบบเดิมรองรับแล้ว นี่เป็น checkpoint implementation ไม่ใช่การรับ release แทนแอปเดิมครบทั้งระบบ PRD [#724](https://github.com/Slow-Inc/MangaDock/issues/724) และ slices #725–#753 ยังเปิดอยู่ ไม่ปิดหรือเผยแพร่ซ้ำ และไม่มีคำขอ commit/push/merge

| Slice | Source / พฤติกรรม native | หลักฐานและเกณฑ์ที่ยังเหลือ |
| --- | --- | --- |
| S01–S09 | Runtime/auth/catalog/Reader/translation/payment native เดิม | Controller tests และ Hermes export; ยังเปิด provider/captcha/ชำระเงิน/แปลจริง/อุปกรณ์ |
| S10 | รับ beta Phase 1 | ยังเปิด; ภาพ login/offline เดิมไม่ยืนยัน workflows populated หรือ signed APK |
| S11 | Home/discovery และ navigation mobile หกปลายทางเดิม | Stores/views discovery/navigation native; ยังต้องเทียบ mobile web/native ที่มีข้อมูลจริง |
| S12 | รายการส่วนตัว ประวัติบันทึก/ลบเรียงคำขอ/กลับอ่าน CSV server และ OS sharing | `personal.ts`, `files.ts`, library/detail actions native; ยังต้องตรวจ sharing บนอุปกรณ์ |
| S13 | Summary/my-review บันทึก/ลบ ความคิดเห็นรายหน้า รายงานและโหวตคุณภาพแปล | `reading-social.ts`, `translation-feedback.ts`; API เดิมและหมายเลขหน้าเริ่มหนึ่ง |
| S14 | Public profiles followers/follow โพสต์ผู้เขียน อัปโหลด/จัดตำแหน่ง banner เจ้าของ | `profiles.ts`, profile/banner native; ยังต้องเทียบ crop และ picker อุปกรณ์ |
| S15–S17 | เช็กอิน server แจ้งเตือน/count/read/ปลายทาง โปรไฟล์/ประวัติรูป/preferences/สถิติจาก history | `account-activity.ts`, `account-settings.ts`, `reading-stats.ts`; สถิติอธิบาย history ที่เก็บ ไม่สร้าง all-time analytics |
| S18 | สมัคร/ยืนยัน/resend/recovery รหัสผ่าน เชื่อม providers TOTP อุปกรณ์ ออกจากเซสชันอื่นและลบข้อมูลผลิตภัณฑ์ | Public SDK Supabase จริง; PKCE callbacks แยก PASSWORD_RECOVERY event ที่ยืนยันแล้วและตรวจ AAL2; ตรวจ hosted redirect ผ่านวันที่ 2026-10-05 ยังต้องตรวจ provider/บัญชีจริง |
| S19 | Ledger server และ analytics ที่มีอยู่ | ยอด/ธุรกรรม server; ล่าสุด 50 เท่านั้น ไม่สร้าง pagination/payout |
| S20–S22 | Feed/trending/manga feeds post CRUD/รูป nested replies/edit/delete/votes/reports และ SSE | `community.ts`, `forum.ts`, composer/detail native; gates foreground/ออกจากหน้า; ยังต้องตรวจ reconnect จริง/เทียบอุปกรณ์ |
| S23–S25 | สมัคร creator/roles ผลงาน/drafts ตนเอง metadata/ราคา uploads เรียงลำดับ/retry/reorder/delete lifecycle เผยแพร่และรายได้ | `studio.ts`, Studio native; ผล create/upload ที่ไม่แน่ชัดต้องตรวจซ้ำ ไม่ทำซ้ำอัตโนมัติ |
| S26–S28 | ทีมงาน users/roles/ban/wallet pin/delete โพสต์ ธุรกรรม/detail audit/statistics เดิม | `staff.ts`, staff native; server ตัดสินสิทธิ์และล้าง private cache เมื่อ 401/403 |
| S29 | Review การแทนแอปครบและรับ signed Android บนอุปกรณ์ | ยังเปิด; source review แยกจาก live/visual/release acceptance |

ตรวจหลังแก้ review: Mobile 218 tests ผ่าน TypeScript ผ่าน prebuild Android ใหม่โดยไม่ clean และประกอบ debug x86_64 ผ่านก่อนหน้านี้ (204 tasks ทำจริง 33 ใช้ผลเดิม 171) พร้อม modules file-system/sharing/image-picker export Hermes Android หลังแก้ผ่าน 772 modules ประมาณ 3 MB และ assets 11 ไฟล์ Reviewer บริบทใหม่ตรวจ workspace รวมหนึ่งรอบแล้ว แก้ Important หกข้อและ preferences Reader ที่ยกระดับด้วย behavior RED→GREEN ที่พบจริง Tests React integration render components/controllers native จริง จำลองขอบ OS เท่านั้น จึงยังต้องรับ interaction บนอุปกรณ์จริง Checks ไม่เปิดบริการจริง ไม่ยืนยัน picker/sharing และไม่รับรอง signed release ดู findings/rulings ใน completion ledger

ขอบเขต: implementation/dependencies อยู่ Mobile คง source contracts Frontend/Backend/MIT สำหรับ migration และ shared bridge งานแก้ compilation profile joins ของ Backend ที่อยู่เดิมใน workspace แยกต่างหาก ต้อง rebuild development binary เพื่อใช้ media modules ใหม่ การ reload JS ลง binary เก่าไม่พอ

ต้นแบบภาพคือ Frontend responsive mobile เดิมและ DESIGN.md ที่ root Home/library/Reader/profile/Community/Studio ใช้ลำดับเนื้อหา actions tokens dark/indigo/amber และ artwork เดิม ทีมงานมีต้นแบบ desktop จึงแปลง tokens/actions ไม่อ้างว่ามี layout mobile เดิม ยังเปิด font metrics ภาพ populated คู่กัน พฤติกรรม touch/keyboard/Back/image/share และ accessibility acceptance

ข้อจำกัดที่คงจากต้นแบบ: ไม่มีคิว/resolve รายงานทีมงาน endpoint อนุมัติ Studio หรือถอนเงิน Known devices เป็นประวัติ ไม่ใช่รายการเซสชันสด DELETE users/me ลบข้อมูลผลิตภัณฑ์ ไม่ลบตัวตน Supabase Auth Metadata upload คงการล็อกตอน/ภาษาเดิม ชื่อตอนเว้นได้ หมายเหตุ/ราคาแก้ได้ Backend ลบไฟล์ avatar ได้ แต่ Frontend profile ปัจจุบันไม่มี flow ลบ จึงไม่เพิ่ม action ผลิตภัณฑ์ใหม่

ข้อจำกัด TDD: import failure แรกของ tracers modules ใหม่ห้าตัวไม่ใช่ behavior RED บันทึกรอบ failures พฤติกรรมจริงและการแก้ภายหลังแล้ว ไม่สร้างประวัติย้อนหลังหรืออ้าง test-first สมบูรณ์ ดู [completion ledger](2026-10-03-native-completion-ledger.md)

รันบริการจริงโดยตั้ง public env Mobile: EXPO_PUBLIC_API_BASE_URL, EXPO_PUBLIC_SUPABASE_URL และ EXPO_PUBLIC_SUPABASE_ANON_KEY ต้องเป็น deployment/โครงการบัญชีเดิมเดียวกัน checkpoint ที่ public variables ขาดแก้แล้วระหว่างวินิจฉัยภายหลัง โครงการ MangaDock ที่ตั้งค่าไว้ยอมรับ native Auth return URL ทั้งห้าแล้ว ห้ามคัดลอก service-role secrets ลง public variables หรือผสมโครงการ รัน `npm.cmd run validate:env` แล้ว Backend เดิมและ `npm.cmd run android` Allowlist providers ต้องมี `mangadock://auth/callback`, `/signup`, `/recovery`, `/link`, `/reauth` ภายใต้ scheme/host เดียวกัน ใช้ strings ที่ Auth controllers แต่ละตัว export ตรงจริง CAPTCHA ใช้ HTTPS endpoint/callback native เดิม ลิงก์ผลิตภัณฑ์เข้าแอปใช้ scheme mangadock และ whitelist ปลายทางเดิม ส่วน Auth callbacks ให้ flow Auth ที่เกี่ยวข้องรับผิดชอบ
