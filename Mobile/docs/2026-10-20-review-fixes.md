# Phase 4 physical QA review fixes

Goal: address B1–B6 in `qa/REPORT-full-test-2026-10-20.md` against source `443dc80`.
Workspace: existing isolated checkout `C:/Users/woral/md4` (initially detached).

## Plan and acceptance

- [x] B1: reproduce empty successful API bodies, return null, retain malformed-response errors and verify signed-in review loading.
- [x] B2: reproduce restoration to an unmeasured variable-height page, use the same explicit geometry for list positioning and page rendering, preserve the target while images resize, verify progress round-trip.
- [x] B3: retain nested book detail history, invalidate abandoned requests, reset detail scroll on book changes.
- [x] B4: directional horizontal swipe for single/double mode at normal zoom; keep page controls visible without horizontal scrolling; Back closes chapter picker first.
- [x] B5: apply bottom/side safe-area insets inside comments and account activity modal roots.
- [x] B6: track requested translation pages and terminal failures; never show pending pages after a request has stopped.
- [x] Run regression tests, full Mobile suite, TypeScript, Android build and available device checks. Record limitations and update DONE/system impact report.

Baseline: 220/220 Mobile tests pass; TypeScript passes. PowerShell blocks npm.ps1, so use npm.cmd. No dependency change planned. Existing untracked QA evidence and private env are preserved.

Scope: six defects, not the broader visual redesign/search-filter feature suggestions in the QA comparison. No provider, production database or payment configuration changes.

## Results / ผลตรวจ

Branch: `fix/native-phase4-review-20261020`, based on `443dc80`. The user subsequently authorized commit/push and a PR targeting `feat/mobile-native-phase4`. Production deployment is outside this delivery.

**230/230 Mobile tests, TypeScript and env validation pass.** Android `assembleRelease` passes with release vital lint (316 tasks, final build 37s). Uses the project's existing React test renderer, which emits its existing deprecation warning. No check is disabled. A separate reviewer found three gesture edge cases; all were reproduced and corrected, with final focused verification passing.

ทดสอบ Mobile **230/230**, TypeScript และ env ผ่าน Android build รวม release vital lint ผ่าน 316 tasks รอบสุดท้าย 37 วินาที มี warning deprecation ของ React test renderer เดิม ไม่ปิด checks reviewer แยกพบ gesture สามกรณีและตรวจหลังแก้ผ่านแล้ว ผู้ใช้อนุญาตให้ commit/push และเปิด PR เข้า `feat/mobile-native-phase4` ภายหลัง โดยไม่รวม production deployment

### Artifact / ไฟล์ติดตั้ง

- `Mobile/build/apk/2026-10-20/MangaDock-0.1.0-phase4-review-fixes-arm64.apk`
- SHA-256: `d4b36ecdbe2e8514ab62bf97534d6044f8daf1065ecd0b969db2d385c00a4a2e`
- Size: 27,761,817 bytes.
- `com.mangadock.mobile`, version 0.1.0/code 1, ARM64, existing Android Debug certificate SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`.
- Installed with `adb install -r` on Galaxy Z Flip4/Android 16; installed `base.apk` SHA-256 matches the final artifact. Existing signed-in session retained. No uninstall/data reset.
- Existing local configuration retained: Backend `http://192.168.1.139:4001`, development CAPTCHA with a test key. Internal LAN QA only, not a store-signed production artifact. No MIT translation-success claim.

ติดตั้งแบบอัปเดตบน Galaxy Z Flip4 Android 16 และตรวจ hash ของ base.apk ตรงไฟล์สุดท้าย รักษา session เดิม ไม่ถอนหรือล้างข้อมูล คง config LAN/dev CAPTCHA เดิม เป็นไฟล์ทดสอบภายในเซ็น debug ไม่ใช่ release สำหรับ store

### Physical verification / ตรวจเครื่องจริง

| Defect | Observed result / ผลที่เห็น |
| --- | --- |
| B1 | Signed-in review section shows rating input and “ยังไม่มีรีวิว”, without JSON parse error. Form was not submitted. / เห็นฟอร์มและข้อความไม่มีรีวิว ไม่ส่งข้อมูลจริง |
| B2 | Strip goto page40 → exit Reader/details → resume =40/50, same page image; repeat with page20 =20/50. / กลับมาเลขหน้าและภาพเดิมทั้งสองรอบ |
| B3 | Original Otome Game detail → related Jeonjijeok detail opens at top → Android Back returns to Otome Game at top. / กลับเรื่องเดิม ไม่กลับหน้าหลัก |
| B4 | Final APK slow LTR swipe changes11→12; reverse returns11; RTL rightward swipe advances11→12. Page controls visible on wrapping rows. Android Back closes chapter picker while Reader stays40/50. Double-page/direction/zoom boundaries and pinch transitions also covered by automated tests. / ปัดตามทิศทางได้ ปุ่มไม่ซ่อนนอกจอ Back ปิดแผงก่อน |
| B5 | Comments send button bottom2436 < system-nav top2496 (60px clearance); notification text is above navigation. / ปุ่มและข้อความพ้นแถบนำทาง |
| B6 | Unavailable translation: page request shows0/1, failed1, pending0; chapter shows0/50, failed50, pending0. / ตัวนับตรงกับ error ไม่ค้างรอผล |

Screenshots + matching UI XML: local `qa/review-fixes/`. Files01–05 were captured on intermediate builds; files06–15 on final `d4b36ecd…` (file02 deliberately records the failed swipe before native scroll arbitration was corrected). Photos of account/profile were not captured. No review/comment/payment/provider mutation was performed; ordinary test reading progress was saved through existing behavior.

ภาพและ XML อยู่ `qa/review-fixes/` ภาพ01–05 เป็น build ระหว่างทาง ภาพ06–15 เป็น build สุดท้าย โดยภาพ02 เก็บการปัดที่ยังไม่ผ่านก่อนแก้ ไม่จับภาพข้อมูลโปรไฟล์ ไม่ส่งรีวิว/ความคิดเห็น/รายการเงินหรือเปลี่ยน provider มีเพียงประวัติการอ่านที่เปลี่ยนตามการทดสอบ

## Root causes and fixes / สาเหตุและวิธีแก้

1. B1 `api.json` unconditionally parsed a successful empty body. Empty/whitespace responses now yield null; malformed nonempty JSON still fails with Thai copy. Integration exercises signed-in `reading-social.reviews` with the real empty-body contract.
2. B2 virtualized unmeasured pages used an average-height fallback, while each mounted image changed height independently. Heights/offsets now derive from the same ratio map used to render pages; explicit offsets replace average retries and native anchoring handles late loads. Synthetic geometry test changes an earlier image from ratio1.4 to8 while targeting page40; device round-trips verify actual rendering. This does not prove all possible history/server failures absent.
3. B3 catalog held only the active book. Successful book transitions now push detail/chapter snapshots; Back pops them and invalidates late work. Explicit close clears the stack; changing detail IDs resets the ScrollView.
4. B4 no swipe handler existed. Adding one exposed native horizontal-scroll interception, pinch-release page turning, and stale pinch geometry when a second finger joined. Disable inner panning only at zoom1; distinguish swipe/pinch and initialize geometry on transition. Chapter/page controls wrap and picker owns Back while open.
5. B5 native modals render outside the app root SafeAreaView. Padding therefore belongs inside each modal sheet, including bottom/left/right insets.
6. B6 UI counted chapter length minus patches even for a stopped single-page request. Requested page indices, terminal failed-page classification, and a shared progress calculation keep scope and status aligned. Retrying one page removes its old result first; unrelated page overlays remain.

ภาษาไทย: B1 parse body ว่างโดยไม่มี guard; B2 ใช้ความสูงเฉลี่ยใน list ที่ภาพเปลี่ยนขนาดแยกกัน; B3 เก็บเรื่องเดียว; B4 ไม่มี swipe และต้องแก้การแย่ง gesture ของ native scroll/แยก pinch/ตั้งต้นระยะเมื่อเพิ่มนิ้ว; B5 modal อยู่นอก SafeAreaView ของแอป; B6 นับทั้งตอนแม้ขอหน้าเดียวและหยุดแล้ว แก้ที่ต้นเหตุแต่ละจุดตามรายละเอียดด้านบน ไม่เพิ่ม dependency หรือเปลี่ยน Backend

## Experiments and limits / สิ่งที่ลองและข้อจำกัด

- `qa/*red.log` records failures before fixes; `qa/*green.log`, `targeted-final.log` and `full-tests-final.log` record verification.
- PowerShell disallowed npm.ps1, so use npm.cmd. First Gradle run lacked SDK location; set process-only `ANDROID_HOME`, without changing project configuration. Final build log: `qa/review-fixes-build-final.log`.
- Initial swipe candidate `7e270dc1…` did not advance11/50 physically. Corrected responder ownership; final slow-swipe tests above pass. Intermediate `92ff49eb…` verified B1/B3; final guard includes all three reviewed gesture fixes.
- One simultaneous UI dump attempt collided with another pending dump (exit137); subsequent device calls were serialized. Python launcher was unavailable; a local Node ADB helper was used instead. These did not require app-source changes.
- Final source whitespace and touched UI/test formatting checks pass. Device settings read back unchanged: screen timeout30000, auto-rotation1, user_rotation0. The existing Windows toast helper again failed XML/Show despite exit0; no toast delivery is claimed and the unrelated helper was not modified.
- Before commit: fresh Mobile230/230, TypeScript/env, lockfile dry-run and repository tooling58/58 pass. Local APK, private env, QA screenshots/logs and pre-existing `build.log` are excluded from source staging. The exact tested upstream Phase4 head is still443dc80.
- Not retested: successful MIT translation, payments/account mutations, offline, fold/outer display, prolonged sessions, other devices/iOS. This work closes the six reported paths within the stated coverage, not all Phase4 release acceptance or the broader UX feature requests.

ภาษาไทย: บันทึก red/green และ tests อยู่ใน qa ใช้ npm.cmd เพราะ PowerShell policy และตั้ง ANDROID_HOME เฉพาะ process เมื่อ build แรกหา SDK ไม่พบ รอบแรกปัดจริงไม่ผ่านจึงแก้ตามหลักฐาน การ dump UI พร้อมกันชนกันหนึ่งครั้งจึงเรียกตามลำดับ และใช้ Node แทน Python ที่ไม่มี ไม่เปลี่ยน source เพื่อกลบปัญหา tooling ยังไม่ทดสอบ MIT สำเร็จ/เงิน/แก้บัญชี/offline/จอพับ/session ยาว/เครื่องอื่นหรือ iOS ไม่อ้างปิด acceptance ทั้ง Phase4

## Rebuild / สร้างซ้ำ

From `Mobile/android`, using the existing private local Expo configuration:

```powershell
$env:ANDROID_HOME="$env:LOCALAPPDATA\Android\Sdk"
$env:NODE_ENV='production'
$env:CMAKE_BUILD_PARALLEL_LEVEL='1'
.\gradlew.bat :app:assembleRelease '-PreactNativeArchitectures=arm64-v8a' '-Pkotlin.compiler.execution.strategy=in-process' --max-workers=1 --no-daemon '-Dorg.gradle.jvmargs=-Xmx1536m -XX:MaxMetaspaceSize=512m'
```

See [ADR031](../../docs/adr/031-mobile-reader-geometry-and-review-recovery.md). Resume from this branch/worktree; do not copy the older Phase3 shell over it. Existing QA artifacts remain intact.
