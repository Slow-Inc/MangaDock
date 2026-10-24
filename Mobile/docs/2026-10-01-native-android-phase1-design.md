# Native Android Phase 1 — historical design draft

Status: Superseded for planning on 2026-10-02 by [Native Android migration PRD](2026-10-02-native-mobile-migration-prd.md) and [proposed issues](2026-10-02-native-mobile-migration-issues.md). Product implementation has not started.

This historical draft predates the confirmed scope: full existing-product parity, both MangaDex and published Studio content, both Single-Page Translation and Batch Translation, paid unlock/topup in Phase 1, and an internally distributed native APK beta. Its single-source/single-page-only restrictions are no longer the current plan.

ร่างนี้เป็นประวัติก่อนยืนยัน scope: ฟีเจอร์ผลิตภัณฑ์เดิมครบ ทั้ง MangaDex และเนื้อหา Studio ที่เผยแพร่ ทั้ง Single-Page Translation และ Batch Translation ปลดล็อก/เติมเงินใน Phase 1 และ APK beta native สำหรับแจกภายใน ข้อจำกัดแหล่งเดียว/แปลหน้าเดียวในร่างนี้ไม่ใช่แผนปัจจุบันแล้ว
Date: 2026-10-01; revised 2026-10-02.

## 1. Agreed brief

Use the existing Expo + React Native project to replace the Android WebView application UI with native screens. The first release prioritizes the reading experience: login → search → manga details and chapter selection → Reader → image translation. Reuse the existing NestJS Backend, Supabase Auth, and MIT. All edits, tests, configuration, and project notes for this work stay under `Mobile/`.

Success means a usable reading flow on a physical Android device, correct translated Patch placement, and measured reading behavior against the current WebView app. Native rendering alone is not evidence of a performance improvement.

## 2. Recommended approach and boundaries

Build native screens in the existing Expo project, with a Mobile-owned API/auth adapter and native navigation. The application contains no embedded WebView, including for captcha. OAuth and Turnstile run in the device's system-browser auth session and return to the native app through separate deep-link callbacks. The browser does not display the manga application UI.

Remove the Mobile runtime dependency on `react-native-webview` when replacing the shell; do not add an embedded-browser fallback for any Phase 1 screen. Keeping `Mobile/shared/mobileBridge.ts` for compatibility with the existing web application does not require running its bridge in the native app.

Alternatives considered: a mixed native/WebView application leaves the core reading flow dependent on the web application; a separate Kotlin application discards the Expo foundation and adds another language/toolchain. Both conflict with the chosen React Native direction or the Reader-first goal.

- Do not edit `Frontend/`, `Backend/`, `MIT/`, root dependency files, database schema, or external service settings.
- Preserve `Mobile/shared/mobileBridge.ts` unchanged: Frontend imports this file, so changing/deleting it can break the web application despite a Mobile-only diff.
- Mobile may read the other services' source to verify contracts, but owns its own components and runtime adapters. Do not import Next.js UI/hooks or browser-dependent helpers.
- Existing public API/auth configuration is reused. Missing deployment configuration is reported as a prerequisite, not silently changed.

## 3. Phase 1 product scope

| Area | Behavior |
|---|---|
| Login | Native email/password login, existing Google/Facebook OAuth, session restoration, logout, and completion of an already-enrolled TOTP challenge when required. New-account setup, recovery, account linking, and MFA enrollment/settings remain later work. |
| Search | Native text search, pagination, cover/title display, loading/empty/error states, and stale-request cancellation. A new search must not show a late result from an earlier query. |
| Details | Title, cover, description, authors, and chapter list with source-language selection. An empty/unavailable chapter list is visible, not a spinner forever. |
| Reader | Continuous vertical reading with virtualized pages, current-page indicator, jump to page, next/previous chapter, pinch zoom, double-tap reset, and Android back behavior. Images and Patches share the same transform. |
| Translation | Translate the current page, choose a supported target language, show elapsed waiting time, toggle Patches, retry a failed request, and recover from an expired captcha. Use the Backend's default model initially. No fabricated live stage/ETA when the single-page API does not provide it. |

Phase 1 starts with MangaDex-backed Chapters from the existing catalog routes. Creator-uploaded versions, paid unlock flows, bookmarks, and reading-history synchronization are separate follow-up work; do not present those as implemented in this release.

Full-chapter batch translation/SSE is also deferred. Single-page translation proves the end-to-end native rendering contract before adding a long-lived stream and background-job lifecycle.

## 4. Existing API contracts

Mobile calls an explicit absolute Backend origin, configured as `EXPO_PUBLIC_API_BASE_URL`. It does not depend on Next.js `/api/proxy` for application requests.

| Request | Purpose / shape |
|---|---|
| `GET /books/search?q=…&limit=…&offset=…` | `{ items: LandingBook[], total: number }` |
| `GET /books/manga/:id` | `MangaDetail` with covers, authors, genres, and optional title/description |
| `GET /books/manga/:id/chapters` | `MangaChapter[]`, including chapter number and translated/source language |
| `POST /books/verify-captcha` | `{ token }` → `{ clearanceToken }`; requires `x-hardware-id` |
| `GET /books/chapters/:chapterId/pages?mangaId=…` | Original/data-saver page arrays and optional local cache paths; requires device/captcha headers |
| `GET /books/img-proxy?url=…` | Existing Backend image proxy for external page/cover bytes |
| `GET /books/translate/mit-health` | `{ available: boolean }`; include the required device header |
| `POST /books/chapters/:chapterId/pages/:pageIndex/translate-patches` | `{ pageUrl, sourceLang, targetLang, derivative, mangaId }` → `{ patches: [{ xPct, yPct, wPct, hPct, url }] }` |
| `POST /users/me`, `GET /users/me`, `POST /users/me/record-device` | Existing authenticated profile/device initialization using Bearer token |

The API client attaches access tokens and device/captcha credentials only to the configured Backend origin. Cloudflare scripts, external cover/CDN URLs, and arbitrary links must never receive these headers.

Display and translation must use the same source derivative: keep the raw server-side `pageUrl` separately from the native display/proxy URL. Normalize relative `/uploads`, `/patches`, and `/img-cache` paths against the configured Backend; do not send native display proxy URLs to MIT as the translation source.

Cached images may require `ImageTokenGuard` credentials. Inspection found the guard, but no image-token issuance contract in the inspected catalog/controller paths. Do not invent a signing API, embed `IMAGE_TOKEN_SECRET`, or disable the guard. Verify asset access first; if a required protected path cannot be authorized with existing responses, report that deployment limitation before claiming the affected flow works. The existing original-image proxy path is a candidate for Phase 1, not proof that every cached-asset configuration works.

## 5. Auth and captcha

Extract native Supabase session/OAuth handling from `Mobile/App.tsx`. Reuse the configured project and public anon key and the existing `mangadock://auth/callback` redirect. Native session persistence and foreground/background refresh follow the Supabase SDK lifecycle; authenticated requests use the current token. Logout/user changes discard user-scoped state and late responses. No Supabase service-role key or signing secret enters the APK.

Keep the existing stable native device ID. Store the minimal challenge page source in `Mobile/web/turnstile.html` and host it as a standalone static HTTPS page on a hostname allowed by the existing Turnstile site key. Configure its absolute URL as `EXPO_PUBLIC_CAPTCHA_URL`. This is an external hosting prerequisite; adding a source file does not deploy it.

Native opens that page through the system-browser auth session with a cryptographically random, single-use `state`. The page renders Turnstile and returns to the fixed callback `mangadock://captcha/callback` with the challenge token and echoed state. The callback is fixed in the page; callers cannot supply an arbitrary redirect destination. Native accepts only the expected scheme/host/path, a non-empty token, and the state of the currently pending request. Reject unsolicited, stale, mismatched, duplicate, and malformed callbacks; browser cancellation returns to the previous native screen without changing verification state. OAuth continues using `mangadock://auth/callback`, with its own SDK flow. Do not confuse the two callback purposes.

The hosted captcha page never receives access/refresh tokens, device IDs, clearance credentials, or signing secrets. It does not call the Backend or write user state. Native alone posts the returned Turnstile token to the Backend using the original device ID. Treat the callback token as a short-lived single-use credential: do not log callback URLs, and clear pending callback state on completion, cancellation, and timeout. The callback state correlates a request; server-side Turnstile verification remains the actual validity check.

Native posts the challenge token to the existing `/books/verify-captcha` endpoint and stores the returned device-bound clearance. On a captcha-protected API 401, clear it and prompt for verification; retain the Chapter/page position. Do not retry expensive translation automatically in a loop. Auth 401s follow session-refresh/login handling, not captcha handling. If Supabase Auth itself requires a captcha, obtain a fresh token for that submission; a single-use token cannot be reused for both verifications.

The hosted challenge page, allowed hostname/site key, and Android browser-to-app callback must be proved on a physical device before this seam is called production-ready. Use an existing allowed hostname when available; do not silently change the Turnstile hostname allowlist or deploy hosting. If there is no suitable host, record the required deployment/configuration decision and continue the independent native screens and tests. Do not add a Frontend route, disable captcha, or introduce an embedded WebView to bypass this prerequisite.

Additional Mobile public configuration: `EXPO_PUBLIC_API_BASE_URL` for the Backend and `EXPO_PUBLIC_CAPTCHA_URL` for the hosted challenge. Keep existing Supabase public URL/key values. The hosted HTML is provisioned with the public Turnstile site key; the native bundle must not include the Turnstile secret. `EXPO_PUBLIC_WEB_URL` is no longer required for the native application UI. Supabase's existing OAuth redirect registration is reused; captcha returns directly from the hosted page and does not require a new Supabase redirect registration.

## 6. Reader architecture and errors

Use a virtualized native page list. Mount/decode a bounded window of pages, prefetch only adjacent pages, and reuse known aspect ratios to avoid scroll jumps. Pinch/zoom applies to a common image-and-Patch container. Patch bounds are computed from the displayed image dimensions and normalized coordinates, including any letterboxing offset.

Keep state keyed by Chapter, page, source/target language, and derivative. Cancel obsolete client requests on Chapter changes; reject late completions from previous navigation or translation settings. Client cancellation of a single-page request does not guarantee the Backend/MIT computation stopped; show no claim that server work was cancelled.

Network errors keep already-loaded content readable and offer a retry. Failed image loads show a page-specific retry. MIT unavailability leaves original pages readable. Repeated translate taps create at most one in-flight request per page/settings combination. Changing target language/derivative never displays Patches from the previous selection.

Proposed units under `Mobile/src/`: `api/` for contracts/requests, `auth/` for session and device state, `navigation/`, `screens/`, `reader/` for page geometry/gestures, and `captcha/` for the system-browser handoff/callback adapter. Keep platform-free URL, request-state, and Patch-geometry logic testable without loading the React Native runtime. `Mobile/web/` contains only the static captcha page, not manga application screens.

## 7. Verification and acceptance

1. Contract/unit tests: encoded search queries; API-origin/header isolation; relative asset URLs; malformed responses; stale navigation responses; captcha expiry/device binding; correct and rejected deep-link scheme/host/path/state; missing token, duplicate/late callbacks and browser cancellation; Patch geometry with multiple aspect ratios; language/derivative isolation.
2. Mobile typecheck and test suite; Android development APK/build verification where the environment permits. Do not modify global CI to support this phase.
3. Physical Android walkthrough: login/cancel/logout/relaunch, search/details/chapter open, scroll/zoom/jump/back, actual captcha, actual single-page translation, toggling Patches, network loss, expired clearance, and Chapter switch during translation.
4. Compare the same Chapter/device/display derivative with the current WebView build. Record first visible page latency, scrolling frame behavior, peak memory, and sustained reading without crash. Save results and screenshots under `Mobile/docs/`; only report improvements supported by measurements.
5. Check the final file diff: every task-related edit is under `Mobile/`, the shared bridge contract is unchanged, and no embedded WebView/component/dependency remains in the Mobile application. Document an unavailable emulator/device/service/build tool or undeployed captcha host as unverified coverage rather than a passing check.

## 8. Follow-up phases

- Phase 2: creator-uploaded Chapters, My List/history, full-chapter streaming translation, and Community.
- Phase 3: Wallet/unlock and account Settings, followed by Studio creator workflows.
- Phase 4: offline downloads and native Android background/notification/overlay capabilities, each with its own storage, lifecycle, and permission design.
- iOS follows after the Android reading flow is validated; this phase makes no iOS release claim.

## 9. Evidence and review decision

Repository evidence: `Mobile/App.tsx`, `Mobile/shared/mobileBridge.ts`, `Backend/src/auth/auth.guard.ts`, `Backend/src/auth/turnstile.guard.ts`, `Backend/src/books/books.controller.ts`, `Backend/src/books/books.types.ts`, `Backend/src/books/image-token.guard.ts`, `Backend/src/common/storage/img-cache.controller.ts`, `Frontend/app/lib/mangaTranslatePage.ts`, and `Frontend/app/hooks/useReaderCaptcha.ts`.

Primary references: [Cloudflare Turnstile mobile implementation](https://developers.cloudflare.com/turnstile/get-started/mobile-implementation/), [Supabase React Native Auth](https://supabase.com/docs/guides/auth/quickstarts/react-native), and [Supabase native deep linking](https://supabase.com/docs/guides/auth/native-mobile-deep-linking).

The user selected a native application with no embedded WebView and system-browser OAuth/captcha on 2026-10-02. This written revision records that choice, the required hosted captcha page, callback validation, and the MangaDex/single-page translation starting scope. After review of the written design, write a Mobile-local implementation plan. This document is not evidence that the native application has been implemented or tested.

---

# แบบภาษาไทย — Native Android Phase 1

สถานะ: ผู้ใช้เลือก system-browser approach วันที่ 2026-10-02 แบบปรับปรุงนี้รอ review ยังไม่ได้เริ่มเขียนโค้ดแอป

## 1. เป้าหมายที่ตกลง

ใช้ Expo + React Native เดิมเปลี่ยน UI ของแอป Android จาก WebView เป็นหน้าจอ native โดยรุ่นแรกเน้น Login → ค้นหา → รายละเอียด/เลือก Chapter → Reader → แปลภาพ ใช้ Backend, Supabase Auth และ MIT เดิม การแก้ไฟล์ ทดสอบ ตั้งค่า และบันทึกงานครั้งนี้อยู่ใน `Mobile/` ทั้งหมด

เกณฑ์สำเร็จคืออ่านได้จริงบน Android วาง Patch แปลตรงกับภาพ และวัดพฤติกรรมการอ่านเทียบกับ WebView เดิม การเป็น native อย่างเดียวไม่ใช่หลักฐานว่าเร็วขึ้น

## 2. แนวทางและขอบเขต

สร้างหน้าจอและ navigation native ใน Expo เดิม แยก API/auth adapter ที่ Mobile ดูแลเอง แอปไม่มี embedded WebView แม้แต่สำหรับ captcha ทั้ง OAuth และ Turnstile เปิดผ่าน auth session ของ browser เครื่องแล้วกลับเข้า native app ด้วย deep-link callback แยกกัน Browser ไม่แสดง UI แอปมังงะ

ถอด dependency `react-native-webview` ของ Mobile เมื่อเปลี่ยน shell ไม่เพิ่ม embedded browser เป็น fallback ของหน้าจอ Phase 1 การเก็บ `Mobile/shared/mobileBridge.ts` เพื่อรักษา compatibility ของเว็บไม่จำเป็นต้องเปิด bridge นี้ใน native app

แนวทางที่ไม่เลือก: การผสมหน้า native กับเว็บยังทำให้ flow อ่านพึ่งเว็บ และแอป Kotlin ใหม่ทิ้งพื้นฐาน Expo/เพิ่มภาษาและเครื่องมือ จึงไม่ตรงแนวทาง React Native และ Reader-first ที่เลือกไว้

- ไม่แก้ `Frontend/`, `Backend/`, `MIT/`, dependency ที่ root, schema ฐานข้อมูล หรือการตั้งค่าบริการภายนอก
- ไม่แก้หรือลบ `Mobile/shared/mobileBridge.ts` เพราะ Frontend import ไฟล์นี้ การแก้เฉพาะ Mobile ก็อาจทำเว็บพังได้
- อ่านโค้ดบริการอื่นเพื่อยืนยัน contract ได้ แต่ใช้ component/adapter ของ Mobile เอง ไม่ import UI/hook ของ Next.js หรือ helper ที่ผูกกับ browser
- ใช้ API/auth configuration เดิม หากตั้งค่าบริการไม่ครบให้รายงานเงื่อนไขที่ต้องมี ไม่เปลี่ยนให้เงียบ ๆ

## 3. ฟีเจอร์ Phase 1

| ส่วน | พฤติกรรม |
|---|---|
| Login | Email/password, Google/Facebook OAuth เดิม, คืน session, logout และยืนยัน TOTP ที่ผู้ใช้เปิดไว้แล้วเมื่อจำเป็น การสมัคร กู้บัญชี ผูกบัญชี และเปิด/ตั้งค่า MFA เป็นงานถัดไป |
| ค้นหา | ข้อความค้นหา pagination ปก/ชื่อ สถานะโหลด/ว่าง/error และยกเลิกผลค้นหาเก่าที่กลับมาช้า |
| รายละเอียด | ชื่อ ปก เรื่องย่อ ผู้แต่ง Chapter และเลือกภาษาต้นฉบับ แสดงชัดเมื่อไม่มี Chapter หรือบริการไม่พร้อม |
| Reader | เลื่อนแนวตั้งด้วย virtualized list, เลขหน้าปัจจุบัน, ข้ามหน้า, ตอนถัดไป/ก่อนหน้า, pinch zoom, double-tap reset และ Android back ภาพกับ Patch ใช้ transform เดียวกัน |
| แปล | แปลหน้าปัจจุบัน เลือกภาษาเป้าหมายที่รองรับ แสดงเวลารอ เปิด/ปิด Patch ลองใหม่เมื่อ error และยืนยัน captcha ใหม่เมื่อหมดอายุ ใช้โมเดลเริ่มต้นของ Backend ไม่แต่ง stage/ETA ที่ API ไม่ส่งมา |

เริ่มจาก Chapter ของ MangaDex ผ่าน catalog API เดิม ส่วน Chapter ที่ creator อัปโหลด การซื้อปลดล็อค bookmarks และ sync ประวัติอ่านเป็นงานถัดไป ไม่แสดงว่าเสร็จในรุ่นนี้

แปลทั้ง Chapter ผ่าน batch/SSE เป็นงานถัดไปเช่นกัน ใช้แปลทีละหน้าพิสูจน์ contract และการวาง Patch ก่อนเพิ่ม stream ระยะยาว/วงจรงานเบื้องหลัง

## 4. Contract API เดิม

Mobile เรียก Backend origin แบบ absolute จาก `EXPO_PUBLIC_API_BASE_URL` ไม่พึ่ง Next.js `/api/proxy` สำหรับ request ของแอป

| Request | หน้าที่ / รูปแบบ |
|---|---|
| `GET /books/search?q=…&limit=…&offset=…` | `{ items: LandingBook[], total: number }` |
| `GET /books/manga/:id` | `MangaDetail`: ปก ผู้แต่ง genres และชื่อ/เรื่องย่อที่อาจไม่มี |
| `GET /books/manga/:id/chapters` | `MangaChapter[]`: เลข Chapter และภาษา |
| `POST /books/verify-captcha` | `{ token }` → `{ clearanceToken }` พร้อม `x-hardware-id` |
| `GET /books/chapters/:chapterId/pages?mangaId=…` | URLs ต้นฉบับ/data-saver และ cache paths ที่อาจมี ต้องส่ง device/captcha headers |
| `GET /books/img-proxy?url=…` | Proxy ภาพ/ปกภายนอกผ่าน Backend เดิม |
| `GET /books/translate/mit-health` | `{ available: boolean }` พร้อม device header |
| `POST /books/chapters/:chapterId/pages/:pageIndex/translate-patches` | `{ pageUrl, sourceLang, targetLang, derivative, mangaId }` → `{ patches: [{ xPct, yPct, wPct, hPct, url }] }` |
| `POST /users/me`, `GET /users/me`, `POST /users/me/record-device` | เริ่มต้น profile/device ผ่าน Bearer token เดิม |

แนบ access token/device/captcha credentials เฉพาะ Backend origin ที่ตั้งไว้ ไม่ส่งให้ Cloudflare scripts, CDN หรือ link ภายนอก

ภาพที่แสดงกับภาพที่แปลต้องเป็น derivative เดียวกัน เก็บ `pageUrl` ฝั่ง server แยกจาก URL proxy ที่ใช้แสดงใน native แปลง relative `/uploads`, `/patches`, `/img-cache` ด้วย Backend origin และไม่ส่ง native display proxy URL ไปเป็นต้นฉบับแปล

ภาพ cache บาง deployment ต้องมี credential ของ `ImageTokenGuard` พบ guard แต่ยังไม่พบ API ออก image token ใน catalog/controller ที่ตรวจ ห้ามสร้าง signing API สมมติ ใส่ `IMAGE_TOKEN_SECRET` ในแอป หรือปิด guard ต้องพิสูจน์การอ่านภาพก่อน ถ้า API เดิมไม่ออก credential ที่จำเป็นให้รายงานข้อจำกัดก่อนเคลมว่าใช้งานได้ Proxy ภาพต้นฉบับเดิมเป็นแนวทางสำหรับ Phase 1 แต่ไม่ได้พิสูจน์ว่าทุก configuration ของภาพ cache ใช้ได้

## 5. Auth และ captcha

แยก native Supabase session/OAuth จาก `Mobile/App.tsx` ใช้ project/public anon key เดิมและ `mangadock://auth/callback` เดิม การเก็บ session และ refresh ตอน foreground/background ตาม lifecycle ของ SDK ใช้ token ปัจจุบันกับ API เมื่อ logout/เปลี่ยนบัญชีล้าง state ที่ผูกผู้ใช้และทิ้งผล request เก่า ไม่ใส่ service-role key หรือ signing secret ใน APK

ใช้ native device ID เดิมที่เสถียร เก็บซอร์สหน้า challenge ขนาดเล็กใน `Mobile/web/turnstile.html` และ host เป็น static HTTPS page แยกบน hostname ที่ site key ของ Turnstile เดิมอนุญาต กำหนด URL เต็มใน `EXPO_PUBLIC_CAPTCHA_URL` นี่เป็นเงื่อนไขด้าน hosting การสร้างไฟล์ซอร์สไม่ได้ทำให้ deploy แล้ว

Native เปิดหน้านี้ผ่าน auth session ของ browser เครื่องพร้อม `state` สุ่มแบบ cryptographically secure ใช้ครั้งเดียว หน้าเว็บแสดง Turnstile แล้วกลับ callback ที่กำหนดตายตัว `mangadock://captcha/callback` พร้อม challenge token และ state เดิม ผู้เรียกเลือก redirect ปลายทางเองไม่ได้ Native รับเฉพาะ scheme/host/path ที่คาดไว้ token ไม่ว่าง และ state ตรง request ที่กำลังรอ ปฏิเสธ callback ที่ไม่ได้ร้องขอ เก่า state ผิด ซ้ำ หรือผิดรูปแบบ การยกเลิก browser กลับหน้าจอ native เดิมโดยไม่เปลี่ยน verification state ส่วน OAuth ใช้ `mangadock://auth/callback` กับ SDK flow ของตัวเอง ไม่สับสน callback สองประเภท

หน้า captcha ที่ host ไม่รับ access/refresh token, device ID, clearance credential หรือ signing secret ไม่เรียก Backend และไม่เขียน state ผู้ใช้ Native เป็นผู้ส่ง token กลับไป verify กับ Backend ด้วย device ID เดิมเท่านั้น Token ใน callback เป็น credential อายุสั้นใช้ครั้งเดียว ไม่ log callback URL และล้าง pending callback เมื่อเสร็จ ยกเลิก หรือ timeout State ใช้ผูก request ส่วนการ verify Turnstile ฝั่ง server ยังเป็นตัวตรวจความถูกต้องจริง

Native ส่ง challenge token ไป `/books/verify-captcha` แล้วเก็บ clearance ที่ผูก device เมื่อ API ที่ต้อง captcha ตอบ 401 ให้ล้าง clearance/เปิดยืนยันใหม่แต่รักษา Chapter/หน้าเดิม ไม่ retry งานแปลแพงซ้ำเป็น loop ส่วน auth 401 ใช้ refresh/login ไม่ใช้ flow captcha ถ้า Supabase Auth เปิด captcha ด้วยต้องขอ token ใหม่สำหรับ request นั้น ห้ามใช้ token แบบ single-use ซ้ำทั้งสองบริการ

ต้องทดสอบ hosted challenge, hostname/site key และการกลับจาก Android browser เข้าแอปบนเครื่องจริงก่อนเคลม production-ready ใช้ hostname เดิมที่อนุญาตถ้ามี ไม่เปลี่ยน allowlist หรือ deploy hosting โดยเงียบ ๆ ถ้าไม่มี host ที่เหมาะสม ให้บันทึกสิ่งที่ต้องตัดสินใจด้าน deployment/configuration แล้วทำ native screens/tests ที่ไม่พึ่ง host ต่อ ไม่เพิ่ม Frontend route ไม่ปิด captcha และไม่แอบใช้ embedded WebView ข้ามเงื่อนไขนี้

Public configuration ที่ Mobile เพิ่ม: `EXPO_PUBLIC_API_BASE_URL` สำหรับ Backend และ `EXPO_PUBLIC_CAPTCHA_URL` สำหรับ challenge page ใช้ Supabase public URL/key เดิม หน้า HTML ที่ host ตั้ง public Turnstile site key และไม่ใส่ Turnstile secret ใน native bundle `EXPO_PUBLIC_WEB_URL` ไม่จำเป็นสำหรับ UI แอป native อีกแล้ว ใช้ OAuth redirect registration ใน Supabase เดิม ส่วน captcha กลับจากหน้า challenge โดยตรงจึงไม่ต้องเพิ่ม Supabase redirect registration

## 6. Reader และการจัดการ error

ใช้ native virtualized list โหลด/ถอดรหัสภาพใน window ที่จำกัด prefetch เฉพาะหน้าข้างเคียง เก็บ aspect ratio เพื่อไม่ให้ scroll กระโดด Zoom container เดียวกันทั้งภาพ/Patch คำนวณ bounds จากขนาดภาพที่แสดงจริงกับ normalized coordinates รวม offset ถ้ามี letterboxing

ผูก state กับ Chapter, หน้า, ภาษาต้นทาง/เป้าหมาย และ derivative ยกเลิก client request เก่าเมื่อเปลี่ยน Chapter และปฏิเสธผลที่กลับมาหลังเปลี่ยนหน้าหรือ settings การยกเลิก request แปลทีละหน้าไม่ได้รับประกันว่า Backend/MIT หยุด compute จึงไม่บอกผู้ใช้ว่า server หยุดแล้ว

Network error ไม่ปิดภาพที่โหลดแล้วและมี retry ภาพเสียมี retry รายหน้า MIT ไม่พร้อมยังอ่านต้นฉบับได้ กดแปลซ้ำไม่สร้างหลาย request พร้อมกันสำหรับหน้า/settings เดียว เปลี่ยนภาษา/derivative ไม่แสดง Patch ของชุดเดิม

แบ่ง `Mobile/src/` เป็น `api/`, `auth/`, `navigation/`, `screens/`, `reader/`, `captcha/` โดย captcha เป็น adapter เปิด system browser/ตรวจ callback Logic URL/request-state/Patch geometry ไม่ผูก React Native runtime เพื่อทดสอบแยกได้ `Mobile/web/` มีเฉพาะ static captcha page ไม่มีหน้าจอแอปมังงะ

## 7. การทดสอบและเกณฑ์รับงาน

1. Contract/unit tests: query encoding, origin/header isolation, relative asset URLs, response ผิดรูปแบบ, ผล request เก่า, captcha หมดอายุ/ผูก device, deep-link scheme/host/path/state ถูกและผิด, token หาย, callback ซ้ำ/ช้าและการยกเลิก browser, Patch geometry หลาย aspect ratio และ isolation ของภาษา/derivative
2. Mobile typecheck/test suite และตรวจ Android development APK/build ตามเครื่องมือที่มี ไม่แก้ global CI ใน phase นี้
3. ทดสอบ Android จริง: login/cancel/logout/relaunch, search/details/chapter, scroll/zoom/jump/back, captcha จริง, แปลภาพจริง, toggle Patch, network หลุด, clearance หมดอายุ และเปลี่ยน Chapter ระหว่างแปล
4. เทียบ Chapter/device/derivative เดียวกับ WebView เดิม วัดเวลาแสดงหน้าแรก พฤติกรรม frame ตอนเลื่อน peak memory และอ่านต่อเนื่องไม่ crash เก็บผล/ภาพใน `Mobile/docs/` เคลมดีขึ้นเฉพาะสิ่งที่วัดได้
5. ตรวจ diff ว่าแก้เฉพาะ `Mobile/` shared bridge contract ไม่เปลี่ยน และแอป Mobile ไม่เหลือ embedded WebView/component/dependency หากไม่มี emulator/device/service/build tool หรือยังไม่ deploy captcha host ให้ระบุว่า coverage ส่วนนั้นยังไม่ verified

## 8. Phase ถัดไป

- Phase 2: Chapter ที่ creator อัปโหลด My List/history แปลทั้งตอนแบบ stream และ Community
- Phase 3: Wallet/unlock, Settings แล้วจึง Studio สำหรับ creator
- Phase 4: ดาวน์โหลดอ่าน offline และงาน native Android ด้าน background/notification/overlay โดยออกแบบ storage/lifecycle/permission แยกตามงาน
- iOS หลังพิสูจน์ flow อ่านบน Android แล้ว ไม่มีการเคลม release iOS ใน phase นี้

## 9. หลักฐานและเรื่องที่ให้ตรวจ

หลักฐานใน repo และเอกสารอ้างอิงใช้ชุดเดียวกับข้อ 9 ภาษาอังกฤษข้างต้น

ผู้ใช้เลือกแอป native ไม่มี embedded WebView และใช้ system browser สำหรับ OAuth/captcha วันที่ 2026-10-02 แบบปรับปรุงนี้บันทึกทางเลือกดังกล่าว เงื่อนไข hosted captcha page การตรวจ callback และขอบเขตเริ่มต้น MangaDex/แปลทีละหน้า เมื่อตรวจแบบที่เขียนแล้วจึงจัดทำ implementation plan ภายใน Mobile เอกสารนี้ไม่ใช่หลักฐานว่าเขียนหรือทดสอบแอป native เสร็จแล้ว
