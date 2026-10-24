# Native Phase 5 Collections, Feed and deep links

<!-- lang:en -->
## Delivered source

Continuing `feat/mobile-phase5-push-20261023` from pushed head `a790711` in `C:/Users/woral/md-phase5-mobile`. The user requested the recommended native follow-up. Existing Backend contracts, schema and rollout flags are retained.

- Library → **คอลเลกชันของฉัน**: create, edit, delete, search/add/remove manga, private by default, public visibility and Android/iOS native share sheet for `mangadock://collections/<uuid>`. Public links open for guests; only owners see mutation controls. Deletion/removal require native confirmation. The shared scheme opens an installed app; it is not an HTTPS universal/app link with an installation fallback.
- Community → **ฟีดของฉัน**: Following/Personalized modes using existing database ranking, manual refresh, offset pagination, ID deduplication, empty/login/error/retry states. Reuses the existing native post component, including spoiler gating and author/manga/post actions. Returning from a post preserves the selected mode and loaded pages.
- Scheme and relative destinations support collections, a collection UUID, and feed. Invalid UUIDs, path traversal, external origins and auth callbacks are rejected. Guest login preserves the requested Collections/Feed destination across session remount.
- `retention.ts` follows existing subscribed controllers. Each request channel has cancellation/revision guards; account changes clear private state and invalidate pending results. Reads include response-body deadlines. Writes wait for server acknowledgement, block duplicate taps, preserve error state and are never automatically retried. The server remains the ownership/visibility authority.
- New views reuse existing Mobile design tokens, 48dp actions, wrapping labels and a 760dp content cap. No new runtime dependency or WebView is introduced.

## Verification and boundaries

- Baseline Mobile: **254/254**. Updated suite: **268/268**, including real React screen flows with substituted OS widgets/services; TypeScript passes.
- `node scripts/phase5-native-integration.cjs`: passes Native session/controller → real loopback HTTP → Nest controllers/AuthGuard → PostgreSQL migration SQL in isolated PGlite. Covers collection CRUD/items/search, guest denial/public read/privacy revocation, both feeds and logout clearing. Auth/catalog/provider infrastructure is synthetic; no real account, cloud schema or push is modified.
- Final Android `assembleRelease` and `lintVitalAnalyzeRelease` pass for ARM64 + x86_64: **320 tasks, 14 executed / 306 up-to-date, 18 seconds**. The final source rebundled **836 modules and 11 assets**. APK v2 signature verification passes and both ABIs are present. Automated React tests/build do not prove native layout or device interactions.
- An attempt to start Metro with isolated QA public configuration was rejected by automatic approval review (`blocked by policy`, no further reason supplied). That command was not retried through another mechanism. Full visual/device acceptance of these new screens is still open.
- Read-only local setting checks found no EAS project ID, Firebase config path/file or server Expo credential. Enhanced-security Expo credentials are only required if that provider option is enabled. Real enabled push, live Phase 5 schema/networking, Redis delivery and signed distribution remain separate acceptance gates.

## Android QA artifact

- [ARM64 + x86_64 APK](../build/apk/2026-10-24/MangaDock-0.1.0-native-retention-arm64-x86_64.apk), **44,954,987 bytes**.
- SHA-256: `16FD5BF20CABCEA38E6D7335558487D461BB9E4BDD429EEF21528FCDF0ED8ABE`.
- Existing app version/configuration and QA signing retained. This is an internal artifact, not accepted Store distribution. It has not been installed over the user's physical phone in this session.
- Raw local logs: `qa/native-retention-20261024/`. An initial build lacked SDK discovery; an ignored `Mobile/android/local.properties` now points at the already-installed SDK. The successful final build uses the previously documented process-local `en-US` Gradle JVM locale; system settings were not changed.

## Reproduce

Mobile source checks:

```powershell
cd Mobile
npm.cmd test
npm.cmd run typecheck
```

On this Windows workstation, from `Mobile/android` with SDK discovery configured:

```powershell
.\gradlew.bat :app:assembleRelease :app:lintVitalAnalyzeRelease '-PreactNativeArchitectures=arm64-v8a,x86_64' '-Dorg.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=512m -Duser.language=en -Duser.country=US' --console=plain --max-workers=2
```

From the repository root, after installing existing Backend/Mobile dependencies and building Backend:

```powershell
node scripts/phase5-native-integration.cjs
# Optional local-only QA server; stops without persisting its fixture DB:
node scripts/phase5-native-preview.cjs
```

The preview binds only `127.0.0.1:4017` and prints a synthetic public collection UUID. It supplies fake Auth/catalog and forwards retention requests to actual local Nest/SQL. It is a QA utility, not a deployment server. Real visual acceptance must use a separately configured native QA build and never redirect a personal session to this fixture.

## Remaining release work

1. Verify and apply the existing two Phase 5 migrations through the normal database workflow, deploy compatible services and test actual proxy/networking.
2. Verify native layout, keyboard, scrolling, font scaling, share/cancel and cold/warm deep links on physical Android. Check tablet layout and iOS separately.
3. Configure existing EAS/Firebase credentials, build with enabled push and accept opt-in/out, delivery/receipts, account changes and foreground/background/cold routing before enabling rollout.
4. Finish real Redis/multi-worker recovery, expiry/housekeeping and operational health/error reporting. Those Backend changes are outside this native UI slice.
<!-- lang:end -->

<!-- lang:th -->
## ภาษาไทย

ต่อยอด branch Phase 5 จาก `a790711` เพิ่ม Collections ในรายการของฉันและ Feed ในคอมมูนิตี้ ใช้ API เดิมทั้งหมด Collections สร้าง/แก้ไข/ลบ ค้นหาและเพิ่ม/นำเรื่องออก ตั้งส่วนตัว/สาธารณะ แชร์ผ่าน native share sheet และเปิดด้วย `mangadock://collections/<uuid>` ได้ ลิงก์นี้ต้องมีแอปติดตั้ง ไม่ใช่ HTTPS link ที่พาไปติดตั้งหรือเปิดเว็บแทน Guest อ่านได้เฉพาะสาธารณะ ปุ่มแก้ไขแสดงเฉพาะเจ้าของ และยืนยันก่อนลบ

Feed มี Following/สำหรับคุณ โหลดเพิ่ม refresh และ retry ใช้ post component เดิมพร้อมปิดสปอยล์ กลับจากโพสต์แล้วยังคงโหมดและหน้าที่โหลดไว้ ล็อกอินแล้วกลับหน้าปลายทางเดิม ล้างข้อมูลส่วนตัวและยกเลิกผลเก่าเมื่อบัญชีเปลี่ยน กำหนด deadline รวม body ของคำตอบ บล็อกการกดบันทึกซ้ำและรอ server ยืนยัน ไม่ retry งานเขียนเอง ไม่เพิ่ม dependency หรือ WebView

Baseline 254 tests รอบใหม่ **268/268** และ TypeScript ผ่าน Integration ของ Native session/controller ผ่าน HTTP, Nest และ SQL จริงใน PGlite แยกผ่านทั้ง CRUD/ค้นหา/สิทธิ์/public/เปลี่ยนกลับส่วนตัว/Feed/logout แต่ Auth/catalog/provider เป็น QA ไม่ใช่บัญชีหรือฐานข้อมูลใช้งานจริง ไม่ลง migrations ไม่ deploy และไม่ส่ง Push

Build Android source สุดท้ายแบบ ARM64+x86_64 กับ vital lint ผ่าน 320 tasks ภายใน 18 วินาที Bundle836 modules/assets11 ตรวจลายเซ็น v2 และ ABI ผ่าน APKภายในสำหรับ QA อยู่ตามลิงก์และ SHA256 ด้านบน ยังไม่ได้ติดตั้งทับโทรศัพท์จริงในรอบนี้ ไม่ใช่ Store release ที่ตรวจรับแล้ว

คำสั่งเปิด Metro ด้วยค่า QA ถูก automatic approval review ปฏิเสธด้วย `blocked by policy` โดยไม่มีเหตุผลเพิ่มเติม จึงไม่เปลี่ยนวิธีเพื่อรันคำสั่งเดิม และยังไม่รับรอง visual/device ของหน้าจอใหม่ ตรวจ config ในเครื่องยังไม่มี EAS project/Firebase จึงคง rollout ปิด งานต่อคือเชื่อม schema และบริการจริง ตรวจ UI/keyboard/scroll/share/deep link เครื่องจริง ตั้งค่ารับ Push และรับผล Redis/housekeeping/health ตามรายการด้านบน
<!-- lang:end -->
