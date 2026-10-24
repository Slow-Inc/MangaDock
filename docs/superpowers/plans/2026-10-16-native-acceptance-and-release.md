# Native Acceptance and Android Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task in the existing session. Steps use checkbox syntax. This document is a planning deliverable; no implementation, service startup or cloud mutation is authorized by its creation alone.

**Goal:** Take the existing native Android implementation through real-service/device acceptance and produce a signed internal APK that passes the existing beta/replacement gates.

**Architecture:** Retain the existing Expo/React Native views and domain controllers. Native calls the existing Backend and Supabase; Backend owns payments, entitlement and MIT integration. This is a follow-up acceptance/configuration plan for PRD #724, not a new migration or product redesign.

**Tech Stack:** Existing Expo 56, React Native 0.85, TypeScript, node:test, Supabase Auth, Cloudflare-hosted CAPTCHA, NestJS and existing MIT services. Keep existing lockfiles and supported native modules.

**Spec:** `Mobile/docs/2026-10-02-native-mobile-migration-prd.md`; current evidence `Mobile/docs/2026-10-16-native-status-audit.md`; ADRs 029 and 030. Existing issues #725–#753 remain the work references.

## Global constraints / ข้อกำหนดร่วม

- Work in the existing workspace; preserve all modified/untracked work, existing Backend relation-shape fixes and the shared bridge. No reset, clean, checkout, implicit commit/push/PR/merge or automatic issue closure.
- Application implementation stays in Mobile. Preserve Frontend/Backend/MIT source, API/database contracts, accounts, permissions and business rules. Service env/startup and the existing owned Auth/CAPTCHA configuration are integration prerequisites, not permission to rewrite those services.
- Existing responsive mobile Frontend and `DESIGN.md` are the visual reference. No embedded WebView, invented destinations or new moderation/payment/withdrawal capabilities.
- Keep `mangadock` scheme and Android package `com.mangadock.mobile`. Preserve hardware identity, history and pending-payment/account isolation during upgrade tests.
- Public clients receive only public/publishable credentials; secrets stay in the relevant private server environment. Do not print credentials or include private env in assets/evidence.
- Use existing authorized test accounts/roles and payment fixtures. No incidental live-money payment, role elevation, deletion of a real account or destructive device reset for testing.
- Record source checks, live-service checks, visual/device checks and release checks separately. A blocked/unrun row remains unaccepted. Do not assign a completion/speed percentage without evidence.
- Fix observed Mobile defects with a meaningful behavior RED → minimal GREEN → refactor. Do not repeat the completed whole-workspace source review or manufacture new RED evidence for behavior already covered.

ภาษาไทย: ใช้ workspace เดิม คงงาน modified/untracked การแก้ Backend เดิมและ shared bridge ไม่ reset/clean/checkout หรือ commit/push/PR/merge/ปิด issue เอง งาน application อยู่ Mobile คง source/contracts/บัญชี/สิทธิ์/กฎธุรกิจ Frontend/Backend/MIT ใช้ดีไซน์ responsive mobile และ `DESIGN.md` เดิม ไม่เพิ่ม WebView หรือความสามารถ server ที่ไม่มี คง scheme/package/hardware identity/history/pending payment ใช้เฉพาะ public credentials ใน client เก็บ secrets ที่ server ใช้บัญชี/roles/payment fixtures ที่มีสิทธิ์ ไม่จ่ายเงินจริงหรือทำลายข้อมูลเพื่อทดสอบ แยก source/live/device/release evidence และไม่อ้างเปอร์เซ็นต์ แก้เฉพาะ defects ที่พบด้วย behavior TDD ไม่ทำ whole-workspace review เดิมซ้ำหรือสร้าง RED ย้อนหลัง

## Review focus / เงื่อนไขที่ต้องตรวจเป็นพิเศษ

1. A configured env with an inactive service must remain distinguishable from successful login/data loading — Tasks 1–2.
2. Account switches or delayed responses must not restore another account's data, payment, permissions or security screen — Tasks 2, 4–5.
3. App background, network loss and duplicate callbacks must retain truthful progress and avoid automatic paid/expensive duplicate work — Tasks 2–4.
4. Native media and typography must be checked on the actual binary/device; rendered tests are not OS/visual acceptance — Tasks 0, 5–6.
5. A release candidate must use the intended host/keys/signing identity and preserve app upgrade data — Task 7.

ภาษาไทย: ตรวจให้แยก env ครบออกจากบริการพร้อม กันข้อมูลข้ามบัญชีเมื่อผลล่าช้า กัน callback/คำสั่งแพงซ้ำหลัง background/network loss ตรวจ media/ฟอนต์กับ binary จริง และตรวจ host/keys/signing/ข้อมูลหลังอัปเกรดก่อนรับ release ตาม tasks ที่ระบุ

## Execution and evidence / วิธีทำและหลักฐาน

Execute sequentially in the existing session. Tasks 0 and the release-configuration inspection in Task 7 can be prepared before cloud recovery; do not mark later live gates passed early. Each live scenario records: issue, account role without credentials, device/build, input/action, expected result, observed result, `NOT_RUN | PASS | FAIL | BLOCKED`, verifier/date and redacted evidence link. Use `Mobile/docs/2026-10-16-native-acceptance-checklist.md` for these rows and the existing completion ledger for concise progress.

Existing source baseline from the audit: Mobile 218/218, typecheck/env validation and Android export passed; Backend build and the 12 affected relation-shape tests passed. These are dated evidence, not promises that future checks will stay green. Rerun affected checks after a change and the full Mobile suite at the final code checkpoint; rerun export/build when code/native config changes justify it.

ภาษาไทย: ทำตามลำดับใน session เดิม เตรียม Task 0 และตรวจ release config ของ Task 7 ได้ก่อนกู้ cloud แต่ไม่รับ live gates ล่วงหน้า ทุก scenario บันทึก issue/role ที่ไม่รวม credentials/device-build/input/expected/observed/status/ผู้ตรวจ-วันที่/หลักฐานที่ปิดข้อมูลส่วนตัวใน checklist และสรุปใน ledger Baseline จาก audit เป็นหลักฐานลงวันที่ ต้องตรวจผลกระทบหลังแก้และชุด Mobile รวมเมื่อเก็บโค้ดสุดท้าย รัน export/build ใหม่เมื่อเปลี่ยน code/native config ที่เกี่ยวข้อง

### Task 0: Prepare the acceptance checklist and device inputs

**Files:** Create `Mobile/docs/2026-10-16-native-acceptance-checklist.md`; reference the approved PRD, audit and `Mobile/docs/native-migration-publish/published.json`. Inspect `Mobile/app.json`, `Mobile/eas.json` and current native-module package versions without changing them.

**Consumes:** Current feature/source mapping and existing issues. **Produces:** One scenario/evidence matrix and a named device/build/test-role inventory for subsequent tasks.

- [x] Map every feature slice S01–S09/S11–S28 and release gates S10/S29 to acceptance rows. Existing screenshots/tests keep their actual limited scope.
- [x] Identify emulator and a physical Android target, their OS/text scale, current app version/certificate, and availability of non-sensitive reader/creator/staff test roles. Record unavailable roles/devices as BLOCKED.
- [x] Check whether the installed binary includes image-picker/file-system/sharing modules; plan a fresh development build if it does not. Do not uninstall/reset the user's app to resolve a signing/module mismatch.
- [x] Confirm which supported browser/native inspection surfaces are actually available. If automation is unavailable, use user-operated device checks with explicitly attributed observations; keep any unobserved row NOT_RUN.

**Pass:** All approved scopes have a row; device/build/role prerequisites and the evidence format are explicit. No runtime/cloud change is needed for this deliverable.

ภาษาไทย: สร้าง checklist ครบทุก slices และสอง release gates ระบุ emulator/เครื่องจริง OS/text scale/build/certificate และ test roles ที่มีสิทธิ์ ตรวจ native modules ของ binary และ surface ที่ใช้ตรวจจริง หากขาดให้ BLOCKED ไม่ล้างแอปแก้ปัญหา ถ้าไม่มี automation ให้ผู้ใช้ตรวจบนเครื่องและระบุผู้ตรวจชัด เกณฑ์ผ่านคือทุก scope มีแถวและทราบ prerequisites/evidence โดยยังไม่ต้องเปลี่ยนบริการ

### Task 1: Restore the existing service prerequisites

**Files/config:** Existing private `Mobile/.env` and `Backend/.env`, existing MIT launch configuration; reference `Obsidian-MangaDock/project-mit-launch-env.md` and `Obsidian-MangaDock/project-mit-worker-restart-gotcha.md`. Update the acceptance checklist only with redacted results.

**Consumes:** Configured project `eqgcnoljbiwosecydjqd`, its existing account/deployment and Task 0 device target. **Produces:** Reachable configured Auth, Backend, Metro, MIT and a development binary using the intended public endpoints.

- [x] Recheck Supabase project status and determine the supported restoration path. Use MCP capabilities or discover installed CLI commands through help; restore the existing project rather than creating a replacement account/database. If restoration requires a missing owner action, record the exact reason and continue independent work.
- [x] Require `ACTIVE_HEALTHY`, project-host DNS resolution and HTTP 200 Auth settings with the configured publishable key. Verify the five exact native redirects from `2026-10-05-native-auth-redirects.md`, retaining all web settings.
- [ ] Start existing Backend using `npm.cmd run start:dev` in `Backend`; launch MIT through its documented `.venv`/worker recipe. Confirm the actual configured Backend→MIT endpoint rather than assuming an arbitrary root `/` is a health route.
- [ ] Set the correct reachable Mobile API endpoint for the chosen device: emulator may use `http://10.0.2.2:4001`; a physical phone needs a verified LAN/HTTPS host. Preserve existing env assignments, project identity and public-key restrictions.
- [ ] Run `npm.cmd run validate:env` in Mobile; start Metro using `npm.cmd run start -- --clear` only when necessary. Verify the actual Android bundle's public env prelude and absence of server secrets. Reload the app.
- [ ] Verify the hosted CAPTCHA HTML/config/protocol and callback request state. Keep existing test keys for development; production-key configuration belongs to Task 7.

**Pass:** Correct device reaches Auth/Backend and its configured MIT dependency; native public values are current; no blocker is being hidden by a fake response, disabled guard or copied server key.

ภาษาไทย: ตรวจและกู้ Supabase โครงการเดิมตามคำสั่งที่รองรับ ไม่สร้างบัญชี/ฐานใหม่ ต้องได้ ACTIVE_HEALTHY, DNS และ Auth HTTP 200 ตรวจ native redirects ทั้งห้าโดยคงเว็บ เปิด Backend/MIT ด้วยคำสั่งเดิมและ `.venv` ที่ถูกต้อง ตรวจ route/endpoint จริง ตั้ง URL Mobile ให้เหมาะกับเครื่อง รัน validate env และ Metro ตามจำเป็น ตรวจ bundle public values แล้ว reload ตรวจ CAPTCHA ที่ host พร้อม state คง test keys สำหรับ development ถ้าต้องให้เจ้าของทำบางอย่างให้บันทึกเหตุผลจริง ไม่ปลอม response/ปิด guard/คัดลอก secret เพื่อให้ผ่าน

### Task 2: Accept real Auth, CAPTCHA and protected reading

**Existing code/test targets if a defect is reproduced:** `Mobile/src/session.ts`, `auth-management.ts`, `security.ts`, `runtime.ts`, `reader.ts`, `NativeSessionView.tsx`, `NativeReadingView.tsx`, `NativeReaderView.tsx`; tests `session*.test.ts`, `auth-management.test.ts`, `security.test.ts`, `reader.test.ts`, `native-flows.test.ts`.

**Consumes:** Tasks 0–1 device/services and authorized test accounts. **Produces:** Accepted core reading journey and account/security evidence for #725–#729/#742.

- [ ] Manually authenticate existing email, Google and Facebook accounts as applicable, complete browser return and required MFA, then cold-relaunch/restore/logout/switch accounts. Keep provider credentials and one-time codes user-operated.
- [ ] Open a protected MangaDex chapter through browser CAPTCHA, return to the intended chapter/page and repeat rejection/expiry/cancel cases. Check published free/paid Studio chapter selection against existing permissions.
- [ ] Verify recovery/signup/link/reauth callbacks and the sensitive MFA/account routes on authorized fixtures; no real-account deletion is part of this test plan.
- [ ] Verify long strip/single/double/RTL, chapter/page navigation, zoom, HD/saver and saved reading-position restoration on the installed binary.
- [ ] For a failure, capture a discriminating repro first. Add the smallest missing behavior regression to its existing test file, observe meaningful RED, fix only the owning Mobile boundary, then rerun that test and affected integration tests. Do not count an import failure as behavior RED.

**Verify:** In Mobile run `node --test tests/session*.test.ts tests/auth-management.test.ts tests/security.test.ts tests/reader.test.ts tests/native-flows.test.ts` and `npm.cmd run typecheck` after relevant changes. Real device evidence is required in addition to these tests.

**Pass:** Auth restores the correct account and CAPTCHA/entitlement opens only authorized content at the intended position; negative cases do not claim success or leak prior-account state.

ภาษาไทย: ตรวจ email/Google/Facebook/MFA จริงและ cold restore/logout/สลับบัญชี ให้ผู้ใช้กรอก provider credentials/OTP เอง ตรวจ CAPTCHA กลับตอน/หน้าเดิม รวมยกเลิก/หมดอายุ/ปฏิเสธและ Studio chapters ตรวจ callback สมัคร/กู้/link/reauth ด้วย fixtures ที่มีสิทธิ์ ไม่ลบบัญชีจริง ตรวจโหมดอ่าน/navigation/zoom/HD-saver/history บน binary หาก fail ต้องมี repro แยกสาเหตุและ regression RED ก่อนแก้ Mobile ขั้นต่ำ รันชุดที่ระบุและ typecheck โดยยังต้องมีหลักฐานอุปกรณ์จริง เกณฑ์ผ่านคือได้บัญชี/เนื้อหา/ตำแหน่งถูกต้องและกรณีผิดไม่สำเร็จหรือข้ามบัญชี

### Task 3: Accept Single-Page and Batch Translation

**Existing code/test targets if needed:** `Mobile/src/translation.ts`, `sse.ts`, `viewer.ts`, `NativeReaderView.tsx`, `NativeTranslationFeedback.tsx`; `Mobile/tests/translation.test.ts`, `viewer.test.ts`, `translation-feedback.test.ts`.

**Consumes:** Accepted protected reading and existing Backend/MIT. **Produces:** Real translation/overlay/lifecycle evidence for #730–#731.

- [ ] Select fixed MangaDex and Studio test chapters/pages and record model/language/derivative; follow the repository's documented non-production cache/E2E procedure before interpreting cached results. Do not modify the MIT pipeline or clear unrelated production data.
- [ ] Verify real single-page Patches remain aligned through zoom/mode/HD-saver changes; distinguish a successful empty Patch set from an error.
- [ ] Verify batch incremental progress, interrupted stream, page failure, cancellation, Reader exit/background and intentional restart. Returning foreground must not automatically create a new expensive request.
- [ ] Apply the same repro→behavior RED→minimal Mobile fix cycle to observed defects. An existing Backend/MIT contract gap is recorded separately rather than rewritten here.

**Verify:** `node --test tests/translation.test.ts tests/viewer.test.ts tests/translation-feedback.test.ts`; typecheck after changes. Record actual page/output evidence, with a report/PNG when performing a benchmark under repository rules.

**Pass:** Actual source/translated geometry matches the selected page and progress/cancellation/errors remain truthful. No unmeasured speed claim.

ภาษาไทย: ใช้ตอน/หน้าทดสอบคงที่และจด model/language/derivative ทำตามขั้นตอน cache/E2E non-production ของ repo ไม่แก้ MIT หรือข้อมูล production อื่น ตรวจ Patches จริงผ่าน zoom/mode/HD-saver และแยก empty success จาก error ตรวจ batch progress/หลุด/page fail/cancel/ออก Reader/background/restart โดยกลับ foreground ไม่เริ่มงานแพงเอง หากพบ defect ใช้ TDD ใน Mobile ส่วน contract gap บันทึกแยก รัน tests ที่ระบุและ typecheck เก็บภาพหน้าจริง/ผลแปล หาก benchmark ต้องมี report/PNG เกณฑ์ผ่านคือ geometry/progress/error ตรงจริง ไม่อ้างความเร็วที่ไม่วัด

### Task 4: Accept payment/unlock and banking-app recovery

**Existing code/test targets if needed:** `Mobile/src/wallet.ts`, `recovery.ts`, `NativeWalletView.tsx`, `NativeQr.tsx`, `reader.ts`; `Mobile/tests/wallet.test.ts`, `qr.test.ts`, `reader.test.ts`, `native-flows.test.ts`.

**Consumes:** Accepted Auth/Reader and the existing provider's explicit test fixture. **Produces:** Checkout/recovery acceptance for #732–#733/#743.

- [ ] With a test account, record the server balance and entitlement before unlock; check already-owned, insufficient-balance and server-denied cases without inventing local ownership.
- [ ] Create one test QR payment, switch to the designated test banking/provider flow, return and confirm server-paid status, balance and intended chapter/page.
- [ ] Test pending recovery after foreground/cold restart, expiry/cancel, duplicate taps and account switches. An ambiguous response must reconcile the known payment before allowing another create.
- [ ] If no provider test mode/fixture is available, mark the live payment rows BLOCKED. Continue other tasks; do not substitute an incidental real payment or label a mocked suite live acceptance.

**Verify:** `node --test tests/wallet.test.ts tests/qr.test.ts tests/reader.test.ts tests/native-flows.test.ts`; typecheck after a code change. Fix observed Mobile bugs through the shared TDD cycle.

**Pass:** One intended test payment, server-authoritative balance/access and correct reading recovery across lifecycle/account changes.

ภาษาไทย: ใช้บัญชี/fixture payment ทดสอบที่ระบุ จดยอดและสิทธิ์ server ตรวจ owned/ยอดไม่พอ/denied สร้าง QR หนึ่งครั้ง ทำ provider/banking test แล้วกลับมาตรวจ paid/ยอด/ตอน-หน้าเดิม ตรวจ foreground/cold restart/หมดอายุ/cancel/กดซ้ำ/สลับบัญชี ผลไม่แน่ชัดต้อง reconcile ก่อนสร้างอีก หากไม่มี test fixture ให้ BLOCKED และทำส่วนอื่นต่อ ไม่จ่ายเงินจริงหรือใช้ mocks อ้าง live acceptance รัน tests/typecheck ตามที่ระบุและ TDD เมื่อแก้ เกณฑ์ผ่านคือหนึ่ง payment ที่ตั้งใจ ยอด/สิทธิ์จาก server และกลับอ่านถูกบริบท

### Task 5: Accept the remaining product workflows and permissions

**Existing targets:** `Mobile/src/personal.ts`, `reading-social.ts`, `profiles.ts`, `account-activity.ts`, `account-settings.ts`, `reading-stats.ts`, `community.ts`, `forum.ts`, `studio.ts`, `staff.ts`, `media.ts`, `files.ts` and their existing `Native*.tsx` views/tests.

**Consumes:** Existing test-role accounts, reachable services and Task 0 matrix. **Produces:** Real-data/OS/role acceptance for #735–#752.

- [ ] Check Home/discovery/library/history/CSV/share, reviews/comments/reports/profile/follows/banner, check-in/notifications/preferences/statistics and Wallet history against actual server acknowledgements.
- [ ] Check Community post/images/replies/votes/report/SSE with foreground/exit/reconnect and account changes; avoid publishing arbitrary test content into a production community.
- [ ] Check creator draft/ordered upload/retry/reorder/delete/publish/earnings using owned fixtures. Reconcile unknown create/upload results before retrying.
- [ ] Check existing staff actions with an already-authorized test staff account, including 401/403 revocation and cleared private caches. Do not grant elevated roles merely to get a test through.
- [ ] Verify real picker/crop/file/share interactions and existing 5 MB profile/forum and 10 MB page limits; keep server validation authoritative.
- [ ] For each defect, change only its owning existing Mobile module/test through the shared TDD cycle; log missing server capability as an integration gap. Rerun affected tests/typecheck and update only observed checklist rows.

**Pass:** Listed flows work with actual data and permitted roles; stale/denied/duplicate actions do not show success or cross account ownership. Baseline unsupported report queues/Studio approval/withdrawals remain accurately described.

ภาษาไทย: ตรวจ Home/library/history/CSV/share/social/profile/check-in/notifications/preferences/statistics/ledger ด้วยผลตอบรับ server จริง ตรวจ Community CRUD/รูป/replies/votes/report/SSE และ lifecycle/account โดยใช้ fixtures ไม่โพสต์ข้อมูลทดสอบสุ่มสู่ production ตรวจ Studio owned draft/upload/retry/reorder/publish/earnings และ reconcile ผลไม่แน่ชัด ตรวจ staff ด้วย account ที่มีสิทธิ์เดิม รวม 401/403/cache ไม่ยกระดับ role เพื่อทดสอบ ตรวจ OS media/file/share และ limits 5 MB/10 MB คง server authoritative แก้เฉพาะ Mobile ที่มี repro ด้วย TDD รัน checks ที่กระทบและบันทึกตามสิ่งที่เห็นจริง คงข้อจำกัด server เดิม

### Task 6: Close responsive-design and device-interaction gaps

**Existing targets if a discrepancy is demonstrated:** `Mobile/src/design.ts`, `NativeDesign.tsx`, the specific affected native view, and `Mobile/assets/`; references `DESIGN.md`, current responsive Frontend and `Mobile/docs/2026-10-02-native-responsive-design-parity.md`.

**Consumes:** Populated flows from Tasks 2–5, matching viewport/text scale and original responsive mobile reference. **Produces:** Before/after device evidence and a per-screen parity decision.

- [ ] Capture corresponding web/native Home, search/detail, Reader, account/library, Community and Studio screens with the same data, viewport and text scale. Staff compares existing desktop actions/tokens as recorded in ADR 030.
- [ ] Compare typography/Thai font metrics, hierarchy, spacing/artwork, safe areas, keyboard/Back, touch targets of at least 44 dp, scaling and accessibility. Mark each discrepancy concretely; do not redesign the product.
- [ ] Fix only demonstrated layout/font/interaction gaps; use behavior regression tests for interaction defects and actual screenshots for visual changes rather than implementation-mirroring snapshots.
- [ ] Recheck on the agreed physical Android target and a narrower/larger-text configuration. Record device performance/memory honestly; a benchmark follows the repo's report/PNG requirement.

**Pass:** Every agreed screen has matching-data evidence or an explicit outstanding discrepancy. A fixture render is labelled as such and does not stand in for populated live/device acceptance.

ภาษาไทย: จับ web/native หน้าที่ตรงกันด้วยข้อมูล/viewport/text scale เดียวกันครบ Home/search/detail/Reader/account/library/Community/Studio ส่วน staff เทียบ actions/tokens desktop เดิม ตรวจ Thai font metrics/hierarchy/spacing/artwork/safe area/keyboard/Back/targets ≥44 dp/scaling/accessibility ระบุจุดต่างก่อนแก้ ไม่ redesign แก้เฉพาะที่พิสูจน์ได้ ใช้ behavior tests กับ interaction และ screenshots กับภาพ ตรวจเครื่องจริง/จอแคบ/ตัวอักษรใหญ่ พร้อมวัด performance ตามกฎ benchmark เกณฑ์ผ่านคือมีหลักฐานข้อมูลตรงกันหรือระบุช่องว่างคงค้าง fixture ไม่ใช่ live acceptance

### Task 7: Configure and accept the signed internal Android release

**Files/config:** `Mobile/app.json`, `Mobile/eas.json`, conditional existing build configuration if necessary, private deployment env/signing configuration and `Mobile/README.md`; checklist/ledger and `docs/reports/system-impact-report.md` only when actual implementation/config changes occur.

**Consumes:** Tasks 1–6 accepted evidence, existing project/signing ownership and reachable deployment. **Produces:** Signed internal APK, certificate/artifact hash, install/upgrade evidence and installation instructions for #734/#753.

- [ ] Inspect release prerequisites now: intended EAS/project ownership, current package/certificate, `preview` internal APK profile, existing signing availability, production HTTPS endpoint and real Turnstile widget's matching public/server keys and hostname. Do not copy secrets into Mobile or assume a profile proves credentials.
- [ ] Configure the appropriate existing project/profile for the signed APK. Keep development/test config distinct from release; the release must not target `10.0.2.2`, depend on Metro, use debug signing or ship the always-pass CAPTCHA setup. Verify supported CLI/commands and any build-service requirements before choosing the build path.
- [ ] In development, run `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run validate:env` and `npx.cmd expo export --platform android --output-dir .expo/native-release-check`. Run a fresh native build after native/config/font changes; do not claim an earlier debug build is the release.
- [ ] Build and inspect the signed internal APK using the verified existing profile/signing path. Record SHA-256, package/version/certificate, endpoint/key category and build commands without exposing private credentials.
- [ ] Install on a clean test target and upgrade a compatible existing test install. Verify cold launch without Metro, Auth/Reader/core flows, hardware identity/history/pending recovery and error/offline behavior. Preserve the user's primary app; record a signing mismatch instead of uninstalling it to force success.
- [ ] Mark #734/#753 accepted only when their full evidence exists. Prepare a scoped diff/doc summary for Git work, but commit/push/PR/merge or issue closure requires a subsequent explicit user request and is not performed automatically by this plan.

**Pass:** A named physical Android device runs the inspected signed APK independently of Metro and passes the required core/replacement scenarios with release-appropriate configuration. Any missing gate remains explicitly open.

ภาษาไทย: ตรวจ ownership EAS/project/certificate/profile `preview` APK/signing/HTTPS และคู่ keys-hostname Turnstile จริง เตรียมส่วนนี้ได้ทันทีแต่ยังไม่รับ release แค่มี profile ตั้ง release ให้ไม่ใช้ 10.0.2.2/Metro/debug signing/always-pass CAPTCHA ตรวจ CLI และข้อกำหนดบริการ build ก่อนเลือกวิธี รัน suite/typecheck/env/export และ native build ใหม่ตาม config/fonts ที่เปลี่ยน สร้าง signed APK จด hash/package/version/certificate/ประเภท endpoint-key โดยไม่เผย secret ทดสอบ clean target และ upgrade test install ที่ certificate เข้ากัน ตรวจ cold start ไม่พึ่ง Metro/core flows/HWID/history/pending/offline ไม่ uninstall แอปหลักเพื่อกลบ mismatch รับ #734/#753 เมื่อหลักฐานครบ เตรียม diff/docs ได้แต่ไม่ commit/push/PR/merge/ปิด issue จนผู้ใช้สั่งชัด

## First execution milestone / หมุดหมายรอบแรก

Start with **Tasks 0–2**: explicit acceptance matrix, restored reachable services and a real Android login→CAPTCHA→reading journey. Prepare Task 7's configuration inventory while a cloud/device prerequisite is unavailable. Do not start new feature development merely because a live dependency is blocked. Later Tasks 3–7 follow only their stated dependencies.

เริ่ม **Tasks 0–2** ให้ได้ checklist ชัด บริการพร้อม และ login→CAPTCHA→อ่านบน Android จริงก่อน ระหว่างรอ cloud/device เตรียม inventory release ของ Task 7 ได้ ไม่เพิ่มฟีเจอร์ใหม่เพื่อแทนงานที่ติดบริการ แล้วทำ Tasks 3–7 ตาม dependencies

## Plan self-review / ตรวจแผน

- Coverage: all 27 feature slices plus both release gates map to Tasks 0–7; existing unsupported/deferred features remain outside scope.
- Dependencies: services precede live flows; successful source checks never bypass a blocked device/provider gate.
- Changes: source/test references are conditional defect targets, not a demand to rewrite tested implementation. No new runtime API/module or schema is invented.
- Method: execute in the existing session; maintain the existing review findings/ledger and review only new task changes. No automatic subagent dispatch or duplicate whole-workspace review.
- Current turn: save and present this plan only; leave runtime/private env/cloud/issue/Git state unchanged.

ภาษาไทย: ครอบ 27 feature slices และสอง release gates ตาม Tasks 0–7 คงงานเลื่อน/unsupported นอก scope เรียงบริการก่อน live ไม่ใช้ source checks ข้าม device/provider ที่ติด เป้าหมายไฟล์คือจุดแก้เมื่อพบ defect ไม่เขียน implementation ใหม่ ไม่สร้าง API/schema ทำเองใน session เดิมตาม findings/ledger และตรวจเฉพาะการแก้ใหม่ ไม่ dispatch agents/review รวมซ้ำ รอบนี้บันทึกและเสนอแผนเท่านั้น
