<!-- lang:en -->

## Native main integration validation — 2026-10-22

- Combined main `cb1f7d9` and native Phase 4 `ef301fb`; resolved five conflicts while preserving main history and joined-profile normalization. Mobile 235/235, Backend 98 suites/1,014 tests/build/focused lint, tooling 58/58 and types/env pass; vendor hashes 10/10. [Integration record and outstanding acceptance](Mobile/docs/2026-10-22-main-integration.md). Draft #860 and six unrelated local operational docs excluded; no new APK or physical/live-service acceptance claimed. Landing status belongs to the integration PR.
- ภาษาไทย: รวม main กับ native ตาม SHA ด้านบน แก้ conflict ห้าไฟล์ เก็บประวัติ main และการแปลง profiles ครบ ตรวจ Mobile 235/235 Backend 98 suites/1,014 tests/build/lint tooling 58/58 types/env และ hash vendor 10/10 ผ่าน แยก draft #860 และเอกสาร local ค้างหกไฟล์ ยังไม่อ้าง APK/เครื่องจริง/บริการจริงรอบใหม่ สถานะ merge ให้ดู PR รวม

# DONE — Claude Code Session Log

## PR #782 scrutiny follow-up — 2026-10-20

- Final combined-head checks: clean npm ci, Mobile **235/235**, types/env/format, tooling **58/58**, Android Hermes export **773 modules/11 assets** pass; corrected bundle contains the new helper and excludes checked private values. No replacement APK or new physical-device acceptance.
- ภาษาไทย: ตรวจ head รวมสุดท้าย npm ci ใหม่ Mobile **235/235** types/env/format tooling **58/58** และ Hermes export **773 modules/11 assets** ผ่าน bundle มี helper ใหม่และไม่พบค่าลับที่ตรวจ ยังไม่สร้าง APK ทดแทนหรือรับผลเครื่องจริงเพิ่ม

- Fixed required empty JSON responses silently publishing null and crashing review rendering: strict `json` plus explicit `nullableJson` for the absent own-review contract. Component regression observed RED TypeError → GREEN retryable Thai error for summary/list, while optional empty responses remain supported.
- Rebased active pinch geometry after finger lift/rejoin without clearing the gesture-wide page-turn guard. Component regression observed RED zoom1 instead of2 → GREEN stable2, subsequent3/back2; covers move and touch lifecycle events. Preserved concurrent chapter-list commit `72af504` and both sides of its test insertion conflict. Earlier APK/device evidence remains historical; no new phone pass claimed. [Report and resume point](Mobile/docs/2026-10-20-review-fixes.md).
- ภาษาไทย: แก้ body JSON ที่จำเป็นแต่ว่างไม่ให้ publish null จน render รีวิวล้ม โดยแยก `json` แบบเข้มงวดกับ `nullableJson` สำหรับรีวิวตัวเองที่อาจไม่มี มี RED TypeError → GREEN แสดง error ภาษาไทย/ลองใหม่ทั้ง summary และ list คง optional body ว่าง ส่วน pinch ตั้ง baseline ใหม่เมื่อยก/วางนิ้ว โดยคงตัวกันเปลี่ยนหน้า มี RED zoom1 แทน2 → GREEN คง2/ขยับ3/คืน2 ผ่านทั้ง move และ touch lifecycle เก็บ commit รายการตอนและ tests ทั้งสองฝั่ง ไม่อ้างทดสอบมือถือใหม่จาก APK ก่อนหน้า

## Native chapter list web alignment — 2026-10-20

- Follow-up approved after a cancellation made before any source edits: bounded320dp/half-window chapter viewport, compact language/source/page-count-or-price rows, busy/empty/accessibility behavior. Studio count uses existing version pages; no new HTTP/server/dependency. Existing Reader access gates retained.
- Mobile234/234, TypeScript/format and Android build/vital lint pass. Reviewer found no actionable issues. Galaxy Z Flip4 verified nested scrolling without moving review heading, all83 entries reachable, last chapter68.5 through CAPTCHA into Reader1/15, and150% font layout; restored font1.0. [Report and screenshots](Mobile/docs/2026-10-20-native-chapter-list-parity.md).
- ARM64 QA APK: `Mobile/build/apk/2026-10-20/MangaDock-0.1.0-native-chapter-list-arm64.apk`, SHA256 `db33b7c15aef8b33d1d461b38f7f872fe1d215c2d1c047e9f09b2571ed6bc441`; installed hash matches. Existing debug/LAN configuration and account session retained. Does not close broader release acceptance or add web language filters/grouping.
- ภาษาไทย: ปรับรายการตอนตามเว็บหลังผู้ใช้สั่งต่อ จำกัด320dp/ครึ่งจอ แถวข้อมูลกระชับ เปิดอ่านผ่าน gates เดิม tests234/types/format/buildผ่าน เครื่องจริงเลื่อนภายใน83ตอนได้โดยรีวิวยังอยู่ที่เดิม เปิดตอนสุดท้าย68.5หน้า1/15และฟอนต์150%ผ่าน คืนฟอนต์1.0 APK/hashตามด้านบน ไม่อ้างปิด release gates หรือเพิ่มตัวกรอง/จัดกลุ่มเวอร์ชันของเว็บ

## Native Phase4 review fixes B1–B6 — 2026-10-20

- Implemented in `C:/Users/woral/md4`, branch `fix/native-phase4-review-20261020` from `443dc80`: empty-body API handling, shared Reader layout geometry, nested book Back history, directional page swipes/pinch separation, visible wrapping page controls, picker Back, modal safe areas and requested-page translation counters. No runtime dependency or server/provider change.
- Verification: Mobile **230/230**, typecheck/env pass; final Android assemble/vital lint passes. Independent review found three gesture boundary defects, all corrected and regression-verified. Galaxy Z Flip4/Android16 final APK: LTR/RTL slow swipes pass; history resumes page40 and page20; picker Back retains Reader; comments and notifications clear system navigation; failed page/batch translations show pending0. Intermediate build also verified signed-in review form and related-book Back.
- Final ARM64 APK: `Mobile/build/apk/2026-10-20/MangaDock-0.1.0-phase4-review-fixes-arm64.apk`, SHA256 `d4b36ecdbe2e8514ab62bf97534d6044f8daf1065ecd0b969db2d385c00a4a2e`. Installed base.apk matches; existing debug certificate and account session retained. LAN-only internal QA; version0.1.0/code1.
- [Fix report and resume point](Mobile/docs/2026-10-20-review-fixes.md), [ADR031](docs/adr/031-mobile-reader-geometry-and-review-recovery.md). Evidence `qa/review-fixes/`; baseline artifacts retained. The user subsequently authorized commit/push and a PR into `feat/mobile-native-phase4`; fresh precommit checks230 Mobile/58 tooling/types/env/lockfile pass. Successful MIT, money/account mutations, fold/offline/long sessions and broader redesign/filter requests remain outside this pass.
- ภาษาไทย: แก้ B1–B6 ใน branch/worktree ด้านบน ไม่เพิ่ม dependency หรือเปลี่ยน server/provider Tests **230/230** types/env/build ผ่าน แก้ gesture สามกรณีที่ reviewer พบและทดสอบ regression แล้ว เครื่องจริงปัดตามทิศทางได้ อ่านต่อ40/20ตรงหน้า Back ปิด picker ก่อน และแผงไม่ทับ navigation ตัวนับแปลไม่ค้าง pending ส่วนรีวิว/Back เรื่องเกี่ยวข้องตรวจบน build ระหว่างทางที่ใช้ logic เดียวกัน APK สุดท้าย hash ตรงที่ติดตั้ง เก็บ session เดิม ผู้ใช้อนุญาต commit/push/PR ภายหลัง ตรวจใหม่ผ่าน Mobile230/tooling58/types/env/lockfile ไม่อ้างผล MIT/payment/offline/จอพับ/sessionยาว หรือปิดงานออกแบบส่วนอื่น

## Public HTTPS API and test APK — 2026-10-20

- Recovered `api.hayateotsu.space` from Cloudflare 530/1033 with a dedicated remotely managed healthy tunnel; updated only the existing API CNAME target and added a new download hostname. Preserved shared tunnel configuration version 7. Verified official portable cloudflared digest and restricted token-file ACL; private files stay outside delivery.
- Rebuilt unchanged Mobile source with a process-only HTTPS origin override. ARM64 APK 27,760,053 bytes; native build/vital lint, signature, embedded values/private-token absence pass. Public Reader returns 30 pages after development CAPTCHA; image JPEG 200. Complete HTTPS APK download SHA-256 matches. Actual phone/browser/provider/payment/MIT/production acceptance remains open. Backend, dedicated connector and download server left running; no new commit/push or issue closure on 2026-10-20. [Artifact, runtime and rollback](Mobile/docs/2026-10-20-public-https-apk.md).
- ภาษาไทย: กู้ API สาธารณะจาก 530/1033 ด้วย tunnel แยก เปลี่ยนเฉพาะ target CNAME API และเพิ่มโดเมนดาวน์โหลด คง tunnel ร่วม version 7 ตรวจ hash cloudflared ทางการและสิทธิ์ token แยก private ออกจากการส่ง สร้าง APK ARM64 source เดิมโดย override API HTTPS เฉพาะ build ได้ 27,760,053 bytes ตรวจ build/vital lint/ลายเซ็น/ค่าฝัง/ไม่มี token ส่วนตัวที่ตรวจผ่าน Reader ได้ 30 หน้าด้วย CAPTCHA ทดสอบและ JPEG 200 ดาวน์โหลด HTTPS ครบ/hash ตรง ยังไม่รับมือถือ/browser/provider/payment/MIT/production เปิด Backend connector และ download server ค้างไว้ ยังไม่ commit/push หรือปิด issue ในวันนั้น

## Native commit validation — 2026-10-20

- At the user's subsequent commit/push request, validated the pending native implementation and separate Backend profile-join fix: Mobile **220/220**, typecheck/env and lockfile dry-run; Backend build, full CI Jest **90 suites/960 tests**, focused lint; repository tooling **58/58**. Existing same-day ARM64 APK build/artifact checks remain applicable to unchanged Mobile source.
- Fixed lint only in the six Backend files being committed: consistent formatting, explicit Promise-returning typed HTTP test boundaries, proper Request URL handling and removal of an unused import. Profile behavior and API contracts remain unchanged. Private-env/artifact exclusions and secret scan checked before staging; the only matched literal was a documented public Cloudflare test key already present in historical documentation.
- Git packaging revealed LF normalization changed all ten vendored QR source digests in the index (working copies matched 10/10, index 0/10). Added a narrow `.gitattributes` `-text` rule; re-staged index now matches **10/10**, QR behavior tests **2/2**. Upstream whitespace is intentionally retained; whitespace checks pass outside immutable vendor JavaScript.
- ภาษาไทย: ตามคำขอ commit/push ที่ตามมา ตรวจงาน native และ Backend profile-join แยกส่วน Mobile **220/220** typecheck/env/lockfile dry-run ผ่าน Backend build/CI Jest **90 suites/960 tests**/lint เฉพาะไฟล์ผ่าน tooling **58/58** หลักฐาน build APK ARM64 วันนี้ยังใช้กับ Mobile source ที่ไม่เปลี่ยน แก้เฉพาะ lint ของ Backend หกไฟล์ ได้แก่ format/types/Promise และ Request URL ใน fixtures พร้อมลบ import ไม่ใช้ คง behavior/API ตรวจ exclusions และ secrets ก่อน stage พบเพียง public Cloudflare test key ในเอกสารเก่า
- ภาษาไทย: พบ Git normalize LF ทำให้ digests vendor QR ใน index ผิดทั้งสิบไฟล์ (working copies ตรง 10/10 แต่ index 0/10) เพิ่ม `.gitattributes` `-text` เฉพาะ vendor แล้ว index ตรง **10/10** tests QR **2/2** คง whitespace upstream ตามต้นฉบับ และตรวจ whitespace ส่วนอื่นผ่าน

## Downloadable native Android test APK — 2026-10-20

- Built `MangaDock-0.1.0-arm64-test.apk`, 27,760,069 bytes, embedded Hermes, existing Android Debug signing, for the current Wi-Fi LAN Backend. Native assemble/vital lint passes; Mobile 220/220, typecheck/env pass. Verified certificate/ABI/SDK, embedded public values, absence of checked private token, and matching streamed HTTP download hash. [Artifact/download/install evidence](Mobile/docs/2026-10-20-test-apk.md).
- Existing public API returned 530, so this is explicitly LAN-only. No physical device connected; install/interaction/MIT/production acceptance remain open. Initial PowerShell argument failure corrected without source changes. No Frontend/Backend/MIT source or private env changes, website button, production keys, Git/tracker mutation. Backend and a directory-only LAN download server left running.
- ภาษาไทย: สร้าง APK ARM64 ใหม่ 27,760,069 bytes ฝัง Hermes เซ็น Android Debug เดิมและใช้ Backend ใน Wi-Fi ปัจจุบัน Native build/vital lint และ Mobile 220/220 typecheck/env ผ่าน ตรวจ certificate/ABI/SDK/public values/ไม่มี token ส่วนตัวที่ตรวจ และ hash ดาวน์โหลดตรงไฟล์ API สาธารณะเดิม 530 จึงระบุ LAN-only ยังไม่มีมือถือจริง ไม่รับ install/interaction/MIT/production แก้รูปแบบ argument PowerShell ไม่แก้ source Frontend/Backend/MIT หรือ private env ไม่เพิ่มปุ่มเว็บ/production keys/commit/tracker เปิด Backend และ download server เฉพาะโฟลเดอร์ค้างไว้
## Native acceptance execution — 2026-10-16

- Restored existing Supabase to ACTIVE_HEALTHY; DNS/Auth HTTP 200 and seven diagnostic destinations accepted. Started Backend/Metro; verified current public Android bundle. MIT runtime/models and Redis remain unavailable. Task 0 matrix covers all 29 slices; later device/roles/payment/release gates stay open.
- Fixed empty MangaDex/Studio page responses publishing a ready Reader with two observed RED → GREEN regressions. Mobile **220/220**, typecheck/env and fresh Android export pass. Live controller obtains 30 pages with a simulated browser/development CAPTCHA; one image JPEG HTTP 200. Actual login/browser/device/production protection not accepted. Existing APK verifies with Android Debug certificate, x86_64 only. [Evidence and next inputs](Mobile/docs/2026-10-16-native-acceptance-progress.md). No Frontend/Backend/MIT source change for this fix; no commit or issue closure.
- ภาษาไทย: กู้ Supabase เดิมเป็น ACTIVE_HEALTHY ตรวจ DNS/Auth/redirect เจ็ดกรณี เปิด Backend/Metro และตรวจ bundle ใหม่ จัด matrix 29 slices ครบ แต่ขาด MIT/Redis และยังค้าง device/roles/payment/release แก้ตอนว่าง MangaDex/Studio ด้วย RED → GREEN สอง tests ผ่าน **220/220** typecheck/env/export Controller ได้ 30 หน้าโดยจำลอง browser/test CAPTCHA ภาพแรก JPEG 200 ไม่อ้าง login/device/protection จริง APK เดิมเซ็น debug และเป็น x86_64 ไม่แก้ source Frontend/Backend/MIT รอบนี้ ไม่ commit/ปิด issue

## Native Mobile status audit — 2026-10-16

- Cross-checked current native entry/view/controller/test wiring against the approved feature mapping and queried all 30 migration issues: all remain open. Fresh Mobile tests **218/218**, typecheck, env validation and Android Hermes export **772 modules/~3 MB/11 assets** pass; Backend build and three affected suites **12/12** pass. Existing APK is debug; no new signed release was built.
- Current service blockers: Supabase MCP reports MangaDock **INACTIVE**, its API hostname returns **ENOTFOUND**, and previous local Backend/Metro/MIT ports have no listeners. CAPTCHA's three HTTPS assets remain HTTP 200 and match staged uploads; the development test keys remain configured. Recorded live/device/visual/release/configuration and uncommitted workspace follow-up in [full audit](Mobile/docs/2026-10-16-native-status-audit.md). No app-source, private env, remote-state, Git or issue-state mutation.
- ภาษาไทย: เทียบ wiring native ปัจจุบันกับ feature mapping และตรวจ issues migration 30 รายการ ยังเปิดทั้งหมด Mobile tests **218/218** typecheck env และ Hermes export **772 modules/~3 MB/11 assets** ผ่าน Backend build และ tests สาม suites ที่เกี่ยวข้อง **12/12** ผ่าน APK ที่มีเป็น debug ไม่สร้าง signed release ใหม่ Supabase MCP เป็น **INACTIVE** hostname API **ENOTFOUND** พอร์ต Backend/Metro/MIT เดิมไม่มี listener แต่ CAPTCHA HTTPS สาม assets ยัง 200/ตรง upload และใช้ test keys บันทึกงานค้างบริการ/อุปกรณ์/ภาพ/release/config/workspace ในรายงาน ไม่แก้ app source/env/remote/Git/issue state

## Native Reader development CAPTCHA deployment — 2026-10-05

- Deployed exactly three existing CAPTCHA assets with generated public development-key config on the user's selected Cloudflare account; live page: https://mangadock-mobile-captcha-dev.pages.dev/. Hosted bodies match upload, JavaScript MIME types are correct and hosting redirects preserve request state. CLI create initially delegated to Workers and failed; verified direct Pages opt-out then created/deployed successfully without changing other projects.
- Set the ignored Mobile CAPTCHA URL and added required Expo API/Auth names after discovering Frontend-style aliases in local env. Preserved all old assignments, used the existing project/public publishable key and copied no server secret. Env validation passes; verified and restarted only Mobile Metro, then checked fresh Android bundle values and exclusion of server-only variable names. Focused tests **19/19**, hosted Supabase Auth HTTP 200, Backend CAPTCHA HTTP 201.
- The existing always-pass development test pair was retained; actual browser/device challenge return and production bot protection remain unaccepted. No app/dependency/Frontend/Backend/MIT source change, Git commit or issue closure. [Evidence and rollback](Mobile/docs/2026-10-05-reader-captcha-setup.md).
- ภาษาไทย: deploy CAPTCHA เดิมสาม assets พร้อม public config ทดสอบบน account ที่ผู้ใช้เลือก ตรวจเนื้อหา/MIME/state hosting ผ่าน CLI create แรกส่งไป Workers และไม่ผ่าน ตรวจ opt-out Pages ตรงแล้วสร้าง/deploy สำเร็จ ไม่เปลี่ยนโครงการอื่น ตั้ง URL และเพิ่มชื่อ Expo API/Auth ที่ขาดใน env Mobile คง assignments เดิม ใช้ project/publishable key เดิม ไม่คัดลอก secret env validation ผ่าน restart เฉพาะ Metro ที่ตรวจ workspace แล้ว bundle Android ใหม่มีค่าครบและไม่รวมชื่อ server-only Focused tests 19/19 Supabase Auth 200 Backend CAPTCHA 201 คงคู่ทดสอบ always-pass ยังต้องรับรอง browser/กลับเข้าแอปและ protection จริง ไม่เปลี่ยน source/dependency หรือ commit/ปิด issue ดูรายงานด้านบน

## Supabase native Auth redirects — 2026-10-05

- Added all five native return URLs to the existing hosted project through authenticated Supabase CLI 2.119.0. Preserved ten web URLs, Site URL and all 17 undeclared remote properties; reviewed config updates changed from 1 before push to 0 afterward.
- Live diagnostic cancellations passed 7/7 destination checks, including Google/Facebook native callbacks and the original web callback. No application source changed; actual account login/device session acceptance remains open. [Evidence and rollback](Mobile/docs/2026-10-05-native-auth-redirects.md).
- ภาษาไทย: เพิ่ม native URL ทั้งห้าแล้ว คงเว็บเดิม 10 ค่าและ settings อื่น ตรวจปลายทางจริงผ่าน 7/7 ให้ลอง social login ใหม่ได้โดยไม่ต้อง build การตรวจนี้ยังไม่ใช่การเข้าสู่ระบบบัญชีจริง

---

## #1020 A comment vote needs the comment's post to be live (2026-10-23)

**What:** after #1019 a vote must target a live comment, but `deletePost` does not cascade `deleted_at` to the
post's comments, so a live comment of a deleted post could still be voted through the API (stored against content no
one can see). `vote` now, for a comment target, also requires its post to exist and not be deleted (404 "Comment not
found"): one extra primary-key read on comment votes only. No migration; `deletePost` unchanged.

**Validated:** Jest `forum/forum.service.spec.ts` red (1) → green: a comment of a deleted post is a 404 with no RPC; a
comment of a live post is cast. Forum suites 76/76; real tsc clean; eslint equal to main.

---

## #1019 Comments and votes need a live target (2026-10-23)

**What:**
- `createComment` checked a reply's parent but never the post. A missing post hit the foreign key (500), and a
  soft-deleted post still took comments. It now requires the post to exist and not be deleted (404 "Post not found").
- `vote` cast through `cast_vote_atomic` into `forum_votes`, which has no foreign key on `target_id`, so a vote on a
  missing or deleted post or comment was stored as an orphan row (200). It now resolves the target first, requiring it
  to exist and not be deleted (404). That lookup also yields the comment's post for the broadcast, replacing the
  post-RPC lookup: no extra query for a comment vote, one PK read for a post vote. No migration.

**Validated:** Jest `forum/forum.service.spec.ts` red (4) → green. A vote on a missing or deleted post or comment is a
404 with no RPC; a comment on a missing or deleted post is a 404 with no insert; a live post takes the comment; the
existing vote and broadcast tests pass with the target present. Forum suites 74/74; real tsc clean; eslint one better
than main.

---

## #1017 Chapter-version create and update share one validated price rule (2026-10-23)

**What:** `POST /versions` typed its body as a plain object, so a negative `priceCoins` was stored (PATCH refused it,
and unlock treats a negative price as free). A fractional or int4-overflowing price was a 500, as were non-string text
fields, and text was unbounded. `CreateVersionDto` / `UpdateVersionMetadataDto` now require:
- a price that is a whole number from 0 to the int4 maximum (a database bound, not a product limit);
- typed, bounded strings (description 1,000 = the studio's cap);
- `chapterId` optional, as the studio sends.

**Validated:** Jest `versions/version.dto.spec.ts` red (module missing) → green. The studio's create (with or without
`chapterId`, or minimal) and metadata payloads validate; a negative, fractional or overflowing price, a numeric
description or title, a description over 1,000 and a numeric chapter number are rejected. versions suites pass 21/21.
Real tsc clean; eslint clean.

---

## #1015 Write bodies are validated; malformed ids are 400, an unknown followee 404 (2026-10-23)

**What:** four write routes typed `@Body()` as plain objects, so the global `ValidationPipe` checked nothing:
`POST /reviews/:mangaId`, `/reader-comments`, `/content-reports`, `/translation-feedback`. A wrong type became a 500
(`.trim` on a number, a non-integer into an int column), translation feedback stored `vote: 0` or `5`, and text was
unbounded (50 MB body limit). Each now has a class-validator DTO:
- text up to 5,000 (review, comment), details up to 1,000, title up to 500, ids up to 100;
- page an integer from 0 to 10,000; rating 1–5; vote exactly 1 or −1;
- the services keep their allow-lists.

Malformed ids on `DELETE /reader-comments/:id`, `PATCH /notifications/:id/read` and follow/unfollow, which Postgres
rejects with 22P02, are now 400 via `isInvalidId`, without assuming the column type. A follow of a user with no profile
(foreign key, 23503) is 404.

**Validated:** Jest `common/write-dtos.spec.ts` (22) and `common/write-id-errors.spec.ts` (5, a real supabase-js
client with a stubbed fetch) red → green; the module suites pass (40). Real tsc clean. eslint improved on main in four
files; the remaining unused `Param` import in the translation-feedback controller predates this.

---

## #1013 Spinners that never stopped: empty search after an in-flight one, a failed page image, the notification list (2026-10-23)

**What:**
- `/search`: going back to an empty query while a search was in flight aborted it, the `AbortError` path skipped the
  reset, and the empty branch never cleared `loading`, so 12 skeletons stayed up and the prompt stayed hidden. The empty
  branch now clears it.
- Reader `PageRenderer`: the page `<img>` had no `onError`, so a failed page spun forever over an invisible image. It
  now shows "โหลดหน้านี้ไม่สำเร็จ" with a retry. The failure is keyed on the image source, so another page never shows it,
  and a later successful load clears it.
- `NotificationBell.fetchList`: a throw skipped `setLoading(false)`; it is now in `finally`.
- Token awaits outside any try (`useSeriesFollow`, the mascot config load, the studio edit load) are caught, so a
  rejected session cannot leave a flag set.
- The admin "Apply" (wallet adjust) button has the same shape but is left to the developer (wallet path).

**Validated:** production build + stand-in `STUCK1013=1`. Main: no prompt (skeletons), no page error and the page never
loads, the notification spinner stuck (red). Fix: the prompt shows; "โหลดหน้านี้ไม่สำเร็จ" shows and the retry loads the
page; the spinner stops (green). The reader998, reader-drawer and related-retry probes pass. The token-await cases are
checked by reading. Real tsc 0 errors; eslint matches or improves on main (`NotificationBell`'s error is gone).

---

## #1011 A mascot save no longer always fails (2026-10-23)

**What:** `MascotEditor.save` made the PNG with `new Promise(r => canvas.toBlob(r, "image/png") ?? r(null))`.
`toBlob` returns `undefined` and calls back later, so `?? r(null)` always settled the promise with `null` first. Every
save threw "สร้างรูปมาสคอตไม่สำเร็จ" after the mascot config was already stored, and the profile picture never changed.
`lib/canvasToPng.ts` now resolves with the blob from the callback, and with `null` only without a canvas.

**Validated:** bun test `lib/canvasToPng.test.ts`, red (module missing) → green, 3 tests: an asynchronously delivered blob
comes back (not `null`), a `null` encode stays `null`, and no canvas gives `null`. The mascot tests still pass. Real tsc
0 errors; eslint clean. **Not driven in the browser:** the save applies the mascot as the profile picture, which tests
don't do, per the developer's instruction.

---

## #1009 The public patch route serves patches only (2026-10-23)

**What (security, class only):** `GET /r2-patches/*` is public and registered in every storage mode. It handed the rest
of the path to `StorageProvider.get` with no check that the key was a patch, so any readable object or file could be
served. It now serves only `isServablePatchKey` keys: `uploads/patches/` followed by `PatchStore`'s safe segments
(`[\w.-]`, never `..`), ending in `.png`. Everything else, including absolute keys, is a 404 before storage is touched.
`PatchStore` URLs are always `${origin}/uploads/patches/...`, so real patches are unaffected.

**Validated:** Jest `books/patches.controller.spec.ts`, red (10 of 11 bad keys read storage) → green (12/12). A real
patch is served. Outside the store, `..` (shallow and deep), POSIX absolute, a Windows drive, a backslash, an encoded
separator, an empty segment, a non-PNG, the store root and empty are all 404 with no storage read. The patch-store
suites pass (27). The local backend logs show no requests to the route; the 20 matches are startup route registrations.
The developer was notified to consider rotating `Backend/.env` secrets if a disk-mode backend was publicly reachable.

---

## #1007 Avatar delete accepts only a generated filename; the disk provider contains relative keys (2026-10-23)

**What (security, class only):** `DELETE /users/me/avatar` built a storage key under `uploads/avatars/` from the body's
`filename`, checking only that it started with `<uid>_`. The disk storage provider joined relative keys onto its root
without checking that the result stayed inside, so the prefix check was the only guard. Two layers now:
- the route accepts only the shape `uploadAvatar` generates, `<uid>_<digits>.<ext>`;
- `DiskStorageProvider.getAbsPath` refuses a relative key that resolves outside `rootDir`, for every method; absolute
  keys from in-process callers are unchanged.

No frontend code calls this route.

**Validated:** Jest red (11) → green:
- `users/users.avatar-delete.spec.ts`: separator, parent segment, backslash, no extension, a non-numeric stamp,
  another user and empty are all rejected; the generated shape is deleted;
- `disk-storage.provider.spec.ts`: delete, deleteDir, exists, get, put and a nested climb refuse a key outside the root;
  in-root relative and absolute keys still work. The traversal targets don't exist, so the red run deleted nothing.

users and storage suites pass (161). eslint: only the existing `options` unused-var error in the provider.

**Review round (security-review + scrutinize, fix-then-ship):** the check is now `rel === '' || rel === '..' ||
rel.startsWith('..' + sep) || isAbsolute(rel)`. A key resolving to the root itself is refused (`deleteDir` of it would
wipe the working directory), and a name like `..cache` is no longer mistaken for a climb. The containment tests now
run on a temp root (`process.cwd` mocked) with sentinel files. With the guard removed they fail 7/7 and touch only the
temp tree. The first version targeted paths beside `Backend/` and, on the unguarded red run, `put` wrote a 1-byte
probe file there (removed). The review also found the separate `/r2-patches` exposure (own issue).

---

## #1004 Admin tables: one request per debounced filter change, and only the latest answer writes (2026-10-23)

**What:** in `/admin/users`, `/admin/transactions` and `/admin/content`, the page effect depended on the loader, a
`useCallback` over the filters. Every keystroke rebuilt it and fired a request at once, which defeated the 300 ms
debounce, and whichever answer landed last filled the table, so it could show rows for a half-typed search. `/admin/audit`
loaded the current page and then page 1 on a filter change, with no guard.

All four loaders now have a request counter, so only the latest request writes rows, total and loading/error. In the
three filtered pages, the page effect and the debounced filter effect call the loader through a ref and depend only on
`page` or the filters. eslint also lost an error each of these three pages had on main.

**Validated:** production build + stand-in `ADMIN_RACE=1` (a search for "a" answers 2 s late), with an admin (role 8)
through the local fake session. Typing "ab" in `/admin/users`:
- main sent `["a", "ab"]` and showed the stale "a" rows (red);
- the fix sends `["ab"]` once, after the debounce, and shows only "ab"'s rows (green);
- the first visit sends exactly 1 request.

transactions / content / audit are the same pattern, checked by reading. Real tsc 0 errors; eslint clean on all four.

---

## #1001 A translation for the chapter the reader left never lands on the new chapter (2026-10-23)

**What:** `useChapterTranslation` resets on a chapter, target-language or derivative change and aborts the batch, but
two paths escaped it:
- **Single-page translation** had no abort and no check after its `await`. Chapter A's patches were written at the same
  page index of chapter B, and that page was marked done, so B's "แปลทั้งตอน" skipped it.
- **Whole-chapter translation** awaited `checkMitHealth()` before creating its `AbortController`, so a chapter change
  during the check let it run with the old `pages` and `chapterId`.

A `generationRef`, bumped by both reset effects, is captured at the start of each path and checked after every `await`
(and in the single-page `finally`, so a stale run doesn't clear a newer run's busy flags).

**Validated:** production build + stand-in `TRANS_RACE=1` (no real MIT: two English uploads, health OK, chapter 1's
single-page patch answers 2 s late). Start "แปลหน้านี้" on chapter 1, then click "ตอนถัดไป":
- main: chapter 2 shows `patch-ver-v1` (red); fix: no overlay (green);
- control (stay on chapter 1): the patch shows, so the normal path is intact;
- `reader998` and `reader-drawer` pass.

The whole-chapter health-check window is checked by reading. Real tsc 0 errors; eslint clean.

---

## #999 The latest sort or search wins — manga community hot/new, forum side-menu search, manga picker search (2026-10-23)

**What:** three effects wrote the answer for a sort or query the user had already left:
- the manga community page's hot ⇄ new switch: the slower sort's posts replaced the chosen list;
- `ForumSideMenu` search: older results, and a cleared box could be refilled by an in-flight search;
- `MangaSearchSelector`: older results in the manga picker.

Each now has a request counter (a ref): a response or failure applies only if it belongs to the latest request, and
clearing the side-menu query invalidates an in-flight search. This is the same pattern as the search page, `/new` and
the community feed.

**Validated:** production build + stand-in `RACE999=1` (the first sort/search answers 2 s late).
- Main: after switching to "New" the hot post was shown; after typing "ab" the "aa" result was shown (red).
- Fix: only the new post and only the "ab" result (green).
- The clear-the-box check passes on both builds (by then "aa" was already cached), so it does not prove that part.
- `MangaSearchSelector` is the same code, checked by reading.
- Real tsc 0 errors; eslint clean on all three files.

---

## #998 The reader never shows (or records) the chapter it just left (2026-10-23)

**What:** the reader stays mounted across chapters, and the effect that loads a chapter's pages never cancelled the
previous request; its cleanup only released the scroll lock. When chapter A's pages answered after B's, the reader
showed A's pages under B's header and wrote A to reading history, so "continue reading" reopened the wrong chapter. The
effect now has an `AbortController` and a `cancelled` flag, and every `.then` and `.catch` returns early once superseded.

**Validated:** production build + stand-in `READER_RACE=1` (chapter 1, an uploaded version, answers 2 s late), with a
reader who has already passed the CAPTCHA (stored clearance token). Open chapter 1, then click "ตอนถัดไป" at ~35 ms.
Main: counter `1 / 3`, image `p1`, history `ver:v1` (red). Fix: `1 / 2`, image `q1`, history `ver:v2` (green). The
`reader-drawer` and `e2e919` probes still pass. Real tsc 0 errors; eslint matches main.

---

## #995 Series follow, banner upload and banner position say when they fail (2026-10-23)

**What:** three writes outside #987's list still failed silently. The series bell reverted correctly (#667) but with no
message, so the user thought the click had not registered. The banner upload and the banner position save only logged
to the console. Each failure now shows the error toast (`"…ไม่สำเร็จ ลองใหม่อีกครั้ง"`). The revert and the reposition mode
are unchanged, so a failed position save can be saved again.

**Validated:** production build, local fake session. The stand-in's `FLAKY_ONCE` now takes an optional method
(`"POST ^/users/me/follows$"`), so the follow-list GET is not the request that fails. Main: the follow revert and a
failed position save show nothing (red). Fix: "ติดตามไม่สำเร็จ ลองใหม่อีกครั้ง" and the bell reverts, then follows on
retry; "บันทึกตำแหน่งภาพปกไม่สำเร็จ ลองใหม่อีกครั้ง" and it stays in reposition mode (green). The banner upload is checked by
reading only (uploads are not triggered). Real tsc 0 errors; eslint clean on both files; hooks tests 105/105.

**Review round:**
- A banner (and a forum image) over the server's 5 MB is refused before upload, with a toast naming the limit, instead
  of "try again" for a file that can never pass (`lib/uploadLimits.ts`, unit-tested). E2E: a 6 MB banner shows the toast and
  sends no upload request.
- A dead session (`Unauthorized`) in the banner handlers, and a missing token in the series toggle, open the login
  prompt instead of "try again" or a silent no-op.

---

## #993 Studio publish: one PATCH per click, the button busy while it is in flight (2026-10-23)

**What:** "เผยแพร่" had no in-flight guard and was never disabled. A double-click sent two status PATCHes, and the
backend refused the second (400 "Cannot transition from published to published"), so an error toast flashed for a
publish that worked. The page now tracks `publishingId`. `handleSubmit` returns early while a publish is in flight,
and the version row and the group card disable that version's button and show "กำลังเผยแพร่...".

**Validated:** E2E on a production build, signed in as a creator (role 2) through the local fake session; the stand-in
(`STUDIO=1`) changes the status on receipt and answers after 600 ms. A double-click on main sent `PATCH [400, 200]`
(red); with the fix it sends `[200]`, with the success toast and no error (green). Real tsc 0 errors; eslint matches main.

---

## #992 A vote clears the cached copies it made stale — the next click no longer undoes it (2026-10-23)

**What:** `communityApi.vote()` stored the vote but invalidated nothing, while every other forum write clears its
entries. For up to 60 s, the cached post (`post:<id>`), the feed (tag `forum_posts`) and the comment list
(`comments:<postId>`) showed the old count and `userVote`. A click there sent `+1` again, the server took it as an
undo, and the button showed "voted" against a server with no vote. A successful post vote now clears `post:<id>`
and the feed. A comment vote clears `comments:<postId>`, passed from `CommentThread` through `VoteButtons`'
new `postId`. A failed vote clears nothing.

**Validated:** bun test `lib/communityApi.vote.test.ts` red (2) → green (3): a post vote clears the post and the feed
but not other posts; a comment vote clears its list; a failed vote keeps everything. E2E on a production build, signed in
through the local fake session: vote, go to `/community`, go back (same document). Main-equivalent build:
`GET /forum/posts/abc` 0 times (the cached copy was served). Fix: 1 time. Real tsc 0 errors; eslint matches main.

---

## #987 A failed write says so and keeps the typed text — reports, replies, posts, reader comments, votes, notifications (2026-10-22)

**What:** writes that failed were silent or claimed success (`fetch` resolves on a 4xx/5xx; other handlers caught the
error and only logged it). The report dialog said "ส่งรายงานแล้ว ✅" for a refused report, and a failed reply wiped the
typed text before the request. Every write now checks the answer; raw `fetch` callers check `res.ok`. Typed text is
cleared only after success, and a failure shows the existing error toast (`FollowUserButton`'s "…ไม่สำเร็จ ลองใหม่อีกครั้ง").
The report dialog shows its error inside the dialog and keeps the form. Reader-comment delete and review delete are
guarded against a second click. Notifications are marked read only once the server accepted it, through a new `send()`
that returns `res.ok`, because the existing `apiFetch` returns `null` both for a failure and for an empty success body.

**Validated:** production build + stand-in (`WRITES=1`, `FLAKY_ONCE` fails the first matching write), signed in through
the local fake session. Main-equivalent build (red):
- comment: the text is restored but there is no message;
- reply: the box closes and the text is lost;
- vote: no message;
- report: "ส่งรายงานแล้ว" shown for a 503.

Fix (green):
- comment: the text is kept, the toast shows, and the retry posts and clears the box;
- reply: the box stays open with its text and the toast shows; the retry is accepted (`POST [503, 201]`) and closes the box;
- vote: the toast shows;
- report: the error is shown inside the dialog with the form kept, and the retry reaches "ส่งรายงานแล้ว".

Not run end to end: post edit/delete, comment edit/delete, the create-post failures on `/community`, the manga page and
the quick post, reader comments, review delete and notifications. These are checked by tsc and code reading (same
pattern). eslint matches main on all ten files.

**Review round:**
- The database-down toast (`SupabaseGuard`, 10 s) was replaced by the caller's generic toast for the same 503.
  Toasts now carry a `priority`, and the outage toasts are 1, so a lower one never replaces them. E2E with
  `FLAKY_CODE=SUPABASE_OFFLINE`: red showed the generic toast, green keeps the DB toast and the text.
- A reply is read-only while it is being sent.
- Opening a notification marks it read quietly; only "read all" reports a failure, and it is guarded.
- A dead session opens the login prompt instead of "try again".
- The in-flight deletes disable their buttons.
- A failed forum image upload shows a toast.

**Typecheck correction:** `npx tsc` in Frontend prints npm's "not the tsc command" notice instead of type-checking, so
earlier "tsc clean" claims (#985, #988) were empty greps. The real compiler is `node node_modules/typescript/bin/tsc`.
It was proven to run (284 app files; a planted error is caught) and reports 0 errors on main + #987, which re-verifies
#985 and #988.

---

## #988 Forum compose follows the server: role-filtered categories on the manga page, clipped auto titles, input limits (2026-10-22)

**What:**
- The manga community page offered every category to every role. A regular user saw ประกาศ, which the backend
  refuses from non-admins (403), and อัปเดตมังงะ, which needs role ≥ 1. The page now uses `availableCategories(userRole)`,
  as `/community` does, and falls back to `general` when the chosen category becomes unavailable.
- The popup's quick post built `พูดคุยเกี่ยวกับเรื่อง ${title}`, which a long manga title pushes past the DTO's 200.
  The title and `targetMangaTitle` are now cut with `clipToLimit`, which counts code points as class-validator does.
- No forum input had a limit. Every post / comment / reply / edit field now has the server's `maxLength`
  (`lib/forumLimits.ts`: title 200, content 10,000, comment 5,000) and a `LimitCounter` from 90 % of the limit.

**Validated:** bun test `lib/forumLimits.test.ts`: red (module missing) → green, 4 tests (limits mirror the DTOs; unchanged
within the limit; cut to exactly 200 with an ellipsis; an emoji is never split). Production build + stand-in, signed in
through a local fake session (Playwright answers every Supabase-host request locally, 0 reached the network). Main
build: the picker shows ทั่วไป / ประกาศ / สปอยล์ / อัปเดตมังงะ and no `maxlength` (red). Fix: ทั่วไป / สปอยล์, `maxlength` 200 /
10000, counter "195 / 200" (green). tsc clean; eslint matches main.

---

## #985 A favourite or like the server refused stays pending and retries — an un-favourite no longer comes back (2026-10-22)

**What:** `userCache.flush()` awaited raw `fetch` calls (which resolve on a 4xx/5xx) and then marked every item synced.
A refused add was never re-sent. A refused removal was recorded as done while the server kept the row, so the next
login's merge (which re-adds server favourites missing locally) brought the book back. Nothing retried. It also marked
toggles made while a flush was in flight as synced. Now each request marks only its own item, and only on `res.ok`,
applied after the logout-generation check. A failed item stays pending, and a flush with any failure retries on its
own after `RETRY_DELAY` (30 s) whenever anything is still pending. That includes a toggle made while a flush was in
flight, which the overlapping flush saw as already synced. A permanent 4xx (not 401/408/429) is settled and logged instead of
retried forever, and ids are URL-encoded.

**Validated:** bun test `lib/userCache.test.ts`, red → green (11 with the review round):
- add 500 → pending, then re-sent and marked;
- removal 500 → pending, then the DELETE is re-sent;
- a mixed batch re-sends only the failed item;
- a failed flush retries by itself at 30 s (not at 29 s), and a successful one schedules nothing;
- a re-add made while a DELETE is in flight is still sent;
- a permanent 400 is not retried;
- ids are encoded;
- the login merge marks the server's state as synced.

`identityReset.test.ts` still passes. Full suite: 474 pass; 8 fail in `docs.integration.test.ts`, which needs a live
server on :4000 (none was running). tsc clean, and eslint is clean on both main and the branch. Not checked
in a browser: the module has no UI of its own, and a real sync needs a signed-in session.

---

## #983 Three more places no longer cache a failed load (hero read button, community manga header, studio title) (2026-10-22)

**What:** a sweep of every `cacheOrFetch` call site after #981 found three fetchers that resolved on a non-ok answer, so
the failure was cached. `HeroDetailButton` cached the chapters error body for 5 min, which hid "อ่านเลย". The community
manga page cached `null` for 30 min: no header title or cover, and posts created in that window were saved without
`targetMangaTitle` / `targetMangaCover`. The studio title page cached a JSON error body for 30 min and showed
"ไม่ระบุชื่อเรื่อง". Each now throws on a non-ok answer, as the other 21 call sites already do. The existing catch keeps
the failure display, nothing is cached, and the next mount retries.

**Validated:** production build + stand-in (`FLAKY_ONCE=<regex>`: the first matching request is a 503). The hero (switching
slide 4 → 1 → 4 remounts it) and the community page (client navigation away and back), main build vs fix:
`heroSecond 0 → 1`, community title `generic → "Cover Falls Back · คอมมูนิตี้ · MangaDock"`, with the request log
`503` then no refetch on main, `503, 200` with the fix. A control run with nothing failing shows both on both visits.
The studio page needs creator login, so it is verified by code reading only. eslint matches main, and the build passes.

---

## #981 One failed related-books load no longer hides "มังงะที่คล้ายกัน" for 30 min (2026-10-22)

**What:** `GET /books/:id/related` answered 200 `[]` on any failure (detail fetch, tag list, rated row), and
`RelatedManga` cached whatever resolved, including a 503 body, for `TTL.LONG` (30 min), so one outage hid the row
until a reload. Backend: only an unknown id (`NotFoundException`), a book without genres, or a genre MangaDex has no
tag for answers `[]`. A detail outage propagates, an unavailable rated row is a 503, and `getMangaTagId` throws 503
itself when the tag list can't be loaded and no expired map is left to answer from (so `getNewReleases` no longer
re-reads the cache to tell the cases apart).
Frontend: `RelatedManga` throws on a non-ok answer, so nothing is cached. The row stays hidden on failure, and the
next open retries.

**Validated:** Jest red → green, 5 new tests in `books/books-related.spec.ts` and `books/mangadex-cache-correctness.spec.ts`;
the getNewReleases tag tests are unchanged and pass. Production build + stand-in (`RELATED_FLAKY=1`): main build
`related:[503]`, the second open makes no request and shows no row (red). With the fix it is `[503,200]` and the row
shows "Cover Loads" and "No Cover At All". Backend full run locally: 901/901 tests; 20 suites can't load `openai`
(missing from the local node_modules, unrelated). CI is the authority there.

---

## #978 /forum/trending-manga: a database error is the database-down signal, not "nothing trending" (2026-10-22)

**What:** `getTrendingManga` answered `[]` when the `get_trending_manga` RPC failed (database error or network), so
`/community/trending` said nothing was trending, `communityApi` cached that for 5 min, and the page's own load-error
state (#911) never showed. A database error now throws an Error naming Supabase (`AllExceptionsFilter` → 503
`SUPABASE_OFFLINE`, the app's database-down toast) and a failed call propagates; the frontend already throws on a
non-ok answer without caching and shows its retry.

**Validated:** Jest red → green in `forum/forum.service.spec.ts` — the old "returns empty array on Supabase error"
test now asserts a Supabase rejection, plus a rejected-call case; forum suites 70/70. eslint unchanged.

---

## #976 Book detail: an unknown id is a 404, an outage a 503 (or stale), half a detail is not cached (2026-10-22)

**What:** `getMangaDetail` builds the detail from two MangaDex fetches (the manga; its covers) and each turned any
failure into empty fields. An unknown id (MangaDex 404/400) and an outage both answered 200 with an empty detail, so
the book popup's #919 "not found" vs "load failed" split never saw a real 404, and the browser kept the empty answer
30 min; a detail with only covers (manga fetch down) or only the manga (covers down) was cached the full 20 min. The
fetches now say why they are empty (`fetchMangaCovers` → `null`; `fetchMangaAuthors` → `failure: notFound |
unavailable`, also for a 200 without the manga): not found → `NotFoundException`; manga down → stale detail or `ServiceUnavailableException`; covers down
→ served with the stale covers if any, uncached; only a detail whose two parts answered is cached. Related books, series context and
the cover proxy already catch and degrade.

**Validated:** Jest red → green, `books/detail-outage.spec.ts` (8): 404 and 400 → 404 with no cache write; manga
503 → 503, or the stale detail when there is one; a 200 without the manga → 503; covers 503 → served with its title (stale covers if any), uncached;
both fine → cached. Full Backend suite 108 suites / 1,064 tests; eslint unchanged on the service, clean on the new spec.

---

## #974 A shared /book/<id> link carries the book's title, not the site's (2026-10-22)

**What:** a direct `/book/<id>` (the URL the book popup pushes, so the one people share) served the site title and
description; the book's name was only set client-side after hydration, so link previews and crawlers saw every book
as the same page. `app/book/[id]/page.tsx` now has `generateMetadata`: it fetches `/books/manga/<id>` (server timeout
#858; not cached by Next — the backend caches details, an outage answer must not stick) and returns "<book> ·
MangaDock" (trimmed), the first 160 characters of the markdown-stripped description, and `og:title` / `og:description`. Any miss keeps the site defaults. No `og:image` — the site has no `metadataBase` / OG
setup yet.

**Validated:** production build: before, `/book/cover-fallback` → site title; after, `<title>Cover Falls Back ·
MangaDock</title>` + `og:title`, and an unknown id keeps the site title. The #919 book-route probe (backend down / real
404 / healthy) still passes; a markdown description reaches the preview as plain text; closing the popup returns
to `/` with the site title. tsc 0; eslint clean on the file.

---

## #971 An unknown genre slug is the 404 page, and the genre list lives in one place (2026-10-22)

**What:** `/categories/<anything>` rendered a genre page named after the slug ("nope") with an empty grid — the
backend answers an unknown slug with an empty list — so a stale or mistyped link looked like a real, empty genre and
was indexable. The 18 genres were also written twice (`Navbar.tsx`, the genre page). Now `app/lib/genres.ts` is the
one list; `categories/[genre]/page.tsx` is a server page that calls `notFound()` for any other slug and renders the
client `GenrePage.tsx` otherwise. The status stays 200: the root `app/loading.tsx` streams the shell before the page
resolves, so Next serves the 404 page with `noindex` instead (a 404 status would need a proxy rewrite or dropping the
root loading state; `notFound()` from `generateMetadata` was tried too — Googlebot still gets 200).
`dynamicParams = false` + `generateStaticParams` was tried first and had no effect on this dynamically rendered
route. The page passes the validated genre to `GenrePage` as props (no `useParams`), and `generateMetadata` puts
"แอคชัน · MangaDock" in the server HTML.

**Validated:** production build: before, `/categories/nope` → heading "nope", no noindex; after, `nope` and `ACTION`
→ "ไม่พบหน้านี้" + `noindex`, `action` → "แอคชัน" without noindex; the navbar still links all 18 genres. tsc 0; eslint
clean on the touched files.

---

## #970 A MangaDex outage is a 503 for search and genre, not "200, no results" (2026-10-22)

**What:** `fetchMangaWithParamsPaged` and `getGenreManga` turned a MangaDex 5xx / 403 / 429 / maintenance page /
network error into an empty list. The browser showed "ไม่พบหนังสือ" or an empty genre instead of its load-error retry
(#911) and cached the empty answer (search 5 min, genre 30 min); a year-range search cached it server-side for 20 min,
and a scan failing partway cached partial matches as complete. The paged fetch now marks an outage `unavailable` (a
400/404 — our own bad request — stays a plain empty answer); `MangaCatalogService.searchPage` (both search paths)
turns it into a 503 before anything is cached; the genre listing answers 503 on a failed fetch; new releases
answer 503 when all four rows are down, otherwise serve the rest uncached, never with the flag in the JSON (review).

**Validated:** Jest red → green, `books/search-outage.spec.ts` (9): 503 and network error marked unavailable, 400
not; search and a year scan failing on its second page answer 503 with no cache write; genre 503 on both failures.
Full Backend suite 107 suites / 1,056 tests. eslint unchanged on the services, clean on the new spec. The browser side
needs no change: both pages already show the retry state for a non-ok answer and never cache it (#911).

---

## #967 A guest's reading history opens on /mylist instead of a login wall (2026-10-22)

**What:** a guest's reading history lives on the device (`mangadock_reading_history`; logout clears it via
`identityReset`), and home shows it in the "อ่านต่อ" row with "ดูเพิ่มเติม" → `/mylist?tab=history` — which showed only
"เข้าสู่ระบบเพื่อดูรายการของคุณ", because `mylist/page.tsx` gated every tab on `user`. The history tab now shows the
local history to a guest; favorites / follows / liked (guests can't add to them) keep the login prompt, and CSV export
stays signed-in only.

**Validated:** production build, guest with one local history entry: before, "ดูเพิ่มเติม" landed on the login wall;
after, the book shows on the history tab and `?tab=favorites` still asks to log in. tsc 0; eslint clean on the file.

---

## #965 Search filters: no dead rating filter, one search per year, honest empty state (2026-10-22)

**What:** on `/search` the "≥ 3★ / ≥ 4★ / ≥ 4.5★" filter could only empty the list — every search result (and every
"my list" item) has `averageRating: 0`, MangaDex search carries no rating; typing a year sent one backend search per
keystroke (`2`, `20`, `201`, `2015`); a list emptied by filters still said "ลองใช้คำค้นหาอื่น หรือตรวจสอบการสะกด" with no
way to clear them. The rating filter is removed (until results carry real ratings — a separate decision); the year
boxes keep a draft and apply only a complete 4-digit year in range after a 400 ms pause; with any filter on, the empty
state says no book matches the selected filters and offers "ล้างตัวกรอง".

**Validated:** production build, stand-in search that answers empty under a year filter: before, ≥ 3★ took 4 results
to 0, "2015" sent 4 searches, the empty text blamed spelling; after, no rating filter, one search (`yearFrom=2015`), the
empty state names the filters and its button brings the 4 results back. The #926 search keyboard probe still passes.
tsc 0; eslint identical to main.

---

## #963 Malformed ids and paging values no longer answer 500 (2026-10-22)

**What:** `GET /versions/<not a uuid>` and `/versions/translator/<not a uuid>` turned Postgres 22P02 into a plain
`Error` (500); `/forum/posts?authorUid=<not a uuid>` answered 500; forum and reviews list params went straight into
`.range()` (negative or NaN). `lookupFailure` (#915) moves from `forum/` to `common/` with a small `isInvalidId`;
`getVersion` uses it (an id that cannot exist → 404, other failures → the database-down signal); the translator and
author filters answer an empty list for a non-uuid id; forum and reviews paging go through `queryInt` (#958).

**Validated:** Jest red (8 of 14) → green: `assert-found.spec` (+2 `isInvalidId`), `versions-invalid-id.spec` (3),
`forum-invalid-input.spec` (2), `reviews-paging.spec` (1). Full Backend suite: 106 suites / 1,047 tests pass. eslint
unchanged or lower on every touched file.

---

## #961 MangaDex cache: no cut-short chapter lists, no untagged answers under a tag (2026-10-22)

**What:** `getMangaChapters` paged the feed 500 at a time and `break`-ed on a failed page, then cached whatever it had —
a list missing every chapter past 500 stayed cached for the TTL. `getNewReleases` with a tag it could not resolve
(tag list down, or no such tag) dropped the filter and read/wrote the untagged cache key. Now only a complete chapter list
is cached for the full TTL (a cut-short one is served from the stale copy if there is one, otherwise as is and kept only
60 s — review: so a failing MangaDex is not re-fetched in full on every request), and an unresolved
tag answers 404 when the tag list is known but lacks it, 503 when the list could not be loaded — `/new` shows that as a
failed load with a retry — never the untagged rows.

**Validated:** `mangadex-cache-correctness.spec.ts` red → green: failed second page → partial list returned and cached
60 s only; stale full list preferred; complete list still cached; unresolved tag → 503 / 404 with no untagged cache
read and no `/manga?` fetch. `src/books` + `src/common`: 52 suites / 483 tests pass. eslint unchanged.

---

## #958 Book query params validated; a bad request no longer reports "MangaDex offline" to everyone (2026-10-22)

**What:** `/books/new-releases`, `/books/genre/:slug`, `/books/search` and `/books/:id/related` passed `parseInt(...)`
straight on (`?limit=abc` → NaN; no upper bound on new-releases/genre; negative page/offset), and
`MangaDexService.fetchMangaWithParamsPaged` broadcast any non-2xx MangaDex answer as `mangadex: offline` to every SSE
client — so one client's bad query, answered with a MangaDex 400, put the outage banner in front of every user. New
`common/query-int.queryInt(value, fallback, { min, max })` parses and clamps each param; a 4xx other than 429 is logged
as our own rejected request and no longer broadcast — only 400 and 404, after review: 403 (blocked), 429, 5xx and
network errors still are. Also from review: the reported `total` is capped at the 10,000 results MangaDex can page to.

**Validated:** Jest red → green: `query-int.spec.ts` (5), `mangadex-status-4xx.spec.ts` (5: 400 no broadcast; 403, 429,
503 still "offline"; total capped), `books-query-params.spec.ts` (4: junk → defaults, clamps, never NaN). `src/books` + `src/common`: 51
suites / 478 tests pass (with the scratchpad `openai` on NODE_PATH, as the worktree lacks it). tsc: no errors in touched
files (pre-existing spec errors elsewhere). eslint: books.controller 2 → 0 findings, mangadex.service 6 → 5.

---

## #956 The guest login toast is reachable from the popup and can be held (2026-10-22)

**What:** a guest pressing "ถูกใจ" / "เพิ่มในรายการ" / the reviews' sign-in prompt in the book popup gets a toast offering
"เข้าสู่ระบบ", but the popup's Tab trap kept focus inside the popup and the toast's 4 s timer ignored hover and focus.
Now `useDialogFocus` adds a shown toast's controls (`[data-toast-card]`) to the open dialog's Tab cycle and walks that
cycle itself while a toast is up (`cycleTarget`; the dialog stays sealed); the cycle skips controls inside `[inert]`
parts (collapsed groups, closed menus). The toast holds its timer while hovered or focused and resumes with exactly what
was left (the progress bar pauses with it), a new toast under a resting pointer or focus is held at once, a toast with an
action stays at least 8 s (a keyboard user must Tab to it first), and closing it from its own button returns focus to
where it came from (not after its action, which opens the login modal). The toast stays where it was in the DOM (its
live region untouched) and is not a "layer above" for `hasLayerAbove` (`data-toast-layer`); a dialog folds it into its
cycle only when nothing else is layered above it. `AuthContext` untouched.

**Validated:** `useDialogFocus.test.ts` 16 pass (5 new `cycleTarget`, red → green). Production build: before, 40 Tabs
from the popup never reached the toast and a hovered toast was gone after 6 s. A first version (portal + the popup's trap
standing aside) reached it but let focus wander behind the aria-modal popup — replaced after review. After: Tab goes
from the popup's controls to the toast and back into the popup (never the page behind), closing it by keyboard returns
focus into the popup, and a hovered toast outlives its 8 s and leaves after the pointer. The probe also caught the new
cycle sticking on an inert collapsed chapter group, fixed by the `[inert]` filter. Reader-drawer, failed-lists, popup,
chapter-groups, community-drawer and reader-menu probes pass. A second review found two stacked-layer problems, both
reproduced on the previous build then fixed: from a toast raised in the reader's comment drawer (reader over the popup)
Tab went into the popup behind the reader, now it cycles drawer <-> toast only; after the toast's action focus jumped to a
popup button behind the login modal, now it stays off the popup. tsc 0; eslint 0 on the touched files.

---

## #954 Popup reviews: a failed load is not "no reviews yet" (2026-10-22)

**What:** `ReviewSection.fetchPublic` wrote the summary and list only when each response was ok and had no `catch`, so a
failed load showed "ยังไม่มีรีวิว เป็นคนแรกที่รีวิว!" with no retry (the #911 / #930 class). A `reviewsFailed` state (either
response not ok, or the fetch throws) now shows the shared `LoadError` with a retry of `fetchPublic`. The unhandled
rejection a throwing fetch would have caused was not observed — the Next proxy turns a backend failure into a 502.
Review follow-up: both responses are parsed before either is shown, and the stars/count header hides while failed (a
failed reload after a delete kept the old count); a failed summary now also hides a loaded list (accepted).

**Validated:** production build, stand-in reviews endpoints dropping their first connection: before, "ยังไม่มีรีวิว…";
after, "โหลดรีวิวไม่สำเร็จ" + "ลองใหม่", and the retry shows the real (empty) answer; no page errors. tsc 0; eslint 0.

---

## #952 Collapsed chapter-version groups out of the Tab order (2026-10-22)

**What:** in the book popup's `ChapterList`, a chapter with several versions is a collapsible "ตอนที่ N · N เวอร์ชัน"
group; collapsed it was only `grid-template-rows: 0fr` + `overflow-hidden`, so its version rows stayed in the Tab order,
and its toggle had no expanded state. The collapsible part now has an id (`useId`-prefixed: a popup can open over
another, and indexed by position, since user chapter numbers are free text) and is `inert` while collapsed; the toggle
is `type="button"` with `aria-expanded` / `aria-controls`.

**Validated:** production build, stand-in chapter 2 in two versions: before, 2 Tab stops inside the collapsed group and
no `aria-expanded`; after, 0 while collapsed, the toggle reads `false` → `true`, and both rows are reachable once open.
The #923 popup probe still passes. tsc 0; eslint 0 (as on main).

---

## #950 Reader toolbar menus: out of the Tab order while closed, named zoom, Escape closes the menu (2026-10-22)

**What:** the reader's translate dropdown and mobile "เพิ่มเติม" menu were hidden only with `pointer-events-none
opacity-0`, so their items stayed in the Tab order (13 of 18 reader stops invisible at 390 px, 8 of 23 at 1440 px); their
toggles had no expanded state; the mobile zoom −/+ (the only zoom control on mobile) were unnamed; Escape with a menu open
closed the whole reader. Now both panels are `inert` while closed with an id, the toggles carry `aria-expanded` /
`aria-controls`, the zoom buttons are "ย่อ" / "ขยาย" (as on desktop), and the reader's Escape closes an open menu first
(refs, like `commentOpenRef`) and returns focus to its toggle. Review follow-ups: items close their menu through a helper
that refocuses the toggle; keyboard focus leaving an open menu closes it; the Escape ref tracks the visible state.

**Validated:** production build, reader on an uploaded version: before, 13/18 (390 px) and 8/23 (1440 px) invisible stops
and 2 unnamed buttons; after, 0 invisible at both widths (5 and 15 stops), 0 unnamed, each menu opens by keyboard with
its items reachable, and Escape closes only the menu with focus on its toggle; walking out of an open menu closes it; a
view item activated by keyboard leaves focus on the toggle. The #928 drawer probe still passes. tsc
0; eslint identical to main.

---

## #948 Mobile hero popup keeps the book it was opened on (2026-10-22)

**What:** on mobile, the home hero rendered `<BookDetailModal book={book}>` with the live `books[idx]` while autoplay kept
rotating behind it, so within 5 s the open popup's title, cover and chapters became the next hero book while its URL
and the details loaded on open stayed from the first. The popup now opens on a snapshot of the tapped book (`openBook`
state replaces the `mobileDlOpen` flag). Review follow-up (traced, then reproduced): on desktop, rotation remounted
`HeroDetailButton` (`key={book.id}`) and dropped its open popup without the close path (URL `/book/<id>` left behind);
the carousel now skips its tick while `modalStack.anyOpen()` (new).

**Validated:** production build at 390 px: before, the popup opened on "Cover Loads" showed "No Cover At All" 11 s later
with the URL still `/book/cover-ok`; after, it still shows "Cover Loads". Desktop, popup open, pointer leaving the window,
11 s: before gone with the URL left behind, after still open. Rotation resumes once the popup is closed and focus leaves
the hero. `bookModalHistory.test.ts` 14 pass (new `anyOpen`). tsc 0; eslint unchanged (one pre-existing warning).

---

## #946 Community feed: a stale "load more" no longer mixes categories (2026-10-22)

**What:** `/community`'s `loadMore` had no sequence check (#911 guarded only `fetchPosts`), so pressing "โหลดโพสต์เพิ่ม" and
switching category before the answer arrived appended the previous category's posts to the new feed. It now captures
`fetchSeq` and drops its answer (or its error toast) once a newer feed request has started. The icon-only ✕ buttons
clearing the manga and category filters are named ("ล้างตัวกรองมังงะ" / "ล้างตัวกรองหมวด"). Review follow-up (pre-existing):
offset paging repeated a post when posts arrived between pages; `loadMore` now appends only posts not already listed.

**Validated:** production build, stand-in feed answering "load more" after 2 s: before, the announcement feed held the
20 old-category posts; after, only the 20 announcement posts; the category clear button is named; with page 2 starting
one row early, post 19 showed twice before and once after. The #940 drawer probe
still passes. tsc 0; eslint identical to main.

---

## #944 Genre page and /new: page and tab kept in the URL, stale answers ignored (2026-10-22)

**What:** the genre page's and `/new`'s list effects never cancelled, so two quick "next" clicks could leave page 2's books
under a "3" label; the genre page's page lived only in `useState` (a refresh or a back from a book returned to page 1);
`/new` read `?tab=` but never wrote it. Both effects now drop a superseded answer (a cancel flag in the cleanup); the genre
page derives its page from `?page=` (in a `Suspense` boundary, as `/new` already was) and replaces it in place, so
"← ย้อนกลับ" still leaves the genre; `/new` writes its tab with `router.replace`. The genre page replaces through
`lib/inAppBack.replaceUrl` (native `replaceState` carrying only #942's landing mark): `router.replace` dropped that mark,
and a native call carrying Next's own state keys was not synced to `useSearchParams` (both measured). A `?page=` past
the end moves to the last page; `parseInt` handles junk such as `Infinity`.

**Validated:** production build, stand-in backend answering each genre page (page 2 delayed 1.5 s): before, `?page=3`
opened page 1, the race ended with page 2's books under "3", a reload went back to page 1, and `/new` kept no tab; after,
`?page=3` opens page 3, the race ends on page 3's books with `?page=3` in the URL, a reload keeps it, and `/new`'s tab is
written as `?tab=latest` and survives a reload; after paging, the breadcrumb back leaves the genre (`/`); `?page=9999` →
page 4, `?page=Infinity` → page 1. `inAppBack.test.ts` 7 pass (2 new for `replaceUrl`). The #942 back-button probe still
passes. tsc 0; eslint identical to main on the touched files.

---

## #942 Back buttons stay in MangaDock when the page was opened directly (2026-10-22)

**What:** the genre page's "← ย้อนกลับ" and the community post's "ย้อนกลับ" called `router.back()` unconditionally, so a
page opened directly (a shared link in a fresh tab) sent the visitor off the site; `history.length` cannot tell (a fresh
tab already has two entries). New `lib/inAppBack`: on the document's first render `SmoothScrolling` marks that history
entry (`replaceState`, keeping Next's own state) as where the visitor landed; `goBackOr(router, fallback)` pushes the
parent page (`/`, `/community`) on that entry and goes back on every other. (A first version tracked "moved inside the
app" + a same-origin referrer; the review showed it still left the site after browser-back to the landing page and did
nothing in a tab opened by Ctrl-click from MangaDock.)

**Validated:** `inAppBack.test.ts` red → green, 5 tests. Production build, stand-in backend: before, a genre page and a
post opened in a fresh tab went to `about:blank` on back, as did the landing page after a browser-back and a post opened
with a same-origin referrer; after, they land on `/` and `/community`; Next keeps the marker through client navigation
and browser-back; `/search` → genre via the Navbar menu → back still returns to `/search`. tsc 0; eslint 0 on the
touched files.

---

## #940 Community mobile drawer is a real dialog (2026-10-22)

**What:** the community drawer (`app/community/layout.tsx`) was `role="dialog"` + `aria-modal` but, closed, it was only
faded and slid out, so its 8 controls stayed in the Tab order; open, Tab escaped it, focus did not return to the menu
button, and the page behind scrolled; the Navbar's menu button had an English name. Now `useDialogFocus` replaces the
ad-hoc "focus the first control" effect, the drawer is `inert` while closed and holds the shared page scroll lock (#936)
while open, and the button is "เปิดเมนูคอมมูนิตี้" with `aria-haspopup="dialog"`. Found by measurement and the review:
widening past `lg` hid the open drawer and its button but kept the page locked; a `matchMedia` listener closes it.

**Validated:** production build, `/community` at 390 px: before, 8 Tab stops inside the closed drawer, Tab escaped the
open one, the page was not locked, focus did not return; after, 0 stops while closed, focus moves in, 12 Tabs stay
inside, `<html>` is locked while open, Escape closes it with focus on the menu button and the page unlocked; open at
390 then resized to 1280: before `<html>` stayed hidden, after it unlocks and the drawer is inert. The #938
mobile-nav probe still passes. tsc 0; eslint 0 on both files (as on main).

---

## #938 Mobile genre panel: out of the Tab order while closed (2026-10-22)

**What:** on every mobile page the collapsed genre panel above the bottom nav (`max-h-0 opacity-0`) kept its 18 links in
the Tab order, its "หมวดหมู่" toggle had no expanded state, and the open panel could not be closed by Escape or a tap
outside. Mirrors #870's desktop fix: the panel is `inert` while closed, has an id, `role="region"` and a name; the toggle
is `type="button"` with `aria-expanded` / `aria-controls`; `usePopoverDismiss` on the bottom nav closes it on Escape
(focus back to the toggle) or an outside tap.

**Validated:** production build, `/search` at 390 px, Tab walk keyed on elements: before, 37 stops of which 18 invisible
(every genre link); after, 19 stops, 0 invisible; the toggle reads `aria-expanded="false"`, opens to `"true"` with its
links reachable, and Escape closes it with focus on the toggle. tsc 0; eslint 0 on `Navbar.tsx` (as on main).

---

## #936 Page scroll lock shared by the reader and the book popup (2026-10-22)

**What:** closing the reader before passing its CAPTCHA left `body` at `overflow: hidden` (the load effect locked and
then returned early without a cleanup), so the page could not scroll until a reload; closing a reader opened from the
book popup unlocked the page while the popup was still open (each layer wrote `body.style.overflow` directly). New
`lib/scrollLock`: a ref-counted lock where each holder releases once and the page unlocks with the last release; the
reader releases on every exit of its effect, the popup on unmount. Found while verifying: the lock never stopped the
wheel at all — Lenis scrolls the page itself, so a wheel over the popup's backdrop moved the page behind it (300 -> 695
px); `SmoothScrolling` now stops/starts the root Lenis on the lock's changes. The lock sits on `<html>`, so the parked
`LoginModal` / `LinkAccountModal`, which still write `body.style.overflow`, cannot unlock the page under a popup. The
Studio picker is unchanged.

**Validated:** `scrollLock.test.ts` red → green, 5 tests (the last for the lock-change hook). Production build, stand-in backend, the
Cloudflare challenge host blocked (the widget never loads): before, the page stayed `hidden` after closing a
CAPTCHA-gated reader, and was unlocked under the open popup after closing its reader; after, the page scrolls again,
stays locked under the popup, and unlocks when the popup closes; a real wheel over the popup's backdrop no longer moves
the page (before 300 -> 695, after 700 -> 700) and scrolls it again once the popup is closed. The #928 reader probe still
passes. tsc 0; eslint identical to main on the touched files.

---

## #932 Home row cards work by keyboard (2026-10-22)

**What:** on desktop, Tab walked through five invisible controls per `BookRow` card (the hover info panel's buttons and
the expand-cover button, whose `focus-visible:opacity-100` lost to `md:opacity-0`); on mobile the cover was a
`<div onClick>`, so nothing could open a book; `ContinueReadingRow` had the same structure plus an "อ่านต่อ" badge that was
a `<div onClick>`. Both rows now give the cover a real `<button>` overlay named "ดูรายละเอียด <title>" (as the Top 10 cards
are named), open the hover state on keyboard focus with `has-[:focus-visible]` / `group-has-[:focus-visible]` next to each
`hover` variant (a mouse click does not pin it), re-check the panel side on focus, and make the badge a `<button>`.
Review follow-ups: the panel's duplicate "ดูรายละเอียด" leaves the Tab order, the badge is named per book, and focus from
inside a portaled popup no longer runs the card's hover logic.

**Validated:** production build, stand-in rows plus a local reading history, Tab walk measuring each stop inside a row
card after the 300 ms fade: before, 6 stops at effective opacity 0 at 1440 px and no control named after a book at either
width; after, 0 invisible stops, 3 row openers per walk, the "อ่านต่อ" badge reachable, Enter on an opener opens the
popup, at 1440 and 390 px; mouse probe: cover -> popup, expand -> lightbox, badge -> reader at both widths. Screenshot:
the focused card shows its panel and an inset accent ring. tsc 0; eslint identical to main on both files.

---

## #930 Popup discussion and reader comments: a failed load is not "none yet" (2026-10-22)

**What:** the book popup's discussion (`MangaDiscussion`) caught a failed `listPosts`, logged it and said
"ยังไม่มีบทสนทนา"; the reader's comment drawer treated a non-ok answer as no data ("ยังไม่มีความคิดเห็น") and rethrew a
network error from its effect (unhandled rejection). Both now show the shared `LoadError` with a retry, as #911 did for
the public pages: the discussion retries `fetchPosts`, the drawer an attempt counter in its load effect, and the drawer
no longer rethrows. "None yet" stays for a real, successful empty answer. Review follow-up: a post that succeeds while
the list shows the failure reloads the list (it stayed hidden behind the error); closing the drawer resets the failure.

**Validated:** production build, stand-in backend failing the first request of each list with 503: before, both said
"ยังไม่มี…"; after, "โหลดบทสนทนาไม่สำเร็จ" / "โหลดความคิดเห็นไม่สำเร็จ" with "ลองใหม่", and the retry shows the real answer
(the empty discussion; the 30 comments), 0 page errors; the #928 drawer probe still passes. The post-while-failed reload
needs a signed-in user and was not exercised in a browser. tsc 0; eslint 0 on both files (as on main).

---

## #928 Reader comment drawer: typing, Escape and focus (2026-10-22)

**What:** in the reader, ←/→ turned the page while the cursor was in the comment box (the window `keydown` handler never
looked at the target), and the drawer then reloaded another page's comments; Escape inside the drawer closed the whole
reader; the drawer was no dialog — no role/name, focus stayed behind, its controls stayed in the Tab order while closed
off-screen, and its ✕ / 🗑 buttons had no name. Now: `lib/typingTarget.isTypingTarget` (input/textarea/select/editable)
gates the reader's page keys; Escape closes the drawer first (`commentOpenRef`, like the chapter picker); the drawer is
`role="dialog"` + `aria-modal`, named by its heading, uses `useDialogFocus` (the reader's Tab trap stands aside while it is
open) and is `inert` while closed; the icon buttons are named. Scrutinize follow-ups in the same PR: page arrows are off
while the drawer is open (not only in text fields) and zoom shortcuts keep working in a text field; the drawer takes the
reader's "nothing over me" check, so a guest's login toast is reachable by Tab; the wheel is left to the open drawer
(the reader no longer zooms, and its list has `data-lenis-prevent` like the reader's own scroller).

**Validated:** `typingTarget.test.ts` red (module missing) → green, 4 tests. Production build, stand-in backend, reader
opened on an uploaded version (no CAPTCHA) from a continue-reading button: before — arrows in a text field moved 2/3 →
3/3, the closed drawer had 2 Tab stops, no dialog, Escape closed the reader; after — arrows in the text field leave 2/3
(outside one they still turn the page), 0 Tab stops in the closed drawer, the open drawer is a named dialog holding focus
and Tab, Escape closes only the drawer and focus returns to its button. The comment box itself needs a signed-in reader,
so the probe uses a stand-in textarea inside the reader (the bug lives in the reader's key handler). Review follow-ups,
red on the first commit -> green: arrows with focus on the open drawer keep the page; the login toast's "เข้าสู่ระบบ" is
reached by Tab (never activated); a wheel starting in the drawer's list is no longer cancelled. A real mouse wheel could
not be tested here: the reader's CAPTCHA gate (z-400) still covers this uploaded-version path and was left alone. tsc 0;
eslint identical to main on both files.

---

## #926 Search results open by keyboard (2026-10-22)

**What:** `SearchResultCard` was a `<div onClick>` with no control for the book itself, so Tab passed every result
(reaching only the hover-only "ดูหน้าปกขนาดใหญ่" buttons) and a screen reader found nothing named after the book.
`MangaGrid` fixed the same thing in #838; the search card now mirrors it: the title is a `<button type="button">`
(stops propagation) and the card's click stays the mouse target. No visual change. Review nit applied here: the
expand-cover button (search and `MangaGrid`) is `type="button"` and named per book ("ดูหน้าปกขนาดใหญ่: <title>").

**Validated:** production build, stand-in results: before, a Tab walk from the search box never focused a result; after,
it reaches "Cover Loads" by its title, Enter opens one popup, Escape closes it, and a mouse click on the cover still opens
exactly one. The focused title shows the app's 2 px accent outline (screenshot). tsc 0; eslint unchanged (2 pre-existing
`as any` errors in the file).

---

## #923 The book popup shows a placeholder when a cover fails to load (2026-10-22)

**What:** after #921 the cards showed a placeholder, but opening one showed `BookDetailModal` with two broken images (the
blurred background and the cover) — it rendered `selectedCover ?? resolvedThumbnail(book)` with no `onError`, so it
never even tried the proxy fallback. It now uses #921's `useCoverSrc(book)`: a picked alternative cover still wins (its
error does not advance the book's sources); when every source fails both covers show `CoverPlaceholder` and the blurred
background is left out. Scrutinize follow-ups in the same PR: a picked alternative cover that fails returns to the book's
own cover, and an alternative-cover tile that fails shows a placeholder and can no longer be picked or enlarged.

**Validated:** production build, stand-in backend with four books, popup opened from `/search` at 1440 and 390 px:
before the fix 6 of 8 checks failed (2 broken images each, the fallback book included); after, 8/8 — 0 broken images, the
working and fallback covers load, the two dead ones show the placeholder found by `getByRole('img', { name })`. Alternative
covers (stand-in: volume 1 loads, 2 dead, 3 serves once): before the follow-up, tile 2 was a broken image and picking 3
left three broken images; after, 0 broken — tile 2 is a disabled placeholder, picking 1 shows it, picking 3 falls back to
the book's own cover and disables tile 3. tsc 0; eslint unchanged from main (3 pre-existing findings in the file).

---

## #921 A cover that fails to load shows a placeholder, not a broken image (2026-10-22)

**What:** six cover cards (search, `MangaGrid`, `BookRow`, `TopTenCard`, `RelatedManga`, `ContinueReadingRow`) and the
home hero each had their own one-shot fallback; when the fallback also failed — or there was no cover at all — the browser
drew its broken-image icon (search used an external `placehold.co` "No Cover" image instead). `coverSources(book)`
(`lib/imgUrl`) lists every source a card may try, in order and without repeats; `useCoverSrc(book)` steps to the next one
on each error and returns `null` when none is left, keyed on the sources so a reused card (the hero rotating) restarts.
Cards then show `CoverPlaceholder` (book glyph + title on the surface tokens), named like the image was — `role="img"`
`aria-label={title}`, or `decorative` where the image had `alt=""` (on mobile BookRow/ContinueReading have no other
visible name); the hero keeps its existing quiet gradient.
The expand-cover button and lightbox are hidden when there is no cover. Removes `placehold.co`, a DOM `src` mutation, the
hero's set-state-in-effect (an eslint error on main) and `MangaGrid`'s private `cdnFallback`.

**Validated:** `imgUrl.test.ts` 16 pass (4 new for `coverSources`). Production build against a stand-in backend with four
books — cover loads / local copy 404 then proxy works / every source 404 / no cover: on `/search`, `/categories/action`,
`/new` and `/` at 1440 and 390 px, 0 broken `<img>`, the working cover loads, the two dead books show the placeholder, and
0 requests to placehold.co. The fallback book loads from `/api/img-proxy` on every page; on `/` at 390 px it is off-screen
in a lazy row and loads once scrolled into view; the dead cover is a named `img` in the accessibility tree on every page.
tsc 0; eslint: no new findings (HeroCarousel goes from 1 error to 0). Scrutinize: one should-fix (the placeholder was
`aria-hidden`, leaving mobile row cards unnamed) fixed in this PR; stale-error, mutation and proxy paths checked OK.

---

## #919 A direct /book link: "book not found" only for a real 404 (2026-10-22)

**What:** `BookRouteModal` (direct `/book/<id>` visits) turned every failure into "ไม่พบข้อมูลหนังสือ", because
`loadMangaDetail` threw the same error for a 404 and a 500; the overlay was also not a dialog (no role, no focus, no Escape).
`loadMangaDetail` now throws `HttpError(status)` (#913's `lib/httpError`); the modal has a third state, "failed", shown as the
shared `LoadError` with a retry; "missing" stays for a 404 or an unusable detail. Both overlays are a small `NoticeDialog`
— `role="dialog"`, `aria-modal`, focus on the first button, Escape and the scrim close it, like the loading skeleton.

**Validated:** `mangaDetail.test.ts` red → green (404 → isNotFound, 503 → not). Production build, direct link: backend down
→ dialog "โหลดหนังสือไม่สำเร็จ", focus on "ลองใหม่"; a stand-in answering 404 → "ไม่พบข้อมูลหนังสือ", focus on "← กลับหน้าแรก";
the real backend → the book popup; Escape closes each back to "/". Start the backend, press Enter on the focused "ลองใหม่"
→ the book popup opens. tsc 0; eslint 0 on both files.

**Review round:** the dialogs declared `aria-modal` but Tab walked into the page behind — `NoticeDialog` and the loading
skeleton now use the app's `useDialogFocus` (#837); the failed dialog no longer nests `LoadError`'s card or repeats its label
as an alert (`LoadError framed={false}`); the comment now says a 200 of the wrong shape is "failed" (with a retry), not
"missing". Re-verified: down → focus "ลองใหม่", 6 Tabs stay inside (ลองใหม่ ⇄ กลับหน้าแรก), Escape → "/", no alert inside the
dialog, a single card (screenshot); 404 → focus and Tab stay on "← กลับหน้าแรก".

---

## #915 Forum lookups: 404 only for a missing row, 503 for a database failure (2026-10-22)

**What:** `ForumService` turned any Supabase error on its six single-row lookups (post, profile, post/comment edit and
delete) into `NotFoundException`, so an outage read as "not found" — to users, and to the frontend, which since #913
trusts a 404. `forum/assert-found.ts` `lookupFailure(error, message): never` throws a 404 only when there is no row, or
Supabase's no-rows code `PGRST116`, or `22P02` (an id that is not a uuid cannot exist); any other error is a 503
"Database unavailable". Returning `never` lets each site keep its `if (error || !row)` shape with `row` narrowed after it.

**Validated:** `assert-found.spec.ts` red → green (5); `src/forum` jest 72 pass; eslint count on `forum.service.ts` = main's.
Live, built backend: with `SUPABASE_URL` pointed at a dead port → post, not-a-uuid and profile all **503** (were 404);
against the real Supabase → unknown uuid 404, `not-a-uuid` 404, an existing post 200, unknown profile 404. (Run with the
main checkout's `node_modules` junctioned and `openai` from an isolated scratch install — D: had 0.3 GB free.)

**Review round:** the hand-made 503 discarded the Postgres error (the filter logged only "Database unavailable"), and it
carried code `INTERNAL_ERROR`, so the frontend's Supabase-down toast (keyed on `SUPABASE_OFFLINE`) never fired. Any other
error is now a plain `Error("Supabase lookup failed (<code>): <message>")`, which `AllExceptionsFilter` already maps to its
database-down signal — 503, code `SUPABASE_OFFLINE` — and logs as CRITICAL with the cause; the spec runs the thrown error
through the real filter. Live: dead `SUPABASE_URL` → 503 `SUPABASE_CONNECTION_ERROR`, log "Supabase lookup failed (no code):
TypeError: fetch failed". `src/forum` 73 pass.

---

## #913 Community detail pages: "not found" only for a real 404 (2026-10-22)

**What:** with the backend down, `/community/p/[id]` said "ไม่พบข้อมูลกระทู้", `/community/profile/[uid]` "ไม่พบโปรไฟล์" and
`/community/manga/[mangaId]` "ยังไม่มีโพสต์ในชุมชนนี้" — claims about the data that nothing checked. `lib/httpError.ts`
(`HttpError(status)`, `isNotFound`) lets `getPost` / `getProfile` carry the status; each page shows "not found" only for a
404, the genuine empty state only for an empty list, and the shared `LoadError` (#911) with a retry otherwise. The post
page's tab-return check now reads the status from the error instead of a second fetch; the profile clears the previous
profile when `uid` changes (a failed load used to leave the old profile under the new URL); both pages' error and
not-found states carry an `h1`.

**Validated:** `httpError.test.ts` red → green (4). Production build: backend not running → all three show the load error
(post/profile with "โหลด…ไม่สำเร็จ" headings); a stand-in backend answering real 404s and an empty manga list → "ไม่พบข้อมูลกระทู้",
"ไม่พบโปรไฟล์" and "ยังไม่มีโพสต์ในชุมชนนี้". tsc 0; eslint 0 on the touched files (as main); `bun test` 440 pass.

**Review round:** the manga header still said "0 โพสต์" on a failed load — no count then; a post created after a failed
load hid behind the error — creating clears the failed state; the title skeleton kept pulsing — the failure path fetches the
manga's title on its own; with `Promise.all` a 500 from the comments could beat the post's 404 and turn "not found" into
"failed" — the post's own result decides now (both still start together). Re-verified: down/404/empty matrix unchanged; no
post count on failure; stand-in with post 404 + comments 500 → "ไม่พบข้อมูลกระทู้". The backend maps every Supabase error on
these two lookups to a 404 — filed separately.

---

## #911 A failed load says so, with a retry — never "no results" (2026-10-22)

**What:** with the backend down, `/search` said "ไม่พบหนังสือที่ตรงกับ …", `/community` "ยังไม่มีโพสต์ในหมวดหมู่นี้" and
`/community/trending` "ยังไม่มีมังงะที่กำลังเป็นที่นิยม" — a failed request shown as an empty result — while `/new` and
`/categories/[genre]` said they could not load but offered no retry. `components/ui/LoadError` (promoted from
`StudioLoadError`, #828 — now a thin wrapper with the Studio mascot) shows the sleeping mascot, "โหลด…ไม่สำเร็จ" and a
"ลองใหม่" with a busy state (`role="alert"`); each page keeps an explicit failed state and re-runs its own fetch. Found on the
way: search parsed error bodies as results (`r.json()` without `r.ok`) and would cache them 5 min; the community feed kept
the previous category's posts after a failed switch; its failure toasts duplicated the inline state (dropped for the initial
load); `/new` kept all four tab panels mounted at `opacity-0`, so screen readers read every grid and Tab walked through
invisible books — hidden panels are `inert` (pagination state survives).

**Validated:** production build, backend not running: all five pages show the load error, none shows an empty-result
message. Then a stand-in backend on :4001 (books for search/genre/new-releases, genuinely empty forum + trending) and
"ลองใหม่": search and categories show the books, community and trending show their real empty states, `/new`'s active tab
shows the books; a tab that failed earlier shows its own error and recovers on its retry. tsc 0; eslint per file = main's;
`bun test` 436 pass.

**Review round:** a failed search followed by an empty query kept the error next to the start prompt — cleared in the
empty-query branch; a failed community switch kept the old `total`, so "โหลดโพสต์เพิ่ม" sat next to the error and loaded
into a page still marked failed — `total` reset too; only the latest feed request may write (a slow answer for the previous
category used to only toast, now it would have wiped the new one); an optimistic new post clears the failed state; trending
resets its failed flag before the cache check. Re-verified: failed search → clear query → no alert, prompt shown; failed
community load → no load-more button; the five-page down/retry check unchanged.

---

## #909 Home is never blank when the backend is down (2026-10-22)

**What:** with the backend unreachable the home page was blank below the Navbar. Measured: `<main>` started at y = 0, and the
only explanation — `HomeStatusLine`'s "CAUTION · ไม่สามารถเชื่อมต่อ backend ได้…" — rendered at y = 0, under the fixed 65 px
Navbar (`elementFromPoint` hit the header): the hero normally owns the top offset and there is no hero without landing data.
`HomeCachedLanding` then rendered an empty `<section>` when the browser had nothing cached. Now: with no hero the content takes
the `page-shell-nav` offset (`pt-22 md:pt-28`); the no-cache branch shows the sleeping error mascot, "ยังโหลดรายการมังงะไม่ได้"
and "ลองใหม่" (`router.refresh()` in a transition — `/` is dynamic and a failed fetch is not data-cached, so it really
re-fetches); the status line sits on the content edge instead of a centred `max-w-5xl` box (it started 164 px right of the
rows at 1440).

**Validated:** production build, backend not running, 1440 and 390: status line at y 112 / 88 (header bottom 65) and
hit-test visible; empty state and retry visible; "ลองใหม่" issues an RSC refetch and shows "กำลังโหลด…" while it runs;
status line left edge = card left edge (48 / 24). Not exercised: home with the backend up (no backend here) — the offset class
applies only when there is no hero. tsc 0; eslint warnings = main's (1 + 1).

**Review round:** (1) a successful "ลองใหม่" left the old "backend down" line under the restored hero — `router.refresh()`
keeps `HomeStatusLine` mounted and its initial state is read once; it is now keyed on the server's verdict. (2) First paint
showed "can't load" to users who do have cached books (initial `[]`) — `null` until the cache is read. (3) Backend up but no
rows was still blank — the empty state now shows whenever there is no data. The status-line move also applies to the
"MangaDex stale" line above real rows (now on the content edge — an intended change, not "unchanged").
Verified with a stand-in backend on :4001 serving one landing payload: SSR HTML has no empty-state text (no flash); backend
down → CAUTION + empty state; start the stand-in, press "ลองใหม่" → hero and "ยอดนิยม" row, CAUTION and empty state gone; stand-in
with no rows (fresh server — Next keeps a 200 landing in its data cache, in memory as well as on disk) → empty state + retry.

---

## #907 Save, check-in and review messages are announced (2026-10-22)

**What:** status messages rendered as plain `<div>`/`<p>` (WCAG 4.1.3) — a screen-reader user pressing Save / Check in /
Submit heard nothing. Settings → profile success/error, the daily check-in error and the review submit error now sit in
always-mounted `role="status"` / `role="alert"` containers that are filled when there is a message (a region inserted together
with its text is not announced reliably). Unstyled wrappers: 0 px when empty, so layout is unchanged. `PasswordTab` and
`AccountsTab` have the same pattern but are in the auth boundary — parked with the auth-flow files (#776).

**Validated:** production build, signed in (local session), Settings → profile: before Save both regions exist, empty,
0 px tall; Save → the status region receives "อัปเดตชื่อผู้ใช้สำเร็จ ✓" (MutationObserver on live regions). The check-in
modal and the review form were not triggered (both need the backend, not running locally) — same wrapper, checked by
reading. tsc 0; eslint 0 on the three files.

**Review round:** no double announcement (none of the three calls the toast), regions exist before any text, no parked file
touched. ProfileTab returns a fragment, so its two regions became two children of the page's `space-y-5` — grouped in one
wrapper. Measured: no message → wrapper 0 px and the gap above the form stays one 20 px step; with a message → 20 px from
the box to the form.

---

## #874 Studio and community custom selects work by keyboard (2026-10-21)

**What:** `StudioSelect` (Studio upload/works/wallet/account), `CountrySelect` (Studio account) and `MangaSearchSelector`
(community composer tag picker) closed only on an outside mouse click and exposed no state. They now use
`usePopoverDismiss` from #870 (Escape closes, focus back to the trigger; Escape inside a dialog stays the dialog's), carry
`aria-expanded` + `aria-controls` (the two search inputs as `role="combobox"` + `aria-autocomplete="list"`), mark the chosen
option `aria-current`, and keep a closing panel `inert`. Found on the way: choosing an option unmounted the focused button and
dropped focus to `<body>` — focus now goes to the trigger (selects) or to the chip's new "เอาแท็ก … ออก" button / back to the
input (tag picker). The two inputs open on click, typing or ArrowDown instead of on focus, so returning focus to them does not
reopen the list. The tag picker's label is linked to its input and its clear button is named.

**Validated:** production build, signed in (local session; tag-search results stubbed, backend not running), keyboard
only: Studio language select and country combobox — focus alone keeps them closed, Enter/ArrowDown opens, Tab enters the
list, Escape closes with focus on the trigger, choosing leaves focus on the trigger showing the choice, reopening marks it
`aria-current`, mouse open/outside-close unchanged; tag picker — typing opens, Escape closes the list but not the composer,
choose → focus on "เอาแท็ก One Piece ออก", clear → focus on the input. tsc 0; eslint 0 on all three (as main); `bun test`
436 pass. TDD n-a: wiring of the hook tested in #870; no logic of its own.

**Review round:** returning focus to the country input after *any* choice would raise a phone's soft keyboard after a tap
— it now refocuses only on a keyboard choice. "Focus is in the list" did not tell them apart (a click focuses the option
button too, measured: mouse choice still refocused), so the signal is `:focus-visible` on the chosen option; re-measured:
mouse choice → focus stays where the click left it (as before #874), keyboard choice → input. The tag picker's open
condition is derived once (`expanded`) instead of pasted into the attribute and the render; the "ประเทศ" label names the
country combobox (`id` prop); comments corrected (the panel turns inert while fading, it does not unmount). An earlier
probe ran against a stale server from the previous session still holding port 4000 — caught by its start time and redone.

---

## #870 Navbar popovers close by keyboard (2026-10-21)

**What:** the categories menu (`Navbar`), notifications (`NotificationBell`) and user menu (`NavbarActions`) closed only on an
outside mouse click — Escape left the categories menu open with focus inside it — and the bell and user-menu triggers had no
`aria-expanded`. `hooks/popoverDismiss.ts` (`usePopoverDismiss`) replaces the three copied outside-click effects: outside
mousedown closes; Escape closes and, if focus was inside, returns it to the trigger (`[aria-expanded]` in the container).
Bell and user-menu triggers get `aria-haspopup` + `aria-expanded`. The user-menu trigger keeps its visible name (photo alt +
display name) — no `aria-label`, which would hide the visible text (WCAG 2.5.3).

**Validated:** `popoverDismiss.test.ts` red → green (4). Production build, signed in (local session), 1440: each popover
opens with Enter (`aria-expanded=true`), Escape closes it with focus back on its trigger (the bell's panel had no focusable
items, so Tab had already left and focus was not pulled back), a mouse click opens and an outside click closes. tsc 0;
eslint counts on the three components equal main's (net −17 lines).

**Review round:** the panels are disclosures, not ARIA menus (no `menuitem`s, no arrow keys), so `aria-haspopup` would
have announced menu keyboarding that does not exist — replaced by `aria-controls` → panel ids, as the categories button
already did. Escape is left to a dialog opened over a lingering popover (focus inside `[role=dialog]`/`[aria-modal]`), so one
key closes one layer. Closed panels were only faded (`opacity-0`), so Tab walked into invisible items — each panel is
`inert` while closed. Re-verified: Tab after Escape goes to the next header control (categories → "ค้นหา"), not into the
closed panel; open panels still Tab-reachable; mouse open/outside-close unchanged. Tests 5 pass.

---

## #865 A failed landing row no longer sits empty for 20 minutes (2026-10-21)

**What:** a landing row whose MangaDex call failed (now including the 6 s timeout from #861) comes back as an empty row —
`fetchMangaWithParamsPaged` swallows the error — so the landing cached that empty row for the full `CACHE_TTL_MS`. Now an
empty row is the failure signal: it is filled from the stale landing's row with the same id, and a partial landing is
cached for `PARTIAL_LANDING_TTL_MS` (2 min) so the next request re-fetches it. A complete landing still gets the full TTL;
all-empty still goes to `serveStale` as before.

**Validated:** `landing.service.spec.ts` red → green (partial: fresh row kept, failed row filled from stale, TTL < 5 min;
complete: TTL ≥ 20 min). `src/books` jest 339 pass; eslint 0 (as main). Rebuilt backend: landing 200 (4 rows × 20) — served
from cache, so the miss path is covered by the specs only; the landing cache was deliberately not wiped (its stale copy is
the fallback this relies on).

**Review round:** the cache-hit thumbnail patch rewrote the landing with the full TTL, undoing the 2-min retry whenever the
image cache is on — partial landings now carry `partial: true` and both writes use `landingTtl()` (spec drives the patch
path with an enabled image cache stub). The filled rows are logged by id; the comment states the "empty means failed"
coupling (sound while every row is an unfiltered sort); with no stale copy an empty row is still cached briefly. Serial
MangaDex chains (getRelated ≈ 3 × 6 s) split out to their own issue. `src/books` 340 pass.

---

## #856 Skip link past the Navbar (2026-10-21)

**What:** no page had a way past the Navbar for keyboard users (WCAG 2.4.1). `components/SkipLink.tsx` renders
"ข้ามไปเนื้อหาหลัก" as the first focusable element (root layout): parked above the viewport until focused, then a solid ink
pill top-left; activating it focuses the page's `<main>` (`focusMain`: `tabindex="-1"` if it has none, so it is not an extra
Tab stop) without adding `#main` to the URL. Every `<main>` (12, one per route) carries `id="main"`, so the href is a real
target — axe only treats an in-page link as a skip link when its target exists (otherwise `region` flagged it on every page).
`sr-only`/`focus:not-sr-only` was tried first: Tailwind v4's `not-sr-only` sets `padding: 0`, which left a cramped label over
the logo (screenshot) — replaced by the translate pattern.

**Validated:** `SkipLink.test.ts` red → green (3). Production build, keyboard only, 1440 and 390: on `/`, `/new`,
`/community` the first Tab shows the link (134×42 at 16,16), Enter puts focus on `<main>`, the next Tab reaches the first
control in the content (e.g. "อ่านเลย", "มังงะมาใหม่"), not the Navbar; `/search` autofocuses its input, so Tab already starts
in the content. axe structure sweep 10 routes × 2 widths → 0; signed-in sweep (27) → only `color-contrast`. tsc 0.

**Review round:** (1) focusing `<main>` by script after an Enter keypress matches `:focus-visible`, so the global ring drew a
2 px accent outline around the whole page (computed style confirmed) — `main[tabindex="-1"]:focus-visible { outline: none }`
in the same `@layer base`; the link and the next control keep their rings. (2) `/docs` had no `id="main"` and
SimulationsView nested a `<main>` inside the docs `<main>` — both docs `<main>`s (alternate branches) get the id, the nested
one is a `<div>`. Re-verified: /new and /docs — link ringed, `<main>` focused with no outline, next Tab ringed inside
`<main>`; axe structure 11 routes (incl. /docs) × 2 widths → 0.

---

## #861 MangaDex fetches time out (2026-10-21)

**What:** every MangaDex call goes through `MangaDexService.mangadexFetch`, which had no `signal` — a hung request held the
caller (e.g. `/books/landing` on a cold cache) for as long as the connection lived. It now passes
`AbortSignal.timeout(mangadexTimeoutMs)` (6 s, below the frontend's 8 s server-render budget from #858; overridable in
tests like `fetchFn`), so a hung request rejects into the callers' existing error handling — every one of the 9 call sites
is inside a try/catch returning empty/stale/null, none escapes as a 500. All are JSON API calls (manga, feed, cover, tag,
at-home server) — no image bytes. Not a stale-cache fallback for landing: a timed-out row becomes an empty row (as any
MangaDex error already did) and is cached for the landing TTL — follow-up filed, with the serial-call budgets (getRelated
≈ 3 × 6 s).

**Validated:** `mangadex-fetch-timeout.spec.ts` red → green (3: a never-answering MangaDex rejects in < 1 s at a 30 ms
timeout; headers and `no-store` kept; default < 8 s). `src/books` jest: 337 pass, 0 fail. Rebuilt backend live: landing
200 (4 rows / 80 items), chapters 200 (48), an uncached genre page fetched fresh from MangaDex in 182 ms. Found on the way:
an uncached search still hangs 30 s — traced to `findTitleIdsByAltName`, a Supabase query, not MangaDex (filed
separately; it touches the client the auth guard uses).

---

## #858 Server renders stop waiting on a hung backend (2026-10-21)

**What:** `/book/[id]/reviews` is server-rendered and awaited two backend calls with no timeout; with the backend's upstream
hung, the page did not render within 120 s. `lib/reviewsFetch.ts` (moved out of the page, `fetch` injectable) passes
`AbortSignal.timeout(SERVER_FETCH_TIMEOUT_MS)` (8 s, `lib/serverFetch.ts`), so a hung backend lands in the existing
"no reviews" fallback. The home page's landing fetch gets the same signal, landing in its cached-landing fallback on a cold
cache. The two API routes (`img-proxy`, `docs/github`) are not page renders and are left as they are.

**Validated:** `reviewsFetch.test.ts` red → green (hanging fetch → fallback in < 1 s at a 50 ms timeout; healthy backend →
both URLs and parsed results). Production build, with the backend's `/reviews/:id/summary` still not answering in 10 s: the
reviews page returns 200 in 8.06 s with the empty state and title "รีวิว · MangaDock"; direct reviews → /new → Back keeps
"รีวิว · MangaDock" (the #855 path its review raised); home 200. tsc 0; eslint on touched files: the one warning is on main.

**Review round:** Next 16.1.6 decides fetch cacheability from `cache`/`revalidate`/method only — `signal` neither
disables the data cache nor enters the key (`next/dist/server/lib/patch-fetch.js:331-358`), so home keeps its 1800 s ISR
cache. Dropped an `as RequestInit` cast (Next types `next` on the global `RequestInit`); the module owns the backend
default; the test asserts both calls carry the signal and `revalidate: 60`. Re-measured: reviews page 200 in 8.03 s. The
root cause on a cold home load — the backend's MangaDex calls have no timeout — is filed as a backend follow-up.

---

## #855 Every page names itself in the tab (2026-10-21)

**What:** all routes shared the root title "MangaDock by Hayate | Manga Streaming Platform" (WCAG 2.4.2). Almost every
route is a client component under a client layout, so `hooks/pageTitle.ts` adds `usePageTitle(title)` →
`"<title> · MangaDock"`: list pages by their heading, dynamic ones by the loaded name (search query, category, post, manga
community, the book popup), Settings/Studio/Admin by the active tab in their layout, the 404 and error page via
`<PageTitle>`. The titles live on a small stack (newest on top, root when empty) because React unmounts a parent's effects
before its child's — "restore what I replaced" left a page's title stuck after navigating away with the popup open. Next
re-commits its metadata `<title>` text after hydration (traced: our write at ~115 ms reverted with no element added), so
while a page claims the title a `MutationObserver` on `<head>` puts it back.

**Validated:** `pageTitle.test.ts` red → green (6, incl. parent-first unmount). Production build: direct loads of 10 public
routes and 14 signed-in routes (local session) each show their own title; home and pages without a hook show the root title;
client navigation /new → popup → Escape → back → /community → / gives the expected title at every step. tsc 0; eslint
counts on touched files equal main's; `bun test` 425 pass.

**Review round:** (1) a spike of React 19's hoisted `<title>` (one element instead of the stack and observer) failed on a
production build: on a direct load Next adds a second copy of its root title ahead of ours after hydration, and on client
navigation `<title>` elements pile up (up to four) with the winner depending on commit order — kept the stack. (2) The
stack's root is now the constant `SITE_TITLE` (shared with the layout metadata) instead of the title found at the first
claim, which wrote a stale root after landing on a metadata-titled page; every route but home claims a title, so "nothing
claimed" means home. (3) Added: community profile (loaded name), `/book/[id]/reviews` ("รีวิว", metadata unified to
" · MangaDock"); Studio uses `studioPageTitle` so upload/search/manga are distinct. Verified again: 10 public routes,
Studio 5 routes (upload now "อัปโหลด"), navigation sequence unchanged. Not verified: the reviews page — its server render
waits on a backend call with no timeout and hung for 120 s (filed separately).

---

## #852 JS smooth scrolling honours reduced motion (2026-10-21)

**What:** `scroll-behavior: auto` in globals.css cannot override an explicit `behavior: "smooth"` passed from JS. All 27 call
sites outside `app/docs` (pagers, row arrows, popup/reader jumps, Navbar strip, `useHorizontalScroll`) now pass
`scrollBehavior()` (`hooks/reducedMotion.ts`: `"auto"` under reduced motion, else `"smooth"`), and the reader's held-arrow
`lenis.scrollTo` gets `immediate` under reduced motion so it follows the key without a glide.

**Validated:** `reducedMotion.test.ts` red → green (5). Production build, headless Chromium 1440, sampled every 40 ms:
`scrollBy` (home row arrow) reduced 1008 at once vs default 0 → 2 → 53 → 285 → 617 → 1008; `window.scrollTo` (`/new` pager)
reduced 0 at once vs default 1480 → 1432 → 1136 → 819 → 0. Not measured: `scrollIntoView` (popup chapter jump stayed
disabled — chapters did not load from the backend in the reduced run) and the reader's held arrow (needs a loaded chapter);
both go through the same helper; a second attempt at the reader also failed because the backend's
`/versions/title/*` upstream timed out (25 s), so the popup never offered a read button. Review: lenis 1.3.18 `scrollTo` with
`immediate` sets target = animated scroll (no lerp), traced in `node_modules/lenis/dist/lenis.mjs`; `prefersReducedMotion()`
reads the module's cached query (no new MediaQueryList per call, so the reader checks it per frame and follows a
mid-chapter change). tsc 0; eslint counts on the 11 touched files equal main's; `bun test` 419 pass.

---

## #849 Reduced motion reaches JS motion; the hero can be paused (2026-10-21)

**What:** the CSS reduced-motion rule cannot reach motion driven from JS. `hooks/reducedMotion.ts` adds `useReducedMotion()`
(`useSyncExternalStore` over the media query, injectable like `pageVisibility.ts`). Lenis — the root instance and every
`useLocalLenis` panel — scrolls natively under reduced motion. The hero, which rotated every 5 s forever and paused only
under a hovering mouse (WCAG 2.2.2), has a 24 px pause/play button after its dots, holds while keyboard focus is inside it,
and starts paused under reduced motion (`heroAutoplay`: the user's choice wins, otherwise the preference decides).

**Validated:** `reducedMotion.test.ts` red → green (4). Production build, headless Chromium 1440: reduced motion → hero
still after 6.5 s, button reads "เล่นอัตโนมัติ"; no preference → advances in 6.5 s, pause holds 11 s, play resumes, focus on a
dot holds 11 s, leaving resumes. One wheel tick of 400: reduced → page 0 → 400 at once, popup scroller 0 → 400 at once;
no preference → eased (31 → 132 → 205 …, popup 59 → 152 → 220 …). Toggle 24 × 24 at 390 and 1440, focus ring whole.
tsc 0; eslint counts on touched files equal main's; `bun test` 418 pass (the 9 local `app/docs` SSR failures unchanged).

**Review round:** (1) the community sidebar is its own `<ReactLenis>` (`community/layout.tsx`), missed by the first pass —
now `smoothWheel: !reducedMotion` (wheel 300: reduced 0 → 168 at once; default 13 → 55 → 86 …). (2) A click focuses the
button, so the focus hold now takes keyboard focus only (`:focus-visible`), and Play clears it. (3) Found while verifying,
proved by reading the hooks off the React fiber: Play left the **hover** hold stuck — the click swaps the Pause svg for Play
under the pointer, and a hovered node that leaves the DOM stops React's `onMouseLeave` reaching the hero. Icons are
`pointer-events-none`; after Play + move away the hold is false and rotation resumes in 6.5 s with focus still on the button.
Follow-up: JS `behavior: "smooth"` scroll calls and the reader's eased `lenis.scrollTo` are a separate issue.

---

## #848 Hero carousel dots are real tap targets (2026-10-21)

**What:** axe `target-size` (WCAG 2.2 AA) over 10 public routes at 390 px failed only on the hero carousel dots: 8 × 8 px
buttons 14 px apart. Each dot is now a 24 × 24 px button with the 8 px dot drawn inside; the liquid pill measures the inner
dot, and the row's margins absorb the taller buttons so nothing moves. Dot pitch is 24 px (was 14) — the one visible change.

**Validated:** production build, before/after measured in headless Chromium: dot top unchanged (390: 593 px, 1440: 554 px),
desktop first dot still flush with the "อ่านเลย" button (left 560 px); buttons 24 × 24; after tapping dot 4 the pill sits
exactly on it (left 155 = dot 155 at 390; 632 = 632 at 1440); keyboard focus ring is a circle around the dot. Review found
the desktop info column's `overflow-hidden` clipped the left 8 px of dot 1 (hit test and ring); the column's clip box now
reaches 8 px further left (`-ml-2 pl-2`) — dot 1 hit-tests across all 24 px, title still at left 560. axe
`target-size` → 0 nodes on all 10 routes (was 10 nodes on `/` and `/book/[id]`). tsc 0.

---

## #846 Named controls and landmarks in Studio, Settings, Admin and the post page (2026-10-21)

**What:** an axe sweep of the signed-in routes (Studio, Settings, Admin) found unnamed controls and missing or duplicate
landmarks. Admin filter selects, date inputs and row role selects got names; wide tables are named, focusable scroll
regions; an empty Transactions header cell has sr-only text. Studio upload's back button and form fields, and the
profile name and email fields, are labelled (`htmlFor`, not the placeholder). Studio and Settings each have exactly one top-level `<main>`, and every `<nav>` has
its own name (main menu, bottom menu, Studio, Settings). The post page's loading skeleton (sr-only) and "post not found"
state now carry an `h1`, so a slow or deleted post still has a page heading.

**Validated:** production build; axe over 27 signed-in route/width pairs (local session, mocked data) → only
`color-contrast` left (Strata `ink-3` token, parked for the developer); axe structure sweep over 10 public routes ×
1440/390 → 0 violations (the post page was audited while its API timed out, i.e. the loading state). tsc 0; `bun test`
414 pass, the 9 failures are the `app/docs/__tests__` suites this diff does not touch.

---

## #843 Cover lightbox reachable by keyboard (2026-10-21)

**What:** the per-volume enlarge icon was a `<div onClick>` inside the volume `<button>` — mouse-only. The tile is now a
wrapper holding two sibling buttons (volume, and "ขยายปก เล่ม N", shown on hover or keyboard focus); `CoverLightbox` is
`role="dialog"` `aria-modal` with `useDialogFocus` (focus in, Tab inside, focus back to the enlarge button), standing aside
when a layer is above it.

**Validated:** production build. Keyboard: Tab from a volume reaches "ขยายปก เล่ม 1" (visible, opacity 1) → Enter opens the
lightbox with focus inside → 6 Tabs stay inside → Escape closes it, focus back on the enlarge button, popup still open.
Mouse: hover shows the button, tile click selects the volume, enlarge click opens, close button closes. tsc 0; eslint
counts unchanged.

**Follow-up (#845):** the enlarge-cover buttons on grid cards, book rows and search results were `opacity-0` until hover,
so keyboard focus landed on an invisible control; they now show on `focus-visible` too, and the tile hover border stays.

---

## #840 Reader takes keyboard focus; Escape closes only the top layer (2026-10-21)

**What:** the reader (portal, `fixed inset-0`) is now `role="dialog"` `aria-modal` and uses `useDialogFocus` (#837): focus
moves in on open, Tab stays inside, focus returns to the popup's read button on close. Found on the way: Escape in the
reader — and in the cover lightbox — also closed the book popup underneath (the popup listens on `window` and was
registered first). Both now handle Escape in the capture phase and stop it.

**Validated:** production build, keyboard only, reader opened from the popup: focus inside the reader, 25 Tabs never leave
it, ArrowRight still pages (1 → 2 / 26), Escape closes only the reader and focus is back on "อ่านตอนที่ 0" with the popup
still open. Lightbox (opened by mouse) + Escape → lightbox closed, popup still open. Guest login prompt (z 9999, opened from the
reader) shown → Tab from the reader's last control leaves the reader (the prompt is reachable); hidden → Tab wraps. tsc 0;
eslint counts unchanged.

---

## #837 #838 Book popup keyboard focus; grid cards reachable by keyboard (2026-10-21)

**What:** the book popup (`role="dialog"` + `aria-modal` since #835) left focus on the page behind it, let Tab walk the
page underneath, and dropped focus to `<body>` on close. New `hooks/useDialogFocus.ts` (pure `focusWrapTarget`, unit-
tested): focus moves in on open, Tab/Shift+Tab wrap inside while the popup is the top-most (`modalStack.isTop`, so a
stacked related-manga popup owns the keyboard), focus returns to the opener on close. While testing it: `MangaGrid`
cards (`/new`, categories, My List) were an `<article onClick>` with a `<p>` title — not reachable by keyboard; the
title is now a `<button>` (mouse behaviour unchanged).

**Validated:** `useDialogFocus.test.ts` red → green (5 cases). Production build, keyboard only: Tab to a grid title →
Enter opens the popup with focus inside; 80 Tabs / 20 Shift+Tabs never leave it (24 stops); Escape closes and focus is
back on the title. Stacked: related manga opened from the popup → 2 dialogs, 40 Tabs stay in the top one, Escape →
focus back on that related button; the reader opened from the popup keeps its own Tab order (0 of 12 Tabs pulled back). axe: no new violations.

---

## #835 Landmarks, redundant alts, heading structure (axe) (2026-10-21)

**What:** the non-contrast axe-core findings: the home hero now sits in the page's one `<main>`; `BookDetailModal` is a
`role="dialog"` with `aria-modal` and the title as label; covers next to their own caption/label (volume covers, related
manga, mobile hero cards) get `alt=""`; `/search` has an `sr-only` `h1`; PostCard titles are `h2`; `ForumSideMenu` is a
`<nav aria-label>` instead of a nested `<aside>`. No visual change.

**Validated:** axe over 9 public routes × 1440/390: `region` 34 → 0, `image-redundant-alt` 34 → 0, `page-has-heading-one`,
`heading-order`, `landmark-complementary-is-top-level` → 0; only colour-contrast (Strata token values, #833) remains.
Screenshots: home layout unchanged at 1440/390. tsc 0; eslint counts unchanged.

---

## #833 Controls no longer use the tertiary ink-3 token (WCAG AA contrast) (2026-10-21)

**What:** an axe-core audit (already in node_modules) over 9 public routes × 1440/390 found 236 colour-contrast
failures. Controls in `ink-3` (3.75:1 on `bg`) — inactive tabs, "ดูเพิ่มเติม", Hot/New, filter/underline buttons, chapter
pills, Navbar + mobile bottom-bar inactive items, the category back button — moved to `ink-2` (7.8:1); no token value
changed. One rule: every control — text or icon-only (close, kebab, view toggles, delete/report) — uses `ink-2`; static
meta text stays `ink-3`. TopupModal and DangerTab (parked) untouched. The Studio mobile tabs, which mark the active
tab by colour alone, also get `font-semibold` on the active one.

**Validated:** axe re-run: interactive failures 79 → 0; total 236 → 134. Remaining 134 are static text that fails
because of the Strata token values themselves (`ink-3` 42% mix: 3.75:1; `accent` tags: 4.16:1) — left for the developer
(numbers in PR). Visual check 1440/390: active/inactive distinction kept.

---

## #830 Settings tab strip keeps the active tab visible on a phone (2026-10-21)

**What:** at 390 px the settings tab strip always started at the left, so on stats and danger zone the active tab
was off-screen. The strip scrolls its own scrollLeft (pure `lib/stripScroll.ts`, never the page) to show the active tab on navigation, and both navs mark it with
`aria-current="page"` — same pattern as the admin strip (#819).

**Validated:** `stripScroll.test.ts` red → green; production build, local test session at 390: active tab fully visible on profile, password,
accounts, stats and danger (stats/danger were off-screen); 0 page overflow. tsc 0; eslint 0.

---

## #828 Studio says "could not load" instead of showing zero works and 0 coins (2026-10-21)

**What:** a failed Studio overview/works load showed a toast and then a full set of zero metrics and empty charts
("you have no works"); a failed wallet call was swallowed into a 0-coin balance. New pure
`studio/lib/studioLoadState.ts` (loading / error / ready; cached data stays) and `StudioLoadError` (sleeping studio
mascot + "ลองใหม่"); the wallet fallbacks are `null` (a failed list never overwrites the cached one): balance and spending show "—", the coins tab shows the error + retry.

**Validated:** `studioLoadState.test.ts` red → green; production build, local test session with the Studio APIs
failing: overview and works at 1440 and 390 show the error + retry, no zero metrics, Retry re-requests once;
signed-in Chrome with real data: overview (3 works, 9 chapters, 109 coins) and works list render as before.

---

## #826 Reader asks for a translation rating only on translated pages (2026-10-21)

**What:** `showTranslation` defaults to true, so the "คุณภาพแปล 👍 👎" pill sat over every page, including pages never
translated; its `bg-bg/50` + blur read as a grey smudge over manga art. New pure
`components/reader/pageShowsTranslation.ts` gates it on the current page being in `translatedPages`/`patchedPages`;
the pill is a solid `bg-bg/85` surface with a `text-ink-2` label.

**Validated:** `pageShowsTranslation.test.ts` red → green; production build, chapter opened signed out (MIT offline):
pill absent at 1440 and 390, no page errors. Not browser-checked: the pill on a translated page (needs a translation
run).

---

## #824 Admin tables scroll on a phone instead of squashing (2026-10-21)

**What:** with realistic data the admin tables (`w-full` in the new `overflow-x-auto` wrappers) squashed to 390 px:
names stacked a word per line, action/role badges wrapped inside their pills, UIDs broke at hyphens. Tables get a
minimum width (`min-w-[44rem]`, recent bans `32rem`) so they scroll in their card; badges, UIDs and dates are
`whitespace-nowrap`; long names truncate with the full text in `title`.

**Validated:** production build, local test session (role 8) with fixture data shaped like the admin API: 5 pages ×
390 → 0 stacked cells (were 3/2/4/0/14 per page), 0 wrapped badges, every table scrolls in its card, 0 page overflow;
1440 → 0 stacked cells, no table scroll, unchanged.

---

## #821 Background community tabs no longer starve the browser's connections (2026-10-21)

**What:** the notifications dropdown that spun forever in a real Chrome session (every `/api/proxy/*` call from the
tab hung while curl answered in ~50 ms). Root cause reproduced: `useFeedStream` / `usePostStream` kept an
`EventSource` open in background tabs, and over HTTP/1.1 a browser shares 6 connections per host across all tabs —
6 open `/community` tabs → every other request hangs (5 → fine). New `hooks/pageVisibility.ts` (`usePageVisible`,
useSyncExternalStore over `visibilitychange`); both streams connect only while the tab is visible.

**Validated:** `pageVisibility.test.ts` red → green; production build, headless Chromium, one profile: 6 community
tabs with 5 hidden → live streams [0,0,0,0,0,1], a request from another tab 7 ms (was: never answers); a tab made
visible again reconnects; same for 6 post tabs. Production behind Cloudflare negotiates HTTP/2 (not starved).
Events while a tab is hidden are not delivered; the post page catches up on return (fresh post + comments; a post deleted meanwhile → /community).

---

## #819 Admin works at phone width; a failed load says so (2026-10-21)

**What:** below `md` the admin sidebar is replaced by a sticky top bar with a scrolling tab strip (active tab kept in
view, `aria-current`); `main` padding `p-4 md:p-8`; table wrappers scroll horizontally instead of clipping. One
`AdminLoadError` (role=alert + Retry) on the Overview and above the table of Users / Content / Transactions / Audit
when the latest load failed — the "No … found" row shows only after a successful load.

**Validated:** production build, local test session (role 8) with the admin APIs answering 403: all five pages at
390 → main 390 px wide (was ~120 px), sidebar hidden, 0 overflow, error + Retry shown, Retry re-requests once; 1440
unchanged (main 1200 px beside the 240 px sidebar). tsc 0; eslint on the touched pages: same pre-existing
set-state-in-effect count as main.

---

## #817 Opening /admin directly no longer bounces an admin home (2026-10-21)

**What:** AuthContext starts with `user = null` + `loading = true`; the admin layout redirected on `user === null`
without reading `loading`, so a direct load or refresh of any `/admin/*` page sent an admin to `/` (settings and
studio already waited for `!loading`). The JWT role can also lag — an admin promoted in the panel has the role only
in `profiles.role` — so the layout reads `GET /users/me` itself when the JWT is not admin. New pure
`admin/components/adminGate.ts` → wait / redirect / allow.

**Validated:** `adminGate.test.ts` red → green (5 cases); production build with a local test session (Supabase and
admin APIs mocked locally): JWT 8 → all five admin URLs render (were redirected); JWT 1 + profile 8 → all five
render; JWT 1 + profile 1 → redirected home. 1440 and 390.

---

## #814 Reading history no longer re-backfills and re-POSTs on every load (2026-10-21)

**What:** the server has no column for `lastChapterNumber`, and `loadHistoryData` replaced local entries
with the server's, so every signed-in load erased the numbers; the backfill then re-fetched each manga's
chapter list and queued a POST that could not store the field (11 POSTs per load for a 30-entry history).
A pure `mergeRemoteHistory` (in readingHistory.ts) keeps local display-only fields (`lastChapterNumber`, `thumbnailLocal`)
when the server entry is for the same chapter; the backfill updates local state only.

**Validated:** `readingHistory.test.ts` red → green (4 cases); signed-in browser, production build: second
load → 0 history POSTs (was 11), 0 entries missing a chapter number. Not changed: the hero's per-slide
chapter fetch (HeroDetailButton, by design) and a second history GET per load (AuthContext — parked).

---

## #812 Untranslated descriptions are no longer re-requested every hero slide (2026-10-21)

**What:** `translateDescription` cached only successes, so a `translated: false` answer was re-fetched on
every hero rotation (~5 s), each time making the backend try every Gemini model on the shared free-tier key
(270 failure lines in one session). The "not translated" answer is now cached (as null) and still rejects;
failed requests (network / non-2xx) stay uncached and retry.

**Validated:** `translateDescription.test.ts` red → green (3 cases, counting fetch stub); production build in
a signed-in browser: 60 s on the home page → 9 translate requests, all distinct texts (before: the same
text repeated each rotation).

---

## #810 Studio nav highlights the right item on upload / manga / search (2026-10-21)

**What:** `getActiveStudioTab` fell back to Overview for `/studio/upload`, `/studio/manga/[id]` and
`/studio/search`; they now map to Works (sidebar + mobile Studio bar share the function).

**Validated:** `studioTabs.test.ts` red → green; signed-in browser on a production build — upload, search and a
work page highlight ผลงาน, `/studio` still ภาพรวม. Not browser-checked: the mobile bar (same function).

---

## #808 Reviews page shell + mascot empty states (2026-10-21)

**What:** `/book/[id]/reviews` — the only route without the Navbar — now uses `page-shell page-shell-nav`,
the shared page header and a `max-w-3xl` reading column; its empty state, Trending, post-page comments
and My List (empty + signed out) show the area mascot (community / reader / login). Markup only.

**Validated:** tsc 0; production build at 1440 + 390 on the four routes — 0 overflow, 0 console errors,
screenshots reviewed; code-review + scrutinize: merge. Not checked: My List's signed-in empty tabs.

---

## Follow-up fixes after the Strata redesign — PRs #800 #803 #804 #805 #807 (2026-10-21)

**What:**
- **#800** — feature-audit bugs #661–#663, #666–#672, #675 (year-range search pages before paging, compare
  reader zooms both panels, follow/vote/review/check-in rollbacks with visible errors, one shared
  `/users/me/follows` load per page, reader fetches abort stale pages, pin/unpin audit rows) and
  **#798**: avatar upload validated by magic bytes (`detectAllowedImage`), like every other upload.
- **#803** (#801) — `TranslateThrottleGuard` keys on `cf-connecting-ip`, per-client 30/min checked before
  the global 600/min, explicit fail-open; 6,000-char text cap.
- **#804** — `UserAvatar` + `avatarSource` used for posts, comments, reader comments, reviews and the
  profile following list; the mascot fallback is `aria-hidden`.
- **#805** (#802) — the prompt keeps Markdown; the stripper runs only on `THOUGHTS:` and keeps links,
  rules and blank lines; cache version v4 → v5.
- **#807** (#806) — one `PostImage` for the forum card grid, compact thumbnail, post page and the
  create-post preview: scheme-guarded (`safeImageSrc`), designed fallback on a blocked URL or load error;
  the compact thumbnail is resized via `sizes` (`w=256`).

**Validated:** each PR's own tests red → green, tsc 0, CI green, production-build browser checks
(details in each PR). Not E2E-checked: the #807 uploader preview (needs a signed-in browser).

**Left open:** #664 (check-in credit atomicity, wallet), #665 backend half (wallet), sweep of avatars
stored before #798.

---

## #764 Strata redesign — Epics B/C/D + performance pass (2026-10-20)

**What:** every user area moved onto the Strata tokens (home/catalog/search/nav #773, book popup +
reader #774, community #775, settings/account/top-up/check-in #776, admin #777); Studio rebuilt (#786
vendored evilcharts ECharts core, #787 `GET /studio/stats`, #788 resizable shell + stats overview, #789
pages + CopyButton); the bot-avatars mascot cast placed per area (#783), `GET/PUT /users/me/mascot`
(#784, migration written, not applied) and the mascot editor in settings (#785). ADR 029 records the
design system. Emoji-as-icon replaced by lucide line icons, the coin glyph and the mascots.

**Performance pass (asked for by the dev, production build, headless Chromium 1440×900):**
home scroll 30 → 60 fps and book popup ~10 → 60 fps (backdrop-blur on 80 repeated cards and on
full-screen scrims, measured by A/B — DESIGN.md now forbids it); mascot editor colour drag 41 → 4.8 ms
sync work per event, frames over 50 ms 86 → 15; /settings scroll slow frames 123/389 → 0 and idle 60 fps
(the furred preview rests as a still unless someone is dressing it). Search/new/community/studio/
mylist/reader paging were already 60 fps.

**Also fixed in passing:** profile display name painted under the banner; broken profile photo left an
empty box; non-numeric chapter labels overflowed the Studio badge; Studio sidebar 12 px below the navbar.

**Open:** light theme (#778, blocked on parked auth-flow files); profiles.mascot migration needs dev
confirmation; colour-drag preview still ~30 fps while actively dragging (library re-shades the fur).

---

## #722 — one owner for the identity-change reset (2026-10-20)

**What:** `Frontend/app/lib/identityReset.ts` `resetClientStateForIdentityChange()` is now the only
list of per-user client caches dropped on an identity change (`clearUserCache`,
`clearHistory({syncRemote: false})`, `clearFollowCache`, `clearAllApiCache`). `AuthContext.tsx`
calls it at the four sites that used to spell the four calls out by hand (account switch,
`SIGNED_OUT`, `signOut()`, `deleteAccount()`). ADR 015 updated.

**Why:** the list had already drifted once (`clearFollowCache` was added late at every site), and the
one cache with a pending-write flag is the one that wiped a user's server history (#720).

**Not rebased:** `refactor/identity-reset-single-owner` was rebuilt on main instead. Its #720 half was
already shipped by #712 — the branch's own history tests pass against main's
`clearHistory({syncRemote: false})` and the "first read after re-sign-in" test fails with
`syncRemote: true`. Main's `cacheGeneration` guards (in-flight load/flush of the previous user) stay.

**Validation:** TDD — `identityReset.test.ts` red (module missing) → green, 2 tests; mutation:
dropping any one of the four calls fails at least one test (4/4). `test:auth` 12/12 after
allow-listing the new import in the `oauth-regression` harness (it threw `Unexpected import` →
4 red before that). `bun test` 239 pass; the 8 failures are `app/docs/__tests__` integration tests
that need a running server, same as before. Browser: signed out on the dev server — Supabase
`logout` 204, signed-out UI, no `DELETE /users/me/history`. Limit: the local backend returned 404 for
`/users/me/*`, so the account had no history to clear; the clearing itself is covered by the tests.

---

## Native Phase 2 first delivery and migration issue publication — 2026-10-03

- Continued the approved `$grill-me` → `$to-prd` → `$to-issues` → `$tdd` direction using the existing full-parity plan. Published native [PRD #724](https://github.com/Slow-Inc/MangaDock/issues/724) and 29 bilingual slices #725–#753 through resumable GitHub CLI tooling; preserved old/new parents and left every issue open. No commit, PR, merge or duplicate plan.
- Added native Home/hero/landing rows, the original six mobile destinations, release/tag/genre pagination and related manga using existing services/artwork. Initial personal library and read-only Community feeds/posts are implemented; Home/history resumes guarded Reader at saved Chapter/Page. Existing history writes are authenticated, serialized, account-isolated and server-acknowledged; delayed reads do not move progress backwards. Save failures show retry.
- TDD checked response/filter/Back races and account isolation through real Mobile modules/Supabase SDK with external HTTP fixtures. Fresh Mobile verification: **121/121 tests**, typecheck, Android Hermes export **709 modules / 2.6MB / 10 assets**, all exit 0. No new runtime dependency or additional Frontend/Backend/MIT/shared-bridge source change in this batch.
- New Phase 2 visual/live acceptance remains open: Mobile env lacks the three required public API/Supabase variables and contains Backend configuration keys; Backend runtime is unavailable. Secrets were not copied/overwritten. Automatic approval review rejected temporary-credential Metro startup with only “blocked by policy”; no bypass. Source export does not prove initialization/visual parity. Signed/physical beta and remaining Phase 2/3 workflows remain unaccepted.
- Resume from [Phase 2 ledger](Mobile/docs/2026-10-03-native-phase2-implementation.md), [ADR 029](docs/adr/029-mobile-native-discovery-navigation-and-history.md) and [impact record](docs/reports/system-impact-report.md). Uncommitted. Configure private environments, validate, then compare populated web/native screens before accepting S11; continue S12/S20 missing criteria and later slices.

## Android local SDK discovery — 2026-10-03

- Reproduced `SDK location not found` with `gradlew.bat help`: installed SDK exists, both Android SDK environment variables are unset, and generated `android/local.properties` was absent. Added only the ignored local `sdk.dir` pointing to the existing SDK; documented machine setup and clean-prebuild recovery in Mobile README.
- Verified original `app:assembleDebug` command for x86_64: **BUILD SUCCESSFUL**, exit 0, 204 tasks (5 executed / 199 up-to-date). No app-source or dependency change. Debug assembly does not prove live services or beta acceptance. Tracked documentation remains uncommitted.

## Native UI follows the existing responsive mobile design — 2026-10-02

- User clarified the visual baseline: root `DESIGN.md` and the actual responsive mobile Frontend. Updated Phase 1 native views with the original logo, Deep Space/indigo/amber palette, portrait search grid, centered detail cover/CTA, social-first sign-in, topup presets and progressively disclosed Reader controls. API/auth/payment/translation controllers retain their contracts; search offline errors no longer appear as an empty successful result.
- Added Mobile-owned tokens, native shared chrome, six raster assets and a development asset generator. No new runtime dependency, Frontend/Backend/MIT source edit or shared-bridge change. PRD/slice criteria now carry this visual baseline into all phases; full bottom navigation and its destinations stay in Phase 2.
- Verified: Mobile **88/88 tests**, typecheck, Android Hermes export **697 modules / 2.5MB**. Inspected the new logo/sign-in render on the already-installed emulator debug app. [Source mapping, before/after captures and remaining gates](Mobile/docs/2026-10-02-native-responsive-design-parity.md).
- Live populated-screen acceptance remains open: Backend port 4001 was unavailable; an agent-started watch failed missing Supabase environment validation and was stopped. No new signed APK. Exact bundled font metrics, web/native image comparisons and authenticated Wallet/Reader checks remain. Uncommitted. Resume from the Mobile design-port note.

## Android Gradle wrapper compatibility — 2026-10-02

- Restored generated `Mobile/android/gradle/wrapper/gradle-wrapper.properties` from 9.4.1 to **9.3.1**, matching the installed Expo template and RN plugin wrapper. User build logs show Kotlin 2.3.0 metadata rejected by the Kotlin 2.1.20 plugin compiler; Gradle 9.3.1 `--version` confirms embedded Kotlin 2.2.21.
- Documented the toolchain and next run in [Mobile README](Mobile/README.md#android-gradlekotlin-compatibility) and [execution ledger](Mobile/docs/2026-10-02-native-phase1-implementation.md). Native files are generated/ignored; fresh prebuild already uses 9.3.1. No new dependency or custom plugin.
- APK build remains unverified: agent assemble failed on a sandbox Java real-path `AccessDeniedException`. Standalone Java reads the same workspace JAR (83,267 bytes) but `Path.toRealPath()` fails. Resume with `npm.cmd run android` in the user's normal Mobile terminal. Uncommitted; no additional Backend/Frontend/MIT edits.

## Backend profile-join compilation fix — 2026-10-02

- Fixed five TS2352 errors in reader comments, reviews, and user follows. Profile mappers now accept object, array, or null joins; empty joins preserve null author fields or omit missing follow profiles. Removed incompatible casts without changing queries or API response fields.
- TDD reproduced lost author details and invalid follow profiles for array-shaped joins through the real Supabase SDK with a controlled HTTP boundary. Added 12 regression tests; `npm.cmd run build` passed; full Backend suite: **90 suites / 960 tests passed**.
- Scope: three Backend services and their new specs, plus this history and the [impact report](docs/reports/system-impact-report.md). No dependency, schema, Frontend, or MIT changes. Uncommitted local fix for the reported Backend startup blocker, separate from native Mobile feature work.
- Resume here: rerun `npm.cmd run start:dev` in `Backend` if the existing watch process has not rebuilt; database/runtime connectivity remains to be checked in the user's environment.

## #694 — SFX rescue says why it returned nothing (2026-09-26)

**What:** `MIT/manga_translator/ocr_vlm.py` `vlm_localize_sfx` now logs one `WARNING` when the
vision reply yields no usable SFX: `SFX reply unusable: finish_reason=… content=… max_tokens=24
crop=WxH` for a truncated or `None` reply, and `SFX reply sanitised to empty: '…'` when a reply
arrived but `sanitize_sfx` reduced it to nothing. The return value is unchanged in every case — the
degrade-to-`''` behaviour is deliberate and safe (the region renders the raw SFX).

**Why:** `''` from this function reads downstream as "this region has no SFX". A truncation looked
exactly like an empty region, which is why 2026-07-11 concluded "text MoE" and why 2026-07-28 needed
~10 hand-written probes to find three defects (verdict #4 of
`docs/reports/benchmarks/2026-07-28-679-sfx-gate.md`). The Doctor (#688) can name it, but only
inside a Doctor run; production stayed silent.

**Not in scope:** raising the token budget or disabling thinking (verdict #3: on the served model
those ship confident nonsense). The function has no region id, so the crop size stands in for "the
region".

**Found while writing the tests:** `'(no sound effect)!!'` survives `sanitize_sfx` as
`NO SOUND EFFECT !!` — the refusal-leak the #688 `sanitize` probe reports. Left for its own issue.

**Validation:** TDD — 4 new tests, 3 red first (no warning emitted), then green. Each branch
mutation-checked: dropping the `finish_reason` check, the sanitised-empty check, or the budget in the
message each fails exactly one test. 47 passed across `test_ocr_vlm`, `test_sfx_gate_scan`,
`test_lazy_import`, `test_stage_c_wiring`. MIT not booted (torch-free tests only).
## #688 — Doctor LLM contracts: four checks that turn a silent `''` into named failures (2026-08-31)

**What:** `MIT/tools/pipeline_doctor/llm_contracts.py` — four probes over one SFX rescue call,
covering the LLM/gateway layer that nothing in the repo looked at. `vlm-send` (model set, budget
above the reasoning floor, thinking flag applied), `vlm-image` (decodes, RGB, not blank, above the
vision-resolution floor), `vlm-recv` (`finish_reason`, `content` not `None`), `sanitize` (a corpus
of refusal forms the model actually emitted). 20 tests in `test/test_pipeline_doctor_llm.py`.

**The design choice that carries the value:** `capture_sfx_call` runs the **real**
`vlm_localize_sfx` with its `post_fn` seam filled by a recorder, so the contracts report on
production code. A probe reading a hand-written copy of the payload would stay green through
exactly the edit it exists to catch — mutating the capture to a hand-written body reds 9 of 20.

**Acceptance (#685's falsifiable bar) is met:** all three 2026-07-28 defects surface in one walk,
each on its own row with its own evidence — `vlm-send` FAIL (`budget 24 <= 2048 measured to
truncate`), `vlm-recv` FAIL (`finish_reason=length, content=None`), `sanitize` FAIL (`'EMPTY LINE'
-> 'EMPTY LINE'`), plus `vlm-image` WARN (≈40 visual tokens vs the 336 measured to be answered).

**Every threshold is a measurement, cited at the constant that uses it** (`2026-07-28-679-sfx-gate.md`).
Two bands stay WARN because nobody located their boundary: the vision floor rests on a single
measurement, and the 2048–4096 budget band is unmeasured. The Doctor **fixes nothing** — it makes
the defects nameable. Deliberately so: that benchmark's verdict is that raising the budget on the
current model ships confident nonsense into renders.

**A defect in this work's own tests, found and fixed:** `test_the_contracts_import_without_torch`
first asserted `'torch' not in sys.modules` inline — green in CI (no torch installed), red locally
the moment an earlier module imports the pipeline. It measured the suite's import order, not the
import graph, and would have been green in exactly the environment that cannot detect a regression.
Rewritten as a subprocess check with a negative control.

**Scope held:** #688's D1 (extract five thinking/budget helpers from `custom_openai`) was **not**
done — those helpers do not exist on `main` (they arrived with #623 on `perf`), so the premise is
void on this base. The SFX half, which the issue names as the priority, is what shipped. The
production-side gap the benchmark asked for (log `finish_reason: length` in `ocr_vlm` itself) is
new work and was filed rather than absorbed.

Benchmark: `docs/reports/benchmarks/2026-08-31-688-doctor-llm-contracts.md` (+ PNG).
Tests: 20 new, mutation-tested 6/6; full MIT suite 768 passed / 1 pre-existing network failure.

Refs #688 #685.

---

## #686 — Pipeline Doctor core: probe registry + runner, two renderings from one walk (2026-08-31)

**What:** `MIT/tools/pipeline_doctor/` — the seam every other #685 deliverable plugs into.
`StageReport` (stage id, `OK`/`WARN`/`FAIL`, metrics, evidence), a `ProbeRegistry` probes attach to
by decorator, and two renderers over the same data: an aligned text table for a terminal and JSON
for an agent.

**The design constraint that shapes it:** the core must not know what a pipeline stage *is*. Probes
register themselves on import, so the core never holds a stage list it would have to keep current —
which is what keeps it from importing the pipeline, and therefore torch-free and runnable in the
`mit_logic` gate. Registration order is pipeline order deliberately; sorting would print `render`
before `vlm-send` and describe a pipeline that does not exist.

**A probe that raises becomes a `FAIL` row carrying the exception, and the walk continues** — a
diagnostic that aborts on the first broken stage says nothing about the remaining ones, which is
exactly when it is most needed.

**Found by /scrutinize, not by the tests:** `to_table` broke a promise it makes in its own docstring.
Evidence containing a newline rendered 2 stages as 3 lines and destroyed the aligned status column,
and a control byte reached the terminal verbatim. The evidence a probe carries for the LLM stages is
a string the *model* wrote, so `[2J` clears the developer's screen and `[31m` recolours
everything after it — a `FAIL` row could be dressed up as anything. `_one_line` escapes rather than
strips (which bytes came back *is* the diagnosis); `to_json` stays verbatim, since JSON already
escapes them and an agent should get exactly what the model sent.

**Validation:** TDD, red first (`ImportError: cannot import name 'ProbeRegistry'`). That red proves
only absence, so each assertion was mutation-checked against the finished code — all four mutations
redden exactly the test naming the behaviour and nothing else. 13 tests. `mit_logic` gate in CI:
**651 passed, 3 skipped, 0 failed**; the fuller local run (full deps) is **740 passed, 2 skipped, 0
failed**. Benchmark + PNG: `docs/reports/benchmarks/2026-08-31-686-pipeline-doctor-core.md`.

**Known and not fixed here:** a run where every probe declines reports `ok=True`/`exit_code=0` with
zero stages, so a CI gate wired to it would go green having inspected nothing. The core cannot know
which stages *should* have reported, so that assertion belongs to #690 (the CI-wiring deliverable),
where it is recorded.

PR #692. Refs #686 #685.

---

## #679 — the SFX wiring guard was asserting a symbol name; fixing it uncovered a real gap (2026-07-28)

**What #679 said:** the driver on `integrate/render-reconcile` "reverted to the pre-#278 4-char SFX
heuristic". **That was wrong** — I filed it by repeating the test's own failure message without
opening the driver. The driver does gate on provenance, via landing's `sfx_merge.should_sfx_rescue`
(`region.is_sfx`), swapped in deliberately and with a benchmark in `7e78341e`. No length heuristic
exists in that file.

**The guard's actual defect:** `test_stage_c_wiring.py` asserted the literal symbol
`should_rescue_sfx` appeared as a call. That pins an implementation, not the behaviour it protects,
so a deliberate swap to an equivalent gate fired it — and the failure message accused the driver of
something that had not happened. Fixed by moving the rule into `test/sfx_gate_scan.py`, a pure
`ast` module tested against **synthetic** drivers, including the gate-less one no real file in the
tree exhibits, which is the case the guard exists for and could never previously be exercised.

**What fixing it uncovered — this is the part that matters.** ADR 026 has two independent
requirements and the guard only ever checked one. The Decision is "gate on provenance". The
**Addendum** is "provenance alone was insufficient": det_sfx itself false-positives on speech
bubbles, and without a real-text guard the vision gateway is handed a dialogue fragment, told it is
an SFX, and returns a phantom onomatopoeia rendered over the real line — benchmarked across 5 pages
on 2026-06-30.

Landing's gate is provenance-only. Verified by running both checks over both drivers:

| | provenance gate | Addendum real-text guard |
|---|---|---|
| `main` | `should_rescue_sfx` | **yes** |
| `integrate/render-reconcile` | `should_sfx_rescue` | **no** |

So the branch satisfies the #278 Decision and reintroduces the defect class its Addendum closed.
`ocr_read_real_text` still runs *inside* `ocr_vlm.should_rescue_sfx`, but nothing on that branch
calls that helper — live code with passing tests and no caller, which reads as coverage it no longer
provides.

**Deliberately not papered over.** The obvious move — make the guard accept either gate and go green —
would have turned a true signal into silence. `test_stage_c_wiring.py` now asserts the two
requirements **separately**: `main` passes both, the branch passes the first and fails the second.
The trade-off is recorded as **open** in ADR 026's new Amendment, with the note that the two aims are
not in conflict in principle — the Addendum's rule and the stylized-SFX case collide only because the
rule is a heuristic, so a gate satisfying both is findable. Neither branch has one today.

**Validated:** 10 tests across the two files; full torch-free suite 646 passed, 0 failed on `main`.

---

## #680 — glyph cache ignored font switches (real render bug, found by root-causing 4 red goldens) (2026-07-28)

**Symptom that started it:** four characterization goldens red on `integrate/render-reconcile`
(`put_char` advance drift + 3 × `resize_regions`). First diagnosis — "the branch's render code
produces different glyph advances than main" — was **wrong**: identical test + identical golden +
different result is not evidence of a code difference. The discriminating fact was already in hand
and unused: **the tests pass alone and fail in the suite**. Order dependence ⇒ shared state.

**Root cause:** `text_render.get_char_glyph` is `@lru_cache(cdpt, font_size, direction)` — the key
carries no font — while `set_font()` swaps the module-global `FONT_SELECTION`. Anything already
cached keeps rendering with the previous font: wrong letterform *and* wrong advance (so wrong wrap
widths). Proven minimally: `'A'@48` = 38 with Prompt-Bold, **still 38** after `set_font('')`, 32
after `cache_clear()`. The polluter in the suite was `test_clean_layout_fit.py` (renders with
`anime_ace_3.ttf`); that file is byte-identical on both branches — the variable is
`rendering/__init__.py`, so `_clean_layout_dst` caches a different set of glyph keys and only on
`integrate` do they collide with the goldens'.

**Production reach:** `set_font()` is called from `dispatch_render` (configured font),
`dispatch_eng_render` (`comic shanns 2.ttf`) and `dispatch_eng_render_pillow`
(`NotoSansMonoCJK-VF.ttf.ttc`) inside one long-lived worker — so any request after one with a
different font got stale glyphs. The hazard was known: `select_hyphenator`'s comment names "the
font-cache landmine that gates other render caches", and it is why `get_char_border` /
`get_char_offset_x` have their caches commented out. `get_char_glyph` was the one left memoised.

**Fix (TDD, 2 tests at the public seam):** invalidate in `set_font()` **only when the selection
actually changes**. Unconditional `cache_clear()` is the tempting wrong fix — `dispatch_render`
calls `set_font()` every request, so it would rebuild the entire glyph cache once per page; the
second test pins that.

**Measured, same worktree + interpreter, only the source change differing:** without the fix
`1 failed, 635 passed` (`test_resize_regions_bubble_fit_byte_identical`); with it `636 passed,
0 failed`. **That failure was already live on `main`** and had been attributed to cross-platform
freetype drift (#541) and converted to a skip — which masked it. Same-env evidence here points at
the cache. Falsifiable follow-up: if #541's Linux-CI mismatch had the same cause, that golden
should now assert instead of skip in CI.

**Process note:** logged as [[feedback-root-cause-before-fix]] — two wrong causes were published to
issues before checking (#679 too, where the test's own failure message was taken as fact). Rule now
in CLAUDE.md: prove the root cause with evidence that discriminates between explanations before
proposing any fix, because a fix applied first can mask the cause.

---

## CI gates made real — tested unit-test selection, guard suites, mobile typecheck (#643/#678, #639/#640, 2026-07-28)

**Trigger:** draft PR #642 ran `integrate/render-reconcile` through the pipeline for the first time
ever and it went red. #626's *"integration branch green"* acceptance had been assumed, never
CI-verified. An acceptance criterion that no job enforces is a note, not a gate.

**#678 (#643 Failure 1).** The bun **unit** gate was collecting `mermaid.e2e.test.ts`, a Playwright
spec, because file selection was an inline `find` blacklist in `ci.yml` that only knew
`*.integration.test.ts`. TDD'd into `scripts/lib/frontend-unit-tests.mjs` — `selectUnitTestFiles()`,
5 tests, red→green per slice — with `scripts/list-frontend-unit-tests.mjs` as the CLI (exits 1 on an
empty selection so the gate can never run nothing). A regression test pins the trap: the tempting
`-not -name '*.*.test.ts'` one-liner would silently drop `PageRenderer.memo.test.ts`, a real unit
test whose extra dot is descriptive. Also added the **`scripts (node --test)` job** — nothing in CI
ran the guard suites before, so `issue-ref` / `worktree-budget` / `pr-bilingual` / `append-only`
could all break and stay green. `/scrutinize` caught one real defect pre-merge: the `frontend` job
called `node` while only setting up bun, i.e. it depended on an undeclared runtime that the runner
image happened to provide — fixed by declaring `actions/setup-node@v4`, matching what the `backend`
job in the same file already did.

**#640 (#639).** Mobile CI: `npm ci` + `npm run typecheck` (`tsc --noEmit`, strict), path-filtered on
`Mobile/**`, wired into the required `gate`. It was **64 commits stale** — its earlier green run was
against a base that no longer existed — so it was rebased onto `main`, and the `gate` conflict with
#678 resolved as a union (`[backend, frontend, mit_logic, mit_heavy, mobile, scripts]`).

**Verification — the point of the whole batch was gates that actually gate, so nothing was taken on
a green checkmark:** `scripts` job log shows `# tests 58 / # pass 58 / # fail 0`; `frontend` shows
`Ran 226 tests across 33 files` (exactly the 33 the selector picks); `mobile` runs `tsc` over 3 real
files, and #639's never-demonstrated acceptance criterion was finally proven — injecting a type
error into `App.tsx` yields `error TS2322` and `npm run typecheck` exit **2**, so the step and the
gate fail. A job that resolves to zero files would have passed forever.

**Not fixed by this batch:** #643 Failure 2 (torch-free collection) is fixed on
`integrate/render-reconcile`, not here — the four offending test modules only exist there. With
collection unblocked, that branch's suite ran for the first time and surfaced **#679** (the #278 SFX
provenance gate is not called by the driver) and **#680** (4 characterization goldens red: the merge
reverted the #541 portability fix, plus one genuine glyph-advance drift). Both block Phase E.

---

## Security: record device on login for /settings/security (2026-07-21)

**Goal:** `/settings/security` แสดง "ไม่พบข้อมูลอุปกรณ์" เพราะ `user_known_devices` ว่างเสมอ

**Root cause:** `HardwareIdMiddleware` เขียน device เฉพาะ chapter/upload routes — ไม่ fire ตอน login

**Changes (1 commit, 3517e89):**
- `Backend/src/users/users.controller.ts`: เพิ่ม `POST /users/me/record-device` endpoint (AuthGuard + `isValidHardwareId` validation) — เรียก `recordDeviceAndAlert` แล้ว return `{ ok }`
- `Frontend/app/contexts/AuthContext.tsx`: import `getHardwareId`; ใน `onAuthStateChange` block (`SIGNED_IN`/`INITIAL_SESSION`) fire-and-forget `fetch` ไป endpoint นี้หลัง `syncToBackend`

**Result:** device ถูกบันทึกใน `user_known_devices` ทันทีที่ login ทุก provider (email, Google, Facebook) — `/settings/security` แสดงรายการอุปกรณ์ได้ทันที

---

## UI Polish — Settings mobile nav, admin prefetch, no-reload sign-out, dropdown reorder (#645, 2026-07-21)

**Goal:** 4 small UX improvements to navbar dropdown and /settings page.

**Changes (1 commit, 9800bbd5):**
- `Frontend/app/settings/layout.tsx`: mobile horizontal scrollable tab nav (`md:hidden`) above content — sidebar stays for desktop
- `Frontend/app/components/NavbarActions.tsx`: `<button router.push("/admin")>` → `<Link href="/admin">` for Next.js hover prefetch; reorder dropdown → โปรไฟล์ของฉัน / Studio / จัดการบัญชี / Admin Dashboard / ออกจากระบบ
- `Frontend/app/contexts/AuthContext.tsx`: remove `reloadPage()` from `signOut()` — auth guard in `/settings` layout (`router.replace("/")` when `!user`) handles redirect

**Validation:** `bun lint` 63 problems (identical to pre-change baseline — 0 new errors). All changes ≤ ~20 lines each.

---

## Security & Settings Page — /settings + 2FA + Audit Log (2026-07-21)

**Goal:** Replace AccountModal with a full `/settings` page, add TOTP 2FA, re-auth gating, new-device detection, session management, and admin audit log.

**Changes (9 commits, baseline 19082ac9..HEAD 7f83ab1c):**
- `/settings/{profile,password,accounts,security,danger}` pages replacing AccountModal tabs; NavbarActions routes to `/settings`; `/account` redirects
- Supabase migrations: `user_known_devices (uid, hwid, user_agent, first_seen, last_seen)` + `audit_logs (actor_uid, action, target_type, target_id, ip, metadata, created_at)` — both with RLS
- Backend: `HardwareIdMiddleware` now fire-and-forgets `UsersService.recordDeviceAndAlert()` for new-device logging; `UsersService.logAuditEvent()` + `AdminService.logAudit()` for audit trail
- `ReauthModal` + `useReauth(actionLabel)` hook — 5-min TTL window, password + Google + Facebook provider detection
- TOTP 2FA: `AuthContext` gains `enrollTotp`, `verifyTotpEnrollment`, `unenrollTotp`, `getActiveTotpFactor`, `verifyTotpForLogin`; `signInWithEmail` checks AAL post-login; `INITIAL_SESSION` also checks AAL to close page-refresh bypass; `MfaVerifyScreen` overlay (cancel calls `signOut()`); `TotpSetupModal` with QR + cleanup on abandon
- `/settings/security`: 2FA toggle (email-only users), session list with per-device logout + "sign out all others", device activity log; direct Supabase client + RLS
- `GET /admin/audit` endpoint + `/admin/audit` page: action filter, actor UID filter, paginated table, colour-coded badges; `logAudit` wired into `banUser`, `unbanUser`, `changeRole`, `adminDeletePost`
- Final review fixes: `.eq("uid", user.id)` defense-in-depth on device queries, orphaned `AccountModal.tsx` deleted, `@Min(1)` on audit DTO

**Known limitation (documented):** TOTP gate is not enforced server-side (backend `AuthGuard` validates JWT validity, not AAL level). OAuth login bypasses TOTP by design (Google/Facebook provide their own 2FA). Treat current 2FA as an advisory deterrent until server-side AAL enforcement is added.

**Validation:** per-task reviewer approved all 6 tasks; final whole-branch review (Opus) found C1 (uid filter) + I2 (INITIAL_SESSION) fixed in final commit. Backend 8/8 admin tests green. Frontend lint 0 new errors.

---

## Guard #4 — append-only log-header guard (#610, 2026-07-09)

**Goal:** prevent the stale-base clobber class (#553 → #608) at PR time — a PR off an old base silently dropping newer `## ` entries from `DONE.md` / `system-impact-report.md`.

**Change (TDD, 3-agent brainstorm design):** `scripts/lib/append-only.mjs` compares the MULTISET of `## ` headers in the base blob vs HEAD blob (codex refinement — not diff parsing → robust to moves/edits/code-fences/CRLF, avoids the `git diff ...` three-dot trap). Fails a PR that removes an existing header; `[log-trim]` in the PR title exempts curation. CLI wrapper + README + CI wiring. **Validation:** 15 unit tests RED→GREEN, full guard suite 45/45, CLI verified end-to-end (committed removal → exit 1). Wire into required `gate` job; also enable "require branches up to date" (defense-in-depth). Core-code clobber stays guarded per-seam by AST wiring tests (#608).

---

## MIT #503/#541 resize_regions golden portable across freetype builds (2026-07-07)

**Goal:** fix the `pytest (logic gate, torch-free)` **red on Linux CI** blocking PR #541 — `test_resize_regions_bubble_fit_byte_identical` failed with "region 0 dst_points drift".

**Root cause (systematic-debugging, not guessed):** the bubble_fit characterization golden encodes freetype-metric geometry — `_bubble_fit_layout`'s font binary-search + width-squeeze pivot on real glyph advances (`text_render.calc_horizontal`). The golden was recorded on Windows / Pillow 12.2.0 / freetype 2.14.3; CI installs Linux / **Pillow 12.3.0** (Pillow is unpinned in `requirements.txt`), whose freetype build yields different advances → fitted `dst_points` drift a few px → byte-equality fails. `legacy` + `clean_layout` are box-derived (metric-independent) and pass on both platforms. This is environment drift, **not** a logic change — the inherent limit of a byte-identical freetype-metric golden across platforms.

**Change (TDD, test-only — production render code byte-untouched):** each golden now records the `freetype_version` + `platform` it was made on. New pure `test/_golden_compare.py::golden_verdict(arrays_equal, same_env)` → `pass` (match → assert holds anywhere) / `fail` (mismatch on the golden's OWN env → real regression) / `skip` (mismatch on a DIFFERENT env → metric drift, regenerate to assert). `_save_or_assert` stores env + dispatches on the verdict. Portable goldens keep asserting everywhere (CI retains real coverage of the resize dispatcher); bubble_fit skips only on a foreign freetype, still asserts strictly on the dev platform where Phase-2 refactors happen. No dependency pinned (surgical, no ML-stack risk).

**Validation:** `test/test_golden_compare.py` 3 unit tests (RED→GREEN); skip/fail/pass wiring exercised on crafted goldens locally (env-diff+array-diff→skip, same-env+array-diff→fail, match→pass); goldens regenerated (byte-identical dst on dev freetype + new metadata). Logic gate **green on Linux CI** (the environment that failed). Scrutinized: ship (one inherent limitation documented — only the golden's authoring platform asserts strictly). Benchmark (test-infra before→after, PNG+MD): `docs/reports/benchmarks/2026-07-07-541-golden-portability.md`. PR #541, commit `ef69dd26`.

---

## MIT item9 clean-layout wrap column never narrower than longest Thai/CJK word (2026-07-01)

**Goal:** fix the user-flagged "ขึ้นบรรทัดผิด มันตัดระหว่างคำ" on the full-chapter Gal Yome EN→Thai benchmark — Thai words split mid-cluster: p25 "ข้างนอก"→"ข้า"/"งนอก", p18 "พยายาม"→"พยาย"/"ามให้", "ไม่เป็นไร"→"ไม่เป็"/"นไร". For a spaceless script (Thai/JP/Khmer/Lao) the wrap must break on a **dictionary word boundary**, never inside a word.

**Root cause:** `_clean_layout_dst` wrapped to the region's source-text bbox width with no word-aware floor. When that column was narrower than the widest Thai word, the greedy packer fell through to `_safe_char_split` (per-character) and force-split mid-word. Only bit **dialogue misrouted to clean-layout** (egg/oval/heart bubbles where `bubble_box is None`, or `fills_bubble_width < 0.72`); the two bubble-fit paths already guard against it (reject font where longest word > column, squeeze floor = longest word).

**Change (TDD):** new pure helper `text_render.longest_token_width(font_size, text, language)` = pixel width of the widest **atomic** word (ZWSP-segmented via pythainlp/jieba; Latin = widest space-delimited word). `_clean_layout_dst` floors `wrap_w` at it, mirroring the `_bubble_fit_layout` guard. Language-agnostic — Latin floor ≤ existing wrap → byte-identical. ADR 025 Addendum (2026-07-01).

**Validation:** `test/test_thai_wrap.py` 12/12 (+4: `longest_token_width` word-atomic Thai / widest Latin / empty; `_clean_layout_dst` keeps "ข้างนอก" intact in a 40px box). Characterization render goldens byte-identical (Latin + existing Thai golden); render suite 68/0 + 1 pre-existing async-infra skip (`test_default_renderer`, pytest-asyncio absent — same on main).

**Benchmark (visual, non-deterministic translate):** `docs/reports/benchmarks/2026-07-01-thai-word-break.md` (+ p25/p18/p11 composites) — re-rendered through the worker on `MIT/.venv`; every line breaks on a word boundary, no mid-word split; Latin column unchanged. **Side-effect:** item 2 (under-fill) incidentally improved (floored column lets fitter use more width) but font sizing unchanged → dedicated item-2 pass still warranted. Commit 63ea441, branch `worktree-feat-mit-font-s1`.

**⚠️ REOPENED (2026-07-01, full-chapter benchmark):** the clean-layout floor is correct but does NOT fully fix item 9. The full 30-page Gal Yome + One Punch run (`docs/reports/benchmarks/2026-07-01-item9-fullchapter-validation.md`, commit e84b982) found **p19 "ทำอาหาร"→"ทำอา"/"หาร" still breaks mid-word** via a production path the floor doesn't cover. Spot-check (p25/p18/p11) missed it — full-chapter caught it (the rule earned its keep).

**✅ RESOLVED (2026-07-01, commit e61771a):** ROOT CAUSE found via deterministic dump+replay A/B = **supersampling**, not the clean-layout floor. `render()` RE-WRAPS the laid-out text at the supersampled scale (`font*ss`, width `round(norm_h*ss)`). At ss=4 the integer rounding lands one pixel below the widest atomic word at `font*ss` and force-splits the Thai word mid-cluster — undoing the layout's ss=1 word-floor. The break was NOT reproducible at ss=1 (why the offline isolation of `_bubble_fit_layout`/`_clean_layout_dst`/full dispatch all refused to split — they run at ss=1); it only emerges at ss=4. **Fix:** floor the supersampled column at `longest_token_width(font*ss)` in `render()`'s horizontal branch so the re-wrap can never split a word the layout meant to keep whole (Latin floor ≤ box → no-op). **Verified on real worker** (Gal Yome p19, ss=4, `MIT/.venv`): cooking bubble renders `ฉัน/ทำอาหาร/และ/งานบ้าน/ได้นะ` — `ทำอาหาร` whole on one line, every bubble's text present, no clipping (`scratchpad/dumpref_p19.png`, `zoom_cooking_p19.png`). Deterministic A/B (dumped regions, floor OFF vs ON) confirms the floor is the only delta; the "missing text" in the offline replay triptych is a replay-harness paste artifact present **identically in OFF and ON**, NOT from this change. Tests 59 green (thai_wrap 13 inc. `test_supersample_wrap_floor_keeps_thai_word_whole` + render_golden/overlap/characterization 46). Added env-gated `MIT_DEBUG_RENDER_DUMP` (mirrors `MIT_DEBUG_REGROUND_DUMP`) for offline render A/B. item 9 status: **FIXED & VERIFIED.** Latin (One Punch) confirmed no-regression. Items 2 (under-fill) + 3 (phantom เงียบ det_sfx) remain separate, still open.

---

## MIT #278 gate SFX rescue on det_sfx provenance, not ≤4-char heuristic (2026-06-30)

**Goal:** fix the user-flagged "normal text gets detected/rescued as SFX". The vision-gateway SFX rescue fired for ANY ≤4-char region in a ≥60×60 box → short dialogue ("HUH?", "おい", "は？", "ですよ") in a large bubble was misread as onomatopoeia (wrong render) + added a ~1–2 s gateway round-trip to *every* translate.

**Change (TDD):** gate on **provenance** — thread `is_sfx` from the `Quadrilateral` textlines `merge_sfx_detections` appends → `textline_merge` (any SFX textline → region flagged) → `TextBlock.from_sfx_detection`; rescue only those (≤4), with a tight ≤2-char fallback when det_sfx is off. Decision extracted to pure `should_rescue_sfx()`. Plus PR #277 nits: ENG prompt `==` byte-identity; `sanitize_sfx` non-Latin refusal guard; document jieba lazy dict cost. ADR 026.

**Validation:** +9 `test_ocr_vlm` (6 `should_rescue_sfx` + ENG `==` + 2 refusal-guard), 24/0; render golden untouched; affected suites green (textline_merge async fails = pre-existing pytest-asyncio gap, identical on main). **Benchmark** (deterministic, `docs/reports/benchmarks/2026-06-30-sfx-rescue-provenance-gate.md` + image): OLD rescued 5/7 representative regions, NEW 3 → **2 false-positive gateway calls eliminated**, real SFX kept. Commit 8cbd930, branch `worktree-feat-mit-font-s1` (PR #433).

---

## MIT #175 clean-layout narration scales by PAGE not crop (2026-06-30)

**Goal:** fix the user-flagged "ทำไมตัวอักษรหลายที่ขนาดเล็ก ทั้งที่มีตัวปกติอยู่ด้วย" — on the full-chapter Gal Yome EN→Thai benchmark, narration/caption text rendered tiny while dialogue in the same panel was normal.

**Root cause:** clean-layout font = `font_size_max × processing_scale(area)`. In the per-region patch path the renderer is handed the small **crop** (full-res but tiny area) → `processing_scale` collapses to its 0.5 floor → narration ~3× too small (≈17px vs designed 35px on a 3 MP page). Dialogue was fine because bubble-fit is box-height-driven (ADR 023, page-independent) → hence the disparity. Same crop-vs-page bug class as #175's bubble-fit fix, but for the clean-layout branch (`_clean_layout_dst` used the crop `img.shape` for the font scale, wrap-width clamp, and max wrap height — all page-relative).

**Change (TDD):** thread the full-**page** shape (`PatchRenderer.img_w/img_h`, already the source of `page_scaled_font_min` #250) via `patch_ctx.page_shape` → `stages` → `dispatch` → `resize_regions_to_font_size` → `_clean_layout_dst`, and use it there instead of the crop. Full-page render path passes `page_shape=None` → uses `img.shape` (the page) → **byte-identical**. ADR 025.

**Validation:** pin test `clean_layout_font_size(20, crop)→floor` vs `(20, page)→35`; stages kwargs-forwarding characterization updated for the new `page_shape` kwarg; render golden/guard byte-identical; 38 render_overlap + patch_renderer + stages green (pre-existing `test_default_renderer` fails only because pytest-asyncio isn't installed — same on unmodified main). E2E (Gal Yome EN ch1 p14 → Thai): top-right narration balloon renders readable 3-line text instead of microscopic; no crashes, nothing oversized. Commit 70c6bf1, branch `worktree-feat-mit-font-s1` (PR #433).

**Note:** does not change *which* regions go to clean-layout (the rw/bw discriminator still routes narration-in-large-bubble there); only fixes the size once routed.

**Benchmark (deterministic, non-E2E):** `docs/reports/benchmarks/2026-06-30-clean-layout-page-scale.md` (+ comparison image) — narration 18px (crop, floored) → 35px (page), **~1.94×** uniform across all crop sizes; golden byte-identical.

---

## MIT #183/#175 width-squeeze — narrow column fills tall balloon (2026-06-30)

**Goal:** EN-source dialogue in a TALL balloon must fill the balloon height like the original (many narrow lines), not render as 2 wide lines with empty space below. Surfaced on Gal Yome no Himitsu EN ch1 p4 ("PEOPLE FROM OTHER DEPARTMENTS ARE WELCOME, DON'T YOU WANNA COME?") and user-flagged Thai targets ("ตัวเล็กแค่ 2 บรรทัด ทั้งๆ ที่ประโยคยาว").

**Root cause:** `_bubble_fit_layout` fit the largest font that wraps inside the balloon WITHOUT force-breaking a word, then rendered at the FULL balloon width. A tall-but-not-wide balloon → few wide lines + a vertical gap; the font couldn't grow further (capped by the no-mid-word-break guard), so the gap stayed.

**Change (TDD):**
- Pure `squeeze_width(measure_h, full_w, min_w, box_h, factor=0.9)` in `render_overlap.py` (mirrors MangaTranslator `layout_engine.py` ×0.90 step): after the font is fit, narrow the wrap column step-by-step until the block would exceed the box height, or until the longest unbreakable token's width (floor) — so the text gains lines and fills the height, never force-breaking a word.
- `_bubble_fit_font_size` → `_bubble_fit_layout`, now returns `(font, block_w, block_h)`; both bubble-fit callers (occ==1, occ>1) centre the squeezed block in the balloon.

**Validation:** 36 `render_overlap` unit tests green (+3 for `squeeze_width`: narrows-tall-box / noop-when-full / stops-at-floor); golden/guard render suites byte-identical (`clean_layout`/legacy untouched). Benchmark (real backend config, MIT_BUBBLE_AREA_FIT=1): Gal Yome EN p4 tall balloon 2 wide → **6 narrow lines** filling height; One-Punch JA→EN dialogue/narration/SFX unchanged. Commit 94bab61 on `worktree-feat-mit-font-s1` (PR #433). ADR 024.

**Relationship:** targeted stopgap inside the bubble-fit path; the general source-agnostic width-squeeze + Knuth–Plass (flag-gated, A/B) stays in PRD #434 / research #435 and reuses `squeeze_width` as-is.

**E2E follow-up + NameError fix (commit e922c7d):** live Playwright E2E through the hayateotsu.space tunnel (Gal Yome ch1 p4, Thai→EN) surfaced that 94bab61 USED `squeeze_width`/`box_containment` in `rendering/__init__.py` but never added them to the `from ..render_overlap import` line → the bubble-fit path raised **NameError** at runtime, which the patch renderer swallows into an "inpaint-only patch" (translated text silently erased). The render_overlap unit tests import the helpers directly and the golden suite doesn't exercise bubble-fit, so neither caught it — only live E2E did. Fix: add both to the import; add a pure guard test asserting every render_overlap helper called in the renderer is imported (37 tests green). Re-verified: 4 patches rendered, 0 NameError, every balloon fills as a narrow multi-line centered column ("CREATED BY THE SOUND CON" → 4 lines filling, "NO PROBLEM LET'S TRY IT" → 4 lines). Two orthogonal observations logged: (a) first uncached translate hit Cloudflare **524** (>100s for full-page inpaint + 4 renders + LLM); the cached re-request returns fast and applies overlays. (b) the live `custom_openai` translator returned terse/garbled text ("INTERESTED OTHER PEOPLE", "65วงหห", "HROK") — a translation-quality issue, not rendering; the layout algorithm is correct regardless.

**Correct EN→Thai E2E + second NameError-class bug (AttributeError, commit bb4100e):** the runs above were Thai-source→EN (Gal Yome's Thai-scanlation version); the user's actual case is the **EN-scanlation version → Thai** (select the **"EN" chip beside "ตอนทั้งหมด"** in the modal — default is ภาษาไทย; confirm counter "1/30" + direction "แปล → TH"). Re-running EN→Thai surfaced a SECOND swallowed crash: the **#436 de-dup** blanks a duplicate region's translation to `''` *inside* `resize_regions_to_font_size`, but the empty-translation filter (`dispatch` line 529) runs *before* it → the blanked region survives, gets a dst_points entry, reaches `render()`, `put_text` returns None → `temp_box.shape` raised **AttributeError**, swallowed into an inpaint-only patch (top panel rendered text-less). Only fires when a region's translation is a substring of a neighbour's AND ≥60% contained (Thai "ปาร์ตี้" inside "…จัดปาร์ตี้ดื่ม…"); the EN-target run stayed under the threshold so it was latent. Fix: guard `render()` to skip a None `temp_box`; add `exc_info=True` to the swallow-warning (it hid BOTH this and the NameError). **Re-verified EN→Thai (real Reader, EN ch1 p4): 0 AttributeError, 3 patches, the tall balloon "เปิดรับนักศึกษาจากภาควิชาอื่นๆ ด้วยนะ…" fills with ~6 narrow Thai lines like the English original's 6-line layout — the user-reported "ตัวเล็กมาก" defect is fixed.** Benchmark method saved to memory `project_gal_yome_en_benchmark`. **Lesson:** unit tests (import helpers directly) + golden render (no bubble-fit path) missed both bugs; only live E2E caught them — added a pure import-completeness guard test, but the render-path None/exception classes still need live E2E coverage.

**Full-chapter benchmark (Gal Yome EN ch1 → Thai, all 30 pages via "แปลทั้งตอน"):** 0 render crashes across the whole chapter (112 patches, 29 text pages); dialogue/thought balloons fill well (tall balloons → ~6 narrow lines: p4 "เปิดรับนักศึกษา…", p14 "ว้าว…", p23 "ถ้าฉันเข้าไปดู COOKP*D…"). **Remaining anomalies** (logged, not fixed this round): (1) **SFX-over-dialogue overlap** — p11 renders SFX "เงียบสงัด" superimposed on dialogue "เรายังไม่ได้บอกใคร…" in one balloon → tracked on **#436** (the de-dup only catches substring duplicates; these are distinct co-occupant regions). (2) stylized SFX/name labels left as romaji/kanji untranslated (TOUJOUFUYUKI p5, PAI p14, 秘密 title) — OCR/translate, #431/#432. (3) a few large bubbles keep small narration (rw/bw → clean-layout) — p14. (4) occasional awkward SFX line-split (p9 "ตังกุณ"). Headline: width-squeeze + the 3 crash fixes hold chapter-wide; the one clear visible defect left is the #436 overlap.

---

## MIT #175 dialogue sizing + #431 SFX overflow (2026-06-30)

**Goal:** translated text must fill its speech balloon (not render tiny), and a stylized in-bubble word must not oversize and overflow the art — matching MangaTranslator. Surfaced on EN→TH (Gal Yome no Himitsu ch1 p4); the JA→EN One-Punch benchmark hid it.

**Root cause:** with `MIT_BUBBLE_AREA_FIT` off, balloon dialogue fell to the legacy length-ratio path → tiny on compact targets; `clean_layout` only sizes non-balloon narration (so One-Punch JP narration looked fine). And `sfx_rescued` (a `len(src)≤4` heuristic) was the SOLE driver of the oversized display regime (`is_sfx` YOLO provenance is dead) → short in-bubble text ("DRINKING PARTY") grew to ~64px and overflowed.

**Change:**
- **S1/S2/S2-corrected (#429/#430):** `processing_scale` (√MP) + two-tier `font_bounds` ([8,16]/[10,64]); `_bubble_fit_font_size` binary-search-fits dialogue to the balloon safe-interior bounded by `[8,16]×√MP` + `anti_overlap`; `clean_layout_font_size` scales the clean-layout font by `processing_scale`.
- **S3 (#431):** pure `display_sfx(sfx_rescued, is_sfx, has_bubble)` — only FREE-FLOATING SFX (no `bubble_box`) takes the display range/cap-exemption; bubble-internal text is dialogue. Wired at the bubble-fit bounds + legacy cap + box-scale clamp.
- **Config:** `MIT_BUBBLE_AREA_FIT=1` (`.env`, `.env.example`) — ADR 023 supersedes the prior OFF decision.

**Validation:** TDD (`test_render_overlap.py` 25 green: processing_scale/font_bounds/clean_layout_font_size/display_sfx); render golden/guard byte-identical. E2E via Reader (real backend config, hayateotsu.space tunnel): Gal Yome EN→TH p4 dialogue fills + "ปาร์ตี้" overflow gone; One-Punch JA→EN no regression (free SFX "GULP"/"NEH" stays big). Worktree branch `worktree-feat-mit-font-s1` (PR #433).

**Residual:** stylized in-bubble word the SFX YOLO splits without bubble association can still render larger than its neighbours (no `bubble_box`) — detection/merge concern, deferred to S4/#432.
## MIT CI: land #359 torch-free blocking gate + baseline rot repair (2026-07-03)

**Goal:** Get the MIT perf hotfix + the stalled #359 CI work onto `main`, then make the MIT logic
gate a real **blocking** check. What started as "open a PR + /scrutinize" cascaded (via 3 rounds of
`/clink-brainstorm`) into untangling several in-flight workstreams off `main`.

**What landed (4 PRs, in order):**
1. **#504 — CI baseline** → `main`: pinned `opencv-python>=4.8,<5.0` (CI had drifted to 5.0.0, whose
   strict-CV_8U `cv2.putText` broke ~13 render/merge tests + the render golden) and **reverted** the
   `test_resize_regions_characterization.py` + 3 goldens that were committed *ahead of impl* (assert
   `page_shape`/`_bubble_fit_layout` absent on main).
2. **#427 (#359)** → `main`: rebased onto the baseline, `pytest (logic gate, torch-free)` green →
   merged. MIT CI is now a blocking torch-free gate (lazy import boundary, ADR 023) + the gitignored
   Kumiko `panel/lib` source is committed (fixes `import manga_translator` in CI/clones/worktrees).
3. **#502 — perf + docs** → `main`: rebased; git auto-dropped the #459 commits (already upstream via
   #414) and collapsed the perf commit to its one unique delta (`functools.wraps` on `_timed_stage`);
   dropped the re-added orphan tests; marked `test_timed_stage` heavy in `conftest._HEAVY_TESTS`.
4. **#503** — tracking issue for re-landing the render-layout characterization tests **atomically**
   with their implementation.

**Key findings (scrutinize/brainstorm):** the perf hotfix (select_hyphenator lru_cache + M1/M2) was
**already on main** via #414's sync, so #502 was mostly redundant; the "second wave" of failures a
reviewer predicted was real (opencv drift + tests-ahead-of-impl), hidden only by the old report-only
job; decision = revert un-shipped-behavior tests (not xfail) and reland atomic.

**Validation:** logic gate green on all 3 PRs + `main` HEAD; opencv 4.13 locally makes
`test_render_golden` pass (proves the pin). Backend + Frontend CI green on main.

**Debt:** render-layout impl (page_shape/clean_layout/`_bubble_fit_layout`) still uncommitted in an
entangled working tree → #503. Impact report: `docs/reports/system-impact-report.md` (2026-07-03).

---

## Wallet Security Hardening V1–V9: DB layer + scrutinize fixes (2026-07-02)

**Goal:** Land the DB-layer deliverables from `feat/wallet-security-hardening` (SQL migrations + unit tests) after the runtime code was already in main. Fix 3 scrutinize blockers before merge.

**Shipped:**
- `Backend/migrations/2026-06-22-wallet-security-hardening.sql` — `wallet_tx_topup_ref_uidx` unique partial index (at-most-once topup credit per Xendit payment_id); drop dead numeric overloads; 4-arg `purchase_unlock_atomic` (reads price/status/creator inside txn — closes TOCTOU window)
- `Backend/supabase-migration.sql` — same DDL mirrored
- `Backend/src/unlock/unlock.service.spec.ts` — 7 tests covering all RPC paths (paid, free, already_unlocked, 4 error cases)
- `Backend/src/wallet/wallet.service.spec.ts` — 3 SECURITY tests (amount mismatch, currency mismatch, non-SUCCEEDED Xendit status)
- `Backend/src/wallet/wallet.controller.ts` — `@UseGuards(AuthGuard, TopupThrottleGuard)` on `POST /topup/create`

**Scrutinize fixes (3 blockers cleared):**
1. Removed duplicate `TopupThrottleGuard` import (TS compile error)
2. Dropped 4 stale `unlock.service.spec.ts` tests that mocked a pre-SELECT code path no longer in `purchaseUnlock`
3. Replaced 6-arg `purchase_unlock_atomic` in migration SQL with the correct 4-arg self-contained version

**Validation:** 78/78 unit tests pass; PR #463 body bilingual EN+TH; system-impact-report.md updated.

**Files touched:** `Backend/migrations/2026-06-22-wallet-security-hardening.sql`, `Backend/supabase-migration.sql`, `Backend/src/unlock/unlock.service.spec.ts`, `Backend/src/wallet/wallet.service.spec.ts`, `Backend/src/wallet/wallet.controller.ts` · **Commit:** `72502dd` · **PR:** #463

## Captcha re-prompt on translate 401 — hotfix (2026-07-01)

**Goal:** When the 1-hour HWID-bound captcha clearance token (#227) expires mid-session, pressing translate `401`'d and only showed an error toast — translation dead-ended until a full page reload. Make the translate 401 re-prompt the Turnstile captcha, same as the page-fetch path.

**Shipped (TDD, 4 files):**
- `Frontend/app/lib/mangaTranslatePage.ts` — new pure `isCaptchaExpiredError(err)` predicate (matches `(401)` / `captcha clearance token`), colocated with the throw sites
- `Frontend/app/lib/mangaTranslatePage.test.ts` — +4 tests (401 single/batch = true; 500 / network / non-Error = false)
- `Frontend/app/hooks/useChapterTranslation.ts` — new `onCaptchaExpired` option; `startTranslate` (batch) + `translateCurrentPage` detect the 401 → call it + toast; batch **skips its 500/network retry loop** (same token would only 401 again)
- `Frontend/app/components/MangaReader.tsx` — extracted shared `resetCaptcha()` (drop token + `setTurnstilePassed(false)`); wired to both the page-fetch 401 path and `onCaptchaExpired`

**Validation:** unit `isCaptchaExpiredError` + full frontend suite **138 pass, 0 fail**; typecheck clean; no new lint warnings. **Live E2E** on `localhost:4000` (real One-Punch Benchmark chapter, authed): inject bogus token → แปลหน้านี้ → backend `401` (`Captcha clearance token is invalid, expired`) → Turnstile "ยืนยันตัวตน" modal re-appeared (screenshot), then test-key auto-solve fetched a fresh token → recovery loop confirmed.

**Report:** post-mortem `docs/reports/2026-07-01-captcha-reprompt-hotfix.md` (+ image `assets/2026-07-01-captcha-reprompt.png`); pointer in `system-impact-report.md`.

---

## 2026-06-15 — Connect MIT to the Dashboard (live telemetry) + Dashboard OAuth (PRD #279 / ADR 018, ADR 019)
Wired the standalone Dev console to **live MIT data** and added **Supabase OAuth** so the dev's token reaches MIT,
which verifies it independently (zero-trust, no shared secret). MIT-only slice — Backend/Frontend `/status` are
separate (#282/#283, akkanop-x refactoring). Operator decisions (locked before build): SSE **event-push** (no loop on
the event tier) + sampled metrics; **forward JWT, MIT verifies per-service**; **MIT only**.

**MIT (new, import-light, TDD <1s — 24 tests):** `server/status_snapshot.py` (`build_snapshot`/`to_messages` — folds
metrics+diagnostics+queue/workers into the wire shape `Dashboard/lib/snapshot.ts` consumes; the `metric` frame carries
the whole snapshot), `server/auth.py` (`verify_supabase_token` via Supabase `GET /auth/v1/user` — **no PyJWT, no JWT
secret in MIT**, mirrors the Backend's `getUser`; robust to the new asymmetric `sb_publishable_…` keys — `is_staff` =
staffLevel claim OR `MIT_STAFF_USER_IDS` allowlist), `server/status_hub.py` (asyncio pub/sub, non-blocking `put_nowait`
fan-out → event push, no event-tier loop), `server/status_stream.py` (`format_sse` + hybrid `status_frames`: initial
sample → push events via `wait_for`, sample on the interval timeout). **Wired into** `main.py` (`GET /status` +
`GET /status/stream` behind a `require_staff` dep that re-validates every 60 s + closes on expiry; throttled gateway
probe cached `MIT_DIAG_INTERVAL_S`; parent server only — never the RCE-by-design worker) + `myqueue.py` (`add_task`
pushes a `translate_triggered` event — one chokepoint).

**Dashboard (new, TDD — 11 tests; 91 total green):** `lib/live.ts` (`parseSseFrames`, partial-frame safe),
`lib/live-map.ts` (`mapMitSnapshot` mb→GB), `lib/supabase.ts` (browser client), `components/auth-gate.tsx` (Google
OAuth gate + `useDevAuth` token context; splash never hangs — getSession stall falls through), `components/
use-live-snapshot.ts` (fetch-stream `/api/live`, fold via `snapshot.reduce`, backoff reconnect, mock fallback),
`app/api/live/route.ts` (authenticated SSE proxy — forwards the dev JWT to MIT, holds no secret). `page.tsx` telemetry
(GPU util/temp/VRAM/power, CPU/disk, RAM) + a live/offline/connecting badge + MIT-status chip now read live data when
signed in, else mock. `shell.tsx` gains an account/sign-out row.

**Verified:** MIT pure modules 24/24; Dashboard 91/91; sibling import-light server tests 20/20 (no regression).
**E2E (real Supabase, MIT on :5013 parent-only):** real GPU/host metrics flow through `build_snapshot`
(`util/temp/VRAM/power`, RAM, disk 99.1%); `/status` + `/status/stream` + `/api/live` reject **no-token → 401** and
**garbage token → 401** (MIT actually calls Supabase `/auth/v1/user` and returns its `Invalid or expired token`,
passed through the proxy) — independent per-service verification confirmed; the OAuth login gate renders. Remaining
(human step): a *valid* token via Google sign-in → 200 + live cards (OAuth can't be driven headlessly); first sign-in
needs the dev's user id added to `MIT_STAFF_USER_IDS`. Provenance in PIPELINE.md §5; full 18-section impact report in
`docs/reports/system-impact-report.md`; decision in ADR 019.

**Follow-up (same day): GitHub login + forced-for-dev.** Added a "Sign in with GitHub" button (primary) alongside
Google (secondary) in the Dashboard gate, and **enforced GitHub for dev-tier access** — `auth.is_staff` gained a
`require_provider` param (checks `app_metadata.provider`/`providers`), wired in `main.py` via `MIT_DEV_REQUIRE_PROVIDER`
(default `github`): an allowlisted/claimed **Google** account is denied dev (highest-privilege console = repo-collaborator
GitHub identity; Google kept for future lower tiers; set the env empty to disable during rollout). `auth` tests 8→12;
verified the two-button gate + "Dev access requires GitHub" note render. GitHub provider still needs a one-time Supabase
enable (GitHub OAuth App + Authentication→Providers→GitHub). ADR 019 updated.

**Follow-up (same day): Dashboard auth = Frontend parity (Email + Google + Facebook) + GitHub + in-app linking.** Per the dev's call (standalone console must NOT depend on the Frontend for linking, and tiers differ: Moderator→Google, Admin→both, Dev→GitHub), ported the Frontend's auth into the Dashboard standalone: popup OAuth (`signInWithOAuth({skipBrowserRedirect})` → `app/auth/callback/page.tsx` postMessages the session back — fixes the earlier redirect-to-Site-URL + surfaces errors in-app) for Google/Facebook/GitHub, email/password (sign in / sign up / reset), and a multi-provider **link/unlink** panel (`components/account-panel.tsx`, `lib/account.ts` pure + tested) + add-email/password. New pure libs: `lib/account.ts` (5 tests), `lib/oauth.ts` (`mapOAuthError`, 5 tests — incl. the manual-linking "Multiple accounts in linking domain" → "sign in with your existing provider, then link"). `auth-gate.tsx` is now a full DevAuth provider; `login-screen.tsx` mirrors LoginModal (3 OAuth + email form). Diagnosed the dev's GitHub sign-in failure via Supabase MCP: DB clean (1 google user, UUID 9c7f7717), the error = **manual-linking is on** (the app's multi-platform feature) so GoTrue refuses to auto-link a fresh GitHub sign-in onto the existing email → the dev links GitHub in Account instead. Dashboard tests 91→**101** green; login screen verified rendering all 4 methods at `https://dashboard.hayateotsu.space`. Supabase setup still needed: enable GitHub provider + redirect URLs cover `/auth/callback`.

**Bug fix (same day): OAuth callback hang + navigator.locks deadlock (redirect flow).** Switched Dashboard OAuth from popup → full-page redirect flow per the dev's preference, then debugged a "/auth/callback hangs" report (debug-mantra + scrutinize). Two real bugs: (1) the root-layout `<AuthGate>` gated EVERY route incl. `/auth/callback`, so a signed-out callback rendered `<LoginScreen>` instead of the callback page → the token-exchange/redirect never ran (fix: `isCallback = usePathname()==='/auth/callback'` bypass → always render the callback page there); (2) Supabase's default `navigator.locks` lock could deadlock `getSession()`/the OAuth exchange (fix: no-op `lock` in the client — single-tab console needs no cross-tab serialization). Diagnosis was clouded by Playwright/browser caching stale client JS + flaky Turbopack HMR file-watch — proved the fix correct by curling the SSR HTML (`/auth/callback` → 0 login buttons + the spinner) and grepping the served client chunk for the marker (fresh code served on both sides). Also: redirectTo settled on `${origin}/auth/callback` paired with a `https://dashboard…/**` Supabase Redirect-URL (a bare-origin allowlist entry is exact-match only → falls back to Site URL). 101 Dashboard tests green.

**Follow-up (2026-06-16): unified debug console + GitHub auto-link + recharts dup-key fix + `/service/mit` live wiring.**
Closing out the MIT↔Dashboard connection so the MIT service uses real data instead of mock where MIT actually reports it.
- **Unified debug console** (`components/debug-console.tsx`, `lib/debug-log.ts` + tests): one filterable in-app log surface fed from four sources — Dashboard, Frontend, **Backend**, **MIT** (the live-stream hook pushes each MIT `event`/`status` frame as a log line). Renders only when Supabase is configured.
- **GitHub auto-link** (`components/github-auto-link.tsx`): a signed-in dev whose identity lacks `github` auto-fires `linkIdentity('github')` (the standalone console requires the repo-collaborator GitHub identity for Dev tier; the Frontend has no GitHub-link UI since it's Dashboard-only). The signed-in `linkIdentity` path bypasses GoTrue's "Multiple accounts in linking domain" 500 (that check only runs on the sign-in/create path, `targetUser==nil`) — verified end-to-end: signed in with Google → github linked → `providers=["google","github"]`.
- **Recharts duplicate-key fix** (`components/metric-card.tsx`): short live series at minute-resolution tick labels produced non-unique x-ticks (`tick-10:25-28-28` React key spam) — deduped via `[...new Set([first, mid, last])]`.
- **MIT `control_ms`** (`server/diagnostics.py`, `server/status_snapshot.py`): the gateway probe now times the `GET /models` control-plane call separately from the chat data-plane call, so the Dashboard's GatewayDiagnosis control-vs-data split is real (control up + data timeout = "model hung", the 2026-06-14 incident signature). `test_diagnostics` + `test_status_snapshot` updated → 13 pass.
- **`/service/mit` detail page live-wired** (`app/service/[id]/page.tsx` + `lib/live-panels.ts::liveGatewayProbe`, pure + 4 tests): header status badge (`up/degraded/down` + `· live`), telemetry cards (GPU util/temp/power, VRAM used/total, queue depth + worker count), VRAM-panel host total, and GatewayDiagnosis (live control/data split) now read live MIT data when signed in. Panels MIT doesn't instrument stay **honestly mock** (GPU history charts, per-card sparklines, stage timing, quality, per-model VRAM breakdown, translate-queue job list, worker-lifecycle internals). The stream connects only on the MIT page (`useLiveSnapshot(id==='mit' ? token : null)`).
- **Account-linking conflict** (research only — feature deferred): documented the "user has N Supabase accounts across N GitHub emails" UX in `docs/research/oauth-account-linking-conflict.md` + `docs/prd/account-linking-conflict-resolution.md` (choose-which-account-to-link + email-confirm flow); touches Backend so it's parked for akkanop-x coordination.
- **Verified:** Dashboard `bun test` **101→115** green (live-panels +4); MIT diagnostics+snapshot **13** green; typecheck clean on the touched files (`page.tsx`, `live-panels.ts` — the residual recharts-Formatter + `bun:test`-in-tests tsc errors are pre-existing, excluded from the real build); `/service/mit` SSR 200, no error overlay. Stack restarted clean: MIT :5013 (new code, parent-only, gateway probe on 9arm), Frontend :4000, Backend :4001. Provenance: PIPELINE.md §5 (`diagnostics.py`/`status_snapshot.py`), impact report 2026-06-15 increment.

**Follow-up (2026-06-16): MIT-side telemetry instrumentation — real data for the `/service/mit` panels (queue / stage timing / worker lifecycle / per-model VRAM leak monitoring).** The dev asked to make the MIT detail page show real status instead of mock; this is the **MIT side only** (emit the data — the Dashboard wiring that reads it is a later step). For each panel, instrumented the real source where one exists; dropped what doesn't.
- **Queue jobs** (parent-side, real now): `TaskQueue.jobs_snapshot()` → `queue.jobs[]` (id / task_type / page / waiting_ms); `QueueElement` gained an id + enqueue time. Pure transform `server/queue_view.py` (4 tests).
- **Stage timing** (worker→parent): `webhook.make_telemetry_hook` times each pipeline stage (gap between consecutive stage starts) and POSTs it to the parent's new `POST /internal/telemetry` (`X-Nonce` auth, same as `/register`); folds into `stages[]`. Hook added in `share.py` alongside the existing progress hook. (3 tests)
- **Worker lifecycle** (parent-side): the worker sends its `os.getpid()` at registration, the parent stamps `registered_at` → `workers.detail[]` (pid / uptime / busy). `ExecutorInstance` gained `pid`/`registered_at`; pure `server/worker_view.py` (3 tests).
- **Per-model VRAM leak monitoring** (the dev's real debug need — a model that doesn't return VRAM on unload → bloat, hunted by hand): **Tier 1** — the worker's `torch.cuda.memory_allocated/reserved` (`vram_probe.py`) → `vram.{allocated_mb,reserved_mb}` (reserved climbing while allocated flat = the leak; nvidia-smi total in `metrics` covers onnx). **Tier 2** — `ModelUnloader` (the one #188 unload seam) measures how much each unload frees; `VramTracker` **learns each model's footprint from its largest clean release** and flags an unload that frees far less (`leaked:true`) → `vram.models[].{footprint_mb,freed_mb,leaked}`. Keyed by the unload tool (detection/ocr/inpainting/…). **No load-site instrumentation** — the touch sites are pre-load and post-load deltas are activation-noisy, so footprint is learned from unloads instead (simpler + robust). `manga_translator/vram_tracker.py` (5 tests). Worker reports the VRAM report after each page via the same telemetry channel.
- **Quality / run-summary: removed** per the dev (the marquee fields — parity %, tokens — have no real source). Trimmed the speculative `run` ingestion.
- **Snapshot shape:** `build_snapshot` now carries optional `queue.jobs`, `workers.detail`, `stages`, `vram` (absent when empty → lean; the Dashboard reducer ignores unknown keys). `telemetry_store` (`apply` dispatches `stage`/`vram`) is the parent-side sink; the worker pushes via `/internal/telemetry`.
- **Verified:** full MIT suite **519 passed / 0 new failures** (19 pre-existing: 18 async-config + `test_registry_trim` from the flux-inpainter PR #277, none mine); ~25 new import-light tests (<1s each). Note: VRAM/stage/queue are worker data → empty in the parent-only dashboard MIT until a GPU worker runs + translates; unit tests pin every hop. Engineering note: hooking the #188 `ModelUnloader` / `dispatch_registry` seams cleanly is the direct payoff of the ~3.4k-line god-object decomposition. Provenance: PIPELINE.md §5 (server new + `model_unloader`/`instance`/`myqueue` + manga_translator new), impact report 2026-06-16 increment.

**Follow-up (2026-06-17): Dashboard wiring — `/service/mit` reads real MIT data on every graph/panel (or "No Data").** The dev confirmed (screenshot, ~10:34) the graphs were still mock — only GPU util/VRAM/queue-depth *numbers* were live; the sparklines + lower panels didn't move with usage. Wired the Dashboard half (MIT already emits the data).
- **Live-graph foundation:** `lib/live-series.ts` (pure rolling per-metric accumulator, 5 tests) — MIT sends current values per SSE frame, so the dashboard accumulates each frame into a ring buffer → the static mock sparklines become live charts. `lib/live-map.ts` now exposes `stages`/`vram`/`queueJobs`/`workersDetail` (optional). `components/use-live-snapshot.ts` keeps the rolling `series` + stamps event arrival time (`lib/snapshot.ts` reducer adds `at` so the LogStream shows real timestamps).
- **Real x-axis (follow-up same day):** `use-live-snapshot` also accumulates `seriesT` (epoch ms per frame); `page.tsx` formats it → `HH:MM` and passes a `times` prop to `metric-card` + `gpu-detail`, which plot against the **real wall-clock of each sample** (right-aligned) instead of the fixed mock 10:25–10:35 `TIME` window — fall back to mock when not live.
- **`mit@console` made functional (follow-up same day):** `lib/mit-console.ts` (pure, 10 tests) — a real READ-ONLY command interpreter over the live status snapshot: `status`/`gpu`/`host`/`vram`(per-model+leak)/`gateway`(control vs data)/`queue`/`workers`(pid/uptime)/`stages`/`logs`/`help`/`clear`. `ServiceTerminal` gains `mitConsole`/`mit`/`events` props → uses it for the MIT page (mock terminal elsewhere). **No arbitrary shell, no mutating/control actions** — the worker is RCE-by-design and is never driven from the browser; unknown commands rejected, "not connected" until the stream is live.

**Planning + I1 foundation (2026-06-17): Dashboard redesign epic — live-native (real MIT or "No Data") + Finesse UI (tech-debt).** A `/grill-me` session locked the design tree (whole dashboard → live-or-No-Data; only MIT has a live feed so non-MIT → No Data; empty Frontend/Backend pages → one page-level "telemetry not wired (#282/#283)" message; MIT feed → real `live.events`; pipeline stages → timing-only from `mit.stages`; mixed panels → per-item; mock consts → deleted; "No Data" English-only). The user expanded scope to a **full redesign** (Finesse UI reference, https://finesseui.com/) → **merged** with the de-mock (full overhaul throws the markup away, so rebuild live-native rather than de-mock-then-redesign). Published the plan: PRD `docs/prd/dashboard-live-or-no-data.md` (bilingual) + GitHub issues **#304** (PRD/epic, child of #279), **#305** (I1 — data foundation, ready-for-agent), **#306** (I2 — Finesse UI design system, HITL). I3–I6 (rebuild overview / `/service/mit` / FE-BE+shell / delete-old-mock) deferred until I2's design lands (build slices need the design).
- **I1 durable foundation built (TDD, 9 new tests):** `lib/panel-source.ts` — `isNoData(value)` (null/[]/""=No Data, but **0 is data**) + `panelSource(id)` → `mit-live`/`mixed`/`no-source` (unknown → `no-source` fail-safe, never over-claims); `lib/live-panels.ts::livePipelineStages` — `mit.stages` → timing-only stage view (translate keeps gateway state, untimed=idle, before-first-translate=all-idle, no faked detail); `hooks/use-mit-live.ts` — folds the `useDevAuth`→`useLiveSnapshot`→`liveMit`/`series`/`seriesT`/`events` boilerplate into one hook (`connect` param so non-MIT pages open no SSE); `components/no-data.tsx` — `<NoData>` + `<NoDataPage>` primitives (minimal default; final visual owned by I2). **Old-consumer refactor deferred** to the rebuild slices (I3–I5) — those surfaces get rebuilt, so adopting `useMitLive`/`<NoData>` happens then (don't touch twice). Verified: `bun test` **130→139** green, typecheck clean on the new files.
- **Components (8, parallel workflow + 1 by hand):** each takes a live prop + renders a centered **"No Data"** placeholder when the live data is present-but-empty, keeping the mock path backward-compatible (shared cards/log-stream still serve frontend/backend pages). metric-card (empty `data`→No Data), gpu-detail (`series?` → 4 live charts + 3 No-Data), stage-timing/translate-queue/log-stream (empty→No Data), vram-panel (`live?: MitVram` → per-model bar + **LEAK badge**), worker-lifecycle (`workers?`), quality-panel (`live?` → No Data, run-summary was removed).
- **`page.tsx` integration:** maps live MIT telemetry into each panel's shape (live stages→`StageTiming` w/ baselines, `MitJob`→`QueueJob`, events→`LogEntry`) and passes the accumulated `series` to the cards + GpuDetail; `liveMit` gates live-vs-mock.
- **Honesty boundary:** live now → GPU util/VRAM/temp/power/fan + CPU usage sparklines, GpuDetail (4 of 7), worker pid/uptime, gateway. Live after a translate → stage timing, VRAM-by-model(+leak), queue jobs, logs. **No Data** (no MIT source) → pages/min, CPU temp, Graphics/CPU clock, quality panel.
- **MIT restart:** killed a stale 14-Jun full MIT worker (orphaned `python3.11.exe` on :5004 holding ~3.9 GB VRAM — the worker-restart-gotcha) → VRAM 6.6→2.7 GB used; relaunched a **full GPU worker** on :5013 (`--use-gpu --start-instance`, gateway translator so no local LLM) so the worker telemetry actually flows.
- **Verified:** Dashboard typecheck clean (touched files; residual recharts-Formatter + `bun:test` errors pre-existing), `bun test` **120 pass**, `/service/mit` SSR 200 no error overlay. Workflow: 8 component agents (1 transient 500 redone by hand).

---

## Staff Console — PRD + ADR 018 + Phase-1 issues, out-of-band observability (2026-06-14)

Designed the **Staff Console** (role-tiered back-office: Moderator/Admin/Dev) off the 2026-06-14 9arm incident (gateway `gateway.9arm.co` up, but `qwen3.6-35b-a3b` model hung → cryptic `'ollama servers did not respond quickly enough'` after ~90s; root-caused by black-box probe — `/models` OK 0.19s, a 16-token completion timed out 151s = inference backend hung, external). A full `/grill-me` pass settled the design, then a resilience review reshaped the Dev console's data plane.

- **Key decision (ADR 018):** a monitor must not share a failure domain with what it monitors → a **standalone Node-Fastify aggregator microservice** (out of the Backend, runnable local/separate host) subscribes to a per-service `/status/stream` SSE on Frontend/Backend/MIT; each multiplexes **sampled `{type:metric}`** (VRAM/CPU/temp via `torch.cuda`+`psutil`+`nvidia-smi`, zero new dep) + **pushed `{type:event}`** (translate-triggered/stage/log/error). UI stays in the Frontend (`/staff/system`, shadcn). External uptime monitor → Discord = out-of-band backstop.
- **Auth (zero-trust, no shared secret):** orthogonal `profiles.staffLevel` (none<moderator<admin<dev), injected as a **signed JWT claim** via a Supabase Custom Access Token Hook; the dashboard forwards the dev JWT and **each service verifies independently** (signature + expiry + claim), streams re-validate ~60s + close on expiry; MIT gains PyJWT verify.
- **Published (bilingual, `ready-for-agent`):** PRD **#279** + Phase-1 slices **#280** (1a RBAC+signed-claim+shell) → **#285** (1f aggregator+streams) → **#282** (1b health board, the incident fix) / **#283** (1c tracer+queue) / **#284** (1d GPU/host); **#281** (1e precise error) independent. **ADR 018** `docs/adr/018-staff-console-out-of-band-observability-aggregator.md` + indexed in the ADR README.
- **MIT modules built (TDD + karpathy, branch `feat/mit-staff-observability`, MIT-only — Frontend/Backend deferred while akkanop-x refactors them):** `server/diagnostics.py` (cheap bounded gateway probe, decoupled from the worker pool → `ok/slow/timeout`·model-down-vs-gateway-down`/auth/unreachable/model_missing`; the 2026-06-14 incident reads `timeout` + "gateway /models OK but chat completion timed out — model not responding"; 7 tests) · `server/translate_error.py` (`classify_translate_error` → structured `{stage,translator,endpoint,model,cause,hint}`, wired at the `custom_openai` timeout raise → worker log + backend response carry it instead of the opaque string; 4 tests) · `server/metrics.py` (`parse_nvidia_smi` + `host_metrics` (psutil), `collect` degrades host-only when no GPU, zero new dep; 5 tests). 16 new tests, **full MIT suite 463 passed / 19 pre-existing async / 0 new**. PIPELINE.md §5 + ADR 018 referenced. SSE `/status/stream` endpoint + JWT verify deferred (need 1a's Supabase signed-claim hook = Backend/Supabase).
- **Side fix:** shadcn MCP cwd gotcha — Claude Code `.mcp.json` has no `cwd` field → added wrapper `Frontend/run-shadcn-mcp.ps1` so the server runs in `Frontend/` and reads `components.json` (`@react-bits` + `radix-rhea`); needs a full Claude Code restart (reconnect does not reload config).

---

## CI test gates — GitHub Actions, first CI in the repo (2026-06-28, #355)

**Goal:** run the 176 existing test files automatically on every PR — closing the gap where tests relied on two self-merging devs remembering to run them locally.

**Shipped (PR #355, squash-merged to main `31b7a31`):**
- `.github/workflows/{backend,frontend,mit}-ci.yml` — path-filtered per service.
- `backend-ci`: bun install (not `npm ci` — `package-lock.json` is stale) + jest on **Node 22** + Redis service, `--runInBand`. **62 suites / 616 tests green on CI.**
- `frontend-ci`: `bun test`, excludes `*.integration.test.ts` (needs live `:4000`). **120 green.**
- `mit-ci`: pytest **report-only** (`continue-on-error`) until torch is lazy-imported (#359).
- `Backend/jest.ci.config.js` — inherits `package.json`'s jest block (single source of truth) + a documented skip-list of pre-existing failures (#358); converges to zero.

**TDD (first skip-list shrink):** `books-health.spec.ts` RED→GREEN — `jest.spyOn(global,'fetch')` + `restoreAllMocks()` deletes Node's lazy `fetch` global, so the 2nd test threw "Property `fetch` does not exist"; fixed by assigning `global.fetch` directly + save/restore. Skip-list **9 → 8**; re-enabled in CI (real path: `BooksService → MitTranslationService → MitClient.ready → fetch`).

**Process:** scrutinized before merge (per policy) → found + fixed MAJOR 2 (jest config was duplicated, would drift) in-PR; filed the rest as #356 (safe required-checks before branch protection), #357 (pin bun + empty-files guard), #358 (shrink skip-list), #359 (MIT lazy torch). Dev box needed **Node 22** (Jest 30 can't run on Node 26 — `setTimeout` undefined in sandbox); installed via nvm-windows. ADR `docs/adr/020-ci-test-gates.md`; impact report 2026-06-28 (CI gates).

## Coin Topup System — Xendit PromptPay QR (2026-06-19, sandbox)

**Goal:** Implement real payment flow for coin topup — replacing the dev-only `POST /wallet/topup` stub that throws 403 in production.

**Shipped:**
- Supabase migration `create_coin_topups` applied (`payment_id PK`, idempotency `UNIQUE` index)
- `Backend/src/wallet/xendit.service.ts` — wraps Xendit `/payment_requests`, no SDK
- `Backend/src/wallet/dto/create-topup.dto.ts` — `@IsInt() @Min(20)`
- `wallet.service.ts` — `createTopup`, `getTopupStatus`, `processXenditWebhook`; webhook fails-closed when env var unset; idempotency check prevents double-credit
- `wallet.controller.ts` — 3 endpoints (`topup/create`, `topup/status/:id`, `xendit/webhook`); webhook is public (no AuthGuard, no HardwareIdMiddleware)
- `app.module.ts` — exclude `wallet/xendit/webhook` from `HardwareIdMiddleware`
- `Frontend/app/components/TopupModal.tsx` — TIER_SELECT → QR_DISPLAY (3s poll + countdown) → SUCCESS; dispatches `mb:coin-balance-update` on success
- `NavbarActions.tsx` — coin balance chip + TopupModal + balance update listener
- `BookDetailModal.tsx` — inline mock form → `<TopupModal>`; removed dead `topupAmount`/`topupLoading`/`handleTopup`
- `studioApi.ts` — `createTopup`, `getTopupStatus` API functions; removed dead `topupCoins`
- `qrcode.react@4.2.0` installed; `.env.example` updated with Xendit placeholders

**Code review findings fixed:**
- Constructor arity bug in `wallet.service.spec.ts` (would have broken CI)
- Webhook token guard hardened: fails-closed when `XENDIT_WEBHOOK_TOKEN` unset
- `getTopupStatus` expiry update guarded with `.eq('status', 'pending')` — prevents overwriting a `paid` row
- `XenditService` throws `InternalServerErrorException` (was bare `Error`)
- `mb:coin-balance-update` dispatched from TopupModal — Navbar chip now updates from both entry points

**Validation:** Backend 607/607 tests green (+12 new); Frontend tsc 0 errors.

**Next:** Add real Xendit sandbox keys to `.env`, set webhook URL `https://web.2552667.xyz/api/xendit/webhook` in Xendit dashboard, subscribe `payment.succeeded` event — then E2E test with a real PromptPay scan.

---

## #298 — เคลียร์ 2 tsc error ใน specs + refresh stale memory (2026-06-18, /tdd+/debug-mantra, branch `fix/303-upload-magic-byte-validation`)

**Root causes (2 distinct TS errors, 10 instances total):**

- `src/cache/l3-batch-writer.spec.ts` — TS2339 ×4 (`mockClear` missing): `makeL3()` was cast to `L3DiskService` only → `l3.write` typed as the real method signature, not `jest.Mock`. Fix: `as unknown as L3DiskService & { write: jest.Mock }` (intersection exposes `.mockClear()`).
- `src/common/middleware/hardware-id.middleware.spec.ts` — TS2540 ×6 (`path` is read-only): Express types declare `Request.path` as a getter, so `mockRequest.path = x` fails on `Partial<Request>`. Fix: `Omit<Partial<Request>, 'path'> & { path?: string }`.

Both fixes are type-declaration-only — zero runtime behaviour change. `npx tsc --noEmit` → 0 errors. 53/53 tests GREEN on the two affected files.

**Memory refreshed:**
- Local `reference_mangadex_uploads_ua_block.md`: updated URL (`hayateotsu.space→2552667.xyz`), branch, and marked FIXED.
- Team `project_backend_pre_existing_test_failures.md`: added tsc-error history and resolution.

---

## #296 — test upload.service magic-byte MIME (security/test) (2026-06-18, /tdd, branch `fix/303-upload-magic-byte-validation`)

**Goal:** add explicit test coverage for the magic-byte MIME validation path committed in #303 (`upload.service.ts:addPage`).

**Added (3 new tests → 8 → 11 in `upload.service.spec.ts`):**
- `image/svg+xml` rejection — SVG is `image/*` but carries inline JS; not in `ALLOWED_MIME_TYPES` → rejected before storage.
- Storage `put()` failure cleanup — if the CDN/S3 call throws after MIME passes, the temp file must still be unlinked (lines 78-82).
- Non-owner rollback — if the DB row shows a different `translator_uid`, the already-stored file must be deleted via `storage.delete()` (lines 107-110).

**`makeService` minimal extension:** added `storageDel?: jest.Mock` (makes `storage.delete` assertable) and `versionRow?: Record<string, unknown> | null` (drives ownership + not-found paths) overrides. Existing 8 tests unaffected.

**Result:** 11/11 GREEN, 0.675 s. Full backend suite clean (no regressions).

---

## #303 — upload path skipped magic-byte MIME validation (security bug) (2026-06-17, /tdd, branch `fix/303-upload-magic-byte-validation`)

**Bug:** the chapter-page upload trusted the **client** Content-Type on both layers, contradicting `CLAUDE.md`'s "upload — MIME validated with `file-type` (magic bytes, not extension)". `upload.controller.ts` `fileFilter` checks `file.mimetype` (Multer sets it from the attacker-controlled multipart `Content-Type`); `upload.service.ts:addPage` re-checked that same client arg against `ALLOWED_MIME_TYPES` and never read the bytes. A `<script>` payload sent as `Content-Type: image/png` passed both gates and was stored as `.png`. Surfaced by #296 while writing its magic-byte tests.

**Fix (TDD, mirrors `forum.service.ts:444,489`):**
- `addPage` now runs `await fileTypeFromFile(tempFilePath)`, rejects when nothing is detected (empty/truncated/undetectable) or the detected mime is outside `ALLOWED_MIME_TYPES` — **even when filename/extension/client-mime say image** — and derives the stored extension from the **detected** mime. Temp file unlinked on every reject path.
- Removed the now-unused client `mimeType` arg from `addPage`; controller no longer threads `file.mimetype`. `fileFilter` kept as a cheap first gate only (comment records it is not authoritative).
- Cleaned in passing: dead `path` import (controller) + unused `err` in `deletePage`.

**RED→GREEN:** new `upload.service.spec.ts` (8 tests). The disguised-file test was RED on the old code (it trusted `image/png` → reached storage) = the mutation check. GREEN after the fix.

**Verify:** `npx jest src/upload` 8/8; full backend **58 suites / 540 tests green**; `eslint` clean on the 3 touched files; no new `tsc` errors (the 10 standing are #298, not yet merged onto this branch). **Not run:** live in-app upload E2E — recommend a confirmatory pass with the PR.

**Docs:** ADR 016 (`docs/adr/016-upload-magic-byte-mime-validation.md`, defense-in-depth decision) + index; post-mortem entry in `docs/reports/system-impact-report.md`. The `CLAUDE.md` upload claim was aspirational before; it is now accurate. **#303 unblocks #296** (its security AC is satisfiable; those tests already live in `upload.service.spec.ts`). **Follow-up:** factor a shared magic-byte upload-guard helper across forum + upload.

## Flux.2 Klein-4B optional inpainter — feasibility proven + PRD/issues (2026-06-14, ultracode)

Closed out the #268 "VRAM-neutral band fix" research: **no classical lever fixes the band cleanly** — `lama_lum_reground` was *measured* to move the band the wrong way (146→154), `mask_tighten` left a **ghost** of the original text everywhere it sat, `seamless_clone` had no effect. The band's *texture* component (LaMa's smooth fill vs hair strands) needs reconstruction, not luminance math. Disabled `MIT_MASK_TIGHTEN` (ghost fix); did **not** merge the non-Flux levers branch — main stays at #265.

**Probe (grounded, RTX 4070 SUPER 12.88 GB):** `MIT/tools/probe_flux_klein.py` (+ `_v2`). ADR 002's "Flux = OOM" premise was wrong because it counted the 8 GB VLM text-encoder as resident — our removal prompt is **fixed**, so the encoder runs once, its embedding is cached, and it is dropped before the per-page loop.
- v1 (synthetic embed, 2.6 GB download): Q4 GGUF transformer resident +2.87 GB; **peak 5.8 GB/page** (7 GB headroom).
- v2 (real encoder, raw One-Punch page): removed all text + the big ぬ SFX and **reconstructed hair texture — no band, no ghost**; 9.4 GB one-time encode spike (fits); ~3–4 s/page (Klein step-distilled, 4 steps). Output in `MIT/tools/_flux_proof/`.

**Decision: add Flux.2 Klein-4B (GGUF Q4) as an OPTIONAL inpainter** (default off, LaMa-large stays default). diffusers + GGUF backend (pip-only, native cpu-offload, trivial load/unload) over nunchaku (fragile Windows CUDA wheel) / sd.cpp (subprocess bridge). VRAM-neutral via cached embed + load/unload; whole-page edit + patch-composite keeps art outside the mask byte-identical (#156).

- **ADR 003** `docs/adr/003-mit-flux-klein-optional-inpainter.md` — overturns ADR 002 (now marked **Superseded by 003**).
- **PRD #272** + 4 coherent sub-issues: **#273** GPU-free foundations (embed-cache + image-prep + tests) → **#274** FluxKleinInpainter + enum/registry + lazy load + guarded smoke → **#275** Backend `MIT_INPAINTER` toggle + renderConfigHash cache-bust → **#276** E2E across diverse manga + report/ADR/docs. All bilingual EN+TH, `ready-for-agent`, blocked-by chained.
- **New rule (memory):** any quality/perf-affecting or non-trivial change now writes an ADR (`docs/adr/NNN`) in addition to the report; decisions that overturn an earlier one mark the old ADR Superseded.

**Flux inpainter implementation — S1-S3 of #272 (2026-06-14, /tdd, high).** Built the optional inpainter via TDD, all green.
- **#273 GPU-free foundations** — `manga_translator/flux_embed_cache.py` (`get_embed(encoder_fn, prompt, cache_dir)`: encode-once → persist `.npy` (atomic tmp+replace) → reuse; keyed by prompt so a change busts; pure numpy/hashlib/os) + `flux_image_prep.py` (`pad_to_multiple`/`unpad`: edge-pad to mult-of-32 with an exact inverse). 9 unit tests (`test_flux_embed_cache.py` ×4 with a fake encoder + no diffusers import, `test_flux_image_prep.py` ×5 byte-exact round-trip).
- **#274 FluxKleinInpainter** — `inpainting/inpainting_flux_klein.py` (`OfflineInpainter`: `_load` lazy-downloads the Q4 GGUF transformer + VAE, encodes the fixed prompt ONCE via `flux_embed_cache` then drops the 8 GB encoder; `_infer` pads → Klein 4-step edit → unpads → blends `where(mask, edited, orig)` so outside-mask = byte-identical; `_unload`). `Inpainter.flux_klein` enum + `INPAINTERS` entry; heavy deps imported lazily so the registry import never needs them. `diffusers>=0.38`+`gguf` added to requirements. Tests: enum/registry-resolves/lazy-import/missing-deps-raises (no GPU) + a **guarded GPU smoke** (skips without the model) that passed real — load+infer on a 256×192 image, outside-mask byte-identical; 2nd run 19.8 s confirmed the embed cache skips re-encoding.
- **#275 Backend toggle** — `MIT_INPAINTER=flux_klein` already mapped in `buildMitConfig`; verified it folds into `renderConfigHash` (hashes all `MIT_*`) so switching busts the patch cache. +2 Jest (flux_klein select + hash-bust); 34/34 green. Documented in `Backend/.env`.
- **#276 One-Punch E2E — PASSED (operator-confirmed "100%").** Through the live Reader (cache:reset + backend restart so the renderConfigHash change re-translated fresh): with `MIT_INPAINTER=flux_klein` the dark-hair band region matches the MangaTranslator target — texture reconstructed, no painted band — while the default-LaMa run (mask_tighten off) already cleared the narration-box ghost. ADR 003 → implemented. Remaining for #276: the broader diverse-manga set + the full impact-report entry.

**Multilingual SFX + line-break parity — TH/ZH/KO catch up to ENG (2026-06-14, /tdd, xhigh).** The render-parity work (SFX translation, narrow-column wrapping) was English-biased; the user showed raw JP ぬ + poor wrapping for Thai/Chinese/Korean.
- **Root cause (debug-mantra + instrumentation):** the SFX rescue was nested inside the OCR value/lang filter, which only caught the SFX when the misread (OCR'd ぬ → "X") happened to match the target — i.e. when `source_lang == target_lang`, true only for ENG. For TH/ZH/KO the "X" passed the filter → normal-translate → dropped → the ぬ was never inpainted (raw JP survived).
- **Fix:** moved the SFX rescue to run BEFORE the filter, target-independent (large region + ≤4-char OCR = SFX signal), with a `continue` on success — so every target gets its SFX rescued + inpainted. `ocr_vlm.py`: `_PROMPT`→`build_sfx_prompt(target_lang)` (ENG byte-identical; asks for the target language's onomatopoeia + an explicit script hint so qwen-VL stops echoing Japanese kana for a Chinese/Korean request), `sanitize_sfx(raw, target_lang)` keeps the target script via `unicodedata` L/M categories (Thai combining marks survive — `\w` strips them), `vlm_localize_sfx(..., target_lang=)` threaded through.
- **Chinese line-break:** added `jieba` (`_insert_cjk_word_breaks` mirrors the Thai pythainlp path) — inserts ZWSP between words so `calc_horizontal` wraps on word, not mid-character. Thai (pythainlp) + Korean (spaces) already wrap on words; `clean_layout` (universal) wraps every language to the source footprint width.
- **Tests:** `test_ocr_vlm.py` +6 (ENG byte-identical, TH/ZH/KO prompts + script hint, sanitize keeps each script incl. Thai combining marks, vlm threads target_lang) · `test_cjk_word_breaks.py` ×2 · full suite 446 pass / 19 pre-existing async / 0 new. `jieba` added to requirements.
- **E2E (production Reader, all 4 langs, cache:reset + backend restart):** ぬ → 噗 (ZH) / นุ (TH) / 누 (KO) / NYAA (ENG) — each inpainted + lettered in the target script, dialogue wrapped per language, through Backend→MIT→patches→cache on hayateotsu.space. Was raw JP ぬ for every non-ENG target before.

**Whole-codebase ADR audit (2 ultracode workflows).** The repo had only 3 ADRs for ~15 load-bearing-but-undocumented decisions. Workflow 1 (6 `Explore` readers, one per subsystem → consolidate) surfaced 79 raw decisions and de-duped them into a 12-ADR backlog (004-015). Workflow 2 (pipeline: draft grounded in the cited code → **adversarial verify against the live files → fix in place**, 24 agents) wrote all 12. The adversarial pass caught real drift in 5 (004 share.py:99→101; **005 + 003 overstated Flux as built — corrected to "Accepted, impl pending"**, `Inpainter` enum has no `flux_klein`; 008 `translator_chain`=parse-fn not class + line count reconciled to live **3040→1984, −34.7%**; 009 preload wiring; 011 permanent-TTL passthrough); 7 verified accurate. Added `docs/adr/README.md` index; ADR 002→005 family cross-ref; ADR 003 status clarified as impl-pending (#272). ADRs now cover the patch pipeline (#156), classical levers, bubble detection, render parity, decomposition discipline, model lifecycle, translation context, 3-tier cache, the MIT/Backend security boundary, Supabase authz, and the Frontend proxy + auth context.

## Lane A — S22 DispatchRegistry + #188 global-MODEL removal + full-stack E2E (2026-06-10, /tdd, high)

After PR #203 merged, started the MIT tech-debt backlog (Lane A). Four byte-identical commits, then a from-scratch full-stack E2E.

- **S22a** (`bd788b5`) — the detector/ocr/inpainter/upscaler/colorizer `__init__` modules each repeated the identical `get_X` (lazy cache) + `unload` (pop) + cache-dict trio; folded into `dispatch_registry.py` `DispatchRegistry(registry, kind)`. Each module wires `get_X` = thin typed wrapper over `_registry.get` + `unload = _registry.unload`; `prepare`/`dispatch` stay per-module (divergent bodies — different methods/args, upscaling's ratio==1 early-return). `if not cache.get` quirk + `','.join` ValueError preserved. 5 unit cases.
- **S22b** (`cc8785d`) — `translators/__init__.py` carried the same trio; wired it too. The divergent inline `await translator.unload(device)` (translator-INSTANCE unload) in `dispatch` and `prepare_selective_translator(get_translator)` untouched. Completes S22 — all 6 dispatch modules on one registry.
- **#188 global MODEL** (`f5d60bc` default, `859506d` dbnet+craft) — `det_batch_forward_default` reached the loaded net via a module-global `MODEL` (set in `_load`, read in the forward) = concurrency hazard (two detectors clobber the global). Threaded the model explicitly: `det_batch_forward_default(batch, device, model)`, `_load` drops the global, `_infer` passes `self.model` via a closure into `det_rearrange_forward` + the fallback call (default + dbnet, byte-identical bodies). craft.py's global was pure **dead code** (its `_infer` calls `self.model(x)` directly, never reads the global) — deleted. `test_det_forward_default.py` (torch + fake net) parametrized over default + dbnet. **No module-level global MODEL remains in detection** — #188's "no global MODEL; concurrent loads safe" met for all three.
- **#188 shared-utils**: found **already done** — `det_rearrange_forward` is single-source in `utils/generic.py`; `merge_bboxes` single-source in `model_manga_ocr.py` (model_48px has no merge). No work.

Suite: 18 async-only baseline + **335 passed** (+10 across the batch).

**Full-stack E2E (started the whole system from scratch — it was all down + Docker daemon off).** Launched Docker Desktop → Redis (compose) + MIT (`--use-gpu --start-instance`) + Backend (`dist/src/main`) + Frontend (`bun dev`) + cloudflared tunnel; `cache:reset` + fresh L1; translated Kouchuugun ch1 p0 EN→TH through the **production tunnel** while logged in. Result: **2 patches `649×1492` + `451×1489` = pixel-exact to baseline**, page rendered correct Thai. S22 + global-MODEL sit on the detection/dispatch hot path of every translation, so this is a strong byte-identity confirmation. Remaining Lane A is the harder long-tail (render dedup #189/#190, behavior changes #192/#193/#186, #188 BaseGPTTranslator=xhigh, #191 product decision).

## S23→S26a god-object tail — 5 byte-identical seams + batched E2E (2026-06-10, /tdd, xhigh)

Pushed the high-risk async-orchestration tail of #187 in one session, one commit per seam, each byte-identical (`git diff -w` = zero semantic change on kept lines) and unit-tested. **Driver `manga_translator.py` 2235 → 1934 lines** (this session; **3040 → 1934 = −36%** since the decomposition began). Suite went 18 async-only baseline + **323 passed** (+16 new cases).

- **S23 StageRunner** (`f1ce7a3`) — `stage_runner.run_stage(name, fn, fallback, *, report_progress, ignore_errors, logger)` + thin `_run_stage`. Folded the identical report-progress → try → `ignore_errors` (re-raise | fallback) + `"Error during {name}"` log block that repeated **14×** (8 in `_translate`, 5 in `_translate_until_translation`, leaving 1). **Rendering kept inline** — it reports `'rendering'` then a conditional `'rendering_folder:'` BEFORE running, and `_run_stage` couples report+run, so folding would double-report + reorder. `logger` injected so `set_main_logger` swaps are honoured. 5 cases.
- **S24a patch_geometry** (`2eac7dd`) — three `self`-free numpy/cv2 helpers (`build_local_region` coord-shift+cache-clear, `create_text_only_mask` fillPoly+adaptive dilate, `crop_mask_for_patch` same-size/scaled crop+binarize) → `patch_geometry.py`, thin delegates. 8 golden-numpy cases.
- **S24b PatchRenderer** (`8fa69d3`) — the ~90-line `_process_group` closure (crop→mask→inpaint→render→PNG, GPU semaphore, 30s `wait_for`) → `PatchRenderer.process_group`; body kept verbatim via local-aliasing, only the 6 helper calls rewritten. `{x,y,w,h,img_png}` HTTP contract (pickled at share.py:99) + every fallback preserved. Removed the now-orphan `encode_patch_png` import. 3 stub-orchestration cases.
- **S25 PipelineOrchestrator** (`dfa0eb1`) — `_run_until_translation_stages(ctx,config)->(ctx,finished)` folds the ~80-line colorize→pre-dict block shared by both drivers (the dup S23 deliberately left). early-exit returns `(revert,True)` ⇒ caller `if finished: return ctx` = byte-identical. **L4 dead `'cancel'` branches preserved** (dead-code removal is a separate opt-in fix). 3 cases.
- **S26a batch_orchestration** (`70792af`) — `placeholder_context` (dedup 2 failure-branch sites) + `build_page_translation_record` (the L7 `{raw:translation}`+`{idx:raw}` records appended to TranslationMemory). The MemoryError pre-process ladder (**S26b**) stays in the driver for a focused pass. 3 golden cases.

Two stale source-inspection wiring tests re-pointed across the new module boundaries (`test_safe_area` bubble_polygon → patch_geometry, `test_font_fit` bubble_area_fit+union_box → patch_renderer) — same maintenance S15 did for stages.py.

**E2E (batched — one MIT restart for all five seams).** MIT stopped (released ~7.7GB → commit-free 9.8→17.5GB, clearing the OSError-1455 risk) and restarted on the new code (`/ready` 200, fresh PIDs); `cache:reset` + fresh backend L1; translated Kouchuugun ch1 p0 EN→TH through the **production tunnel** while logged in. Result: **2 patches, pixel-exact `649×1492` + `451×1489` = byte-identical to the pre-refactor baseline**; the page rendered correct Thai with narrow-column wrapping (#179) intact. The translate_patches path (touched by S24/S25/S26a) is the most-exercised hot path, so this is the strongest byte-identity confirmation.

**Follow-up — S26b** (`35390fa`): the ~50-line per-image try/MemoryError/Exception ladder moved out of `translate_batch`'s loop into `_preprocess_image_for_batch(image, config, i, memory_optimization_enabled) -> (ctx, config)` (loop keeps the psutil check + appends the return). Byte-identical (`append` → `return` is the only mechanical change; deepcopy-recovery-config, double image-context save, every log preserved). `test_batch_preprocess.py` — 5 cases pin every branch (success / MemoryError→recovery retry / retry-fail→placeholder / generic→placeholder / re-raise when mem-opt off). Suite **328 passed**. MIT rebooted on S26b → `/ready` 200 (boot-validated); S26b is on the batch path only, so the single-page byte-exact result above is untouched. **S26 complete.** Remaining tail: **S22** DispatchRegistry (#188 — the last seam), S12 value-object (🔒 #192).

## HOTFIX (critical): per-chapter Cloudflare Worker /v1/list cost-bleed (2026-06-10, /debug-mantra + /tdd)

`MangaDexService.attachLocalStatus` fired one R2 `/v1/list` per chapter (`Promise.all(chapters.map(hasChapterCache))`) on EVERY chapter-list load — including the Redis cache-hit path — ungated by `forceLocal`. An N-chapter manga cost N Class-A list ops per load × every re-fetch (home grid re-fetches ~11/min; 507 chapter-list reqs/46min observed) → tens of thousands of worker list ops/session, unbounded. The R2 provider logs no outbound calls, so it was invisible in our logs (seen only on the Worker side).

**Fix:** gate the fan-out — compute `readerAvailable` only when `imageCache.enabled && (forceLocal || isOfflineFallback)`; thread `forceLocal` into all 4 attachLocalStatus call sites. Mirrors the frontend's own consumption (`HeroDetailButton.tsx:33`, `BookDetailModal chapterNeedsBackup === isOfflineFallback`) → **default browsing = 0 worker calls, offline/forceLocal flows unchanged, zero UI regression.** TDD: `mangadex-reader-available.spec.ts` 3 cases RED→GREEN (default=0, forceLocal=N, disabled=0). Shipped to `main` via PR #197 (squash `01affd5`). Post-mortem + backlog follow-ups in `docs/reports/system-impact-report.md`.

## S15 Stage protocol — extract the 6 leaf stage adapters into stages.py (2026-06-10, /tdd)

New module `MIT/manga_translator/stages.py` + `test_stages.py` (9 golden cases), one commit. Moved the `read ctx-subset → dispatch_* → return value` core of six `_run_*` adapters byte-for-byte: `run_colorizer` (preserves the **L15** `**ctx` splat), `run_upscaling` (`[0]` unwrap), `run_detection` (12 positional args + the #168 `det_sfx` second pass), `run_mask_refinement`, `run_inpainting`, `run_text_rendering` (3-way renderer branch + the #181 supersampling kwargs; **L5** always-None `render_mask` preserved). Each driver `_run_*` keeps its `time.time()` + `_model_usage_tracker.touch(...)` instrumentation (the S3 concern) and delegates — so the error-prone many-arg dispatch calls are now independently testable by stubbing `dispatch_*` + snapshotting positional args, exactly the documented S15 test strategy.

The heavier `_run_ocr` / `_run_textline_merge` / `_run_text_translation` adapters keep their extra logic inline (they already delegate to `debug_sink` / `text_translation_dispatcher`); only the leaf dispatches moved. Updated two stale source-inspection wiring tests (`test_safe_area` #181 supersampling, `test_sfx_merge` #168 det_sfx) to point at `stages.py` after the move. This is the groundwork the **StageRunner (S23)** drives as a uniform list — S23 is now unblocked (S15/S11/S14 all ✅).

Suite: 18 async-only baseline, **319 passed**. **E2E run #4** (MIT restarted on S15 code, cache cleared): Kouchuugun ch1 p0 → 2 patches **649×1492 + 451×1489**, status success, **0 console errors** — identical to runs #1–3. S15 sits on every translation's detection→inpainting→rendering hot path, so this is the strongest byte-identity confirmation yet.

## S14 VerboseDebugSink — fold the scattered verbose debug saves (2026-06-10, /tdd)

New module `MIT/manga_translator/debug_sink.py` + `test_debug_sink.py` (15 characterization cases), three byte-identical increments, one commit each:
- **S14a** the six save bodies — `input.png`/`mask_raw.png`/`bboxes_unfiltered.png`/`bboxes.png` (duplicated verbatim in the single + patch drivers), `inpainted.png` (single + batch back-half), `final.png` (`_revert_upscale`). Verbose guard stays at each call site; each save now exists once. Guarded-vs-unguarded split pinned as-is (input/inpainted/final = try/except + success-check warning; mask_raw/bboxes* = bare, exceptions propagate).
- **S14b** the inpaint-preview pair — `save_inpaint_preview` (single driver, **unguarded**) vs `save_inpaint_preview_guarded` (batch back-half, whole block incl. preview render guarded with per-file success checks). The divergence is load-bearing (analysis S14) → pinned as two functions, not a flag; the `dispatch_inpainting(Inpainter.none, ...)` render stays at the call site as a `make_preview` callback so debug_sink has no ML imports.
- **S14c** `ocr_debug_dir_env` context manager — `_run_ocr`'s `MANGA_OCR_RESULT_DIR` dance (verbose → 3-branch dir construction + makedirs → set env for `dispatch_ocr` → always restore in finally). `get_image_subfolder` passed as a callable, only consulted when verbose. Tested with real makedirs against tmp_path + restore-on-raise.

Result: `manga_translator.py` is down to a **single `cv2.imwrite`** — the streaming-placeholder branch (L11 `_is_streaming_mode`, set nowhere in-repo), which is flow control and stays inline. Suite: 18 async-only baseline, **310 passed**. **E2E re-validated** (MIT restarted on S14 code, cache cleared): Kouchuugun ch1 p0 → 2 patches **649×1492 + 451×1489** — third identical run; `ocr_debug_dir_env` sits on every translation's hot path and behaves byte-identically. Unblocks S23 StageRunner (needs S15 next).

## S18 PostTranslationProcessor — relocate (not unify) 4 copies (2026-06-10, /tdd)

The documented S18 premise was "unify 4 copies of post-translation processing". Close reading showed the four are **not** a clean byte-identical dedup: the genuinely-identical part (`filter_translated_regions`) was already extracted in S1, and the three phase-2 retry loops are **structurally divergent and load-bearing** (L6/L8) — single uses min_ratio 0.5 / threshold ≥6 / pad-with-empty + enumerate; concurrent uses 0.3 / ≥6 / filter + text_idx; batch uses 0.5 / >10 / cross-context region_mapping, plus divergent log strings. Forcing them into one function needs per-scope collect/reassign/log callbacks — that *adds* complexity to prop up a merge, against the North Star. The user steered "reduce long-term debt", so the chosen interpretation is **relocate + make testable + pin the divergence as explicit params**, not unify.

New module `MIT/manga_translator/post_translation.py` + `test_post_translation.py` (13 characterization cases), four byte-identical increments, one commit each:
- **S18a** `apply_post_translation_processing` — punct + post-dict + phase-1 repetition retry (the helper batch/concurrent share); two self-bound async steps become callbacks. Updated the punctuation wiring test for the move (1 inline call in the god object + 1 in the module).
- **S18b** `concurrent_page_lang_check_retry` — concurrent phase-2 (0.3 / ≥6, filter + text_idx).
- **S18c** `single_page_lang_check_retry` — single phase-2 (0.5 / ≥6, pad + enumerate, skip-log + unified success/failure message).
- **S18d** `batch_lang_check_retry` — batch phase-2 (0.5 / >10, cross-context region_mapping).

Each driver now delegates; L6 thresholds/ratios and the L8 index-dropping re-translate are preserved verbatim. Suite throughout: 18 async-only baseline, **295 passed**. The single driver's own phase-1 variant (side-effect retry, no per-region try/except, different logging) is documented and left inline — unifying it with the helper would change logging/error behaviour, a flagged change for later.

## E2E validation — S17/S21 refactor stack via production tunnel (2026-06-10)

Brought up the full stack (Redis → cache:reset → MIT 5003 `--use-gpu --start-instance` → Backend 4001 → Frontend 4000 → cloudflared tunnel) and ran the mandatory original↔translated comparison through **`https://hayateotsu.space/`** (never localhost — per `frontend-testing` skill). Test page: **Kouchuugun Shikan Boukensha ni Naru** ch1 "Emergency Landing" page 1 (EN→TH, custom_openai/9arm).

- **Result: PASS, output byte-identical to documented baseline.** `[MangaPatches] page=0 → 2 patches`, POST `translate-patches` → **201** (37s). Patch geometry **649×1492 + 451×1489** — matches the skill's recorded bubble-seg-OFF baseline exactly (render knobs gated off → byte-identical, as designed). Thai text correctly positioned in the caption columns, art/layout/panel positions preserved vs the original screenshot. No 500s; the only errors were the standard `/pages` 401→200 HWID auth handshake (pre-existing, unrelated to translation).
- **What this validates:** the refactor stack on the hot path — **S21 ModelLifecycle** (preload + ensure_running, runs on every translate), S13 detection_postproc, S16 TranslationMemory, S19 gather_per_context — produces unchanged output end-to-end. (S17's chatgpt-specific dispatch is not exercised by the custom_openai path, but the surrounding orchestration is.) Screenshots: `e2e-s17-p1-original.png`, `e2e-s17-p1-translated.png`.

## MIT test-suite pollution fix — sys.modules restore (2026-06-10)

While running the full MIT suite to validate the S17 stack, the full `pytest` run showed **26 failed** — 18 the known async-only baseline (`async def functions are not natively supported`, pytest-asyncio inactive) plus **8 non-async** that all *passed in isolation* (`test_detection_postproc`, `test_series_context`, `test_mit_config` ×6). Root cause: `test_precision.py` + `test_qwen3_translator.py` install `_stub('omegaconf')` / `_stub('manga_translator')` into `sys.modules` at **module import time** (so qwen3.py loads without torch/the real package) and never restore them. pytest imports those root files during **collection**, so the empty stubs shadow the real modules for every test collected afterwards; any later test that imports the real `omegaconf` / `manga_translator.config` then breaks.

- **Pre-existing, not a refactor regression:** git confirms both polluter files sit on `main` untouched by the #187/#188 stack; `pytest test/` alone (root files not collected) = clean 18 async-only. S13 merely *added* `test_detection_postproc.py`, which became a 3rd victim (its code passes in isolation).
- **Fix:** snapshot the affected `sys.modules` entries before stubbing, restore them right after the module-under-test is loaded (it keeps its own references; the tests only touch the loaded symbols). `test_precision.py` deliberately leaves `torch`/`transformers`/`bitsandbytes` stubbed — its `build_load_kwargs` tests resolve those at call time.
- **Result:** full suite **26 → 18 failed** (just the async baseline), **282 passed** (+8). precision+qwen3 own tests 12/12 green. Touch = 2 test files, +55 lines, zero production code. Commit `0db9479` on `refactor/mit-seam-s17-text-translation-dispatcher`.

## #179 narrow-column safe-area + adversarial bug hunt (2026-06-08, /tdd + Karpathy)

**#179 (root-cause render parity):** new pure `MIT/manga_translator/safe_area.py` — `safe_area_box(mask)` = distance-transform safe-interior + pole-of-inaccessibility anchor (ported from MangaTranslator image_utils.py). Wired: `_tag_regions_with_bubbles` carries `bubble_polygon`; `_build_local_region` shifts it into crop coords; renderer `_bubble_interior_box` rasterizes the polygon → mask → `safe_area_box` and wraps to the **interior width** centered on the anchor (narrow column) instead of the bbox. Opt-in under `bubble_area_fit`; off → byte-identical. `test_safe_area.py` 5 green (incl conjoined-neck pole). **E2E (One Punch-Man JA→EN, ab_benchmark + MCP_DOCKER UI):** top-left narration now renders as a narrow column with hyphenated "some-where" — visibly closer to the reference (was a wide paragraph). UI path clean: zero 500/404 (only the pre-existing forum 404). `benchmark_compare_179.png`.

**Adversarial bug hunt (12+ agent workflow, 25 candidates → 16 confirmed):** fixed the 4 that sit in the code being touched:
- **[blocker] ZeroDivision** in `resize_regions_to_font_size` legacy single-axis expansion when `used_rows/used_cols == 0` → guarded `> 0`.
- **[major] whitespace-only translation** entered bubble_fit (truthy but blank → large font for invisible text) → added `region.translation.strip()` guard.
- **[major] empty `widths`** from calc_horizontal made `block_w=0` → every size "fits" → max font → measure now treats empty widths as no-fit (`inf`).
- **[major] `union_box` float truncation** shrank the crop (int() truncates a float max inward, clipping the balloon) → floor mins / ceil maxes. (`test_union_box_does_not_shrink_on_float_coords`).
- Logic tests: 41 green across safe_area/font_fit/bubble_association/render/thai (1 pre-existing async-plugin fail).

**Confirmed bugs deferred (mapped / triaged, NOT yet fixed):** dst_points exceed image bounds (clipping commented out) → **#183**; vertical regions never fitted → **#182**; **Backend [major] batch `buildJobKey` breaks on a `ver:` chapterId** (colon splits the jobKey) — real, in the batch path, needs the same `:`→`_` normalization as PatchStore (not yet filed); patch cache-key `jobModel` divergence (needs verify); minor: fit_font_size margin≤0 guard, ver:/ver_ sanitize collision, control-char traversal, HMAC hex format, cache:reset Redis-misconfig silent pass. L1-not-cleared-by-cache:reset is already documented + the script now prints a restart reminder.
PIPELINE.md §5 updated. Not committed.

## Render Parity — PRD #178 + vertical-slice issues (2026-06-08, /to-prd + /to-issues)

After the deep dissection, the user decided the direction (narrow-column + 4× supersampling + real vertical + SFX) and asked to break it into a PRD + issues. Filed:
- **PRD #178** — "Render Parity with MangaTranslator" (bilingual, ready-for-agent): problem/solution, 26 user stories, deep-module plan (`safe_area`, `line_break`, `vertical_layout`, supersample seam, inpaint-fidelity helpers), testing decisions (pure modules + source-inspection wiring + byte-identical-when-off + benchmark E2E), VRAM framing (5–7/12GB now vs legacy 11.5GB SD/LDM, headroom for AnimeText + quantized diffusion opt-in). Parent of the render-quality issues; extends PRD #169.
- **New vertical slices (all ready-for-agent, opt-in, byte-identical-off):** #179 mask-aware narrow-column wrap + safe-area centering (root cause) · #180 Knuth-Plass + kinsoku + hyphenation [blocked-by #179] · #181 4× supersampling · #182 real vertical layout + auto-orientation · #183 squeeze-on-collision + pre-warp bounds check.
- **Existing children of #178:** #168 SFX, #171 emphasis, #172/#167 OCR, #173 feather, #174 flat-fill, #175 sizing, #176 font, #161 glossary.
- **Deferred (in PRD, file when reached):** LAB luminance-match, translation determinism (temp 0.1 + gate), quantized diffusion inpainter (re-adopt legacy SD/LDM behind a flag).
- No code changed. Next: /tdd the cheap visible wins (#175 cap, #181 supersampling, #179 narrow-column) and #168 SFX.

## Research — translator deep dissection: MangaTranslator vs ours (2026-06-08, ultracode workflow)

User asked to fully dissect MangaTranslator (techniques/models/methods), survey our MIT + Backend, analyze why ours is worse, and surface black boxes in both. Ran a 12-agent dissection workflow (9 per-stage dissectors reading both codebases + 3 synthesizers; 1.24M subagent tokens) + a gap-fill agent for detection. New canonical doc: **`docs/research/translator-deep-dissection.md`** (~70KB) — full pipeline dissection (detection/OCR/translation/cleaning-inpaint/layout/render/orchestration + complete ML model inventory), our MIT+Backend inventory, an 8-dimension "why ours is worse" table mapped to issues, and an honest black-box ledger (both codebases, tagged verify-by: read-code | run-experiment | ask-author).
- **Headline (models/VRAM):** theirs = FLUX inpaint (8–15GB) + SAM2/SAM3 + AnimeText YOLO + 4× supersampling; ours = LaMa (~1–2GB) + DBNet + 48px CNN. They buy photoreal inpaint + crisp text + glossary/emphasis context at 8–15GB; we run at 1–2GB. Dev box has headroom (5–7/12GB used).
- **Root-cause one-liner:** we adopted upstream's *correct* engine but ship it **untuned** — heuristic font-fit instead of safe-area + collision binary-search, no supersampling, greedy wrap instead of DP+kinsoku, LaMa without feathering/luminance-match, temp 0.5 without emphasis/glossary. **Most fixes are porting upstream's already-written logic into our patch path behind opt-in seams, not new research.**
- **Why-worse ranked → issues:** seams #173 · font/supersampling #175+new · overflow/vertical #175+new · anchoring new · line-break/kinsoku new · SFX #168 · OCR upscale #172/#167 · translation tuning #171/#161/new.
- Decided direction in memory `project_render_parity_direction` (narrow-column mask-aware wrap + 4× supersampling + real vertical Latin + SFX opt-in). Doc cross-links `mangatranslator-internals` + `round2-deep`. No code changed this round.

## #175 bubble-fit anti-overflow sizing (2026-06-08, /tdd, /to-issues)

User flagged (with screenshots) that #166's fitted text renders too big and clips at the balloon/panel edge. Filed #175 (sizing) + #176 (comic font) via /to-issues. Fixed #175's sizing:
- **Pure** `fit_font_size` gained a `margin` param — fits to a fraction (0.92) of the box so glyph ascent/descent slack can't touch the edge (unit-tested; `margin=1.0` default keeps existing callers byte-identical).
- **Renderer** `_bubble_fit_font_size`: real per-line height (`_LINE_HEIGHT=1.2`), `_FIT_MARGIN=0.92`, relative cap `_MAX_FONT_BOX_RATIO=0.5`. **Crucially**, calc_horizontal is now wrapped to the *margin'd* width too — without that the search floored at `low=8` (lines calc made for the full width always exceeded the margin'd fit-test). Did **not** copy MangaTranslator's flat `max=16` (would regress to tiny on our full-res pages).
- **Diagnosis (mantra)**: instrumented `resize_regions_to_font_size` to a file (the `--start-instance` worker logs in a child process — also caught a real ops bug: killing only the :5003 listener orphans the :5004 instance, so code edits silently don't take effect; must kill both ports). Ground truth: bubble-fit regions sized 8–54; the `font=8` floor on the top-left narration box was the margin/calc-width mismatch (now fixed → 41); the bottom-right clip is a **LEGACY-path** region (`hasbub=False`, no fit-to-box) — out of #175's scope.
- **E2E** (One Punch-Man JA→EN, `ab_benchmark.py`): top-left narration now fills its box (was tiny font 8), text fits within boxes, clipping largely gone. Visible jump toward the reference (~45% → ~60-65%). `benchmark_compare_175.png`.
- Tests: `test_font_fit.py` + `test_bubble_association.py` 23 green; targeted render/thai sweep 35 green (1 pre-existing async-plugin fail). PIPELINE.md §5 updated. **#175 NOT closed — awaiting user confirm.**
- **Remaining gap (new finding)**: non-bubble regions use the legacy path with no fit-to-box → they can still overflow (bottom-right). Plus SFX untranslated (#168) and typeface (#176). Candidate follow-up: extend fit-to-box to legacy regions or improve bubble coverage. Not committed.

## MIT benchmark vs MangaTranslator + upload→translate fix (2026-06-08, /tdd)

Stood up the full stack (frontend+backend+MIT worker+cloudflared tunnel) and drove the One Punch-Man "Benchmark Pipeline MIT" page (uploaded JA) through the UI via Playwright to compare against MangaTranslator's reference (`MIT/example_translation.jpg`). New `MIT/BENCHMARK.md` records the canonical test case + scorecard; throwaway harness `MIT/tools/ab_benchmark.py` translates it JA→EN directly through the worker and composites the patches.
- **Result: ~40–50% of MangaTranslator on this page.** Translation text comparable; the gap is rendering+coverage: rectangular **narration boxes under-fill** (speech-bubble YOLO doesn't detect them → no `bubble_box` → #166 can't engage), **SFX untranslated** (ぬ→"LOOM"; #168 not built), **edge clipping** on the right column. #166 binary-search is correct but only lifts detected speech bubbles — this page is narration+SFX heavy, out of its scope.
- **Bug #1 FIXED (TDD)** — `loadPageBytes` (`page-source.ts`) couldn't load an uploaded page: the Reader sends a relative `/api/proxy/uploads/...` URL → `fetch` "Failed to parse URL" → 500. Added `isLocalUploadPath` + disk read under the uploads root (handles `/uploads/` and `/api/proxy/uploads/` prefixes, same traversal guards as img-cache); `loadPageBytes` gained `uploadsRoot` opt, wired at both call sites. `page-source.spec` 12 green (+4). Rebuilt+restarted backend; the page now reaches the worker and renders.
- **Bug #2 FIXED (/debug-mantra, TDD)** — after the worker succeeded, storing patches 500'd: `PatchStore: unsafe chapterId segment: "ver:752fc515-..."`. Uploaded "version" chapters carry a `ver:` prefix whose `:` failed PatchStore's `/^[\w.-]+$/` guard. Reproduced with a unit test (`put({chapterId:'ver:<uuid>'})` → throws), fixed by normalizing `:` → `_` in `PatchStore.put` before the guard (`toPathSegment`) so the dir is `ver_<uuid>`; `/`,`\`,`..` still throw (traversal contract preserved — that test stays green). `patch-store.spec` 13 green (+1). **Confirmed E2E via Playwright on `hayateotsu.space`: the uploaded chapter now translates fully — toolbar "✓ แปลแล้ว", EN patches overlay the page, zero 500s.** This was the real-world repro the unit test stood in for.
- Stack left running (worker :5003, backend :4001 with #166 flags, frontend :4000, tunnel up). Not committed.

## #166 — direct-worker E2E proof (2026-06-08)

Tunnel (`hayateotsu.space`) was down (CF 530) so the Playwright path was blocked; proved the render change by driving the MIT worker directly instead (cleaner isolation of the change anyway). New throwaway diag `MIT/tools/ab_bubble_fit.py`: POSTs `tools/_bubble_proof/page01.jpg` to `:5003/translate/with-form/patches` with `bubble_area_fit` OFF vs ON (both `det_bubble_seg` on, `ocr.prob 0.03`), composites the returned patches onto the page → `before.png` / `after_fitoff.png` / `after_fiton.png`.
- **Result:** translation works end-to-end (EN→TH via custom_openai gateway, 24 regions). The bottom-right speech balloon renders **large, clean, balloon-filling Thai** under ON vs tiny/untranslated under OFF — **no clipping, no overlap** → the binary-search fit + the two scrutinize fixes (union_box crop-expansion, sole-occupant gate) hold in a real render.
- **Honest caveats:** (1) the runs differ in patch count (OFF 6 / ON 7) — `bubble_area_fit` ON legitimately changes the crop via `union_box`, so it's not a byte-isolated A/B; the bottom-right box was rescued only under ON. (2) Most **rectangular narration boxes still render small in both** — the `kitsumed/yolov8m_seg-speech-bubble` model targets rounded dialogue balloons, not narration boxes, so they get no `bubble_box` and fall to the legacy path. Covering narration boxes is out of #166's scope (needs a different detector / the OSB+panel path).
- First attempt returned 0 patches: the diag set `source_lang_only=JPN` but page01 is an English scan → all 24 regions dropped by the lang filter; fixed by leaving source `ANY`. Worker left running on :5003. Not committed.

## #166 binary-search — scrutinize fixes: clip + overlap (2026-06-08, /tdd)

`/scrutinize` of the binary-search work surfaced two blockers in the patch-crop seam (both hit exactly the target "loose balloon" case, so they'd look *worse* than before under `MIT_BUBBLE_AREA_FIT=1`). Fixed via TDD before any E2E:
- **Blocker 1 — clipping:** the crop is sized to text-lines (+pad+render_extra=120px); a balloon larger than that overflowed it, so the balloon-sized fitted text rendered cut off at the patch edge. Fix: new pure `bubble_association.union_box()` (clamped axis-aligned union) grows the crop to cover the group's balloons in `_process_group`, gated on `config.render.bubble_area_fit`. 3 tests.
- **Blocker 2 — overlap:** a multi-region balloon (`_group_nearby_regions` keeps a multi-line balloon as one group) had every region fit to and render into the *same* full-balloon rect → stacking. Fix: new pure `bubble_association.balloon_occupancy()` counts regions per balloon box; the renderer fits a region only when `occupancy[i] == 1`, else it falls through to the legacy per-text-line path. 2 tests.
- Verified: sole occupant still fits (font 120 into a 480×320 balloon); shared/None balloons gated out. Tests: `test_bubble_association.py` 15 green (+5), `test_font_fit.py` 6 green (wiring asserts both gates + union_box), targeted render/thai suite 33 green (1 pre-existing async-plugin fail). PIPELINE.md §5 updated. Verdict moved scrutinize → fix-then-ship done; **safe to E2E now.** Not committed.

## #166 binary-search font sizing — the real fit (2026-06-08, /tdd)

Replaces Step B's `sqrt(area-ratio)` heuristic (which near-no-op'd on dense boxes — the "ทำไมดูไม่ต่าง" feedback) with MangaTranslator's actual technique: binary-search the largest font whose wrapped text fits the balloon, measured by the renderer's own wrapper so the fit prediction matches the render.
- **Pure** `font_fit.py` `fit_font_size(box_wh, measure, low, high)` — standard binary search over a `measure(size)->(block_w,block_h)` callback; fit-test = `block_w<=W ∧ block_h<=H`; floor-on-overflow. No PIL/ML imports. Removed the old `bubble_area_font_size` + its 6 area-ratio tests + the `_apply_bubble_area_fit` patch pre-step (dead once the renderer owns the fit). 5 search tests.
- **Renderer** `rendering/__init__.py`: new `bubble_fit` path in `resize_regions_to_font_size` — for a horizontal region carrying a #170 `bubble_box`, `_bubble_fit_font_size()` fits via `calc_horizontal` and renders **into the balloon box** (dst_points = bubble rect), bypassing the length-ratio heuristic so the fitted size is never re-inflated past the balloon. Threaded `bubble_fit` through `dispatch`; `_run_text_rendering` passes `config.render.bubble_area_fit`. Off / no bubble_box → byte-identical legacy path.
- **Proven** (real freetype wrapper, no GPU): same text in a 120×80 box → font 30; in a 480×320 box → font 120 (4× box ⇒ bigger font), dst = balloon dims. Direction correct, no squish-back.
- Tests: `test_font_fit.py` 6 green (5 search + 1 source-inspection wiring); targeted render/bubble/thai suite 28 green (1 pre-existing async-plugin fail `test_default_renderer`, unrelated). PIPELINE.md §5 provenance updated (config/manga_translator/rendering/font_fit). **Issue #166 NOT closed — awaiting user confirm + full frontend E2E.** Not committed.

## Dev tooling — `scripts/notify.ps1` Windows toast notifier (2026-06-08)

User wants a ping when a long task finishes / needs a decision so they can step away from the terminal. Claude Code's built-in `PushNotification` reports "sent" but produces no OS toast on their Win11 + VS Code setup (verified: not DND, nothing in Action Center). Built a working path instead.
- **Mechanism**: `scripts/notify.ps1 -Message "..."` (run by pwsh 7) shells out to **Windows PowerShell 5.1** and emits a **WinRT Toast** under the Windows PowerShell AppId → lands in Action Center → forwarded to the phone via Phone Link (user's phone is Phone-Link-paired). pwsh 7 can't load WinRT projections, hence the 5.1 hop; `powershell.exe` isn't on PATH in this env so the script uses the full `System32\WindowsPowerShell\v1.0` path; text is XML-escaped; `-File` runs fine under RemoteSigned (no `-ExecutionPolicy Bypass`, which the classifier denies).
- **Confirmed live**: raw WinRT toast displayed on screen; built-in PushNotification + legacy NotifyIcon balloon did not.
- Documented in CLAUDE.md (EN+TH, "Dev Notifications"); standing rule saved to memory `feedback_notify_on_done_or_question`. Not committed.

## Debug tool — `cache:reset` wipes translated-patch caches (2026-06-08, /tdd)

Re-translating during MIT debugging was defeated by every cache layer replaying the prior result; clearing them by hand (Redis pattern + `.cache` glob + `uploads/patches`) was error-prone — one wrong glob nukes `forum:*`/`search:*` (same data-loss class PatchStore's `OWNED_NAME` guards). Extracted the dangerous part into a unit-tested pure module.
- **Pure module** `src/cache/translation-cache-reset.ts`: `isTranslatedPatchCacheKey()` (matches only `translate:manga-patches:` — sibling `translate:glossary:*` survives) + `resetTranslationCache(ports)` orchestrator over injected I/O ports (Redis / L3 disk / patch PNGs), best-effort per layer. 6 tests with in-memory fakes prove forum/search/mangadex/glossary keys are left intact and counts are accurate.
- **CLI glue** `scripts/reset-translation-cache.ts` (`npm run cache:reset`, `-- --dry-run`): wires real ioredis (graceful skip when Redis down, mirrors RedisService fallback) + `fs` for `.cache/*.json` (selects by the entry's `key` field) and `uploads/patches/<chapterId>` trees. In-memory L1 dies with the backend → restart clears it.
- **Verified on real data**: `.cache` held 463 json (219 patch + 244 other); dry-run then real run deleted exactly the 219, leaving 244 (463→244) — zero collateral. Full cache suite 137 green (14 suites). Not committed.

## #166 font-size fidelity — Step A: render knobs (2026-06-08, /tdd, in progress)

Leverage-order step 1 of #166 ("knobs"). The renderer's auto floor is `(img.h+img.w)/200` — in patch mode that's computed from the tiny crop, so text renders uniformly small. MIT's `render.font_size_offset`/`font_size_minimum` existed but the Backend never sent them.

- **Backend** `buildMitConfig`: `MIT_FONT_SIZE_OFFSET` (signed int) + `MIT_FONT_SIZE_MIN` (positive px) → `render.{font_size_offset,font_size_minimum}`; absent → render block byte-identical. `signedIntEnv`/`posIntEnv` helpers. `books-mit-config.spec` 13 green (knob set + absent-unchanged).
- **Frontend E2E** (build + restart with `MIT_FONT_SIZE_MIN=30`, cleared all 3 cache layers, re-translated Kouchuugun p1): text renders visibly larger and fills each caption box far better than the default auto-floor render — confirms mechanism #3 (knobs never tuned + crop-derived tiny floor). Screenshot in `_bubble_proof/`.
- **Next (Step B, the core)**: drive size by *available area* (the `region.bubble_box` carried from #170) instead of the source textline column + the global floor — per-box auto-fit, not a blunt global minimum. Then Step C (patch-crop growth), Step D (display-text ≥2× median, ties to #168).
- Dev env now also carries `MIT_FONT_SIZE_MIN=30`. Not committed/merged.

### Step B — area-driven sizing (`MIT_BUBBLE_AREA_FIT`, /tdd)
The automatic fix vs Step A's blunt global floor: size each region's font to its **balloon area** (#170 `bubble_box`) instead of the source textline column.
- **Pure helper** `manga_translator/font_fit.py` `bubble_area_font_size()` — linear scale = `sqrt(bubble_area / (textline_area × share))`, clamped `[1, max_ratio=1.6]`, only grows, `share` = lines splitting one balloon (so a multi-line bubble doesn't overflow). 6 tests, no ML imports.
- **Wiring**: `_build_local_region` shifts `bubble_box` into crop coords; `_process_group` calls `_apply_bubble_area_fit(local_regions)` when `config.render.bubble_area_fit`; it sets `region.font_size` (plain attr) — renderer (`rendering/__init__.py`) untouched. `RenderConfig.bubble_area_fit` (off=byte-identical); Backend `MIT_BUBBLE_AREA_FIT` knob (`books-mit-config` 15 green).
- **Frontend E2E** (worker + backend restarted on Step B code, `MIT_BUBBLE_SEG=1 MIT_BUBBLE_AREA_FIT=1`, no font-min, cache cleared, Kouchuugun p1 re-translated; worker logged `7 balloons, 24/24 regions tagged`): per-box sizing — spacious boxes (e.g. "แล้ว…อะไรจะเลวร้ายไปกว่านี้ได้") render large/fill, dense boxes stay readable; no overflow, no uniform-tiny. Distinct from Step A's uniform global bump.
- Tests: MIT 16 (font_fit 6 + bubble_association 10) + Backend 27 (mit-config 15 + patch-store 12) green. **Issue #166 NOT closed — awaiting user confirm.** Remaining: Step C (crop growth), Step D (display-text). Dev env now `MIT_BUBBLE_AREA_FIT=1` (font-min removed).

---

## MangaTranslator round-2 deep read — hidden techniques (2026-06-08, research)

Re-swept the full `/MangaTranslator` clone (33K LOC, Apache-2.0) with 5 parallel Explore agents to find techniques the first study missed. New doc: `docs/research/mangatranslator-round2-deep.md` (cross-linked from `mangatranslator-internals.md`). Highest-value new findings:
- **Full binary-search font-sizing constants** (low=8/high=16 dialogue, 10–64 OSB; fit-test = line_width≤W ∧ block_height≤H; collision = 4 corners inside mask; squeeze ×0.90 up to 3×; line-height from real Skia metrics; pole-of-inaccessibility anchor) → makes #166 implementable for real, not a weak heuristic.
- **Mask edge feathering** (`ramp = 1 − d_out/blur_radius`, distance-transform alpha) → kills patch seams; applies to our LaMa patches (#156). New issue candidate.
- **Emphasis contract** (`*italic*`/`**bold**`/`***bi***` + Giongo→onomatopoeia / Gitaigo→verb-no-period) → complete recipe for #171 P2, prompt-only.
- **Solid-bg → flat-fill** (white/black border ratio ≥0.95 skips inpaint) → our white caption boxes qualify. New issue candidate.
- **min-128px upscale before OCR** + numbered-parser `[Missing item N]` repair + SAM neighbour whiteout → #172.
- **Event-based OCR chaining** for parallel batch = exactly our #159.
- Quick wins: temp 0.1 all providers, ellipsis `…→...`, RTL no-reorder, determinism-gate cache + 2px bbox quantize.
- Confirmed model repo ids (speech-bubble = `kitsumed/yolov8m_seg-speech-bubble` which we already adopted for #170; OSB = `deepghs/AnimeText_yolo` for #168).
- Roadmap mapping updated in the round-2 doc. PRD #169 extended via comment (P4/P5 + grounds #166 with the full binary-search spec); **two new issues filed under #169: #173 (patch-seam edge feathering, P4) and #174 (solid-bg flat-fill fast-path, P5)** — bilingual, ready-for-agent.

---

## #160 — translation memory persistence (2026-06-08, /tdd, live-verified)

PRD #155 P3. Translated text becomes durable memory in Supabase; the per-page webhook persists each page's #158 text layer.

- **Migration** (Supabase MCP `apply_migration`, project `mangadock`): `manga_glossaries`, `chapter_page_texts`, `chapter_summaries` per the PRD schema; RLS enabled, **no policies** (server-only — service role bypasses RLS).
- **Repository** `translation-memory.repository.ts` — best-effort (try/catch → boolean, never throws → translation never depends on it): `savePageText` (idempotent upsert on `(chapter,page,lang)`), `upsertGlossary` (a `source='auto'` write is **skipped when the stored row is `edited`** — curation protected; explicit `edited` always wins). 5 unit tests, mocked Supabase.
- **Wiring**: constructed from the already-injected `SupabaseService` (no constructor/module change → zero spec breakage); `handleMitCallback` fire-and-forgets `savePageText` after caching (no added latency).
- **BUG found by the live demo** (why real testing matters): the webhook controller's anti-corruption mapping `const result = { imgWidth, imgHeight, patches }` **dropped `regions`** → first demo left `chapter_page_texts` empty. The existing #158 test accepted the field but never asserted it was *forwarded*. Tightened that assertion (RED), then added `regions` to the destructure + result (GREEN). `mit-webhook-hmac.spec` 9 green.
- **Live demo** (batch-translate Kouchuugun ch.1 via the frontend → webhooks → persist; queried Supabase): rows appear in `chapter_page_texts` — e.g. page 0 = 24 regions, `"COLONIAL PLANET VESTA…"` → `"ดาวเคราะห์อาณานิคมเวสตา…"`, with model/target_lang. Acceptance #4 met.
- Read paths + summary/glossary generation are later slices (#161). Issue open, not committed.

---

## #168 — SFX detector: pure core + seam (2026-06-08, /tdd, AFK-gated)

The deep testable module + env seam of #168, AFK-buildable without the model. The AnimeText-YOLO wrapper + pipeline second-pass + proof on the SFX pages are a **separate slice gated on** (a) model-download approval (deepghs/AnimeText_yolo `.pt`, security gate) and (b) the SFX reference pages p8/p13 (MangaDex 404'd them this session).

- **Pure helper** `manga_translator/sfx_merge.py` `dedup_sfx_boxes()` — drops second-pass SFX boxes already covered (IoA ≥ 0.2 over the candidate area) by a DBNet textline, so dialogue isn't double-detected. 4 tests, no ML imports.
- **Seam**: `DetectorConfig.det_sfx` (off=byte-identical); Backend `MIT_SFX_DETECTOR` knob (`books-mit-config` 16 green).
- Not committed; issue open. Full completion needs the gated model + pages.

---

## #172 filed — OCR rescue ladder (PRD #169 P3) (2026-06-08)

Closed the last gap in residual-original-text coverage. The three causes of original text leaking onto a translated page are now all tracked: stylized SFX never detected → #168; OCR detected-but-dropped → #167 (shipped); **OCR recovered-but-mangled → #172 (new)**. Umbrella goal = PRD #169 User Story 5 ("zero original-language leftovers"). #172 = env-gated 3-step ladder (floor #167 done → geometric pre-split of over-long textlines → vision re-read via the existing gateway, per-page fallback logging); step 3 coordinates with PRD #171 P1 (multimodal OCR) to share the vision-OCR seam. Bilingual, ready-for-agent.

---

## Patch URL cache-bust — versioned `?v=<contentHash>` (2026-06-08, /tdd)

Fix for the stale-patch-cache bug found during #170 frontend E2E (deterministic patch filenames + `max-age=14400` → re-translating with changed geometry served stale PNGs up to 4 h; surfaced as garbled top caption boxes on Kouchuugun p1).

- **Seam**: `PatchStore.put()` (`patch-store.ts`) already had both the PNG bytes and the URL builder — append `?v=` = `sha1(bytes).slice(0,12)`. Content-hash (not mtime) so an identical re-translate keeps the URL (cache stays warm) while changed bytes bust it. Disk filename unchanged; only the returned URL carries the version. `toRelativeProxyUrl` (frontend) already preserves the query string → no frontend change.
- **TDD** `patch-store.spec.ts` (12 green): tracer = url has `?v=[0-9a-f]+`; same content → same version; different content → different version; updated 2 existing exact-url assertions to split off the query.
- **Regression**: full `src/books` suite = 15 fails (the pre-existing pubsub-batch baseline, unchanged) + 118 pass — zero new failures.
- **Live E2E** (rebuilt + restarted Backend, re-translated Kouchuugun p5 fresh): overlay urls now carry distinct hashes (`r0.png?v=41ee539faad3`, `r1.png?v=a3d68b56b02d`, …) — confirmed wired through to the browser `<img>` src.
- **Gotcha confirmed**: the fix only helps translations made *after* deploy — pages cached pre-fix (L3 holds the non-versioned response) keep serving stale patches. Cleared all 3 cache layers (8 PNG + 3 L3 + L1 restart) + reloaded the browser (frontend `patchedPages` short-circuits "แปลหน้านี้" → no backend call), re-translated p1 fresh → all 7 overlays now `?v=`-versioned with correct natH (587/617, not stale 1492/1489); p1 renders cleanly. Lesson folded into `feedback_clear_cache_before_test` (clear L3 + reload after any deploy).
- Not committed/merged (awaiting user).

---

## #170 bubble segmentation IMPLEMENTED — balloon-aware grouping fixes scattered clumps (2026-06-08, /tdd)

P0 enabler of PRD #169. Additive scope (user-chosen): DBNet stays the text detector; a speech-balloon YOLO-seg enriches each region with its balloon. All behind `MIT_BUBBLE_SEG=1` — off = byte-identical.

- **Proof first (measure, don't guess)**: `tools/diag_bubble_seg.py` loaded `kitsumed/yolov8m_seg-speech-bubble` on 5 real Kouchuugun pages → masks correct (7/6/8/10/8 balloons), **VRAM 8,598/12,282 = 70%** co-resident with the running worker (+663 MB), 30 ms/page. Gate passed before any pipeline code.
- **Slice 1-3 `bubble_association.py`** (pure geom, no ML, 10 tests <1s): `associate_regions_to_bubbles()` (containment → smallest-area nested wins → IoA fallback ≥0.5) + `group_regions()` (balloon-aware union-find: different balloons never merge, same balloon always merges; all-None = legacy proximity).
- **Slice 4 env knob**: Backend `buildMitConfig` `MIT_BUBBLE_SEG` → `detector.det_bubble_seg` (`books-mit-config.spec` 11 green); MIT `DetectorConfig.det_bubble_seg` + source-inspection wiring test.
- **Slice 5 ML wrapper + integration**: `bubble_detector.py` lazy YOLO wrapper (best-effort → no balloons on failure); `translate_patches` tags regions when flag on; `_group_nearby_regions` **refactored to delegate** to the pure `group_regions` (extract-for-testability).
- **E2E A/B verify** (worker restarted on new code, same page, flag-only diff): Kouchuugun p1 caption-box page **2→7 patches, aspect 0.30→0.73** — scattered clumps gone. OFF reproduced the exact `451×1489`/`649×1492` baseline → byte-identical.
- **Frontend E2E** (Playwright via `hayateotsu.space` tunnel, Backend rebuilt + restarted with `MIT_BUBBLE_SEG=1` + `MIT_OCR_PROB=0.03`, Kouchuugun cache cleared 93 PNG + 38 L3): translated p1 → backend log `page=0 → 7 patches`, reader rendered all 7 per-balloon overlays (aspect 0.67–0.86); p4 → `page=3 → 3 patches` (wide banner 2.9 / square bubble 1.02 / tall caption 0.7) — each container its natural shape, no clumps. Remaining within-box gaps = #166 sizing, as scoped. Dev env left with the flag on (revert: restart Backend without `MIT_BUBBLE_SEG`).
- **Stale-patch-cache bug found via original↔translated compare (NOT a #170 logic bug)**: user's p1 screenshot showed the top caption boxes squished/garbled. Measured: overlay `r0`/`r1` `naturalHeight` = 1492/1489 (old OFF strips, browser-cached under the same deterministic filename `p0__r0.png`) while the disk files were 587/617 (correct new bubble patches). Proof: re-fetched with `?bust=` → 587/617; busting the live overlay `src` rendered p1 correctly. Root cause = patch overlay `p.url` in `MangaReader.tsx` has **no cache-bust param** + `max-age=14400`, so re-translating with changed geometry serves stale patches up to 4 h. Real fix (separate scope) = version the patch URL (`?v=<mtime/hash>`). Methodology recorded in `frontend-testing` skill (original↔translated compare is mandatory; stale-cache diagnostic; search→modal→read playwright recipe).
- **Scope boundary**: #170 delivers boundary + grouping (carries `region.bubble_box`); font-sizing to *fill* the balloon (remaining within-box gaps) is **#166**, now unblocked.
- New dep `ultralytics` (AGPL-3.0, self-hosted) in `requirements.txt`. Provenance: `PIPELINE.md §5` (manga_translator new 3→5). Lesson re-applied from this series: I twice guessed the scattered-clump cause before; measured patch dims + viewed renders this time.
- **Not committed/merged** (awaiting user). #170 has proof + E2E comments.

---

## LEAK SWEEP — #136 #137 #139 (+#138 falsified) — 2026-06-06

From architecture review report: candidates C1-C7 → issues #136-#143 (bilingual per new convention in `docs/agents/issue-tracker.md`)

- **#136 MIT page-context**: `reset_page_context()` + call at top of `translate_patches` — stops unbounded RAM growth on worker singleton + context leaking across jobs (`context_size=0` default → no behavior change) · `test_page_context.py` (2) · real seam = #140 (HITL)
- **#137 PatchStore**: single module owns `uploads/patches` — deterministic name `{src}__{tgt}__{model}__p{N}__r{N}.png` (re-translate = overwrite) + delete stale regions when page shrinks + `sweepLegacy()` sweeps random-name backlog (boot + daily `.unref`) · 3 call sites use PatchStore (`uploads/patches` removed from books.service) · `patch-store.spec.ts` (5) with fake mirroring real readdir semantics
  - **Mock-drift caught by live verify**: initial fake used prefix-list but `DiskStorageProvider.list` = `readdirSync(dir)` (one-level, basename) → sweep silently missed real disk → fixed both module+fake
- **#139 bundle**: stats `RECORD_VIEW_SCRIPT` single Lua (atomic write+TTL — spec rewrite 4 tests) · ContinueReadingRow timer ref+cleanup · log tee rollover across midnight · img-proxy 15MB cap
- **#138 falsified**: EventSource is inside effect + cleanup complete — Explore agent misread, verify before acting
- **Specs**: storage mock in all books specs adds `list`/`delete` · full suite 50/50 + build 0 + tsc 0
- **HITL pending**: #140 Translation Session · #141 MitClient+BatchJobRegistry · #143 NDJSON/fan-out ADR · #142 useChapterTranslation

---

## PRD #131 → #132+#133+#134 IMPLEMENTED — translator-aware model selector (2026-06-05 late)

From #130 finding (Qwen deployment shows Gemini selector that does nothing + wastes GPU across cache partitions) — full chain: /to-prd → /to-issues (3 vertical slices) → /tdd → live verify on branch `feat/translator-aware-model-selector`

- **#132 MIT**: `/ready` → `{ready, workers, translator}` · discovery: `GET /books/models` referenced in #87 **never existed** — Frontend used hardcoded fallback throughout · live: `curl /ready` → `"translator":"qwen3"` ✓
- **#133 Backend**: `getImageTranslator()` (60s cache, null when down/503/no-field) + `getMangaModelsInfo()` + route `GET /books/models` for first time · TDD `books-models.spec.ts` (6, RED→GREEN) · live: `{"models":[real catalog],"imageTranslator":"qwen3"}` ✓
- **#134 Frontend**: `fetchImageTranslator`/`isGeminiImageTranslator` (null = fail-open) + deep module **`getEffectiveImageModel()`** as single gate for all translate calls (blocks stale localStorage sending model on non-Gemini) · desktop+mobile menus gated by `showModelSelector` · live browser: menu opens but **"AI Model" hidden** on Qwen machine ✓ · tsc EXIT 0
- Docs: `CONTRACT.md` adds §Readiness

---

## LIVE E2E SESSION (2026-06-05 evening) — restart MIT + browser/API verified before merge

- ✅ Webhook path E2E with new code: run1 translated 4/4 complete
- **Bug found+fixed by e2e**: `handleMitCallback` still writing cache **v3** while pre-check reads v4 → webhook results never served from cache → fix via `patchCacheKey` + model segment from jobKey (commit `103177a`, TDD RED→GREEN, 22 tests green) → **run4/run5 = 0s instant** ✓
- ✅ **#127 live-proven**: repeated call after all-cached returns all 4 pages every time
- ✅ **Cancel chain (#101/#123) live-proven**: curl abort 6s → Backend cancels MIT job → MIT drops page 0 result
- ✅ **#128 live-proven**: planted stale cancel flag → new translation succeeded 2/2
- ✅ **#87 UI seen in screenshot**: model menu shows from real `/books/models`
- **New finding → #130**: machine uses `TRANSLATOR_TYPE=local` + `DEFAULT_LOCAL_TRANSLATOR=qwen3` → translates with Qwen3, not Gemini → model override correctly ignored per PRD scope, but UI selector silently misleads user

---

## #95 S2 + #87 UI + #129 RESOLVED (2026-06-05 second round)

- **#95 S2**: enforce secret only in production (option c); `NODE_ENV=production` + no-secret → 401 · `mit-webhook-hmac.spec.ts` **green for first time (7)** → baseline down to 14 (pubsub only)
- **#87 Reader model selector UI**: "AI Model" section in both desktop translate dropdown and mobile more-menu (chip pattern same as LANGS) — list from `fetchAvailableMangaModels()` + "Auto" button (= delete key → operator env wins)
- **#129 Decision option (a)**: accept + document · ADR in `MIT/ARCHITECTURE.md` §6 — cancel = page-boundary by design · UX: toast in `cancelTranslate`

---

## #87 IMPLEMENTED — per-request Gemini model (2026-06-05, TDD)

- **Slice A Backend**: `imageModelKey()` + `patchCacheKey()` — cache **v3→v4** with model segment; `buildMitConfig(..., imageModel?)` → `translator.model`; `buildJobKey` includes model (prevents cross-model collision)
- **Slice B MIT**: `TranslatorConfig.model: Optional[str]` · `_model()` = override or `GEMINI_MODEL` · `useCache` returns False when override ≠ default
- **Slice C Frontend**: `getSelectedMangaImageTranslateModel()` — new key `mangaImageTranslateModel`; UI pending

---

## #95 S1 IMPLEMENTED — webhook HMAC over raw request bytes (2026-06-05, TDD)

- **Root cause**: Backend verified HMAC on `JSON.stringify(parsed body)` but MIT signs raw bytes (`json.dumps(separators=(',',':'), ensure_ascii=False)`) → byte-unstable (e.g. float `1280.0` → JS stringify becomes `1280`) → mismatch when `MIT_WEBHOOK_SECRET` set
- **Fix**: `main.ts` json() `verify` hook saves `req.rawBody` · controller verifies on `req.rawBody`

---

## #127 + #128 IMPLEMENTED — cancel→re-translate poisoning (2026-06-05, TDD)

- **#127 Backend: all-cached batch job leak** — `startOrAttachBatchJob` early-return when `uncachedPages.length === 0` without removing placeholder from registry → next request of same jobKey attaches to resolved job → returns immediately, doesn't serve cache, doesn't call MIT. Fix: remove jobKey from registry before early-return
- **#128 MIT: stale cancel flag poisoning new batch of same taskId** — deterministic taskId + `/cancel` arriving after `discard()` in finally → taskId stays in `_cancelled` permanently → next run `is_cancelled` from first page → silent break, no webhook. Fix: `discard(taskId)` at run start — new submission supersedes stale cancel

---

## Cancel-propagation + Thai wrap + VRAM pass (2026-06-05)

- **Cancel**: Frontend proxy not forwarding `req.signal` → browser abort didn't reach NestJS → `res.on('close')` didn't fire → MIT never cancelled. Fix: `signal: req.signal`
- **Thai word wrap**: pythainlp not in requirements → `_HAS_PYTHAINLP=False` → ZWSP no-op → whole sentence treated as "1 word" → `calc_horizontal` fallback splits char by char. Fix: add `pythainlp` + `_safe_char_split` cluster-safe fallback. Test: `test/test_thai_wrap.py` (8)
- **VRAM**: merge mitConfig to single `buildMitConfig()` · reduce defaults: detection 2560→2048, inpainting 2048→1536 · expose `MIT_DETECTION_SIZE/INPAINTING_SIZE/INPAINTER/INPAINTING_PRECISION`

---

## Batch Translation End-to-End Fix Session (2026-06-04)

5 bugs found and fixed in sequence:

| # | Root Cause | Fix |
|---|---|---|
| 1 | MIT Webhook sent to Backend Public Origin (Cloudflare) — MIT on localhost can't reach it | Add `MIT_CALLBACK_ORIGIN` env + `mitCallbackOrigin` getter |
| 2 | Webhook controller rejected all requests when `MIT_WEBHOOK_SECRET` not set | Make HMAC optional — no secret → accept unauthenticated |
| 3 | `signal` passed to MIT POST → user cancel → kills TCP mid-flight → MIT BLAS crash (`forrtl error 200`) | Remove `signal` from MIT POST + pre-check `signal.aborted` before submit |
| 4a | MIT webhook body (base64 PNG ~1-3MB) exceeds body-parser default 100KB → `PayloadTooLargeError` | Set `json({ limit: '50mb' })` + `bodyParser: false` |
| 4b | Contract mismatch: MIT sends flat payload but controller expected `body.result` → crash | Controller reads flat fields, assembles `result` object itself |
| 5 | SSE endpoint no heartbeat → ~62s wait with no bytes → Cloudflare 524 | Add initial `: connected` byte + periodic `: ping` every 15s |

---

## MIT Scrutiny → Issues #100–#111 (2026-06-04 → 2026-06-05)

Full end-to-end scan of MIT server and logic layer. All 12 issues fixed with TDD.

| Issue | Severity | Fix Summary |
|---|---|---|
| #100 | Critical | `send_webhook` retry + dead-letter — extracted to `server/webhook.py`, 10 tests |
| #101 | Critical | Batch cancellation propagation — `cancellation.py` module, `POST /cancel/{taskId}`, 6 tests |
| #102 | Security | Path traversal in result file endpoints — `server/path_utils.py`, 7 tests |
| #103 | Security | Worker bind 0.0.0.0 RCE risk — hardcode `--host 127.0.0.1`, 6 tests |
| #104 | Major | Dead batch endpoints — removed `/translate/batch/json`, `/translate/batch/images` and related code |
| #105 | Cleanup | Dead code removal — 152 lines net deleted |
| #106 | Major | Async-correctness — streaming timeout, blocking HTTP → httpx, lock-across-await fix, 7 tests |
| #107 | Bug | GeminiTranslator error handling — `server_error_attempt=0`, bare raise fix, lstrip→removeprefix, IndexError guard |
| #108 | Major | GPT sample selection — replaced langcodes fuzzy-match with direct dict lookup, 4 tests |
| #109 | Major | Target-language check — replaced langid with target-script char ratio, 6 tests |
| #110 | Major | Rendering direction mismatch + None homography guard, 4 tests |
| #111 | Major | Region utils — textline_merge prob denominator fix, TextBlock null guard, mutable default, 5 tests |

**MIT unit suite final (2026-06-05): 49 tests passing** (up from 25 at session start)

---

## MIT Documentation (2026-06-05)
- `MIT/ARCHITECTURE.md` — 12-section blueprint (2-process model, directory map, patch path, translator subsystem, webhook, known issues #100-#111)
- `MIT/SETUP.md` — install/run/test runbook + real troubleshooting (forrtl 200, model load 150s, CUDA OOM, port conflicts)
- `MIT/CONTRACT.md` — wire format MIT↔Backend; casing footgun (single=snake_case vs batch/webhook=camelCase) + HMAC raw-bytes hazard + size limits

---

## PRD #92 — Qwen3 Offline Translator (2026-06-04)

Design for users with GPU (RTX 4070 Super 12GB) who want offline manga translation without Gemini API dependency.

Solution: New `Qwen3Translator` class with thinking mode disabled + `MIT_TRANSLATOR` env var in Backend to select translator type. Qwen3-4B BF16 = ~8GB VRAM, fits in 12GB.

---

## Phase 1.5 Completion Verification (2026-05-27)

All 4 pillars verified: Community Forum (PR #9 merged), HWID middleware enforcement, Creator Earnings API+UI, Zero-Trust Gate.

---

## Phase 2 — 2-Layer Cache Upgrade (Branch: feat/2-layer-cache-upgrade, Commit: ad72574)

- **ElectionService** — Redis NX Lock, Lua CAS renewal, 15s interval, TTL=37.5s
- **MetricsService** — CPU/mem/latency heartbeat every 10s
- **BatchSyncWorker** — Reliable Queue: `RPOPLPUSH` + `LREM` ack + crash recovery + leader-only guard
- **CacheOrchestratorService** — write-behind `set()`: L1 + L2 + `markDirty()`
- **Test Count:** 134 passing (up from 117)

---

## Phase 2b — Issues #13–#15: L3 Batch Layer (2026-05-28)

- **#13 L3DiskService** — extracted disk I/O from JsonCacheService; fixed bug: `set()` was calling `writeToDisk()` on every update — massive disk I/O overflow
- **#14 L3BatchWriter** — periodic L2→L3 batch on all nodes: wallet 2s, stats 5s, default 60s
- **#15 Leader flush wire** — `BatchSyncWorker.syncKey()` now calls `l3.write()` before future Supabase RPC
- **Test Count:** 155 passing

---

## Phase 2c — Issues #18–#21: Dirty Queue Bug Fixes (2026-05-28)

- **#18** Processing queue leak — missing `DEL` before re-queue in `recoverOrphans()`
- **#19** Expired key orphan — `lrem` ack on early return prevents permanent orphan
- **#20** Shutdown durability — `onApplicationShutdown()` now calls `l3BatchWriter.flush()` instead of useless L1↔L2 timestamp sync
- **#21** Non-atomic crash recovery — replaced DEL→RPUSH sequence with single `RECOVER_SCRIPT` Lua EVAL
- **Test Count:** 161 passing

---

## Phase 2.4–2.5 — Cache Hardening (2026-05-29)

- **CatastrophicRecoveryService** — boot with Redis down → read L3 → compare timestamp with Supabase → buffer winners → fire-once reconnect callback; smart dirty queuing skips Supabase winners
- **BatchSyncWorker Retry Budget** — `MAX_RETRIES=5`, `HINCRBY cache:retry_counts`, `SADD cache:dead_letter` on exhaustion
- **CacheHealthService** — `GET /status/cache` → `{ dirtyQueueDepth, processingQueueDepth, deadLetterCount, l3KeyCount, isLeader }`
- **Timer hygiene** — `.unref()` on all `setInterval` timers to prevent Jest process leak
- **Test Count:** 277 passing

---

## Translation System Overhaul (2026-06-04)

6 bugs fixed (#73–#78): `.finally()` job deletion race, raw pixel coords as percentages, HMAC mismatch, idempotency race, latecomer listener ordering, TOCTOU in job registration.

Dead code removed (#81): `translateMangaPage()` full-image path, its controller endpoint, and frontend export.

**Architecture Decision: Option A'** — Replace `activeBatchJobs` Map with Redis pub/sub; `handleMitCallback` = `cache.set` + `redis.publish`; eliminates all 6 bug classes.

**Test Count:** 299 passing

---

## V5 Final Hardening (Commit 69712f9)

- Error handling: all `throw new Error()` → `InternalServerErrorException` in UnlockService
- Runtime validation: `ValidationPipe` (class-validator) enabled globally in `main.ts`
- Test integrity: `forum.controller.spec.ts` mocks updated to match real contract `{ items, total }`
<!-- lang:end -->

<!-- lang:th -->
# DONE — Claude Code Review Fix Session (2026-05-27)

---

## ส่งมอบ Native Phase 2 ชุดแรกและเผยแพร่ issues การย้าย — 2026-10-03

- ทำต่อทิศทาง `$grill-me` → `$to-prd` → `$to-issues` → `$tdd` ที่อนุมัติโดยใช้แผน parity ครบเดิม เผยแพร่ native [PRD #724](https://github.com/Slow-Inc/MangaDock/issues/724) และ slices สองภาษา 29 งาน #725–#753 ผ่าน GitHub CLI tooling ที่ทำต่อได้ คง parents เก่า/ใหม่และเปิดทุก issue ไว้ ไม่ทำ commit/PR/merge หรือแผนซ้ำ
- เพิ่ม Home/hero/landing rows native, navigation mobile หกปลายทางเดิม, pagination releases/tags/genres และ related manga ด้วยบริการ/artwork เดิม มีรายการส่วนตัวเริ่มต้นและเปิดดู feeds/posts Community; Home/ประวัติกู้ Reader ที่ผ่าน gates ตาม Chapter/Page ที่บันทึกไว้ History writes เดิมใช้ auth เรียงลำดับ แยกบัญชีและรอ server acknowledgement; reads ช้าไม่ทำ progress ย้อน แสดง save failures พร้อม retry
- TDD ตรวจ races ของ response/filter/Back และการแยกบัญชีผ่าน modules Mobile/Supabase SDK จริงกับ HTTP fixtures ภายนอก การตรวจ Mobile ล่าสุด: **121/121 tests**, typecheck, Android Hermes export **709 modules / 2.6MB / 10 assets** ทุกคำสั่ง exit 0 ไม่เพิ่ม runtime dependency หรือแก้ source Frontend/Backend/MIT/shared bridge เพิ่มในรอบนี้
- ยังเปิด acceptance ภาพ/บริการจริง Phase 2 ใหม่: env Mobile ขาด public variables API/Supabase สามตัวและมีชื่อ config Backend; runtime Backend ไม่พร้อม ไม่คัดลอก/เขียนทับ secrets Automatic approval review ปฏิเสธการเปิด Metro ด้วย credentials ชั่วคราว โดยแจ้งเพียง “blocked by policy” และไม่ได้เลี่ยง Source export ไม่ยืนยัน initialization/visual parity ส่วน signed/physical beta และ workflows Phase 2/3 ที่เหลือยังไม่ผ่าน acceptance
- ทำต่อจาก [Ledger Phase 2](Mobile/docs/2026-10-03-native-phase2-implementation.md), [ADR 029](docs/adr/029-mobile-native-discovery-navigation-and-history.md) และ [impact record](docs/reports/system-impact-report.md) ยังไม่ commit ให้ตั้ง environments ส่วนตัว validate แล้วเทียบเว็บ/native ที่มีข้อมูลก่อนรับ S11 จากนั้นทำเกณฑ์ที่ขาดของ S12/S20 และ slices ถัดไป

## ตั้งตำแหน่ง Android SDK เฉพาะเครื่อง — 2026-10-03

- ทำซ้ำ `SDK location not found` ด้วย `gradlew.bat help`: SDK ติดตั้งอยู่แล้ว แต่ environment SDK ทั้งสองตัวยังว่าง และไม่มี `android/local.properties` เพิ่มเฉพาะ `sdk.dir` ในไฟล์ local ที่ Git ignore ให้ชี้ SDK เดิม พร้อมบันทึกวิธีตั้งค่าเครื่องและกู้คืนหลัง clean prebuild ใน Mobile README
- ตรวจคำสั่ง `app:assembleDebug` เดิมสำหรับ x86_64: **BUILD SUCCESSFUL**, exit 0, 204 tasks (รัน 5 / up-to-date 199) ไม่แก้ source แอปหรือ dependencies การสร้าง debug APK ไม่ยืนยันบริการจริงหรือ acceptance beta เอกสารที่เก็บใน Git ยังไม่ได้ commit

## Native UI อิง design responsive mobile เดิม — 2026-10-02

- ผู้ใช้ชี้แจงต้นแบบภาพ: `DESIGN.md` รากและ Frontend responsive mobile จริง ปรับ native views Phase 1 ด้วยโลโก้เดิม สี Deep Space/indigo/amber, grid ปกค้นหา, ปก/CTA รายละเอียดกลาง, Login social ก่อนอีเมล, presets เติมเงิน และเปิด Reader controls เมื่อต้องใช้ โดยคง contracts ของ controllers API/auth/payment/translation และไม่แสดง search offline error เป็นผลสำเร็จที่ว่าง
- เพิ่ม tokens และ shared chrome ที่ Mobile ดูแล พร้อม raster assets หกไฟล์และตัวสร้าง assets ตอนพัฒนา ไม่มี runtime dependency, การแก้ source Frontend/Backend/MIT หรือ shared bridge เกณฑ์ PRD/slices ครอบคลุมต้นแบบภาพนี้ทุก phase; bottom navigation ครบและหน้าปลายทางอยู่ Phase 2
- ตรวจแล้ว: Mobile **88/88 tests**, typecheck, Android Hermes export **697 modules / 2.5MB** ตรวจภาพโลโก้/Login ใหม่บน debug app ที่ติดตั้งอยู่ใน emulator จริง [Mapping ภาพก่อน/หลังและเกณฑ์ที่เหลือ](Mobile/docs/2026-10-02-native-responsive-design-parity.md)
- ยังเปิด acceptance หน้าที่มีข้อมูลจริง: Backend port 4001 ไม่พร้อม; watch ที่ agent เปิดเองล้มจาก environment Supabase ที่ขาดและหยุดแล้ว ไม่มี signed APK ใหม่ ยังต้องตรวจ metrics ฟอนต์ที่ bundle โดยตรง ภาพเทียบเว็บ/native และ Wallet/Reader ที่ต้องบัญชี ยังไม่ได้ commit ทำต่อจาก design-port note ของ Mobile

## แก้ความเข้ากันได้ของ Android Gradle wrapper — 2026-10-02

- คืน `Mobile/android/gradle/wrapper/gradle-wrapper.properties` ที่สร้างอัตโนมัติจาก 9.4.1 เป็น **9.3.1** ให้ตรง template Expo และ wrapper ของ RN plugin ที่ติดตั้ง Log build ผู้ใช้พบ compiler Kotlin 2.1.20 อ่าน metadata Kotlin 2.3.0 ไม่ได้; `--version` ของ Gradle 9.3.1 ยืนยัน Kotlin 2.2.21
- บันทึก toolchain และการรันต่อใน [Mobile README](Mobile/README.md#android-gradlekotlin-compatibility) และ [execution ledger](Mobile/docs/2026-10-02-native-phase1-implementation.md) Native files เป็นไฟล์ที่สร้างและไม่เก็บใน Git; prebuild ใหม่ใช้ 9.3.1 อยู่แล้ว ไม่มี dependency หรือ custom plugin เพิ่ม
- ยังไม่ยืนยัน APK: assemble ของ agent ล้มจาก Java หา real path ใน sandbox แล้วได้ `AccessDeniedException` ทดสอบ Java แยกอ่าน JAR เดียวกันใน workspace ได้ 83,267 bytes แต่ `Path.toRealPath()` ล้ม ทำต่อด้วย `npm.cmd run android` ใน terminal ปกติของผู้ใช้ใน Mobile ยังไม่ได้ commit และไม่แก้ Backend/Frontend/MIT เพิ่ม

## แก้ Backend compile ไม่ผ่านจาก profile join — 2026-10-02

- แก้ TS2352 ทั้งห้าจุดใน reader comments, reviews และ user follows ให้ตัวแปลง profile รองรับ object, array และ null; join ว่างยังคืนชื่อ/รูปเป็น null หรือข้าม profile ที่ไม่มีในรายการ follow ถอด cast ที่ไม่ตรงชนิดโดยคง query และฟิลด์ response API เดิม
- ทำ TDD ยืนยันว่าข้อมูลชื่อ/รูปหายและรายการ follow ผิดเมื่อ join เป็น array โดยใช้ Supabase SDK จริงกับ HTTP จำลอง เพิ่ม regression tests 12 เคส; `npm.cmd run build` ผ่าน; ชุดทดสอบ Backend ทั้งหมด **90 suites / 960 tests ผ่าน**
- ขอบเขต: Backend สาม services และ specs ใหม่ พร้อม history นี้และ [impact report](docs/reports/system-impact-report.md) ไม่มีการเปลี่ยน dependency, schema, Frontend หรือ MIT เป็นการแก้ปัญหาเปิด Backend ที่ผู้ใช้รายงาน แยกจากงาน native Mobile และยังไม่ได้ commit
- ทำต่อจากตรงนี้: หาก watch เดิมยังไม่ rebuild ให้รัน `npm.cmd run start:dev` ใน `Backend` ใหม่; ยังต้องตรวจการเชื่อมต่อฐานข้อมูล/runtime ในเครื่องผู้ใช้

## #694 — SFX rescue บอกเหตุผลเมื่อคืนค่าว่าง (2026-09-26)

**อะไร:** `vlm_localize_sfx` ใน `MIT/manga_translator/ocr_vlm.py` ตอนนี้ log `WARNING` หนึ่งบรรทัดเมื่อคำตอบจาก
vision model ใช้เป็น SFX ไม่ได้: `SFX reply unusable: finish_reason=… content=… max_tokens=24 crop=WxH`
เมื่อคำตอบถูกตัดหรือเป็น `None` และ `SFX reply sanitised to empty: '…'` เมื่อได้คำตอบมาแต่ `sanitize_sfx`
ตัดจนว่าง ค่าที่ return ไม่เปลี่ยนในทุกกรณี — การถอยกลับเป็น `''` ตั้งใจและปลอดภัย (region จะแสดง SFX ดิบ)

**ทำไม:** `''` จากฟังก์ชันนี้ถูกอ่านต่อว่า "region นี้ไม่มี SFX" คำตอบที่ถูกตัดจึงดูเหมือน region ว่างทุกประการ
เป็นเหตุที่ 2026-07-11 สรุปว่า "text MoE" และ 2026-07-28 ต้องเขียน probe เองราว 10 ตัวกว่าจะเจอ defect สามตัว
(verdict #4 ใน `docs/reports/benchmarks/2026-07-28-679-sfx-gate.md`) Doctor (#688) ระบุได้ แต่เฉพาะตอนรัน
Doctor เท่านั้น production ยังเงียบ

**ไม่อยู่ใน scope:** เพิ่ม token budget หรือปิด thinking (verdict #3: บน model ที่ใช้อยู่ จะได้ผลมั่วที่ดูมั่นใจ)
ฟังก์ชันไม่รู้ id ของ region จึงใช้ขนาด crop แทน

**เจอระหว่างเขียนเทสต์:** `'(no sound effect)!!'` ผ่าน `sanitize_sfx` ออกมาเป็น `NO SOUND EFFECT !!` —
คือ refusal ที่หลุดตามที่ probe `sanitize` ของ #688 รายงาน แยกไว้เป็น issue ของมันเอง

**Validation:** TDD — เทสต์ใหม่ 4 ตัว แดงก่อน 3 ตัว (ไม่มี warning) แล้วเขียว mutation ทุก branch: ลบเช็ค
`finish_reason`, ลบเช็ค sanitise-ว่าง หรือลบ budget ออกจากข้อความ แต่ละอย่างทำให้เทสต์แดงหนึ่งตัวพอดี
ผ่าน 47 ตัวใน `test_ocr_vlm`, `test_sfx_gate_scan`, `test_lazy_import`, `test_stage_c_wiring` ไม่ได้ boot MIT
## #688 — Doctor LLM contracts: สี่ด่านที่เปลี่ยน `''` เงียบ ๆ ให้เป็น failure ที่มีชื่อ (2026-08-31)

**อะไร:** `MIT/tools/pipeline_doctor/llm_contracts.py` — probe สี่ตัวบนการเรียก SFX rescue ครั้งเดียว
ครอบชั้น LLM/gateway ที่ไม่มีอะไรใน repo มองเลย · `vlm-send` (ตั้ง model, budget สูงกว่าพื้น reasoning,
ใส่ flag thinking), `vlm-image` (ถอดรหัสได้, RGB, ไม่ว่างเปล่า, ไม่ต่ำกว่าพื้นความละเอียด vision),
`vlm-recv` (`finish_reason`, `content` ไม่เป็น `None`), `sanitize` (คลังรูปแบบการปฏิเสธที่โมเดลพ่นออกมาจริง)
· 20 เทสต์ใน `test/test_pipeline_doctor_llm.py`

**จุดออกแบบที่เป็นหัวใจ:** `capture_sfx_call` รัน `vlm_localize_sfx` **ตัวจริง** โดยเสียบ recorder เข้าที่รอยต่อ
`post_fn` ดังนั้น contract ตรวจโค้ด production จริง ๆ · probe ที่อ่าน payload ฉบับเขียนมือจะเขียวผ่านการแก้ที่มัน
มีไว้จับพอดี — ลองเปลี่ยน capture เป็น body เขียนมือแล้วเทสต์แดง 9 จาก 20

**ผ่านเกณฑ์ของ #685 (เกณฑ์ที่พิสูจน์ผิดได้):** บั๊กทั้งสามของ 2026-07-28 โผล่ในการเดินรอบเดียว แต่ละตัวมีบรรทัด
และหลักฐานของตัวเอง — `vlm-send` FAIL (`budget 24 <= 2048 measured to truncate`), `vlm-recv` FAIL
(`finish_reason=length, content=None`), `sanitize` FAIL (`'EMPTY LINE' -> 'EMPTY LINE'`) และ
`vlm-image` WARN (~40 visual token เทียบกับ 336 ที่วัดว่าโมเดลตอบ)

**ทุก threshold คือค่าที่วัดมา และอ้างอิงไว้ตรงค่าคงที่ที่ใช้มัน** (`2026-07-28-679-sfx-gate.md`) ·
สองช่วงยังเป็น WARN เพราะไม่มีใครหาขอบเขตจริงเจอ: พื้นความละเอียด vision มาจากการวัดครั้งเดียว และช่วง budget
2048–4096 ยังไม่มีใครวัด · Doctor **ไม่แก้อะไรเลย** — มันแค่ทำให้บั๊กเรียกชื่อได้ · ตั้งใจแบบนั้น เพราะคำตัดสินของ
benchmark นั้นคือการเพิ่ม budget บนโมเดลปัจจุบันจะพ่นคำมั่ว ๆ ที่ดูมั่นใจลงไปบนภาพ

**บั๊กในเทสต์ของงานนี้เอง ที่เจอและแก้แล้ว:** `test_the_contracts_import_without_torch` ตอนแรก assert
`'torch' not in sys.modules` ตรง ๆ — เขียวใน CI (ไม่ได้ลง torch) แต่แดงบนเครื่อง local ทันทีที่มีโมดูลก่อนหน้า
import pipeline · มันวัดลำดับการ import ของ suite ไม่ใช่กราฟ import ของโมดูล และจะเขียวพอดีในสภาพแวดล้อมที่
ตรวจ regression ไม่ได้ · เขียนใหม่เป็นการเช็คใน subprocess พร้อม negative control

**คุมขอบเขต:** D1 ของ #688 (แยกฟังก์ชัน thinking/budget ห้าตัวออกจาก `custom_openai`) **ไม่ได้ทำ** —
ฟังก์ชันพวกนั้นไม่มีอยู่บน `main` (มากับ #623 บน `perf`) ข้อตั้งต้นจึงเป็นโมฆะบนฐานนี้ · สิ่งที่ส่งคือครึ่ง SFX
ซึ่ง issue ระบุเองว่าเป็นลำดับแรก · ส่วนช่องว่างฝั่ง production ที่ benchmark ขอไว้ (log `finish_reason: length`
ใน `ocr_vlm` เอง) เป็นงานใหม่ และเปิด issue แยกแทนที่จะกลืนเข้ามา

Benchmark: `docs/reports/benchmarks/2026-08-31-688-doctor-llm-contracts.md` (+ PNG)
เทสต์: ใหม่ 20 ตัว, mutation-test ผ่าน 6/6, suite MIT เต็ม 768 ผ่าน / 1 fail ที่ค้างมาก่อน (network)

Refs #688 #685

---

## #686 — แกน Pipeline Doctor: probe registry + runner, เดินรอบเดียวได้ผลสองแบบ (2026-08-31)

**อะไร:** `MIT/tools/pipeline_doctor/` — รอยต่อที่งานอื่นทุกชิ้นของ #685 จะเสียบเข้ามา
`StageReport` (id ของ stage, `OK`/`WARN`/`FAIL`, metrics, evidence), `ProbeRegistry` ที่ probe เกาะเข้ามาด้วย
decorator และตัวเรนเดอร์สองแบบจากข้อมูลชุดเดียว: ตารางจัดคอลัมน์สำหรับ terminal และ JSON สำหรับ agent

**ข้อจำกัดที่กำหนดรูปร่างของมัน:** core ต้องไม่รู้ว่า stage ของไปป์ไลน์*คืออะไร* · probe ลงทะเบียนตัวเองตอน import
core จึงไม่เคยถือรายชื่อ stage ที่ต้องคอยตามแก้ — ซึ่งเป็นสิ่งที่ทำให้มันไม่ต้อง import ไปป์ไลน์ จึง torch-free
และรันใน gate `mit_logic` ได้ · ลำดับการลงทะเบียนคือลำดับไปป์ไลน์โดยตั้งใจ ถ้า sort จะพิมพ์ `render` ก่อน
`vlm-send` แล้วบรรยายไปป์ไลน์ที่ไม่มีอยู่จริง

**probe ที่ crash กลายเป็นแถว `FAIL` ที่พก exception มาด้วย แล้วเดินต่อ** — เครื่องมือวินิจฉัยที่หยุดตรง stage แรกที่พัง
ไม่บอกอะไรเลยเกี่ยวกับ stage ที่เหลือ ซึ่งเป็นตอนที่ต้องการมันที่สุดพอดี

**เจอโดย /scrutinize ไม่ใช่โดยเทสต์:** `to_table` ผิดคำสัญญาที่ตัวเองเขียนไว้ใน docstring · evidence ที่มี newline
ทำให้ 2 stage ออกมาเป็น 3 บรรทัดและพังคอลัมน์สถานะที่จัดไว้ และ control byte หลุดถึง terminal ดิบ ๆ ·
evidence ที่ probe พกมาสำหรับ stage ฝั่ง LLM คือสตริงที่ *โมเดล* เขียน ดังนั้น `[2J` ล้างจอ developer และ
`[31m` เปลี่ยนสีทุกอย่างที่ตามมา — แถว `FAIL` จะถูกแต่งให้เป็นอะไรก็ได้ · `_one_line` จึง escape ไม่ใช่ strip
(ไบต์ไหนกลับมา *คือ* ตัวการวินิจฉัย) ส่วน `to_json` เก็บดิบไว้ เพราะ JSON escape ให้อยู่แล้วและ agent ควรได้สิ่งที่โมเดลส่งมาจริง ๆ

**การตรวจสอบ:** TDD แดงก่อน (`ImportError: cannot import name 'ProbeRegistry'`) · แดงนั้นพิสูจน์แค่ว่า "ยังไม่มี"
จึง mutation-check ทุก assertion กับโค้ดที่เสร็จแล้ว — mutation ทั้งสี่ทำให้แดงตรงเทสต์ที่ระบุพฤติกรรมนั้นพอดี ไม่เกินไปกว่านั้น ·
13 เทสต์ · gate `mit_logic` ใน CI: **651 passed, 3 skipped, 0 failed** ส่วนการรันในเครื่องแบบ deps ครบคือ
**740 passed, 2 skipped, 0 failed** · benchmark + PNG: `docs/reports/benchmarks/2026-08-31-686-pipeline-doctor-core.md`

**รู้อยู่และไม่ได้แก้ที่นี่:** ถ้าทุก probe ไม่รับงาน run นั้นจะรายงาน `ok=True`/`exit_code=0` โดยมี 0 stage
ดังนั้น CI gate ที่ต่อกับมันจะเขียวทั้งที่ไม่ได้ตรวจอะไรเลย · core ไม่มีทางรู้ว่า stage ไหน*ควร*จะรายงาน
assertion ข้อนี้จึงเป็นของ #690 (งานต่อ CI) ซึ่งบันทึกไว้แล้ว

PR #692 · Refs #686 #685

## ✅ LEAK SWEEP — #136 #137 #139 (+#138 falsified) — 2026-06-06, /improve-codebase-architecture → /to-issues → /tdd

จากรายงาน architecture review (HTML ใน temp): candidates C1-C7 → issues #136-#143 (สองภาษาตาม convention ใหม่ใน `docs/agents/issue-tracker.md`)

- **#136 MIT page-context**: `reset_page_context()` + เรียกต้น `translate_patches` — หยุด RAM โตไม่จำกัดบน worker singleton + บริบทรั่วข้าม job (`context_size=0` default → ไม่มี behavior change) · `test_page_context.py` (2) · seam จริง = #140 (HITL)
- **#137 PatchStore**: module เดียวเป็นเจ้าของ `uploads/patches` — ชื่อ deterministic `{src}__{tgt}__{model}__p{N}__r{N}.png` (แปลซ้ำ=เขียนทับ) + ลบ stale regions เมื่อหน้าหดตัว + `sweepLegacy()` กวาด backlog ชื่อ random (boot+รายวัน `.unref`) · 3 call sites ใช้ PatchStore หมด (`uploads/patches` หายจาก books.service) · `patch-store.spec.ts` (5) ด้วย fake ที่เลียน **readdir semantics จริง**
  - 🎯 **mock-drift จับได้จาก live verify**: fake แรกใช้ prefix-list แต่ `DiskStorageProvider.list` จริง = `readdirSync(dir)` (ระดับเดียว, basename) → sweep เงียบบนดิสก์จริง → แก้ทั้ง module+fake — บทเรียน: fake ต้อง mirror adapter จริง
  - design note: sweep เป็น legacy-format cleanup (ไม่ใช่ age-based ตาม issue เดิม) เพราะ StorageProvider ไม่มี mtime — ของใหม่ bounded ด้วย overwrite จึงพอ
- **#139 bundle**: stats `RECORD_VIEW_SCRIPT` Lua เดียว (atomic write+TTL — spec rewrite 4 tests) · ContinueReadingRow timer ref+cleanup (mountedRef ที่ agent อ้างไม่มีจริง) · log tee rollover ข้ามวัน (เจอกับตัวคืน e2e) · img-proxy cap 15MB
- **#138 falsified ✓ ปิด not-planned**: EventSource อยู่ใน effect + cleanup ครบอยู่แล้ว — Explore agent อ่านพลาด, ผม file ก่อน verify (บทเรียนซ้ำ: verify ทุก finding ของ agent ก่อนใช้)
- **Specs**: storage mock ทุก books spec เติม `list`/`delete` · ทั้งชุด 50/50 + build 0 + tsc 0
- **HITL ค้าง**: #140 Translation Session · #141 MitClient+BatchJobRegistry · #143 NDJSON/fan-out ADR · #142 useChapterTranslation (AFK คิวหลัง)

---

## ✅ PRD #131 → #132+#133+#134 IMPLEMENTED — translator-aware model selector (2026-06-05 ดึก, TDD + live verified)

จาก #130 finding (Qwen deployment เห็น Gemini selector ที่กดแล้วไม่มีผล + เปลือง GPU ข้าม cache partition) — chain เต็ม: /to-prd → /to-issues (3 vertical slices) → /tdd → live verify บน branch `feat/translator-aware-model-selector`

- **#132 MIT**: `/ready` → `{ready, workers, translator}` (ใช้ `TranslatorConfig()` ที่เพิ่งเป็น default_factory) · **discovery**: `GET /books/models` ที่ #87 อ้างว่ามี **ไม่เคยมีจริง** — Frontend ใช้ fallback hardcode มาตลอด · live: `curl /ready` → `"translator":"qwen3"` ✓
- **#133 Backend**: `getImageTranslator()` (cache 60s, null เมื่อ down/503/no-field) + `getMangaModelsInfo()` + route `GET /books/models` ครั้งแรก · TDD `books-models.spec.ts` (6, RED→GREEN) · live: `{"models":[catalog จริง],"imageTranslator":"qwen3"}` ✓
- **#134 Frontend**: `fetchImageTranslator`/`isGeminiImageTranslator` (null = fail-open) + deep module **`getEffectiveImageModel()`** เป็น gating จุดเดียวของทุก translate call (กัน stale localStorage ส่ง model บน non-Gemini) · เมนูทั้ง desktop+mobile gate ด้วย `showModelSelector` · live browser: เมนูเปิด แต่ **"โมเดล AI" หายไป** บนเครื่อง Qwen ✓ · tsc EXIT 0
- Docs: `CONTRACT.md` เพิ่ม §Readiness

**ตั้งใจไม่ทำ:** MIT-side rejection ของ model field (per #87 — เมินเงียบถูกแล้ว) · migrate cache partitions เก่า (TTL 7 วัน)

---

## 🧪 LIVE E2E SESSION (2026-06-05 ค่ำ) — restart MIT + ทดสอบจริงผ่าน browser/API ก่อน merge

**Setup:** restart MIT ด้วยโค้ดใหม่ (web+worker) · Playwright MCP browser (มีข้อจำกัด: HMR ws พังผ่าน docker → หน้า reload เป็นพัก ๆ + Turnstile widget โหลดไม่ได้ → ต้อง seed `cf_clearance_token` เอง) · ส่วน Backend↔MIT ทดสอบผ่าน HTTP/SSE ตรง (แม่นกว่า)

**ผล (ตอน 5.5 = 4 หน้า, ตอน 16.5 = 2 หน้า ของ Otome Game):**
- ✅ Webhook path E2E โค้ดใหม่: run1 แปลครบ 4/4
- 🐛 **เจอ+แก้บั๊กที่ e2e จับได้**: `handleMitCallback` ยังเขียน cache **v3** ขณะ pre-check อ่าน v4 → webhook results ไม่เคยถูก serve จาก cache (run2 แปลซ้ำ 34s) → fix ผ่าน `patchCacheKey` + model segment จาก jobKey (commit `103177a`, TDD RED→GREEN, 22 tests เขียว) → **run4/run5 = 0s instant** ✓
- ✅ **#127 พิสูจน์ live**: เรียกซ้ำหลัง all-cached ได้ครบ 4 หน้าทุกครั้ง + log `all 4 pages were cached — skipping MIT` + `completed & removed from registry`
- ✅ **Cancel chain (#101/#123) พิสูจน์ live**: curl abort 6s → Backend `last caller gone — cancelling MIT job` → MIT `POST /cancel/... 200` + `cancelled - dropping page 0 result`
- ✅ **#128 พิสูจน์ live**: ปลูก stale cancel flag (POST /cancel ตอนไม่มี job = cancel-after-finish) → แปลใหม่สำเร็จ 2/2 (ก่อน fix จะเงียบทั้ง batch)
- ✅ **#87 UI เห็นด้วยตา** (screenshot): เมนูแปลแสดง "โมเดล AI": อัตโนมัติ/2.5-flash/2.5-flash-lite จาก `/books/models` จริง
- ✅ jobKey มี model segment จริง: `...:gemini-2.5-flash-lite started/completed` + cache partition แยก (แปลใหม่เมื่อเปลี่ยน model)
- 🔍 **Finding ใหม่ → #130**: เครื่องนี้ `TRANSLATOR_TYPE=local` + `DEFAULT_LOCAL_TRANSLATOR=qwen3` → MIT แปลด้วย **Qwen3** ไม่ใช่ Gemini → model override ถูกเมินอย่างถูกต้องตาม PRD scope แต่ UI selector หลอกผู้ใช้เงียบ ๆ — falsification test (โมเดลปลอม `gemini-9.9-nonexistent` ผ่าน batch = สำเร็จ?! แต่ REPL ตรง GeminiTranslator = 404 ✓) คือวิธีที่จับได้
- ⚠️ ยังไม่ verified ด้วยตา: toast ตอน cancel (#129) — reader โดน dev-reload เตะก่อนทุกครั้ง (artifact ของ MCP browser ผ่าน docker เท่านั้น ไม่ใช่บั๊กแอป) · model override บน **Gemini แท้** ใน worker path — เครื่องนี้เป็น Qwen จึงทดสอบไม่ได้โดยไม่สลับ env ผู้ใช้

---

## ✅ #95 S2 + #87 UI + #129 RESOLVED (2026-06-05 รอบสอง, user มอบหมายให้ตัดสินใจ)

**#95 S2 — enforce secret เฉพาะ production (TDD):**
- ตัดสินใจ option (c): no-secret + `NODE_ENV=production` → 401 (fail loudly) · dev/test → accept unauthenticated (คงการตัดสินใจ 2026-06-04 เรื่อง local dev)
- 2 tests baseline เดิมถูกเขียนใหม่เป็น production context + เพิ่ม dev-accept test → `mit-webhook-hmac.spec.ts` **เขียวทั้ง suite (7) เป็นครั้งแรก** → baseline เหลือ 14 (pubsub เท่านั้น) — อัปเดต memory ทั้ง repo+local แล้ว
- **#95 ครบทั้ง S1+S2+S3 → ปิดได้**

**#87 — Reader model selector UI (เสร็จ ปิดได้):**
- section "โมเดล AI" ในทั้ง desktop translate dropdown และ mobile more-menu (chip pattern เดียวกับ LANGS) — list จาก `fetchAvailableMangaModels()` (fetch lazy ตอนเมนูเปิดครั้งแรก) + ปุ่ม "อัตโนมัติ" (= ลบ key → operator env default ชนะ)
- เขียน `MANGA_IMAGE_TRANSLATE_MODEL_KEY` ลง localStorage · tsc EXIT 0 · eslint pre-existing เดิมเท่านั้น
- ค้างเฉพาะ manual e2e (ต้อง restart MIT)

**#129 — ตัดสินใจ option (a): accept + document (ปิดได้):**
- ADR ใน `MIT/ARCHITECTURE.md` §6 — cancel = page-boundary by design; เหตุผล: interrupt กลาง inference เสี่ยง forrtl 200, checkpoint ต้อง plumb taskId ข้าม process, worker ที่สอง = VRAM ×2; latency ยอมรับได้ ≤1 หน้า (~60-100s); revisit เมื่อมี multi-GPU/worker pool
- `CONTRACT.md` §3a — เตือน caller ว่า window นี้ไม่ใช่ "MIT down"
- UX: toast ใน `cancelTranslate` ("หน้าที่กำลังประมวลผลอยู่จะหยุดเมื่อจบหน้านั้น") — `useToast` (no-op ถ้าไม่มี provider)

---

## 🔄 #87 IMPLEMENTED (backend+MIT+lib; Reader UI ค้าง) — per-request Gemini model (2026-06-05, TDD)

**Slice A — Backend (เขียวครบ):**
- `imageModelKey()` (sanitize `[\w.-]`, strip `models/`) + `patchCacheKey()` — cache **v3→v4** มี model segment (`:model|default`); v3 เดิมหมดอายุเอง (TTL 7 วัน)
- `buildMitConfig(..., imageModel?)` → `translator.model` เมื่อ valid · `buildJobKey` รวม model (กัน cross-model collision — เกิน PRD แต่จำเป็น: jobKey เดิมจะชนกันเมื่อ 2 คนเลือกคนละ model)
- plumbing ครบสาย: controller (ทั้ง 2 endpoints + removeBatchListener) → startOrAttachBatchJob → _runMitBatch → NDJSON cache write → fallback → _retryMissingPagesIndividually
- Test: `books-image-model.spec.ts` (4, RED→GREEN) · `books-retry.spec.ts` อัปเดตตาม signature ใหม่ (spec ผูก private method) · nest build EXIT 0 · books suite = baseline เดิม

**Slice B — MIT (เขียวครบ):**
- `TranslatorConfig.model: Optional[str]` (config.py) — contract test `test_image_model_config.py` (2, RED→GREEN)
- `gemini.py`: `_model_override` set ใน `parse_args` ทุก dispatch · `_model()` = override หรือ `GEMINI_MODEL` · แทนที่เฉพาะ request path (count_tokens, generate_content ×2 รวม JSON helper) · **`useCache` คืน False เมื่อ override ≠ default** (cached_content ผูกกับ model ที่สร้าง — bypass ปลอดภัยสุด, ช้าลงเฉพาะ request ที่ override) · `caches.create`/`_CONFIG_KEY`/validation ตอน init คงใช้ env default โดยตั้งใจ
- ไม่เขียน gemini unit test (ต้อง network — precedent #107); MIT unit suite 69 passed

**Slice C — Frontend (plumbing เสร็จ; UI ค้าง):**
- `getSelectedMangaImageTranslateModel()` — key ใหม่ `mangaImageTranslateModel` → fallback key text เดิม (selector เดียวขับทั้งสอง ตาม PRD option แรก) → ไม่เลือก = `undefined` (operator env default ชนะ — user story 9)
- `mangaTranslatePage.ts` ทั้ง 2 fn + `MangaReader` ทั้ง 3 จุดเรียก ส่ง `imageModel` · tsc EXIT 0 · eslint = pre-existing errors เดิมเท่านั้น

**ค้างก่อนปิด #87:** (1) selector UI ใน Reader ที่ user ทั่วไปเห็น — ตอนนี้ขับผ่าน `DevMangaTranslateModelToggle` ที่ gate ด้วย `NEXT_PUBLIC_MANGA_TRANSLATE_DEV_TOOLS` เท่านั้น (2) manual end-to-end กับ MIT จริง (ต้อง restart MIT)

---

## ✅ #95 S1 IMPLEMENTED — webhook HMAC over raw request bytes (2026-06-05, TDD)

- **Root cause:** Backend verify HMAC บน `JSON.stringify(parsed body)` แต่ MIT sign raw bytes (`json.dumps(separators=(',',':'), ensure_ascii=False)`) → byte ไม่ stable (เช่น float `1280.0` → JS stringify เป็น `1280`) → ถ้าเปิด `MIT_WEBHOOK_SECRET` จะ mismatch
- **Fix:** `main.ts` json() `verify` hook เก็บ `req.rawBody` · controller verify บน `req.rawBody` (fallback stringify เฉพาะ direct invocation ที่ไม่มี Express req)
- **Test:** เพิ่ม raw-bytes test ใน `mit-webhook-hmac.spec.ts` (RED→GREEN ด้วย payload `1280.0`) · `nest build` EXIT 0
- **สถานะ #95:** S1 ✅ ตอนนี้ · S3 (5MB bound) มีผลอยู่แล้ว · **S2 (enforce secret) ถูก revert โดยตั้งใจ** ใน session 2026-06-04 (HMAC optional เพื่อ local dev) — 2 tests ที่ encode S2 strict behavior ยัง fail อยู่ใน baseline (จงใจไม่แตะ รอตัดสินใจ: enforce เฉพาะ production หรือ update tests ตาม behavior ปัจจุบัน)
- **Docs:** `MIT/CONTRACT.md` §5 — ย้าย S1 จาก open hazards → resolved

---

## ✅ #127 + #128 IMPLEMENTED — cancel→re-translate poisoning (2026-06-05, TDD)

อาการที่ผู้ใช้แจ้ง: cancel แล้วกดแปลใหม่ → "แปลทั้งตอน" ไม่ดึง cache + MIT ไม่ทำงาน · "แปลเฉพาะหน้า (ยังไม่แปล)" MIT ไม่ทำงาน · MIT รับ cancel ช้า → trace แล้วแตกเป็น 3 issues (#127 AFK, #128 AFK, #129 HITL-รอตัดสินใจ)

**#127 — Backend: all-cached batch job leak ใน `activeBatchJobs`**
- Root cause: `startOrAttachBatchJob` early-return ตอน `uncachedPages.length === 0` โดยไม่ลบ placeholder ออกจาก registry (cleanup อยู่ใน `finally` ที่ไม่ถูกแตะ) → request ถัดไปของ jobKey เดิม attach กับ resolved job → replay `completedPages` ว่าง → คืนทันที ไม่ serve cache ไม่เรียก MIT
- Fix: ลบ jobKey ออกจาก registry (guarded identity check) ก่อน early-return — mirror ของ finally-cleanup
- Test: `books-batch-registry.spec.ts` (2) — RED→GREEN; books suite baseline เดิม (16 pre-existing: pubsub 14 + hmac 2 — ตรง memory); `nest build` EXIT 0

**#128 — MIT: stale cancel flag วางยา batch ใหม่ของ taskId เดิม**
- Root cause: taskId deterministic (`chapterId:src:tgt`) + `/cancel` ที่มาถึง**หลัง** `run_batch_with_callbacks` `discard()` ใน finally ไปแล้ว → taskId ค้างใน `_cancelled` ถาวร → run ถัดไป `is_cancelled` ตั้งแต่หน้าแรก → break เงียบ ไม่ส่ง webhook เลย
- Fix: `discard(taskId)` ตอนเริ่ม run — submission ใหม่ supersede stale cancel; cancel ระหว่าง run ยังทำงานเหมือนเดิม (#101 ไม่ถดถอย — มี regression tests)
- Refactor เพื่อ testability (precedent #100 webhook.py): extract loop → **`server/batch_runner.py`** (deps เบา; heavy imports อยู่หลัง seam `_translate_page`) — `main.py` import จาก module ใหม่ + trim orphan imports (`send_webhook`, `is_cancelled`, `discard`)
- Test: `test/test_batch_runner.py` (4: stale-flag-no-poison, cancel-mid-page-drop, cancel-between-pages-stop, discard-on-exit) — import <1s ไม่ลาก ML stack · MIT unit suite รวม **67 passed**
- Docs sync: `ARCHITECTURE.md` §6 + `CONTRACT.md` §3a — ระบุ semantic "new submission clears stale cancel flag"

**ตั้งใจไม่แตะ:** #129 (page-granular cancel latency + single-worker starvation) เป็น HITL — รอเลือกแนวทาง (a) accept+doc / (b) checkpoint ใน pipeline / (c) worker ที่ 2 · pre-existing fails: Backend pubsub/hmac 16 ตัว, MIT upstream `test_translation*`/`test_textline_merge` (async-def, ไม่มี pytest-asyncio) — ยืนยันด้วย stash-run แล้วว่าไม่เกี่ยวกับ change นี้

**Review notes:** attach path ยังไม่ pre-check cache ให้ latecomer (ได้เฉพาะ `completedPages` replay) — พฤติกรรมเดิม ไม่ใช่ scope #127 · ยังไม่ commit (รอ user สั่ง)

---

## 🐛 Cancel-propagation + Thai wrap + VRAM pass (2026-06-05, /debug-mantra /scrutinize)

อาการที่ผู้ใช้แจ้ง: (1) กดยกเลิกแปล "ทั้งตอน" แล้ว MIT ยังแปลต่อ, (2) ตัวอักษรไทยขึ้นบรรทัดกลางคำ, (3) ขอลด VRAM/เพิ่ม perf

**#cancel — แปลต่อทั้งตอนหลังกดยกเลิก** (commit `e8a246f`)
- Root cause หลัก: `Frontend/app/api/proxy/[...path]/route.ts` ไม่ forward `req.signal` เข้า upstream fetch → browser abort ไม่ถึง NestJS → `res.on('close')` ไม่ fire → ไม่ยิง `/cancel` ไป MIT. Fix: `signal: req.signal`
- Root cause รอง: `removeBatchListener` สร้าง jobKey เองโดยไม่ผ่าน `shouldSendMitSourceLang()` → ตอน `MIT_SEND_SOURCE_LANG=false` (ค่าใน .env.example!) key ไม่ตรงกับ start path → cancel branch ไม่ทำงาน. Fix: extract `mitLangPair()`/`buildJobKey()` single source
- Test: `books-batch-cancel.spec.ts` (2) — cancel fire ทั้ง default และ `=false`

**#thai — ขึ้นบรรทัดกลางคำ** (commit `be2b01d`)
- Root cause: pythainlp ไม่อยู่ใน requirements → `_HAS_PYTHAINLP=False` → ZWSP no-op → ทั้งประโยคเป็น "1 คำ" → `calc_horizontal` fallback `list(word)` แตกทีละ code point ("จะ"→"จ"+"ะ")
- Fix: เพิ่ม `pythainlp` (newmm, no torch) + `_safe_char_split` cluster-safe fallback (มาร์ค U+0E31/0E34-3A/0E47-4E ติดพยัญชนะฐานเสมอ) wired 2 จุดใน calc_horizontal
- Reproduced จริงก่อนแก้ (debug-mantra step 1). Test: `test/test_thai_wrap.py` (8)

**#vram — env-configurable knobs** (commit `bd70698`)
- รวม mitConfig (เดิม duplicate 2 ที่) เป็น `buildMitConfig()` single source
- ลด default: detection 2560→2048, inpainting 2048→1536 (activation ∝ size²) + expose `MIT_DETECTION_SIZE/INPAINTING_SIZE/INPAINTER/INPAINTING_PRECISION`
- ชี้ชัด: int4/int8/fp8 ใช้ได้เฉพาะ LLM translator (Qwen3, `QWEN3_PRECISION` มีอยู่แล้ว) ไม่ใช่ CNN detector/OCR/LaMa. แนะนำ int4 สำหรับ 4B translator บนการ์ด ≤12GB. default translator = Gemini API = 0 local VRAM
- Test: `books-mit-config.spec.ts` (4). Backend baseline ไม่เพิ่ม regression (pre-existing 14 pubsub + 2 hmac เท่าเดิม)

---

## 🐛 Batch Translation End-to-End Fix Session (2026-06-04)

อาการ: แปลทีละหน้าได้ปกติ แต่ "แปลทุกหน้า" (Batch Translation) frontend ไม่แสดง patch — สุดท้าย frontend ได้ HTTP **524** (Cloudflare timeout)

พบและแก้ bug 4 ตัวตามลำดับ (debug จาก log ไฟล์ backend/MIT):

| # | Root Cause | Fix | Files |
|---|---|---|---|
| 1 | MIT Webhook ส่งไป Backend Public Origin (Cloudflare) ที่ MIT บน localhost reach ไม่ได้ | เพิ่ม `MIT_CALLBACK_ORIGIN` env + `mitCallbackOrigin` getter (`http://localhost:4001`) | `books.service.ts`, `.env`, `.env.example` |
| 2 | Webhook controller reject ทุก request เมื่อ `MIT_WEBHOOK_SECRET` ไม่ได้ตั้ง | ทำ HMAC เป็น optional — ไม่มี secret → accept unauthenticated | `mit-webhook.controller.ts` |
| 3 | ส่ง `signal` เข้า `fetch(mitUrl)` → user cancel → kill TCP กลางคัน → MIT BLAS crash (`forrtl error 200`) | ถอด `signal` ออกจาก MIT POST + เพิ่ม pre-check `signal.aborted` ก่อน submit | `books.service.ts` |
| 4a | MIT webhook body (base64 PNG ~1-3MB) เกิน body-parser default 100KB → `PayloadTooLargeError` | ตั้ง `json({ limit: '50mb' })` + `bodyParser: false` ตอน create app | `main.ts` |
| 4b | **Contract mismatch**: MIT ส่ง flat payload `{taskId,pageIndex,imgWidth,imgHeight,patches,error}` แต่ controller คาด `body.result` → `result.imgWidth` crash (undefined) | controller อ่าน flat fields แล้วประกอบ `result` object เอง (anti-corruption layer) — ตรงกับ NDJSON path ที่อ่าน flat อยู่แล้ว | `mit-webhook.controller.ts` |
| 5 | SSE endpoint ไม่มี heartbeat → ระหว่างรอ MIT แปลหน้าแรก (~62s, ใกล้ 100s) ไม่มี byte ไหล → Cloudflare 524 | เพิ่ม initial `: connected` byte (บังคับ proxy เข้า streaming mode) + periodic `: ping` ทุก 15s, clear บน close/end | `books.controller.ts` |

**Verified:** `npx nest build` EXIT 0 (production build สะอาด; spec files มี error เดิมที่ไม่เกี่ยว)

### 🔍 MIT Scrutiny → GitHub Issues (2026-06-04)

scrutinize ทั้ง server/orchestration layer ของ MIT แล้วเปิด 6 issues:

| Issue | Severity | สรุป |
|---|---|---|
| [#100](https://github.com/Slow-Inc/MangaDock/issues/100) | 🔴 critical | `send_webhook` ไม่ retry + กลืน error → Patch Set ที่คำนวณเสร็จหายถาวร (สาเหตุแท้จริงของ "0/20") |
| [#101](https://github.com/Slow-Inc/MangaDock/issues/101) | 🔴 critical | ยกเลิก batch ไม่ propagate ไป MIT (`DummyRequest.is_disconnected→False`) → zombie job เผา GPU |
| [#102](https://github.com/Slow-Inc/MangaDock/issues/102) | 🟠 security | path traversal + unauth บน `/result(s)/...` → read/delete นอก RESULT_ROOT |
| [#103](https://github.com/Slow-Inc/MangaDock/issues/103) | 🟠 security | worker รับ pickle ผ่าน HTTP + bind 0.0.0.0 → RCE risk; ต้อง bind 127.0.0.1 |
| [#104](https://github.com/Slow-Inc/MangaDock/issues/104) | 🟡 major | batch endpoints พัง (sent_batch arity + stub execute_batch) — dead/broken |
| [#105](https://github.com/Slow-Inc/MangaDock/issues/105) | 🟢 cleanup | dead code: duplicate imports, `String(e)` JS leftover, `start_instance=True` override, no-op if/else, dead `__del__`, `=='cancel'` |

**เฟส 3 — สแกน logic layer เพิ่ม (ข้ามไฟล์ model AI):**
- [#106](https://github.com/Slow-Inc/MangaDock/issues/106) 🟡 — event-loop blocking (`requests.get` ใน async), lock-across-await, streaming ไม่มี timeout
- [#107](https://github.com/Slow-Inc/MangaDock/issues/107) 🟡 **bug จริงใน gemini.py (default translator!)** — `server_error_attempt` UnboundLocalError ทำ retry path พังเมื่อ Gemini error + bare raise + `lstrip` prefix misuse + JSON sample IndexError
- `#105` comment — dead code เพิ่มใน translator dispatch (langid ทิ้ง, branch redundant, shared mutable cache)
- `translators/__init__.py dispatch`, `TranslatorChain`, `_run_text_translation` — ตรวจแล้ว ไม่มี critical (แค่ dead code)

**เฟส 4 — สแกน GPT shared layer + validation (ข้าม model AI):**
- [#108](https://github.com/Slow-Inc/MangaDock/issues/108) 🟡 — `config_gpt.py` few-shot sample cache (`langSamples`) ไม่ key ตามภาษา/ชนิด → แปลภาษาแรกค้าง sample กระทบ multi-lang gemini + common_gpt JSON-mode helpers พัง (text2json ขาด self, chat_sample int-index)
- [#109](https://github.com/Slow-Inc/MangaDock/issues/109) 🟡 — `_check_target_language_ratio` ใช้ langid reject ทั้งหน้า (เปราะกับ SFX/credits ที่ไม่แปล) + dead `min_ratio` param + threshold region ไม่ตรงกัน (5 vs 10)
- `#105` comment เพิ่ม — dead code: `OfflineTranslator._load` ประกาศซ้ำ, `reload` param ไม่ parse, dead `_json_sample` local
- `common.py CommonTranslator.translate`, `_validate_translation`/retry, `_check_repetition_hallucination` — ตรวจแล้ว logic ถูกต้อง

**เฟส 5 — rendering + orchestration glue:**
- [#110](https://github.com/Slow-Inc/MangaDock/issues/110) 🟡 — `render()` ใช้ `region.horizontal` (raw) ทำ box padding แต่วาดด้วย `render_horizontally` (forced) → เพี้ยนเมื่อ force direction (MangaDock ใช้ auto เลย dormant) + homography None ไม่ guard
- `_translate_until_translation` (detect→ocr glue ที่ patch path เรียก) — try/except + ignore_errors ทุก stage, early-return ปลอดภัย **ไม่มีบั๊ก**

**✅ สถานะ: ตรวจ MangaDock-relevant logic ครบ end-to-end แล้ว** — patch path traced ตั้งแต่ entry (server endpoints) → queue/executor → worker → translate_patches → detect/ocr glue → translator dispatch → gemini/qwen3 → GPT shared layer → post-translation validation → rendering → webhook → SSE

**Issues ทั้งหมด: #100-#110 (11 issues) + #105 (2 comments)**

**เฟส 6 — สแกน logic ที่เหลือทั้งหมด (ยกเว้น model AI):**
- [#111](https://github.com/Slow-Inc/MangaDock/issues/111) 🟡 — `textline_merge` prob normalize หารผิด denominator (`textlines` แทน `txtlns`) + `TextBlock` `texts[0]` default พัง + mutable default
- `#110` comment — `generic.py` `findHomography` ไม่ guard (อีก site)
- `#106` comment — `gemini_2stage.py` ใช้ sync OpenAI block event loop
- dispatch glue ทั้ง 6 (detection/ocr/inpainting/mask_refinement/upscaling/colorization) — สะอาด
- retry-pattern check: gemini.py เป็นไฟล์**เดียว**ที่ไม่ init `server_error_attempt` (chatgpt/deepseek/custom_openai/sakura init ถูกต้อง) → ยืนยัน #107

**วิธีครอบคลุม:**
- **Deep-read (ทีละบรรทัด):** server/ ทั้งหมด · MangaDock patch path ใน manga_translator.py · translators/__init__+common+common_gpt+config_gpt+gemini+qwen3+gemini_2stage · textblock+textline_merge · rendering · dispatch glue ทั้ง 6
- **Pattern-swept (grep crash-class: undefined-var-in-except, bare except, mutable default, lstrip-misuse, findHomography unguarded, sync-in-async):** ไฟล์ที่เหลือทั้งหมด รวม chatgpt/chatgpt_2stage/sakura/nllb/sugoi/m2m100/etc + mode/local+ws + utils ที่เหลือ → bug ทั้งหมด isolate อยู่ในไฟล์ที่ deep-read แล้ว
- **ไม่ได้ line-read แบบเต็ม (pattern-swept เท่านั้น):** body ของ translator ที่ MangaDock ไม่ใช้ (chatgpt_2stage, sakura, nllb ฯลฯ ~5,000 บรรทัด), CLI mode (local.py, ws.py), geometry helpers (generic.py ที่เหลือ, sort.py, inference.py)
- **ข้ามถาวร:** OCR/detection/inpainting/diffusion **model AI** (~7,500 บรรทัด)

**Issues ทั้งหมด: #100-#111 (12 issues) + comments บน #105(×2), #106, #110**

---

## ✅ #100 IMPLEMENTED — Webhook retry + dead-letter (2026-06-05, TDD)

**Design (grill-locked, user approved ทั้งหมด):** retry เฉพาะ transient (5xx/429/conn) ไม่ retry 4xx · 4 attempts (max_retries=3) · exp backoff 0.5→1→2s · timeout 20s/attempt · sequential await + cap · dead-letter = structured JSON log · env-configurable

**Approach:** แยก `send_webhook` → **`server/webhook.py`** (deps: httpx/json/hmac/hashlib เท่านั้น → test import 0.26s vs main.py 22s) เพื่อ testability/maintainability ระยะยาว

**ไฟล์ที่แก้:**
- `MIT/server/webhook.py` (ใหม่) — `send_webhook` + `_sign` + `_is_retryable_status` + `_dead_letter`
- `MIT/server/main.py` — import จาก webhook.py + ลบ def เดิม + ลบ orphan imports (hmac/hashlib/httpx ×2 — รวม duplicate ของ #105 ที่ change นี้ทำให้ orphan)
- `MIT/test/test_send_webhook.py` (ใหม่) — **10 tests, fake httpx, asyncio.run (ไม่ต้อง pytest-asyncio)**
- `MIT/.env.example` — section 5: `MIT_WEBHOOK_MAX_RETRIES`, `MIT_WEBHOOK_RETRY_BACKOFF_MS`

**Verify (ทุกขั้นผ่าน):** TDD RED→GREEN · `pytest test/test_send_webhook.py` = **10 passed 0.21s** · py_compile OK · main.py ยัง import ได้ (send_webhook re-exported)

**ติดตั้ง:** `pytest 9.0.3` ลงใน MIT `.venv` แล้ว

**Review notes:** dead-letter ปัจจุบันเป็น log อย่างเดียว (ไม่ persist/replay) — ตาม scope #100; การ persist เพื่อ reconciliation เป็นงานแยก (เกิน #100) · ยังไม่ commit (รอ user สั่ง)

## ✅ #107 IMPLEMENTED — GeminiTranslator error-handling (2026-06-05)

- **G1** `server_error_attempt = 0` ก่อน retry loop (ตกหายไป — chatgpt/deepseek/sakura มีอยู่แล้ว) → APIError ไม่ crash UnboundLocalError แต่ retry ตามตั้งใจ
- **G2** `raise` เปล่า → `raise ValueError(...)` (model misconfig ได้ error ชัด)
- **G3** `.lstrip('models/')` → `.removeprefix('models/')` (lstrip ตัด char ในเซ็ต — `models/embedding`→`bedding`)
- **G4** JSON-mode: ย้าย `loggerVals[...] = lang_JSON_samples[0]` เข้าใน `if` guard (กัน IndexError) + ลบ trailing-comma tuple
- **Verify:** py_compile OK · G3 demo (`bedding-001` vs `embedding-001`) · 25 unit tests ยังเขียว · **ไม่เขียน gemini unit test** (สร้าง translator ต้อง network = disproportionate ต่อ mechanical fix ที่ตรงกับ 3 sibling translators)

---

## ✅ #101 IMPLEMENTED — Batch cancellation propagation (2026-06-05, TDD, grilled)

Design grill-locked (ทุกข้อยึดหลักการ simplest+sustainable+perf):
- **MIT** `server/cancellation.py` — process-global `set()` registry (`mark_cancelled`/`is_cancelled`/`discard`)
- **MIT** `POST /cancel/{taskId}` endpoint → `mark_cancelled` (idempotent, no-op unknown)
- **MIT** `run_batch_with_callbacks` — double-check: ต้น loop (กันเริ่มหน้าใหม่) + ก่อน `send_webhook` (drop หน้าค้าง) + `discard(taskId)` ใน `finally` (ไม่ leak)
- **Backend** `removeBatchListener` — เมื่อ caller สุดท้ายออก → fire-and-forget `POST MIT /cancel/{jobKey}` ที่จุด abort เดิม (best-effort, swallow error)
- **Test:** `test/test_cancellation.py` — 6 tests · MIT unit suite รวม **25 passed** · Backend `nest build` EXIT 0
- commit + closed #101 · docs (ARCHITECTURE §6 + CONTRACT) อัปเดตให้ตรง

---

## ✅ #108 IMPLEMENTED — GPT sample selection (2026-06-05, TDD, Option C)

- **CG-1 (หลัก):** แทน `langcodes` fuzzy-match + per-instance cache (`langSamples`) ด้วย **direct lookup** (normalize code→name + case-insensitive) → ไม่มี cache = ไม่มี staleness ข้ามภาษา/chat-json, ไม่ต้องลง `language_data`, ลบ `self.logger` crash — ตามหลักการ "simplest + sustainable" (ลบความซับซ้อน ไม่ใช่ค้ำมันไว้)
- **พบระหว่างทาง:** sample matching **พังจริงในเครื่องนี้** (langcodes ต้องการ `language_data` ที่ไม่ได้ลง) → Gemini ได้ few-shot = ว่าง การ fix นี้แก้ทั้ง #108 + ปัญหานี้พร้อมกัน
- **CG-2:** fix JSON-mode helpers ใน `common_gpt.py` — `text2json` ขาด self, `chat_sample[0]` index dict ด้วย int → ใช้ `chatSample`, `min([])` guard (JSON mode off by default — ไม่ได้ unit-test แยก)
- **Test:** `test/test_gpt_samples.py` — 4 tests (no-staleness, code→name, unknown→[], chat/json ไม่ปน) · RED→GREEN · **ไม่ต้องลง dependency**
- รวม unit tests MIT ทั้งหมด: **19 passed** (webhook 10 + region 5 + samples 4)

---

## ✅ #111 IMPLEMENTED — Region utils (2026-06-05, TDD)

- **U-1** `textline_merge/__init__.py` — `region.prob` หารด้วยพื้นที่ของ region ตัวเอง (`txtlns`) ไม่ใช่ทั้งหน้า (`textlines`)
- **U-2** `utils/textblock.py` — `texts=None`/`[]` ไม่ crash (text="")
- **U-3** `utils/textblock.py` — `shadow_offset` ไม่ใช่ mutable default ที่แชร์กัน
- **Test:** `test/test_region_utils.py` — 5 tests (TextBlock construction + merge prob 2-region) · RED→GREEN ครบ
- commit + closed #111

---

## ✅ #109 IMPLEMENTED — Target-language check robustness (2026-06-05, TDD)

- **ปัญหา:** `_check_target_language_ratio` เดิมเอา translation ของทุก region มา merge แล้ว `langid.classify(merged)` ทั้งก้อน → SFX/credits ที่ตั้งใจไม่แปล ("SETSU SCANS") ทำให้ langid พลิกเป็นภาษาผิด → reject หน้าที่แปลถูกทั้งหน้า. `min_ratio` param ก็ dead (doc บอก "ไม่ใช้"). gate ภายใน `<=10` ขัดกับ caller page-level `>5` (หน้า 6–10 region log ว่า "starting check" แต่ฟังก์ชัน return True เงียบๆ)
- **Fix แบบ simplest+sustainable (North Star):** แทน langid-classify-merged (เปราะ) ด้วย **target-script char ratio** — นับสัดส่วนตัวอักษรที่อยู่ในสคริปต์ของภาษาเป้าหมาย แยกเป็น pure helper `utils/lang_ratio.py` (`target_script_ratio`) — ไม่มี ML import, unit-test เร็ว
  - ลบ internal `<=10` gate → ฟังก์ชันเป็น pure verdict, caller เป็นเจ้าของ policy ว่าจะเช็กเมื่อไร (page `>5`, batch `>10` — คนละ scope จงใจต่างกัน)
  - `min_ratio` กลับมาใช้จริง (`ratio >= min_ratio`)
  - langid ยังคง import (ใช้ที่อื่น line 786/1831) — ไม่แตะ
- **Test:** `test/test_lang_ratio.py` — 6 tests (Thai+SFX>0.8, untranslated-latin-when-THA<0.1, English-when-ENG>0.9, Japanese-when-ENG<0.1, empty/symbol==1.0, unknown→latin fallback) · RED→GREEN ครบ
- **Files:** `manga_translator/utils/lang_ratio.py` (new), `test/test_lang_ratio.py` (new), `manga_translator/manga_translator.py` (รื้อ body + import)
- commit + closed #109

---

## ✅ #102 IMPLEMENTED — Path traversal in result file endpoints (2026-06-05, TDD)

- `safe_result_folder(root, name)` ใน `server/path_utils.py` — reject `..`, `/`, `\`, empty, แล้ว verify `resolved.relative_to(root)` (ครอบ symlink attack)
- Wire ใน GET `/result/{folder}/final.png` + DELETE `/results/{folder}` → HTTP 400 สำหรับ invalid name
- `/results/clear` — disable by default via `MIT_ENABLE_RESULT_CLEAR=0` (unauthenticated+destructive, iterate RESULT_ROOT เองไม่ traversal แต่ต้อง opt-in)
- **Test:** `test/test_path_utils.py` — 7 tests, 0.04s, no ML
- commit `5d26ed8` + closed #102

---

## ✅ #103 IMPLEMENTED — Worker bind 0.0.0.0 RCE risk (2026-06-05, TDD)

- Extract `_build_worker_cmd(params, port, nonce)` จาก `start_translator_client_proc` — hardcode `--host 127.0.0.1` เสมอ (worker bind loopback เท่านั้น)
- ADR: `ARCHITECTURE.md` §2 + §9 อัปเดต — worker endpoints are loopback-trusted
- **Test:** `test/test_worker_bind.py` — 6 tests (loopback always, port/nonce propagated, gpu flags)
- commit `0d88711` + closed #103

---

## ✅ #104 + #105 IMPLEMENTED — Dead batch endpoints + dead code (2026-06-05)

- **#104 Decision: Remove** — production ใช้ `/translate/with-form/patches/batch` เท่านั้น. ลบ: `/translate/batch/json`, `/translate/batch/images`, `/simple_execute/translate_batch`, `/execute/translate_batch`, `BatchTranslateRequest`, `get_batch_ctx`, `BatchQueueElement`, `sent_batch`, `sent_batch_stream`
- **#105 Dead code:** collapse no-op if/else ใน `QueueElement.__init__`, remove dead `__del__` (image ไม่เคยเป็น str), remove `args.start_instance = True` override, remove `import os`
- ลบ 152 lines สุทธิ, 44 tests passing
- commit `af18459` + closed #104/#105

---

## ✅ #106 IMPLEMENTED — Async-correctness in queue/streaming (2026-06-05, TDD)

- `streaming.py` — `stream(messages, timeout=300)`: `asyncio.wait_for` + yield error frame on TimeoutError (ป้องกัน hang forever)
- `request_extraction.py` — `to_pil_image` URL path: `requests.get` (blocking) → `httpx.AsyncClient(timeout=30)` (async)
- `instance.py` — `find_executor` release lock ก่อน `event.wait()` (ป้องกัน serialise concurrent callers บน lock)
- **Test:** `test/test_async_correctness.py` — 7 tests (stream terminate, timeout, progress, httpx called, executor deadlock-safe)
- commit `1de61ff` + closed #106

---

## ✅ #110 IMPLEMENTED — Rendering direction mismatch + None homography (2026-06-05, TDD)

- **R-1** `rendering/__init__.py` line 333: `if region.horizontal:` → `if render_horizontally:` (ใช้ effective direction ไม่ใช่ raw detected — dormant ตอนนี้แต่จะพังเมื่อ forced direction ถูกใช้)
- **R-2** Guard `if M is None: logger.debug(...); return img` ก่อน `cv2.warpPerspective` (degenerate regions skip cleanly แทนที่จะ raise แล้วถูก swallow)
- **Test:** `test/test_rendering_guard.py` — 4 tests (collinear → None homography, valid → non-None, None guard, direction logic). No ML needed
- commit `93c31e6` + closed #110

---

**MIT unit suite สุดท้าย (2026-06-05): 49 tests passing** (เพิ่มจาก 25 ตอนเริ่ม session)

**ทุก issue #100–#111 ปิดหมดแล้ว**

---

### 📘 MIT documentation (blueprint สำหรับ team + agent) — 2026-06-05
- `MIT/ARCHITECTURE.md` — พิมพ์เขียว 12 sections (2-process model, directory map, patch path, translator subsystem, webhook, known issues #100–111). frame model folders เป็น black box หลัง `dispatch()` (codebase ใหญ่เพราะ model upstream — ไม่ต้อง doc ต่อโมดูล)
- `MIT/SETUP.md` — runbook: install/run/test + troubleshoot จริง (forrtl 200, model load 150s, CUDA OOM, port, webhook unreachable)
- `MIT/CONTRACT.md` — wire format MIT↔Backend; เด่นที่ **casing footgun** (single=snake_case `img_width` vs batch/webhook=camelCase `imgWidth`) + HMAC raw-bytes hazard (#95 S1) + size limits — กันบั๊กคลาส contract-drift
- **ตั้งใจไม่ทำ:** ADR log เต็ม, per-module model docs, Swagger (FastAPI มี `/docs` อยู่แล้ว) — กัน doc bloat

---

**เฟส 2 — สแกนส่วนที่เหลือ** (`mode/share.py`, `streaming.py`, `qwen3.py`, patch helpers, `config.py`):
- `translate_patches` + patch helpers (union-find grouping, mask crop/scale) — สะอาด ไม่มีบั๊ก
- `qwen3.py` (โค้ดใหม่ commit e1979cd) — แข็งแรง; default `Qwen/Qwen3.5-4B` ตรงกับ `.env.example`; ยืนยันทำงานจาก MIT log จริง
- **ข้อสังเกตเล็กน้อย (ยังไม่ filed):** `streaming.py stream()` รอ `messages.get()` ไม่มี timeout — ถ้า worker ไม่ส่ง terminal frame (code 0/2) SSE generator ค้าง (กระทบเฉพาะ streaming path ไม่ใช่ webhook path)
- **ขอบเขต:** ไม่ได้ line-audit deep ML pipeline (detection/OCR/inpaint/render/diffusion models) — เป็นโค้ด upstream และไม่ใช่จุดที่ reliability bug ของฟีเจอร์นี้อยู่

**ทดสอบ end-to-end:** ยังไม่ได้รัน — ต้อง **restart MIT** (run-server.bat) แล้วลองแปลทุกหน้าใหม่ Backend hot-reload เอง

**Review notes (ทิ้งไว้ตั้งใจ ไม่แก้ในรอบนี้):**
- **#95 S1**: HMAC ยังคำนวณบน `JSON.stringify(body)` (parsed) ไม่ใช่ raw request bytes — MIT คำนวณบน `json.dumps(separators=(',',':'))` → ถ้าเปิด secret จะ mismatch ต้องเก็บ raw body buffer (เช่น `rawBody` express verify)
- **Latent**: ใน `handleMitCallback` ถ้า throw หลัง `processingPages.add(pageIndex)` (เช่น storage fail) page จะ lock ถาวร retry ไม่ได้ — ควรห่อ try/finally เพื่อ delete จาก processingPages เมื่อ error

---

## 🔖 Pending Issues (GitHub MCP no access — publish manually when token updated)

| # | Title | Priority |
|---|---|---|
| #89 | fix(books): notify() ต้อง publish ไป Redis ใน NDJSON sync path | ✅ done |
| #90 | fix(webhook): security hardening — raw HMAC, enforce secret, img_b64 bound | ✅ done (S2+S3; S1 raw HMAC pending) |
| #91 | fix(misc): listener tracking, observability, fetch short-circuit | ✅ done |
| #92 | PRD: Qwen3 offline translator (see below) | 📋 PRD ready |

---

## 📋 PRD #92 — Qwen3 Offline Translator (2026-06-04)

### Problem Statement

ผู้ใช้ที่มี GPU (RTX 4070 Super 12GB) ต้องการรัน manga translation แบบ offline ไม่พึ่ง Gemini API แต่ MIT hardcode translator เป็น `gemini` และไม่มี Qwen3 translator class Qwen3 ยังมี thinking mode ที่ต้องปิดก่อนใช้งาน

### Solution

1. `MIT` — Qwen3Translator class ใหม่ที่ปิด thinking mode + config ผ่าน env vars
2. `MIT config.py` — เพิ่ม `qwen3`, `qwen3_big` ใน Translator enum + OFFLINE_TRANSLATORS
3. `Backend` — อ่าน `MIT_TRANSLATOR` env var แทน hardcode `gemini`

### Env Vars (MIT)

| Var | Default | Description |
|---|---|---|
| `QWEN3_MODEL` | `Qwen/Qwen3-4B-Instruct` | HuggingFace model ID |
| `QWEN3_4BIT` | `false` | INT4 quantization |
| `QWEN3_TORCH_DTYPE` | `auto` | auto/bfloat16/float16 |
| `QWEN3_MAX_NEW_TOKENS` | `4096` | Max output tokens |
| `QWEN3_BIG_MODEL` | `Qwen/Qwen3-8B-Instruct` | Model for qwen3_big key |
| `QWEN3_BIG_4BIT` | `false` | INT4 for big model |

**Backend:**
```
MIT_TRANSLATOR=gemini   # gemini | qwen3 | qwen3_big | nllb | sugoi
```

### Key Implementation Notes

- `apply_chat_template(..., enable_thinking=False)` — requires transformers >= 4.51.0; strip `<think>.*</think>` as fallback
- Qwen3-4B BF16 = ~8GB VRAM → fit ใน 12GB, ~4GB เหลือสำหรับ KV cache
- Cold start บน SN850X NVMe (~7GB/s): ~1 วินาที หลัง download ครั้งแรก

### Testing

- MIT (Python unittest): thinking tag stripping, env var reading, response parsing
- Backend (Jest): `MIT_TRANSLATOR` env → correct translator field ใน MIT config JSON; default = `gemini`
- Prior art: `books-pubsub-batch.spec.ts` สำหรับ mock `_runMitBatch`

### Out of Scope

- Frontend translator selector UI
- Qwen3 MoE 235B
- Automatic VRAM detection/quantization selection
| #91 | fix(misc): listener tracking log, observability, fetch short-circuit | 🟡 medium |

---

## Files Modified

### Frontend
- `app/lib/communityApi.ts` — Always append `limit` param (removed `!== 20` condition)
- `app/lib/apiCache.ts` — `cacheClearByTag`: collect keys before iterating (Map mutation bug fix)
- `app/components/VoteButtons.tsx` — Added resync `useEffect` on `targetId` change; moved auth check before loading guard
- `app/hooks/useForumStream.ts` — Changed SSE URLs to `/api/proxy/` prefix; added non-empty catch blocks with console.warn; fixed `esRef.current = null` in `useFeedStream` cleanup
- `app/community/page.tsx` — Added `if (!user) { showLoginPrompt(); return; }` to `handleCreatePost`; fixed SVG paths `l18 18` → `L18 18`
- `app/community/p/[id]/page.tsx` — XSS sanitization for imageUrls (`/^https?:\/\//` guard); added `mountedRef` to prevent setState after unmount in handlePostComment; removed redundant `fetchData(true)` after optimistic comment add

### Backend
- `src/auth/auth.guard.ts` — Removed duplicate `OptionalAuthGuard` class
- `src/auth/optional-auth.guard.ts` — Now the single source of truth for `OptionalAuthGuard`
- `src/forum/forum.controller.ts` — Updated import to use `optional-auth.guard`; added `Math.min(100, ...)` limit cap; fixed `getTrendingManga` parseInt; added `fs.unlink` temp file cleanup in both upload handlers; added `import * as fs`
- `src/forum/forum.service.ts` — Added `file-type` magic-byte validation for uploads (replaces client-header check); `listComments` `.limit(500)` cap; `createComment` parent check adds `.is('deleted_at', null)`; replaced all `throw new Error()` with `InternalServerErrorException`; fixed `String(err)` for unknown error types; `recalculateVotes` now uses `recalculate_votes_atomic` RPC
- `src/forum/forum-events.service.ts` — Wrapped `redis.publish` in try/catch; guarded `next()` with `!postSubject.closed`
- `src/wallet/wallet.service.ts` — Replaced `addCoins`/`spendCoins` with atomic Supabase RPC calls; removed TOCTOU `getOrCreateWallet` (upsert now handled inside RPC); all `throw new Error()` → `InternalServerErrorException`
- `src/wallet/wallet.controller.ts` — Added DEV ONLY comment to `/wallet/topup` endpoint
- `src/unlock/unlock.service.ts` — Restructured `purchaseUnlock` to insert unlock record BEFORE `processRevenueSplit`; rolls back unlock on payment failure
- `supabase-migration.sql` — Added Section 8: `add_coins_atomic`, `spend_coins_atomic`, `recalculate_votes_atomic` RPC functions

### Spec Files (fixed to compile)
- `src/forum/forum.controller.spec.ts` — Updated `OptionalAuthGuard` import to `optional-auth.guard`
- `src/forum/forum.service.spec.ts` — Added 3rd constructor arg + `rpc` mock to `makeService`
- `src/wallet/wallet.service.spec.ts` — Rewrote to test new RPC-based `addCoins`/`spendCoins`; removed `getOrCreateWallet` tests

### DB (Supabase MCP applied live)
- `atomic_wallet_and_vote_rpcs` migration — `add_coins_atomic`, `spend_coins_atomic`, `recalculate_votes_atomic` created
- `update_wallet_rpcs_with_balance_after` migration — Updated RPCs to include `balance_after` and `reference_id` in transaction insert

---

## ✅ Cloudflare Worker + R2 Integration — Phase A+B+C-B (2026-06-09)

Branch: `feat/context-aware-translation`

### Phase A — Worker deploy + secrets
- `Cloudflare-Worker/wrangler.toml` — fix `bucket_name = "mangadock-assets"`, `name = "mangadock-worker"`
- Worker deployed ที่ `https://mangadock-worker.akkanop2549.workers.dev`
- Secrets set: `BACKEND_SHARED_SECRET`, `MIT_PROCESS_URL`, `IMAGE_QUALITY_PROFILE`
- Endpoints verified: `/health`, `/v1/exists`, `/v1/object` (GET/PUT/DELETE), `/v1/translate`

### Phase B — CloudflareR2StorageProvider + /v1/list
- `Cloudflare-Worker/src/index.ts` — เพิ่ม `handleList()` + route `GET /v1/list` (prefix/recursive, delimiter="/" สำหรับ readdir semantics)
- `Backend/src/common/env.validation.ts` — เพิ่ม `WORKER_URL`, `WORKER_SECRET` (optional)
- `Backend/src/common/storage/cloudflare-r2.provider.ts` (ใหม่) — `CloudflareR2StorageProvider` implements `StorageProvider` (put/get/delete/deleteDir/exists/list → Worker API)
- `Backend/src/common/storage/storage.module.ts` — factory switch: `WORKER_URL`+`WORKER_SECRET` set → R2 provider, otherwise disk
- **key insight:** `DiskStorageProvider.list()` = `readdir` (basenames, 1 level) → Worker `handleList` ใช้ `delimiter="/"` เพื่อ mirror semantics เดียวกัน

### Phase C-B — Worker translate-patches + Backend routing (#184 — closed)
- `Cloudflare-Worker/src/index.ts` — เพิ่ม `MIT_PATCH_URL` ใน Env, `base64ToArrayBuffer()`, `handleTranslatePatches()` (R2 cache check → MIT → store PNGs + metadata JSON → return patches), route `POST /v1/translate-patches`
- `Cloudflare-Worker/.dev.vars.example` — เพิ่ม `MIT_PATCH_URL`
- `Backend/src/books/patches.controller.ts` (ใหม่) — `GET /r2-patches/*` → `storage.get(r2Key)` → stream PNG (เหตุผลที่ไม่ใช้ `/uploads/patches/`: `express.static` register ก่อน NestJS routes → controller ไม่ได้รับ request)
- `Backend/src/books/books.module.ts` — register `PatchesController`
- `Backend/src/books/books.service.ts` `translateMangaPagePatches()` — Worker branch: ถ้า `WORKER_URL`+`WORKER_SECRET` set → POST `/v1/translate-patches` → map `r2Key` → URL `{backendOrigin}/r2-patches/{r2Key}` → Redis cache; fallback = MIT direct (disk mode)
- tsc EXIT 0 (Worker + Backend)

**ยังไม่ทำ:** unit test Worker handler + integration test Backend→Worker path (track แยก)

**Deploy checklist:**
```
cd Cloudflare-Worker && npx wrangler deploy
npx wrangler secret put MIT_PATCH_URL   # http://26.17.141.205:5003/translate/with-form/patches
# Backend .env: WORKER_URL + WORKER_SECRET
```

### Package
- `file-type` installed in Backend (`npm install file-type`)

### Verified & Hardened (Pre-Phase 2 Audit)
- **Soft Deletion:** Verified `deleted_at` implementation in `forum.service.ts` across 9 points (Update & Filter).
- **Spoiler Blur:** Verified `spoiler` category integration in `PostCard`, `PostDetail`, and `Community` page with blur filters and click-to-reveal logic.

## What Was NOT Changed
- Pre-existing spec errors in `hardware-id.middleware.spec.ts`, `unlock.controller.spec.ts`, `wallet.controller.spec.ts` (INestApplication import) — out of scope
- Storage-before-DB order in uploadBanner/uploadImage — was already correct

## Review Notes
- `file-type` magic-byte validation: verify CJS interop on deployed Node version
- `recalculate_votes_atomic` RPC: confirm `data[0]?.upvotes` always populated after UPDATE
- `unlock.service.ts` rollback: best-effort delete — consider logging if rollback also fails

---

## ✅ Phase 1.5 Completion Verification (2026-05-27)

### Phase 1.5 Status: COMPLETE

#### Community Forum (PR #9 — merged 2026-05-27)
- `Frontend/app/community/layout.tsx` — Shared layout + mobile drawer
- `Frontend/app/community/trending/page.tsx` — Trending manga grid
- `Frontend/app/community/manga/[mangaId]/page.tsx` — Manga community feed
- `Frontend/app/community/profile/[uid]/page.tsx` — User profile page
- `Frontend/app/components/ForumSideMenu.tsx` — Sidebar navigation
- `Frontend/app/components/PostCard.tsx` — Reddit compact view + spoiler transitions
- `Frontend/app/components/SmoothScrolling.tsx` — Scroll reset on pathname change
- `Frontend/app/community/page.tsx` — Bottom sheet modal animation
- `Frontend/app/community/p/[id]/page.tsx` — Sticky header, spoiler fade, XSS fix
- `Frontend/app/lib/communityApi.ts` — Round position before send
- `Backend/src/forum/forum.dto.ts` — @IsNumber replaces @IsInt

#### Task A — Creator Earnings API + UI (pre-existing, verified complete)
- `Backend/src/wallet/wallet.service.ts` — `getCreatorEarnings(uid)` queries `translator_earnings` VIEW; returns zero values when no row exists
- `Backend/src/wallet/wallet.controller.ts` — `GET /wallet/earnings` with AuthGuard
- `Frontend/app/lib/studioApi.ts` — `CreatorEarnings` type + `getCreatorEarnings(token)`
- `Frontend/app/studio/wallet/page.tsx` — Earnings section visible only for translator/creator roles

#### Task B — HWID Middleware Enforcement (pre-existing, verified active enforcer)
- `Backend/src/common/middleware/hardware-id.middleware.ts` — Active enforcer: rejects 401 `{ statusCode: 401, message: 'Missing hardware ID' }` for protected routes; warns at logger level; whitelist covers auth/forum/wallet/public browse

### What Was NOT Changed (Phase 1.5 close-out)
- `supabase-migration.sql` — translator_earnings VIEW already existed, no migration needed
- Any file in `Documents/`, `unlock.service.ts`, `books/*`

### Notes
- Phase 1.5 is fully closed — all 4 pillars (Forum, HWID, Earnings, Zero-Trust) verified in codebase
- Ready to begin Phase 2 planning (Architectural Scaling & Cloud Readiness)

---

## ✅ Phase 2 — 2-Layer Cache Upgrade (Branch: feat/2-layer-cache-upgrade, Commit: ad72574)

### Phase 2 Cache Status: IMPLEMENTED — Pending PR

#### New Files
- `Backend/src/status/metrics.service.ts` — Node heartbeat: CPU sampling (500ms), freeMem, Supabase HEAD ping, publishes `cluster_metrics:{nodeId}` ทุก 10s (ยิงทันทีตอน startup ด้วย)
- `Backend/src/status/election.service.ts` — Redis NX Lock election: `SET cache:leader NX PX` สำหรับ acquisition, `SET XX PX` สำหรับ renewal ทุก 15s, LEADER_TTL = 37.5s (2.5× interval)
- `Backend/src/cache/batch-sync.worker.ts` — Reliable Queue: `RPOPLPUSH cache:dirty cache:processing` → sync → `LREM` ack; crash recovery ด้วย `LRANGE cache:processing` บน onModuleInit; leader-only guard ใน flush()
- `Backend/src/status/metrics.service.spec.ts` — 2 tests: startup publish, interval tick
- `Backend/src/status/election.service.spec.ts` — 7 tests: NX acquisition, contention, renewal, failover, logging
- `Backend/src/cache/batch-sync.worker.spec.ts` — 8 tests: rpoplpush, lrem ack, crash recovery, markDirty, corrupt data

#### Modified Files
- `Backend/src/cache/cache-orchestrator.service.ts` — write-behind set(): Redis write + markDirty; ลบ DEFAULT_TTL_SEC (dead code); ลบ markDirty จาก setMangaCacheWithTiers
- `Backend/src/cache/cache.module.ts` — import StatusModule, register BatchSyncWorker
- `Backend/src/status/status.module.ts` — register + export MetricsService, ElectionService

#### Key Architecture Decisions
- **Leader Election:** Redis NX Mutex แทน metric scoring — ป้องกัน split-brain และ leader thrashing
- **Reliable Queue:** RPOPLPUSH+LREM แทน LPOP — ป้องกัน data loss เมื่อ leader crash กลางคัน
- **MetricsService:** เก็บ CPU/mem/latency เพื่อ observability เท่านั้น ไม่ใช้ตัดสิน leadership
- **METRICS_STALE_MS:** 35,000ms (เพิ่ม 5s buffer จาก Redis TTL 30s)

#### What Was NOT Changed
- `books/*`, `forum/*`, `unlock.service.ts`, `wallet/*` — out of scope
- BullMQ / Supabase Edge Function — over-engineering สำหรับ stage นี้
- Pub/Sub cross-node L1 sync — scaffolding สำหรับ Phase 3

#### Bugs Found by TDD
- `flush()` เช็ค `isLeader` แค่ใน interval callback — แก้: ย้าย guard เข้าใน flush() เอง
- `onModuleInit()` ของ BatchSyncWorker ต้องเป็น `async` เพื่อให้ crash recovery เสร็จก่อน interval เริ่ม

#### Test Count: 134 passing (เพิ่มจาก 117 → 134)

#### Notes
- Phase 2 Cache branch พร้อม review ก่อน merge — รอ PR
- `cache:processing` list ควร empty ตลอดในสภาวะปกติ; non-empty หลัง flush cycle = WARN signal
- Dirty queue consumer (syncKey → JsonCache) ยังเป็น scaffolding; Supabase RPC handlers จะเพิ่มทีละ feature ใน Phase 2 ถัดไป

---

## ✅ Phase 2b — Issue #13: L3DiskService Extraction (TDD, Branch: feat/2-layer-cache-upgrade)

### Status: COMPLETE — 147 tests passing

#### New Files
- `Backend/src/cache/l3-disk.service.ts` — Deep module สำหรับ disk I/O ทั้งหมด: `write(key, entry)` (sanitize filename + embed original key) + `readAll(): Map` (skip corrupt, swallow errors); รับ cacheDir ผ่าน `@Optional() @Inject('L3_CACHE_DIR')` เพื่อ testability
- `Backend/src/cache/l3-disk.service.spec.ts` — 5 tests: empty dir, round-trip, key sanitization, corrupt JSON skip, disk error swallow
- `Backend/src/cache/json-cache.service.spec.ts` — 3 tests: `set()` ไม่เขียน disk, `syncEntry()` ไม่เขียน disk, `onModuleInit()` warm L1 จาก L3

#### Modified Files
- `Backend/src/cache/json-cache.service.ts` — **แก้ bug หลัก**: ลบ `writeToDisk()` ออก + `set()` / `syncEntry()` เป็น in-memory เท่านั้น + `onModuleInit()` ใช้ `l3.readAll()` แทน direct `fs.readdirSync`; constructor รับ `L3DiskService` ผ่าน DI
- `Backend/src/cache/cache.module.ts` — เพิ่ม `L3DiskService` เป็น provider (ก่อน `JsonCacheService` เพราะ DI dependency)

#### Key Fix (from grill session 2026-05-28)
**Bug:** `JsonCacheService.set()` เรียก `writeToDisk()` ทุก L1 update — disk I/O overflow เพราะ L1 update บ่อยมาก
**Fix:** L3 (disk) เขียนโดย `L3DiskService.write()` เท่านั้น ซึ่งจะถูกเรียกโดย `L3BatchWriter` (Issue #14) ตาม Flush Frequency ต่อ data type — ไม่เคยเขียนใน `set()` path

#### Test Count: 147 passing (เพิ่มจาก 139 → 147)

#### What Was NOT Changed
- `CacheOrchestratorService` — interface `set()`/`syncEntry()` เหมือนเดิม
- `BatchSyncWorker` — `syncEntry()` ยังทำงานปกติ (ตอนนี้ update L1 in-memory เท่านั้น — correct)
- `batch-sync.worker.spec.ts` — mock `JsonCacheService` ไม่ได้รับผลกระทบ

---

## ✅ Phase 2b — Issues #14+#15: L3BatchWriter + Leader flush wire (TDD)

### Status: COMPLETE — 155 tests passing

#### New Files
- `Backend/src/cache/l3-batch-writer.ts` — periodic L2→L3 batch บนทุก node; FLUSH_CONFIG: wallet: 2s, stats: 5s, default: 60s; fires immediate flush on startup; skips L2-missing keys; skips when Redis unavailable
- `Backend/src/cache/l3-batch-writer.spec.ts` — 6 tests: startup flush, L2 miss skip, wallet 2s interval, manga only at 60s, destroy stops intervals, Redis unavailable

#### Modified Files (#15)
- `Backend/src/cache/batch-sync.worker.ts` — `syncKey()` ตอนนี้เรียก `l3.write(key, entry)` แทน `jsonCache.syncEntry()`; inject `L3DiskService` แทน `JsonCacheService`
- `Backend/src/cache/batch-sync.worker.spec.ts` — อัปเดต mock ใช้ `L3DiskService`; assertions เปลี่ยนจาก `jsonCache.syncEntry` เป็น `l3.write`
- `Backend/src/cache/cache.module.ts` — เพิ่ม `L3BatchWriter` provider

#### Final Write-behind Architecture
```
set(key)  →  L1 in-memory  →  L2 Redis  →  markDirty

L3BatchWriter (all nodes):   L2 → L3  (per Flush Frequency per type)
BatchSyncWorker (Leader):    L2 → L3  (re-sync before future Supabase write)
```

#### Design Note (per grill)
- `L3DiskService.write()` swallows disk errors — L3 = best-effort backup
- Ack (lrem) always happens after write attempt; JSON parse fail = no ack (retry)
- `L3BatchWriter` re-attempts on next cycle ถ้า disk ชั่วคราว unavailable

#### Test Count: 155 passing (เพิ่มจาก 147 → 155)

---

## ✅ Phase 2c — Issues #18–#21: Dirty Queue Bug Fixes (TDD, Branch: feat/2-layer-cache-upgrade)

### Status: COMPLETE — 161 tests passing (Commits: bba4a76, 6154a2d)

#### Context
PR #16 scrutiny (Issues #17 PRD) found 3 major bugs + 1 minor in the dirty-queue path. Broken into 4 issues (#18–#21) and fixed via TDD.

#### Fixes

**Issue #18 — Processing queue leak (bba4a76)**
- `recoverOrphans()` previously called `lrange` → `del` → individual `rpush` per key
- Missing: `del` was never called → orphans piled up in `cache:processing` across restarts
- Fix: Added `del(PROCESSING_QUEUE)` before `rpush` loop
- Tests: "clears cache:processing with DEL before re-queuing"; "does not call DEL when empty"

**Issue #19 — Expired key orphan (bba4a76)**
- `syncKey()` silently skipped when L2 key expired (`if (!raw) return;`)
- Expired key stayed in `cache:processing` forever → permanent orphan after crash
- Fix: `await client.lrem(PROCESSING_QUEUE, 1, key)` before early return
- Tests: "calls lrem to ack even when key is expired in L2 — prevents permanent orphan"

**Issue #20 — Shutdown durability (bba4a76)**
- `onApplicationShutdown()` was syncing L1↔L2 timestamps — useless (in-memory data lost on exit)
- Fix: replaced with `l3BatchWriter.flush()` — actually persists to disk before exit
- `CacheOrchestratorService` now takes `L3BatchWriter` as 4th constructor param
- `setMangaCacheWithTiers()` now calls `markDirty()` (was missing from write-behind path)
- New spec: `cache-orchestrator.service.spec.ts` (4 tests)
- Tests: "calls l3BatchWriter.flush() on graceful shutdown"; "does not call jsonCache.syncEntry() on shutdown"

**Issue #21 — Non-atomic crash recovery (6154a2d)**
- DEL → RPUSH sequence has a crash window where keys can be silently dropped
- Fix: single `RECOVER_SCRIPT` Lua EVAL — LRANGE + DEL + RPUSH atomically in one round-trip
- Follows RENEW_SCRIPT / DELETE_SCRIPT pattern from ElectionService
- Logs count only (not per-key) since keys not iterable client-side after Lua exec
- Tests: "uses EVAL to atomically move orphans"; "does not call DEL or RPUSH directly during recovery"

#### Architecture Decisions
- **Lua CAS pattern** for all atomic multi-step Redis operations: RENEW_SCRIPT (election renewal), DELETE_SCRIPT (lock release), RECOVER_SCRIPT (crash recovery)
- **R2 for translated manga images**, Supabase for structured metadata → `setMangaCacheWithTiers()` now participates in write-behind (markDirty)
- **L3BatchWriter.flush()** is the correct shutdown hook — L1 sync was a false guarantee

#### Test Count: 161 passing (เพิ่มจาก 155 → 161, -1 test cleanup)

#### Notes
- All 4 issues (#18–#21) closed; PR #16 branch (`feat/2-layer-cache-upgrade`) ready for final review and merge
- `RECOVER_SCRIPT` Lua script named constant lives in `batch-sync.worker.ts` alongside the queues it uses
- `cache-orchestrator.service.spec.ts` is a new file added alongside the orchestrator source

---

## ✅ Phase 2.4–2.5 — Cache Hardening (2026-05-29, PRs #60 / #61 closed)

### Status: COMPLETE — 277 tests passing

---

### Phase 2.4 — CatastrophicRecoveryService (#38)

#### New Files
- `Backend/src/cache/catastrophic-recovery.service.ts` — `OnModuleInit`: เมื่อ Redis ไม่ขึ้นตอน boot → อ่าน L3 → เปรียบเทียบ timestamp ต่อ key กับ Supabase (batch 100) → buffer winners → register reconnect callback (fire-once); `pushToL2()`: jitter 0–5s + pipeline chunk 500
- `Backend/src/cache/catastrophic-recovery.service.spec.ts` — 18 tests: T1-T10 (core + fire-once), S1-S5 (Supabase comparison), D1-D3 (smart dirty queuing)

#### Modified Files
- `Backend/src/cache/batch-sync.worker.ts` — `syncKey()` RPC params เปลี่ยนจาก `{ p_key, p_entry }` → `{ p_key, p_data, p_updated_at, p_ttl_ms }` (conditional upsert)
- `Backend/src/cache/batch-sync.worker.spec.ts` — เพิ่ม U1-U2: verify correct RPC param shape; `p_entry` absent
- `Backend/src/cache/cache.module.ts` — register `CatastrophicRecoveryService`

#### Key Architecture Decisions
- **Smart Dirty Queuing:** `source: 'l3' | 'supabase'` tracking — skip RPUSH เมื่อ Supabase wins (data อยู่ DB แล้ว) → เฉพาะ L3 winners เท่านั้นที่ต้อง re-sync
- **Fire-once callback:** `onReconnect()` return `unregister fn` → เรียกหลัง push สำเร็จครั้งแรก → ป้องกัน stale L3 data ทับ L2 บน reconnect ครั้งที่ 2+
- **Thundering herd:** jitter `Math.random() * 5000ms` ก่อน pipeline push
- **Supabase fallback:** ถ้า Supabase unavailable → ใช้ L3-only winners (log WARN)

#### Scrutinize Finding Fixed (post-PR)
- **Blocker:** `onReconnect` callback ไม่ unregister → push stale boot-time L3 data ทับค่าใหม่กว่าใน L2 บน reconnect ครั้งที่ 2
- **Fix (commit bcfd68d):** `const unregister = this.redis.onReconnect(() => this.pushToL2(winners).then(() => unregister()).catch(...))`
- **T10 test:** verify `unregister()` ถูก call exactly once หลัง push สำเร็จ

---

### Phase 2.4+ Round 1 — BatchSyncWorker Retry Budget + Dead-letter (#64–#66)

#### Modified Files
- `Backend/src/cache/batch-sync.worker.ts`
  - Export: `MAX_RETRIES = 5`, `RETRY_COUNTS_KEY = 'cache:retry_counts'`, `DEAD_LETTER_SET = 'cache:dead_letter'`
  - On RPC fail: `HINCRBY cache:retry_counts <key> 1`; if count >= MAX_RETRIES → `SADD cache:dead_letter <key>` + `LREM` + `logger.error`
  - On RPC success: `HDEL cache:retry_counts <key>` ก่อน `LREM`
  - On L2 expiry: `HDEL cache:retry_counts <key>` ป้องกัน stale counter สะสม
- `Backend/src/cache/batch-sync.worker.spec.ts` — เพิ่ม 6 tests R1-R6

#### Key Architecture Decision
- Keys ที่ fail Supabase ซ้ำๆ วนลูป dirty→processing→dirty ไม่มีที่สิ้นสุด → ระบบ retry budget + dead-letter set ป้องกัน single bad key กิน flush budget ทั้งหมด
- Dead-lettered keys inspectable ด้วย `SMEMBERS cache:dead_letter`; re-queue ด้วย `SMOVE cache:dead_letter cache:dirty <key>`

---

### Phase 2.4+ Round 2 — mangaId Propagation in Stats Pipeline

#### Modified Files
- `Frontend/app/components/MangaReader.tsx` — สร้าง URL ด้วย `URLSearchParams` รวม `?mangaId=` param เมื่อ prop มีค่า

#### Context
- `StatsIncrementService.recordChapterView()` ตั้ง `stats:chapter:{id}:manga:{date}` key ถูกต้องอยู่แล้ว
- `BooksController.getMangaChapterPages()` รับ `@Query('mangaId')` อยู่แล้ว
- ปัญหา: `MangaReader.tsx` ไม่ส่ง `?mangaId=` ทำให้ `manga_id` ใน `chapter_daily_stats` เป็น `''` เสมอ
- ทุก component caller (`BookDetailModal`, `ContinueReadingRow`, `MangaGrid`, `BookRow`) ส่ง `mangaId={book.id}` ครบแล้ว

---

### Phase 2.4+ Round 3 — Timer Hygiene + Cache Health Endpoint (#67–#69)

#### New Files
- `Backend/src/cache/cache-health.service.ts` — `getHealth(): Promise<CacheHealthSnapshot>`: LLEN dirty/processing, SCARD dead_letter, L3 keyCount, isLeader; คืน 0 ทุกตัวเมื่อ Redis unavailable
- `Backend/src/cache/cache-health.service.spec.ts` — 6 tests H1-H6

#### Modified Files
- `Backend/src/cache/batch-sync.worker.ts` — `.unref()` บน `setInterval` timer
- `Backend/src/cache/stats-flush.worker.ts` — `.unref()` บน `setInterval` timer
- `Backend/src/cache/redis.service.ts` — เพิ่ม `llen(key)` + `scard(key)` methods
- `Backend/src/cache/l3-disk.service.ts` — เพิ่ม `keyCount()` → count `.json` files ไม่ parse JSON
- `Backend/src/cache/cache.module.ts` — register + export `CacheHealthService`
- `Backend/src/status/status.controller.ts` — `GET /status/cache` → `CacheHealthService.getHealth()`

#### Key Architecture Decisions
- **Timer `.unref()`:** ป้องกัน Jest process leak warning; production ไม่มีผลกระทบ
- **`GET /status/cache`:** เปิดเหมือน `/status/stream` (ไม่มี auth guard) — ข้อมูลไม่ sensitive
- **`CacheHealthService`:** deep module — dependency inject ได้, mock ได้ง่าย, interface ไม่เปลี่ยน

---

### Test Count: 277 passing (เพิ่มจาก 265 → 277)

| Batch | Tests Added |
|-------|------------|
| T1-T10 (CatastrophicRecovery core + fire-once) | +10 |
| S1-S5 (Supabase comparison) | +5 |
| D1-D3 (smart dirty queuing) | +3 |
| U1-U2 (RPC param shape) | +2 |
| R1-R6 (retry budget + dead-letter) | +6 |
| H1-H6 (cache health service) | +6 |

### Notes
- PR #60 (feat/cache-phase-2-4) ปิดแล้ว — งานทั้งหมดรวมอยู่ใน PR ใหม่
- `cache:dead_letter` Redis Set ควร empty เสมอในสภาวะปกติ; non-empty = signal ว่ามี key ที่ต้องตรวจสอบ Supabase schema/constraint
- `GET /status/cache` endpoint: operator ใช้ตรวจสอบ queue depths; ไม่มี auth เหมือน `/status/stream`
- `L3DiskService.keyCount()` นับแค่ไฟล์ ไม่ parse JSON — ถูกใช้เฉพาะ health snapshot, ไม่กระทบ critical path
- `mangaId` ใน `chapter_daily_stats` จะมีค่าถูกต้องตั้งแต่ session นี้เป็นต้นไป; ข้อมูล historical ที่มี `''` ยังอยู่ใน DB แต่ไม่กระทบ future data

---

## ✅ Translation System Overhaul (2026-06-04, Session: multi-perspective review)

### Status: COMPLETE (backend) — Batch refactor (Option A') pending

#### Bugs Fixed & Tested (issues #73–#78, all closed)
- **#73** `startOrAttachBatchJob`: `.finally()` deleted job before webhooks arrived → replaced with `try/finally` + 15-min timeout + abort-signal listener
- **#74** `handleMitCallback`: raw pixel coords stored as percentages → normalized with `imgWidth/imgHeight`; patch URL uses `backendOrigin`
- **#75** HMAC mismatch (Python spaces vs JS compact) → `json.dumps(separators=(',',':'), ensure_ascii=False)`; NestJS length-checks before `timingSafeEqual`
- **#76** Idempotency race in `handleMitCallback` → `processingPages: Set<number>` locks synchronously before any `await`
- **#77** Latecomer listener added after replay loop → add before iterating `completedPages`
- **#78** TOCTOU in `startOrAttachBatchJob` → register placeholder in `activeBatchJobs` before first `await cache.get()`

#### Dead Code Removed (#81, closed)
- `BooksService.translateMangaPage()` — full-image path (never called by frontend)
- `BooksController POST /chapters/:id/pages/:idx/translate` — endpoint removed
- `Frontend translateMangaPage()` — exported but never imported

#### Other Fixes (#82–#84, closed)
- **#82** `_retryMissingPagesIndividually` now accepts `AbortSignal`; passes `maxStartupRetries:3` to limit fallback wait from 150s → 15s per page
- **#83** `checkMitHealth` calls `/ready` (not root `/`); MIT server gains `/ready` endpoint returning 503 until first worker registered
- **#84** `fetchAvailableMangaModels()` fetches from `/api/proxy/books/models` with 5-min cache + hardcoded fallback

#### New Issues Created
- **#85** fix: `translateMangaEpisode` hardcodes Thai — add `targetLang` parameter
- **#86** feat: expand target language options to all 17 MIT-supported languages
- **#87** PRD: user-selectable Gemini model for MIT image translation

#### Architecture Decision: Option A' (Redis pub/sub batch translation)
After Gemini 10-perspective scrutiny + roadmap comparison:
- Option A (in-memory job registry) — compliant but 6 bugs stem from Map-based state
- Option B (sync NDJSON only) — simpler but violates Roadmap Fire-and-Forget + Pillar 4
- Option C (sequential+cache) — violates Pillar 4 and Phase 2 GPU cloud requirement
- **Option A' chosen**: replace `activeBatchJobs` Map with Redis pub/sub; `handleMitCallback` = `cache.set` + `redis.publish`; eliminates all 6 bug classes without losing fire-and-forget/webhook pattern

#### Test Count: 299 passing (was 295)

#### Notes
- `books-batch-webhook.spec.ts` (13 tests) + `books-retry.spec.ts` (2) + `books-health.spec.ts` (2) + `mit-webhook-hmac.spec.ts` (3) added
- Option A' implementation issue pending — will replace `startOrAttachBatchJob` (~500 lines) with Redis pub/sub (~50 lines)
- `processingPages: Set<number>` added to `BatchJobState` interface (temporary, removed with Option A')

---

## ✅ Cloudflare Worker + R2 Storage Integration (2026-06-09, Branch: feat/context-aware-translation)

### Status: COMPLETE (Phase A + B) — Phase C pending design decision

---

### สิ่งที่ทำในเซสชันนี้

#### 1. R2 Bucket + Worker ตรวจสอบและตั้งค่า

- ตรวจพบ bucket จริงชื่อ `mangadock-assets` (ไม่ใช่ `mangadock` ที่ wrangler.toml เดิมระบุ)
- ตรวจพบ Worker ที่มีอยู่ใน account: `jakethewitcher`, `mangadock-assets`, `tctps` — ไม่มี `mangadock-worker`
- ตัดสินใจ deploy ในชื่อ `mangadock-worker` (Worker ใหม่) เพื่อแยกออกจาก placeholder
- ตั้ง secrets ผ่าน `wrangler secret put` (3 ค่า: `BACKEND_SHARED_SECRET`, `MIT_PROCESS_URL`, `IMAGE_QUALITY_PROFILE`)
- Worker ขึ้น production แล้วที่ `https://mangadock-worker.akkanop2549.workers.dev`
- ทดสอบ endpoints ผ่านจาก local: `/health` ✓, `/v1/exists` ✓, `PUT /v1/object` → R2 ✓

---

#### 2. ไฟล์ที่แก้ไข

| ไฟล์ | การเปลี่ยนแปลง |
|------|----------------|
| `Cloudflare-Worker/wrangler.toml` | `name = "mangadock-worker"`, `bucket_name = "mangadock-assets"` |
| `Cloudflare-Worker/src/index.ts` | เพิ่ม `R2ListResult` interface, `handleList()` function, route `GET /v1/list` |
| `Backend/src/common/env.validation.ts` | เพิ่ม `WORKER_URL` + `WORKER_SECRET` (optional) |
| `Backend/src/common/storage/cloudflare-r2.provider.ts` | **ไฟล์ใหม่** — implements `StorageProvider` ผ่าน Worker API |
| `Backend/src/common/storage/storage.module.ts` | factory: ใช้ R2 provider เมื่อ `WORKER_URL`+`WORKER_SECRET` set, fallback `DiskStorageProvider` |

---

#### 3. Worker endpoint ใหม่: `GET /v1/list`

```
GET /v1/list?prefix=<prefix>            → directory listing (immediate children)
GET /v1/list?prefix=<prefix>&recursive=true  → all keys under prefix (สำหรับ deleteDir)
```

Response: `{ ok: true, keys: string[] }`

- `recursive=false` (default): ใช้ R2 `delimiter="/"` — คืนชื่อไฟล์และ subdirectory ระดับแรก (เหมือน `readdir` ของ `DiskStorageProvider`)
- `recursive=true`: คืน R2 keys ทั้งหมดที่ขึ้นต้นด้วย prefix — ใช้โดย `CloudflareR2StorageProvider.deleteDir()`

---

#### 4. CloudflareR2StorageProvider

`Backend/src/common/storage/cloudflare-r2.provider.ts` — implements `StorageProvider` interface ครบทุก method:

| method | Worker endpoint | หมายเหตุ |
|--------|----------------|---------|
| `put(key, data)` | `PUT /v1/object?key=` | รองรับ Buffer, string, Readable |
| `get(key)` | `GET /v1/object?key=` | คืน Buffer |
| `delete(key)` | `DELETE /v1/object?key=` | 404 = success (idempotent) |
| `deleteDir(prefix)` | `GET /v1/list?recursive=true` + delete each | parallel delete |
| `exists(key)` | `GET /v1/exists?key=` | |
| `list(prefix)` | `GET /v1/list?prefix=` | คืน basenames เหมือน readdir |

---

#### 5. StorageModule — factory switching

```typescript
// ใช้ R2 เมื่อ WORKER_URL + WORKER_SECRET ตั้งค่าไว้
// Fallback เป็น DiskStorageProvider เมื่อไม่มี env vars
```

ทุก consumer ของ `STORAGE_PROVIDER` (`BooksService`, `UploadService`, `PatchStore`) สลับไปใช้ R2 โดยอัตโนมัติ — ไม่ต้องแก้โค้ด caller

---

#### 6. ขั้นตอนที่ user ต้องทำเพิ่ม

```bash
# 1. เพิ่มใน Backend/.env
WORKER_URL=https://mangadock-worker.akkanop2549.workers.dev
WORKER_SECRET=<same value ที่ set ใน wrangler secret put>

# 2. Deploy Worker ที่อัปเดต (เพิ่ม /v1/list endpoint)
cd Cloudflare-Worker && npx wrangler deploy
```

---

#### 7. Phase C — ยังไม่ implement (pending design decision)

**ปัญหาที่พบ:** Worker `/v1/translate` ไม่ compatible กับ Backend translation flow ปัจจุบัน

| | Worker `/v1/translate` | Backend (ปัจจุบัน) |
|--|------------------------|-------------------|
| MIT endpoint | `/translate/with-form/image` | `/translate/with-form/patches` |
| Response | Full image binary (webp) | JSON patches `{xPct,yPct,wPct,hPct,url}` |
| UX | Page ถูกแทนที่ทั้งหน้า | Overlay text bubbles บนหน้าเดิม |

การ route translation ผ่าน Worker จะเปลี่ยน UX จาก "overlay patches" → "full image replacement" ซึ่งเป็น design decision ใหญ่ — รอ confirm ก่อน implement

---

#### ตั้งใจไม่แตะ

- Forum, wallet, unlock, users modules — ไม่เกี่ยว
- Frontend — URL shape เดิมทั้งหมด
- MangaDex CDN URLs — คงเดิม
- `ImageCacheService` (local thumbnail cache) — ยังใช้ disk ตามเดิม (scope แยก)
- `MANGA_TRANSLATOR_URL` ใน Backend — MIT patch translation ยังทำงานผ่าน direct call เหมือนเดิม

---

## 🛠️ V5 Final Hardening (Commit 69712f9)
- **Error Handling:** เปลี่ยน `throw new Error()` เป็น `InternalServerErrorException` ทั้งหมดใน `UnlockService` เพื่อมาตรฐานความปลอดภัย
- **Runtime Validation:** ติดตั้ง `forum.dto.ts` และเปิดใช้งาน `ValidationPipe` (class-validator) แบบ Global ใน `main.ts` ป้องกัน Payload ที่ผิดโครงสร้าง
- **Test Integrity:** แก้ไข `forum.controller.spec.ts` ให้ Mock ข้อมูลตรงตาม Contract จริง `{ items, total }`
<!-- lang:end -->

## 2026-06-09 — Render-parity E2E proof (#176 + #181 + #179 + #166/#170)
Full-stack restart (worker fresh = new code, backend `MIT_EN_COMIC_FONT=1 MIT_SUPERSAMPLING=4`,
frontend, cloudflared tunnel), 3-layer cache cleared + backend L1 reset.
`MIT/tools/ab_parity.py` → benchmark page JA→EN through worker with full parity render config.
Result: 6/6 regions translated + rendered, BubbleSeg 5 balloons/3 tagged, 1 merged patch,
comic font (`comic shanns 2.ttf`) confirmed loaded, 4× supersampling + safe-area narrow column active.
Montage `MIT/tools/_bubble_proof/parity_montage.png` [original | ours | MangaTranslator-ref].
Remaining gaps vs MangaTranslator: ALL-CAPS casing, SFX translate (#168, model dl), bolder weight.

## 2026-06-09 — Render-parity port plan + #168 model approved
Dug MangaTranslator (meangrinch) clone render path → `docs/research/render-parity-port-plan.md`.
Corrections: ALL-CAPS is `pipeline.py:1375 text.upper()` (real code, not prompt); SFX uses
`deepghs/AnimeText_yolo` (matches #168). User APPROVED downloading animetext_yolo (~400MB).
Starting /tdd: A=ALL-CAPS knob → C=font fill (relax cap+squeeze) → B=heavier font → then #168 SFX+outline.

## 2026-06-09 — /tdd render-parity slices A+B+C (opt-in knobs)
A (ALL-CAPS): backend MIT_EN_UPPERCASE → render.uppercase (MIT already honored it, manga_translator.py:1125).
C (bubble fill): new pure helper font_fit.font_high_cap + RenderConfig.font_max_box_ratio (default 0.5
= byte-identical) threaded dispatch→resize→_bubble_fit_font_size; backend MIT_FONT_MAX_BOX_RATIO (frac).
B (font weight): RenderConfig.en_font filename override in _render_font_path (BYO heavier face, MangaTranslator
style); backend MIT_EN_FONT.
Tests: MIT 36 passed (font_high_cap unit + wiring), Backend 26 passed (3 knob pairs); render import verified.
E2E worker-direct `tools/ab_parity2.py` → `parity2_montage.png` [original|v2_comic|v2_aa3|MangaTranslator]:
ALL-CAPS + fuller fill confirmed; weight still below MT (needs CC Wild Words via en_font). SFX = #168 next.

## 2026-06-09 — #168 SFX detector wired (AnimeText YOLO) + E2E
Model auto-downloads (gated deepghs/AnimeText_yolo, HF_TOKEN from MIT/.env via load_dotenv; cache warmed,
119MB). New manga_translator/sfx_detector.py (mirrors bubble_detector.py #170): lazy hf_hub_download → YOLO
→ boxes. Integrated in _run_detection (gated by det_sfx): AnimeText 2nd pass → dedup_sfx_boxes vs DBNet
textlines → survivors appended as empty Quadrilateral textlines → OCR/translate/render.
E2E `tools/ab_sfx.py` → `sfx_montage.png`: [SFXDetect] 8 boxes, +2 new textlines (deduped 6); region フッ→"Hmph"
now appears (DBNet never found it). LIMITATION: heavily-stylized SFX ぬ〜 IS detected but 48px OCR can't read
the hand-drawn katakana → empty → not translated (OCR gap #172/#167, not detection). MangaTranslator's "LOOM"
needs better OCR. Gap F (dedicated SFX outline) deferred — uses default border for now.
Tests: MIT 41 passed (sfx wiring), Backend 66 passed. All render-parity work (A/B/C/#168) opt-in, byte-identical off.

## 2026-06-09 — #180 Knuth-Plass line-break (pure module, step 1)
New manga_translator/line_break.py: find_optimal_line_breaks() — pragmatic Knuth-Plass DP
(badness=slack^3, hyphen_penalty=1000) ported from MangaTranslator text_processing.py:489-579.
Pure, dependency-light (word-width callback). Tests: test_line_break.py 5 passed (balanced break
beats greedy short-last-line, empty, fits-one-line, overwide-lone-token no deadlock, hyphen penalty).
NEXT (step 2, not done): wire into rendering/text_render.calc_horizontal behind a knob (replace the
greedy word-packing loop ~774-845) + E2E — risky integration into the core wrapper, deserves a focused pass.

## 2026-06-09 — #180 step 2 deferred → tech-debt issue #186
Traced rendering/text_render.py::calc_horizontal for the Knuth-Plass wiring: ~270-line monolith
(greedy pack + cross-line syllable hyphenation + single-char rebalance + assembly over shared mutable
state, lines 664-934). Forcing the DP in = high regression risk. Per user, recorded as tech debt instead:
filed #186 (refactor: extract pluggable LineBreaker seam, byte-identical greedy) + commented on #180
that step 2 is blocked-by #186. Pure module (#180 step 1) stays committed & unused (byte-identical).

## 2026-06-09 — MIT tech-debt audit → backlog issues #186–#193
4-agent structural audit of MIT (orchestrator, rendering, detect/ocr/inpaint/translators, config/server/tests).
Filed bilingual tech-debt issues (label MIT): #186 calc_horizontal line-break seam · #187 MangaTranslator god
object · #188 model-lifecycle + translator base abstractions (kill global MODEL state) · #189 glyph-render
dedup (put_char h/v + stroke) · #190 resize_regions + box-padding decomposition + constants · #191 vendored
LDM/YOLOv5 trim (license+maint) · #192 config centralize + cleanup (load_dotenv import side-effect, bare
excepts, TranslatorChain TODO) · #193 worker --start-instance lifecycle (5003/5004 orphan, PID, collision).

## 2026-06-09 — #186 tech-debt: characterization net + first calc_horizontal extractions
TDD refactor-under-test on rendering/text_render.py::calc_horizontal (the #186 monolith).
- Added test/test_calc_horizontal_characterization.py: golden line-break output on 4 representative
  strings (pinned to bundled Arial-Unicode font) = safety net for the whole #186 decomposition.
- Extracted _split_words_and_widths + _split_into_syllables from calc_horizontal (verbatim, byte-identical).
  Net caught a real leak (hyphenator used by Step 2/4) → restored in scope.
Verified byte-identical: characterization + rendering_guard + pure-module suite all green (47 passed).
NEXT on #186: broaden characterization cases (CJK/Thai/zwsp/empty), then extract the greedy packing
(Step 1) into the pluggable LineBreaker seam so Knuth-Plass (#180) can slot in.

## 2026-06-09 — #186 milestone: greedy line-break extracted into a swappable seam
Applied the "test all scenarios first" rule (memory feedback_techdebt_all_scenarios): broadened the
characterization net to 16 cases covering the rarely-hit branches (height-overflow max_width expansion,
max_width<2*font clamp, Step 2 backward hyphenation, mixed EN+CJK, whitespace collapse, char-split,
hyphenate on/off) BEFORE touching code. Then extracted calc_horizontal's Step-1 greedy packing into
text_render._greedy_pack(words, word_widths, syllables, font_size, max_width, ws_off, hyphen_off)
-> (line_words_list, line_width_list, hyphenation_idx_list). Steps 2-4 post-process its output unchanged.
Byte-identical: 26 passed (characterization + guard + pure modules). This IS the #186 seam — #180 step 2
now just adds a Knuth-Plass packer with the same signature + selects it behind a knob.

## 2026-06-09 — #192 slice (a): extract TranslatorChain parsing (pure, tested)
Pulled config.py's `# TODO: Refactor` TranslatorChain parse into manga_translator/translator_chain.py
::parse_translator_chain(string, resolve_translator, valid_translators, valid_languages) — deps injected
so it unit-tests with no translators/ML import. Wired TranslatorChain.__init__ to delegate; byte-identical
(real-deps check: gemini:ENG → same chain/translators/langs/target_lang). Tests: test_translator_chain.py
7 passed (single/multi/empty/unknown-name KeyError/disabled ValueError/unknown-lang ValueError + wiring).
TODO marker resolved. Next #192 slices: dead fields, bare excepts, load_dotenv import side-effect.

## 2026-06-09 — #192 slice (b1): remove dead vestigial fields
Removed self._batch_contexts / self._batch_configs from MangaTranslator.__init__ (manga_translator.py:135-136)
— assigned once, never read anywhere (grep-confirmed). Import OK; 19 tests green. Remaining #192:
bare-except cleanup (20+ sites, per-site policy — its own slice), load_dotenv import side-effect (blast
radius: worker HF_TOKEN auto-download + API keys — needs entry-point tracing, flagged before touching).

## 2026-06-09 — #187 slice: extract pure validation check off the god object
Pulled `_check_repetition_hallucination` (a pure verdict masquerading as an async method that awaited
nothing) out of the 3,200-line MangaTranslator into manga_translator/translation_checks.py
::check_repetition_hallucination — the seam where new post-translation validators attach (feedback_core_boundary)
instead of growing the orchestrator. The async method now delegates; byte-identical (verified vs the pure fn on
4 cases). Tests: test_translation_checks.py 5 passed (char/segment/phrase repetition, empty/short, threshold).
God object shrank ~50 lines. Next: extract _check_target_language_ratio into the same seam.

## 2026-06-09 — #187 slice (b): extract target-language-ratio check off the god object
Pulled `_check_target_language_ratio` (a pure verdict, Issue #109) into translation_checks
::check_target_language_ratio(text_regions, target_lang, script_ratio, min_ratio) — script_ratio injected
so it unit-tests with a stub (the real target_script_ratio passed in production). Async method delegates;
byte-identical (verified vs pure fn). Tests: test_translation_checks.py 10 passed (5 repetition + 5 ratio).
The validator seam now holds both post-translation checks; new validators attach here, not in the god object.

## 2026-06-09 — #187 slice (c): extract duplicated punctuation correction off the god object
The quote/bracket punctuation-correction logic (check_items + replace_items tables + a per-region
mutation loop) was DUPLICATED inline in two places in MangaTranslator (translate + batch paths, ~150 lines
total). Extracted verbatim to manga_translator/punctuation.py::correct_punctuation(source_text, translation)
— pure string logic. Both call sites now delegate via `region.translation = correct_punctuation(region.text,
region.translation)`; the data tables are gone from the god object. Byte-identical (6 golden characterization
cases capturing the smart-quote->corner-bracket conversion, forced replacements, count-mismatch no-ops).
Tests: test_punctuation.py 7 passed (6 behavioral + wiring inspection). Regression suite 36 passed.

## 2026-06-09 — MIT core deep analysis + roadmap reconciliation (answering "did you analyze deeply / follow the roadmap")
Honest gaps: had only audited (file:line), not deep-analyzed the hard core; and had deviated from the
foundation-first roadmap (jumped to #187 easy slices). Fixed via a 6-agent ultracode deep read →
docs/research/mit-core-decomposition-analysis.md: 26 seams (S1-S26) with deps, test strategy, and 16
source-cited landmines (TTL key drift L1, divergent min_ratio 0.3/0.5 + threshold 6/>10 L6, singleton
page-context bleed L9, exit(-1) in a stage L2, cleanup-task leak L14). Reconciled the roadmap: #187/#188
are ~16 interleavable seams (the already-done punctuation/validator/greedy-pack extractions ARE S-seams),
not monolithic Phase-C. Corrected next 3 steps: S1 filter_translated_regions (verbatim 3-way dedup) → S2
apply_translations → S3 ModelUsageTracker (#188 starts early). Landmines must be PRESERVED then fixed behind opt-in flags.

## 2026-06-09 — #187 S1: collapse the verbatim 3-way post-translation region filter
Following the reconciled roadmap's corrected step 1 (the highest-value/lowest-risk dedup the old plan
missed). The should_filter block (drop blank/numeric/filter-matched/identical-to-source translations) was
verbatim-identical in three MangaTranslator paths (single/batch/concurrent). Extracted to
region_filter.filter_translated_regions(text_regions, config); all 3 sites now delegate (should_filter
count: 3→0). Byte-identical incl. none (only-blank) + original (no identical-check) carve-outs.
Tests: test_region_filter.py 7 passed (every branch + carve-outs); regression 35 passed.

## 2026-06-09 — Persist all MIT exploration/analysis/plans (context-loss insurance)
Created docs/reports/mit-refactor-progress.md — the SINGLE resume point: read-order index, governing rules,
the landmines-to-preserve quick-ref, the S1-S26 seam status table (done/next/blocked + commit hashes), the
#186-#193 issue status, and pending items (#180 wiring, glossary assembly). Added memory
project_mit_refactor_resume pointing a fresh session at it. All canonical artifacts already committed
(analysis, plan, dissection, port-plan, report). A reset context can now resume at S2 without re-exploring.

## 2026-06-09 — #187 S2: fold the 4 translation→region assign copies + 3 original-as-translation copies
Following the reconciled roadmap's corrected step 2. The happy-path "assign each translated sentence to its
region + stamp target_lang/_alignment/_direction" loop was near-duplicated in four MangaTranslator paths
(single / batch-memory-fallback / batch shared-index / concurrent), the render-casing logic appeared a fifth
time in the retry path, and an error-fallback "use the source text as its own translation" loop in three
more. Extracted to region_apply.{apply_translations, apply_render_casing, apply_original_as_translation};
all 8 sites delegate (region.translation-assign loops 8→0). Byte-identical: preserves the L10 zip-truncation
invariant (single/batch zip; concurrent's i<len guard yields the same kept-set so it collapses to the same
zip), the single-path-only casing (apply_casing flag — batch/concurrent/memory-fallback never cased), and
the batch shared-index by returning the consumed count so the caller advances text_idx itself. New branch
off main (refactor/mit-seam-s2-apply-translations).
Tests: test_region_apply.py 9 passed (assign+metadata, casing on/off, in-place re-case, L10 truncation,
extra-dropped, shared-index threading, original-as-translation no-casing); region_filter 7 + translation-
path regression 32 passed; full suite 177 passed (the 19 async-not-supported failures are pre-existing —
verified identical on the stashed base).

## 2026-06-09 — #187 S3 / #188 starts: ModelUsageTracker (wrap _model_usage_timestamps)
First #188 seam (interleaved early per the reconciled roadmap). The model-usage TTL dict was stamped from 8
inline _run_* sites (self._model_usage_timestamps[(tool, model)] = current_time) and swept in
_detector_cleanup_job with a list(items()) loop + mid-iteration del. Extracted to
model_usage_tracker.ModelUsageTracker — touch(tool, model, now) / expired(ttl, now) / forget(tool, model),
clock injected so it tests in <1s with no ML stack. All 8 sites now call touch(...); the sweep is
`for tool, model in tracker.expired(self.models_ttl, now): await _unload_model(...); tracker.forget(...)`.
Byte-identical: keys NOT normalised so the L1 key-drift is pinned verbatim ('colorizer' never matching
_unload_model's case 'colorization'; 'textline_merge'/'rendering' no-case) — golden'd before S4 freezes the
unload routing; strict `> ttl`; insertion-order list(...) snapshot so mid-sweep forget is safe (L13). 0
remaining _model_usage_timestamps refs. Stacked on the S2 branch (refactor/mit-seam-s3-model-usage-tracker).
Tests: test_model_usage_tracker.py 7 passed (strict-> boundary, insertion order, forget, safe-forget-during-
iteration, re-touch refresh); full suite 184 passed (same 19 pre-existing async failures, no new breakage).

## 2026-06-09 — #187 S4 / #188: ModelUnloader (routing table replaces _unload_model match/case)
The 6-arm `match tool:` in _unload_model became model_unloader.ModelUnloader — an injected
{tool: async unload_fn} table + empty_cache/cuda_available hooks; _unload_model is now a one-line delegate
(await self._model_unloader.unload(tool, model)). The ctor wires the table from the real unload_* imports
(colorization/detection/inpainting/ocr/upscaling/translation) + torch.cuda.empty_cache/is_available. Routes
injected → module pulls in no ML stack, tests via asyncio.run (pytest-asyncio not active here). Byte-identical:
same log line, same fall-through-then-empty_cache order, and crucially the L1-drifted keys the tracker stamps
('colorizer' vs the table's 'colorization', plus 'textline_merge'/'rendering') route to NOTHING — the same
latent no-op the match/case had, now pinned by a test (3× empty_cache, 0 unloads) before the routing is
frozen. Stacked on S3 (refactor/mit-seam-s4-model-unloader). S3+S4 together lift the model-lifecycle state
(tracker + unloader) out of the god object — the #188 foundation; next #188 seam is S20 ModelReaper (the TTL
loop) after S5.
Tests: test_model_unloader.py 4 passed (known-tool route+cache, L1-drift no-op ×3, no-empty-cache-when-cuda-
unavailable, per-tool routing); full suite 188 passed (same 19 pre-existing async failures, no new breakage).

## 2026-06-09 — #187 S5: release_memory (fold the 4 verbatim gc.collect + empty_cache copies)
The `gc.collect()` + `if torch.cuda.is_available(): torch.cuda.empty_cache()` cleanup was repeated verbatim in
4 MangaTranslator spots (>85% pre-processing guard, MemoryError fallback, per-page individual cleanup,
per-batch tail). Extracted to memory_guard.release_memory(cuda_available, empty_cache) — the two torch hooks
injected so it unit-tests with no torch. All 4 sites → release_memory(torch.cuda.is_available,
torch.cuda.empty_cache); 0 remaining gc.collect/import gc in the god object. Byte-identical (same
collect-then-empty order, same cuda gating). Surgical-scope note: the psutil virtual_memory().percent > 85
pressure check is single-use, so it was NOT extracted (nothing to de-duplicate; the analysis's
under_memory_pressure() is deferred until a 2nd site appears — folding a single-use block would add a function
without collapsing drift, against the North Star). Stacked on S4 (refactor/mit-seam-s5-memory-guard).
Tests: test_memory_guard.py 2 passed (collect-then-empty when cuda available; collect-only when not); full
suite 190 passed (same 19 pre-existing async failures, no new breakage).

## 2026-06-09 — #187 S7: context_page_counts (fold the 2 context-carry accounting blocks)
The (pages_used, skipped) accounting — "how many recent non-empty pages to carry, how many expected pages
skipped for being empty" — was identical in single dispatch (_dispatch_with_context) and concurrent dispatch
(_batch_translate_texts), each feeding the "Carrying N" / "Skipped N" log lines. Extracted to
context_counts.context_page_counts(context_size, done_pages); both sites → one-line call so the two paths'
logged numbers can't drift. Byte-identical: both counts capped at context_size, blank-page detection
any(sent.strip() ...) preserved. Scope note: _build_prev_context recomputes its OWN non_empty_pages/pages_used
to slice the context tail — that's the S6 seam, left untouched. Stacked on S5
(refactor/mit-seam-s7-context-counts).
Tests: test_context_counts.py 7 passed (context_size=0, no-pages, all-non-empty, blank-skipped, budget-caps-
so-empty-not-skipped, budget-above-non-empty, page-empty-only-if-all-blank); full suite 197 passed (same 19
pre-existing async failures); context regression (test_page_context/test_series_context) green.

## 2026-06-09 — #187 S8: apply_post_dictionary (fold post-dict apply+log; move dict helpers to dictionary.py)
The post-translation dictionary apply+log block was verbatim in single (_translate) and batch
(_apply_post_translation_processing). Extracted to dictionary.apply_post_dictionary(text_regions,
post_dict_path) — applies post-dict to each region.translation in place, collects "before => after" records,
logs per-line + summary (or "No post-translation replacements made."), returns the list. The pure
load_dictionary/apply_dictionary helpers were MOVED out of manga_translator.py into the same new dictionary.py
(they only use os/re/logger, no MangaTranslator deps) so the stage tests with no ML stack; manga_translator
re-imports all three, so `from .manga_translator import load_dictionary` still resolves and __main__.py is
untouched (verified: load_dictionary.__module__ == manga_translator.dictionary). Byte-identical: same records,
same logs, same `import regex as re` semantics. Completes the Phase-A low-risk cluster (S1-S5,S7,S8); S6
build_prev_context (med-risk) is next. Stacked (refactor/mit-seam-s8-post-dictionary).
Tests: test_dictionary.py 6 passed (replace, token-delete, summary+per-line logs, no-replacements message,
empty-path no-op, moved-helper parse/apply); full suite 203 passed (same 19 pre-existing async failures).

## 2026-06-09 — E2E smoke-validation of the S2-S8 stack (live pipeline, hayateotsu.space)
User brought up MIT on the refactored working tree + ran a real translation (OPM benchmark page). Result: full
pipeline ran end-to-end clean — translate → region-assign + uppercase casing (S2, visibly correct) → post-dict
(S8) → model lifecycle (S3/S4/S5) → render; no crash, all bubbles populated & placed, hyphenated. Output is
markedly better than the pre-render-parity "before" shot (no edge-clipping). Confirmed the refactor caused NO
regression. The remaining gap to the MangaTranslator target (translation wording/naturalness, missing space
after punctuation — present in the "before" shot too, ぬっ SFX→"LOOM" not rendered, minor fit) are pre-existing
translation/SFX(#168)/line-break quality issues ORTHOGONAL to the byte-identical decomposition. Decision: finish
the refactor workstream first (no PR / no quality work yet).

## 2026-06-09 — #187 S6: build_prev_context (pure fn; per-mode index policy explicit)
MangaTranslator._build_prev_context (the ~50-line per-mode context-string builder) extracted to pure
prev_context.build_prev_context(all_page_translations, original_page_texts, context_size, *, use_original_text,
current_page_index, batch_index, batch_original_texts); the method is now a thin delegate so its 2 call sites
are untouched. Byte-identical: preserves the L7 available_pages.index(page) FIRST-MATCH (duplicate-content pages
map to the earliest original), the pages_used==0 / not-available_pages empty short-circuits, and the concurrent
`pass` (no append when not using original text). hasattr(self,'_original_page_texts') -> `is not None` (equiv —
the attr is always init'd []). Process note: Serena replace_symbol_body mis-detected the method start line and
produced a duplicate def + ate part of _dispatch_with_context; caught by grep, reverted file to S8 state, redid
with an anchored regex. Stacked (refactor/mit-seam-s6-build-prev-context).
Tests: test_prev_context.py 11 passed (numbered output, context_size<=0, no-pages, blank-skip+cap,
current_page_index slice, use_original pull, L7 duplicate first-match, original-fallback, concurrent append vs
pass); context regression (test_page_context/test_series_context) green; full suite 214 passed (same 19
pre-existing async failures, no new breakage).
## 2026-06-09 — #187 S9: none-translator front-matter guards (L12 + L3)
Two landmine pieces of _run_text_translation's front-matter extracted to none_translator.py:
apply_prep_manual_override(config, prep_manual) (L12 — prep_manual forces translator=none by mutating
config.translator.translator in place; poisons a reused Config, preserved verbatim) and
stamp_none_translations(text_regions, config) (L3 — blanks every region.translation + stamps metadata; caller
returns ALL regions unfiltered vs the filtered normal path). Call-site order preserved EXACTLY (override →
tracker.touch → if-none stamp + return ctx.text_regions) so touch still fires for the none path. Byte-identical.
Stacked (refactor/mit-seam-s9-none-translator).
Tests: test_none_translator.py 4 passed (prep_manual true/false, none-stamp metadata, empty-list no-op); full
suite 218 passed (same 19 pre-existing async failures, no new breakage).

## 2026-06-09 — #187 S10: translation side-channel I/O (load/save_text)
The --load-text/--save-text JSON read/write in _run_text_translation extracted to
translation_store.{read_translations, write_translations} (byte-identical: indent=4, ensure_ascii=False). The
print(...) + bare exit(-1) (L2) and the input_files[0] filename derivation are LEFT INLINE (exit is a
process-control landmine clearer when visible); no IndexError guard added (would change behaviour). Latent bug
surfaced + preserved: the inline open(...,"w") had no encoding=, so on cp1252-default Windows ensure_ascii=False
non-ASCII raises UnicodeEncodeError — candidate fix (encoding="utf-8") deferred to an opt-in change; logged in
the progress doc. Stacked (refactor/mit-seam-s10-translation-store).
Tests: test_translation_store.py 3 passed (round-trip, indent-4 array, non-ASCII unescaped ensure_ascii=False);
full suite 221 passed (same 19 pre-existing async failures, no new breakage).

## 2026-06-09 — #187 S11: ImageDebugContext (full class — debug-folder path lifecycle)
The invasive one (user chose full extraction for long-term tech-debt reduction). Consolidated the scattered
_current_image_context / _saved_image_contexts state + _set/_get/_save/_restore_image_context helpers +
_result_path + the 2 manual save/restore swap closures into image_debug_context.ImageDebugContext
(set/subfolder/save/restore/clear_saved/with_context/result_path). Approach: state+logic moved into the class;
the 5 methods became THIN DELEGATES (so their ~call sites are unchanged); ~18 direct self._current_image_context
reads -> self._image_debug.current (mechanical rename, dict shape preserved); the 2 swap closures
(original=...; ...=X; try: result_path; finally: ...=original) -> `with self._image_debug.with_context(X):
return self._result_path(path)`. Byte-identical: same subfolder format, same verbose/web/result_sub_folder path
branches incl. the no-context default {ts}-unknown-1024-unknown-unknown, same makedirs, same getattr defaults.
0 orphan refs; diff reviewed call-site-by-call-site. Stacked (refactor/mit-seam-s11-image-debug-context).
Tests: test_image_debug_context.py 13 passed (subfolder, save/restore round-trip+miss, no-current save no-op,
with_context swap + exception-restore, 5 result_path goldens, set with/without image + getattr defaults); full
suite 234 passed (same 19 pre-existing async failures, no new breakage).

## 2026-06-09 — PR #195 merged + #187 S12 (globals half): apply_global_settings
PR #195 (seams S2–S11, 10 byte-identical extractions) addressed the github-code-quality finding (dual-import
style in test_image_debug_context → single `idc.` form) and was **merged to main** (merge `88a01eb`). Resolved a
merge collision in Backend/.env.example by keeping main's canonical Cloudflare Worker config (akkanop-x domain).

Then S12 (globals half): the process-global construction side effects — conditional ModelWrapper._MODEL_DIR
override (was in parse_init_params) + the two torch.backends.*.allow_tf32=True flags (were in __init__) →
pipeline_params.apply_global_settings(params), called once after parse_init_params. Removed the now-unused
ModelWrapper import (0 refs left). Byte-identical: nothing reads _MODEL_DIR between its old (mid-parse) and new
(post-parse) position, models load lazily at translate time, TF32 flags + relative order preserved. The
PipelineParams value object for the ~20 parsed fields is DEFERRED until #192 (entangled with device/using_gpu/
raise + ordering — the analysis gates it on config-centralisation). Branch refactor/mit-seam-s12-pipeline-params.
Tests: test_pipeline_params.py 3 passed (model_dir override / absent-or-empty no-op / TF32 flags); full suite
237 passed (same 19 pre-existing async failures, no new breakage). Next actionable seam: S20 ModelReaper (deps
S3+S4 done).

## 2026-06-09 — #187 S20 / #188: ModelReaper (TTL loop off the god object)
_detector_cleanup_job (the background model-TTL polling loop) extracted to
model_reaper.ModelReaper(tracker, unloader, get_ttl): _loop polls the testable reap_once(now) once/sec; the 2
task-creation sites now call self._model_reaper.start() behind their existing `is None` guard; the method is
gone. Wraps the S3 tracker + S4 unloader (both on main). Byte-identical: ttl==0 short-circuit preserved,
list(...) snapshot (L13) intact via tracker.expired, unload-before-forget order kept; reaper calls
unloader.unload directly (== the old _unload_model delegate). L14 fix is OPT-IN: stop() cancels the task but
nothing calls it by default → the cleanup-task leak is preserved verbatim until a caller opts in. Stacked on S12
(refactor/mit-seam-s20-model-reaper).
Tests: test_model_reaper.py 5 passed (unload→forget order, ttl==0 no-op + expired-not-queried, start creates
task, stop cancels, stop-no-task no-op); full suite 242 passed (same 19 pre-existing async failures, no new
breakage). Next: S15 Stage protocol (#187 core begins; deps S3 done).

## 2026-06-09 — #187 S13 / #168: DetectionPostProcessor (move SFX second-pass merge off the god object)
_merge_sfx_detections + _textline_aabb (the AnimeText SFX second-pass, gated by config.detector.det_sfx)
extracted to detection_postproc.{merge_sfx_detections, textline_aabb}; _run_detection now calls
merge_sfx_detections(ctx, result, self.device); the 2 methods + the now-unused Tuple import removed. Done
without S15 (call-site gate unchanged). Byte-identical (same IoA dedup, empty-Quadrilateral append, [SFXDetect]
log, str(device or 'cuda')). Stack (refactor/mit-seam-s13-detection-postproc).
Stale-test fixes surfaced by the full-suite run (both are source-inspection wiring tests repointed to the new
module locations): test_sfx_merge (merge body moved to detection_postproc.py) and — PRE-EXISTING since S2 merged
— test_safe_area::test_en_uppercase_lettering_is_wired (S2 moved casing to region_apply.py but the test still
grepped manga_translator.py). MIT test baseline is now 18 async-only failures (was 19; one was this stale test).
Tests: test_detection_postproc.py 2 passed (AABB golden, no-SFX identity short-circuit); full suite 245 passed
(18 pre-existing async failures, 0 real failures). Next AFK seam: S16 TranslationMemory.

## 2026-06-09 — #187 S16: TranslationMemory (name the cross-page bleed boundary)
The two cross-page lists (all_page_translations + _original_page_texts) + reset_page_context extracted to
translation_memory.TranslationMemory (all_page_translations, original_page_texts, reset()). self._translation_
memory holds them; ~16 direct refs renamed mechanically (lists stay plain lists → append/len/index/slice
identical); reset_page_context delegates to .reset(). Makes the #136/#140 worker-singleton bleed boundary an
explicit object (L9). Byte-identical: append sites still caller-driven (L7 asymmetry), reset still only from
translate_patches (L9), reset rebinds not .clear() verbatim. Updated test_page_context's _bare_translator to the
new memory location (it set the old attrs directly + reset now delegates). Stack
(refactor/mit-seam-s16-translation-memory).
Tests: test_translation_memory.py 4 passed (empty init, appendable, reset clears, reset-rebinds-not-clears);
context regression (test_page_context/test_series_context) green; full suite 249 passed (18 pre-existing async
failures, 0 real failures). Next AFK seam (last before core): S19 gather_per_context.

## 2026-06-09 — #187 S19: gather_per_context (concurrent gather + per-exception placeholder)
The concurrent driver's asyncio.gather(return_exceptions=True) + per-exception keep-original placeholder loop
extracted to gather_per_context.gather_per_context(tasks, contexts_with_configs, ignore_errors); the inline
~20-line block → one `final_results = await gather_per_context(...)` (bracketing Starting/Completed logs kept).
Byte-identical: same return_exceptions=True, re-raise-unless-ignore_errors, apply_original_as_translation
placeholder gated on ctx.text_regions, index alignment + logs. apply_original_as_translation still used at its
other (batch error-fallback) sites — no orphan. Stack (refactor/mit-seam-s19-gather-per-context).
Tests: test_gather_per_context.py 4 passed (all-succeed order, exception+ignore→placeholder index-aligned,
exception+not-ignore→reraise-original, no-regions skips-apply); full suite 253 passed (18 pre-existing async).

## 2026-06-09 — AFK decomposition batch done (S12-globals, S20, S13, S16, S19) — STOP before the core
Per the dev's "do the normal seams AFK, stop at the hard ones": after PR #195 (S2–S11) merged, five more
byte-identical seams landed on a stack — S12-globals (apply_global_settings), S20 (ModelReaper), S13
(detection_postproc), S16 (TranslationMemory), S19 (gather_per_context). STOPPED before the high-risk
async-orchestration core (S15 stage-protocol + S17/S18/S21/S22/S23/S24/S25/S26) which the analysis flags for
E2E-per-step. Test baseline corrected to 18 async-only failures (a stale uppercase-wiring test from S2's casing
move was fixed in S13). Full suite 253 passed, 0 real failures. Stack ready to PR.

## 2026-06-09 — #187 S21 / #188: ModelLifecycle facade (first core seam; preload + ensure_running fold)
After pushing a rollback point (main + PR #196) the dev said continue, so started the core. S21: the duplicated
eager-preload block (×2, gated models_ttl==0) + the duplicated cleanup-task guard (×2) → model_lifecycle.
ModelLifecycle(reaper, prepare_fns) with preload(config, device, models_ttl) + ensure_running(); the guard's
idempotency moved into ModelReaper.ensure_started(). self._detector_cleanup_task removed (the reaper owns its
task; 0 refs left). Facade wraps the reaper; tracker(S3)+unloader(S4) stay direct (used by _run_* touch + reaper)
— absorbing them is high-churn/low-value, deferred. Byte-identical (same preload order, upscale_ratio/Colorizer.
none conditions, device threading, models_ttl==0 gate; prepare_* injected as a table → ML-free tests). Stack on
PR#196 (refactor/mit-seam-s21-model-lifecycle).
Tests: test_model_lifecycle.py 4 passed + test_model_reaper ensure_started idempotent; full suite 258 passed
(18 pre-existing async, 0 real). Remaining core = the hardest (S15/S17/S18/S22/S23/S24/S25/S26) — pausing to
report before the L6/L8/L9-touching async-orchestration seams.

## 2026-06-09 — #187 S17: TextTranslationDispatcher (collapse the duplicated chatgpt translator switch)
The hardest seam. The duplicated ChatGPT/ChatGPT2Stage handling in _dispatch_with_context (single) +
_batch_translate_texts (batch) → text_translation_dispatcher.{build_chatgpt_translator, dispatch_translate}.
Split into TWO functions because construction order is load-bearing: OpenAITranslator.__init__ can warn about
the glossary, and single constructs AFTER the context log while batch constructs BEFORE — so each caller calls
build_chatgpt_translator at its own point (order preserved) and dispatch_translate does the order-invariant
parse/set-context/log/translate. Divergences preserved & parameterised: result_path_callback (single = bound
_result_path direct-set; batch = with_context swap closure), batch_contexts wiring (on_2stage_batch_setup,
batch-only), and the context-computation placement (single unconditional incl. non-chatgpt log; batch only in
its chatgpt branch — both kept at the call sites). Only reorder: parse_args now after the silent
build_prev_context → identical observable log sequence. Stack on S21 (refactor/mit-seam-s17-text-translation-
dispatcher). Pushed for rollback.
Tests: test_text_translation_dispatcher.py 6 passed (build→openai/2stage, parse/set/translate w/wo ctx,
2stage callback+batch-setup, chatgpt-skips-batch-setup, carry/skip logs) via fake translators + sys.modules
stubs; full suite 264 passed (18 pre-existing async, 0 real). E2E PENDING — this high-risk seam wants a live
translation pass (single + batch + concurrent + chatgpt_2stage) before merge.

## 2026-06-10 — #189 + #190 render dedup (6 byte-identical seams, golden-pixel guarded)
After the #187/#188 decomposition merged (PR #203), took the two sibling render-dedup issues at xhigh. All
six seams are byte-identical, each pinned by a golden-pixel characterization test before the edit.
Branch `refactor/mit-189-190-render-dedup` off main.
#189 (`rendering/text_render.py`): the two ~200-line near-duplicate glyph functions `put_char_horizontal`/
`put_char_vertical` collapsed onto shared direction-parameterised helpers —
  S1 `_render_glyph_stroke(cdpt, font_size, direction)` (the freetype stroker block + validity check, identical);
  S2 `_paste_bitmap(canvas, bitmap, x, y, blend)` (the 4 clip/slice/blend paste sites -> 1; `blend=np.maximum`
     for the char paste so Thai combining marks accumulate, `cv2.add` for stroke). 3 of 4 sites already used
     correct edge clipping; the vertical *stroke* paste clamped pen_border>=0 and sliced bitmap[0:...], misaligning
     a stroke clipped off the top/left edge — a latent bug, dead on padded render canvases. Unified to correct
     clipping, pinned by an explicit edge test;
  S3 `_select_face_for_char(cdpt, font_size, direction)` (the font-fallback loop shared by get_char_glyph/border).
  Deferred + flagged: the issue's FontStack cache-key fix is a behaviour change (alters output when the font
  switches mid-page), kept out of the byte-identical pass.
#190 (`rendering/__init__.py`): S1 `_expand_single_axis(region, needed, used, horizontal_axis)` folds the two
  byte-identical single-axis expansion blocks (rows->x / cols->y); the orchestrator keeps both independent `if`
  blocks so the both-directions-true overwrite order is preserved, passing the axis explicitly. S2 `_pad_box(
  temp_box, pad_height, ext, offset)` collapses render()'s four ratio-padding branches' zero-box/place/copy
  boilerplate while each branch keeps its own divergent ext-formula + offset inline (h centres / v top-/left-
  aligns per #110 — NOT unified, which would shift edge pixels). S3 named the length-ratio tuning factors as
  module constants (`_LEN_RATIO_FONT_GAIN` 0.3, `_FONT_SIZE_SCALE_GAIN` 0.4, `_MAX_BBOX_SCALE` 1.1) + deleted
  the ~14-line dead commented "translation shorter" elif. Deferred + flagged: threading a RenderTuning
  dataclass through dispatch() (machinery for runtime config we don't have).
Guards (new): `test/test_put_char_golden.py` (golden over Latin/CJK/Thai-base/Thai-combining/CJK-punct/space x
both directions x border on/off x 2 sizes) + `test/test_render_golden.py` (deterministic golden on dispatch()
output over h-expansion + v-expansion + legacy length-ratio regions, bubble_fit off). Goldens committed under
`test/golden/` (test/testdata is gitignored). All 6 seams kept both goldens green; full suite 331 passed
(18 pre-existing async, 0 real). E2E PENDING — batched tunnel pass after #190 per the dev's call.
[Update: #189+#190 shipped as squash PR #215 (cf22c62); live direct-MIT E2E passed 74s, clean Thai render.]

## 2026-06-11 — #186 LineBreaker seam (finish) + Knuth-Plass wired (unblocks #180)
Continuation at xhigh after #189/#190 merged (PR #215). Prior sessions had already extracted
`calc_horizontal`'s tokenizers (`_split_words_and_widths`, `_split_into_syllables`) and the greedy Step 1
(`_greedy_pack`) under a committed 15-case characterization net (`test/test_calc_horizontal_characterization.py`,
EN/TH/CJK/edge/Step-2/over-wide). This session finished the seam. Branch `refactor/mit-186-linebreaker-seam`
off main, 3 commits:
  C1 (byte-identical) — formalised the seam: `LineBreaker` Protocol + `GreedyLineBreaker` (delegates to
     `_greedy_pack`) in `text_render.py`; `calc_horizontal` gained `line_breaker=None` (defaults to greedy) and
     calls `breaker.pack(...)`; Step 2 (backward syllable hyphenation) now gated on `breaker.greedy_postprocess`
     (True for greedy => unchanged). 3 production callers all pass <=6 args, so the new 7th param is inert.
     Characterization net + line-break + thai-wrap + font-fit: 23 passed => production render byte-identical.
  C2 (opt-in feature) — `KnuthPlassLineBreaker` bridges the pure `line_break.find_optimal_line_breaks` (#180
     step 1) into the seam: groups whole words to minimise total badness (balanced lines, no lone short last
     word); word-granularity so no mid-word hyphenation (`hyphenation_idx_list` all 0) and `greedy_postprocess=
     False` so its layout is never re-greedified. `test/test_line_breaker.py` (4): both strategies in isolation
     with a stubbed width fn (no PIL) — greedy overflow `[[0,1],[2]]` vs KP balance `[[0],[1,2]]` — plus a
     real-font `calc_horizontal` test proving KP is selectable and tightens the spread (demo sentence
     'the quick brown fox jumps over the lazy dog today': greedy leaves lone 'today' min97/spread117; KP pulls
     'dog' down => min137/spread57).
  C3 — PIPELINE.md §5 (text_render row + the `line_break.py` "wire pending" -> "wired behind #186 seam"),
     DONE.md, impact report.
Design: greedy stays the default so the live render is byte-identical; #180 step 2 now collapses to selecting
`KnuthPlassLineBreaker` behind `render.bubble_area_fit` + E2E. Over-wide-word syllable splitting + empty-text
degenerate handling stay the greedy path's job (documented on the KP class) — KP refinement is #180's scope.

## 2026-06-11 — #193 harden --start-instance worker lifecycle (port-collision + orphan cleanup)
The front server (`--port P`) launches the worker subprocess on `P+1`; the inline launch had no port-collision
check, no orphan cleanup, and its SIGINT/SIGTERM handlers are silently overridden by uvicorn (so Ctrl+C left the
worker orphaned on 5004 serving old code — the restart pain hit repeatedly during render-parity dev + this
session). Branch `refactor/mit-193-worker-lifecycle` off main.
- New `server/worker_lifecycle.py` (pure stdlib, unit-tested without spawning a worker): `port_is_free` (plain
  bind, no SO_REUSEADDR so a live listener reads as taken), `ensure_worker_port_free` (raises a clear
  RuntimeError naming both ports + "free BOTH"), `terminate_process` (terminate → wait(timeout) → kill
  escalation; idempotent on None / already-exited).
- `server/main.py`: `start_translator_client_proc` now pre-checks the worker port (fail loud, not hang), prints
  front+worker PIDs, registers `atexit.register(terminate_process, proc)` as the reliable cleanup backstop
  (uvicorn clobbers the signal handlers), and the signal handler + `__main__` (now `try/finally`) both route
  through `terminate_process`. Behaviour change (NOT byte-identical): happy path preserved, cleanup hardened,
  collisions fail loud.
- `test/test_worker_lifecycle.py` (8): port free/taken, ensure raises with both ports + BOTH, terminate
  live / kill-on-timeout / noop-already-dead / noop-None.
- `MIT/README.md`: "Worker lifecycle (two-port model)" — restart kills BOTH ports (PowerShell one-liner),
  graceful vs force-kill, the port-busy message meaning, poll `/ready` not `/health`.
Validation: 8 unit pass; full suite 350 pass / 18 pre-existing async / 0 new fail; **live collision test in the
real entrypoint** — starting front 5003 while the running MIT's worker held 5004 raised the RuntimeError
immediately, before any ML load (no "MIT worker started"/"Nonce" printed). Aligns with the project_mit_launch_env
restart recipe.

## 2026-06-11 — #192 config-parse seam (parse_and_validate_config) + scope decision
Audited the remaining #192 work; only one piece was both safe and valuable, the rest is intentional or risky:
- **DONE:** extracted `parse_and_validate_config(config: str) -> Config` — the single parse+validate seam every
  endpoint shares, replacing the 11 scattered `Config.parse_raw` calls (server/main.py ×10 + batch_runner.py ×1)
  and migrating to Pydantic-v2 `model_validate_json` (`parse_raw` is deprecated, dropped in v3). Byte-identical
  for valid configs — `test/test_config_parse.py` pins `parse_and_validate_config(j) == Config.parse_raw(j)` (3
  cases: representative Backend config, identical-to-legacy, invalid-raises). Dropped the now-unused `Config`
  import from main.py; 11 call sites + 2 existing tests rewired.
- **DEFERRED (documented, NOT done):** `load_dotenv()` import side-effect (`manga_translator/__init__.py:5`) —
  moving it out of import is genuine import-order risk (submodules may read env at import) for low ROI (the test
  suite is already deterministic); the resume doc had already deferred it. Kept as-is.
- **NOT debt (investigated):** the 7 remaining bare `except Exception:` in manga_translator.py are all
  intentional broad catches — logging-never-crashes (×3), best-effort lang-detect fallback (×2), the
  `ignore_errors` policy (translate patch mode), best-effort bubble-seg tagging. Narrowing them changes
  semantics for negative value → documented, not changed. The env-lazy-read criterion is already met
  (`TranslatorConfig.translator` uses `default_factory`, read per-instance not at import — config.py:248).
- **S12** `PipelineParams` value-object stays separate (a god-object extraction, #187 territory; the risky #192
  bits that entangle it weren't done).
Branch `refactor/mit-192-config-parse-seam` off main. Validation: 5 config tests pass; full suite **353 / 18
pre-existing async / 0 new fail**. #192 advanced (single-parse-path + TODO/dead-field criteria met via this +
#192a/#192b); `load_dotenv` is the one documented remaining item.

## 2026-06-11 — #191 remove vendored SD/LDM inpainter + ctd/YOLOv5 detector (~14.4k LOC)
Investigated first (the issue's "decision" criterion), then the dev approved removal **conditional on not blocking the
MangaTranslator roadmap** — verified it doesn't: MangaTranslator uses Flux via `diffusers>=0.37` + ultralytics
YOLOv8/v11/v12, so our vendored CompVis-LDM + GPL-YOLOv5 are exactly the old baggage that roadmap replaces (removal
is roadmap-aligned, and we already pull `kitsumed/yolov8m_seg-speech-bubble` via #168/#170). Branch
`refactor/mit-191-drop-vendored-ldm-yolov5` off main.
- **SD/LDM** (deleted, ~11.7k LOC): `inpainting/ldm/**`, `guided_ldm_inpainting.py`, `inpainting_sd.py`, `sd_hack.py`,
  `booru_tagger.py` (SD-prompt-only, imported only by inpainting_sd), the 2 `guided_ldm_inpaint*_v15.yaml`. Rewired:
  dropped `Inpainter.sd` (config enum + `INPAINTERS`), `from .inpainting_sd import StableDiffusionInpainter`, the
  `<option value="sd">` in server/index.html, and `open_clip_torch` from requirements (SD-exclusive; kept
  kornia/einops/omegaconf/transformers — used elsewhere).
- **ctd/YOLOv5** (deleted, ~2.3k LOC incl. GPL): `detection/ctd.py`, `detection/ctd_utils/**` (confirmed ctd-exclusive —
  no other detector imports it). Rewired: dropped `Detector.ctd` (enum + `DETECTORS`) + the ctd import.
- Left `inpainting_attn.py` (dead but NOT ldm/sd — out of #191 scope, surgical).
Byte-identical for production (Backend sends `lama_large` + default/dbnet; `sd`/`ctd` never sent; Backend has zero
sd/ctd refs). Import smoke: registries build clean, no dangling imports — Inpainter `[default,lama_large,lama_mpe,none,
original]`, Detector `[default,dbconvnext,craft,paddle,none]`. `test/test_registry_trim.py` (4) pins the trim. Full
suite **357 / 18 pre-existing async / 0 new fail**. 56 files, **−14,405 LOC**.

## 2026-06-11 — #187 S12 PipelineParams value-object (the LAST god-object seam → #187 CLOSED)
Finishes the MIT god-object decomposition (#187): all S1-S26 seams now landed. S12 was deferred as "entangled
w/ device/using_gpu/raise — do after #192"; #192 closed, and on analysis the entanglement is a self-contained
method, so the extraction is byte-identical. Branch `refactor/mit-187-s12-pipeline-params` off main.
- `manga_translator/pipeline_params.py`: added `PipelineParams` dataclass (13 fields + `using_gpu` property) +
  `from_params(params, batch_concurrent)` classmethod — the verbatim extraction of `parse_init_params`'s field
  parsing, the device computation (`use_gpu`→device, gpu-limited promotion, `using_gpu` checks), the
  cuda/mps-availability raise, and the `batch_concurrent` auto-disable. Foot-guns kept verbatim: `kernel_size`
  has no default (`int(None)` raises if absent); the raise leaves an unusable half-built object either way
  (so moving the raise into `from_params` is byte-identical at the behaviour level). A `_is_gpu(device)` helper
  mirrors `MangaTranslator.using_gpu`.
- `manga_translator/manga_translator.py`: `parse_init_params` now delegates to `PipelineParams.from_params(
  params, self.batch_concurrent)` and assigns `self.X = pp.X` (13 fields). `MangaTranslator.using_gpu` property
  unchanged (still reads `self.device`).
- `test/test_pipeline_params.py`: +8 characterization cases (torch GPU availability monkeypatched) — cpu/cuda/mps
  device, gpu-limited promotion, raise-when-no-device, batch_concurrent auto-disable/keep, field passthrough.
TDD red→green: 8 new tests RED (AttributeError) → implement → GREEN. Validation: `test_pipeline_params.py` 11
pass (3 globals + 8 value-object); full suite **365 / 18 pre-existing async / 0 new fail**. One cosmetic delta:
the batch_concurrent warning now logs under the `pipeline_params` logger name (same message/level/effect).
**#187 CLOSED → MIT tech-debt category 6/6 complete** (#186/#187/#188/#191/#192/#193).

## 2026-06-12 — STORAGE_DRIVER config + render-parity dev-enablement + #168 SFX-OCR investigation
Three threads: (1) shipped a Backend storage-driver toggle, (2) discovered the whole render-parity feature set
was already built behind off-by-default knobs and enabled + verified it live, (3) root-caused why SFX ぬ→LOOM
doesn't render and hit a hard dependency wall on the local-VLM-OCR fix.

### 1. PR #222 (MERGED, main a7e7b3d→e9083ec) — `STORAGE_DRIVER` env: local-disk vs Cloudflare-R2
`Backend/src/common/storage/storage.module.ts`: the factory only auto-detected the backend from
`WORKER_URL`/`WORKER_SECRET` presence, so a dev with R2 creds couldn't force local disk. Added explicit
`STORAGE_DRIVER` (`disk`|`local` → DiskStorageProvider, forced even with R2 creds; `r2`|`cloudflare` →
CloudflareR2 with a clear missing-creds error; unset → original auto-detect, byte-identical). Extracted the
selection into a pure, env-injectable `createStorageProvider(env, logger)`. New `storage.module.spec.ts` 11/11.
Gate: CodeQL js-ts+python green, `/scrutinize` (bilingual, verdict ship — flagged one forward-looking
coordination item for @akkanop-x's incoming storage refactor: the `/r2-patches` URL-builder must key off the
*selected provider*, not raw `WORKER_URL`, or `STORAGE_DRIVER=disk`+`WORKER_URL` set = split-brain). Dev then set
`STORAGE_DRIVER=disk` → unblocks the One Punch-Man benchmark chapter (the R2-only #214 path is bypassed; the
uploaded page is served from local disk). Verified live: `[StorageModule] storage backend: local disk (driver=disk)`.

### 2. Render-parity — ALL knobs already built, just OFF; enabled in dev `.env` + verified live E2E
Discovery: #176/#179/#180/#181 (comic font, ALL-CAPS, bubble box-fit, 4× supersampling, hyphenation) were **all
already implemented** behind config knobs + Backend env flags (`MIT_EN_COMIC_FONT` / `MIT_EN_UPPERCASE` /
`MIT_BUBBLE_SEG` / `MIT_BUBBLE_AREA_FIT` / `MIT_SUPERSAMPLING` / `MIT_FONT_MAX_BOX_RATIO`), unit-tested in
`books-mit-config.spec` (26/26). The benchmark looked bad only because `Backend/.env` had none set. Enabled them in
dev `.env`; tuned `MIT_FONT_MAX_BOX_RATIO` 0.75→0.5 (0.75 oversized text, esp. the bottom-right panel) and kept SFX
off for the parity pass. Verified END-TO-END through the live tunnel (hayateotsu.space → One Punch-Man → Benchmark
Pipeline MIT → EN, Playwright-driven): comic font + ALL-CAPS + box-fill + hyphenation ("SOME-WHERE") all render;
patches served from local disk (no #214 ENOENT). Closes the bulk (~95%) of the gap vs MangaTranslator's
`example_translation.jpg`. **NOT committed** (dev `.env` only, per the dev's "enable in dev first" decision);
graduation to a committed Backend default is deferred (would change all translations + needs broader E2E).

### 3. #168 SFX ぬ→LOOM — root-caused, then blocked on a hard dependency conflict
SFX detector (AnimeText YOLO, gated repo, loads fine via `HF_TOKEN`) **does** detect the big stylized ぬ
(box 67,366–326,518) + 7 others; dedup correctly drops the 6 overlapping DBNet dialogue. Diagnostic via
`/translate/with-form/json` (per-region OCR+translation dump): of 8 SFX boxes, 7 become regions — フッ→"Heh."
renders fine — but **ぬ is the only box dropped**: the 48px line-OCR can't read the giant stylized glyph (garbage at
prob 0.03–0.08 → below floor → filtered before render). So ぬ→LOOM is an **OCR** problem, not detection. The earlier
"HMPH overlap" was font-size (ratio 0.75) — gone at 0.5 (json confirms 7 clean, non-overlapping regions).
- **MangaTranslator OCR conclusion:** its `ocr_method` = `LLM` (default — a vision-LLM reads the image) / `manga-ocr`
  (= our 48px) / `paddleocr-vl`. It reads stylized SFX with a **VLM**, not a line-OCR transformer. The no-API match
  = **PaddleOCR-VL-1.5** (`PaddlePaddle/PaddleOCR-VL-1.5`), a LOCAL VLM OCR (the "VLM-OCR" borrow flagged when we
  studied the repo).
- **BLOCKER:** PaddleOCR-VL-1.5 is **incompatible with MIT's transformers 5.9.0**. Its config is a transformers-4.55
  schema (flat, no `text_config`); the native 5.9 impl breaks on the missing `text_config`, and the remote `auto_map`
  code (4.55-era) breaks with `KeyError 'default'` (rope API changed 4.55→5.9). Both paths fail; downgrading
  transformers would break the rest of MIT's pipeline (built on 5.9). GPU headroom is fine (12 GB, ~5.7 GB free).
- **DECISION PENDING:** (a) try a transformers-5.9-native OCR-VLM (e.g. `GOT-OCR2_0`), (b) isolated OCR microservice
  in a separate venv (infra-heavy — rejected by the north-star for one glyph), (c) defer ぬ→LOOM, re-enable SFX at
  ratio 0.5 (フッ→Heh works), ship render-parity.

Throwaway diagnostics under `MIT/tools/`: `ab_tune.py`, `feas_paddle_ocr_vl.py`, `_bubble_proof/{regions_sfx.json,
parity2_*, sfx_*, tune_*, live_ratio05_nosfx.png}`. **No MIT production code changed this session** (investigation +
dev `.env` only).

## 2026-06-12 (cont.) — #168/#172 vision-LLM OCR rescue (built + OCR proven; render-path drop unresolved)
Built the no-API path to ぬ→SFX after a probe ladder ruled out the alternatives. **Key reframe:** ぬ→"LOOM" is
**contextual SFX localization** (a vision-LLM seeing the scene), NOT pure OCR — the glyph is just hiragana "ぬ";
"LOOM" is a creative localization. So a dedicated OCR (GOT-OCR2 → read ぬ as "X"; PaddleOCR-VL → blocked on
transformers 4.55-vs-5.9) is the wrong tool. **Decisive find:** the dev's existing translator gateway
(`custom_openai` / 9arm, `qwen3.6-35b-a3b`) **accepts images** — a 1-shot probe of the ぬ crop returned an English
SFX. So the clean copy of MangaTranslator's `ocr_method=LLM` idea is: re-OCR the regions the 48px loses via the
**same 9arm gateway** — no Gemini, no local VLM, no disk/GPU/VRAM cost (the disk hit 0.2 GB free this session).

- **`manga_translator/ocr_vlm.py` (new):** `vlm_localize_sfx(crop, *, api_base, api_key, model, post_fn=requests.post)`
  → POSTs the crop to the OpenAI-compatible vision endpoint, returns an UPPERCASE English SFX (`sanitize_sfx`); any
  failure → '' (degrades to stage-off). `post_fn` injectable so parse/sanitize is unit-tested with no network.
  Plus `restore_sfx_translations(regions)` — re-applies the rescued SFX after the translate stage (see below).
- **`config.py`:** `OcrConfig.vlm_rescue: bool = False` (off → byte-identical).
- **`manga_translator.py` (`_run_textline_merge`):** in the OCR drop-branch, when `vlm_rescue` is on and a large
  region (area ≥ 3600, min side ≥ 24 — SFX-sized) is about to be dropped, crop it from `ctx.img_rgb`, call
  `vlm_localize_sfx` with the `custom_openai` keys, and on a hit set `region.text = region.translation = rescued`,
  flag `region.sfx_rescued = True`, keep it. `_run_text_translation` calls `restore_sfx_translations` after
  `apply_translations` (the translator blanks an already-English word → would be dropped by
  `filter_translated_regions`).
- **Backend `buildMitConfig`:** `MIT_OCR_VLM_RESCUE=1` → `ocr.vlm_rescue: true` (+2 spec tests, 28/28).
- **Tests:** `test/test_ocr_vlm.py` **13** (sanitize, injected-HTTP contract, degrade-to-blank, restore). MIT
  suite **375 / 18 pre-existing async / 0 new fail**. `tsc` clean.

**Status — OCR layer works, render-path NOT done.** Confirmed on a clean worker: the rescue **fires** every run
(`[OcrVLM] rescued SFX region "X" -> "SLURP"` / "NUU" / "SQUELCH" — the model guesses a generic/phonetic SFX, not
the contextual "LOOM"; quality needs full-page context + prompt tuning). BUT the rescued region is **still dropped
before render** — `restore_sfx_translations` did not save it, and the original ぬ isn't inpainted. The exact drop
point (somewhere in translate → post-translation-check → `filter_translated_regions`, or the `sfx_rescued` flag not
surviving stage hand-off) is **unresolved** — tracing it through the worker HTTP loop failed because of the gotcha
below. Next: an **in-process** pipeline trace (no worker) to pin the drop, then fix + inpaint-mask for the SFX region.

**Infra gotcha that cost most of the session (now fixed + memoried):** the MIT `--start-instance` worker is
`python3.11.exe` (not `python.exe`), so `Stop-Process python` never killed it; an orphaned worker on `:5004` kept
serving OLD code so edits/`logger.info` had no visible effect. **Restart by killing the PORT OWNER on 5003 AND
5004** until both report free, then relaunch. See `.claude/memory/project_mit_worker_restart_gotcha.md`.

Files: `manga_translator/ocr_vlm.py`, `test/test_ocr_vlm.py`, `config.py` + `manga_translator.py` edits;
`Backend/src/books/books.service.ts` + `books-mit-config.spec.ts`; harness `MIT/tools/{ab_vlm.py, probe_got_ocr2.py,
probe_qwen_vl_sfx.py}`. NOT committed yet (OCR layer is a clean, tested foundation pending the render-path fix).

## 2026-06-12 (cont.) — Root-cause: why MIT text-removal (inpaint) is less clean than upstream zyddnys
ultracode fan-out (6 agents, ~510k tokens) compared MIT vs the cloned upstream
`manga-image-translator-Original` at file:line, no black boxes. **Verdict: the entire cleanliness gap is on the
input/output side of an UNMODIFIED LaMa — the MIT-only patch path (`translate_patches`), not the model/precision or
core mask/CRF code** (those are byte-identical between repos). Upstream has no patch mode; it inpaints the full page
once. Ranked causes: **(1, biggest)** blocky `text_only_mask` union `cv2.max(...)` (`patch_renderer.py:110`) ORs a
dilated rectangular mask onto the tight CRF mask → LaMa erases a fat halo of background → smeared/destroyed art next
to bubbles; (2) context starvation — tight 120px crop vs full-page → LaMa can't copy clean background → blurry fill;
(3) hard rectangular opaque composite (no alpha feather) → seam/tone-step around every bubble (= issue #173);
(4) `inpainting_size=1536` vs upstream/Config default 2048 → ~56%-area fill then upscaled → soft smudge;
(5) bilinear mask resize `INTER_LINEAR` in `crop_mask_for_patch` → blurred mask edges; (6) pydensecrf soft-fail
(dormant in dev — installed). Fixes ranked by ROI (all keep LaMa/light-HW): tame the union → 2048 → INTER_NEAREST →
alpha feather (#173) → larger context crop → pin pydensecrf. **Full report + file:line + fix table:
`docs/research/inpaint-cleanliness-vs-upstream.md`.** **Issues published 2026-06-12:** #248 (tame mask union +
INTER_NEAREST), #247 (raise detection_size 2560 + inpainting_size 2048), #249 (larger context crop, blocked-by
#247), #251 (harden pydensecrf); #173 AMENDED with MIT-side file:line evidence. The user handles storage separately.

## 2026-06-12 (cont.) — No-black-box scan: every MIT-vs-upstream divergence that LOWERS translation quality
ultracode fan-out (8 agents, ~748k tokens) compared MIT vs the fork-parent `manga-image-translator-Original`
across the WHOLE pipeline at file:line. **Throughline: MIT's patch mode (`translate_patches`) is the root, but
cropping itself only hurts RENDER; the real losses are translation cross-page context + two Backend config knobs
below MIT's own tuned defaults.** Ranked: **(1)** cross-page rolling context DEAD — `translate_patches` calls
`reset_page_context()` per page + never persists (`manga_translator.py:1408`), so names/honorifics/pronouns drift
page-to-page (upstream joins all batch pages into one prompt); **(2)** `detection_size=2048` vs MIT's own default
2560 (`books.service.ts:640`) → misses small/faint text → stays untranslated; **(3)** `inpainting_size=1536` vs
2048 → blurrier erase; **(4)** renderer font floor `(h+w)/200` computed on the CROP not page → ~3-4px floor →
unreadably small text on the fallback render path; **(5)** `context_size` never enabled (corollary of #1);
**(6)** few-shot langcodes→dict lookup (narrow, NOT in prod — THA/ENG map cleanly). **Config quick-wins (zero
code):** `MIT_DETECTION_SIZE=2560` + `MIT_INPAINTING_SIZE=2048` recover the two biggest default-mode losses.
**Structural (small):** page-scaled font floor in patch mode + thread rolling cross-page context (= the PRD
#155/#159 context-aware work). **NOT the cause (byte-identical, don't chase):** OCR (prob=0.03 RECOVERS text),
detection algorithm, textline-merge, default render path (#189/#190 preserved behavior), mask/inpaint core,
series_context (a bonus upstream lacks). **Full report: `docs/research/mit-vs-upstream-quality-divergence.md`.**
**Issues published 2026-06-12:** #247 (config: detection 2560 + inpaint 2048), #250 (page-scaled font floor in
patch mode); #159 AMENDED with the prod root-cause (`reset_page_context`/`context_size` dead) = PRD #155/#159.
few-shot regional fallback (#6) not filed — no live impact (THA/ENG).

## 2026-06-13 — #247 raise MIT config defaults (detection_size 2560 + inpainting_size 2048)
First of the quality-issue batch (#247→#251) drawn from the two divergence studies. Backend `buildMitConfig`
shipped `detection_size=2048` / `inpainting_size=1536` — **below MIT's own tuned Config defaults (2560/2048)** —
silently dropping small/faint glyphs below DBNet's threshold (~36% fewer px → original JP left untranslated) and
downscaling pages before the LaMa erase then upscaling back (blurrier plate / screentone smear). Raised both
`books.service.ts` fallbacks to the tuned defaults + refreshed the JSDoc; **env (`MIT_DETECTION_SIZE` /
`MIT_INPAINTING_SIZE`) still overrides** so a VRAM-tight host can drop them (it IS a quality cut — raise where the
GPU allows). TDD: updated 3 default assertions in `books-mit-config.spec.ts` (RED 3 fails → GREEN 26/26); the
env-override + invalid-env-fallback tests prove overridability survives. Full books suite: **148 pass / 16
pre-existing pubsub-batch fails / 0 new**. Pure config — no LaMa/model change, render byte-identical when env pins
the old values. Branch `fix/mit-config-defaults-247`. Also lands the two analysis docs
(`docs/research/{mit-vs-upstream-quality-divergence,inpaint-cleanliness-vs-upstream}.md`) that justify the batch.
Visual before/after E2E is batched after the inpaint cluster (#248/#173/#249) — they change the same rendered
output, so one benchmark validates the whole cluster instead of spinning the ML stack per tiny config PR.

## 2026-06-13 — #248 tame the patch inpaint mask — drop the blocky text_only halo + nearest-neighbor resize
The **#1 inpaint-cleanliness cause** (`docs/research/inpaint-cleanliness-vs-upstream.md` root cause #1 + #5). Two
MIT-only patch-path steps fattened/blurred the mask handed to the byte-identical LaMa, which only edits `mask=1`
pixels — so a fat mask forced LaMa to erase + re-synthesise a halo of clean background around every glyph,
destroying screentone/line-art next to bubbles. **Fix (pure, keeps LaMa / light-HW):** (1) `patch_geometry.py`
`crop_mask_for_patch` mask resize `INTER_LINEAR`→`INTER_NEAREST` — a binary mask bilinear-upscaled then `>0`
re-binarized fattens edges (a 2× upscale of one pixel lights 16 px vs nearest's 4, verified empirically). (2) new
pure `union_refined_with_fallback(refined, text_only)` (replaces `cv2.max` at `patch_renderer.py`) — keeps the tight
CRF mask everywhere it has coverage, falls back to the dilated `text_only_mask` only in connected components the
refinement missed entirely, so glyphs CRF dropped are still covered (no residue) without a halo where it succeeded.
Wired into `patch_renderer.py` (dropped the now-orphan `cv2` import). **Did NOT touch** LaMa model/precision or the
CRF/mask-refinement algorithm — byte-identical to upstream, not the cause. TDD: 3 new golden-numpy tests in
`test_patch_geometry.py` (halo-dropped: `out[6,6]==0` where `cv2.max` would paint 255; missed-region fallback;
nearest-resize == 4 px) — RED 2 → GREEN; INTER_NEAREST pinned (== 4, bilinear would == 16). Full MIT suite **369
pass / 18 pre-existing async fails / 0 new**; `test_patch_renderer` green (wiring intact). Branch
`fix/mit-inpaint-mask-248`. Provenance registered in PIPELINE.md §5 (S24a/S24b now diverge — no longer
byte-identical). Visual before/after E2E batched with the inpaint cluster (#173/#249).

## 2026-06-13 — #173 patch-seam edge feathering (distance-transform alpha ramp)
Inpaint-cleanliness cause #3 (`docs/research/inpaint-cleanliness-vs-upstream.md`): each translated region is
composited as a rectangular PNG patch; against screentone the straight edge reads as a visible rectangle (the #156
class of complaint). MangaTranslator avoids it with a distance-transform alpha ramp at the patch edge. Added an
**opt-in** feather across 3 vertical slices (TDD): **(1)** pure `feather_alpha(content_mask, radius)` in
`patch_geometry.py` — `alpha = clip(1 - d_out/radius)` (EDT outside content), opaque on content, fading to 0 over
`radius` px; `radius<=0` → hard alpha. 2 golden-numpy tests (interior opaque, band fade 0<a<255, beyond=0; radius-0
hard). **(2)** `encode_patch_png` gains an `alpha` param → encodes **RGBA**, or **`LA`** when a GRAY ICC must stay
honored (so #156 color-management AND the feather coexist); absent → byte-identical. 2 tests in `test_patch_png`.
**(3)** `RenderConfig.patch_feather_radius: int = 0` + `patch_renderer` border-fades the outer band of each patch
when radius>0 (feathers an eroded-rectangle so the **≥120px crop margin keeps the fade off rendered text** — no
clipping, no patch-count change) and threads the alpha to the encoder; Backend `buildMitConfig` emits
`render.patch_feather_radius` from `MIT_PATCH_FEATHER` (posIntEnv, 0/unset → omitted). 2 Backend spec tests
(`books-mit-config` 26→28). No frontend change — the Reader overlay is already a transparent `<img>`. Full MIT suite
**373 pass / 18 pre-existing async / 0 new**; Backend mit-config 28/28. Branch `feat/mit-patch-feather-173`.
Provenance in PIPELINE.md §5 (config.py row, patch_png, S24a/S24b). Visual before/after E2E batched with the inpaint
cluster (#249).

## 2026-06-13 — #249 larger inpaint context crop for the LaMa patch path
Inpaint-cleanliness cause #2 (`docs/research/inpaint-cleanliness-vs-upstream.md`): the patch path inpaints a tight
crop (bbox + 120px), starving LaMa's FFC global branch of clean background to copy → blurry/averaged fill. Now
LaMa gets a wider receptive field WITHOUT enlarging the rendered patch: **(1)** pure `expand_inpaint_crop(x1,y1,x2,
y2,img_h,img_w,pad)` in `patch_geometry.py` returns the render rect grown by `pad` (clamped) + the render-rect offset
`(ox,oy)` inside it. **(2)** `patch_renderer` (when `inpainter.inpaint_context_pad>0`) slices a larger image crop,
places the render-crop mask into a larger zero-mask at `(ox,oy)`, runs `_run_inpainting` on it, then slices the
result back to the render rect (output size == input, LaMa restores it). `InpainterConfig.inpaint_context_pad: int=0`
(0 → tight crop, byte-identical). Backend emits `inpainter.inpaint_context_pad` from `MIT_INPAINT_CONTEXT_PAD`
(posIntEnv). **Blocked-by #247** (needs inpainting_size 2048 so the larger crop isn't downscaled) — now satisfied.
TDD: 2 pure `expand_inpaint_crop` tests (interior pad / edge-clamp) + 1 integration in `test_patch_renderer`
(FakeDriver records inpaint sees a 490×490 crop while the patch dict stays the 290×290 render rect — slice-back
proven without ML). Full MIT suite **373 pass / 18 pre-existing async / 0 new**; Backend mit-config **30/30**.

### ✅ E2E — Full-stack Reader via cloudflared tunnel (2026-06-13)
First per-issue Playwright E2E run end-to-end through the live stack (per `feedback_test_every_round`). **Stack:** MIT
worker restarted on the new code (front 5003 + worker 5004, custom_openai/9arm; killed the stale 5003+5004 by PORT
OWNER per the restart gotcha) · Backend :4001 · Frontend :4000 · **cloudflared tunnel → `hayateotsu.space`** ·
cache reset (L3 + patches). `.env` set `MIT_PATCH_FEATHER=16` + `MIT_INPAINT_CONTEXT_PAD=256` (det/inpaint sizes
unpinned → #247 defaults 2560/2048 active; #248 always-on). **Flow:** Playwright (real browser, tunnel domain) →
search "One-Punch" → One Punch-Man → "อ่านตอนที่ Benchmark" (the team's 1-page ぬ-SFX benchmark chapter) → reader
opened anonymously (overlay, no login) → translate toggle → **→ EN** → "แปลหน้านี้" → ~50s pipeline → captured.
**Result** (`e2e-249-after-benchmark-click.jpeg` original ↔ `e2e-249-reader-EN.jpeg` translated; direct-render
companion `MIT/_e2e_249_cluster.png`): inpaint/text-removal **clean — no halo, no rectangular patch seam**; text
fits the bubbles; cluster #247/#248/#173/#249 validated live. **Remaining gap vs the MangaTranslator target:** the
big ぬ renders as JP, not "LOOM" — that is **#168** (vision-OCR SFX rescue, parked in `git stash`), not a cluster
regression. Per-issue Playwright-via-tunnel E2E is now the standing workflow.

## 2026-06-13 — #250 page-scaled font floor in patch mode
Quality regression #4 (`docs/research/mit-vs-upstream-quality-divergence.md`): the renderer's auto font floor
`(img.h+img.w)/200` is computed on the small patch crop (~300×400 → ~3-4px), not the page (~16px), and the config
default `-1` is never overridden in prod. On the **fallback render path** (vertical / occupancy>1 / no-balloon / SFX)
text renders unreadably small. Fix: **pure `page_scaled_font_min(img_h, img_w, existing)`** in `patch_geometry`
(`max(existing, round((h+w)/200))`); `PatchRenderer.__init__` floors `config.render.font_size_minimum` to it on a
**per-request `copy.deepcopy`** (guarded `page_min > existing`, so an explicit larger override is kept and the shared
/ full-page `_translate` config is never mutated). Patch-mode only (this driver); the bubble-fit path already bypassed
the floor. TDD: 2 pure (`page_scaled_font_min`: page value 17 on 2000×1400; keep-larger-override) + 2 wire in
`test_patch_renderer` (floor applied on a copy + input unmutated; explicit 40 kept). Full MIT suite **380 pass / 18
pre-existing async / 0 new**.

### E2E (direct render on the benchmark page, #250 worker code)
`MIT/_e2e_250_fontfloor.png` — narration/fallback-path text (the top-left & top-right boxes) renders a touch larger /
fills its box better than the #249 baseline; inpaint still clean; no regression (ぬ still JP = #168). Used the fast
direct-render path for this subtle font-floor refinement — the **full Reader/tunnel E2E was validated for the cluster
(#249)** and is reserved for #168 (the high-visual-impact ぬ→LOOM change). Provenance in PIPELINE.md §5.

## 2026-06-13 — #251 harden pydensecrf fallback (warn-once + build-critical flag)
Latent inpaint defect #6 (`docs/research/inpaint-cleanliness-vs-upstream.md`): `refine_mask` returns the **raw
(un-CRF'd) mask** if `pydensecrf` import fails (`text_mask_utils.py:68-78`) → mask doesn't tighten to glyph strokes →
faint leftover text residue. **DORMANT in dev** (pydensecrf 1.0 IS installed) but a worker image missing the dep
would degrade text removal **silently**. Fix: **warn once** (module `_warned_no_crf` flag + `logging.getLogger`) when
the fallback fires, so a missing-dep deploy is visible instead of silent; raw-mask passthrough unchanged when the dep
is present (dev path byte-identical). Flagged `pydensecrf` build-critical in `requirements.txt` (already installed by
the Dockerfile's `pip install -r requirements.txt:19`, so it ships in the worker image — kept the working master
archive rather than risk a bad SHA-pin on the effectively-frozen upstream). TDD: 1 test in new
`test/test_text_mask_utils.py` (monkeypatch `PYDENSECRF_AVAILABLE=False` → raw passthrough + warns exactly once over
two calls; no ML). No E2E — dormant in dev, zero render change (the warn branch never fires when the dep is present).
Provenance in PIPELINE.md §5.

## 2026-06-13 — #168 vision-OCR SFX rescue render-path FIXED (ぬ→SQUELCH) — benchmark SFX gap closed
The parked render-path bug is **solved**. The vision-OCR rescue (`ocr_vlm.py` + the `_run_textline_merge` wire) had
localized the big ぬ to an English SFX, but the rescued region was **dropped before render** — the prior session
chased it via worker-HTTP and never pinpointed it. **Root cause (found via the code, not worker-HTTP per the memory
rule):** `filter_translated_regions` (`region_filter.py`) drops a region when `region.text == region.translation`
("Translation identical to original"). The rescue sets **both** `text` and `translation` to the same English SFX
("SQUELCH"), so it tripped that check and was filtered out — the prior fix only handled the *blank* check, not the
*identical* check. **Fix:** exempt `sfx_rescued` regions from the filter (keep them when their translation is
non-blank) — one guard at the top of the loop. The rescued region already carries detection `lines`, so once it
survives, `create_text_only_mask` masks it and the original ぬ art is inpainted out (no extra mask wiring needed).
TDD: 2 tests in `test_region_filter` (rescued text==translation survives; blank-rescued still dropped) — RED on the
identical-survives case → GREEN. Full MIT suite **394 pass / 18 pre-existing async / 0 new**.

### ✅ E2E — direct render through the live #168 worker (det_sfx + ocr.vlm_rescue, production config)
`MIT/_e2e_168_sfx.png`: the big ぬ now **renders as a large "SQUELCH"** in place, and **the original ぬ art is erased**
(inpainted) — exactly the MangaTranslator-target treatment of the SFX (theirs reads "LOOM"; ours "SQUELCH" — a
different vision model reading the same glyph, functionally equivalent). Worker log confirms the full path:
`[OcrVLM] rescued SFX region "X" -> "SQUELCH"` → translator keeps `SQUELCH` → survives the filter → rendered + erased.
**This closes the last visible benchmark gap** (the cluster #247-#251 already matched inpaint cleanliness / seam /
fit). In-app Reader re-translate was blocked by the frontend's cached-translation state (multi-layer cache; the app
offered "ดูฉบับแปล" of the stale pre-#168 translation rather than re-running) — the full Reader/tunnel path itself
was validated for the cluster (#249), and the direct render here is conclusive (same MIT worker, production config).
`.env` enabled `MIT_SFX_DETECTOR=1` + `MIT_OCR_VLM_RESCUE=1`. Provenance in PIPELINE.md §5.

## 2026-06-13 — #159 rolling cross-page context within a Batch Job (the Translation Session, PRD #155/P2)
Quality regression #1 vs upstream (`mit-vs-upstream-quality-divergence.md`): the patch path's per-page worker reset
killed cross-page context, so names/honorifics/pronouns drifted page-to-page. **Now the Batch Job carries recent
pages' dialogue into the next page's prompt** — opt-in, born-and-dies-with-the-loop (the worker's per-request reset
stays, so the #136 bleed class is structurally impossible). 4 TDD slices:
1. **`server/rolling_context.py` `RollingContext`** (stdlib-only, lives with the batch loop): `add_page` / `render_block`
   → upstream numbered `<|n|>sentence` block, bounded by **page cap** (`max_pages`, 0 disables) + **char cap** (drops
   oldest lines so the local tokenizer never truncates the real queries). 5 pure tests (order, page cap, char cap,
   numbered format, disabled/empty).
2. **`TranslatorConfig.prev_context`** + `chatgpt_config` merges it next to `series_context` — the same #157 carriage
   point; **`config_gpt.chat_system_template` appends it** so every GPT-family translator (ChatGPT, Qwen3, Gemini,
   DeepSeek, **custom_openai**) carries it. 4 tests (config merge, coexist with series, absent→None, template append).
3. **`batch_runner`**: a `RollingContext` per Batch Job (env `MIT_CONTEXT_PAGES`/`MIT_CONTEXT_MAX_CHARS`); seeds each
   page via `_translate_page(..., prev_context=…)` (only when non-empty → the disabled call is byte-identical) and
   accumulates the page's translated `dst` after. 2 tests (page N+1 carries page N's text + numbered format;
   env unset/0 → `prev_context` never injected, byte-for-byte).
4. **Single-page `_translate` untouched** (rolling context is the batch loop's local state; single path keeps
   series_context only, per PRD).
**Verified end-to-end on the REAL production translator** (`custom_openai`/9arm): `TranslatorConfig(prev_context=block)`
→ `chat_system_template` contains the block; absent → unchanged. Full MIT suite **405 pass / 18 pre-existing async /
0 new**. No visual E2E — #159 is translation *consistency* (not a render change); the prompt-assembly is proven against
the real translator + the multi-page name-consistency demo is the operator validation when `MIT_CONTEXT_PAGES>0`.
Branch `feat/mit-rolling-context-159`. Provenance in PIPELINE.md §5. **Closes the MIT quality batch
(#247-#251, #168, #159).**

## 2026-06-13 — Anti-overlap text layout + render-fidelity tuning (user feedback vs MangaTranslator target)
User compared our in-app render to the MangaTranslator target and flagged 3 gaps: **(1) text overlaps** between
adjacent bubbles, **(2) font too big** (overflows bubbles), **(3) weight too heavy** (no match to the original).
Root cause found by reading both: MangaTranslator uses a **small absolute font** (dialogue 8-16px, SFX 10-64px,
`core/config.py`), while ours `bubble_area_fit` (#166) sizes text to *fill* the balloon → oversized + spills + overlaps,
and `comic shanns 2` is heavier than the target's Anime Ace.
**New feature — anti-overlap text layout** (the user's idea: compute overlap from the detected text positions):
`render_overlap.clamp_box_to_neighbors(box, others, margin)` (pure stdlib geometry) shrinks a region's render box so
it can't grow into a neighbour's territory — separating along the axis of **least penetration** and pulling only the
edge facing each neighbour. Wired into `rendering/__init__.py` **both** paths: bubble-fit (clamp the fit box → font fit
to it) and the fallthrough (clamp the warped `dst_points` → the homography shrinks the text). Gated by
`RenderConfig.anti_overlap` (Backend `MIT_ANTI_OVERLAP`); off → byte-identical. Upstream even left a `# TODO: Maybe
remove intersections` at the render loop — this realises it. TDD: 8 pure `test_render_overlap` (no-neighbour,
disjoint, each-side clamp, margin, multi-neighbour) + updated `test_stages` kwargs-forward. Full MIT suite **413 pass /
18 pre-existing async / 0 new**. **Verified via direct render on the benchmark:** `bubble_area_fit OFF` +
`anti_overlap ON` + `en_font=anime_ace_3.ttf` → dialogue small & inside its bubble (no overlap), SFX still big,
lighter weight — closely matches the target (`MIT/_e2e_overlap2.png`). `.env` set `MIT_ANTI_OVERLAP=1` +
`MIT_EN_FONT=anime_ace_3.ttf` + `MIT_BUBBLE_AREA_FIT` off. Branch `feat/mit-anti-overlap-render`. Provenance in
PIPELINE.md §5.

## 2026-06-13 — Narration font cap (no-bubble caption/narration was still oversized/overflowing)
After the anti-overlap fix, the user flagged that **no-bubble narration** (e.g. "THIS BRAT STILL DOESN'T REALIZE WHAT
HE DID") still rendered too big and overflowed its panel. Root cause: a narration's JP detection box is tall/narrow
(vertical source), and the fallthrough's **length-ratio box scaling** enlarges it for the longer English, then the
homography warps the text up to fill the enlarged box → an oversized block. Fix (two levers, both gated by
`RenderConfig.font_size_max`, SFX exempt): **(1)** pure `render_overlap.apply_font_cap(size, cap, is_sfx)` caps the
non-SFX render font; **(2)** in `rendering/__init__.py`, when a cap is set, **stop the length-ratio `final_scale` from
enlarging the non-SFX box** — the long translation then wraps inside the source box (narrow column) instead of
overflowing. SFX stays big (exempt), so ぬ→GULP/SQUELCH is unaffected. Backend `MIT_FONT_SIZE_MAX`; 0 → no cap,
byte-identical. TDD: 3 `apply_font_cap` tests (cap / SFX-exempt / disabled) + updated `test_stages` kwargs. Full MIT
suite **416 pass / 18 pre-existing async / 0 new**. **Verified via direct render** (`MIT/_e2e_cap2.png`, `font_size_max=20`):
narration now small & inside its panel, dialogue small & no overlap, SFX still big — matches the MangaTranslator target.
Winning config = `bubble_area_fit OFF` + `anti_overlap ON` + `en_font=anime_ace_3.ttf` + `font_size_max≈20`. `.env` set
`MIT_FONT_SIZE_MAX=20`. Branch `feat/mit-narration-font-cap`. Provenance in PIPELINE.md §5.

## 2026-06-13 — Backend: patch cache key now includes a render-config hash (stale-render bug)
While iterating on the render knobs, every in-app re-translate kept serving the **previously-rendered patches** — the
patch cache key `translate:manga-patches:v6:<chapterId>:<page>:<src>:<tgt>:<model>:<derivative>` (`books.service.ts:549`)
**did not include the MIT render/pipeline config**, so toggling a `.env` knob (font, anti-overlap, font_size_max, sizes,
SFX, …) never invalidated the cache → the live `Cache HIT` replayed the old image (confirmed in the backend log), and
`cache:reset` also missed the HD/ENG entry. Fix: bump the key to **v7** and append `renderConfigHash()` — a 10-char sha1
of every `MIT_*` env knob (sorted). A config change now yields a different key → cache miss → the new render is visible
on the next translate; two deployments with different settings no longer collide. `cache:reset` still matches
(`translate:manga-patches:*`). TDD: 1 spec (toggling `MIT_FONT_SIZE_MAX` → different key) + `:v6:`→`:v7:` in the existing
assertion; `books-image-model.spec` **9 pass**. Branch `fix/backend-cache-key-config`. This was the root cause the
render fixes (#260/#261 + the `.env` config) looked like they "did nothing" in the Reader.

## 2026-06-13 — Render-layout rework: clean horizontal layout (the proper narration/dialogue-sizing fix)
The font-cap (#261) was a fragile patch: the renderer **warps** the translated English onto the original detection quad,
and a JP narration/column quad is tall & vertical, so horizontal English stretched onto it comes out oversized,
overflowing, and badly line-broken — no knob (cap, area-fit, ratio) fixes this cleanly because the distortion is the
warp itself. **Root-cause fix (ported from MangaTranslator's approach):** for non-balloon, non-SFX regions, stop warping
onto the source quad — instead **lay the translation out as an upright horizontal block at a small absolute font, wrapped
to a compact width, placed on the region's centre**, so the homography in `render()` is a plain scale (no shear/stretch).
Two pure helpers in `render_overlap.py`: `centered_box(cx,cy,w,h)` (axis-aligned 4-point box) + `clean_wrap_width(bw,bh,
img_w)` (wrap a vertical column to its wider extent, clamped 10–45% of the page). `rendering/__init__.py` gains
`_clean_layout_dst()` (font = `font_size_max` if set, else page-scaled; `calc_horizontal` → block dims) and a new path in
`resize_regions_to_font_size`, after bubble-fit, before legacy. SFX exempt (keeps the big stylized path); balloons still
use bubble-fit. Gated by `RenderConfig.clean_layout` (Backend `MIT_CLEAN_LAYOUT`); off → byte-identical. With
`clean_layout` ON, `font_size_max` becomes the clean absolute font and no longer backfires (the region returns before the
legacy `final_scale` path). TDD: 2 pure helper tests (`centered_box`, `clean_wrap_width`) + updated `test_stages` kwargs;
**full MIT suite 418 pass / 18 pre-existing async / 0 new**. **Verified via direct render** (`tools/ab_clean.py` montage
`[original | warp | clean | reference]`): narration "WHAT SHOULD I DO… HIDE HIM SOMEWHERE…" now small/multi-line/inside its
panel, dialogue small & wrapped inside the bubbles, SFX still big (MELT/LOOM) — clean column matches the MangaTranslator
reference; the warp column shows the old oversized/overflow. One bug fixed mid-cycle: `calc_horizontal`'s `max_height` is
required-positional — the first run raised `TypeError` and `_run_text_rendering` fell back to an inpaint-only (textless)
patch; passing `max_height=page_h` fixed it. `.env` set `MIT_CLEAN_LAYOUT=1` + `MIT_FONT_SIZE_MAX=20`. Branch
`feat/mit-clean-text-layout`. Provenance in PIPELINE.md §5.

## 2026-06-13 — Clean layout: wrap to the source footprint (line-breaks now reference the original)
Follow-up to #263: the user flagged that the clean-layout line-breaking still didn't reference the original — our
narration reflowed into a wide novel-like paragraph while both the source (narrow vertical-JP columns) and the
MangaTranslator target wrap into a **narrow tall column**. Root cause: `clean_wrap_width` wrapped to the region's
**wider** extent (`max(bbox_w, bbox_h)`), turning a tall column into a wide block. Fix: wrap to the region's **own bbox
width** (`ref_w = x2-x1`) so the English breaks where the source columns did — narration stays narrow/tall, and the
floor rose 8%→**11%** of the page so a short dialogue column still fits ~2 words a line (with hyphenation) instead of
one. The balloon width is deliberately NOT used as the reference (narration boxes also get a wide `bubble_box` from
segmentation, which would re-widen them). `clean_wrap_width(ref_w, img_w)` (dropped the unused `bbox_h` arg). TDD:
updated the 3 `clean_wrap_width` cases; render_overlap 13 pass, full MIT suite 418 pass / 18 pre-existing async / 0 new.
**Verified via direct render** (`tools/ab_clean.py`): narration now a narrow column, dialogue ~2 words/line with
hyphenation (e.g. "IT'S NOT MY BUSI-NESS, SO SHOULD I JUST LEAVE IT ALONE?") — both reference the original line-breaks,
matching the target much more closely. Branch `fix/mit-clean-wrap-narrow`. Provenance in PIPELINE.md §5.

## 2026-06-13 — Patch-mode full-page inpaint (clean text removal over complex art — the last gap)
User flagged the only remaining gap: text removal wasn't clean — a **gray blob** where large stylized JP text
("そうだよどうでもいい事じゃねーか") sat over the character's dark hair (bottom-right panel), and pointed at the upstream
`manga-image-translator-Original` which erases just as cleanly as the MangaTranslator target. Investigation (upstream
mask+inpaint vs ours): the upstream and our own **full-page** path inpaint the WHOLE page at once, so LaMa's FFC global
branch has full-page context and reconstructs the hair cleanly. Our **patch path** inpaints tiny per-region crops (even
with the #249 256px context-pad) → LaMa is starved of context → fills the big hole with averaged gray. Proven by A/B:
our `/translate/with-form/image` (full-page) erases the same region cleanly with the **same mask**, while the patch path
left the blob — so it's **context, not the mask** (CRF mask + pydensecrf are present and identical to upstream). Fix:
`InpainterConfig.full_page_inpaint` (Backend `MIT_PATCH_FULLPAGE_INPAINT`) — `translate_patches` inpaints the whole page
ONCE (mask refine all regions + `union_refined_with_fallback` + one LaMa pass), and `PatchRenderer` slices each patch's
clean background from it, skipping the per-crop mask refinement + inpaint. One inpaint per page (often **faster** than N
per-group inpaints). Off → per-crop, byte-identical. TDD: `test_patch_renderer` gains a case (full_inpainted supplied →
`driver.calls == ['render']`, bg = the slice); render_overlap/stages green, **full MIT suite 419 pass / 18 pre-existing
async / 0 new**. **Verified via direct render** (`tools/ab_clean.py` + new `tools/ab_fullpage.py`): the bottom-right hair
is now clean dark, no gray blob, English text intact — matches the full-page/upstream/target. `.env` set
`MIT_PATCH_FULLPAGE_INPAINT=1`. Branch `fix/mit-patch-fullpage-inpaint`. Provenance in PIPELINE.md §5.
## 2026-06-14 — Backend god-file decomposition: carve MIT translation out of books.service.ts (#233 + #234)
Continued the `Backend/src/books/books.service.ts` god-object decomposition (PRD #228). Two services carved out, every seam byte-identical except one isolated behaviour fix:
- **#233 `MitTranslationService`** — the single-page MIT path (`translateMangaPagePatches` + the startup-retry loop), the MIT health check, and the image-translator probe. Injects `MitClient` (#230) + the #229 pure helpers + BooksService's shared `persistPage`/`seriesContextFor` as callbacks; with MitClient faked the single-page path is unit-testable for the first time (cache hit / retry loop / ECONNREFUSED→unavailable / abort).
- **#234 `MitBatchOrchestrator`** — the batch (full-chapter) state machine (registry, start/attach, stream-run, retry, webhook callback, listener-remove, progress-notify). Landed as sub-seams: **S5a** dropped the dead Redis pub/sub (subscribe side was a no-op; single-node) + ADR-002 + retired `books-pubsub-batch.spec.ts` (which was all 16 pre-existing baseline failures → baseline now 0 fail); **S5b** unified 3 fan-out blocks into one `deliver()`; **S5c** unified the 2 completion sites into one `maybeComplete()`; **S5-pre** moved the pure MIT helpers to `mit-config.ts`/`mit-lang-map.ts` (breaking a value-import cycle before the carve); **S5e** carved the orchestrator; **S5d** fixed a latecomer-listener leak on job reject (timeout/abort) + centralised teardown into `finalize()` (the only non-byte-identical step — own commit + red→green repro test).

`books.service.ts` **1834 → 841 lines** (god file more than halved). New unit-testable modules: `mit-translation.service.ts`, `mit-config.ts`, `mit-lang-map.ts`, `mit-batch-orchestrator.service.ts`. Method: byte-identical, characterization-first, 1 seam = 1 commit; every seam verified `npm run build` (whole backend) + the books characterization net. **Full backend suite 513 pass / 0 fail** (was 192 pass / 16 fail). Code-reviewed (5-agent fan-out for #233+S5a–c; exact byte-comparison self-review for the carve) → **0 correctness bugs**; all 7 moved helpers + 8/9 batch methods proven byte-identical modulo prettier trailing-commas. Branch `dept/backend` (12 commits, not yet pushed). Issues #229/#230/#232/#233/#234 left open — close on merge to main. Impact report: `docs/reports/system-impact-report.md` (2026-06-14).

## 2026-06-14 — Backend god-file decomposition: split Catalog/Landing/Gemini out of books.service.ts (#231, PRD #228 step 6)
Completed PRD #228 (the `books.service.ts` god-object decomposition). Step 6 carved the three non-MIT domains into focused, unit-testable units, one seam = one commit, byte-identical (one intended dedup):
- **6a `GeminiModelCatalog`** (`gemini-model-catalog.ts`) — model-selection state + availability catalog (memory→cache→provider API, 1-hour TTL) + per-purpose candidate filtering, with **injected env + clock** so selection is deterministic without `process.env`/wall-clock. BooksService keeps `getMangaModels`/`getDescriptionModels` delegators (the books-models spy on `getMangaModels` still observes the facade). 6 cases.
- **6b `MangaCatalogService`** (`manga-catalog.service.ts`) — the 6 MangaDex passthroughs + `searchBooks` + the `chapter_versions` alt-name lookup (deps: mangaDex, supabase, cache). No redundant wrapper over MangaDexService — it owns real search/alt-name logic. 5 cases.
- **6c `LandingService`** (`landing.service.ts`) — landing assembly (cache→rows→image-cache enhancement) + description + manga-episode Gemini text translation; the **two duplicated stale-cache fallback blocks collapse into one `serveStale()`** (the only behaviour-preserving cleanup). 6 cases.

`books.service.ts` **841 → 376 lines** (god file quartered from its 1834 start; now a thin facade — every public signature unchanged, controllers/call-sites untouched). New unit-testable modules: `gemini-model-catalog.ts`, `manga-catalog.service.ts`, `landing.service.ts`. Constructed via `new` in the BooksService constructor (sharing its cache/imageCache/mangaDex/supabase + a `() => backendOrigin` callback) — same one-way-dependency pattern as #233/#234, so `BooksModule` is unchanged. Method: characterization-first (existing books specs are the net), byte-identical extraction, build whole backend per seam. The Thai-detect regex was restored to its `฀-๿` escapes after an encoding round-trip. **Full backend suite 530 pass / 0 fail** (was 513; +17 new). Branch `dept/backend` (3 commits `15e4837`/`127ee43`/`959b1bd`). **PRD #228 DONE — all 6 steps landed (#229/#230/#232/#233/#234/#231).** Issues left open — close on merge to main. Impact report: `docs/reports/system-impact-report.md` (2026-06-14, #231).

## 2026-06-30 — MIT: drop det_sfx false-positives so SFX-rescue stops hallucinating over dialogue (#278 follow-up)
Full-stack EN→Thai benchmarking (Gal Yome ch1, 5 user-flagged pages) traced the residual **empty/tiny/missing/garbled bubble** defects to ONE root cause via systematic-debugging + worker telemetry: **not the 9arm gateway** (it translated dialogue correctly) and **not memory** — the `det_sfx` second pass false-positives on speech bubbles, which the 48px line-OCR reads as short ASCII fragments (`W`/`I`/`THE`/`M`/`8`/`1`/`WHA`). Those passed the #278 provenance gate (short + det_sfx + large box) → the vision gateway, told they were SFX, **hallucinated** a phantom Thai token (`W`→"ปาร์ตี้", `THE`→"เสียงดังสนั่นหวั่นไหว", `M`→"ไม่ชัดเจน", `1`→"เงียบสงบ") that merged into and corrupted the real dialogue render. ADR 026's provenance signal was insufficient because det_sfx itself is unreliable. **Fix:** a genuine stylized SFX the OCR *drops* comes back non-ASCII/CJK — a clean ASCII letter/digit read is proof the OCR succeeded on real text, never a dropped glyph. New pure `ocr_read_real_text(text)` ⇒ (1) `should_rescue_sfx` returns False for real-text reads (no gateway round-trip, no hallucination), (2) `_apply_ocr` **drops** a `from_sfx_detection` region whose read is real text (so its literal fragment `W`→"ว" isn't rendered over dialogue). TDD red→green, `test_ocr_vlm` **27/0**. **Benchmark-verified** across all 5 pages (direct-worker, real `Backend/.env` config): every ASCII phantom (7) dropped, every non-ASCII SFX (ほ。ん, サ×2, ⁉, ぎい) still rescued to Thai; bubbles render real dialogue; page 11 "LOVE IS FORBIDDEN"→"ความรักเป็นสิ่งต้องห้าม", page 14 "HARA-SENPAI"→"ฮาระเซเน่" (Korean-glyph leak gone). Report `docs/reports/benchmarks/2026-06-30-sfx-falsepos-phantom-fix.md` (+5 committed images). ADR 026 addendum. Remaining: #436 overlapping-bubble (page 11 second balloon translated but render-hidden) — separate, open. Branch `worktree-feat-mit-font-s1` (PR #433).

## 2026-06-30 — MIT: display captions track original lettering size in clean-layout (#175 follow-up)
User flagged that big on-art **display captions** (e.g. "LOVE IS FORBIDDEN", "IN THIS COMPANY" on Gal Yome EN→Thai p11) render far smaller than the original. Root cause (proven by per-region font telemetry): `_clean_layout_dst` sized every clean-layout region with the **flat** `clean_layout_font_size` (≈26px), ignoring `region.font_size` — so a 96px stylized caption and a 21px narration line both came out ~26px (3.7× / 2.6× too small). **Fix:** new pure `clean_layout_target_fs(orig_fs, clean_fs_flat)` — narration (`orig ≤ flat`) returns the flat size **byte-identical** (no ADR-025/#175 regression); a display caption (`orig > flat`) renders near its **original** size (cap 120). `_clean_layout_dst` then wraps a sized-up caption to its own wider source footprint (no mid-word breaks) and shrinks only to keep the block within `1.6×` the original height, never below flat. TDD: +3 `test_render_overlap` cases; render_overlap+ocr_vlm **68/0**. **Benchmark-verified** (direct-worker, real config): p11 "ความรักถูกห้ามปราม" now renders large + clean-wrapped ("ความรักถูก / ห้ามปราม"), matching the original "LOVE IS FORBIDDEN" prominence; "ในบริษัทนี้…" large; narration unchanged. Report `docs/reports/benchmarks/2026-06-30-clean-layout-caption-size.md` (+image); ADR 025 addendum. Remaining: #436 overlapping-bubble (p11 second balloon empty, p4 bubble-2 clip) — separate, open. Branch `worktree-feat-mit-font-s1` (PR #433).

## 2026-07-01 — MIT: content-shaped patch alpha so overlapping balloons stop erasing each other (#436)
User flagged a back speech-balloon rendering EMPTY (page 11 "We haven't told anyone…") though translated. Root cause (verified by decoding patches): the two overlapping balloons are correctly separate regions and anti_overlap places their text apart, but each is composited as a rectangular ~92%-opaque patch — with full_page_inpaint, the balloon composited last repaints its clean-background rectangle over the other's text (decoded: both patches held glyphs, 70% overlap). **Fix:** new `render.patch_content_alpha` knob (env MIT_PATCH_CONTENT_ALPHA, default off=byte-identical) → `content_alpha_inner(rendered, inpaint_before_text, own_mask)` builds the patch alpha from its OWN content (new glyphs = rendered vs the text-free inpaint, ∪ this group's own text mask), so margins are transparent and a neighbour's text survives. **Two bugs caught only by viewing the render (verify-before-claiming rule), then pinned as tests:** (1) diffing rendered-vs-original re-marked the neighbour's erased text → re-occluded; fixed by diffing vs the inpaint; (2) text rendering mutates img_rgb (aliases img_inpainted) → diff empty → fully-transparent patches → page rendered raw English; fixed by snapshotting inpaint_before_text. TDD: +5 `content_alpha_inner` cases; test_patch_geometry+test_patch_renderer **37/0**. **Benchmark-verified:** page 11 both overlapping balloons now render ("เราไม่ได้บอกใคร…" + "ดังนั้นเราจึงคิดจะบอกคุณก่อน…"), no English residue; pages 4/9 no regression (page-4 bubble-2 clip also recovered). Report `docs/reports/benchmarks/2026-07-01-overlap-content-alpha.md` (+3 images); ADR 027. Remaining: needs Backend MIT_PATCH_CONTENT_ALPHA wiring to activate in the reader; true glyph-on-glyph overlap still needs anti-overlap re-placement (separate). Branch `worktree-feat-mit-font-s1` (PR #433).

## 2026-07-01 — MIT: anti-overlap territory = text footprint not whole balloon (#436 follow-up)
RouteProbe characterization showed the overlapping back balloon (Gal Yome p11) was bubble-fit but small because `anti_overlap` clamped it against the FRONT balloon's full box, while the front was a clean-layout narration column filling only ~40% of its balloon (rw/bw 0.40). **Fix:** pure `region_territory_box` — reserve the balloon only when text fills it (`fills_bubble_width`), else just the text box; `_region_territory` delegates. The narration column stops reserving the whole balloon, so the overlapping neighbour grows into the empty area (safe with content-shaped patches #436). Characterization-first per [[feedback_techdebt_all_scenarios]]: +3 test_render_overlap cases; 44/0. Verified p11 (back balloon sizes to real space, no collision) + p4/p9 (no regression). ADR 027 addendum. Branch `worktree-feat-mit-font-s1` (PR #433).
---

## 2026-06-28 — Dashboard V2 Track A close-out + live-native leak fixes (PR #414)

Resumed `dashboardv2` (the canonical `:4200` console) Track A. Committed the Track A base (`54182e0`:
6 tested live-data libs `deep-link`/`download`/`incident-timeline`/`live-worker-node`/`search`/
`snapshot-export` + `dashboard.tsx` wiring). **#352** (focus-trap stable via `useCallback` closeNode) and
**#353** (robust Export download: DOM-attach anchor + deferred revoke in `lib/download.ts`) were found
**already implemented** in Track A → verified (`tsc` clean, 74 tests) + closed. **#354** (3 nits): MIT tab
= remember-last (documented), skeletons = deferred to B4 (annotated), queue-depth chart moved out of
`HOST_CHARTS` (queue ≠ host metric) → commit `f49cda2`, closed.

Then ran **/scrutinize** (3 parallel agents) before opening the PR — found the live-native contract
(ADR 022) breached in **4 spots** rendering hardcoded mock values on the LIVE path: pipeline
`95.0s · translate stalled`, GPU-util `−11.4%` delta, hero `94%` ring, vitals `0%` gauges. Fixed via a new
tested `lib/overview-signals.ts` (`pipelineHeaderSummary`, `pctDelta`) + gating/No-Data — commit `fa64c90`,
**82 tests pass, tsc clean**. Pushed `feat/dashboard` → **PR #414** (closes #352/#353/#354; relates #304/#279).
ADR **022** (live-native, no fabricated values on the live path). NOTE: full frontend E2E via tunnel **not
run** — Track B realtime unwired, console is mock-mode only (honest gap; E2E lands with B4).
## 2026-06-29 — MIT: lazy package-import boundary so logic tests + CI run torch-free (#359)
`manga_translator/__init__.py` ran `from .manga_translator import *` and `utils/__init__.py` ran `from .inference import *` —
both pull torch, so EVERY import (even `from manga_translator.config import Config` in a pure-logic test) dragged in
torch+cv2+transformers+diffusers (multi-GB). `mit-ci` therefore had to install the full ML stack for a font-fit unit test and
stayed report-only (`continue-on-error`). Fix (ADR 023): PEP 562 `__getattr__` forwards the public API lazily in BOTH `__init__`s
(`importlib.import_module` to avoid self-name recursion) — `import manga_translator` + lightweight submodule imports are now
torch-free, while `from manga_translator import Config/Context/MangaTranslator/...` still resolves on first access. utils stops
eager-importing `.inference` (its only torch puller) and forwards `ModelWrapper`/`InfererModule` lazily. CI: `mit-ci.yml` splits
into a BLOCKING `logic` job (lightweight install via a transparent grep dep-filter, torch-free suite) + report-only `heavy` job;
`test/conftest.py` skips the 12 torch-only modules when torch is absent; `asyncio_mode = auto` lets the bare-`async def` tests run
(pytest-asyncio already a dev dep). **Characterization-first** (`test_lazy_import.py`, child-interpreter so the test file is itself
torch-free): proves torch-free package + submodule import AND that the consumed public API resolves to the same objects. **Measured:**
torch-needing test files 27→12, torch-free collection 338→413 tests, logic gate collects 0 errors / torch never imported (verified
under a torch-absent import blocker); full MIT suite 0 new failures (21 pre-existing). Branch `worktree-ci-mit-lazy-torch`; ADR 023;
impact report `docs/reports/system-impact-report.md` (2026-06-29). **Open follow-up:** 12 residual heavy files (genuine model/translator
tests + `pipeline_params→ModelWrapper` transitive chain); CI grep-filter completeness + the gate's green status are validated by the
PR's own mit-ci run. Provenance in PIPELINE.md §5.

### #359 addendum (CI-validated green) — 2026-06-29
The logic gate's green status was validated end-to-end by PR #427's own `mit-ci` run: **`pytest (logic gate, torch-free)` PASS in 1m52s** (vs the old multi-GB report-only single job). Getting there surfaced — and fixed — three things the eager `import *` had masked, all committed on the branch:
1. **panel/lib not committed** — `MIT/.gitignore`'s generic `lib/` rule silently ignored `manga_translator/utils/panel/lib/` (Kumiko source); fresh clones/worktrees/CI all `ModuleNotFoundError`. Tracked via a gitignore exception. (This is the recurring "worktree missing panel/lib" gotcha — now fixed at the root.)
2. **test/testdata blanket-ignored** — `test_patch_png`'s `dotgain20.icc` fixture was never committed. Tracked via `testdata/*` + re-include.
3. **chatgpt → manga_translator circular import** — `translators/chatgpt.py` did `from .. import manga_translator` at module top; lazy init no longer pre-loads the impl module, so it cycled through `manga_translator.py → translators.dispatch` (partially-init). Moved to a runtime-local import. Regression-tested.
Also: `asyncio_mode = auto` made the bare `async def` suites (textline_merge etc.) actually run+pass in CI; heavy-API characterization tests are `skipif(not torch)`. Heavy job stays report-only (needs models/GPU).

## 2026-07-10 — Tech-debt batch: latent-bug fixes + heavy-ML suite green + pre-merge rule (#542/#544/#616/#617/#618/#620)

Six-PR agent-owned tech-debt batch, all TDD + `/scrutinize` (posted bilingual) + merged to `main` this session:
- **#542** (PR #612) — `translation_store` pinned `encoding="utf-8"` on read+write; Thai/CJK `--save-text`/`--load-text` no longer raises `UnicodeEncodeError` on a cp1252-default (Windows) host. RED (forced cp1252) → GREEN (round-trip + real UTF-8 bytes).
- **#544** (PR #613) — extracted `readWithTimeout(read, timeoutMs)` helper + `clearTimeout` in `finally`; kills a ~90s dangling timer leaked per NDJSON chunk under batch load. RED (`getTimerCount()===1`) → GREEN (0 on both resolve/timeout paths); jest 11/11.
- **#616/#617/#618** (PR #619) — greened the report-only heavy-ML pytest suite (3 fail → 0): registry pin gained `flux_klein` + a method-local `flux_embed_cache` import that breaks a PEP-562 circular import surfacing on isolated collection; `test_stages` render fixture gained `reference_layout`+`knuth_plass`; `test_online_translators` got `skipif(CI)` (network-dependent, `.group()` on None offline).
- **#620** (PR #621) — documented the pre-merge base-staleness/rebase rule (the human half of the #553 clobber defense) in the Obsidian merge-policy note + `scripts/README.md`; CLAUDE.md deferred to Stage B (dev decision).
- Also: closed **#543** obsolete (already fixed by #106 `1de61ffe`); filed leftovers **#614** (load_dotenv extraction, ex-#192) + **#615** (BaseGPTTranslator, ex-#188).

Dogfooded #620 the same session: after #619 landed, #612 was rebased onto post-#619 `main` (disjoint → clean) before merge, which also greened its heavy-ML job; #613/#621 were verified disjoint from main's new commits and squash-merged. Missing dev dep `pytest-asyncio` installed in the MIT venv (local async tests were silently failing "async def not natively supported").

## Phase 3 auth delivery on current main ? 2026-10-01

- Ported callback completion/timeout and synchronous auth-notification fixes without replacing current MFA, trusted callback envelope or native protocol.
- Added identity/generation guards for deferred profile and cache work, including cache flush/backfill completion; auth cache clearing no longer schedules remote history deletion for the next account.
- Added 12 auth/MFA/cache regressions and a dedicated CI workflow. Canonical frontend suite: 226 passed; TypeScript and targeted lint passed.
- Local placeholder-config build passed. Playwright checked URL errors, timeout and a preexisting synthetic session; production baseline error URL still showed pending text. Screenshots and limitations: docs/reports/phase3-auth-20261001/README.md.
- Independent review findings fixed. Real provider/MFA/device E2E and Vercel production deployment are not claimed by this source validation.

# Native Phase 2/3 implementation checkpoint — 2026-10-04

- Added native collections/history CSV and OS sharing, reviews/page comments/reports/translation votes, profiles/banner/follows, check-in/notifications/preferences/statistics, full supported account security, Community CRUD/images/replies/votes/SSE, creator Studio/uploads/publish/earnings and existing staff users/content/transactions/audit. Original responsive mobile source and DESIGN.md remain the reference; server/account/business contracts stay unchanged.
- Verification before final review: **210 Mobile tests**, typecheck, fresh Hermes Android export **772 modules / approximately 3 MB / 11 assets** and x86_64 debug native assembly passed (204 tasks). Installed SDK-compatible native media/sharing dependencies and regenerated Android without clean. Initial missing-import failures in five tracer modules were not valid behavior RED; the ledger corrects this evidence rather than claiming perfect TDD history.
- Final source review completed in one fresh context: corrected native image construction, Studio read navigation, Android Back, same-language chapter navigation, stale post/vote SSE reconciliation and creator/source labels. Regraded lost Reader mode/RTL/zoom as Important and preserved preferences across chapters. Observed behavior RED→GREEN, including actual React component/controller flows with OS boundaries substituted; **218/218 tests**, typecheck and post-fix Hermes Android export passed. Populated web/native comparisons, real provider/captcha/payment/translation and signed physical-device acceptance S10/S29 remain open. Env validation still misses three public variables; no secrets copied or exposed. No commits, issue closure or additional Backend/Frontend/MIT source edits in this increment. See [feature/status mapping](Mobile/docs/2026-10-04-native-full-implementation.md), [ledger](Mobile/docs/2026-10-03-native-completion-ledger.md), [ADR 030](docs/adr/030-mobile-native-account-community-and-creator-contracts.md) and [impact report](docs/reports/system-impact-report.md).

## ภาษาไทย

- เพิ่ม native collections/history CSV และ OS sharing รีวิว/คอมเมนต์รายหน้า/รายงาน/โหวตแปล profiles/banner/follows เช็กอิน/แจ้งเตือน/preferences/สถิติ account security ที่รองรับครบ Community CRUD/รูป/replies/votes/SSE creator Studio/uploads/publish/earnings และทีมงาน users/content/transactions/audit เดิม ยึด source responsive mobile กับ DESIGN.md คง contracts server/บัญชี/ธุรกิจ
- ตรวจก่อน final review: **Mobile 210 tests**, typecheck, Hermes Android export ใหม่ **772 modules / ประมาณ 3 MB / assets 11 ไฟล์** และประกอบ debug native x86_64 ผ่าน (204 tasks) ติดตั้ง media/sharing dependencies ที่เข้ากับ SDK และ generate Android ใหม่โดยไม่ clean Missing-import failures แรกของ tracers ห้าตัวไม่ใช่ behavior RED ที่ถูกต้อง แก้หลักฐานใน ledger โดยไม่อ้างประวัติ TDD สมบูรณ์
- Review source สุดท้ายใช้บริบทใหม่หนึ่งตัวแล้ว แก้ native image construction navigation อ่าน Studio Android Back การเปลี่ยนตอนภาษาเดียว SSE post/vote เก่าทับใหม่และ labels creator/source ยกระดับ preferences mode/RTL/zoom หายเป็น Important และคงข้ามตอน พบ behavior RED→GREEN จริงรวม flow components/controllers React ที่จำลองเฉพาะขอบ OS **218/218 tests**, typecheck และ Hermes Android หลังแก้ผ่าน ยังเปิดภาพ populated web/native บริการ provider/captcha/payment/translation จริงและ signed physical-device acceptance S10/S29 Validate env ยังขาด public variables สามค่า ไม่คัดลอกหรือเผย secrets ไม่มี commit/ปิด issue หรือเพิ่ม source changes Backend/Frontend/MIT รอบนี้ ดู [mapping ฟีเจอร์/สถานะ](Mobile/docs/2026-10-04-native-full-implementation.md), [ledger](Mobile/docs/2026-10-03-native-completion-ledger.md), [ADR 030](docs/adr/030-mobile-native-account-community-and-creator-contracts.md), [impact report](docs/reports/system-impact-report.md)
