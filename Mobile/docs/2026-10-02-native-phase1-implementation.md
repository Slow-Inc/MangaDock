# Native Phase 1 Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved native Android reading/purchase/translation beta through vertical TDD slices.
**Architecture:** Mobile owns native screens and domain controllers. Existing Supabase Auth, Backend, and MIT remain external contracts; real Mobile code is exercised against controlled external boundaries.
**Tech Stack:** Existing Expo 56, React Native, TypeScript, Supabase SDK; Node's built-in test runner for dependency-light integration tests.
**Spec:** [Approved migration PRD](2026-10-02-native-mobile-migration-prd.md) and [slice breakdown](2026-10-02-native-mobile-migration-issues.md).

## 2026-10-03 Android SDK follow-up

Current continuation: [Phase 2 ledger](2026-10-03-native-phase2-implementation.md). PRD #724 and all 29 slices #725–#753 are published; Mobile passes 121 tests/typecheck and exports the Phase 2 bundle. Phase 1 live/signed-device gates remain open. Current Mobile env lacks the three required public variables; this supersedes earlier observations about a configured Mobile environment.

ความคืบหน้าปัจจุบัน: [Ledger Phase 2](2026-10-03-native-phase2-implementation.md) เผยแพร่ PRD #724 และ slices 29 งาน #725–#753 แล้ว Mobile ผ่าน 121 tests/typecheck และ export bundle Phase 2 ได้ ยังเปิด gates Phase 1 ของบริการจริง/signed device ขณะนี้ env Mobile ขาด public variables สามตัว ข้อมูลนี้แทนการตรวจพบ environment Mobile ที่ตั้งค่าแล้วก่อนหน้านี้

Reproduced missing SDK configuration, then set the ignored generated `android/local.properties` to the already-installed SDK. Original x86_64 `app:assembleDebug` now succeeds (exit 0, 204 tasks; 5 executed / 199 up-to-date). [Setup and prebuild recovery](../README.md#android-sdk-location-on-windows). This closes local SDK discovery, not the remaining live-service, physical-device or signed-beta gates.

ภาษาไทย: ทำซ้ำปัญหาไม่มีค่า SDK แล้วเพิ่ม `android/local.properties` ที่สร้างเฉพาะเครื่องและ Git ignore ให้ชี้ SDK ที่ติดตั้งอยู่ คำสั่ง `app:assembleDebug` x86_64 เดิมผ่านแล้ว (exit 0, 204 tasks; รัน 5 / up-to-date 199) ดู [วิธีตั้งค่าและกู้คืนหลัง prebuild](../README.md#android-sdk-location-on-windows) ปิดปัญหาการหา SDK เฉพาะเครื่อง แต่ยังไม่ปิด gates บริการจริง เครื่องจริง หรือ signed beta

## 2026-10-02 Android startup follow-up

Subsequent UI clarification: use the existing responsive mobile design. [Port mapping and native screenshot evidence](2026-10-02-native-responsive-design-parity.md) records the Phase 1 presentation pass and remaining full-navigation/font/device gates. Mobile tests 88/88 and typecheck pass; Android export is 697 modules / 2.5MB. The user has since installed a debug APK on emulator-5554; its actual updated sign-in render was inspected after reload. Earlier no-device statements below describe prior checkpoints. Live data-screen verification is currently limited by unavailable Backend/environment configuration.

คำชี้แจง UI ภายหลัง: ใช้ design responsive mobile เดิม [Mapping และภาพ native](2026-10-02-native-responsive-design-parity.md) บันทึกการปรับ Phase 1 และเกณฑ์ navigation/font/device ที่ยังเหลือ Mobile tests 88/88 กับ typecheck ผ่าน; Android export 697 modules / 2.5MB ตอนนี้ผู้ใช้ติดตั้ง debug APK บน emulator-5554 แล้วและตรวจภาพ Login ใหม่จริงหลัง reload ข้อความไม่มีอุปกรณ์ด้านล่างเป็น checkpoint ก่อนหน้า ตอนนี้การตรวจหน้าข้อมูลจริงยังติด Backend/environment ที่ไม่พร้อม

The user now has a Mobile `.env` and a generated `android/` directory and attempted an emulator build. Its wrapper selected Gradle 9.4.1 (embedded Kotlin 2.3.0), while the installed Expo template and RN plugin wrapper both select 9.3.1 and the RN plugin compiles with Kotlin 2.1.20. The user's log reproduces incompatible Kotlin metadata in both settings plugins. Restored the generated wrapper to **9.3.1**, whose `--version` confirms Kotlin 2.2.21. No plugin source, package version, or metadata-check suppression was changed. The existing Expo template already preserves this default for a fresh prebuild, so no custom config plugin is needed. See [run guidance](../README.md#android-gradlekotlin-compatibility).

APK verification remains open: the agent's Gradle assemble attempt failed with `GeneratedClassCompilationException` caused by `AccessDeniedException` in Java's ZIP filesystem real-path lookup. A standalone Java probe can read the workspace JAR's 83,267 bytes but `Path.toRealPath()` fails on that same path, isolating a sandbox filesystem limitation. This is not a successful plugin compilation or APK build. Resume by running `npm.cmd run android` from the user's normal Mobile terminal; do not clean/regenerate native directories to work around this agent-only verification failure.

ภาษาไทย: ตอนนี้ผู้ใช้มี Mobile `.env` และ `android/` ที่สร้างแล้ว และเริ่ม build emulator แต่ wrapper ใช้ Gradle 9.4.1 (Kotlin 2.3.0) ขณะที่ template Expo และ wrapper ของ RN ที่ติดตั้งใช้ 9.3.1 ส่วน compiler ของ RN plugin เป็น Kotlin 2.1.20 Log ของผู้ใช้ยืนยัน metadata ไม่เข้ากันใน settings plugins ทั้งสอง คืน wrapper เป็น **9.3.1** และตรวจ `--version` ได้ Kotlin 2.2.21 ไม่แก้ source ของ plugin, เวอร์ชัน package หรือปิดการตรวจ metadata; template เดิมใช้ค่านี้อยู่แล้วจึงไม่ต้องเพิ่ม config plugin

ยังไม่ยืนยัน APK: การ assemble ใน sandbox ของ agent ล้มด้วย `GeneratedClassCompilationException` ที่มีสาเหตุจาก Java ZIP filesystem หา real path แล้วได้ `AccessDeniedException` ทดสอบ Java แยกอ่าน JAR ใน workspace ได้ 83,267 bytes แต่ `Path.toRealPath()` ของไฟล์เดียวกันล้ม จึงแยกได้ว่าเป็นข้อจำกัด filesystem ของ sandbox ยังไม่ใช่หลักฐานว่า compile plugin หรือ APK ผ่าน ทำต่อโดยรัน `npm.cmd run android` จาก terminal ปกติใน Mobile ไม่ต้อง clean/สร้าง native directories ใหม่เพื่อแก้ข้อจำกัดเฉพาะการตรวจของ agent

## Global Constraints

- All implementation/configuration/docs remain under Mobile; preserve the Frontend-imported shared bridge.
- No embedded WebView; no Backend/Frontend/MIT/schema changes.
- One observable test RED → minimal GREEN → refactor while GREEN; record real command outcomes below.
- Native beta is an internal APK; do not equate tests or bundling with physical-device acceptance.
- Existing deployment credentials/URLs remain prerequisites; do not invent them or disclose secrets.

## Review Focus

- Logout/account switch during a slow profile response must never restore another account.
- An enrolled TOTP requirement must block authenticated product use until verified.
- Captcha/auth callbacks must be matched to the current browser request and expire safely.
- Batch errors, empty successful Patches, and connection loss must not become false translation success.
- Payment recovery must use server status after foreground/relaunch rather than creating a duplicate payment.

## Task 1: Native account tracer (S1)

**Files:** Mobile/src/session.ts; Mobile/src/backend.ts; Mobile/src/runtime.ts; Mobile/App.tsx; Mobile/tests/session.test.ts; Mobile/package.json; Mobile/scripts/validate-env.mjs; Mobile/.env.example; Mobile/README.md.
**Public interface:** Observe session/account state, subscribe, restore, sign in, sign out, retry profile loading, and dispose; current Backend profile is authoritative.

- [x] Write one integration-style test: email/password login exposes the authenticated Backend account through the native session interface. Run to meaningful RED.
- [x] Implement only that behavior with the real Supabase SDK and Mobile API adapter. Run to GREEN.
- [x] Add restore, sign-out, failure, and account-isolation behavior tests one cycle at a time.
- [x] Bind native login/account screens to the tested session; use existing stable identity and lifecycle refresh.
- [x] Typecheck and bundle the native entry; record physical-device limits.

## Remaining Phase 1 slices

Execute S2 OAuth/TOTP, S3 protected search/Reader/captcha, S4 uploaded versions, S5 Reader controls, S6 Single-Page Translation, S7 Batch Translation, S8 paid unlock, S9 payment lifecycle, then S10 device APK acceptance in dependency order. For each, select the next public behavior from the approved issue, watch its test fail meaningfully, implement minimally, rerun, and record evidence. Do not prewrite the entire suite.

## Execution ledger

- 2026-10-02: User approved proceeding and selected TDD.
- GitHub publication attempted: write connector rejected the action because it requires approval while policy is `never`; no parent/child issue was created. Retain reviewed draft bodies and a gh publishing helper.
- Workspace: existing feature branch `feat/mobile-native-phase4`; no git metadata mutation needed.
- Environment: Node v26.1.0 and installed Mobile dependencies available; Mobile `.env` absent. API/captcha URLs requested; real-device and hosting acceptance remain open.
- S1 local implementation: email/password account tracer RED (signedOut) → GREEN; restore RED → GREEN; logout RED → GREEN; slow account load after logout RED → generation guard GREEN; subscription RED → GREEN; wrong-account response RED → rejection GREEN; failed account switch RED → clear old account GREEN; disposal RED → generation invalidation GREEN; SDK invalidation RED → clear navigation GREEN. Account responses are obtained through real Supabase SDK and the real Mobile adapter; only external fetch/storage/browser boundaries are controlled.
- S2 local implementation: TOTP gate RED → GREEN; verification RED → GREEN; browser OAuth RED → GREEN; captcha-path OAuth callback RED → exact callback validation GREEN; current token unavailable before MFA RED → GREEN. Invalid-code/provider-cancellation and physical OAuth verification remain acceptance checks.
- Runtime PKCE: test without browser WebCrypto observed plain challenge (RED); native crypto adapter supplies secure random + SHA-256 and SDK generates S256 (GREEN).
- Latest local suite at this checkpoint: `npm.cmd test` 18/18 pass; `npm.cmd run typecheck` pass; Android Expo export succeeds (661 modules, Hermes bundle). Native screen interaction and real service integration are not verified by this export.
- Android device inventory: no device/emulator attached. APK acceptance is open.
- Publishing helper: PowerShell parser reports valid syntax; execution is disabled by the machine execution policy. No helper publication occurred. Do not bypass this policy.
- Dependency decision: declared already-installed Expo Crypto 56.0.4 and Node types 26.0.1 directly; npm reconciled the lockfile offline successfully. Crypto is required for native S256 PKCE, Node types for checking the test suite. Existing versions are retained.
- S3 local implementation: search, details/chapters, stale-search isolation, browser captcha state/callback/expiry/HTTPS, closed-Reader late-response protection, and static-page callback behavior completed through RED → GREEN. Native catalog/Reader screens are bound; real captcha hosting/site key and device integration remain open.
- S4/S8 local core: published available versions merge in chapter order; free Studio pages, server-priced paid gate, existing entitlement, and atomic purchase-to-entitlement confirmation completed through RED → GREEN. Current NativeReadingView still needs the unlock/balance controls bound to these actions.
- S6 local core: selected-page Backend Patches RED → GREEN; foreground and Reader-close cancellation RED → GREEN; malformed response rejected. Single-page controls/normalized native Patch overlays are not bound yet.
- S7 local core: full canonical chapter submission and successful empty Patches RED → GREEN; incomplete stream and failed Page rejection RED → GREEN; streaming observer progress across split UTF-8/CRLF frames RED → GREEN. More lifecycle/error/option coverage and native controls remain.
- Checkpoint: `npm.cmd test` 47/47 pass. Native runtime WebView dependency and Expo AuthSession dependency removed; the shared bridge has not been changed.
- Environment constraint: npm registry request for a QR dependency rejected with EACCES. Resolved locally with ten unmodified MIT QR core files from the installed npm distribution; wrapper excluded, provenance/license/checksums retained. Native rectangle output matches independent UTF-8 reference matrices. Actual banking-app scanning remains open.

## Local implementation checkpoint — 2026-10-02

- S3: Native catalog/details/captcha bound; added result pagination after review. Pagination RED → guarded offset continuation GREEN. Fixed Back navigation to invalidate a pending Reader request.
- S4/S8: Native free/paid Studio reading and unlock UI bound to real session tokens. Repeated purchase/insufficient balance RED → shared purchase promise and mapped existing Backend error GREEN; access and balance are rechecked on the server.
- S5: Canonical page navigation across strip/single/double and RTL RED → GREEN; bounded zoom and normalized overlay geometry RED → GREEN; double-tap scale toggle RED → GREEN. Reader preferences live outside transient Reader screens. Captcha recovery preserving page/derivative RED → GREEN. Tall-page viewport coverage and saved-page scroll restoration each RED → GREEN. FlatList mounts in bounded windows; next-two-page prefetch cancels on position/derivative change. Actual gesture/list jump/memory acceptance remains open.
- S6: Single-page controls/overlays/comparison bound. Studio Backend-relative source path RED → preserve raw source GREEN; cached HD/saver byte selection and derivative-context reset RED → GREEN; language/model context reset RED → GREEN; invalid geometry RED → rejection GREEN; expired clearance RED → browser gate/manual restart GREEN. Existing `/books/models` controls effective model choices; MIT remains on the server.
- S7: Chapter controls use native Expo readable streams; batches submit the full canonical order and selected derivative/options. Deadline RED → abort/release/failure GREEN. Retry-page accounting RED → reset current attempt and expose successful/failed/pending counts GREEN. Duplicate/out-of-order completion, global failure sentinel, live background cancellation and no automatic resume pass regression checks. Screen teardown/remount RED → reconnectable listener lifetime GREEN.
- S9: Native QR and coin UI bound. Balance/pending create/relaunch paid-before-local-expiry RED → GREEN; repeated create RED → one pending identity GREEN; cancel/payment race RED → server reconciliation GREEN; logout during delayed creation RED → hide former-account data while persisting for that owner GREEN; paid SSE RED → status/balance requery and terminal reconnect suppression GREEN. New-wallet create RED → recover pending storage first GREEN. Status ordering RED → generation guard GREEN; late old terminal response cannot erase a newer QR. Reading destination persistence RED → GREEN; real-controller recovery through entitlement/captcha checks RED → GREEN. Invalid QR/status and slow old balance each RED → validated authoritative state GREEN. Failed storage RED → preserve known in-memory identity/block repeat creation GREEN. Background stream cancellation preserves QR identity.
- S1 additional cold-process check: test now reopens a fresh Supabase SDK client over the same external storage. Failed account switch/cold relaunch RED → clear persisted old SDK login on current login failure GREEN.
- One final fresh-context review completed under `executing-plans`. No Critical findings; six Important findings (payment ordering/storage, transient position, tall-page tracking, payment return context, pagination, batch attempt accounting) were reproduced or covered and fixed in one TDD pass. Double-tap omission also fixed. No second reviewer dispatched. The review's device/service unknowns remain acceptance gates.
- Ruling: Android prefetch uses the request-ID callback implemented in installed RN 0.85 `Image.android.js`, though that overload is absent from its TypeScript declaration. A narrow local type adapter preserves cancellation of the two queued image requests. Cost if the installed implementation changes: recheck the adapter during an RN upgrade; no dependency upgrade was made here.
- Local commands at this checkpoint: `npm.cmd test` **88/88 pass**, `npm.cmd run typecheck` **pass**. Android export after the full review fix pass **passes**: 689 modules, Hermes bundle 2.5 MB at `Mobile/dist/native-phase1`. Unit/contract/export evidence does not certify native interactions or produce a signed APK.
- Final scope check: tracked/untracked changes are under Mobile; `git diff --check` passes. Shared bridge working-file and HEAD Git hashes match (`717e0cfc8b0c1b32e302c7230cc3a5c4da98e594`). Fresh `adb devices` inventory still has no attached device/emulator.

## Open acceptance and delivery gates

- S10 is **not complete**: no signed/installed APK, no attached device/emulator, no physical-screen/performance evidence, and no live OAuth/TOTP/captcha/MIT/payment exercise. Mobile `.env` is absent; Backend/captcha HTTPS URLs remain requested prerequisites. EAS project ID/signing has not been configured.
- Actual controlled payment settlement and scanner behavior are unverified. Recovery works when a payment ID was received and persisted; a process death or lost network acknowledgement between server creation and receiving/saving its ID cannot be fully recovered using the existing status-by-ID API. Local storage failure keeps a known ID visible in memory and prevents repeat create, but cannot guarantee cold-process recovery after that failure. Do not claim exactly-once topup creation across that window; any future API/idempotency change requires a separately agreed server scope.
- Far-page jumps use measured native cell bounds and bounded retries when FlatList has not measured the target. A failed jump reports an actionable message and resumes actual viewport tracking. Verify long-chapter behavior on the acceptance device.
- Phase 2/3 remain the approved later slices; no account/community/Studio/staff authoring migration beyond Phase 1 has been implemented.
- GitHub PRD/29 child issue publication remains blocked by the connector's approval requirement versus environment policy `never`; no issue IDs exist. Publishing helper was syntax checked but not executed because PowerShell script execution is blocked. No policy bypass was attempted.
- All changes remain under Mobile, and the Frontend-imported shared bridge is unchanged. No commit/push or root CI/schema/service change was made.

## ภาษาไทย

เป้าหมายคือส่ง native Android beta ตาม PRD ด้วย TDD เป็น vertical slices โดยโค้ด/config/docs อยู่ใน Mobile ใช้ Auth/Backend/MIT เดิม ไม่มี embedded WebView และรักษา shared bridge ของ Frontend เริ่ม S1 จากพฤติกรรมเข้าสู่ระบบแล้วเห็นบัญชี ผ่าน public session interface และ Supabase SDK จริงที่ควบคุม Auth/API ภายนอก จากนั้นเพิ่ม restore/logout/error/account isolation ทีละ RED → GREEN ก่อนผูก UI native และตรวจ typecheck/bundle ส่วน S2–S10 ทำตาม dependencies เดิม การผ่าน tests หรือ bundle ไม่แทนหลักฐานอุปกรณ์จริง

Ledger: ผู้ใช้อนุมัติให้ต่อและเลือก TDD แล้ว การเผยแพร่ GitHub ถูก connector ปฏิเสธเพราะต้อง approval แต่ policy เป็น `never` จึงยังไม่สร้าง parent/child issues ใช้ branch feature ที่มีอยู่โดยไม่แก้ git metadata เครื่องมี Node v26.1.0 กับ Mobile dependencies แต่ไม่มี Mobile `.env` ได้ขอ API/captcha URLs แล้วและยังต้องตรวจ hosting/อุปกรณ์จริง
