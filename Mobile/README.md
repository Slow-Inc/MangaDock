# MangaDock Mobile

2026-10-20: **ARM64 test APK is available**, with embedded Hermes bundle and a Wi-Fi LAN Backend endpoint. Fresh Mobile 220/220, types/env, native assemble/vital lint, signature and downloaded-file hash checks pass. Actual phone installation remains unverified. [Download, installation steps and artifact identity](docs/2026-10-20-test-apk.md).

ภาษาไทย: 2026-10-20 มี **APK ทดสอบ ARM64** แล้ว ฝัง Hermes และใช้ Backend ใน Wi-Fi LAN ตรวจ Mobile 220/220 types/env native build/vital lint ลายเซ็นและ hash ดาวน์โหลดผ่าน ยังไม่ตรวจติดตั้งบนมือถือ ดูลิงก์ดาวน์โหลด/วิธีติดตั้ง/รายละเอียดไฟล์ด้านบน

2026-10-16 execution follow-up: Supabase is restored to **ACTIVE_HEALTHY** and local Backend/Metro are running. Fixed empty-page Reader results with TDD; Mobile **220/220**, typecheck/env and fresh Android export pass. Auth redirect diagnostics and live Reader API checks pass with a simulated browser. MIT, real-device/login/visual/payment and signed-release gates remain open. [Latest execution results and blockers](docs/2026-10-16-native-acceptance-progress.md).

ภาษาไทย: ลงมือรอบล่าสุด กู้ Supabase เป็น **ACTIVE_HEALTHY** เปิด Backend/Metro แก้ Reader ตอนว่างด้วย TDD ผ่าน **220/220** typecheck/env/export ตรวจ redirect และ Reader API จริงโดยจำลอง browser ยังค้าง MIT และการรับ login/ภาพ/payment/เครื่องจริง/signed release ดูรายงานล่าสุดด้านบน

2026-10-16 audit: current Mobile tests **218/218**, typecheck, env validation and Android Hermes export pass; CAPTCHA hosting remains available. Configured Supabase is currently **INACTIVE**, and local Backend/Metro/MIT ports were not running at audit time. Device/visual/live-service and signed replacement release acceptance remain open. [Current done/remaining inventory and evidence](docs/2026-10-16-native-status-audit.md).

ตรวจวันที่ 2026-10-16: Mobile tests **218/218** typecheck env และ export Hermes Android ผ่าน CAPTCHA hosting ยังเข้าถึงได้ แต่ Supabase ที่ตั้งไว้เป็น **INACTIVE** และพอร์ต Backend/Metro/MIT local ไม่รันขณะตรวจ ยังต้องรับอุปกรณ์/ภาพ/บริการจริงและ signed release ดูรายการทำแล้ว/ค้างและหลักฐานในรายงานด้านบน

Native Android client using Expo 56 and React Native. Phase 1 replaces the hybrid shell with native screens and calls the existing Backend, Supabase Auth and server-side MIT. No embedded WebView is used. `shared/mobileBridge.ts` remains intact for existing Frontend imports.

2026-10-04: local source now includes Phase 2 account/library/social/Community and Phase 3 Studio/existing staff workflows. Full release acceptance remains open. [Current feature mapping, verification, baseline limits and run prerequisites](docs/2026-10-04-native-full-implementation.md). The completion ledger records the final review and regressions; source tests/build are not live or visual acceptance.

2026-10-04: source ในเครื่องมี Phase 2 บัญชี/library/social/Community และ Phase 3 Studio/ทีมงานที่ระบบเดิมรองรับแล้ว ยังเปิด acceptance release ครบ ดู [mapping ฟีเจอร์ หลักฐาน ข้อจำกัดเดิมและ prerequisites สำหรับรัน](docs/2026-10-04-native-full-implementation.md) บันทึก review สุดท้ายและ regressions ใน completion ledger การผ่าน source tests/build ไม่ใช่ live/visual acceptance

Phase 1 is **in progress**, not an accepted APK beta. Automated tests cover Mobile controllers with the real Supabase SDK and controlled external fetch/browser/storage boundaries. Tests and exports do not prove device interaction or live services.

Tests are verified with Node 26.1.0. Native flow regressions additionally render the real React components/controllers using a Node module loader that substitutes only OS boundaries; `react-test-renderer` is a development dependency and emits its deprecation warning. This coverage catches native navigation wiring and models the installed RN binary-Blob constraint, but does not replace emulator/physical interaction checks.

ตรวจ tests ด้วย Node 26.1.0 เพิ่ม regressions native flows โดย render components/controllers React จริง ผ่าน Node module loader ที่จำลองเฉพาะขอบ OS `react-test-renderer` เป็น dev dependency และมี deprecation warning Coverage นี้ตรวจ navigation wiring และจำลองข้อจำกัด binary Blob ของ RN ที่ติดตั้ง ไม่แทนการตรวจ interaction emulator/เครื่องจริง

## Local implementation

Visual reference is the existing responsive **mobile** Frontend, with root `DESIGN.md` tokens. Native views port its logo, palette, portrait grids, hierarchy, provider order, amber topup presets, compact Reader controls and six bottom-navigation destinations. [Screen mapping, Android captures and remaining visual acceptance](docs/2026-10-02-native-responsive-design-parity.md). Later-phase source is locally present; visual acceptance remains open.

ต้นแบบภาพคือ Frontend responsive **mobile** เดิมและ tokens จาก `DESIGN.md` Views native ใช้โลโก้ สี grids ปก ลำดับเนื้อหา/providers ตัวเลือกเติมเงิน amber controls Reader กระชับและ bottom navigation หกปลายทาง ดู [mapping ภาพ Android และส่วนที่ยังต้องตรวจ](docs/2026-10-02-native-responsive-design-parity.md) source phase ภายหลังมีในเครื่องแล้ว ยังเปิด visual acceptance

- Email/password, session restore, Google/Facebook browser PKCE, verified TOTP gate, account isolation and logout.
- Search/details, MangaDex Chapters and published available Studio versions.
- Browser Turnstile with fixed callback, per-request state and five-minute expiry.
- Native image Reader: long strip, single/double page, reading direction, page/chapter navigation, pinch/button/double-tap zoom, HD/data saver, virtualized images, next-two-page prefetch and retry.
- Single-Page and full Chapter Batch Translation with normalized Patch overlays, original comparison, deployment model choices and incremental progress. Canonical page order and original Backend-local paths are retained. Partial failures cannot report full success.
- Translation stops on background or Reader exit and requires manual restart. Chapter, image derivative, target and model changes clear the previous overlay context.
- Server entitlement checks and atomic paid Studio unlock; repeated taps share one purchase, and insufficient balance leads to topup.
- Balance and native QR topup. Pending identity and intended reading destination are stored per account and recovered before another create action. Foreground/relaunch checks server status; paid events and cancellation races are reconciled. Only pending payments reconnect.

## Configure

Copy `.env.example` to `Mobile/.env`:

```dotenv
EXPO_PUBLIC_API_BASE_URL=https://your-existing-backend.example
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-key
EXPO_PUBLIC_CAPTCHA_URL=https://your-host.example/native-captcha/index.html
```

Expo public values are bundled into the app. Use only the public anon/publishable Auth key; service-role and Turnstile secret keys remain on the server. No ML endpoint or secret is bundled into Mobile.

An Android emulator can use the existing Backend at `http://10.0.2.2:4001`; a phone needs a reachable LAN address or HTTPS host. Development Android configuration currently permits cleartext traffic; review production connection policy before store release.

Allow these exact URLs in the existing Supabase project's Auth redirects. OAuth uses PKCE code exchange:

```text
mangadock://auth/callback
mangadock://auth/signup
mangadock://auth/recovery
mangadock://auth/link
mangadock://auth/reauth
```

2026-10-05: all five are configured and verified against hosted MangaDock Auth; the ten existing web URLs are preserved. Retry social login in the installed app without rebuilding for this cloud change. Actual provider sign-in/device session acceptance remains open. [Evidence and rollback](docs/2026-10-05-native-auth-redirects.md).

ภาษาไทย: เพิ่มและตรวจ URL มือถือทั้งห้ากับ Supabase จริงแล้ว คง URL เว็บเดิม 10 ค่า ลอง social login ใหม่ได้โดยไม่ต้อง build สำหรับการแก้ cloud config นี้ ยังต้องตรวจ login บัญชีจริงและ session ในแอป

Host all files from `captcha/` on HTTPS and configure its public site key; for a real Turnstile widget, allow that hostname and use its matching secret in Backend. The page returns only to **`mangadock://captcha/callback`**; Backend `/books/verify-captcha` remains authoritative.

2026-10-05 development setup: **https://mangadock-mobile-captcha-dev.pages.dev/** is deployed on the user's selected Cloudflare account. Ignored `Mobile/.env` now has `EXPO_PUBLIC_CAPTCHA_URL` plus the three required Expo API/Auth names; `NEXT_PUBLIC_*` names alone are not read by Mobile. Env validation and the fresh Metro public-value check pass. This page uses the existing Cloudflare always-pass development key pair; real bot protection and browser/device challenge return are separate acceptance. Reload the installed development app to receive the new values. [Deployment, redeploy command, verification and rollback](docs/2026-10-05-reader-captcha-setup.md), [setup guide](docs/reader-captcha-setup.html).

ภาษาไทย: deploy หน้า development ที่ URL ด้านบนบน account ที่ผู้ใช้เลือกแล้ว ตั้ง `EXPO_PUBLIC_CAPTCHA_URL` และชื่อ Expo ของ API/Auth อีกสามค่าใน `Mobile/.env` ที่ถูก ignore ชื่อ `NEXT_PUBLIC_*` อย่างเดียว Mobile ไม่อ่าน env validation และ bundle Metro ใหม่มีค่าครบ ใช้คู่ key ทดสอบ always-pass เดิม ยังแยกการป้องกันบอตจริงและ acceptance challenge/กลับเข้าแอป ให้ reload development app ดูคำสั่ง deploy ซ้ำ ผลตรวจและย้อนกลับในรายงานด้านบน

## Run and verify

From `Mobile/`, with dependencies installed:

```powershell
npm.cmd run validate:env
npm.cmd test
npm.cmd run typecheck
npm.cmd start
```

Offline Android bundle verification:

```powershell
$env:EXPO_OFFLINE = '1'
$env:CI = '1'
npx.cmd --no-install expo export --platform android --output-dir dist/native-phase1
```

`expo/fetch` provides readable native response streams. Tests use Node 26's TypeScript support; Python and a live Backend are not required.

After connecting real services and an Android device, build/install with `npm.cmd run android`, or use the existing EAS internal `preview` APK profile after configuring the EAS project/signing. An export is a JavaScript/Hermes bundle, **not a signed or installed APK**.

### Android SDK location on Windows

If Gradle reports `SDK location not found`, confirm Android Studio's SDK location. For this workstation it is `C:/Users/Cable/AppData/Local/Android/Sdk`. In the generated `android/local.properties`, set:

```properties
sdk.dir=C:/Users/Cable/AppData/Local/Android/Sdk
```

This machine-specific file is ignored by Git. Recreate it after a clean prebuild removes `android/`. For Expo/ADB discovery in the current PowerShell terminal, use `$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"`, then run `npm.cmd run android`. Use your actual SDK directory on another machine. [Android build configuration](https://developer.android.com/build#properties-files).

ภาษาไทย: หาก Gradle แจ้ง `SDK location not found` ให้ตรวจตำแหน่ง SDK ใน Android Studio เครื่องนี้ใช้ `C:/Users/Cable/AppData/Local/Android/Sdk` และเพิ่ม `sdk.dir` ตามด้านบนใน `android/local.properties` ซึ่งเป็นค่าเฉพาะเครื่องและไม่เก็บใน Git ถ้า clean prebuild ลบ `android/` ให้สร้างไฟล์นี้ใหม่ สำหรับ Expo/ADB ใน PowerShell ปัจจุบันให้ตั้ง `$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"` แล้วรัน `npm.cmd run android` เครื่องอื่นต้องใช้ path SDK จริงของเครื่องนั้น ดู [เอกสาร Android](https://developer.android.com/build#properties-files)

### Android Gradle/Kotlin compatibility

Use **Gradle 9.3.1**, matching both the installed Expo 56 template and React Native 0.85.3 Gradle plugin wrapper. In `android/gradle/wrapper/gradle-wrapper.properties`, keep:

```properties
distributionUrl=https\://services.gradle.org/distributions/gradle-9.3.1-bin.zip
```

Gradle 9.4.1 embeds Kotlin 2.3.0, which the installed plugin's Kotlin 2.1.20 compiler cannot read; this fails the settings plugins before app compilation. Gradle 9.3.1 embeds Kotlin 2.2.21. See the [Gradle compatibility matrix](https://docs.gradle.org/current/userguide/compatibility.html#kotlin). Use the project's wrapper rather than upgrading Gradle independently. `android/` is generated and ignored by Git; a fresh Expo prebuild uses the template's 9.3.1 default.

ภาษาไทย: ใช้ **Gradle 9.3.1** ให้ตรงกับ template Expo 56 และ wrapper ของ React Native 0.85.3 ที่ติดตั้ง หาก `android/gradle/wrapper/gradle-wrapper.properties` เป็น 9.4.1 ให้คืนเป็นค่าด้านบน เพราะ Kotlin 2.3.0 ที่มากับ Gradle 9.4.1 ใหม่เกินกว่าที่ compiler Kotlin 2.1.20 ของ plugin จะอ่านได้ ส่วน 9.3.1 ใช้ Kotlin 2.2.21 ใช้ wrapper ของโปรเจคและอัปเกรด toolchain ตาม SDK; `android/` เป็นไฟล์ที่สร้างอัตโนมัติและไม่เก็บใน Git โดย Expo prebuild ใหม่ใช้ค่าเริ่มต้น 9.3.1 จาก template

## Acceptance still required

- Reachable Backend/Supabase, hosted captcha, real OAuth redirect/cancellation and enrolled TOTP.
- Signed internal APK, version metadata and physical Android installation.
- Both content sources, paid access, modes, zoom/image geometry and bounded memory on long chapters.
- Live MIT translation, model choices, overlays, batch disconnect/background/Reader exit and manual restart.
- Controlled payment environment: QR scan, banking-app return, kill/relaunch, expiry/cancel/payment races and account balances/access.

Phase 1 login/offline-search renders were inspected on the emulator on 2026-10-02. The SDK discovery fix passed debug assembly on 2026-10-03. New Phase 2 screens, live payments and complete device acceptance remain unverified; see the execution ledgers for evidence and gates.

ภาษาไทย: ตรวจภาพ Login/ค้นหาแบบ offline ของ Phase 1 บน emulator วันที่ 2026-10-02 แล้ว และแก้ SDK discovery จน debug assembly ผ่านวันที่ 2026-10-03 แต่ยังไม่ยืนยันภาพหน้าจอ Phase 2 ใหม่ การชำระเงินจริงหรือ acceptance บนอุปกรณ์ครบ ดูหลักฐานและเกณฑ์ใน execution ledgers

Payment recovery requires a received, saved payment ID. The existing status-by-ID API cannot resolve a lost creation acknowledgement or a process death before saving that ID. A local save failure keeps the known QR in memory and prevents another create, but closing the app before resolving it can lose recovery information.

## Plans

- [Approved bilingual PRD](docs/2026-10-02-native-mobile-migration-prd.md)
- [Approved bilingual slices](docs/2026-10-02-native-mobile-migration-issues.md)
- [Phase 1 ledger](docs/2026-10-02-native-phase1-implementation.md)
- [Phase 2 ledger](docs/2026-10-03-native-phase2-implementation.md)
- [Published PRD #724](https://github.com/Slow-Inc/MangaDock/issues/724)

Phase 2 ports personal/account/community features; Phase 3 ports Studio/staff workflows. iOS, Play release, new offline/push features and on-device MIT are outside scope. This native feature batch changes Mobile source only; Frontend, Backend, MIT, schemas and root CI are preserved. The earlier, separately requested Backend profile-join compilation fix is recorded in DONE.md.

GitHub publication completed on 2026-10-03 through the GitHub CLI: PRD #724 and 29 slices #725–#753. `scripts/publish-native-migration.mjs` checks exact existing titles and saves resumable receipts in `docs/native-migration-publish/published.json`. From Mobile, `node scripts/publish-native-migration.mjs` prepares bilingual bodies; `--publish` creates missing issues. Existing parents are preserved. The PowerShell version remains unused because local script policy blocks it.

ภาษาไทย: เผยแพร่ผ่าน GitHub CLI วันที่ 2026-10-03 แล้วเป็น PRD #724 และ slices 29 งาน #725–#753 โดย `scripts/publish-native-migration.mjs` ตรวจชื่อเดิมตรงตัวและบันทึกผลให้ทำต่อได้ใน `docs/native-migration-publish/published.json` รัน `node scripts/publish-native-migration.mjs` จาก Mobile เพื่อเตรียม bodies สองภาษา; `--publish` สร้างเฉพาะ issues ที่ขาด คง parents เดิม ส่วนเวอร์ชัน PowerShell ยังไม่ได้ใช้เพราะนโยบาย scripts ของเครื่องบล็อก

Phase 2 currently adds Home, the original six mobile navigation destinations, release/tag/genre discovery, related manga, library reads with Chapter/Page history save/resume, and read-only Community feed/post views. This is not full Phase 2 parity. The new Android source bundle exports with 709 modules and 10 assets; it does not establish runtime or visual acceptance.

ภาษาไทย: Phase 2 รอบนี้เพิ่ม Home, navigation mobile หกปลายทางเดิม, discovery ตาม releases/tags/genres, มังงะที่เกี่ยวข้อง, การอ่านรายการส่วนตัวพร้อมบันทึก/กู้ Chapter/Page และเปิดดู feed/post ของ Community ยังไม่ใช่ parity Phase 2 ครบ Android source bundle ใหม่ export ได้ 709 modules และ 10 assets แต่ไม่ยืนยัน runtime หรือ acceptance ภาพ

The earlier missing-public-env checkpoint is historical: the required Mobile public values were subsequently configured, private Backend configuration was placed in ignored Backend `.env`, and the existing Backend started. Keep server secrets out of public variables. Run `npm.cmd run validate:env` and `npm.cmd run android` against a reachable Backend after local environment changes. Native Auth redirects were accepted on 2026-10-05; actual provider/device acceptance remains open. Historical diagnostics and the earlier Metro approval rejection are recorded in the completion ledger.

ภาษาไทย: checkpoint ที่ public env ขาดเป็นประวัติรอบก่อน ต่อมาตั้งค่า Mobile แล้ว สร้าง `.env` ส่วนตัวของ Backend ที่ถูก ignore จาก config server เดิมและเปิด Backend สำเร็จ เก็บ secrets นอก public variables หลังแก้ env ให้รัน `npm.cmd run validate:env` และ `npm.cmd run android` กับ Backend ที่เข้าถึงได้ Supabase ยอมรับ native Auth redirects แล้ววันที่ 2026-10-05 ยังต้องตรวจ provider/อุปกรณ์จริง ประวัติการวินิจฉัยและ Metro ที่ถูกปฏิเสธก่อนหน้านี้อยู่ใน completion ledger

## QR provenance

The offline renderer uses the unmodified Kazuhiko Arase MIT QR core from locally installed npm `qrcode-terminal`; its Apache-licensed terminal wrapper is excluded. [Provenance, hashes and license](vendor/qrcode/PROVENANCE.md) are retained. Rectangle output is tested against independently generated UTF-8 reference matrices. Real scanner acceptance remains open.
