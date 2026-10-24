# ADR 030: Native account, Community, Studio and staff clients reuse existing contracts

Date: 2026-10-04
Status: Accepted implementation direction; live/visual/release acceptance open

Reader configuration follow-up, 2026-10-05: the existing external-browser CAPTCHA page is hosted for development on Cloudflare Pages, with matched public Expo env and the existing Backend clearance contract. No WebView or application architecture change; the existing test key pair does not establish production bot protection. [Configuration and evidence](../../Mobile/docs/2026-10-05-reader-captcha-setup.md).

ติดตาม Reader วันที่ 2026-10-05: host หน้า CAPTCHA ผ่าน browser ภายนอกเดิมบน Cloudflare Pages สำหรับ development ตั้ง public env Expo ตรงกันและคง contract clearance ของ Backend ไม่เพิ่ม WebView หรือเปลี่ยนสถาปัตยกรรม คู่ key ทดสอบเดิมไม่รับรอง protection production ดู config/หลักฐานในรายงานด้านบน
Operational follow-up, 2026-10-05: Existing hosted Auth now accepts all five native return URLs, preserving web redirects and other settings. This realizes the existing shared-account decision without an architecture change; actual provider login/device acceptance remains open. [Verification](../../Mobile/docs/2026-10-05-native-auth-redirects.md).

ผลติดตามวันที่ 2026-10-05: Supabase Auth เดิมยอมรับ native return URL ทั้งห้าแล้ว คง redirect เว็บและ settings อื่น เป็นการตั้งค่าตามระบบบัญชีเดิม ไม่เปลี่ยนสถาปัตยกรรม ยังต้องรับรอง login บัญชีจริงและการกลับเข้าแอป

## EN

Context: PRD #724 authorizes a complete native Android client with original responsive mobile design, existing accounts/content/purchases and unchanged Backend/MIT rules. The approved client must expose account, Community, creator and existing staff actions without embedded WebView. Concurrent requests, revoked accounts/roles, SSE and ambiguous upload outcomes can otherwise leak private data or overwrite server-acknowledged state.

Decision: Keep implementation in Mobile. Reuse the public Supabase SDK and existing authenticated Backend endpoints with the same hardware identifier. Private stores capture account/permission identity and request/view generations, abort on exit/revocation and reject late results. Fresh server authorization remains authoritative; staff 401/403 clears all cached management data. Check-in/wallet and comment read/write reconciliation preserve acknowledged results. Native product destinations are whitelisted separately from browser-owned Auth PKCE callbacks.

Auth uses documented PASSWORD_RECOVERY events and verifies actual AAL2 before granting sensitive operations. Identity linking/unlinking, password and TOTP actions preserve existing confirmation/reauthentication rules. Known devices remain historical records; product-data deletion is accurately distinguished from deleting the Auth identity. Never consume SDK private fields to manufacture callback proof.

Use Expo native image picker, file-system and sharing for uploads and CSV delivery, preserving current 5 MB profile/forum and 10 MB Chapter Page limits and server validation. Creator queues preserve selection order, retain acknowledged pages and distinguish definitive rejection from unknown outcomes. Unknown creation/upload outcomes require inspecting authoritative works/pages before repetition; client guards do not promise server exactly-once behavior. Native modules require a rebuilt binary.

Consequences: No alternate account system, database/schema, service workflow or unsupported API is introduced. No staff report queue, Studio approval or withdrawal flow is fabricated. Original mobile navigation/hierarchy/artwork remain the reference; staff adapts existing desktop tokens/actions. Controller tests, typecheck, Hermes export and debug native build are separate evidence from provider/captcha/live payment/translation, populated visuals and signed physical-device release acceptance. Missing or mismatched public env keeps those gates open. Initial missing-module test failures are documented as invalid behavior RED evidence rather than reconstructed history.

References: [PRD](../../Mobile/docs/2026-10-02-native-mobile-migration-prd.md), [feature and acceptance mapping](../../Mobile/docs/2026-10-04-native-full-implementation.md), [ledger](../../Mobile/docs/2026-10-03-native-completion-ledger.md), [Supabase MFA assurance](https://supabase.com/docs/reference/javascript/auth-mfa-getauthenticatorassurancelevel), [Expo continuous native generation](https://docs.expo.dev/workflow/continuous-native-generation/).

## TH

บริบท: PRD #724 อนุมัติ native Android ครบ ใช้ design responsive mobile เดิม บัญชี/เนื้อหา/การซื้อเดิมและกติกา Backend/MIT เดิม Client ต้องมี actions บัญชี Community creator และทีมงานที่ระบบรองรับโดยไม่มี embedded WebView คำขอพร้อมกัน การถอนบัญชี/role SSE และผล uploads ที่ไม่แน่ชัดอาจเผยข้อมูลส่วนตัวหรือทับ state ที่ server ตอบรับแล้ว

การตัดสินใจ: Implementation อยู่ Mobile ใช้ public SDK Supabase และ authenticated endpoints Backend เดิมพร้อม hardware identifier เดียวกัน Private stores จับตัวตนบัญชี/สิทธิ์และรุ่นคำขอ/หน้า abort เมื่อออกหรือถอนสิทธิ์ และทิ้งผลล่าช้า Server เป็นผู้ตัดสินสิทธิ์จริง เมื่อ staff รับ 401/403 ล้างข้อมูลจัดการที่ cache ทั้งหมด การ reconcile reads/writes เช็กอิน/wallet/คอมเมนต์รักษาผลตอบรับแล้ว Whitelist ปลายทาง native product แยกจาก Auth PKCE callbacks ที่ browser flow เป็นเจ้าของ

Auth ใช้ PASSWORD_RECOVERY events ตามเอกสารและตรวจ AAL2 จริงก่อนให้ทำรายการสำคัญ Linking/unlinking identities รหัสผ่านและ TOTP คงการยืนยัน/reauthentication เดิม Known devices เป็นประวัติ แยกข้อความลบข้อมูลผลิตภัณฑ์จากลบตัวตน Auth ให้ตรงจริง ไม่ใช้ private fields SDK สร้างหลักฐาน callback

ใช้ Expo native image picker/file-system/sharing กับ uploads และ CSV คงขนาด profile/forum 5 MB กับ Chapter Pages 10 MB และ validation server Creator queues คงลำดับที่เลือก เก็บ pages ที่ตอบรับแล้ว แยกการปฏิเสธชัดเจนจากผลไม่แน่ชัด ผล create/upload ไม่แน่ชัดต้องตรวจ works/pages จริงก่อนทำซ้ำ Client guards ไม่รับประกัน exactly-once ของ server Modules native ต้อง rebuild binary

ผลตามมา: ไม่สร้างระบบบัญชี ฐานข้อมูล/schema workflow บริการหรือ API ใหม่ ไม่สร้างคิวรายงานทีมงาน อนุมัติ Studio หรือถอนเงินขึ้นมา Navigation/hierarchy/artwork mobile เดิมเป็นหลัก ส่วนทีมงานแปลง tokens/actions desktop เดิม Controller tests/typecheck/Hermes export/debug native build แยกจาก provider/captcha/payment/translation จริง ภาพ populated และ signed release บนอุปกรณ์จริง Public env ที่ขาด/คนละโครงการทำให้ gates นี้ยังเปิด บันทึก missing-module failures แรกว่าไม่ใช่ behavior RED แทนสร้างประวัติย้อนหลัง

แหล่งอ้างอิง: [PRD](../../Mobile/docs/2026-10-02-native-mobile-migration-prd.md), [mapping ฟีเจอร์/acceptance](../../Mobile/docs/2026-10-04-native-full-implementation.md), [ledger](../../Mobile/docs/2026-10-03-native-completion-ledger.md), [Supabase MFA assurance](https://supabase.com/docs/reference/javascript/auth-mfa-getauthenticatorassurancelevel), [Expo continuous native generation](https://docs.expo.dev/workflow/continuous-native-generation/).
