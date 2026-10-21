# Native acceptance checklist — 2026-10-16

Plan: [native acceptance and release](../../docs/superpowers/plans/2026-10-16-native-acceptance-and-release.md). Source baseline: [fresh audit](2026-10-16-native-status-audit.md).

## Evidence rules / กติกาหลักฐาน

Statuses: `NOT_RUN`, `PASS`, `FAIL`, `BLOCKED`. A source test, an HTTP/controller probe, a visible device interaction and a signed-release check are separate evidence. Each execution record includes scenario ID, issue, role without credentials, device/build, action/input, expected/observed result, verifier/date and a redacted evidence link. No row passes because another level passes.

ภาษาไทย: แยกหลักฐาน source tests, HTTP/controller, ภาพ/interaction อุปกรณ์ และ signed release ทุกครั้ง บันทึก scenario/issue/role ที่ไม่รวม credentials/device-build/action/expected-observed/status/ผู้ตรวจ-วันที่/หลักฐานที่ปิดข้อมูลส่วนตัว ห้ามใช้ผลผ่านระดับหนึ่งแทนอีกระดับ

## Device/build/role inventory / เครื่อง build และบัญชีทดสอบ

| Input | Observed | Consequence |
| --- | --- | --- |
| Android target | `adb devices -l` has no attached target | Device acceptance BLOCKED; user preference requested |
| Available AVD | `MangaDock_API_36`, Pixel 7, Android 36 image, x86_64, 2 GB RAM | Can be used for development when selected; not physical-device release evidence |
| Existing APK | `com.mangadock.mobile`, version 0.1.0/code 1, min SDK 24, target/compile 36, **x86_64 only** | Emulator APK; an ARM64 phone needs a compatible build |
| APK SHA-256 | `514b9a293ea3b930b256d49e0f1c06c4600cc6ee7c676ba90a7efbf945ef339d` | Identifies the inspected existing debug artifact |
| Native modules | Image-picker, file-system, sharing and media-library package strings exist in DEX | Inclusion verified; runtime/permissions interaction not yet verified |
| UI automation | CUA inventory has no apps/browsers | No invented screenshots or UI passes; manual user-operated evidence required unless a supported surface becomes available |
| Reader/creator/staff test accounts | No user-designated fixtures supplied in this run | Authenticated/privileged live rows remain BLOCKED; do not elevate roles or inspect credentials |
| Payment fixture | No provider fixture confirmed yet | Live payment rows BLOCKED; no incidental real-money charge |
| MIT | `MANGA_TRANSLATOR_URL=http://localhost:5003`; no `MIT/.venv` or `MIT/models`; GPU RTX 4060 available | Runtime/deployment selection requested; real translation BLOCKED |
| Release | EAS project ID empty; local generated release uses debug signing | Signed replacement gate remains BLOCKED |

ภาษาไทย: ยังไม่มี Android ต่ออยู่ มี AVD และ APK x86_64 ที่ตรวจแล้วแต่ใช้กับมือถือ ARM64 ไม่ได้โดยตรง มี native module packages ใน DEX แต่ยังไม่ยืนยันการทำงานจริง CUA ไม่มี surface จึงไม่อ้างภาพ/interaction ยังไม่มีบัญชี/roles/payment fixture ที่ผู้ใช้ระบุ MIT ชี้เครื่องนี้แต่ไม่มี runtime/models และ release configuration ยังไม่พร้อม จึงคงสถานะ BLOCKED ตามที่เกี่ยวข้อง

## Existing source coverage / หลักฐาน source ที่มีแล้ว

The 2026-10-16 audit ran the full Mobile suite: **218/218**, typecheck/env validation and Android Hermes export passed. This baseline covers existing behavior and wiring; every device/release row below still needs its own evidence. It is not a newly completed live acceptance run.

ภาษาไทย: Audit วันที่ 2026-10-16 รัน Mobile 218/218 typecheck/env/export ผ่าน เป็น baseline ของ behavior/wiring เดิม ไม่ใช่การรับรอง live รอบใหม่ ทุกแถวด้านล่างต้องมีหลักฐานของตัวเอง

## Full slice matrix / ครบ 29 slices

All rows initially `NOT_RUN`; device/account/fixture dependencies currently prevent completing the live gates above. Add individual scenario outcomes below instead of marking a whole slice PASS after one partial check.

ภาษาไทย: ทุกแถวเริ่ม NOT_RUN และมี dependencies อุปกรณ์/บัญชี/fixtures ที่ยังขาด ให้เพิ่มผลแยก scenario ด้านล่าง ไม่รับทั้ง slice จากการตรวจย่อยเพียงครั้งเดียว

| Slice / issue | Required real scenario / สิ่งที่ต้องตรวจจริง | Status |
| --- | --- | --- |
| S01 #725 | Email sign-in, account restore, logout/account isolation / อีเมล restore logout แยกบัญชี | NOT_RUN |
| S02 #726 | Google/Facebook PKCE return, required TOTP, cancellation / social callback TOTP ยกเลิก | NOT_RUN |
| S03 #727 | Search → protected MangaDex chapter → hosted CAPTCHA → same Reader / ค้นหา-ตรวจ-กลับอ่านตอนเดิม | NOT_RUN |
| S04 #728 | Published Studio chapter/source selection and access / เลือก Studio ที่เผยแพร่และตรวจสิทธิ์ | NOT_RUN |
| S05 #729 | Strip/single/double/RTL, zoom, page/chapter navigation, HD/saver / โหมดอ่านและภาพตรงหน้า | NOT_RUN |
| S06 #730 | Single-page real Patches, empty success/error, zoom alignment / แปลหน้าเดียวและ geometry จริง | NOT_RUN |
| S07 #731 | Batch progress, failure/disconnect/cancel/background/manual restart / batch และ lifecycle จริง | NOT_RUN |
| S08 #732 | Server balance/price/unlock, already owned/insufficient/denied / ยอด-สิทธิ์ server | NOT_RUN |
| S09 #733 | Test QR payment, bank return, cold pending recovery, duplicate suppression / payment fixture และกลับอ่าน | NOT_RUN |
| S10 #734 | Signed Phase 1 APK on physical Android with core flow evidence / beta บนเครื่องจริง | NOT_RUN |
| S11 #735 | Home, six destinations, discovery/pagination/related with populated data / Home-discovery ข้อมูลจริง | NOT_RUN |
| S12 #736 | Collections/history ordering/delete/resume, CSV and OS sharing / รายการ-history-แชร์จริง | NOT_RUN |
| S13 #737 | Review/comment/report permissions, one-based page context / รีวิว-ความคิดเห็น-รายงาน | NOT_RUN |
| S14 #738 | Public profile/follows/banner picker/crop/position / โปรไฟล์-follow-banner จริง | NOT_RUN |
| S15 #739 | Server check-in eligibility, one claim, reward/balance reconciliation / เช็กอินและยอดจริง | NOT_RUN |
| S16 #740 | Notification count/read/destinations, foreground refresh / แจ้งเตือนและปลายทาง | NOT_RUN |
| S17 #741 | Profile/preferences/history-derived statistics, role restrictions / ตั้งค่าและสถิติเดิม | NOT_RUN |
| S18 #742 | Signup/verify/recovery/link/reauth/TOTP/devices/session revocation / security ด้วย test accounts ที่อนุญาต | NOT_RUN |
| S19 #743 | Current balance/latest Wallet ledger, account/late-response isolation / ledger และแยกบัญชี | NOT_RUN |
| S20 #744 | Community feeds/trending/manga/category/pagination/back / feed และ navigation จริง | NOT_RUN |
| S21 #745 | Owned fixture post/image create/edit/delete, picker and failure / post CRUD และรูป | NOT_RUN |
| S22 #746 | Replies/votes/reports/SSE reconnect, leave/background/account guards / replies/live จริง | NOT_RUN |
| S23 #747 | Authorized creator workspace/drafts/metadata permissions / creator workspace สิทธิ์จริง | NOT_RUN |
| S24 #748 | Ordered image upload/retry/reorder/delete/publish, unknown-result reconciliation / upload-publish จริง | NOT_RUN |
| S25 #749 | Creator earnings/account/Wallet reconcile existing server data / รายได้ตาม server | NOT_RUN |
| S26 #750 | Existing staff users/roles/ban/wallet; revoked access clears data / staff และถอนสิทธิ์ | NOT_RUN |
| S27 #751 | Supported pin/delete/moderation only, correct denied states / moderation ตาม API ที่มี | NOT_RUN |
| S28 #752 | Staff transactions/audit/statistics and permissions / ธุรกรรม-audit-สิทธิ์ | NOT_RUN |
| S29 #753 | Full parity evidence, release endpoints/keys/certificate, clean install/compatible upgrade / signed replacement ครบ | NOT_RUN |

## Execution records / ผลราย scenario

| ID | Level | Expected | Observed | Status | Evidence / verifier |
| --- | --- | --- | --- | --- | --- |
| INF-RESTORE | Cloud | Existing project returns ACTIVE_HEALTHY | MCP restore accepted; status later ACTIVE_HEALTHY | PASS | Supabase MCP, agent, 2026-10-16; DNS/Auth HTTP checks recorded separately |
| INF-BACKEND | Process/HTTP | Existing Backend starts and answers /status | Compiled without errors; port 4001; /status HTTP 200 | PASS | Terminal session 41218; cache connectivity is a separate check |
| INF-METRO | Process/HTTP | Metro serves project at 8081 | /status HTTP 200, packager-status running | PASS | Terminal session 38535 |
| INF-MIT | Runtime | Configured MIT reaches /ready | No local runtime/models or listener | BLOCKED | Waiting for local-install versus existing-server selection |
| INF-REDIS | Dependency | Redis reachable on localhost:6379 | Startup connection refused; no listener; Docker engine unavailable | BLOCKED | Existing fallback retained; /status success is not proof of an actual Redis connection |
| DEV-TARGET | Device | Selected target attached and identified | adb list empty | BLOCKED | User preference pending |
| DEVICE-OS | Device | Actual picker/browser/return/gestures visible | No target or CUA surface | BLOCKED | No UI acceptance claimed |
| ROLE-FIXTURES | Identity | Authorized existing test accounts designated | Not supplied yet | BLOCKED | No passwords/tokens requested in chat |
| RELEASE-PREFLIGHT | Artifact | Inspect current APK and signing/profile prerequisites | x86_64 APK/modules verified; release inputs incomplete | PASS | Preflight only; S10/S29 still NOT_RUN |
| AUTH-DESTINATIONS | Auth HTTP, #726/#742 | Exact native destinations accepted | 7/7 diagnostic cancellations returned to requested destination; no actual sign-in | PASS | Agent, 2026-10-16; [execution report](2026-10-16-native-acceptance-progress.md); no device/build/account login |
| METRO-ENV | Android JS bundle | Current four public values; checked server names absent | HTTP 200; all four present; two server names absent | PASS | Agent, local Metro bundle; no installed-binary claim |
| READER-LIVE | LIVE_BACKEND_TEST_CAPTCHA_MOCK_BROWSER, #727 | Protected chapter gates then returns pages | 401 → verification 201 → 200, 30 pages; browser simulated | PASS | Agent, anonymous diagnostic identity/local controller; fixture/action in execution report; no real-device acceptance |
| READER-IMAGE | LIVE_BACKEND_IMAGE_BYTES, #729 | Resolved image is downloadable | JPEG HTTP 200, 811875 bytes; discarded | PASS | Agent, local image path; no OS rendering claim |
| READER-EMPTY | Source regression, #727/#728 | Zero-page result cannot publish new ready Reader | Two tests individually RED → GREEN; Studio entitlement remains first | PASS | Agent, final suite 220/220; no signed binary |
| SOURCE-FINAL | Source/export | Tests, types, env and Android export pass after fixes | 220/220; typecheck/env exit 0; 772 modules/11 assets | PASS | Agent, 2026-10-16; export includes both guards |
| SIGNING-CURRENT | Existing APK | Identify verified certificate | apksigner verifies Android Debug certificate; SHA-256 in execution report | PASS | Agent, preflight only; release signing remains BLOCKED |
| APK-ARM64-20261020 | Test artifact | Build a phone-compatible embedded APK | ARM64 APK 27,760,069 bytes; assemble/vital lint and signature checks pass; debug-signed | PASS | Agent, 2026-10-20; [artifact report](2026-10-20-test-apk.md); no installed-device acceptance |
| APK-DOWNLOAD-20261020 | LAN HTTP | Downloaded bytes match built file | HTTP 200; streamed SHA-256 matches; four public values present, checked private token absent | PASS | Agent from computer; phone download/install NOT_RUN; S10/S29 remain open |

## Next record / แถวสำหรับตรวจต่อ

For every new scenario, add the full role/device/input/expected/observed/verifier/evidence details. API probes using the real Mobile controllers plus a simulated browser boundary must say `LIVE_BACKEND_TEST_CAPTCHA_MOCK_BROWSER`; they do not complete DEVICE-OS or S03 on their own. A failed row needs a discriminating repro before a Mobile code change.

ภาษาไทย: เติมรายละเอียด role/device/input/expected/observed/ผู้ตรวจ/หลักฐานทุก scenario การเรียก controllers Mobile กับ Backend จริงแต่จำลอง browser ต้องระบุ LIVE_BACKEND_TEST_CAPTCHA_MOCK_BROWSER ไม่ถือผ่าน OS/S03 ทั้งหมด หาก fail ต้องมี repro แยกสาเหตุก่อนแก้โค้ด
