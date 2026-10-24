# MangaDock — System-Impact Change & Tech-Debt Report

## 2026-10-22 — Native Phase 4 integration with current main

[Integration evidence and resume point](../../Mobile/docs/2026-10-22-main-integration.md). Landing status is recorded by the integration PR. / หลักฐานและจุดทำต่ออยู่ในรายงาน สถานะ merge ให้ดู PR รวม

| Field | English | ภาษาไทย |
| --- | --- | --- |
| 1. What changed | Native Mobile Phase 4 and #782 integrated with main; three Backend profile joins normalized. | รวม native Phase 4 และ #782 กับ main พร้อมแปลง profiles สาม service |
| 2. Results | Combined source verified; device/release acceptance remains open. | source รวมผ่านตรวจ ยังเปิดการรับผลอุปกรณ์/release |
| 3. Performance gain | Not measured; no percentage claimed. | ไม่วัดและไม่อ้างเปอร์เซ็นต์ |
| 4. Benefits | Native workflows available on the main integration path. | รวม workflows native ในเส้นทาง main |
| 5. Purpose | Bring reviewed native work into the maintained branch. | นำงาน native ที่ review แล้วเข้าสาขาหลัก |
| 6. Why / architecture | Keep existing Backend, Supabase and server-side MIT contracts. | ใช้สัญญา Backend, Supabase และ MIT ฝั่ง server เดิม |
| 7. Before | Native implementation and physical-QA fixes isolated on Phase 4. | native และการแก้ QA อยู่แยกใน Phase 4 |
| 8. Goals | Preserve current main while integrating reviewed runtime source. | เก็บงาน main ปัจจุบันพร้อมรวม runtime ที่ review แล้ว |
| 9. Architecture before | Main hybrid shell; native source on feature branch. | main เป็น shell hybrid ส่วน native อยู่ feature branch |
| 10. Architecture after | Native views call existing services; shared bridge retained. | views native เรียกบริการเดิม เก็บ shared bridge |
| 11. Refactor list | Join object/array/null normalization; retain native reader/navigation recovery. | แปลง join สามรูปแบบ เก็บ reader/navigation recovery ที่แก้แล้ว |
| 12. Metrics | Mobile 235; Backend 1,014 in 98 suites; tooling 58; QR hashes 10/10; types/env/build/lint pass. | Mobile 235 Backend 1,014 ใน 98 suites tooling 58 hash QR 10/10 types/env/build/lint ผ่าน |
| 13. Debt removed | Type-assertion-only joined-profile workaround replaced. | แทน workaround ที่ cast profiles อย่างเดียว |
| 14. Risk / rollback | Existing tests cover resolved seams; revert integration normally if needed. No DB migration applied. | tests ครอบคลุมจุด conflict ย้อนด้วย revert PR ไม่มี migration |
| 15. DX | Single integration record separates source proof from acceptance. | รายงานเดียวแยกหลักฐาน source กับการรับผลจริง |
| 16. Future | Draft #860, broader UX, matching APK and real-service/device acceptance remain. | เหลือ draft #860 UX อื่น APK ที่ตรง revision และรับผลบริการ/เครื่องจริง |
| 17. Lessons | Preserve both histories; verify immutable vendor bytes in Git index. | เก็บประวัติสองฝั่งและตรวจ bytes vendor ใน Git index |
| 18. KPI | Automated checks pass; production/visual completion is not claimed. | checks อัตโนมัติผ่าน ยังไม่อ้างพร้อม production/ภาพครบ |


## 2026-10-21 — Follow-up fixes after the redesign: #661–#675, #798, #801, #802, #806 (bug / security)

**What & where:** `Backend/src/users` (avatar upload by magic bytes), `Backend/src/books` translate throttle
guard + text cap, the translate Markdown stripper and its cache key version, `Frontend/app/components/ui/UserAvatar`,
`Frontend/app/components/PostImage.tsx` (new) and its call sites, `Frontend/app/lib/safeUrl.ts`
(`safeImageSrc`), plus the audit-bug files listed in PR #800.

**Why:** the feature audit's `ready-for-agent` bugs; two security gaps found on the way (an avatar upload
typed by client metadata; a translate throttle a single client could exhaust for everyone); broken images
rendering as grey boxes with alt text.

**Before → After:** avatar type from the client → from the file's bytes; one global translate bucket →
per-client first, then global; Markdown removed from prompts → kept, only `THOUGHTS:` stripped; raw
`<img>`/`<Image>` with a missing guard at one site → one guarded component with a fallback.

**Performance Δ:** compact forum thumbnails fetch a 256-px resize instead of a viewport-wide image.

**Validation:** unit/spec tests per change (red → green), CI green, browser checks on production builds.

**Risk / rollback:** each PR reverts on its own. #805 moved the translate cache key to v5; reverting it serves the older v4 entries again.

**Links:** PRs #800 #803 #804 #805 #807; issues #661–#663 #666–#672 #675 #798 #801 #802 #806.

---

## 2026-10-20 — #764 Strata redesign, Epics B/C/D + performance pass (feature / perf)

**What & where:** `Frontend/app/**` (all user areas, Studio, mascot cast/editor, ui primitives
Coin/CopyButton, hooks useIsScrolling/useThrottledValue/throttle), `Backend/src/studio-stats/*`
(new), `Backend/src/users` mascot DTO + endpoints, `Backend/migrations/2026-10-20-profiles-mascot.sql`
(not applied), `DESIGN.md`, ADR 029.

**Why:** one design system instead of per-page classes (light theme becomes possible, no purple),
a Studio creators can read, and mascots as part of identity — the dev's brief.

**Before → After:** hex/white-alpha/purple classes → tokens across the user routes; Studio list-of-
cards → shell + ECharts stats from a scoped endpoint; emoji icons → line icons/coin/mascots.

**Performance Δ (production build):** home scroll p95 33 → 16.7 ms; book popup p95 67–117 → 16.7 ms
(0 frames > 50 ms); /settings scroll slow frames 123/389 → 0; colour drag sync 41 → 4.8 ms/event,
frames > 50 ms 86 → 15. ECharts loads only on Studio routes (dynamic import).

**Quality:** tokens make the light theme a switch away; a measured rule against blurred repeated
elements; Studio stats read only the caller's own versions (uid from AuthGuard).

**Validation:** tsc 0; bun tests (studio shellMath, loaderFor, throttle red → green); backend specs for
aggregate-stats + studio-stats service; browser verification at 1440/390 per area; frame measurements
before/after in headless Chromium on `next start`.

**Risk / rollback:** visual-only for most files; backend additions are new read endpoints + one guarded
write; mascot save fails gracefully until the migration is applied. Rollback = revert the PR.

**Links:** #764 #765 #772–#778 #780 #786–#790 #781 #783–#785, ADR 029.

---

## 2026-10-20 — #722: identity-change reset has one owner (refactor)

**What & where:** new `Frontend/app/lib/identityReset.ts` (+ `identityReset.test.ts`);
`Frontend/app/contexts/AuthContext.tsx` four call sites → one call; `Frontend/tests/oauth-regression.test.cjs`
import allow-list; ADR 015.

**Why:** the same four cache clears were written out at four sites and had drifted once; a missing
clear means cross-account data bleed.

**Before → After:** 4 sites × 4 calls → 4 sites × 1 call; the order and the calls themselves are
unchanged (`clearHistory({syncRemote: false})` as #712 left it).

**Performance Δ:** none — same calls, one extra function frame.

**Quality:** no behaviour change on any path; a forgotten cache is now one missing line in one file,
pinned by tests over the real cache modules.

**Validation:** 2 tests red → green, 4/4 mutations killed; `test:auth` 12/12; `bun test` 239 pass
(8 known `app/docs` integration failures); sign-out in the browser issues no history `DELETE`.

**Risk / rollback:** low; rollback = revert. #720 is closed as shipped by #712 rather than by its own branch.

**Links:** #722, #720, #712, ADR 015.

---

## 2026-10-20 — PR #782 scrutiny follow-up / แก้ผล scrutinize

| Field | English | ไทย |
| --- | --- | --- |
| 1. What changed | Mobile API strict/nullable JSON helpers, own-review caller, Reader pinch lifecycle and regressions | แยก helper JSON แก้ caller รีวิวตัวเอง วงจร pinch Reader และ regressions |
| 2. Results / outcome | Empty required review data yields retryable error; rejoining a finger preserves zoom | ข้อมูลรีวิวที่จำเป็นแต่ว่างแสดง error/ลองใหม่ วางนิ้วกลับไม่ทำ zoom กระโดด |
| 3. Expected performance gain % | Not measured | ไม่วัด |
| 4. Benefits | Review-render stability and continuous pinch interaction | รีวิวไม่ render ล้มและ pinch ต่อเนื่อง |
| 5. Purpose | Resolve two reproducible scrutiny findings in the existing PR | แก้สอง finding ที่มี repro ใน PR เดิม |
| 6. Why + architectural impact | Optional absence must not change all response contracts; current touch geometry differs from gesture history | ข้อมูล optional ที่ไม่มีไม่ควรเปลี่ยน contract ทั้งหมด และ geometry นิ้วปัจจุบันต่างจากประวัติ gesture |
| 7. Problems before | Empty summary published null then TypeError; pinch rejoin jumped 2x → 1x | summary ว่าง publish null แล้ว TypeError วางนิ้วกลับทำ zoom2x → 1x |
| 8. Goals | Keep own-review absence valid and prevent zoom jumps or pinch-triggered page turns | คงกรณีไม่มีรีวิวและป้องกันซูมกระโดด/เปลี่ยนหน้าเมื่อ pinch |
| 9. Architecture before | Shared API parser allowed every empty body; one pinch flag served two roles | parser อนุญาตทุก body ว่างและใช้ flag pinch เดียวสองหน้าที่ |
| 10. Architecture after | Explicit nullable parser entry; independent active-baseline and ever-pinched state | แยกเส้นทาง nullable และสถานะ baseline/เคย pinch |
| 11. Refactor list | Internal parser shared by two typed entry points; reuse touch handler for start/end/move | ใช้ parser ร่วมสอง entry ที่ระบุ type และ handler touch ร่วม start/end/move |
| 12. Metrics | Two observed RED → GREEN regressions; combined Mobile235/235, tooling58/58; types/env/format and Hermes773 modules/11 assets pass | RED → GREEN สองกรณี Mobile รวม235/235 tooling58/58 types/env/format และ Hermes773 modules/11 assets ผ่าน |
| 13. Technical debt removed | Implicit optional-response semantics and stale pinch baseline | ลด nullable ที่ไม่ระบุชัดและ baseline pinch เก่า |
| 14. Risk reduction / rollback | Required and optional bodies tested separately; revert follow-up code commit, retaining chapter-list work | ทดสอบ body แยกประเภท ย้อน commit แก้นี้โดยคงงานรายการตอน |
| 15. Developer experience impact | Typed optional helper and tests reproduce the user-facing failures | helper optional ระบุ type และ tests จำลองอาการผู้ใช้ |
| 16. Future opportunities | Build a fresh APK and repeat two scenarios on physical devices | สร้าง APK ใหม่และทดสอบสองกรณีซ้ำบนเครื่องจริง |
| 17. Lessons learned | Preserve concurrent commits; verify export entry when dependencies are junction-linked | คง commit ที่เพิ่มระหว่างทำและตรวจ entry export เมื่อใช้ junction |
| 18. KPI | Retryable required-body error; stable2x after rejoin; no new physical acceptance claim | ข้อมูลจำเป็นว่างลองใหม่ได้ วางนิ้วกลับคง2x ไม่อ้างรับเครื่องจริงเพิ่ม |

Repro, root cause, fix, why previous tests missed it, validation and limits: [follow-up report](../../Mobile/docs/2026-10-20-review-fixes.md), [PR #782](https://github.com/Slow-Inc/MangaDock/pull/782). No Backend/Frontend/MIT, provider, schema or dependency change; no performance or production acceptance claim.

ภาษาไทย: ดู repro สาเหตุ วิธีแก้ ช่องว่าง tests เดิม การตรวจและข้อจำกัดในรายงานกับ PR ด้านบน ไม่แก้ Backend/Frontend/MIT/provider/schema/dependency และไม่อ้างผลประสิทธิภาพหรือ production acceptance

## 2026-10-20 — Native chapter list web alignment / รายการตอน Native ใกล้เว็บ

| Field | Change / การเปลี่ยนแปลง |
| --- | --- |
| 1. What/where | NativeChapterList, detail wiring, catalog counts and tests / componentรายการตอน, wiring, จำนวนหน้าและtests |
| 2. Outcome | Bounded chapter scrolling with reviews reachable / เลื่อนตอนในกรอบและเข้าถึงรีวิวง่าย |
| 3. Performance gain | Not measured / ไม่วัด |
| 4. Benefits | Pages/price visible,83 chapters accessible / เห็นจำนวนหน้าหรือราคาและเข้าถึง83ตอน |
| 5. Purpose | User-approved alignment with web / ปรับตามเว็บที่ผู้ใช้อนุมัติ |
| 6. Why/impact | Small presentational component, existing reader boundary / แยกcomponentแสดงผล คงขอบเขตReader |
| 7. Before | Every chapter extended outer page; no page counts / รายการยืดหน้าหลักและไม่มีจำนวนหน้า |
| 8. Goal | Preserve all selection/access behavior with compact UI / คงการเลือกและสิทธิ์ด้วยUIกระชับ |
| 9. Architecture before | Detail-owned chapter rows / แถวตอนในรายละเอียด |
| 10. Architecture after | Bounded child ScrollView; existing API metadata / ScrollViewภายในที่จำกัดสูง ใช้metadataเดิม |
| 11. Refactor | Extract chapter view and remove orphan styles / แยกviewและลบstylesที่ไม่ใช้ |
| 12. Metrics |234tests;320dp viewport;316build tasks/39s / tests234 กรอบ320dp build316tasks/39s |
| 13. Debt removed | Missing typed page count and mixed detail rendering / เพิ่มชนิดจำนวนหน้าและแยกหน้าที่แสดงตอน |
| 14. Risk/rollback | Physical nested-scroll/access check; revert UX commit / ตรวจscrollและอ่านจริง ย้อนcommitUXได้ |
| 15. Developer experience | Focused component tests and tracked screenshots / testsเฉพาะcomponentและภาพในrepo |
| 16. Future | Optional web language filters/grouping / ตัวกรองภาษาและกลุ่มเวอร์ชันเพิ่มเติม |
| 17. Lesson | Verify native inner/outer gestures physically / ตรวจgestureสองชั้นบนเครื่องจริง |
| 18. KPI |234pass, types/build pass, last chapter and150% font verified / checksผ่านพร้อมตอนสุดท้ายและฟอนต์150% |

Evidence / หลักฐาน: [report, artifact hash and screenshots](../../Mobile/docs/2026-10-20-native-chapter-list-parity.md). No backend/schema/dependency change, no performance percentage claim, debug/LAN QA only; all prior release gates remain separate. / ไม่แก้backend/schema/dependency ไม่อ้างความเร็วเพิ่ม เป็นdebug/LAN และแยกrelease gatesเดิม

## 2026-10-20 — Native physical-review fixes B1–B6 / แก้บั๊กจากรีวิวบนเครื่องจริง

| Field | Change record / บันทึกการเปลี่ยนแปลง |
| --- | --- |
| 1. What/where | Mobile API, catalog, Reader, modal sheets, translation state and regression tests / API/catalog/Reader/modal/สถานะแปลและ tests ฝั่ง Mobile |
| 2. Outcome | Six reported paths corrected, verified within stated coverage / แก้หกเส้นทางตามขอบเขตที่ตรวจ |
| 3. Performance gain | Not benchmarked; no percentage claim / ไม่ benchmark ไม่อ้างเปอร์เซ็นต์ |
| 4. Benefits | Reviews load, resume returns to selected page, Back preserves related-book history, swipes work, controls accessible, counters truthful / รีวิวและอ่านต่อใช้ได้ Back/ปัดหน้า/ปุ่มและตัวนับถูกต้อง |
| 5. Purpose | Resolve physical QA B1–B6 from443dc80 / แก้ปัญหาจาก QA เครื่องจริง |
| 6. Why/impact | Share list/image geometry and maintain local successful-detail stack in existing stores / ใช้ geometry ร่วมและ stack ใน stores เดิม |
| 7. Before | Empty JSON parse, average-height restore, one book slot, no swipe, unsafe modals, chapter-wide pending counter / parseว่าง/คืนหน้าจากความสูงเฉลี่ย/เก็บเรื่องเดียว/ไม่มีswipe/modalทับ/นับรอทั้งตอน |
| 8. Goals | Correct six defects without changing service/business contracts / แก้หกข้อโดยคงสัญญาบริการและธุรกิจ |
| 9. Architecture before | Existing native stores + variable image-local ratios / storesเดิมและอัตราส่วนภาพแยกภายในแต่ละภาพ |
| 10. Architecture after | Same stores with shared geometry, detail snapshots and requested translation indices / storesเดิมเพิ่มgeometryร่วม/snapshots/หน้าที่ร้องขอ |
| 11. Refactor list | Reader removes measured-cell/average-retry machinery; no dependency / ลบ cell measurement/average retries ไม่เพิ่มdependency |
| 12. Metrics | Tests220→230; final build316 tasks/37s; ARM64 hash in report / tests220→230 build316tasks/37s hashตามรายงาน |
| 13. Debt removed | Parallel geometry sources and unscoped pending calculation / ลบgeometryสองแหล่งและการนับpendingไม่ตรงscope |
| 14. Risk/rollback | Native response arbitration tested physically; revert Mobile batch together; preserve data / ทดสอบgestureจริง ย้อนMobileชุดนี้ร่วมกัน คงข้อมูล |
| 15. Developer experience | Reproducible red/green cases and device evidence / มีred-greenและหลักฐานเครื่องจริง |
| 16. Future opportunities | Broader UX/filter requests, other devices and release acceptance / UX/filterเพิ่มเติม เครื่องอื่นและรับrelease |
| 17. Lessons | Real native ScrollView can steal JS swipes; pinch transitions need independent geometry / native scrollแย่งgestureได้ ต้องตั้งgeometryเมื่อเพิ่มนิ้ว |
| 18. KPI | 230tests/types/env/build pass; device resume40&20, LTR/RTL, modal clearance and pending0 / checksผ่านพร้อมผลเครื่องจริงตามที่ระบุ |

Evidence and limitations: [fix report](../../Mobile/docs/2026-10-20-review-fixes.md), [ADR031](../adr/031-mobile-reader-geometry-and-review-recovery.md). Final installed APK matches SHA256 `d4b36ecdbe2e8514ab62bf97534d6044f8daf1065ecd0b969db2d385c00a4a2e`. Internal LAN/debug signing; no production MIT success, payment/account mutation, fold/offline/long-session acceptance inferred. Subsequent user authorization covers commit/push/PR into the Phase4 branch; deployment is excluded.

ภาษาไทย: รายงานมีขั้นตอนและข้อจำกัด APK ที่ติดตั้ง hash ตรง เป็น LAN/debug ภายใน ไม่อนุมาน MITสำเร็จ/เงิน/แก้บัญชี/จอพับ/offline/sessionยาว ผู้ใช้อนุญาต commit/push/PR เข้า branch Phase4 ภายหลัง ไม่รวม deploy

## 2026-10-20 — Public HTTPS APK delivery / ส่ง APK ผ่านอินเทอร์เน็ต

| Field | English | ไทย |
| --- | --- | --- |
| 1. What changed | Dedicated Cloudflare tunnel, scoped API DNS target, new download hostname and HTTPS-origin APK | เพิ่ม tunnel แยก เปลี่ยน target DNS API เฉพาะจุด เพิ่มโดเมนดาวน์โหลดและ APK ฝัง HTTPS |
| 2. Results / outcome | Public API/Reader/image and full APK GET/hash pass from host; tunnel healthy | API/Reader/ภาพและดาวน์โหลด APK ครบ/hash ผ่านจากเครื่องโฮสต์ tunnel healthy |
| 3. Expected performance gain % | Not measured; connectivity recovery | ไม่วัด เป็นการกู้การเชื่อมต่อ |
| 4. Benefits | Testers can use an internet origin across networks | ผู้ทดสอบใช้ API สาธารณะต่างเครือข่ายได้ |
| 5. Purpose | Fulfil request to enable remote APK testing | รองรับคำขอทดสอบ APK คนละสถานที่ |
| 6. Why + architectural impact | Old public tunnel disconnected; dedicated edge routing to existing Backend, no application redesign | Tunnel สาธารณะเดิมขาด connection จึงแยกเส้นทาง edge ไป Backend เดิม ไม่ออกแบบแอปใหม่ |
| 7. Problems before | Public HTTP 530/1033; existing APK embedded LAN IP | API สาธารณะ 530/1033 และ APK เดิมฝัง IP LAN |
| 8. Goals | Verified downloadable HTTPS artifact and explicit host requirements | มีไฟล์ HTTPS ที่ตรวจแล้วพร้อมข้อกำหนดเครื่องโฮสต์ |
| 9. Architecture before | Native → LAN Backend; public shared tunnel down | Native → Backend LAN และ tunnel ร่วมสาธารณะหยุด |
| 10. Architecture after | Native → public HTTPS → dedicated tunnel → same Backend; separate loopback file server | Native → HTTPS → tunnel แยก → Backend เดิม และ file server loopback แยก |
| 11. Refactor list | None; source/contracts/dependencies/private app env unchanged | ไม่มี refactor คง source/contracts/dependencies/private env แอป |
| 12. Metrics | APK 27760053 bytes; SHA-256 verified over GET; Reader 30 pages; build 2m11s, 316 tasks | APK 27760053 bytes ตรวจ hash จาก GET Reader 30 หน้า build 2m11s 316 tasks |
| 13. Technical debt removed | None; the route was restored, not refactored; the artifact is still debug-signed | ไม่มี เป็นการกู้ route ไม่ใช่ refactor และไฟล์ยังใช้ลายเซ็นทดสอบ |
| 14. Risk reduction / rollback | Verified binary digest, private-token exclusion/ACL, dedicated routes; restore only old API CNAME target | ตรวจ digest/ไม่มี private token/ACL แยก routes ย้อนโดยคืนเฉพาะ target CNAME API เดิม |
| 15. Developer experience impact | Bilingual runtime/download/rollback guide; no Metro for installed APK | คู่มือเปิดระบบ/ดาวน์โหลด/ย้อนกลับสองภาษา ติดตั้งแล้วไม่ต้องเปิด Metro |
| 16. Future opportunities | Real-device cross-network acceptance, always-on hosting, production signing/CAPTCHA, MIT readiness | รับเครื่องจริงต่างเครือข่าย จัดโฮสต์ถาวร signing/CAPTCHA production และ MIT |
| 17. Lessons learned | Connected accounts differ; verify authoritative zone; DNS convergence and artifact cache need evidence | Account ที่เชื่อมต่างกัน ต้องตรวจ zone จริง รอ DNS และตรวจค่าฝังโดยไม่เชื่อ cache |
| 18. KPI | One-off checks only: API 200 and artifact hash; no device or production KPI claimed | ตรวจครั้งเดียว: API 200 และ hash ของไฟล์ ไม่อ้าง KPI เครื่องจริงหรือ production |

Evidence, commands and open acceptance: [public HTTPS report](../../Mobile/docs/2026-10-20-public-https-apk.md). Earlier same-day source suites remain historical evidence; this follow-up reran the native build and public HTTP checks. No source change accompanied it.

ภาษาไทย: ดูหลักฐาน คำสั่ง และ acceptance ที่ค้างในรายงาน HTTPS ผล source suites วันเดียวกันเป็นหลักฐานเดิม รอบนี้ตรวจ build/artifact และ HTTP สาธารณะใหม่ โดยไม่มีการแก้ source ไปพร้อมกัน

Correction — 2026-10-22: after review of #878, fields 13 and 18 above were corrected (the route was restored, not debt removed; the checks were one-off, not a KPI), and the Cloudflare identifier table moved off the public page. No other value changed.

ภาษาไทย: แก้ไข — 2026-10-22: หลังรีวิว #878 แก้ช่อง 13 และ 18 ข้างต้น (เป็นการกู้ route ไม่ได้ลบ debt และการตรวจเป็นครั้งเดียว ไม่ใช่ KPI) และย้ายตารางรหัส Cloudflare ออกจากหน้าสาธารณะ ไม่เปลี่ยนค่าอื่น

## 2026-10-20 — Downloadable ARM64 test APK / APK ARM64 สำหรับโหลดทดสอบ

| Field | English | ไทย |
| --- | --- | --- |
| 1. What changed | New local ARM64 test APK and directory-only LAN download server | สร้าง APK ทดสอบ ARM64 และ download server เฉพาะโฟลเดอร์ใน LAN |
| 2. Results / outcome | Native build/vital lint, 220 tests, types/env, signature and download hash pass | Native build/vital lint, 220 tests, types/env, ลายเซ็นและ hash ดาวน์โหลดผ่าน |
| 3. Expected performance gain % | Not measured | ไม่วัด |
| 4. Benefits | Phone-installable artifact with embedded JS, no Metro packaging dependency | มีไฟล์ติดตั้งมือถือที่ฝัง JS ไม่พึ่ง Metro ในการแพ็ก |
| 5. Purpose | Deliver APK file first as explicitly selected | ส่งไฟล์ APK ก่อนตามที่ผู้ใช้เลือก |
| 6. Why + architectural impact | Old APK was emulator-only; public API returned 530; existing native/server architecture retained | APK เดิมเฉพาะ emulator และ API public ตอบ 530 คงสถาปัตยกรรมเดิม |
| 7. Problems before | No current ARM64 downloadable artifact | ไม่มี artifact ARM64 ปัจจุบันให้โหลด |
| 8. Goals | Inspectable internal APK and practical installation/test steps | APK ทดสอบที่ตรวจสอบได้และวิธีติดตั้ง/ทดสอบชัดเจน |
| 9. Architecture before | Native client calls existing Backend/Auth/MIT | Native เรียก Backend/Auth/MIT เดิม |
| 10. Architecture after | Same; build-only LAN origin override, standard-library file server | เดิม ใช้ override URL LAN ตอน build และ file server standard library |
| 11. Refactor list | None; no application source/dependency changes | ไม่มี refactor หรือแก้ app source/dependency |
| 12. Metrics | APK 27760069 bytes; 2490896-byte Hermes; 1119 ZIP entries read; 220/220 tests | APK 27760069 bytes; Hermes 2490896 bytes; อ่าน ZIP 1119 entries; tests 220/220 |
| 13. Technical debt removed | Current emulator-only delivery gap | ปิดช่องว่างการส่งไฟล์ที่เดิมใช้ได้เฉพาะ emulator |
| 14. Risk reduction / rollback | Debug-signed test label, private-value scan, hash and no device reset; stop only owned services to withdraw LAN delivery | ระบุเซ็นทดสอบ ตรวจ private values/hash ไม่ล้างเครื่อง ยุติการส่ง LAN โดยหยุดเฉพาะบริการที่เปิดเอง |
| 15. Developer experience impact | Reproducible build command and bilingual installation guide | มีคำสั่ง build และคู่มือติดตั้งสองภาษา |
| 16. Future opportunities | Physical acceptance and reachable HTTPS/production signing later | รับบนเครื่องจริงและจัด HTTPS/production signing ภายหลัง |
| 17. Lessons learned | Quote dotted Gradle properties in PowerShell; explicit ABI/origin and low-memory limits | Quote property Gradle ที่มีจุดใน PowerShell ระบุ ABI/origin และจำกัดทรัพยากรเมื่อ RAM ต่ำ |
| 18. KPI | Artifact/download checks pass; install and replacement release remain unaccepted | ตรวจ artifact/download ผ่าน ยังไม่รับ install/replacement release |

Evidence: [APK identity, SHA-256, commands, initial failure and limits](../../Mobile/docs/2026-10-20-test-apk.md). Fresh native build includes release vital lint; no checks suppressed. No Frontend/Backend/MIT source or private env changed; no production key/project, website button or public deployment created. LAN download was verified from the computer; phone networking/install remains user-operated and unobserved. No commit/push/issue mutation.

หลักฐาน: รายงานด้านบนมี identity/hash/commands/error แรกและข้อจำกัด Native build ใหม่รวม vital lint ไม่ปิด checks ไม่แก้ source Frontend/Backend/MIT/private env ไม่สร้าง production key/project/ปุ่มเว็บ/public deployment ตรวจ LAN download จากคอมเท่านั้น ยังต้องให้ผู้ใช้ตรวจ networking/install บนมือถือ ไม่ commit/push/เปลี่ยน issue

Subsequent user-authorized commit preparation: `.gitattributes` now preserves the vendored QR JavaScript as raw bytes. Automatic LF normalization changed index digests from the working-copy 10/10 to 0/10; the narrow `-text` rule restores index **10/10**, with QR tests **2/2** and unchanged runtime source. Vendor provenance records why upstream whitespace remains; non-vendor staged whitespace checks pass. This changes Git packaging only, not the APK or server architecture; no performance gain claimed.

ภาษาไทย: ช่วงเตรียม commit ที่ผู้ใช้อนุญาตภายหลัง เพิ่ม `.gitattributes` คงไบต์ vendor QR เดิม เพราะ normalize LF ทำให้ working copies ตรง 10/10 แต่ index 0/10 ใช้ `-text` เฉพาะไฟล์ให้ index กลับตรง **10/10** tests QR **2/2** โดยไม่เปลี่ยน runtime source บันทึกเหตุผลคง upstream whitespace ใน provenance ตรวจ staged whitespace ส่วนอื่นผ่าน เป็น Git packaging ไม่เปลี่ยน APK/server architecture และไม่อ้างความเร็วเพิ่ม
## 2026-10-16 — Native acceptance recovery and empty Reader guard / กู้บริการและกัน Reader ตอนว่าง

| Field | English | ไทย |
| --- | --- | --- |
| 1. What changed | Restored existing Supabase, started Backend/Metro; Mobile rejects empty MangaDex/Studio pages before a new ready state | กู้ Supabase เปิด Backend/Metro และกัน Mobile ประกาศพร้อมอ่านเมื่อไม่มีภาพ |
| 2. Results / outcome | 220/220 Mobile tests, types/env/export pass; live controller gets 30 pages with simulated browser | Mobile 220/220 types/env/export ผ่าน controller จริงได้ 30 หน้าโดยจำลอง browser |
| 3. Expected performance gain % | Not measured | ไม่วัด |
| 4. Benefits | Actionable empty-content error and reachable existing services | แจ้งตอนว่างตรงจริงและเข้าถึงบริการเดิม |
| 5. Purpose | Progress approved acceptance plan without new product scope | ทำแผน acceptance ที่อนุมัติโดยไม่เพิ่ม scope |
| 6. Why + architectural impact | HTTP success did not imply readable content; preserve existing client/server architecture | HTTP สำเร็จไม่ได้แปลว่ามีภาพ คงสถาปัตยกรรม client/server เดิม |
| 7. Problems before | Inactive project and empty ready Reader | Project หยุดและ Reader พร้อมแต่ไม่มีภาพ |
| 8. Goals | Restore prerequisites and reject demonstrably empty ready results | กู้ prerequisites และกัน ready ที่พิสูจน์ว่าไม่มีภาพ |
| 9. Architecture before | Native controllers call existing Backend/Auth/MIT | Controllers native ใช้ Backend/Auth/MIT เดิม |
| 10. Architecture after | Same architecture; current-request page validation after Studio entitlement | สถาปัตยกรรมเดิม เพิ่มตรวจภาพคำขอปัจจุบันหลัง entitlement Studio |
| 11. Refactor list | None; two guards and two behavioral regressions | ไม่ refactor เพิ่มสอง guards และสอง behavior tests |
| 12. Metrics | Suite 218 → 220; 7/7 destination probes; 30-page API fixture; JPEG 811875 bytes | Suite 218 → 220 ปลายทาง 7/7 fixture API 30 หน้า JPEG 811875 bytes |
| 13. Technical debt removed | Empty response treated as fresh reading success | แก้การถือ response ว่างเป็นการเปิดอ่านสำเร็จใหม่ |
| 14. Risk reduction / rollback | Entitlement/generation guards preserved; rollback only new page checks/tests if needed; no destructive cloud rollback | คง entitlement/generation ย้อนเฉพาะ page checks/tests ที่เพิ่มหากจำเป็น ไม่ rollback cloud แบบทำลาย |
| 15. Developer experience impact | Repro and per-level evidence distinguish source, API, device and release | มี repro/หลักฐานแยก source API device release |
| 16. Future opportunities | MIT deployment, real account/device/visual/payment and signed internal acceptance | เตรียม MIT และรับ account/device/ภาพ/payment/signed internal จริง |
| 17. Lessons learned | Provider 404/empty content and status HTTP success require independent checks | ต้องแยก provider 404/เนื้อหาว่าง และ HTTP status ออกจาก dependency พร้อม |
| 18. KPI | Verified source/API checks pass; replacement release remains unaccepted | Source/API ที่ตรวจผ่าน ยังไม่รับ replacement release |

Evidence and limits: [bilingual execution report](../../Mobile/docs/2026-10-16-native-acceptance-progress.md). Supabase restore retained project identity; no Auth settings/schema changes. Actual provider login, device browser/gestures, MIT/payment/roles and production CAPTCHA remain open. No Frontend/Backend/MIT source changed by this fix, no commit/issue closure. The inspected APK remains x86_64/debug-signed; fresh export is not an APK.

ภาษาไทย: รายงานด้านบนมีหลักฐาน/ข้อจำกัด กู้ project เดิมไม่แก้ Auth settings/schema ยังไม่รับ login/browser/gestures/MIT/payment/roles/production CAPTCHA จริง ไม่แก้ source Frontend/Backend/MIT ด้วย fix นี้ ไม่ commit/ปิด issue APK เดิมยังเป็น x86_64/debug ส่วน export ใหม่ไม่ใช่ APK

## 2026-10-05 — Native Reader development CAPTCHA / ตั้ง CAPTCHA Reader สำหรับพัฒนา

| Field | English | ไทย |
| --- | --- | --- |
| 1. What changed | Dedicated Pages deployment of three existing CAPTCHA assets; ignored Mobile public env assignments | Deploy Pages สำหรับ CAPTCHA เดิมสาม assets และตั้ง public env Mobile ที่ถูก ignore |
| 2. Results / outcome | HTTPS page and env ready; fresh Metro bundle has all four required public values | หน้า HTTPS/env พร้อม bundle Metro ใหม่มี public values จำเป็นครบสี่ค่า |
| 3. Expected performance gain % | Not measured; no speed claim | ไม่วัด ไม่อ้างเร็วขึ้น |
| 4. Benefits | Reader can receive a configured browser challenge URL | Reader มี URL เปิด challenge ผ่าน browser |
| 5. Purpose | Unblock local native Reader verification setup | ให้การตั้งตรวจ Reader native ในเครื่องพร้อม |
| 6. Why + architectural impact | Missing URL failed before browser; Frontend env aliases were not Expo names; existing browser/Backend architecture retained | URL ขาดทำให้หยุดก่อน browser aliases Frontend ไม่ใช่ชื่อ Expo คง browser/Backend architecture เดิม |
| 7. Problems before | No CAPTCHA URL; blank source site key; local Mobile missing Expo API/Auth names; stale Metro env | ไม่มี URL CAPTCHA source site key ว่าง Mobile env ขาดชื่อ Expo API/Auth และ Metro ใช้ env เก่า |
| 8. Goals | Configure owned HTTPS development host and matched existing services without source changes | ตั้ง HTTPS development host ที่เป็นเจ้าของและบริการเดิมตรงกันโดยไม่แก้ source |
| 9. Architecture before | Native browser adapter → missing URL; existing Backend clearance | Native browser adapter → URL ขาด พร้อม Backend clearance เดิม |
| 10. Architecture after | Native browser → hosted development Turnstile page → same Backend clearance | Native browser → หน้า Turnstile development ที่ host → Backend clearance เดิม |
| 11. Refactor list | None; no app/dependency/Frontend/Backend/MIT source modification | ไม่มี refactor ไม่แก้ app/dependency/Frontend/Backend/MIT source |
| 12. Metrics | 3/3 hosted bodies match; state preserved; env validation 0; fresh bundle HTTP 200/all public values; 19/19 tests; Auth 200/CAPTCHA 201 | เนื้อหา host ตรง 3/3 คง state env validation 0 bundle ใหม่ HTTP 200/ค่าครบ tests 19/19 Auth 200/CAPTCHA 201 |
| 13. Technical debt removed | Local deployment/env gap and misnamed public aliases | แก้ช่องว่าง deploy/env ในเครื่องและชื่อ aliases public |
| 14. Risk reduction | Upload only three public assets; preserve old env/resources; restore prior CAPTCHA URL to roll back | Upload เพียงสาม public assets คง env/resources เดิม ย้อนกลับโดยคืน URL CAPTCHA เดิม |
| 15. Developer experience impact | Local app can reload using deployed challenge page; repeatable redeploy recorded | แอป reload เพื่อใช้หน้า challenge ที่ deploy แล้ว บันทึก redeploy ซ้ำได้ |
| 16. Future opportunities | Actual OS return acceptance and real matched widget keys/hostname for production | รับรองกลับผ่าน OS จริงและใช้ keys/hostname ของ widget จริงสำหรับ production |
| 17. Lessons learned | Wrangler new-project delegation needs verified direct Pages mode; NEXT_PUBLIC aliases do not configure Expo; restart stale env process | ตรวจ direct Pages mode เมื่อ Wrangler delegate โครงการใหม่ aliases NEXT_PUBLIC ไม่ตั้ง Expo และ restart process ที่มี env เก่า |
| 18. KPI | Setup checks pass; no production security/browser-device acceptance claim | Checks การตั้งค่าผ่าน ไม่อ้าง production security หรือ browser-device acceptance |

Evidence and rollback: [full EN/TH setup record](../../Mobile/docs/2026-10-05-reader-captcha-setup.md), with initial authentication/JSON parsing failure, Workers delegation failure, stale bundle, wrong dependency paths and unused Backend root 404 documented. Existing test keys passed both dummy and invalid-token controls, so validation is development-only. CUA inventory had no browser/app surface; challenge rendering and real app return remain open. No other deployment was modified; removing this new development project, if requested later, must leave other resources intact. ADR 030 records this operational configuration without a new architecture decision.

หลักฐาน/ย้อนกลับ: รายงาน EN/TH ด้านบนบันทึก auth/JSON parsing แรก Workers delegation ไม่ผ่าน bundle เก่า path dependencies ผิดและ root Backend 404 คู่ test keys ยอมรับทั้ง dummy/invalid controls จึงเป็นหลักฐาน development เท่านั้น CUA ไม่มี browser/app surface จึงยังเปิด acceptance render challenge/กลับแอปจริง ไม่เปลี่ยน deployment อื่น หากขอลบ project development นี้ภายหลังต้องคง resources อื่น บันทึกใน ADR 030 โดยไม่มี architecture decision ใหม่

## 2026-10-05 — Hosted native Auth redirects / ตั้งค่า Auth redirects มือถือ

| Field | English | ไทย |
| --- | --- | --- |
| 1. What changed | Added five native URLs to hosted Auth additional redirects | เพิ่ม native URL ห้าค่าใน Auth redirect settings |
| 2. Results / outcome | Push exit 0; 7/7 live destination probes passed | Push exit 0 ตรวจปลายทางจริงผ่าน 7/7 |
| 3. Expected performance gain % | Not measured; no speed claim | ไม่วัด ไม่อ้างว่าเร็วขึ้น |
| 4. Benefits | Native callbacks accepted; existing web destinations preserved | ยอมรับ callback แอป คงปลายทางเว็บ |
| 5. Purpose | Return existing Auth flows to native app | ให้ Auth เดิมกลับเข้าแอป native |
| 6. Why + architectural impact | Rejected native URLs fell back to localhost; existing shared Auth architecture retained | URL แอปถูกปฏิเสธและ fallback ไป localhost คงสถาปัตยกรรม Auth เดิม |
| 7. Problems before | Native diagnostic callback returned web Site URL | diagnostic callback native กลับไป Site URL เว็บ |
| 8. Goals | Accept exact native URLs without replacing web configuration | ยอมรับ URL แอปตรงค่าและคง config เว็บ |
| 9. Architecture before | Same hosted Auth with ten web redirects | Auth hosted เดิมมี redirects เว็บสิบค่า |
| 10. Architecture after | Same Auth with ten web and five native redirects | Auth เดิมพร้อมเว็บสิบและ native ห้าค่า |
| 11. Refactor list | None; cloud configuration and documentation only | ไม่มี refactor แก้ cloud config และเอกสาร |
| 12. Metrics | Reviewed updates 1 → 0; 17 other remote properties identical; 7/7 destinations | Updates 1 → 0 ค่า remote อื่น 17 ค่าเท่าเดิม ปลายทางผ่าน 7/7 |
| 13. Technical debt removed | Missing native redirect registration | แก้การลงทะเบียน redirect แอปที่ขาด |
| 14. Risk reduction | Sparse declaration, old ten retained, before/after comparison; refresh config and remove only five additions to roll back | Sparse config คงสิบค่าเดิม ตรวจก่อน/หลัง ย้อนกลับโดย pull ล่าสุดและลบห้าค่าที่เพิ่มเท่านั้น |
| 15. Developer experience impact | Retry login without rebuilding for this cloud change | ลอง login ใหม่ได้โดยไม่ build สำหรับ cloud change นี้ |
| 16. Future opportunities | Actual Google/Facebook login, OS return and session acceptance | ตรวจ login Google/Facebook จริง กลับเข้าแอปและ session |
| 17. Lessons learned | Initialize isolated workdir before pull; parse CLI JSON record after text prefix | Init workdir ก่อน pull อ่าน JSON แยกข้อความนำหน้าของ CLI |
| 18. KPI | All requested destinations accepted; no actual provider login claimed | ยอมรับปลายทางครบ ยังไม่อ้าง login บัญชีจริง |

Evidence: [diagnostics, configuration scope, private artifact handling and rollback](../../Mobile/docs/2026-10-05-native-auth-redirects.md). Diagnostic flows were cancelled before provider sign-in/account creation/token exchange. No new app source, dependency or architecture decision; earlier source test/build evidence was not rerun for this cloud-only change. ADR 030 records the operational follow-up.

หลักฐาน: รายงานด้านบนระบุขอบเขต การตรวจและย้อนกลับ ใช้ flow ที่ยกเลิกก่อน login/สร้างบัญชี/แลก token ไม่เปลี่ยน source dependency หรือสถาปัตยกรรม ไม่อ้าง checks source เดิมเป็นการตรวจใหม่ของ cloud change นี้ บันทึกติดตามใน ADR 030

## 2026-10-04 — Native account, Community, Studio and staff implementation / Native บัญชี Community Studio และทีมงาน

| Field | English | ไทย |
| --- | --- | --- |
| 1. What changed | Mobile controllers/native views for remaining approved account/social/Community/creator/staff flows, media/share modules and product links | Controllers/views native Mobile สำหรับบัญชี/social/Community/creator/staff ที่อนุมัติ modules media/share และ product links |
| 2. Results / outcome | Source locally implemented, final review corrections verified; live/visual/release acceptance open | มี source ในเครื่อง ตรวจการแก้ final review แล้ว; ยังเปิด acceptance live/visual/release |
| 3. Expected performance gain % | Not measured; no runtime improvement claimed | ไม่วัด; ไม่อ้าง runtime เร็วขึ้น |
| 4. Benefits | Existing accounts/content/permissions exposed in native workflows with late-response guards | บัญชี/เนื้อหา/สิทธิ์เดิมใช้ผ่าน native พร้อมกันผลล่าช้า |
| 5. Purpose | Complete approved migration using original responsive mobile reference and existing services | ทำ migration ที่อนุมัติตาม responsive mobile เดิมและบริการเดิม |
| 6. Why / architectural impact | Identity/view generations, authoritative ACK reconciliation, public SDK recovery/AAL2, ordered upload uncertainty; ADR 030 | รุ่น identity/view ตรวจ ACK จริง recovery/AAL2 public SDK และลำดับ/ความไม่แน่ชัด uploads; ADR 030 |
| 7. Problems before | Most later-phase native actions absent; private caches/race and device-runtime verification gaps | ขาด actions native phase ภายหลังส่วนใหญ่ และช่องว่าง cache/race/runtime อุปกรณ์ |
| 8. Goals | Preserve contracts/roles/data/design and truthful error/acceptance states | คง contracts/roles/ข้อมูล/design และ error/acceptance ที่ตรงจริง |
| 9. Architecture Before | Phase 1 native controllers plus initial discovery/library/read-only Community | Controllers Phase 1 native พร้อม discovery/library/Community อ่านอย่างเดียวเริ่มต้น |
| 10. Architecture After | Same server/Auth/MIT with Mobile-owned private stores, native forms/media and creator/staff clients | Server/Auth/MIT เดิมกับ private stores/forms/media/client creator/staff ที่อยู่ Mobile |
| 11. Refactor list | Shared native QR, multipart header handling, navigation destinations, private request cancellation | QR native ร่วม multipart headers ปลายทาง navigation และยกเลิกคำขอส่วนตัว |
| 12. Metrics / validation | Post-fix 218/218 tests, typecheck and Hermes 772 modules/~3MB/11 assets; debug assembly 204 tasks passed; six Important findings and Reader preferences corrected with observed RED→GREEN | หลังแก้ 218/218 tests/typecheck/Hermes 772 modules/~3MB/assets 11 ผ่าน; debug assembly 204 tasks ผ่าน; แก้ Important หกข้อและ preferences Reader ด้วย RED→GREEN ที่พบจริง |
| 13. Trade-offs | Native modules require rebuild; latest-50 baseline lists; no invented unsupported APIs or exactly-once guarantees | Modules native ต้อง rebuild; lists ล่าสุด 50 ตามเดิม; ไม่สร้าง APIs ที่ไม่มีหรือรับประกัน exactly-once |
| 14. Debt Before → After | Missing later-phase source → local flows with tests; live/visual/signed acceptance still open, invalid initial tracer RED evidence disclosed | ขาด source phase ภายหลัง → flows ในเครื่องพร้อม tests; ยังเปิด live/visual/signed acceptance และเปิดเผย tracer RED แรกที่ไม่ถูกต้อง |
| 15. Developer Experience Impact | Real SDK external-boundary tests, feature/source matrix and completion ledger | Tests SDK จริง/mock ขอบภายนอก mapping ฟีเจอร์/source และ ledger |
| 16. Future Debt / accepted limits | Correct public env, compare populated native/web mobile and accept signed device release; real React component tests substitute OS and cannot prove device interactions | จัด public env เทียบ native/web mobile populated และรับ signed release บนอุปกรณ์; Tests components React จริงจำลอง OS ไม่ยืนยัน interactions อุปกรณ์ |
| 17. ADR | [ADR 030](../adr/030-mobile-native-account-community-and-creator-contracts.md) | [ADR 030](../adr/030-mobile-native-account-community-and-creator-contracts.md) |
| 18. References | [Feature/acceptance mapping](../../Mobile/docs/2026-10-04-native-full-implementation.md), [ledger](../../Mobile/docs/2026-10-03-native-completion-ledger.md), PRD #724 | [Mapping ฟีเจอร์/acceptance](../../Mobile/docs/2026-10-04-native-full-implementation.md), [ledger](../../Mobile/docs/2026-10-03-native-completion-ledger.md), PRD #724 |

Scope: no additional Backend/Frontend/MIT migration source or schema changes; previously present Backend profile-join fixes are separate. No commit, push, merge or issue closure. No performance/translation benchmark is claimed.

ขอบเขต: ไม่เพิ่ม source/schema changes Backend/Frontend/MIT สำหรับ migration งาน Backend profile joins ที่มีเดิมแยกต่างหาก ไม่มี commit/push/merge/ปิด issue ไม่อ้าง benchmark performance/translation

## 2026-10-03 — Native Phase 2 first delivery / ส่งมอบ Native Phase 2 ชุดแรก

**What & where / อะไรและที่ไหน:** Mobile discovery/navigation/personal/community controllers and native views, history resume through existing Reader, four artwork assets, CLI publisher and bilingual plan/ledgers. Controllers และ native views discovery/navigation/personal/community ใน Mobile, กู้ประวัติผ่าน Reader เดิม, artwork สี่ไฟล์, CLI publisher และแผน/ledgers สองภาษา

**Why / เหตุผล:** User approved Home and the existing responsive mobile navigation as the next native priority while preserving services. ผู้ใช้อนุมัติ Home และ navigation responsive mobile เดิมเป็นลำดับ native ถัดไปโดยคงบริการเดิม

**Before → After / ก่อน → หลัง:** Phase 1 search/Reader shell and unpublished native backlog → Home with six actual native destinations, discovery APIs, initial library/history save/resume and read-only feed/post flows; PRD #724 and 29 slices published. Shell ค้นหา/Reader Phase 1 และ backlog native ที่ยังไม่เผยแพร่ → Home พร้อมหกปลายทาง native จริง, discovery APIs, library/history save/resume เริ่มต้นและเปิดดู feed/post; เผยแพร่ PRD #724 กับ slices 29 งาน

| Field | English | ไทย |
| --- | --- | --- |
| 1. What changed | Added native discovery, tab/filter Back state, initial personal/Community flows and resumable issue publication; source scoped to Mobile | เพิ่ม discovery native, state Back ของ tabs/filters, flows ข้อมูลส่วนตัว/Community เริ่มต้นและเผยแพร่ issues ที่ทำต่อได้; source อยู่ใน Mobile |
| 2. Results / outcome | Home/discovery and guarded history flow implemented locally; full Phase 2 and visual/live acceptance remain open | มี Home/discovery และ history flow ที่ผ่าน gates ในเครื่อง; ยังเปิด Phase 2 ครบและ acceptance ภาพ/บริการจริง |
| 3. Expected performance gain % | Not measured; no runtime percentage claimed | ยังไม่วัด; ไม่อ้างเปอร์เซ็นต์ runtime |
| 4. Benefits | Existing mobile navigation/content accessible natively with shared account data and no service changes | ใช้ navigation/เนื้อหา mobile เดิมแบบ native พร้อมข้อมูลบัญชีร่วมโดยไม่เปลี่ยนบริการ |
| 5. Purpose | Port existing workflows and mobile design; start approved discovery priority | Port workflows/design mobile เดิมและเริ่ม discovery ตามลำดับที่อนุมัติ |
| 6. Why / architectural impact | Small Mobile stores isolate request generations and account ownership; ADR 014 browser proxy unchanged | Stores Mobile ขนาดเล็กแยกรุ่นคำขอและเจ้าของบัญชี; ไม่เปลี่ยน browser proxy ADR 014 |
| 7. Problems before | Native Home/remaining destinations absent; backlog not published; no native shared Chapter/Page resume | ขาด Home/ปลายทาง native ที่เหลือ; backlog ยังไม่เผยแพร่; ไม่มีการกู้ Chapter/Page ร่วมแบบ native |
| 8. Goals | Same services/rules, original responsive mobile reference, truthful error/acceptance states | บริการ/กติกาเดิม, responsive mobile เดิมและ states error/acceptance ที่ตรงจริง |
| 9. Architecture Before | Phase 1 native views over auth/catalog/Reader/translation/Wallet controllers | Views native Phase 1 บน controllers auth/catalog/Reader/translation/Wallet |
| 10. Architecture After | Same services plus native navigation/discovery/personal/Community stores; existing Reader gate used for history | บริการเดิมเพิ่ม stores navigation/discovery/personal/Community native; ใช้ Reader gate เดิมกับประวัติ |
| 11. Refactor list | Native root/tab routing, shared portrait cards/navigation artwork, history position at first ready render; no Backend schema/rule edits | Routing root/tabs native, การ์ดปก/artwork navigation ร่วม, history position ตั้งแต่ ready render แรก; ไม่แก้ schema/กติกา Backend |
| 12. Metrics / validation | 88 → 121 tests (+33), typecheck passed, Hermes 697 → 709 modules / 2.6MB / 10 assets; no LOC or app-performance measurement | Tests 88 → 121 (+33), typecheck ผ่าน, Hermes 697 → 709 modules / 2.6MB / 10 assets; ไม่วัด LOC หรือ performance แอป |
| 13. Technical Debt Removed | Missing native first destinations and unpublished plan; full library mutations/rich Community remain debt tracked by S12/S20 | เติมปลายทาง native ชุดแรกและเผยแพร่แผน; mutations library/rich Community ครบยังติดตามใน S12/S20 |
| 14. Risk Reduction / rollback | Tests cover account/race isolation and ordered acknowledged writes. Revert Mobile store/view wiring together; no server deletion. Pending: visual fidelity, process-kill and cross-device durability | Tests ครอบคลุมการแยกบัญชี/races และ writes เรียงลำดับที่รอ acknowledgement ย้อน store/view wiring Mobile พร้อมกันโดยไม่ลบ server; ยังต้องตรวจภาพ ความคงทนเมื่อ process ปิด/ข้ามอุปกรณ์ |
| 15. Developer Experience Impact | Resumable Node publisher, actual issue URLs, evidence/resume ledger and Mobile-only controller seams | Node publisher ทำต่อได้, issue URLs จริง, ledger หลักฐาน/จุดทำต่อและขอบ controllers เฉพาะ Mobile |
| 16. Future Opportunities | Finish S11 device comparisons, S12/S20 remaining criteria, later social/account/Studio/staff slices | ตรวจอุปกรณ์/ภาพ S11, เกณฑ์ที่เหลือ S12/S20 และ slices social/account/Studio/staff ถัดไป |
| 17. Lessons Learned | Delayed reads/writes require identity/order guards; source export cannot substitute for live/visual acceptance | Reads/writes ช้าต้องมี guards บัญชี/ลำดับ; source export แทน acceptance ภาพ/บริการจริงไม่ได้ |
| 18. KPI | 121/121 tests and export pass; all 30 issues published/open. No claim of complete Phase 2, signed beta, runtime initialization or visual parity | Tests 121/121 และ export ผ่าน; เผยแพร่/เปิด issues ทั้ง 30 งาน ไม่อ้าง Phase 2 ครบ, signed beta, runtime initialization หรือ visual parity |

**Operational finding / ข้อค้นพบ:** Mobile environment validation fails because required `EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` are absent; the file contains Backend configuration keys. No secret values were copied or overwritten. A temporary-credential Metro startup was rejected by automatic approval review with only “blocked by policy”; no bypass. Native visual/live checks remain pending. Validation env Mobile ล้มเพราะขาด public variables API/Supabase สามตัวและไฟล์มีชื่อ config Backend ไม่คัดลอกหรือเขียนทับ secrets การเปิด Metro ด้วย credentials ชั่วคราวถูก automatic approval review ปฏิเสธโดยแจ้งเพียง “blocked by policy” และไม่ได้เลี่ยง ยังรอตรวจภาพ/บริการจริง native

**Links / ลิงก์:** [PRD #724](https://github.com/Slow-Inc/MangaDock/issues/724), [S11 #735](https://github.com/Slow-Inc/MangaDock/issues/735), [S12 #736](https://github.com/Slow-Inc/MangaDock/issues/736), [S20 #744](https://github.com/Slow-Inc/MangaDock/issues/744), [ADR 029](../adr/029-mobile-native-discovery-navigation-and-history.md), [execution ledger / ledger การทำงาน](../../Mobile/docs/2026-10-03-native-phase2-implementation.md). Uncommitted; no PR/merge/issue closure. ยังไม่ commit; ไม่มี PR/merge/ปิด issue

## 2026-10-03 — Android SDK local configuration / ตั้งค่า SDK เฉพาะเครื่อง

**What & where / อะไรและที่ไหน:** Added ignored `Mobile/android/local.properties` with the installed SDK path; updated [Mobile setup](../../Mobile/README.md#android-sdk-location-on-windows). เพิ่มไฟล์ local ที่ Git ignore ให้ชี้ SDK ที่ติดตั้งแล้ว และอัปเดตวิธีตั้งค่า Mobile

**Why / สาเหตุ:** SDK exists but both SDK environment variables are unset and local properties was absent. SDK มีอยู่จริง แต่ environment SDK ทั้งสองตัวยังว่างและไม่มีไฟล์ local properties

**Before → After / ก่อน → หลัง:** `gradlew.bat help` reproduced root-project configuration failure → original x86_64 `app:assembleDebug` succeeded with `sdk.dir`. ทำซ้ำ error ตอน configure root project ได้ → คำสั่ง build x86_64 เดิมผ่านหลังเพิ่ม `sdk.dir`

**Performance Δ / ประสิทธิภาพ:** Not measured; application runtime unchanged. ไม่ได้วัด; runtime แอปไม่เปลี่ยน

**Quality & validation / คุณภาพและการตรวจ:** Build exit 0, 204 tasks, 5 executed / 199 up-to-date. This verifies SDK discovery and debug assembly, not physical-device/live-service acceptance. Build exit 0 จำนวน 204 tasks รัน 5 / up-to-date 199 ยืนยันการหา SDK และ debug assembly แต่ยังไม่ยืนยันเครื่องจริงหรือบริการจริง

**Risk / rollback / ความเสี่ยงและย้อนกลับ:** Machine-specific path, ignored by Git; clean prebuild can remove it. Recreate for the actual SDK or set `ANDROID_HOME`; remove this local file to revert. No dependency/source change. Path เฉพาะเครื่อง ไม่เก็บใน Git และ clean prebuild อาจลบได้ ให้สร้างใหม่ตาม SDK จริงหรือตั้ง `ANDROID_HOME`; ลบไฟล์ local เพื่อย้อนกลับ ไม่แก้ dependencies/source

**Links / ลิงก์:** [History / ประวัติ](../../DONE.md). Uncommitted; no new issue/PR. ยังไม่ได้ commit; ไม่มี issue/PR ใหม่

## 2026-10-02 — Native port of the existing responsive mobile UI

**What & where / อะไรและที่ไหน:** `Mobile/App.tsx`, five native view/chrome modules, `design.ts`, optional catalog display metadata, six PNG assets and a development generator; Mobile PRD/slice/ledger notes. [Source mapping and captures / Mapping และภาพ](../../Mobile/docs/2026-10-02-native-responsive-design-parity.md).

| Field | English | ไทย |
| --- | --- | --- |
| 1. What changed | Original artwork/palette, cover grid/detail hierarchy, sign-in order, wallet presets and compact Reader controls | Artwork/สีเดิม, grid ปก/ลำดับรายละเอียด, ลำดับ Login, presets เติมเงินและ controls Reader กระชับ |
| 2. Results / outcome | Native presentation follows the existing mobile reference; all-screen visual equality remains open | การแสดงผล native อิงต้นแบบ mobile เดิม; ยังไม่ยืนยันว่าตรงทุกหน้า |
| 3. Expected performance gain | Not measured; no performance percentage claimed | ยังไม่ได้วัด; ไม่อ้างเปอร์เซ็นต์ประสิทธิภาพ |
| 4. Benefits | Preserves the existing product identity and familiar screen hierarchy | รักษาอัตลักษณ์และลำดับหน้าจอที่ผู้ใช้คุ้นเคย |
| 5. Purpose | Port the existing mobile design to native components | Port design mobile เดิมเป็น native components |
| 6. Why / architectural impact | User clarified the baseline; controller/service boundaries remain unchanged | ผู้ใช้ชี้แจงต้นแบบ; ขอบ controllers/services คงเดิม |
| 7. Before | Temporary purple shell, horizontal search rows, crowded Reader controls | Shell ม่วงชั่วคราว, ผลค้นหาแนวนอน, controls Reader แน่น |
| 8. Goals | Reuse original mobile identity without redesigning the product | ใช้อัตลักษณ์ mobile เดิมโดยไม่ออกแบบผลิตภัณฑ์ใหม่ |
| 9. Architecture before | Native views over Mobile controllers and existing services | Native views บน Mobile controllers และบริการเดิม |
| 10. Architecture after | Same boundaries; shared native tokens/chrome and local image assets | ขอบเดิม; ใช้ native tokens/chrome ร่วมและ image assets ในแอป |
| 11. Refactor list | Presentation-only screen styles/layout and shared artwork; API queries unchanged | Styles/layout และ artwork ฝั่งแสดงผล; API queries คงเดิม |
| 12. Metrics / validation | 88 tests passed, typecheck passed, 697-module / 2.5MB Hermes export; emulator sign-in render inspected | 88 tests ผ่าน, typecheck ผ่าน, Hermes export 697 modules / 2.5MB; ตรวจภาพ Login จริงบน emulator |
| 13. Debt removed | Unrelated native palette and missing original logo; exact bundled font metrics still pending | สี native ที่ไม่ตรงและโลโก้เดิมที่ขาด; metrics ฟอนต์ที่ bundle ยังรอตรวจ |
| 14. Risk / rollback | UI density and font-scale checks remain; revert views/assets independently of controller logic | ยังต้องตรวจความหนาแน่น UI/text scale; ย้อน views/assets แยกจาก logic controllers ได้ |
| 15. Developer experience | Explicit source-to-native mapping and repeatable asset generation | มี mapping แหล่งเดิมกับ native และสร้าง assets ซ้ำได้ |
| 16. Future opportunities | Port Phase 2 destinations with the original six-item mobile navigation | Port หน้าปลายทาง Phase 2 พร้อม navigation mobile หกเมนูเดิม |
| 17. Lessons learned | Functional parity tests do not establish visual parity; read actual mobile branches alongside DESIGN.md | Tests ฟังก์ชันไม่ยืนยันภาพ; อ่าน mobile branches จริงคู่ DESIGN.md |
| 18. KPI | Visual acceptance open; no signed APK or live account/payment/translation acceptance claimed | ยังเปิด visual acceptance; ไม่อ้าง signed APK หรือ acceptance บัญชี/ชำระ/แปลจริง |

**Quality / คุณภาพ:** new sign-in hierarchy/artwork were inspected on the already-installed emulator app; offline search reports connection failure instead of a false zero-results success. Populated detail, Wallet and Reader visuals require a configured reachable Backend. / ตรวจลำดับ Login และ artwork ใหม่ในแอป emulator ที่ติดตั้งแล้ว; ค้นหา offline แสดงปัญหาการเชื่อมต่อแทนผลสำเร็จศูนย์เรื่อง ยังต้องตรวจรายละเอียดที่มีข้อมูล Wallet และ Reader กับ Backend ที่พร้อม

**Operational limit / ข้อจำกัด:** port 4001 was unreachable. Agent-started Backend failed environment validation for missing Supabase URL/service-role configuration and was stopped; credentials and Backend source were unchanged. / Port 4001 เข้าถึงไม่ได้; Backend ที่ agent เปิดเองล้มจาก environment Supabase URL/service-role ที่ขาดและหยุดแล้ว ไม่แก้ credentials หรือ source Backend

**Links / status / ลิงก์และสถานะ:** [Mobile decision and evidence / การตัดสินใจและหลักฐาน](../../Mobile/docs/2026-10-02-native-responsive-design-parity.md), [history / ประวัติ](../../DONE.md). Local uncommitted changes; no issue/PR published. / แก้ในเครื่อง ยังไม่ commit และไม่มี issue/PR ที่เผยแพร่

## 2026-10-02 — Android Gradle wrapper compatibility

**What & where:** restored generated `Mobile/android/gradle/wrapper/gradle-wrapper.properties` to Gradle 9.3.1; updated Mobile README and execution ledger. **Why:** 9.4.1 embeds Kotlin 2.3.0, rejected by the installed RN/Expo settings-plugin compiler; both installed reference wrappers use 9.3.1. **Before → After:** wrapper selected incompatible metadata → wrapper matches the SDK template (embedded Kotlin 2.2.21). Full APK outcome remains unverified.

**Performance Δ:** not measured. **Quality:** restores the template's toolchain without modifying plugin code or suppressing checks. **Validation:** user's failed build is the reproduction; inspected installed Expo template and RN wrapper, plus Gradle 9.3.1 `--version`. Agent assemble remains blocked by Java real-path `AccessDeniedException`, reproduced separately on a readable workspace JAR. No successful APK or settings-plugin compilation claimed. **Risk / rollback:** generated native directory is ignored; fresh prebuild already selects 9.3.1. Restoring 9.4.1 restores the known mismatch. **Links / status:** [Mobile ledger](../../Mobile/docs/2026-10-02-native-phase1-implementation.md), [Gradle matrix](https://docs.gradle.org/current/userguide/compatibility.html#kotlin); local uncommitted change, no issue/PR. Next verification is `npm.cmd run android` in the user's normal terminal.

**ภาษาไทย — อะไรและที่ไหน:** คืน wrapper ที่สร้างอัตโนมัติใน `Mobile/android/gradle/wrapper/gradle-wrapper.properties` เป็น Gradle 9.3.1 และอัปเดต Mobile README/ledger **เหตุผล:** Kotlin 2.3.0 ใน 9.4.1 ใหม่เกิน compiler ของ RN/Expo settings plugins; wrappers อ้างอิงที่ติดตั้งทั้งสองใช้ 9.3.1 **ก่อน → หลัง:** เลือก metadata ที่ไม่เข้ากัน → เลือก toolchain ตรง SDK template (Kotlin 2.2.21) ยังไม่ยืนยันผล APK

**ประสิทธิภาพ:** ยังไม่ได้วัด **คุณภาพ:** คืน toolchain ตาม template โดยไม่แก้ plugin หรือปิดการตรวจ **ตรวจสอบ:** log build ที่ล้มของผู้ใช้เป็นตัวทำซ้ำ; ตรวจ template Expo, wrapper RN และ `--version` ของ Gradle 9.3.1 การ assemble ของ agent ยังติด Java หา real path แล้วได้ `AccessDeniedException` ซึ่งทำซ้ำแยกได้กับ JAR ใน workspace ที่อ่านได้ ไม่อ้างว่า APK หรือ settings plugin compile ผ่าน **ความเสี่ยง / ย้อนกลับ:** native directory ไม่เก็บใน Git; prebuild ใหม่ใช้ 9.3.1 อยู่แล้ว การคืน 9.4.1 จะกลับไปชนปัญหาเดิม **ลิงก์ / สถานะ:** [Mobile ledger](../../Mobile/docs/2026-10-02-native-phase1-implementation.md), [ตาราง Gradle](https://docs.gradle.org/current/userguide/compatibility.html#kotlin); แก้ในเครื่อง ยังไม่ได้ commit และไม่มี issue/PR ขั้นต่อไปคือ `npm.cmd run android` ใน terminal ปกติของผู้ใช้

## 2026-10-02 — Backend profile-join compilation and mapping fix

2026-10-20 commit preparation: focused lint normalized only these three services and their three SDK-boundary regression files. Test fetch handlers now return explicit Promises with typed inputs and read `Request.url` correctly; removed an unused review import. No profile/API behavior changed. Fresh Backend build and full CI suite **90/960**, final focused regressions **12/12** and focused ESLint verify this follow-up; no performance improvement claimed.

ภาษาไทย: เตรียม commit วันที่ 2026-10-20 จัด lint เฉพาะสาม services และสาม regression files ที่ใช้ SDK boundaries ให้ fetch คืน Promise ชัดเจน มี input types และอ่าน `Request.url` ถูกต้อง ลบ import review ที่ไม่ใช้ ไม่เปลี่ยน profile/API behavior ตรวจ Backend build/CI **90 suites/960 tests**, regressions เฉพาะ **12/12** และ ESLint ไม่อ้างความเร็วเพิ่ม

**What & where:** `Backend/src/reader-comments/reader-comments.service.ts`, `reviews/reviews.service.ts`, and `user-follows/user-follows.service.ts`; three new adjacent regression specs.

**Why:** five TS2352 errors blocked compilation: the untyped Supabase client inferred joined `profiles` as an array, while the service DTOs and casts required a single object. Controlled SDK responses also reproduced missing author details and undefined follow fields for arrays.

**Before → After:** compilation failed and array joins lost profile data → build passes; mappers accept object/array/null, selecting the related profile and handling absent joins. Existing queries and API response fields remain unchanged.

**Performance Δ:** not measured; no new query or dependency. **Quality:** author details survive either populated join shape; absent profiles preserve null author fields or are excluded from follow lists.

**Validation:** TDD failures on public service methods through the real Supabase SDK with mocked HTTP, then 12 new passing regression tests. `npm.cmd run build` passed; full Backend suite: 90 suites / 960 tests passed. Live database connectivity was not exercised.

**Risk / rollback:** array handling assumes one profile per user and selects the first entry. No schema/auth/payment change. Rollback is confined to these three services and specs, but restores the reported compile errors. **Links / status:** [history](../../DONE.md); local uncommitted change, no issue/PR published.

### ภาษาไทย

**อะไรและที่ไหน:** `Backend/src/reader-comments/reader-comments.service.ts`, `reviews/reviews.service.ts` และ `user-follows/user-follows.service.ts` พร้อม regression specs ใหม่ข้างไฟล์ทั้งสาม

**เหตุผล:** TS2352 ห้าจุดทำให้ compile ไม่ผ่าน: Supabase client ที่ไม่มี type ของ schema อนุมาน `profiles` ที่ join เป็น array แต่ DTO และ cast ใน service รับเพียง object เดี่ยว ทดสอบผ่าน SDK ด้วย response ที่ควบคุมได้ยังพบว่ารูปแบบ array ทำให้ชื่อ/รูปหายและฟิลด์ follow เป็น undefined

**ก่อน → หลัง:** compile ไม่ผ่านและ array join ทำข้อมูล profile หาย → build ผ่าน; ตัวแปลงรองรับ object/array/null เลือก profile ที่เกี่ยวข้องและจัดการ join ว่าง โดยคง query และฟิลด์ response API เดิม

**ผลต่อประสิทธิภาพ:** ยังไม่ได้วัด; ไม่มี query หรือ dependency เพิ่ม **คุณภาพ:** ชื่อ/รูปถูกส่งคืนทั้งสองรูปแบบที่มีข้อมูล; profile ว่างคงชื่อ/รูปเป็น null หรือถูกข้ามในรายการ follow

**ตรวจสอบ:** TDD พบข้อผิดพลาดจาก public service methods ผ่าน Supabase SDK จริงและ HTTP จำลอง ก่อนแก้จน regression tests ใหม่ 12 เคสผ่าน `npm.cmd run build` ผ่าน; ชุดทดสอบ Backend ทั้งหมด 90 suites / 960 tests ผ่าน ยังไม่ได้ทดสอบการเชื่อมต่อฐานข้อมูลจริง

**ความเสี่ยง / ย้อนกลับ:** รูปแบบ array สมมติว่าผู้ใช้มีหนึ่ง profile และเลือกตัวแรก ไม่มีการเปลี่ยน schema/auth/payment สามารถย้อนเฉพาะสาม services และ specs แต่จะกลับไปพบ compile errors เดิม **ลิงก์ / สถานะ:** [history](../../DONE.md); แก้ในเครื่อง ยังไม่ได้ commit และไม่มี issue/PR ที่เผยแพร่
## 2026-10-20 — MIT quality loop round 2: #793 Thai tone marks, #791/#792 spaces + punctuation, review fixes

**What & where:** `rendering/text_render.py` — `_stacked_mark_lift` + line loop in `put_text_horizontal` (#793), `compact_special_symbols` (#792), `_insert_thai_word_breaks` / `_glue_thai_tokens` / `_fit_syllable` / `_greedy_pack` guard (#791 + review); `translation_quality.py` (shared script table, `classify_glitch`, source-aware `foreign_script`) + `translators/common.py` (`_is_glitched(query, …)`); `ocr_vlm.py` (half-open `_Breaker`); `text_layer.empty_patch_result`; `tools/doctor_page.py` (prod font).
**Why:** every Thai page lost the tone mark of words like `ที่ นี้ ชื่อ ตั้งแต่` with the prod font (no OpenType shaping); spaces the translator wrote were dropped; English lost the space after `,`/`!` (`Well,I`); review found a mid-word split, a JP-source re-ask loop and a breaker that never recovered.
**Before → after:** stacked marks visible in 66/156 corpus regions (42%) that showed them missing; `RTSD,ZERO` → `RTSD, / ZERO`; `ขับขี่รถ / ยนต์` → `ขับขี่ / รถยนต์`; JP page with a kept kana SFX 3 LLM calls → 1.
**Perf Δ:** none measurable in the renderer (two glyph lookups per stacked mark; Thai segmentation now lru_cached across the fit scan). SFX rescue costs at most one trial call per 300 s while the breaker is open.
**Quality:** replay A/B with identical translations — spill 7 → 7 in both A/Bs; font changes 5/177 (#791/#792) and 2/156 (#793).
**Validation:** red-first unit tests for each fix (tone height, compaction, glue, recursive split, packer guard, source-aware glitch, one-trial breaker); full MIT suite 872 passed; benchmarks `2026-10-20-791-792-thai-spaces-punctuation.*`, `2026-10-20-793-thai-tone-marks.*`.
**Also (#795/#754/#797; #796 reverted):** anti-overlap sibling territories (`rendering/__init__.py:_neighbor_territories`), junk-read DROP (`ocr_vlm.sfx_false_positive` / `speculative_box`, `TextBlock.speculative` = every line a det_sfx box or rescue placeholder, `detection_postproc._placeholder_quad`). Junk one-letter regions 6 → 0 on the corpus, real lettering kept; doctor `overlap` verdict added and replay made deterministic. #796 (2-line merge pitch 2×) shipped then reverted after review: it disabled the 2-line split for every aligned pair.
**Risk / follow-up:** shaping is still absent (tall-consonant mark offsets, other scripts' GPOS) — HarfBuzz is the general fix; Chainsaw p0 red credit lines overlap (layout); #757 merge default still opt-in pending more pages.

## 2026-10-20 — MIT quality loop: #756 doctor page mode, #757 container merge (opt-in), #760 ink-cluster gate, #761 bubble-fit scan

**What & where:** `MIT/tools/doctor_page.py` + `tools/pipeline_doctor/page_probes.py` (new, tooling); `manga_translator/container_merge.py` (new) + `textline_merge/__init__.py` (+`containers` param) + `manga_translator.py` (`_bubble_polygons` cache, `_textline_containers`) + `config.py` (`det_bubble_merge`); `detection_postproc.uncovered_text_clusters` (`max_width_frac`); `font_fit.py` (descending scan, `area_font_cap`) + `rendering/__init__.py` (`_bubble_fit_font_size` cap); `Backend/src/books/mit-config.ts` (`MIT_BUBBLE_MERGE`).
**Why:** EN→TH captions translated per line; junk panel-wide region rendered a 120 px glyph; sole-occupant balloons fitted at 13 px with room for 26.
**Before → after:** caption page regions 21 → 8 (merge on); `'d'` junk region gone (detect FAIL → OK); bubble_fit_sole font 13/15/21 → 26/22/24 px with identical translations.
**Perf Δ:** fit scan 6–24 ms/region (bounded by area cap); balloon detection is cached on ctx, so merge-on adds no second YOLO pass in the patches path.
**Quality:** replay A/B (17 pages): no region smaller with identical translation; composite failures 0 → 0.
**Validation:** unit tests red-first for every change (container_merge 10, doctor page 13, font_fit 10, detection_postproc 19, Backend spec 42); deterministic replay benchmark with PNG.
**Also (same loop):** #759 Thai line breaking (`text_render._glue_thai_tokens`, atomic Thai words, `_thai_subwords`) — replay A/B 0 font changes, spill unchanged, bad breaks fixed; #763 `CommonTranslator._is_glitched` + `manga_translator/translation_quality.py` — foreign-script leaks 1–2 → 0 per corpus run, one extra LLM call only on a leaking page; #762 prompt A/B inconclusive on style, v2 YAML kept as an experiment.
**Risk / follow-up:** merge stays opt-in until more pages; wrapper overshooting `max_width` (root of the non-monotonic fit) still open; SFX katakana transliteration junk (`ベ`→`เบ`) and translation prompt quality are next.

## 2026-10-20 — #693: SFX rescue gate = ocr_vlm.should_rescue_sfx on integrate (quality guard)

**What & where:** `MIT/manga_translator/manga_translator.py` (rescue call site), removed
`sfx_merge.should_sfx_rescue` + 2 tests; ADR 026 amended; comment/doc touch-ups.
**Why:** restore ADR 026's Addendum real-text guard (dev decision, #693).
**Before → after:** det_sfx region read as ASCII on a bubble → *before:* eligible for the vision
rescue (phantom SFX risk); *after:* not rescued. ≤2-char non-ASCII read without provenance in a large
box → *after:* eligible (landing never rescued it) — inert while the rescue is unserved.
**Perf Δ:** none measurable (one regex per region when `vlm_rescue` is on).
**Quality:** render-neutral on the current model; gate 11/12 vs 5/12 on the documented set.
**Validation:** guard test red → green; MIT suite 806 passed.
**Risk / follow-up:** One-Punch `ぬ` not rescued (accepted); DROP half #754; bubble-overlap gate open.

## 2026-09-26 — #694: SFX rescue logs why a reply produced no SFX (observability)

**What & where:** `MIT/manga_translator/ocr_vlm.py` (`vlm_localize_sfx`, ~10 lines),
`MIT/test/test_ocr_vlm.py` (4 tests).

**Why:** a truncated or `None` vision reply collapsed to `''`, indistinguishable from "no SFX here";
two past investigations were misdirected by that silence.

**Before → After:** silent `''` → the same `''` plus one `WARNING` naming `finish_reason`, the
content, `max_tokens`, and the crop size (or the raw reply, when sanitising emptied it).

**Performance Δ:** none measurable — one dict lookup and, on the failure path only, one log line.

**Quality:** no render change; return values identical on every path (asserted by the tests).
Side effect: on the currently served thinking model, where every SFX call truncates at
`max_tokens=24`, each rescue attempt now emits a warning — that volume *is* the signal.

**Validation:** 3 red → green; 3 mutations each killed by exactly one test; 47 passed on the
ocr_vlm-related suites.

**Risk / rollback:** log-only; rollback = revert.

**Tech-debt register:** `sanitize_sfx` lets `(no sound effect)` / `EMPTY LINE` style refusals through
as lettered text (seen here, measured by #688's `sanitize` probe) — needs its own issue.

**Links:** #694, #688, #679, #631.

---

## 2026-08-31 — #688: Pipeline Doctor LLM/gateway contracts (feature / test-infra)

**What & where:** `MIT/tools/pipeline_doctor/llm_contracts.py` (new, ~245 lines — four probes plus
`capture_sfx_call` / `SfxCall` / `DoctorPage`), `MIT/test/test_pipeline_doctor_llm.py` (new, 20
tests). **No pipeline code touched** — `manga_translator/ocr_vlm.py` is imported and exercised, not
modified.

**Why:** the LLM/gateway layer had no observability of any kind. The three defects found on
2026-07-28 took ~10 hand-written probes to locate, and all three were invisible to the 111 MIT test
files, the `mit_logic` gate, and every `tools/diag_*.py` script — those cover the GPU half and stop
before the LLM call.

**Before → after:** a truncated reply collapsed to `''`, indistinguishable from "this region has no
SFX" (the silence that made the 2026-07-11 investigation conclude "text MoE" and move on). Now one
walk emits four rows: `vlm-send` FAIL (budget 24 ≤ 2048 measured to truncate; thinking unset),
`vlm-image` WARN (~40 visual tokens vs 336 measured answerable), `vlm-recv` FAIL
(`finish_reason=length, content=None`), `sanitize` FAIL (`'EMPTY LINE'` survives sanitising).
`exit_code=1`.

**Perf Δ:** none on any production path — nothing here runs in the pipeline. The probes add ~0.3 s
to the `mit_logic` gate (20 tests), no GPU, no network.

**Quality:** the contracts capture the request from the **real** `vlm_localize_sfx` through its
`post_fn` seam, so they track production code rather than a copy of it. Every threshold is a cited
measurement; two bands ship as WARN because their boundary is unmeasured (vision floor = one
measurement; budget 2048–4096 = untested).

**Validation:** 20 new tests green; mutation-tested 6/6 (each mutation reverted in isolation — the
strongest being "capture a hand-written body instead of the real call", which reds 9 of 20). Full
MIT suite 768 passed / 1 pre-existing failure (`test_online_translators`, live Papago endpoint,
excluded from the gate). Benchmark + PNG: `docs/reports/benchmarks/2026-08-31-688-doctor-llm-contracts.md`.

**Risk / debt carried forward:**
- **#688 D1 not done, premise void on this base.** The five thinking/budget helpers the issue asks
  to extract from `custom_openai` do not exist on `main` — they arrived with #623 on `perf`. The
  translator path therefore stays outside the gate; revisit after Phase E.
- **The vision floor is one measurement.** 336 is a size that worked, not a located boundary.
  #689's sweep is what turns it into a threshold. Until then it must never be a FAIL.
- **The refusal corpus is observational**, not an enumeration. New refusal wording leaks until added.
- **Production is still silent.** These probes only speak inside a Doctor run; `ocr_vlm` itself
  still swallows `finish_reason: length`. That is the benchmark's verdict #4 and is filed separately.

---

## 2026-08-31 — #686: Pipeline Doctor core — report model + probe registry (feature / test-infra)

**What & where:** `MIT/tools/pipeline_doctor/` (new package — `report.py`, `runner.py`,
`__init__.py`, 188 lines), `MIT/test/test_pipeline_doctor_core.py` (new, 13 tests). No pipeline code
touched.

**Why:** #685's other five deliverables each need somewhere to report *to*. Without a shared model
every probe would invent its own output, and the Doctor would decay into another `tools/diag_*.py`
nobody runs. This is the seam, built first and deliberately empty of pipeline knowledge.

**Before → After:** no package → a `StageReport`/`DoctorRun` model, a `ProbeRegistry` that probes
attach to by decorator, and two renderers (aligned text table, JSON) driven from one walk. Probes
register themselves on import, so the core holds no stage list; registration order is pipeline
order. A probe that raises becomes a `FAIL` row and the walk continues.

**Performance Δ:** none — the package is not on any request path; it is a developer/CI tool. Import
cost is `dataclasses` + `typing` only, which is what keeps it inside the torch-free `mit_logic` gate.

**Quality:** additive; no existing behaviour changes. The one hardening decision worth recording is
that `to_table` escapes control characters rather than stripping them — probe evidence for the LLM
stages is text the *model* wrote, so a raw `[2J`/`[31m` would clear or recolour the
developer's terminal and let a `FAIL` row be dressed up as anything. Escaping keeps the bytes
legible as evidence; `to_json` stays verbatim because JSON already escapes them and an agent should
receive exactly what the model sent.

**Validation:** TDD, RED first (`ImportError: cannot import name 'ProbeRegistry'`). Because an
ImportError red only proves absence, each assertion was additionally mutation-checked: four
mutations (`sorted(self._probes)`, dropping the `is not None` guard, letting a probe crash
propagate, `_one_line` as identity) each redden exactly the test naming that behaviour. CI
`mit_logic` gate **651 passed, 3 skipped, 0 failed** (run 33361709801); local full-deps run **740
passed, 2 skipped, 0 failed**. Benchmark + committed PNG:
`docs/reports/benchmarks/2026-08-31-686-pipeline-doctor-core.md`.

**Tech debt created (tracked, not silent):** a run in which every probe declines reports
`ok=True`/`exit_code=0` with zero stages — a CI gate wired to it would go green having inspected
nothing. The core cannot know which stages *should* have reported, so the "expected stage set"
assertion belongs to **#690**, where it is recorded rather than left to be rediscovered.

---

## 2026-07-28 — #679: SFX wiring guard tested at the behaviour, and an ADR-026 gap surfaced

**What & where:** `MIT/test/sfx_gate_scan.py` (new, pure `ast`), `MIT/test/test_sfx_gate_scan.py`
(new, 7 tests), `MIT/test/test_stage_c_wiring.py` (the #278 assertion rewritten + one new
assertion), `docs/adr/026-mit-sfx-rescue-provenance-gate.md` (Amendment).

**Why:** the guard asserted the literal symbol `should_rescue_sfx`, so a deliberate, benchmarked
swap to landing's equivalent gate made it fire with a message that misdescribed the cause. A guard
that cannot be tested itself, and that pins an implementation rather than a behaviour, produces
false alarms and — as here — hides the requirement it is not checking.

**Before → After:** one implementation-coupled assertion → a pure rule exercised against synthetic
drivers, plus **two separate assertions** matching ADR 026's two requirements (provenance gating;
the Addendum's real-text guard). The gate-less driver case the guard exists for is now actually
covered, which it never was.

**Performance Δ:** none (test-infra).

**Quality:** no production code changed. The change is in what CI can see: on
`integrate/render-reconcile` the rescue path never consults the line-OCR read, so the phantom
target-language onomatopoeia over real dialogue that ADR 026's Addendum closed is reachable there.
That now fails a test instead of passing silently.

**Validation:** 10 tests over both files; full torch-free suite 646 passed, 0 failed on `main`.
Both checks were run over both real drivers: `main` = provenance `should_rescue_sfx` + guard yes;
`integrate/render-reconcile` = provenance `should_sfx_rescue` + guard no.

**Risk / rollback:** test-infra only; rollback = revert. Deliberate consequence: the branch's
`mit_logic` stays red until the trade-off is decided — that is the intended signal, not breakage.

**Tech-debt register:** (1) the SFX-gate trade-off is **open** — ADR 026's Amendment records it and
requires a superseding benchmark covering both the stylized SFX case and an ASCII det_sfx
false-positive; (2) whichever gate loses becomes dead code to remove, together with
`textline_merge/__init__.py`'s comment that still names `should_rescue_sfx` as *the* rescue path;
(3) `ocr_vlm.should_rescue_sfx` currently has passing tests and no caller on the branch.

**Links:** #679, #278, #609, #626, #642, ADR 026.

---

## 2026-07-28 — #680: glyph cache ignored font switches (render correctness)

**What & where:** `MIT/manga_translator/rendering/text_render.py` (`set_font`, new
`_SELECTED_FONT_PATHS`), `MIT/test/test_font_switch_cache.py` (new, 2 tests).

**Why:** `get_char_glyph` is memoised on `(cdpt, font_size, direction)`, a key with no font in it,
while `set_font()` swaps the global `FONT_SELECTION`. Cached characters kept rendering with the
previous font — wrong glyph bitmaps and wrong advances, therefore wrong line-wrap widths.

**Before → After:** a font switch inside a live worker silently reused the prior font's glyphs for
every char/size in the 1024-entry cache → the memo is dropped exactly when the font selection
changes. Same-font `set_font()` (the per-request `dispatch_render` case) still keeps the cache, so
there is no per-page rebuild.

**Performance Δ:** none on the hot path (same-font calls unchanged); one cache rebuild per actual
font switch, which is rare.

**Quality:** render correctness — this is a real defect fix, not a refactor. Wherever the bug was
live the output changes to the *correct* glyphs. Deployments that only ever use one font were
unaffected, which is why it went unnoticed.

**Validation:** TDD at the public seam (`set_font` in, rendered advance out) — RED `38 == 38`,
GREEN `32`. Deterministic before/after with only this source change differing: `1 failed, 635
passed` → `636 passed, 0 failed`. The pre-existing failure it clears
(`test_resize_regions_bubble_fit_byte_identical`) had been attributed to cross-platform freetype
drift (#541) and turned into a skip; same-env evidence points at this cache instead, and whether
the Linux-CI mismatch shares the cause is now falsifiable by whether that golden starts asserting.

**Risk / rollback:** low and contained — one conditional in `set_font()`. Rollback = revert. Residual:
`_SELECTED_FONT_PATHS` tracks paths, so a font file mutated in place under the same path would not
invalidate (not a real workflow here).

**Tech-debt register:** the four goldens that exposed this were only reachable because collection
errors (#643) had been hiding the MIT suite on `integrate`. Still open: #680 Cause A (the merge
reverted #541's portability verdict on `integrate` — restore **after** this fix, or it converts
these failures back into skips) and #679 (a call-graph test asserting a symbol name rather than
behaviour).

**Links:** #680, #679, #643, #541, #503, #626, #642.

---


## 2026-07-28 — #678/#640: CI gates made real (unit-test selection, guard suites, mobile typecheck)

**What & where:** `.github/workflows/ci.yml` (frontend job, new `scripts` job, new `mobile` job,
`gate`), `scripts/lib/frontend-unit-tests.mjs` + `scripts/list-frontend-unit-tests.mjs` + tests,
`scripts/README.md`.

**Why:** `integrate/render-reconcile` failed CI the first time it was ever run through the pipeline,
blocking Phase E of #626/#548 — and at the repo level no job ran the guard suites at all, so a guard
could be broken and stay green. #534 also landed `Mobile/` with no CI covering it (#639).

**Before → After:** unit-test selection was an inline `find` blacklist extended by hand per qualifier
→ a pure function with 5 tests plus a CLI that fails closed on an empty selection. Guard suites ran
**nowhere** in CI → a required `scripts (node --test)` job. `Mobile/` had no CI → a path-filtered
strict typecheck wired into `gate`. The `frontend` job depended on an undeclared `node` → declared.

**Performance Δ:** none (test-infra). `scripts` ≈ 10–25s, unfiltered by design; `mobile` ≈ 25s,
path-filtered.

**Quality:** no product-behavior change; no application code touched.

**Validation:** every claim checked against job logs rather than the green checkmark —
`scripts` `# tests 58 / # pass 58 / # fail 0`; `frontend` `Ran 226 tests across 33 files`; `mobile`
typechecks 3 real files, and a deliberate `error TS2322` was shown to exit 2 and fail the step,
finally demonstrating #639's stated acceptance criterion. Both PRs green on the required `gate`;
#640 was rebased off a 64-commit-stale base before merging (the #553 lesson).

**Risk / rollback:** low, additive. Rollback = revert #678 / #640. Residual: `gate` still treats only
`result == 'failure'` as failing, so a cancelled/timed-out job does not block — pre-existing for every
job, now inherited by `scripts` and `mobile` too; worth a follow-up.

**Links:** #643, #678, #639, #640, #642, #626, #548, #679, #680.

---

## 2026-07-28 — #643/#678: CI gates made real (frontend unit selection + torch-free collection)

**What & where:** `.github/workflows/ci.yml` (frontend job, new `scripts` job, `gate`),
`scripts/lib/frontend-unit-tests.mjs` + `scripts/list-frontend-unit-tests.mjs` + tests,
`scripts/README.md`; `MIT/test/conftest.py`, `MIT/test/heavy_imports.py`,
`MIT/test/test_heavy_test_list.py`.

**Why:** `integrate/render-reconcile` failed CI the first time it was ever run through the pipeline
(draft PR #642), blocking Phase E of #626/#548. Both failures were pre-existing and invisible because
the branch had never been CI-verified — and, at the repo level, because no job ran the guard suites.

**Before → After:** unit-test selection was an inline `find` blacklist extended by hand per qualifier
→ a pure function with 5 tests and a CLI that fails closed on an empty selection. Guard suites
(`issue-ref`, `worktree-budget`, `pr-bilingual`, `append-only`) ran **nowhere** in CI → a required
`scripts (node --test)` job. MIT torch-free gate: **4 collection errors → 0** (638 tests collected);
`_HEAVY_TESTS` drift was detectable only via an after-the-fact CI collection error → a local,
torch-free AST guard that names the offenders.

**Performance Δ:** none (test-infra only). New `scripts` job ≈ 11s, unfiltered by design.

**Quality:** no product-behavior change. Render/translation paths untouched —
`MIT/manga_translator` tree byte-identical (`1a073c0c`) across both the fix and the `main` catch-up
merge, so the #626 render==baseline claim is unaffected.

**Validation:** PR #678 green on every check including the required `gate` (`scripts` 11s,
`frontend` 17s, `mit_logic` 2m16s, `mit_heavy` 4m18s, `backend` 52s). Locally: 58/58 script tests;
MIT collection 638/0 with the ML stack hidden from the import system; real-tree selector check
35 `*.test.ts` → 33 selected, 2 integration excluded, `PageRenderer.memo.test.ts` kept.

**Risk / rollback:** low — additive test-infra. Rollback = revert #678 and `4e4f3c88`. Residual: the
heavy-package list in `heavy_imports.py` is declared, not inferred (a static scan cannot follow the
lazy `__getattr__` hop); the CI collection error remains the backstop.

**Follow-up surfaced:** **#679** — `#278` SFX provenance gate not called by the driver on
`integrate/render-reconcile` (passes on `main`). Render-quality regression, now the remaining Phase E
blocker; verdict is user-in-the-loop on real rendered images.

**Links:** #643, #678, #679, #642, #626, #548, #359, #609, #278.

---

## 2026-07-10 — #626: landing→main render+translation feature-merge (integration branch)

**What & where:** Hand-merged `origin/landing/render-phase0` onto `integrate/render-reconcile`
(off `origin/main`) at function granularity — 25 conflicts across MIT render/translate + Backend
config + tests + goldens + docs. Full per-slice rationale in `docs/reports/RECONCILE-626-decisions.md`.

**Why:** Converge the two complementary render campaigns (main = layout/fit + reference_layout;
landing = wired inpaint/erase/rescue) into one trunk without regressing the confirmed-best render or
translation (dev hard-gate). See `docs/RECONCILIATION-PLAN.md`.

**Before → After:** Two diverged branches (landing→main = ~23-conflict set) → one reconciled
integration branch. Crux `resize_regions_to_font_size` resolved to main's port-verified spine +
grafted landing's #436 dedup refinements (equal-translation / onomatopoeia); dropped redundant
`bubble_fit_tall` (main's `_bubble_fit_layout` supersedes); landmine #1 fixed (is_sfx now populated →
main's #431 display-SFX arm live); selective_flux (#421) wired + Backend `MIT_SELECTIVE_FLUX` added
(OFF default); #623 thinking control folded into custom_openai (default OFF); numbered_contract
tolerant parse adopted.

**Performance Δ:** N/A at merge (behavior-gated flags OFF by default). #623 thinking-off cuts dense
translate completion tokens ~24× when a qwen3 model is used.

**Quality:** Render/translation quality vs baseline NOT yet asserted — pending Phase-D GPU benchmark
(render dump/replay + translation text diff on One-Punch). Merge validated for COHERENCE +
DETERMINISM only so far.

**Validation:** Characterization net **193 passed, 0 skipped** (torch-free), up from 175 baseline
(+#623 thinking/parse, tolerant-parse, EN→TH Thai golden). 4 goldens regenerated from reconciled code.
Full crux import chain resolves. AST-clean every slice. Render + translation benchmark gates = Phase D
(BLOCKING, before Phase E dev merge-to-main).

**Risk / rollback:** Integration branch isolated from prod (perf); Phase E (merge to main) is
dev-gated. Rollback = discard the branch. Deferred (tracked follow-up): unify MIT render telemetry
(main `_emit_trace` vs landing region-attrs); unify is_sfx/from_sfx_detection into one helper.

**Links:** #626, #548, #625, #627; `docs/RECONCILIATION-PLAN.md`, `docs/reports/RECONCILE-626-decisions.md`.


---

> Curated, report-level record of changes that **affect the running system** plus the **tech-debt
> register**. Audience: team / stakeholders / status reports. The chronological dev log lives in
> `DONE.md` (and `MIT/PIPELINE.md §5` for MIT internals); this file is the higher-level summary you
> pull a report from. Append a dated section per significant batch; keep entries terse + linkable.
>
> **Required fields per system-affecting change** (write "not measured" / "N/A" honestly — never
> fabricate numbers): **What & where** (component / file:line) · **Why** (problem/goal) ·
> **Before → After** (concrete observable difference) · **Performance Δ** (latency / VRAM / tokens,
> if measured) · **Quality** (correctness / render-fidelity / UX vs the target) · **Validation**
> (tests / E2E / benchmark / golden) · **Risk / rollback** (opt-in? byte-identical? knob) · **Links**
> (issue #, commit). The summary table below is the index; the "Before → After" blocks carry the full
> detail for headline changes.

---

## 2026-07-07 — MIT #503/#541: resize_regions golden portable across freetype builds (ci / test-infra)

**What & where:** `MIT/test/test_resize_regions_characterization.py` + new pure `MIT/test/_golden_compare.py` (`golden_verdict`) + `MIT/test/test_golden_compare.py`; the 3 `resize_regions_*.npz` goldens regenerated with `freetype_version`/`platform` metadata. Follow-up to the #359 torch-free blocking gate + the #503 resize reland.

**Why:** the now-blocking `pytest (logic gate, torch-free)` gate was **red on Linux CI** — `test_resize_regions_bubble_fit_byte_identical` drifted. The bubble_fit golden encodes freetype-metric geometry (font binary-search + width-squeeze over real glyph advances); it was recorded on Windows/freetype-2.14.3 (Pillow 12.2.0) but CI installs Linux/Pillow-12.3.0 (Pillow unpinned) → different advances → `dst_points` drift. Environment drift, not a logic change.

**Before → After:** before — Linux logic gate `1 failed, 586 passed`, bubble_fit red on every non-dev platform, blocking #541. After — golden records its authoring env; a mismatch is a `skip` only on a *different* env and still a `fail` on the golden's own env. Logic gate `0 failed` (bubble_fit skips on CI's foreign freetype; legacy/clean_layout still assert — box-derived, portable).

**Performance Δ:** N/A (test-only).

**Quality:** production render output unchanged — `git diff MIT/manga_translator/` is empty (byte-untouched). Strict byte-identical coverage retained on the dev platform where refactors are developed; CI keeps real coverage of the portable resize paths.

**Validation:** 3 `golden_verdict` unit tests (RED→GREEN); skip/fail/pass wiring exercised on crafted goldens; logic gate green on Linux CI (runs/28834510488). Benchmark PNG+MD: `docs/reports/benchmarks/2026-07-07-541-golden-portability.md`.

**Risk / rollback:** low — test-only, no dependency pinned, no production code touched. Limitation (documented): only the golden's authoring platform asserts bubble_fit strictly; a deliberate Pillow bump on dev regenerates the golden. Scrutinized: ship.

**Links:** #503, #541 (commit `ef69dd26`); builds on #359.

---

## 2026-07-03 — MIT CI: torch-free blocking gate landed + baseline rot repair (ci / tech-debt)

**What & where:** Landed the long-stalled #359 (PR #427) making `mit-ci`'s `pytest (logic gate,
torch-free)` a **blocking** required check (lazy package import boundary — ADR 029 — + committed the
gitignored Kumiko `panel/lib` source). To get a green baseline for it, shipped a prerequisite repair
(PR #504) to `main`: `MIT/requirements.txt` pin `opencv-python>=4.8,<5.0`, and reverted
`test_resize_regions_characterization.py` + its 3 `resize_regions_*.npz` goldens.

**Why:** Flipping the gate to blocking surfaced ~15 pre-existing failures that the previous
report-only job had masked: (a) unpinned opencv drifted to 5.0.0 in CI, whose `cv2.putText` now
requires CV_8U depth → broke the `utils/sort.py` debug-viz + render goldens (~13 tests); (b) the
resize characterization tests were committed **ahead of their implementation** (via the a6980f00
dashboard-sync) — they assert `page_shape` / `_bubble_fit_layout` that never landed on `main`, so they
tested nothing real and only failed.

**Before → After:** MIT pytest CI was uncollectable/red and report-only (ignored, masking rot) →
torch-free logic gate is a real blocking check, **green on main**. `import manga_translator` now works
in CI/fresh-clones/worktrees (panel/lib tracked). opencv is reproducibly pinned.

**Performance Δ:** N/A (CI infra). The MIT render perf hotfix it accompanies (select_hyphenator
lru_cache + textline_merge M1/M2, already on main via #414) is byte-identical.

**Quality:** No production code change. Decision recorded: characterization tests that assert
un-shipped behavior are **reverted (not xfail'd)** to keep the branch internally consistent, and
re-land **atomically with their impl** — tracked in #503.

**Validation:** logic gate green on PR #427, #504, #502 and on `main` HEAD; opencv 4.13 locally makes
`test_render_golden` pass (proving the pin fixes the drift); 3-round multi-agent scrutinize
(codex/antigravity/claude-9arm) drove the revert-vs-xfail + sequencing decisions.

**Risk / rollback:** low — each change is its own PR/commit (revertable); the reverted tests are
tracked for atomic reland (#503). Follow-up debt: the render-layout impl (page_shape/clean_layout/
`_bubble_fit_layout`) remains uncommitted in an entangled working tree — lands with #503.

**Links:** #359 (closed), PR #427 / #504 / #502, ADR 029, reland #503.

---

## 2026-07-02 — Wallet Security Hardening V1–V9: DB layer (feature / security)

**Scope:** Backend (`wallet`, `unlock` modules) + Supabase DB · **Type:** Security hardening — DB layer completion · **Tests:** 78/78 backend unit tests green (unlock×7, wallet×63, controller×8); 0 new failures.

**What & where:**
- `Backend/migrations/2026-06-22-wallet-security-hardening.sql` — `wallet_tx_topup_ref_uidx` unique partial index on `wallet_transactions(reference_id) WHERE type='topup'`; drop dead numeric overloads of `add_coins_atomic`/`spend_coins_atomic`; 4-arg `purchase_unlock_atomic` (self-contained: reads price/status/creator inside txn)
- `Backend/supabase-migration.sql` — mirrors the same DDL (reference file)
- `Backend/src/unlock/unlock.service.spec.ts` — 7 unit tests covering all RPC paths
- `Backend/src/wallet/wallet.service.spec.ts` — 3 SECURITY tests (amount mismatch, currency mismatch, non-SUCCEEDED status)
- `Backend/src/wallet/wallet.controller.ts` — `@UseGuards(AuthGuard, TopupThrottleGuard)` on `POST /topup/create`

**Why:** Core runtime security code (Xendit webhook HMAC, throttle guard, coin bounds) already in main. This PR adds the DB-level idempotency index and the atomic RPC that closes the TOCTOU window at the purchase step.

**Before → After:**
- Duplicate Xendit webhook → double topup credit possible / → DB-level unique index rejects second credit
- `purchase_unlock_atomic` trusted caller-supplied `p_price`/`p_creator_uid` (TOCTOU) / → self-contained: reads from `chapter_versions` inside the transaction; raises `VERSION_NOT_FOUND`, `NOT_PUBLISHED`, `CREATOR_MISSING` before touching the ledger

**Performance Δ:** not measured (additive DB index; no hot-path code changed).

**Quality:** All error paths (INSUFFICIENT_FUNDS, VERSION_NOT_FOUND, NOT_PUBLISHED, CREATOR_MISSING) confirmed by unit tests via RPC error strings.

**Validation:** 78 unit tests pass; `/scrutinize` review cleared 3 blockers before merge (duplicate TS import, stale pre-SELECT mocks, wrong SQL signature). Migration SQL pre-check query confirms 0 duplicate reference_ids before index creation.

**Risk / rollback:** Additive — `IF NOT EXISTS` guards index; `CREATE OR REPLACE FUNCTION` is idempotent. Rollback: `DROP INDEX IF EXISTS wallet_tx_topup_ref_uidx; DROP FUNCTION IF EXISTS purchase_unlock_atomic(uuid,uuid,numeric,text)`. Old 6-arg overload dropped first by migration.

**Links:** PR #463 (`feat/wallet-security-hardening → main`), commit `72502dd`.

## 2026-07-01 — Captcha re-prompt on translate 401 (bugfix / hotfix)

**Scope:** Frontend (`MangaReader.tsx`, `useChapterTranslation.ts`, `mangaTranslatePage.ts` + test) · **Type:** Bug hotfix · **Tests:** frontend 138/138 green (+4); typecheck clean; live E2E screenshot.

**What & where:** `mangaTranslatePage.ts` new pure `isCaptchaExpiredError()`; `useChapterTranslation.ts` new `onCaptchaExpired` option — both `startTranslate` (batch) + `translateCurrentPage` route a `401` to it and skip the same-token retry; `MangaReader.tsx` extracted shared `resetCaptcha()` used by the page-fetch 401 path and the new translate 401 path.

**Why:** when the 1-hour HWID-bound captcha token (#227) expired mid-session, pressing translate `401`'d and only toasted — translation dead-ended until a full page reload.

**Before → After:** translate on expired token → `401` + error toast, permanently stuck / → Turnstile "ยืนยันตัวตน" modal re-appears, user re-verifies and retries in place.

**Performance Δ:** N/A. **Quality:** removes a hard dead-end in the translate UX. **Validation:** unit (`isCaptchaExpiredError`) + full suite green + live E2E (inject bogus token → `401` → modal re-prompt, screenshot). **Risk / rollback:** additive; reuses the proven page-fetch recovery path; no backend change. **Links:** post-mortem `docs/reports/2026-07-01-captcha-reprompt-hotfix.md`, PR (hotfix/captcha-reprompt-on-translate-401).

## 2026-06-28 — CI test gates: GitHub Actions, first CI in the repo (infra / tech-debt)

**Scope:** repo-wide (`.github/workflows/` + `Backend/jest.ci.config.js` + one test fix) · **Type:** Infra — first automated test gate · **Tests:** backend 62 suites / 616 green on CI (Node 22), frontend 120 green; mit report-only.

**What & where:**
- `.github/workflows/{backend,frontend,mit}-ci.yml` *(new)* — path-filtered per service.
- `Backend/jest.ci.config.js` *(new)* — inherits `package.json`'s jest block (single source of truth) + documented skip-list (#358).
- `Backend/src/books/books-health.spec.ts` — fetch mock fixed (assign `global.fetch`, not `spyOn` on the lazy global); re-enabled.

**Why:** no CI existed; the 176 test files ran only when a dev remembered. With two self-merging devs the gate stops one tired late-night merge from landing red.

**Before → After:** PRs merged with CodeQL as the only check (tests on the honor system). → Every PR touching a service runs its unit suite automatically; a genuine test failure now visible pre-merge.

**Performance Δ:** path-filtered so a single-service PR doesn't run the other two; backend ~1–2 min, frontend <1 min, MIT slow (full ML install) so report-only for now.

**Quality:** `npm ci` was found broken on main (`package-lock.json` stale) → CI uses `bun install` (the maintained lockfile); Jest 30 found incompatible with the dev box's Node 26 → CI + local pinned to Node 22.

**Validation:** verified green on CI (backend 62/616, frontend 120) + locally on Node 22; scrutinized before merge (fixed MAJOR 2 jest-config-duplication in-PR).

**Risk / rollback:** additive (new files only); revert = delete the workflows. Skip-list keeps the gate green from day one without hiding debt (each entry tracked, removed as fixed).

**Links:** PR #355 (`31b7a31`); ADR 020; follow-ups #356 (safe required-checks → branch protection), #357 (pin bun + empty-files guard), #358 (shrink skip-list), #359 (MIT lazy torch).

---

## 2026-06-19 — Coin Topup System: Xendit PromptPay QR (feature)

**Scope:** Backend (wallet module) + Frontend (TopupModal + Navbar) + Supabase DB · **Type:** New feature — real payment gateway replacing dev-only topup stub · **Tests:** 607/607 backend green (+12 new wallet tests); Frontend tsc 0 errors.

**What & where:**
- `Backend/src/wallet/xendit.service.ts` *(new)* — wraps `POST https://api.xendit.co/payment_requests`, no SDK, plain `fetch`
- `Backend/src/wallet/dto/create-topup.dto.ts` *(new)* — `@IsInt() @Min(20) amount`
- `Backend/src/wallet/wallet.service.ts` — `createTopup`, `getTopupStatus`, `processXenditWebhook`; `addCoins` extended with optional `referenceId` → `p_reference_id` in `add_coins_atomic` RPC
- `Backend/src/wallet/wallet.controller.ts` — 3 new endpoints: `POST /wallet/topup/create` (AuthGuard), `GET /wallet/topup/status/:paymentId` (AuthGuard), `POST /wallet/xendit/webhook` (public)
- `Backend/src/app.module.ts` — `wallet/xendit/webhook` excluded from `HardwareIdMiddleware`
- `Frontend/app/components/TopupModal.tsx` *(new)* — 3-screen state machine: TIER_SELECT (6 presets + custom ≥20) → QR_DISPLAY (countdown + 3s poll) → SUCCESS; dispatches `mb:coin-balance-update` event
- `Frontend/app/components/NavbarActions.tsx` — coin balance chip before avatar; opens TopupModal; listens for `mb:coin-balance-update`
- `Frontend/app/components/BookDetailModal.tsx` — inline mock topup form replaced by `<TopupModal>`
- Supabase migration `create_coin_topups` applied: `coin_topups` table with `UNIQUE(payment_id)` idempotency guard

**Why:** `POST /wallet/topup` was a dev stub throwing 403 in production. Users had no real path to purchase coins for paid chapters.

**Before → After:** `POST /wallet/topup` → 403 in production, no QR, no payment / `POST /wallet/topup/create` → Xendit PromptPay QR, inline modal, polling confirms payment, coins credited atomically via `add_coins_atomic` RPC.

**Security:** webhook token check fails-closed when `XENDIT_WEBHOOK_TOKEN` env var is unset; idempotency prevents double-credit on webhook retry; no SDK dependency; `x-callback-token` verified server-side only.

**Performance Δ:** N/A (new code path, no regression on existing paths).

**Quality:** Tiers 20/50/100/200/500/1000 + custom; countdown timer; QR blur on expiry; auto-close after success; Navbar chip updates from both Navbar-opened and BookDetailModal-opened flows via `mb:coin-balance-update` custom event.

**Validation:** Backend 607/607 tests green; 12 new unit tests cover: token rejection, env-var-unset rejection, non-succeeded events, happy-path credit, idempotency, unknown payment_id, expired status, paid-with-balance; Frontend tsc 0 errors; qrcode.react@4.2.0 installed.

**Risk / rollback:** Additive — existing wallet/unlock paths unchanged. Rollback: `DROP TABLE coin_topups;` + revert 11 modified files. Sandbox only (no production keys committed). Dev topup stub (`POST /wallet/topup`) retained as fallback, still production-blocked by `NODE_ENV` check.

**Links:** spec `docs/coin-topup-xendit.md` · handoff `mangadock-handoff-coin-topup.md` · sandbox webhook `https://web.2552667.xyz/api/xendit/webhook`

---

## 2026-06-17 — Upload path skipped magic-byte MIME validation (security bug) — #303

**Severity:** medium (defense-in-depth gap / stored-disguised-file; contradicted a documented control) · **Branch:** `fix/303-upload-magic-byte-validation` (off `main`), TDD (RED→GREEN), not yet PR'd. Surfaced by #296 while writing the magic-byte tests. · **ADR:** [016](../adr/016-upload-magic-byte-mime-validation.md).

**What & where:** `Backend/src/upload/upload.service.ts:addPage` now validates by magic bytes (`await fileTypeFromFile(tempFilePath)`) and derives the stored extension from the **detected** mime; the client `mimeType` arg is removed. `upload.controller.ts` keeps the Multer `fileFilter` client-mime check as a cheap first gate only and no longer threads `file.mimetype` into the service. Mirrors the existing `forum.service.ts:444,489` control.

**Why:** both layers trusted the **client-supplied** Content-Type. `fileFilter` reads `file.mimetype` (set by Multer from the attacker-controlled multipart `Content-Type`), and `addPage` re-checked that same value against `ALLOWED_MIME_TYPES` without ever reading the bytes — contradicting `CLAUDE.md` ("upload — MIME validated with `file-type` (magic bytes, not extension)").

**Before → After:** a `<script>…</script>` payload sent with `Content-Type: image/png` passed both gates and was stored as `.png` with `contentType: image/png` → it is now **rejected** (`BadRequestException`) before reaching storage, even when filename/extension/client-mime claim image. A client lying `image/png` over WebP bytes is now stored `.webp` (detected mime drives the extension). Empty/truncated/undetectable files are rejected gracefully; the temp file is unlinked on every reject path.

**Performance Δ:** one extra on-disk read per upload (`fileTypeFromFile`) — negligible vs the upload itself. **Quality:** the documented control is now real for this module; upload + forum share one validation posture. **Validation:** new `upload.service.spec.ts` (8 tests, TDD): disguised-file reject (RED on the old code = mutation check), undetectable reject, temp-file-deleted-on-reject (real temp file), all 4 allowed types accepted, extension derived from detected mime. Full backend **58 suites / 540 tests green**; `eslint` clean on the 3 touched files; no new `tsc` errors (the 10 standing are #298, not yet merged to this branch). **Not run:** live in-app upload E2E (`feedback_test_every_round`) — recommend a confirmatory pass with the PR.

**Risk / rollback:** Low. Single-file behaviour change on the reject side (stricter), each commit revertible. `file-type` is ESM-only → tests use the existing `src/__mocks__/file-type.js` mock (same as forum). **Note:** the `CLAUDE.md` upload claim was aspirational before this fix; it is now accurate.

**Open follow-ups:** factor a shared magic-byte upload-guard helper across `forum.service` + `upload.service` (allowlist + `MIME_TO_EXT` in one place); #303 unblocks **#296** (its security AC is now satisfiable — those tests live in `upload.service.spec.ts`); `err` unused in `deletePage` + dead `path` import were cleaned in passing.

**Links:** #303 (bug), #296 (surfaced it), #292 (parent) · ADR 016 · `forum.service.ts:444,489` (prior art).

---

## 2026-06-14 — Backend `books.service.ts` decomposition: MIT translation carve (#233 + #234)

**What & where:** Carved the MIT translation subsystem out of the `Backend/src/books/books.service.ts` god object (PRD #228) into focused, individually unit-testable modules: `mit-translation.service.ts` (single-page), `mit-batch-orchestrator.service.ts` (batch state machine), `mit-config.ts` + `mit-lang-map.ts` (pure key/config/lang helpers). · **Branch:** `dept/backend` (off `origin/main`), 8 commits, **not yet pushed/PR'd**. · **Method:** byte-identical, characterization-first, 1 seam = 1 commit (TDD per seam).

**Why:** `books.service.ts` was a 1834-line god file; the single-page and batch MIT paths were untestable except through the whole service, and carried a dead Redis pub/sub limb whose flaky tests were the entire 16-failure baseline.

### Shipped — seams (byte-identical unless noted)
- **#233** carve `MitTranslationService` — single-page `translateMangaPagePatches` + retry loop, MIT health, image-translator probe — `a941a4c`
- **#234 S5a** drop dead batch Redis pub/sub (no-op subscribe; single-node) + **ADR-002** + retire `books-pubsub-batch.spec.ts` — `e0f6add`, `4f04c51`
- **#234 S5b** unify 3 fan-out blocks → one `deliver()` — `42b4e90`
- **#234 S5c** unify 2 completion sites → one `maybeComplete()` — `7bdc118`
- **#234 S5-pre** move pure MIT helpers → `mit-config.ts`/`mit-lang-map.ts` (break value-import cycle) — `4a155d7`
- **#234 S5e** carve `MitBatchOrchestrator` state machine — `c1daa07`
- **#234 S5d** fix latecomer-listener leak on job reject + `finalize()` teardown (**behaviour fix**) — `c29dbc1`

### Before → After (full fields)
| field | before | after |
|---|---|---|
| books.service.ts LOC | 1834 | 841 (−54%) |
| MIT translation modules | 1 (god file) | 4 focused + `MitClient` (#230) |
| backend test suite | 192 pass / **16 fail** | **513 pass / 0 fail** |
| single-page path testability | fake `global.fetch` only | faked `MitClient` (unit) |
| batch state machine testability | only via BooksService | `MitBatchOrchestrator` direct |
| batch fan-out blocks | 3 hand-rolled copies | 1 `deliver()` |
| batch completion sites | 2 (webhook logged, stream silent — drift) | 1 `maybeComplete()` |
| batch Redis pub/sub | publish ×2 + no-op subscribe (dead) | removed (single-node; ADR-002) |
| latecomer listener on job reject | leaked (post-await delete skipped) | drained (try/finally + `finalize()`) |

**Performance Δ:** books test suite ~63s → ~13s after the 16 Redis-timeout tests were retired (S5a). Runtime translation latency: unchanged (byte-identical). One fewer dead Redis publish per page (negligible).

**Quality:** byte-identical on every seam except **S5d** (the only behaviour change — isolated to its own commit with a red→green repro test). BooksService keeps thin public delegators with unchanged signatures → SSE batch endpoint + MIT webhook controller unchanged. `persistPage`/`seriesContextFor` stay in BooksService, injected into both new services; the single-page translate is injected into the orchestrator **late-bound** so the `books-retry` spy still observes the batch retry path.

**Validation:** `npm run build` (whole backend, tsc) clean after every seam (cross-module ripple guard). Full backend suite **513 pass / 0 fail** (54 suites); the books characterization net (batch-registry/cancel/progress/webhook/retry, image-model, series-context, mit-config) green throughout = byte-identical proof. **Code review:** 5-agent fan-out (line-by-line / removed-behaviour / cross-file / cleanup / altitude) for #233+S5a–S5c → 0 correctness bugs (1 altitude finding: the value-import cycle, fixed by S5-pre). The carve (S5-pre/S5e/S5d) reviewed by **exact whitespace-normalised byte-comparison** (agents hit a session limit) — all 7 moved helpers + 8/9 batch methods proven byte-identical to the original (the 9th = `startOrAttachBatchJob`, intentionally changed by S5d); only textual deltas elsewhere are prettier trailing-commas → **0 correctness bugs**. **Not run:** frontend E2E translation parity (`feedback_test_every_round`) — change is byte-identical so original↔translated output is unchanged by construction; recommend a confirmatory E2E pass before/with the epic PR merge.

**Risk / rollback:** Low. Byte-identical decomposition; each seam is its own revertible commit. The one behaviour change (S5d) only touches the reject/timeout cleanup path (repro-tested). Redis removal (S5a) is single-node only — re-introduce a real subscriber + multi-node test when sharding (ADR-002). 12 commits unpushed on `dept/backend`.

**Open follow-ups:** open the epic #228 PR → main; close issues #229/#230/#232/#233/#234 on merge; cosmetic — `PatchEntry` type declared in 3 files, `persistPage` param type duplicated (mit-translation + orchestrator), `books-mit-config.spec` describe "BooksService.buildMitConfig" now tests via `.batch`; confirmatory frontend E2E parity pass.

**Links:** #228 (parent), #229/#230/#232/#233/#234 · ADR-002 (`docs/adr/002-drop-batch-redis-pubsub.md`) · commits `a941a4c e0f6add 4f04c51 42b4e90 7bdc118 4a155d7 c1daa07 c29dbc1`.

---

## 2026-06-13 — PRD#1: Backend security hardening (Turnstile/HWID guards) — #223 (#224–#227)

**Severity:** major (cost-bleed + information-disclosure on the expensive MIT surface) · **Branch:** `dept/backend` (off `origin/main`), 4 PRD steps + 2 post-review fixes, not yet PR'd. Derived from the read-only Backend security audit in issue #223. **TDD throughout** (RED→GREEN per step); `/security-review` on the full diff returned **no findings ≥0.7** — a later high-recall `/code-review` of the rebased branch surfaced + fixed 2 more (CR#1/CR#2 below).

### Summary (index)
| Step | What & where | Before → After | Validation | Commit |
|---|---|---|---|---|
| #224 | Fail-closed Turnstile config — new `auth/turnstile.config.ts` (`resolveTurnstileConfig`), wired in `turnstile.guard.ts`, `books.controller.ts` (verify-captcha), boot check in `main.ts` | missing `TURNSTILE_SECRET_KEY` silently fell back to the public test key (always-pass siteverify + forgeable HMAC) → **prod now refuses to boot** on missing/test secret; `TURNSTILE_ENABLED=false` ignored in prod | 9 unit (fail-closed matrix, mirrors `storage.module.spec.ts`) | `21423bf` |
| #225 | Validate `X-Hardware-Id` shape — `common/middleware/hardware-id.middleware.ts` (`isValidHardwareId`) | presence-only check (any garbage passed zero-trust) → shape check `/^[A-Za-z0-9_+/=-]{8,128}$/`, rejects array/whitespace/control/injection with 401 | 42 unit (valid/empty/malformed/array/passthrough + pure fn) | `9527a35` |
| #226 | Sanitize `AllExceptionsFilter` — `common/filters/all-exceptions.filter.ts` + 2 controller catches in `books.controller.ts` | raw internal error message + MIT error leaked to client on 500 → generic `Internal server error` / `Translation failed`; real message+stack logged server-side; HttpException + Supabase-503 preserved | 3 filter unit (generic / passthrough / 503) | `9dadb57` |
| #227 | Guard 3 MIT endpoints + frontend clearance — `@UseGuards(TurnstileGuard)` on `translate/manga`, `…/translate-patches`, `…/batch-translate-patches`; `Frontend` global fetch interceptor (`SupabaseGuard.tsx`) attaches `x-captcha-clearance` via new pure `app/lib/zeroTrustHeaders.ts` | expensive ML/R2 pipeline reachable with only a non-empty HWID header → each requires valid HWID-bound clearance; cheap `GET translate` (description) stays open | 7 backend e2e (401-without / proceeds-with per endpoint) + 5 frontend bun (header helper) | `5a81942` |
| CR#1 | Exact-origin allow-list in `isApiRequest` — `Frontend/app/lib/zeroTrustHeaders.ts` (+ `SupabaseGuard.tsx` call site) | substring host match (`includes('supabase.co'/'localhost')`, `startsWith('/')`) leaked HWID + the #227 `x-captcha-clearance` credential to lookalike origins (`supabase.co.evil.com`, `//evil.com`) → **exact-origin allow-list** (own + `NEXT_PUBLIC_SUPABASE_URL` origin); `//` rejected, malformed → false | 7 frontend bun (5 attacker URLs → false / legit → true / malformed → false) | `075cc30` |
| CR#2 | Gate Supabase heuristic in `AllExceptionsFilter` — `Backend/src/common/filters/all-exceptions.filter.ts` | intentional `HttpException` whose message merely mentioned Supabase was coerced to 503 `SUPABASE_OFFLINE` (wrong status, false "paused" toast) → gated `!isHttpException`; genuine non-HttpException 503 path preserved | filter unit +2 (400/404 + own message preserved) + existing 503 regression | `0c09b85` |

### Before → After (headline, full fields)

**#224 · Fail-closed Turnstile (the headline security fix)** — *What/where:* `resolveTurnstileConfig(env)` (`auth/turnstile.config.ts`), consumed by `TurnstileGuard.canActivate` and the verify-captcha handler; boot enforcement in `main.ts:bootstrap` *before* `NestFactory.create`. *Why:* both call-sites inlined `process.env.TURNSTILE_SECRET_KEY || '1x0000000000000000000000000000000AA'` (Cloudflare public test key) — a forgotten secret made siteverify always pass **and** signed the HMAC clearance with a publicly-known key, so the whole captcha/zero-trust layer was silently bypassable and the token forgeable. *Before → After:* missing/test secret in prod = silent always-pass → **loud crash at boot**; outside prod the test key + `TURNSTILE_ENABLED=false` still work (dev unblocked). The `|| <test-key>` fallback is gone from both sites (grep-verified: only the constant definition remains). *Performance Δ:* N/A (string resolution per request, negligible). *Quality:* invisible to a correctly-configured deploy; reader flow unchanged. *Validation:* 9 unit covering the full prod/non-prod × missing/test/real × enabled-flag matrix. *Risk/rollback:* fail-closed (a real prod secret was always required to function correctly); revert = 1 commit. *Links:* #224, `21423bf`.

**#227 · Captcha guard on the expensive surface + reused clearance** — *What/where:* `TurnstileGuard` applied to the three MIT-triggering endpoints in `books.controller.ts`; `Frontend/app/components/SupabaseGuard.tsx` global `window.fetch` interceptor now injects `x-captcha-clearance` (from `localStorage.cf_clearance_token`) alongside the existing `x-hardware-id`, via the extracted pure `withZeroTrustHeaders()` helper. *Why:* only the cached-page endpoint was guarded; single-page, batch, and manga-text translation ran the ML/LaMa + R2 pipeline for any caller with a non-empty HWID header — and the batch job keeps running after disconnect, amplifying cost (compounds the R2 concern in #197). *Before → After:* anonymous → **401** on all three; legitimate readers reuse the clearance they already obtained for page serving → **no UX change**; description translation on catalog cards stays open (pre-auth). *Performance Δ:* not measured (guard is a cheap HMAC verify). *Quality:* reader path preserved; defense matches the page endpoint. *Validation:* 7 backend e2e (focused TestingModule, mocked service) assert 401-without / 200-201-with per endpoint + description-open; 5 frontend bun on the header helper. **Live Playwright E2E deferred** (per owner decision — to be run before merge). *Risk/rollback:* a client missing/with-expired clearance gets 401 on translate (re-solve captcha re-issues it); revert = 1 commit. *Links:* #227, `5a81942`.

### Post-review hardening (`/code-review` xhigh on the rebased branch)

A high-recall `/code-review` after rebasing onto `origin/main` found two issues the default-threshold `/security-review` had missed; both fixed TDD on-branch.

**CR#1 · Clearance-token exfiltration via substring origin match (high)** — *What/where:* `isApiRequest` in `Frontend/app/lib/zeroTrustHeaders.ts`, wired into the global `window.fetch` interceptor (`SupabaseGuard.tsx`). *Why:* the interceptor chose which requests carry `x-hardware-id` + the HWID-bound `x-captcha-clearance` credential via substring matching (`url.includes('supabase.co'/'localhost')`, `startsWith('/')`) — pre-existing for the HWID, but #227 newly routed the 1h captcha-bypass token through the same broken matcher. Lookalike origins matched (`https://supabase.co.evil.com`, `https://evil.com/?ref=supabase.co`, `//evil.com`), so any `fetch()` to an attacker URL exfiltrated the token. *Before → After:* substring/`startsWith` → **exact-origin allow-list** — a single leading `/` (rejects `//` protocol-relative), or an absolute URL whose parsed origin ∈ {own origin, `NEXT_PUBLIC_SUPABASE_URL` origin}; malformed URL → false. Injection logic otherwise unchanged; legit relative + same-origin + Supabase traffic preserved. *Performance Δ:* N/A. *Quality:* no functional change for real origins. *Validation:* 7 frontend bun (5 attacker URLs → false, legit → true, malformed → false). *Risk/rollback:* closes a credential leak, no behaviour change for trusted origins; revert = 1 commit. *Links:* `075cc30`.

**CR#2 · Supabase heuristic misclassified intentional HttpExceptions (medium)** — *What/where:* `Backend/src/common/filters/all-exceptions.filter.ts`. *Why:* `isSupabaseError` substring-scanned the message and overrode status/message **before** the HttpException branch, so a deliberate `HttpException` whose message merely mentioned Supabase (e.g. `BadRequestException('Invalid Supabase project id')`) was coerced to 503 `SUPABASE_OFFLINE` — wrong status, canned message, a false "project paused" toast on the frontend, and CRITICAL log spam. *Before → After:* `isSupabaseError` now gated with `!isHttpException` → HttpExceptions keep their own status/message/`code`; a genuine non-HttpException connection failure still maps to 503 `SUPABASE_OFFLINE` (feature preserved). *Performance Δ:* N/A. *Quality:* correctness/UX fix. *Validation:* `all-exceptions.filter.spec.ts` +2 (HttpException-with-Supabase-message → 400/404 + own message preserved) + the existing 503 regression. *Risk/rollback:* revert = 1 commit. *Links:* `0c09b85`.

*Post-rebase verification:* security unit suite **56/56**, MIT guard e2e **7/7**, frontend `zeroTrustHeaders` **7/7** — all green on the new `origin/main` base.

### Open follow-ups (not in this batch)
- Live Playwright/tunnel E2E of the reader+translation path (original↔translated) before PR — owner-deferred.
- Code-review CR#3–CR#7 (LOW/MED, several pre-existing) not yet addressed: (CR#3) `Request`-object `fetch()` skips header injection — `args[0]?.toString()` → `"[object Request]"`, fails closed; (CR#4) `/uploads/*` (UploadsController `@Get('*')`) is outside the `/^\/upload\//` HWID regex — confirm public-by-design vs gap; (CR#5) NaN-expiry not rejected in `verifyClearanceToken` (`NaN < Date.now()` is false) — defense-in-depth, HMAC still gates; (CR#6) `TurnstileGuard` reads `x-hardware-id` raw and doesn't shape-validate it on `/books/translate/manga` (route not in `HWID_REQUIRED`); (CR#7) `SupabaseGuard` fetch-interceptor absolute-restore can clobber/double-wrap on remount/foreign interceptor.
- `console.error` used for the new server-side error logging in `books.controller.ts` (matches existing file style); will fold into the `console.* → Logger` sweep in #240.
- `notify.ps1` toast errored on this run (`LoadXml` HRESULT `0xC00CE502`) — unrelated to this PRD; flag for the dev-notification script.

---

## 2026-06-10 — HOTFIX (critical): per-chapter Cloudflare Worker `/v1/list` cost-bleed

**Severity:** critical (unbounded Cloudflare R2 Class-A op spend) · **Branch:** `hotfix/r2-list-amplification` → `main` (PR #197, squash `01affd5`).

*Post-mortem (bug):*
- **Symptom.** The Cloudflare Worker (`mangadock-worker.akkanop2549.workers.dev`) was receiving a flood of `GET /v1/list?prefix=img-cache/_chapters/chapters/<chapterId>/`. Our backend log showed **507 `GET /books/manga/<id>/chapters` requests in 46 min** (~11/min, across the home-grid manga) — and the R2 provider does not log its outbound calls, so the spend was invisible on our side.
- **Root cause.** `MangaDexService.attachLocalStatus` (mangadex.service.ts) did `Promise.all(chapters.map(ch => imageCache.hasChapterCache('_chapters', ch.id)))` — **one R2 `/v1/list` per chapter** — and it ran on **every** chapter-list load, *including the Redis cache-HIT path* (line 99) and the fresh/stale paths (162/166/172). It was **not gated by `forceLocal`** (only `imageCache.enabled`, which is true on the R2 dev/prod config). So an **N-chapter manga cost N Class-A list ops per load**, multiplied by every (re)fetch (the home grid re-fetches per card, frontend uses raw `fetch()` bypassing the apiCache). Example: a 83-chapter manga × ~50 re-fetches ≈ 4,800 list ops; whole grid ≈ tens of thousands per session. **Unbounded** — grows with chapter count × open count.
- **Why it was safe to gate.** `readerAvailable` is consumed by the UI **only** when `forceLocal` (offline toggle) or `isOfflineFallback` (stale cache while MangaDex is down) is set — `HeroDetailButton.tsx:33` (`if (forceLocal || ch.isOfflineFallback) … else pageCount>0`) and `BookDetailModal` (`chapterNeedsBackup === ch.isOfflineFallback`). The frontend only sends `?forceLocal=true` when the toggle is on. So computing `readerAvailable` during default browsing was pure waste.
- **Fix (before → after).** Gate the fan-out: `attachLocalStatus(chapters, isOfflineFallback, forceLocal)` now computes `readerAvailable` (the per-chapter `/v1/list`) **only when `imageCache.enabled && (forceLocal || isOfflineFallback)`**; otherwise returns `readerAvailable:false` with **zero** worker calls. `forceLocal` is threaded into all 4 call sites. *Before:* every chapter-list load = N `/v1/list`. *After:* default browsing = **0**; offline/forceLocal flows unchanged (still compute it, exactly as the UI needs). **Mirrors the frontend's own consumption condition → zero UI regression.**
- **Validation.** `mangadex-reader-available.spec.ts` (3 cases, RED→GREEN): default browsing fires 0 `hasChapterCache`; `forceLocal=true` fires exactly N; disabled fires 0. Typecheck clean for `mangadex.service.ts` (the unrelated `.spec.ts` TS errors are pre-existing).
- **Part B (asked alongside):** main's Cloudflare R2/Worker storage **is fully merged** into the working branch (`git merge-base --is-ancestor origin/main HEAD` true; zero diff over `common/storage`). The bug is a pre-existing **design defect in the merged code**, not a merge gap — which is why this hotfix targets `main` directly.
- **Risk / rollback:** Low — one method + 4 call sites; behaviour preserved for the only paths that read `readerAvailable`; revert = single commit.
- **Follow-ups (backlog, not in this hotfix):** route the frontend chapter-list fetch through `apiCache` (kill the ~11/min re-fetch); Redis-cache the `readerAvailable` set; in-flight dedup on `storage.list`; `CloudflareR2Provider.list` outbound logging + failure backoff; the flat `_chapters` namespace → per-manga (enables N→1 list).

---

## 2026-06-10 — MIT god-object decomposition stack (S13–S18) + test-pollution fix + E2E

Branch: `refactor/mit-seam-s17-text-translation-dispatcher` (stacks S13/S16/S17/S19/S21/S18 on the
landed S1–S12 work). Every seam is a **byte-identical** extraction behind characterization tests —
**zero runtime behaviour change**; the value is tech-debt: the ~3000-line `manga_translator.py` god
object shedding internals into small, unit-tested modules. Per-seam detail: `MIT/PIPELINE.md §5`
(decomposition subsection), `docs/reports/mit-refactor-progress.md`, `DONE.md`.

### Shipped — decomposition seams (byte-identical, no behaviour change)
| Seam | Extracted to | System impact | Validation |
|---|---|---|---|
| S13 DetectionPostProcessor | `detection_postproc.py` | none (byte-identical) | unit + suite |
| S16 TranslationMemory | `translation_memory.py` | none | unit + suite |
| S17 TextTranslationDispatcher | `text_translation_dispatcher.py` | none | unit + E2E |
| S19 gather_per_context | `gather_per_context.py` | none | asyncio unit |
| S21 ModelLifecycle facade | `model_lifecycle.py` | none | unit + E2E |
| S18 PostTranslationProcessor | `post_translation.py` (4 fns) | none | unit + E2E |
| S14 VerboseDebugSink | `debug_sink.py` (9 fns/ctx-mgr) | none | unit + E2E |
| S15 Stage adapters | `stages.py` (6 leaf fns) | none | unit + E2E |

### Tech-debt outcome (measured) + why this approach

**Measured benefit (pre-decomposition `73251c5` → HEAD):**
| Metric | Before | Now | Δ |
|---|---|---|---|
| `manga_translator.py` (the god object) | **3040 lines** | **2235 lines** | **−805 (−26.5%)** — trajectory 3040 → 2700 (S1–S12 on main) → 2235 |
| Dependency-light, unit-tested modules carved out | 0 | **21** | region_filter/apply, model_usage_tracker/unloader/reaper/lifecycle, memory_guard, prev_context, context_counts, dictionary, none_translator, translation_store, image_debug_context, pipeline_params, detection_postproc, translation_memory, gather_per_context, text_translation_dispatcher, post_translation, debug_sink, stages |
| MIT test cases | 180 | **319** | **+139 (+77%)** characterization net |
| Behaviour change | — | **none** | 4 consecutive byte-identical E2E runs (2 patches, 649×1492+451×1489) |

**Why byte-identical, characterization-first, one seam per commit** (not a big-bang rewrite):
- **The god object is the hottest path in the product** — every translated page flows through it. A silent behaviour change there breaks translation system-wide and is hard to detect. So each seam ships a *characterization net first* (locks current behaviour), then a *verbatim* extraction proven against that net — refactor without re-deciding behaviour.
- **Small, revertable increments** — one commit per seam means each is independently reviewable and rollback = a single revert. Blast radius is one seam, not the whole driver. (12 commits on this branch, each green + E2E'd where it touches output.)
- **Landmines preserved verbatim, fixed later behind opt-in flags** — divergent thresholds (L6 0.5/0.3, ≥6/>10), `**ctx` splat (L15), `exit(-1)` (L2), cp1252 encode bug, etc. are *kept*, not "tidied". This separates "move code" (safe) from "change behaviour" (flagged, opt-in) so neither hides in the other.
- **Don't force-unify load-bearing duplication** (the S18 finding) — when "4 copies" turn out to be structurally divergent on purpose, relocate + pin the divergence as explicit params rather than merging (which would change output). Adding callback complexity to prop up a false merge violates the North Star.
- **Testability is the durable win, not just line count** — the leaf logic (e.g. a 12-arg `dispatch_detection` call) was previously only reachable through a full `MangaTranslator` instance + the 22s ML stack; the extracted adapters unit-test in <1s by stubbing. That is what makes the next seams (and future features) safe to touch.

### Before → After (headline, full fields)

**S18 · post-translation processing relocated (NOT unified)** — *What/where:* the punct+post-dict+phase-1 helper and the three phase-2 page-level lang-check retry loops carved out of `manga_translator.py`'s single/concurrent/batch drivers into `post_translation.py` (4 functions; drivers delegate). *Why:* the four "copies" were buried + untestable, and the documented "unify 4 copies" premise was unsafe — close reading showed the retry loops are structurally divergent (`min_ratio` 0.5/0.3, threshold ≥6/>10, pad+enumerate vs filter+text_idx vs cross-context region_mapping) and load-bearing (L6/L8); unifying would change output, so they're pinned as per-scope params. *Before → After:* ~290 lines of duplicated-but-divergent orchestration inline in the god object → 4 named, unit-tested functions; divergence now explicit + documented. *Perf Δ:* none (same code path). *Quality:* byte-identical output; future unify-decision is now visible. *Validation:* 13 characterization cases + full suite (18 async-only baseline, **295 passed**) + E2E (below). *Risk:* byte-identical; revert = 4 commits (S18a–d). *Links:* `a5f7585`,`fd628bc`,`9458dfd`,`a5cde22`; #187.

**Test-suite pollution fix (pre-existing)** — *What/where:* `MIT/test_precision.py` + `MIT/test_qwen3_translator.py` stub `omegaconf`/`manga_translator` into `sys.modules` at import time and never restore. *Why:* during a full `pytest` run those stubs (installed at collection) shadow the real modules for every later test → 8 spurious failures (`test_detection_postproc`, `test_series_context`, `test_mit_config`) that all pass in isolation. Pre-existing — both files sit on `main`, untouched by the refactor. *Before → After:* full suite **26 failed → 18** (the unchanged async-only baseline), 295 passed. *Perf Δ:* N/A. *Quality:* suite signal trustworthy in a single run (was masking real failures). *Validation:* full suite + qwen3/precision own tests 12/12 green. *Risk:* test-only; save-then-restore `sys.modules`. *Links:* `0db9479`.

### Validation — E2E (production tunnel, mandatory original↔translated)
Through `https://hayateotsu.space/` (cloudflared tunnel, per the `frontend-testing` skill — never
localhost). Test page: **Kouchuugun Shikan Boukensha ni Naru** ch1 "Emergency Landing" page 0
(EN→TH, custom_openai / 9arm). Ran **four times**: after S17/S21, S18, S14, and S15 — each restarting MIT
on the new code with the 3-layer cache cleared (S15's run had zero console errors). **All runs identical:** `page=0 → 2 patches`, geometry
**649×1492 + 451×1489**, POST `translate-patches` 201/success (~35 s), Thai text correctly
positioned, art/layout/panels unchanged — byte-identical to the documented bubble-seg-off baseline.
No 500s; only the standard `/pages` 401→200 HWID auth handshake. Screenshots `e2e-s17-p1-*.png`,
`e2e-s18-p1-translated.png`.

### Risk / rollback
Whole stack byte-identical + characterization-covered; branch pushed (`aa918cb..834a522`) for
rollback. PR to `main` pending user confirm.

---

## 2026-06-09 — Render parity (MangaTranslator) + MIT tech-debt audit

Branch: `feat/context-aware-translation`. All translation-render changes are **opt-in env knobs,
byte-identical when unset** (no behaviour change unless explicitly enabled on the backend).

### Shipped — translation render pipeline
| Change | System impact | Knob | Tests |
|---|---|---|---|
| A · ALL-CAPS lettering | EN renders uppercase (manga convention) | `MIT_EN_UPPERCASE` | BE + MIT green |
| B · EN font override | swap a heavier comic face for EN | `MIT_EN_FONT` | green |
| C · Bubble-fill cap | text fills the balloon (raise the #175 0.5 cap) | `MIT_FONT_MAX_BOX_RATIO` | green |
| #168 · SFX detection | detects + translates outside-bubble SFX via **AnimeText YOLO** (auto-download, gated repo) | `MIT_SFX_DETECTOR` | green; E2E `フッ→Hmph` |
| #166/#170/#175/#179 | bubble area-fit, balloon seg, anti-overflow, safe-area narrow column | various | green |
| #176/#181/#183 | EN comic font, 4× supersampling, dst-bounds clamp | various | green |
| cache:reset tooling | clears the 3-layer translated-patch cache for debugging | `npm run cache:reset` | green |

**Test totals:** MIT 42+ pure-module + Backend 66; render verified on the One Punch-Man benchmark page
(`MIT/tools/ab_parity*.py`, `ab_sfx.py` → `*_montage.png`).

### Before → After (headline changes, full fields)

**A · ALL-CAPS lettering** — *What/where:* uppercase EN translation before render (`manga_translator.py:1125`, exposed via `MIT_EN_UPPERCASE`). *Why:* manga convention is all-caps; mixed-case looked un-manga vs the MangaTranslator reference. *Before → After:* "This brat doesn't realize…" → "THIS BRAT DOESN'T REALIZE…". *Perf Δ:* none (string op). *Quality:* matches the reference's casing identity — the single biggest visual-identity gain. *Validation:* Backend config spec + MIT wiring test; E2E `parity2_montage.png`. *Risk:* opt-in, byte-identical off.

**C · Bubble-fill cap** — *What/where:* raise the #175 font cap from 0.5→tunable balloon-height ratio (`font_high_cap` + `MIT_FONT_MAX_BOX_RATIO`). *Why:* short lines under-filled big balloons (timid vs reference). *Before → After:* text ~half balloon height → fills the balloon (E2E used 0.75). *Perf Δ:* none. *Quality:* closer to reference fill; risk of over-large text bounded by the binary-search fit + #183 clamp. *Validation:* `font_high_cap` unit test + characterization render; E2E. *Risk:* opt-in, default 0.5 = byte-identical.

**#168 · SFX detection** — *What/where:* AnimeText YOLO second pass (`sfx_detector.py`) → IoA-dedup vs DBNet → OCR/translate/render, gated by `MIT_SFX_DETECTOR`. *Why:* DBNet never detects stylized outside-bubble SFX, so they stayed untranslated. *Before → After:* `フッ` untranslated → "HMPH" rendered (a region DBNet never found); the page gained 1 translated region (6→7). *Perf Δ:* +1 YOLO forward + model load (119 MB, ~auto-download once); VRAM not separately profiled (pipeline runs 5–7 GB / 12 GB). *Quality:* readable SFX now translate; **heavily-stylized `ぬ〜` is detected but the 48px OCR can't read the hand-drawn glyph → still untranslated** (needs VLM-OCR). *Validation:* `test_sfx_merge` + wiring test; E2E `sfx_montage.png` log `[SFXDetect] 8 boxes, +2 new textlines`. *Risk:* opt-in; gated model needs `HF_TOKEN`.

**#186 · greedy line-break extracted to a seam** (tech-debt refactor) — *What/where:* `text_render.calc_horizontal` Step-1 packing → `_greedy_pack(...)` (+ `_split_words_and_widths`, `_split_into_syllables`). *Why:* 270-line monolith blocked wiring Knuth-Plass (#180) and was high-risk to modify. *Before → After:* greedy logic inline+entangled → an isolated, swappable function with a clear contract; Steps 2–4 unchanged. *Perf Δ:* none (same code path; one extra `select_hyphenator` call, negligible). *Quality:* **byte-identical** output (no behaviour change); unlocks #180 step 2. *Validation:* 16-case characterization net across all language paths + rarely-hit branches; net caught a real `hyphenator` scope leak. *Risk:* covered by the golden net; revert = single commit.

### Key system findings (operational)
- **Knob gating:** in-app render quality depends on the *full* MIT_* knob set on the backend;
  `MIT_BUBBLE_AREA_FIT` gates the #166/#179 anti-overflow path. Missing it → legacy overflow render
  (looked like a regression, was a config gap). See `.claude/memory/project_render_knob_gating.md`.
- **AnimeText model is gated** (`deepghs/AnimeText_yolo`): auto-downloads via `HF_TOKEN` (MIT/.env,
  loaded by `load_dotenv`); needed a one-click "Agree and access repository" on HF first.

### Known gaps vs the MangaTranslator reference
- Font weight still below CC Wild Words → needs a heavier font asset dropped in via `MIT_EN_FONT`.
- Heavily-stylized SFX (`ぬ〜`) is **detected** but the 48px OCR can't read the hand-drawn glyph →
  needs VLM-OCR (#172 upscale won't fix recognition). Detection path is ready.

### Tech-debt register (MIT) — filed 2026-06-09, label `MIT`
| Issue | Area | Sev | Status |
|---|---|---|---|
| #186 | `calc_horizontal` → pluggable LineBreaker seam | HIGH | **seam extracted** (in progress) |
| #187 | `MangaTranslator` god object (~3,200 lines) → stage orchestrators + Context | HIGH | open |
| #188 | model load/lifecycle + translator retry/config base abstractions (kill global `MODEL`) | HIGH | open |
| #189 | glyph-render dedup (`put_char` h/v + stroke ~200 dup lines) | HIGH | open |
| #190 | `resize_regions_to_font_size` + box-padding decomposition + constants | MED | open |
| #191 | vendored LDM (~3000 LOC) + YOLOv5 trim (license + maintenance) | MED | open |
| #192 | config centralize + cleanup (`load_dotenv` import side-effect, bare excepts, TranslatorChain TODO) | MED | open |
| #193 | worker `--start-instance` lifecycle (5003/5004 orphan, PID, port collision) | MED | open |

### Tech-debt progress
- **#186:** built a 16-case characterization net (all language paths + rarely-hit branches), then
  extracted `_split_words_and_widths`, `_split_into_syllables`, and the Step-1 greedy packer
  `_greedy_pack(...)` — **byte-identical**. The pluggable line-break seam now exists → **#180 step 2**
  (Knuth-Plass) is unblocked at the code level.

### Commits
`bc6902c` (render-parity + SFX) · `a9dd09b` (frontend/misc WIP) · `9739b9d` (Knuth-Plass pure module) ·
`03bc6ae` (#180→#186 deferral note) · `fdfb297` · `15f132d` · `778d144` (#186 seam + net).

---

## 2026-06-09 (cont.) — Tech-debt remediation (foundation phase)

Executing `docs/reports/tech-debt-remediation-plan.md` (foundation-first). Each refactor = characterization/
unit net first, byte-identical, shipped + validated per increment.

**#192 (a) · extract TranslatorChain parsing** — *What/where:* `config.py` parse → pure
`translator_chain.parse_translator_chain` (deps injected). *Why:* resolve the `# TODO: Refactor`;
make translator-chain parsing testable without the ML stack. *Before → After:* parse welded into the
class (untestable without importing `translators`) → pure function with 7 unit tests + a 1-line delegation.
*Perf Δ:* none. *Quality:* byte-identical (real-deps check `gemini:ENG` → identical chain/translators/langs/
target_lang). *Validation:* `test_translator_chain.py` 7 passed + source-inspection wiring test. *Risk:*
behaviour-preserving; revert = single commit. *Links:* #192.

**#187 (a) · extract repetition-hallucination check** — *What/where:* `MangaTranslator._check_repetition_hallucination` (a pure verdict, ~50 lines) → `translation_checks.check_repetition_hallucination`. *Why:* start decomposing the god object at the validator seam so new checks attach there, not inside the orchestrator (anti-compounding). *Before → After:* pure logic welded as an async method on a 3,200-line class → a unit-tested pure function; the method now delegates. *Perf Δ:* none. *Quality:* byte-identical (verified vs the pure fn on 4 cases). *Validation:* `test_translation_checks.py` 5 passed + delegation equality check. *Risk:* behaviour-preserving; revert = single commit. *Links:* #187.

**#187 (b) · extract target-language-ratio check** — *What/where:* `MangaTranslator._check_target_language_ratio` → `translation_checks.check_target_language_ratio` (script_ratio injected). *Why:* complete the validator seam at the god object's post-translation checks. *Before → After:* second pure verdict welded as an async method → unit-tested pure function; method delegates. *Perf Δ:* none. *Quality:* byte-identical (verified vs pure fn across empty/below/at-threshold). *Validation:* test_translation_checks.py 10 passed. *Risk:* behaviour-preserving. *Links:* #187, #109.

**#187 (c) · de-duplicate punctuation correction** — *What/where:* the check_items/replace_items quote-bracket correction, DUPLICATED inline in two MangaTranslator paths, → `punctuation.correct_punctuation`. *Why:* a new punctuation rule previously meant editing two copies inside the god object; now one tested function. *Before → After:* ~150 lines of duplicated data-tables + loops in the orchestrator → a single pure function both sites delegate to. *Perf Δ:* none. *Quality:* byte-identical (6 golden cases). *Validation:* test_punctuation.py 7 passed; regression suite 36 passed. *Risk:* behaviour-preserving; both sites verified to delegate, data tables removed. *Links:* #187.

**#187 S1 · collapse 3-way region filter** — *What/where:* the verbatim `should_filter` block, duplicated in 3 MangaTranslator paths → `region_filter.filter_translated_regions`. *Why:* the corrected step 1 from the deep analysis — a 3-way drift surface where a filter tweak silently diverged across single/batch/concurrent. *Before → After:* 3 identical inline copies (~28 lines each) → one tested function all sites delegate to (should_filter 3→0). *Perf Δ:* none. *Quality:* byte-identical incl. none/original carve-outs. *Validation:* test_region_filter.py 7 passed; regression 35 passed. *Risk:* behaviour-preserving. *Links:* #187 (seam S1).

**#187 S2 · fold translation→region assignment** — *What/where:* the happy-path "assign translation + stamp target_lang/_alignment/_direction" loop (4 copies: single/batch-memory-fallback/batch-shared-index/concurrent), the retry-path render-casing (5th copy), and the error-fallback "source-text-as-translation" loop (3 copies) → `region_apply.{apply_translations, apply_render_casing, apply_original_as_translation}`. *Why:* corrected step 2 — 8 assignment loops where any tweak to casing/metadata could silently diverge per-mode. *Before → After:* 8 inline `region.translation = …` loops → 3 tested functions all sites delegate to (assign loops 8→0). *Perf Δ:* none (one per-context list slice `translated_texts[text_idx:]` in the batch path; negligible). *Quality:* byte-identical — L10 zip-truncation preserved (concurrent's `i<len` guard collapses to the same zip kept-set); single-path-only casing kept behind an `apply_casing` flag (batch/concurrent never cased); batch shared-index preserved by returning the consumed count so the caller advances `text_idx`. *Validation:* test_region_apply.py 9 passed; region_filter 7 + translation-path regression 32 passed; full suite 177 passed (19 async-not-supported failures pre-existing, verified identical on stashed base). *Risk:* behaviour-preserving. *Links:* #187 (seam S2).

**#187 S3 / #188 starts · ModelUsageTracker** — *What/where:* the bare `_model_usage_timestamps` dict — stamped from 8 inline `_run_*` sites and swept in `_detector_cleanup_job` — → `model_usage_tracker.ModelUsageTracker` (`touch(tool, model, now)` / `expired(ttl, now)` / `forget(tool, model)`), clock injected. *Why:* #188 begins by getting model-lifecycle state out of the god object behind a tiny, ML-free testable surface, and **pinning the L1 key-drift** (the 8 keys `'colorizer'`/`'textline_merge'`/`'rendering'` etc.) as a golden before S4 ModelUnloader freezes the unload routing. *Before → After:* dict + inline `[(k)] = current_time` ×8 + a `list(items())` sweep with mid-iteration `del` → 8 `touch(...)` calls + `for tool, model in tracker.expired(...): unload; tracker.forget(...)`. *Perf Δ:* none. *Quality:* byte-identical — keys preserved verbatim (no normalisation → L1 drift intact), strict `> ttl`, insertion-order `list(...)` snapshot so mid-sweep `forget` is safe (L13). *Validation:* test_model_usage_tracker.py 7 passed (strict-`>` boundary, insertion order, forget, safe-forget-during-iteration, re-touch refresh); full suite 184 passed (same 19 pre-existing async failures). *Risk:* behaviour-preserving; fully encapsulated (0 remaining `_model_usage_timestamps` refs). *Links:* #187 (seam S3), #188.

**#187 S4 / #188 · ModelUnloader** — *What/where:* the `match tool:` block in `MangaTranslator._unload_model` → `model_unloader.ModelUnloader` (injected `{tool: async unload_fn}` table + `empty_cache`/`cuda_available` hooks); `_unload_model` is now a one-line delegate. *Why:* freeze the unload routing as data (the table) behind a tiny ML-free testable surface, and lock in that the L1-drifted keys the tracker stamps (`'colorizer'`/`'textline_merge'`/`'rendering'`) route to **nothing** — the same latent no-op the `match/case` had. *Before → After:* 6-arm `match/case` + inline `empty_cache` → a dict the ctor wires from the real `unload_*` imports, `unload(tool, model)` doing `routes.get(tool)` → await → `empty_cache` when CUDA. *Perf Δ:* none. *Quality:* byte-identical — same log line, same fall-through-then-`empty_cache` order, unknown keys no-op (L1 preserved, not fixed). *Validation:* test_model_unloader.py 4 passed (known-tool route+cache, L1-drift no-op ×3, no-cache-when-cuda-unavailable, per-tool routing) via `asyncio.run`; full suite 188 passed (same 19 pre-existing async failures). *Risk:* behaviour-preserving. *Links:* #187 (seam S4), #188.

**#187 S5 · release_memory** — *What/where:* the `gc.collect()` + `if torch.cuda.is_available(): torch.cuda.empty_cache()` cleanup, repeated verbatim in 4 spots (>85% pre-proc guard, MemoryError fallback, per-page individual cleanup, per-batch tail) → `memory_guard.release_memory(cuda_available, empty_cache)`. *Why:* a 4-way verbatim dup; injecting the two torch hooks makes the cleanup unit-testable with no torch. *Before → After:* 4× `import gc / gc.collect() / if cuda: empty_cache()` → 4 one-line `release_memory(torch.cuda.is_available, torch.cuda.empty_cache)` calls (0 remaining `gc.collect`/`import gc` in the god object). *Scope note:* the single psutil `virtual_memory().percent > 85` pressure check is **not** extracted — it has one call site, so there is nothing to de-duplicate; folding it would add a function without removing drift (kept surgical per the North Star; `under_memory_pressure()` deferred until a 2nd site appears). *Perf Δ:* none. *Quality:* byte-identical — same `gc.collect`-then-`empty_cache` order, same cuda gating. *Validation:* test_memory_guard.py 2 passed (collect-then-empty when cuda; collect-only when not); full suite 190 passed (same 19 pre-existing async failures). *Risk:* behaviour-preserving. *Links:* #187 (seam S5).

**#187 S7 · context_page_counts** — *What/where:* the `(pages_used, skipped)` context-carry accounting block, identical in single dispatch (`_dispatch_with_context`) and concurrent dispatch (`_batch_translate_texts`) → `context_counts.context_page_counts(context_size, done_pages)`. *Why:* the two copies feed the `Carrying N` / `Skipped N` log lines; folding guarantees the two paths' numbers can't drift. *Before → After:* 2× ~9-line `if context_size>0 and done_pages: …pages_expected/non_empty_pages/pages_used/skipped… else: 0,0` → 2 one-line calls. *Scope note:* `_build_prev_context` recomputes its own `non_empty_pages`/`pages_used` to slice the context tail — that is the S6 seam, intentionally left untouched here. *Perf Δ:* none. *Quality:* byte-identical — both counts capped at `context_size`, blank-page detection `any(sent.strip() …)` preserved (7 characterization cases incl. the budget-caps-so-empty-page-not-skipped edge). *Validation:* test_context_counts.py 7 passed; full suite 197 passed (same 19 pre-existing async failures); context regression (test_page_context/test_series_context) green. *Risk:* behaviour-preserving. *Links:* #187 (seam S7).

**#187 S8 · apply_post_dictionary** — *What/where:* the post-translation dictionary apply+log block, verbatim in single (`_translate`) and batch (`_apply_post_translation_processing`) → `dictionary.apply_post_dictionary`; the pure `load_dictionary`/`apply_dictionary` helpers were moved out of the god-object file into the same `dictionary.py` so the stage tests without the ML stack. *Why:* two verbatim copies of "apply post-dict to every region's translation, collect & log the replacements"; centralising it also gives the dict helpers a real home. *Before → After:* 2× ~14-line block → 2 one-line `apply_post_dictionary(ctx.text_regions, self.post_dict)`; the two inline `def`s removed from `manga_translator.py` and re-imported (so `from .manga_translator import load_dictionary` still resolves — `__main__.py` untouched). *Perf Δ:* none. *Quality:* byte-identical — same `before => after` records, same per-line + summary + "No post-translation replacements made." logs, same `regex`-module semantics. *Validation:* test_dictionary.py 6 passed (replace, token-delete, summary+per-line logs, no-replacements message, empty-path no-op, moved-helper parse); re-export verified (`load_dictionary.__module__ == manga_translator.dictionary`); full suite 203 passed (same 19 pre-existing async failures). *Risk:* behaviour-preserving. *Links:* #187 (seam S8).

**#187 S6 · build_prev_context (pure fn)** — *What/where:* `MangaTranslator._build_prev_context` (the ~50-line per-mode context-string builder) → pure `prev_context.build_prev_context(all_page_translations, original_page_texts, context_size, *, use_original_text, current_page_index, batch_index, batch_original_texts)`; the method is now a thin delegate so its two call sites are untouched. *Why:* the per-mode index policy (single all-done / `current_page_index` slice / concurrent batch-append) was implicit `self`-state; making it explicit args lets the L7 asymmetry be characterized in isolation. *Before → After:* method body moved out verbatim; `hasattr(self, '_original_page_texts')` → `original_page_texts is not None` (equivalent — the attr is always init'd `[]`, so hasattr was always True). *Perf Δ:* none. *Quality:* byte-identical — preserves the L7 `available_pages.index(page)` **first-match** (duplicate-content pages map to the earliest original), the `pages_used==0`/`not available_pages` empty short-circuits, and the concurrent `pass` (no append when not using original text). *Process note:* Serena `replace_symbol_body` mis-detected the method's start line and produced a duplicate def + ate part of `_dispatch_with_context`; caught immediately by grep, reverted the file to the S8 state, redid the swap with an anchored regex. *Validation:* test_prev_context.py 11 passed (incl. L7 first-match, blank-skip, current_page_index slice, concurrent append vs pass, original-fallback); context regression (test_page_context/test_series_context) green; full suite 214 passed (same 19 pre-existing async failures). *Risk:* behaviour-preserving. *Links:* #187 (seam S6).

**#187 S9 · none-translator front-matter guards** — *What/where:* two landmine pieces of `_run_text_translation`'s front-matter → `none_translator.{apply_prep_manual_override, stamp_none_translations}`. *Why:* name + test + document the L12 config mutation and the L3 return-all asymmetry rather than leaving them buried. *Before → After:* `if self.prep_manual: config.translator.translator = none` → `apply_prep_manual_override(config, self.prep_manual)`; the inline none-stamp loop → `stamp_none_translations(ctx.text_regions, config)`. The call-site **order is preserved exactly** (override → `tracker.touch` → if-none stamp + `return ctx.text_regions`) so the touch still fires for the none path. *Perf Δ:* none. *Quality:* byte-identical — L12 in-place mutation kept (poisons a reused Config, by design), L3 returns **all** regions unfiltered (vs the filtered normal path), blank-translation stamps unchanged. *Validation:* test_none_translator.py 4 passed (prep_manual true/false, none-stamp metadata, empty-list no-op); full suite 218 passed (same 19 pre-existing async failures). *Risk:* behaviour-preserving. *Links:* #187 (seam S9).

**#187 S10 · translation side-channel I/O** — *What/where:* the `--load-text`/`--save-text` JSON read/write in `_run_text_translation` → `translation_store.{read_translations, write_translations}`. *Why:* isolate + test the byte-identical serialisation (`indent=4, ensure_ascii=False`). *Before → After:* inline `with open(...,"r"): json.load` / `with open(...,"w"): json.dump(...)` → `read_translations(path)` / `write_translations(path, sentences)`. *Scope note:* the `print(...)` + bare `exit(-1)` (**L2**) and the `os.path…input_files[0]` filename derivation are **left inline** at the call site (the exit is a process-control landmine clearer when visible); **no IndexError guard added** (would change behaviour). *Latent bug surfaced (preserved, not fixed):* the inline `open(...,"w")` had **no `encoding=`**, so on a cp1252-default platform `ensure_ascii=False` non-ASCII raises `UnicodeEncodeError` — a test characterizes the format + the unescaped-`ensure_ascii=False` bytes; candidate fix `encoding="utf-8"` deferred to an opt-in change. *Perf Δ:* none. *Quality:* byte-identical. *Validation:* test_translation_store.py 3 passed (round-trip, indent-4 array, non-ASCII unescaped); full suite 221 passed (same 19 pre-existing async failures). *Risk:* behaviour-preserving. *Links:* #187 (seam S10), L2.

**#187 S11 · ImageDebugContext (full class)** — *What/where:* the scattered `_current_image_context` / `_saved_image_contexts` instance state, the `_set/_get/_save/_restore_image_context` helpers, `_result_path`, and the two manual save/restore swap closures → `image_debug_context.ImageDebugContext` (`set`/`subfolder`/`save`/`restore`/`clear_saved`/`with_context`/`result_path`). *Why:* the biggest tech-debt pocket in this batch — per-image debug-folder lifecycle spread across ~20 call sites with duplicated swap boilerplate; consolidating it is the long-term-debt win the user asked for. *Before → After:* `self._current_image_context`/`self._saved_image_contexts` → one `self._image_debug` object; the 5 methods became **thin delegates** (call sites unchanged); ~18 direct `self._current_image_context` reads → `self._image_debug.current`; the 2 swap closures (`original=…; …=X; try: result_path; finally: …=original`) → `with self._image_debug.with_context(X): return self._result_path(path)`. *Perf Δ:* none. *Quality:* byte-identical — same subfolder format, same verbose/web/`result_sub_folder` path branches incl. the no-context default `{ts}-unknown-1024-unknown-unknown`, same `makedirs(dirname)`, same `getattr` defaults (1024/'unknown'); dict shape unchanged so all `['subfolder']`/`['file_md5']`/`.copy()`/truthiness reads behave identically. *Validation:* test_image_debug_context.py 13 passed (subfolder, save/restore round-trip + miss, no-current save no-op, with_context swap + exception-restore, 5 result_path goldens, set with/without image incl. getattr defaults); full suite 234 passed (same 19 pre-existing async failures); diff reviewed call-site-by-call-site. *Risk:* behaviour-preserving (invasive but mechanical; 0 orphan refs). *Links:* #187 (seam S11), L11-adjacent debug paths.

**#187 S12 (globals) · apply_global_settings** — *What/where:* the process-global construction side effects inline in the constructor — the conditional `ModelWrapper._MODEL_DIR` override (was in `parse_init_params`) and the two `torch.backends.*.allow_tf32 = True` flags (were in `__init__`) → `pipeline_params.apply_global_settings(params)`, called once after `parse_init_params`. *Why:* isolate process globals from value-parsing (the analysis's explicit "separate apply_global_settings"); also removed the now-unused `ModelWrapper` import. *Scope:* only the **globals half** of S12 — the `PipelineParams` value object for the ~20 parsed fields is **deferred until #192** (it is entangled with the device / `using_gpu` / raise logic + ordering, which the analysis gates on config-centralisation). *Before → After:* `_MODEL_DIR` set mid-`parse_init_params` + TF32 set in `__init__` → one `apply_global_settings(params)` call; byte-identical (nothing reads `_MODEL_DIR` between its old and new position, and models load lazily at translate time). *Perf Δ:* none. *Quality:* byte-identical — same conditional override, same TF32 flags, same relative order (_MODEL_DIR before TF32). *Validation:* test_pipeline_params.py 3 passed (model_dir override / absent-or-empty no-op / TF32 flags); full suite 237 passed (same 19 pre-existing async failures); 0 `ModelWrapper` refs left in the god object. *Risk:* behaviour-preserving. *Links:* #187 (seam S12, globals), #192 (gates the value-object half).

**#187 S20 / #188 · ModelReaper (TTL loop)** — *What/where:* `MangaTranslator._detector_cleanup_job` (the background model-TTL polling loop) → `model_reaper.ModelReaper(tracker, unloader, get_ttl)`; `_loop` polls `reap_once(now)` once/sec; the 2 task-creation sites now call `self._model_reaper.start()` behind their existing `is None` guard. *Why:* lift the #188 TTL loop out of the god object onto the S3 tracker + S4 unloader, and give the leaked task a cancel handle. *Before → After:* inline `while True: ttl==0?sleep:continue; sweep; sleep` → `reaper.start()`; the sweep is the testable `reap_once`. *Perf Δ:* none (one extra `time.time()` per idle tick — no side effect). *Quality:* byte-identical — `ttl==0` short-circuit preserved, `list(...)` snapshot (L13) intact via `tracker.expired`, `unload`-before-`forget` order kept. **L14 fix is opt-in:** `stop()` cancels the task but **nothing calls it by default**, so the cleanup-task leak is preserved verbatim until a caller opts in. *Validation:* test_model_reaper.py 5 passed (unload→forget order, ttl==0 no-op incl. `expired` not queried, start creates task, stop cancels, stop-no-task no-op) via `asyncio.run`; full suite 242 passed (same 19 pre-existing async failures). *Risk:* behaviour-preserving. *Links:* #187 (seam S20), #188, L13/L14.

**#187 S13 / #168 · DetectionPostProcessor** — *What/where:* `_merge_sfx_detections` + `_textline_aabb` (the AnimeText SFX second-pass merge, gated by `config.detector.det_sfx`) → `detection_postproc.{merge_sfx_detections, textline_aabb}`; `_run_detection` now calls `merge_sfx_detections(ctx, result, self.device)`. *Why:* lift the #168 SFX-merge off the god object into a light module (ML imports stay lazy); done without S15 (the call-site gate is unchanged). *Before → After:* 2 methods on `MangaTranslator` → 2 functions; `device` passed in (was `self.device`). *Perf Δ:* none. *Quality:* byte-identical — same IoA dedup, same empty-`Quadrilateral` append, same `[SFXDetect]` log, same `str(device or 'cuda')`. *Stale-test fix (surfaced by S13's full-suite run):* two **source-inspection wiring tests** were repointed to the post-refactor module locations — `test_sfx_merge` (the merge body moved to `detection_postproc.py`) and, **pre-existing since S2 merged**, `test_safe_area::test_en_uppercase_lettering_is_wired` (S2 had moved the casing to `region_apply.py` but the test still grepped `manga_translator.py`). The MIT test baseline is now **18 async-only failures** (was 19 — one was this stale wiring test). *Validation:* test_detection_postproc.py 2 passed (AABB golden, no-SFX identity short-circuit); test_sfx_merge + test_safe_area green again; full suite 245 passed / 18 pre-existing async. *Risk:* behaviour-preserving. *Links:* #187 (seam S13), #168.

**#187 S16 · TranslationMemory** — *What/where:* the two cross-page lists (`all_page_translations` + `_original_page_texts`) that lived directly on the god object + `reset_page_context` → `translation_memory.TranslationMemory` (`all_page_translations`, `original_page_texts`, `reset()`); `self._translation_memory` holds them and ~16 direct refs were renamed; `reset_page_context` delegates to `.reset()`. *Why:* make the #136/#140 worker-singleton bleed boundary an explicit object (L9). *Before → After:* two bare instance lists → one named memory object; the lists stay plain lists so `.append()` / `len()` / `[i]=` / slicing behave identically. *Perf Δ:* none. *Quality:* byte-identical — append sites still driven by the caller (L7 per-mode asymmetry preserved), `reset` still only called from `translate_patches` (L9 asymmetry), and `reset` rebinds (not `.clear()`) verbatim. Updated `test_page_context`'s `_bare_translator` to the new memory location. *Validation:* test_translation_memory.py 4 passed (empty init, appendable, reset clears, reset-rebinds-not-clears); context regression (test_page_context/test_series_context) green; full suite 249 passed / 18 pre-existing async. *Risk:* behaviour-preserving. *Links:* #187 (seam S16), #136/#140, L7/L9.

**#187 S19 · gather_per_context** — *What/where:* the concurrent driver's `asyncio.gather(return_exceptions=True)` + per-exception keep-original placeholder loop → `gather_per_context.gather_per_context(tasks, contexts_with_configs, ignore_errors)`. *Why:* isolate + test the failure-reconciliation (re-raise vs index-aligned placeholder) of the concurrent path. *Before → After:* ~20-line inline try/gather + `for i, result: if isinstance(Exception): …` → one `final_results = await gather_per_context(...)` call (bracketing `Starting/Completed` logs kept). *Perf Δ:* none. *Quality:* byte-identical — same `return_exceptions=True`, same re-raise-unless-`ignore_errors`, same `apply_original_as_translation` placeholder gated on `ctx.text_regions`, same index alignment + logs. *Validation:* test_gather_per_context.py 4 passed (all-succeed order, exception+ignore→placeholder index-aligned, exception+not-ignore→reraise-original, no-regions skips-apply) via `asyncio.run`; full suite 253 passed / 18 pre-existing async. *Risk:* behaviour-preserving. *Links:* #187 (seam S19).

---

## 2026-06-09 — AFK decomposition batch complete (S12-globals, S20, S13, S16, S19) — stopped before the core

After PR #195 (S2–S11) merged, an AFK batch landed five more byte-identical seams on a stack, then **stopped before the high-risk async-orchestration core** (S15/S17/S18/S21–S26) per the dev's instruction (those need E2E-per-step, not unattended runs). Per-seam before→after blocks are above. **Test baseline corrected to 18 async-only failures** (a stale `test_en_uppercase_lettering_is_wired` left by S2's casing move was fixed in S13). Net: `manga_translator.py` lost the model-TTL loop, the SFX merge, the cross-page lists, and the concurrent gather block to four more light modules; `apply_global_settings` isolated the construction globals. Full suite **253 passed**, 0 real failures.

**#187 S21 / #188 · ModelLifecycle facade** — *What/where:* the duplicated eager-preload block (×2, gated `models_ttl==0`) and the duplicated cleanup-task guard (×2) → `model_lifecycle.ModelLifecycle(reaper, prepare_fns)` with `preload(config, device, models_ttl)` + `ensure_running()`; the guard's idempotency moved into `ModelReaper.ensure_started()`. *Why:* the #188 lifecycle capstone — fold the construction-time preload + the start-once guard onto the S20 reaper; `self._detector_cleanup_task` is gone (the reaper owns its task). *Before → After:* 2× ~9-line preload + 2× `if self._detector_cleanup_task is None: …start()` → `await self._model_lifecycle.preload(...)` + `self._model_lifecycle.ensure_running()`. *Scope:* the facade wraps the **reaper**; the tracker (S3) + unloader (S4) stay direct (used by the `_run_*` touch sites and the reaper) — absorbing them is high-churn/low-value, deferred. *Perf Δ:* none. *Quality:* byte-identical — same preload order, same `upscale_ratio`/`Colorizer.none` conditions, same `device` threading, same `models_ttl==0` gate, idempotent start preserved (L16). prepare_* injected as a table → tests with no ML. *Validation:* test_model_lifecycle.py 4 passed (ttl-skip, full order+device, upscale/colorizer conditions, ensure_running delegates) + test_model_reaper ensure_started idempotent; full suite 258 passed / 18 pre-existing async. *Risk:* behaviour-preserving. *Links:* #187 (seam S21), #188, L16.

**#187 S17 / #188 · TextTranslationDispatcher** — *What/where:* the duplicated ChatGPT/ChatGPT2Stage translator handling in `_dispatch_with_context` (single) and `_batch_translate_texts` (batch) → `text_translation_dispatcher.{build_chatgpt_translator, dispatch_translate}`. *Why:* the highest-risk dedup — the two copies share the construction switch + parse/set-context + carry/skip logs + the 2stage-vs-chatgpt dispatch, but diverge in load-bearing ways. *Before → After:* ~40 + ~70-line near-duplicate switches → a 2-line construct + a `dispatch_translate(...)` call at each site. **Two functions on purpose:** `OpenAITranslator.__init__` can emit a glossary warning, and single constructs the translator *after* the context log while batch constructs it *before* — so each caller calls `build_chatgpt_translator` at its own point (order preserved) and `dispatch_translate` does the order-invariant rest. *Divergences preserved (parameterised):* chatgpt_2stage `result_path_callback` = bound `_result_path` (single) vs the `with_context` swap closure (batch); the `batch_contexts` multi-image wiring via `on_2stage_batch_setup` (batch-only); and the **context-computation placement** (single computes/logs it unconditionally incl. non-chatgpt, batch only inside its chatgpt branch — both left at the call sites, not moved into the dispatcher). *Perf Δ:* none. *Quality:* byte-identical (the only reorder — `parse_args` now after the silent `build_prev_context` — produces an identical observable log sequence). *Validation:* test_text_translation_dispatcher.py 6 passed (build→openai/2stage, parse/set/translate w/wo ctx, 2stage callback+batch-setup, chatgpt-skips-batch-setup, carry/skip logs) via fake translators + `sys.modules` stubs + `asyncio.run`; full suite 264 passed / 18 pre-existing async. **E2E pending** (the high-risk seams want a live-pipeline pass before merge). *Risk:* behaviour-preserving by construction + unit-characterised; E2E recommended. *Links:* #187 (seam S17).

---

## 2026-06-11 — #189 + #190 render dedup (glyph + resize/render geometry) · PR #215

Two sibling MIT render tech-debt issues, **6 byte-identical seams** (one commit each), each pinned by a golden-pixel characterization test written **before** the edit. Branch `refactor/mit-189-190-render-dedup`. Reported with the full 18-section feature/refactor template ([[feedback-impact-report]]).

**1. What changed.** #189 (`rendering/text_render.py`): the two ~200-line near-duplicate glyph fns `put_char_horizontal`/`put_char_vertical` collapsed onto 3 shared direction-parameterised helpers — `_render_glyph_stroke` (the freetype stroker block + validity check), `_paste_bitmap` (the 4 clip/slice/blend paste sites → 1), `_select_face_for_char` (the font-fallback loop). #190 (`rendering/__init__.py`): `_expand_single_axis` (the 2 single-axis expansion blocks → 1), `_pad_box` (render()'s 4 ratio-padding branches' boilerplate → 1 primitive), named length-ratio constants + deleted the ~14-line dead commented `elif`.

**2. Results.** Render code **−198 net lines** (−375 / +177 across the 2 files). 4 paste copies → 1; 2 glyph twins → shared helpers; 4 padding branches → 1 primitive; 2 font-loop copies → 1. Byte-identical on every changed path (2 deterministic goldens green through all 6 seams). Full suite **331 passed / 18 pre-existing async / 0 new failures**. Live E2E passed.

**3. Expected performance gain %.** **0% runtime — byte-identical, maintainability-only.** The render hot path runs the same operations in the same order; goldens prove identical pixels. No latency/VRAM/throughput change (not a perf optimisation). The gain is maintenance/DX velocity, not CPU.

**4. Benefits.** Single source of truth for glyph stroke/paste/font-fallback + box-padding; future render fixes land in 1 place, not 2–4; smaller divergence surface (the copies had already drifted into a latent bug); a reusable golden harness now guards render pixels; fixed a latent vertical-stroke edge-clip misalignment as a free byproduct.

**5. Purpose.** Remove the largest remaining near-duplicate blocks on the render hot path to cut maintenance cost + bug surface (engineering north star: simplest logic that works · maintainable · sustainable long-term).

**6. Why we changed it + architectural impact.** Two ~200-line copies of glyph logic inevitably drift — they already had: the vertical-*stroke* paste clamped `pen_border≥0` and sliced `bitmap_border[0:]`, misaligning a stroke clipped off the top/left edge, a bug absent from the 3 sibling paste sites. Architecturally render moves from 2 monolithic twins + inline branch soup to small single-purpose unit-testable helpers behind a golden net — "relocate the shared mechanism, keep divergent policy explicit at the call site."

**7. Problems before the refactor.** ~200-line near-duplicate `put_char_h/v`; 4 copies of clip/slice/blend paste; 4 near-identical h/v padding branches; copy-pasted fallback loop in `get_char_glyph`/`get_char_border`; scattered magic numbers (0.3/0.4/1.1); ~80+ lines of dead commented debug; a latent v-stroke clip bug born of the divergence; and **no golden/characterization net on render at all**.

**8. Goals.** Byte-identical dedup; golden-guarded before each edit; one commit per seam; zero behaviour change on any real page; load-bearing divergence relocated, not unified.

**9. Architecture Before.**
```
put_char_horizontal (~200 LOC) ─┐ stroker block (copy A) · char paste (copy A) · stroke paste (copy A)
put_char_vertical   (~200 LOC) ─┘ stroker block (copy B) · char paste (copy B) · stroke paste (copy B, buggy clip)
get_char_glyph / get_char_border  ── fallback loop (copy ×2)
resize_regions_to_font_size       ── h-expansion block ‖ v-expansion block (twins) + ~80 dead lines
render()                          ── 4 ratio-padding branches (zero-box/place/copy ×4)
constants                          ── 0.3 / 0.4 / 1.1 inline magic numbers
[no render characterization tests]
```
**10. Architecture After.**
```
_render_glyph_stroke(cdpt,size,dir) ─┐
_paste_bitmap(canvas,bmp,x,y,blend) ─┼─ put_char_horizontal / put_char_vertical (thin)
_select_face_for_char(cdpt,size,dir)─┘
_expand_single_axis(region,need,used,h_axis) ─ resize_regions_to_font_size (thin orchestrator)
_pad_box(temp_box,pad_height,ext,offset)     ─ render() (4 branches → 4 one-liners + 1 primitive)
_LEN_RATIO_FONT_GAIN / _FONT_SIZE_SCALE_GAIN / _MAX_BBOX_SCALE (named constants)
test/test_put_char_golden.py + test/test_render_golden.py (deterministic golden net)
```
**11. Refactor list.**
| Seam | Commit | Helper |
|------|--------|--------|
| #189 S1 | `b320ff5` | `_render_glyph_stroke` |
| #189 S2 | `84417d8` | `_paste_bitmap` (+ v-stroke clip fix) |
| #189 S3 | `7641474` | `_select_face_for_char` |
| #190 S1 | `00bc673` | `_expand_single_axis` |
| #190 S2 | `94795c0` | `_pad_box` |
| #190 S3 | `e92df75` | named constants + dead-elif removal |
| docs | `ddc8566` | DONE.md + PIPELINE.md §5 |

**12. Metrics.** −198 net render LOC (−375 / +177); 4→1 paste sites; 2 glyph fns deduped; 4→1 padding branches; 2→1 font loop; +2 golden test files (9 glyph cases × 2 dirs × border on/off × 2 sizes + 3 dispatch regions); 331 unit pass / 0 new fail; live E2E 74 s (1200×1705 page, GPU); golden runtime ~12–20 s.

**13. Technical Debt Removed.** 4 paste copies, 2 glyph twins, 2 font-loop copies, 4 padding-branch copies, ~80+ dead debug lines, scattered magic numbers, the latent v-stroke clip bug, and the render-test blind spot (zero characterization coverage before this).

**14. Risk Reduction.** Divergence-bug surface eliminated where it had already produced one bug; the golden net catches any future pixel drift in put_char_*/dispatch in ~15 s; byte-identical guarantee ⇒ zero render-quality regression risk from this change.

**15. Developer Experience Impact.** A render fix now edits 1 helper, not 2–4 hand-synced copies; each helper is unit-testable in isolation; the golden gives fast byte-identical feedback locally (no full GPU E2E needed to catch a pixel regression).

**16. Future Opportunities.** Deferred (flagged): #189 FontStack cache-key fix (a *behaviour* change — alters output on mid-page font switch); #190 RenderTuning dataclass threaded through `dispatch()` (runtime-config machinery not yet needed); an exhaustive scrub of the remaining inline dead-debug comments.

**17. Lessons Learned.** "Relocate, don't unify" load-bearing divergence — the v-border clip, the h/v padding placements, and the both-axes overwrite order were preserved explicitly, not forced into one formula that would shift edge pixels. Golden-pixel characterization is the right guard for pixel-critical refactors. Operational: MIT must launch on `MIT/.venv` (cu121 CUDA torch), not the Store python (cpu) — `--use-gpu` + cpu-torch hangs the worker at `/ready` 503 (poll `/ready`, not `/health`). See [[project-mit-launch-env]].

**18. KPI.** Byte-identical 100% (6/6 golden-passing seams) · regressions 0 (331 pass) · LOC −198 render · dedup 4→1 paste / 2→shared glyph / 4→1 padding · E2E pass (clean Thai render, original↔translated parity) · deferred items 2 (both flagged).

*Validation:* golden-pixel unit (put_char h/v + dispatch h/v, deterministic) + full suite + live direct-MIT E2E (`POST /translate/with-form/image`, Kouchuugun source, 74 s, clean render). *Risk/rollback:* byte-identical; revert = drop the branch (no flag needed). *Links:* #189, #190, PR #215.

## 2026-06-11 — #186 LineBreaker seam (finish) + Knuth-Plass wired (unblocks #180)

Finished the pluggable line-break seam in `calc_horizontal`. Prior sessions had extracted the tokenizers + greedy Step 1 (`_greedy_pack`) under a 15-case characterization net; this session formalised the seam and wired the Knuth-Plass strategy. Branch `refactor/mit-186-linebreaker-seam`, 3 commits. Reported with the full 18-section template ([[feedback-impact-report]]).

**1. What changed.** `rendering/text_render.py`: added a `LineBreaker` Protocol + `GreedyLineBreaker` (delegates to the existing `_greedy_pack`) + `KnuthPlassLineBreaker` (adapts the pure `line_break.find_optimal_line_breaks` to the seam). `calc_horizontal` gained an optional `line_breaker=` param (defaults to greedy) and now packs Step 1 via `breaker.pack(...)`; its greedy-only Step 2 (backward syllable hyphenation) is gated on `breaker.greedy_postprocess`. New `test/test_line_breaker.py`.

**2. Results.** The line-break strategy is now swappable without touching tokenization or Step 4 assembly. Greedy stays the default ⇒ production render **byte-identical** (characterization net + line-break + thai-wrap + font-fit: **23 passed**). The Knuth-Plass strategy is selectable and balances lines (`test_line_breaker.py`: **4 passed**) — on the demo sentence greedy leaves a lone `today` (min 97, spread 117), KP pulls `dog` down (min 137, spread 57). #180 step 2 is now unblocked.

**3. Expected performance gain %.** **Default path: 0% runtime — byte-identical** (greedy unchanged; goldens prove identical line breaking). The KP path is **opt-in and quality-only** (balanced lines, not speed): its DP is O(n²) over a region's *words* (tens, not thousands) — negligible vs OCR/inpaint/translate. No latency/VRAM claim until #180 step 2 measures it under E2E.

**4. Benefits.** Knuth-Plass (built in #180 step 1, dormant since) is finally reachable behind a clean seam; line-break policy lives behind one interface (greedy vs holistic) instead of being hard-wired into a 270-line monolith; both strategies are unit-testable in isolation (no PIL); #180 step 2 collapses from "untangle the monolith" to "select a strategy + E2E."

**5. Purpose.** Pay down the tech debt that blocked #180 step 2: `calc_horizontal` interleaved four concerns over shared mutable state, so dropping in a global DP conflicted with the greedy-assuming post-processing. Expose the strategy as a seam so the algorithm swap is a one-liner, per the north star (simplest logic that works · maintainable · sustainable).

**6. Why we changed it + architectural impact.** Forcing Knuth-Plass into the greedy monolith was flagged high-risk on a core, widely-used wrapper (3 production callers). Architecturally, Step 1 moves from a hard-wired greedy block to a **strategy seam**: tokenization (shared) → `LineBreaker.pack` (swappable) → Steps 2-4 (greedy post-process gated by `greedy_postprocess`; assembly shared). "Relocate the shared mechanism, keep divergent policy explicit" — the greedy-specific re-balancing is gated off for holistic strategies rather than deleted.

**7. Problems before the refactor.** `calc_horizontal` Step 1 was hard-wired greedy; the pure Knuth-Plass module (`line_break.py`, #180 step 1) existed but was **unwired** (#180 step 2 blocked); Steps 2-4 assumed the greedy structure + per-line `hyphenation_idx`, so any alternate strategy conflicted with them; no way to A/B a line-break algorithm.

**8. Goals.** Greedy path byte-identical (golden-guarded); `LineBreaker` interface unit-tested in isolation (no PIL) for both strategies; Knuth-Plass wired as a selectable strategy; greedy stays default so the live render is unchanged; #180 step 2 reduced to a strategy selection behind `render.bubble_area_fit`.

**9. Architecture Before.**
```
calc_horizontal
 ├─ tokenize (_split_words_and_widths / _split_into_syllables)   [extracted earlier]
 ├─ Step 1: _greedy_pack(...)                                    [hard-wired greedy]
 ├─ Step 2: backward hyphenation  ┐
 ├─ Step 3: single-char rebalance ├─ assume greedy structure + hyphenation_idx
 └─ Step 4: assembly              ┘
line_break.find_optimal_line_breaks  ── pure Knuth-Plass DP, UNWIRED (#180 blocked)
```
**10. Architecture After.**
```
LineBreaker (Protocol): pack(...) -> (line_words, line_widths, hyphenation_idx); greedy_postprocess
 ├─ GreedyLineBreaker      (greedy_postprocess=True)  -> _greedy_pack         [default = byte-identical]
 └─ KnuthPlassLineBreaker  (greedy_postprocess=False) -> find_optimal_line_breaks  [opt-in, balanced]
calc_horizontal(..., line_breaker=None)
 ├─ tokenize (shared)
 ├─ Step 1: breaker.pack(...)                         [swappable seam]
 ├─ Step 2: gated on breaker.greedy_postprocess       [greedy-only]
 ├─ Step 3: greedy rebalance (natural no-op for KP — never shares a word across lines)
 └─ Step 4: assembly (shared)
test/test_line_breaker.py — both strategies in isolation (no PIL) + real-font selectable proof
```
**11. Refactor list.**
| Seam | Commit | Change |
|------|--------|--------|
| #186 C1 | `09e8c8c` | `LineBreaker` Protocol + `GreedyLineBreaker`; `calc_horizontal` `line_breaker=` param + Step 2 gate (byte-identical) |
| #186 C2 | `426f4a2` | `KnuthPlassLineBreaker` adapter + `test/test_line_breaker.py` (no-PIL isolation + real-font selectable) |
| #186 C3 | docs | PIPELINE.md §5 + DONE.md + this report |

**12. Metrics.** `text_render.py` +46 LOC (seam: Protocol + 2 breakers) over the already-extracted `_greedy_pack`; +68 LOC test (`test_line_breaker.py`, 4 tests). Default-path tests: 23 passed (15-case char net + 5 line-break + thai-wrap + font-fit) ⇒ byte-identical. New breaker tests: 4 passed. 3 production callers unaffected (all pass ≤6 args; new param inert). KP balance on demo sentence: min 97→137, spread 117→57.

**13. Technical Debt Removed.** The #180-blocking entanglement of Step 1 with the greedy-assuming Steps 2-4; the dead-on-arrival unwired Knuth-Plass module; the hard-wired single-strategy line-break; the absence of isolated (no-PIL) line-break unit coverage for an alternate strategy.

**14. Risk Reduction.** Default greedy is byte-identical (15-case golden net green) ⇒ zero render regression risk from this change. The KP strategy is opt-in (default off), so it cannot affect the live render until #180 step 2 deliberately selects it behind `render.bubble_area_fit` + E2E. Both strategies are unit-pinned in isolation, so a future edit that breaks either fails fast (~12 s, no GPU).

**15. Developer Experience Impact.** Swapping the line-break algorithm is now `calc_horizontal(..., line_breaker=KnuthPlassLineBreaker())` instead of surgery on a 270-line monolith; line-break logic is testable without fonts/PIL via a stubbed width fn; #180 step 2 is a small, low-risk follow-up.

**16. Future Opportunities.** #180 step 2: select `KnuthPlassLineBreaker` behind `render.bubble_area_fit` (or a dedicated knob) + production E2E + tuning of `badness_exponent`/`hyphen_penalty`. Give KP word-level over-wide handling (currently a lone over-wide word overflows; syllable splitting stays the greedy path's job) and empty-text parity. Potentially make Step 3 explicitly strategy-gated (today it's a proven no-op for KP).

**17. Lessons Learned.** A seam is the cheap way to defuse a high-risk wiring: rather than force Knuth-Plass into greedy-assuming code, gate the greedy-specific post-process behind a strategy flag and keep assembly shared. "Relocate, don't unify" again — Step 2 is gated off for holistic strategies, not deleted. Unit-testing the interface with a stubbed width fn keeps the proof fast and PIL-free while a single real-font test pins the end-to-end selectable behaviour.

**18. KPI.** Default byte-identical 100% (23/23 default-path tests) · regressions 0 · new isolated coverage +4 tests (both strategies, no PIL) · #180 step 2 unblocked · KP line-width spread −51% on the demo (117→57) · deferred items: #180 step-2 selection + KP over-wide/empty parity (flagged).

*Validation:* characterization net (greedy byte-identical) + `test_line_breaker.py` (both strategies isolated + real-font selectable). Live E2E deferred to the verify step / #180 step 2 (default path is byte-identical so the live render is unchanged). *Risk/rollback:* default byte-identical, KP opt-in/off; revert = drop the branch. *Links:* #186, #180, #178.

## 2026-06-11 — #188 S22 DispatchRegistry + kill global MODEL in detection (last #188 model-lifecycle seam)

Landed the final model-lifecycle seam of the #187/#188 god-object decomposition: collapse the duplicated dispatch get/cache/unload trio into one `DispatchRegistry`, and thread the detector net explicitly to delete the module-global `MODEL`. Code was complete on `refactor/mit-188-dispatch-registry-global-model`; this rebased it onto current main (clean — disjoint from the #215/#216 render work) and verified. Full 18-section template ([[feedback-impact-report]]).

**1. What changed.** (a) `dispatch_registry.py` — a 33-line `DispatchRegistry(registry, kind)` with `get`/`unload`, folding the byte-identical `get_X` (lazy cache) + `unload` (pop) + cache-dict trio that the **6** dispatch `__init__` modules (detector/ocr/inpainter/upscaler/colorizer/translators) each copy-pasted. Each module now wires `get_X = registry.get` / `unload = registry.unload` and keeps its own divergent `prepare`/`dispatch`. (b) Detection: `det_batch_forward_default(batch, device, model)` takes the net explicitly; `_load` drops the module-global `MODEL`, `_infer` threads `self.model`; `craft.py`'s global was dead code (deleted). New `test_dispatch_registry.py` (5) + `test_det_forward_default.py` (2, default + dbnet).

**2. Results.** Dispatch boilerplate folded 6→1; no `MODEL` global left in detection (concurrent detector loads can't clobber). Byte-identical: the `if not cache.get` re-create quirk and the `','.join` ValueError message are preserved verbatim. Rebased onto main: **342 passed / 18 pre-existing async / 0 new failures** (335 main + 7 S22). Prior full-stack E2E (production tunnel, Kouchuugun ch1 p0 EN→TH) returned **2 patches 649×1492 + 451×1489 = pixel-exact to baseline**.

**3. Expected performance gain %.** **0% runtime — byte-identical.** The registry does the same lazy-instantiate/cache/pop the inline code did; goldens/units prove identical behaviour. The global-`MODEL` removal is a **correctness/concurrency** change (removes a latent two-detector clobber), not a perf change — no latency/VRAM delta.

**4. Benefits.** One source of truth for dispatch caching (a cache/unload fix lands once, not 6×); detection is concurrency-safe (no shared mutable global on the forward hot path); the registry + threaded-model are unit-pinned; finishes the model-lifecycle half of #188 so the only remaining #187/#188 work is S12 (🔒 #192) + the translator base-abstraction half.

**5. Purpose.** Close out the model load/lifecycle decomposition (#188): kill per-impl boilerplate and the global model state the issue calls out, so model dispatch is one tested seam rather than 6 hand-synced copies + a concurrency landmine.

**6. Why we changed it + architectural impact.** Six copies of the get/cache/unload trio drift independently, and a module-global `MODEL` on the detection forward path is unsafe the moment two detectors load. Architecturally, model dispatch moves from "copy-pasted trio per module + global net" to "one `DispatchRegistry` owning lifecycle, model passed explicitly" — the per-module `prepare`/`dispatch` stay (load-bearing divergence: different methods/args/early-returns), relocated-not-unified.

**7. Problems before the refactor.** 6× duplicated `get_X`/`unload`/cache dict; a module-global `MODEL` in `detection/default.py` + `dbnet_convnext.py` (read in the batch-forward) = concurrency hazard; a dead global in `craft.py`; no isolated test on dispatch caching or the detector forward transform.

**8. Goals.** Fold the dispatch trio byte-identical; remove the detection global without changing the forward's numerics; unit-pin both; keep each module's divergent prepare/dispatch; land on current main with 0 new failures.

**9. Architecture Before.**
```
detection/__init__.py   ── get_detector / unload / DETECTORS cache  ┐
ocr/__init__.py         ── get_ocr / unload / OCRS cache            │  6x copy-pasted
inpainting/__init__.py  ── get_inpainter / unload / cache           ├─ get/cache/unload trio
upscaling, colorization ── ...                                      │
translators/__init__.py ── get_translator / unload / cache          ┘
detection/default.py + dbnet_convnext.py ── global MODEL set in _load, read in det_batch_forward_default (hazard)
detection/craft.py      ── dead global MODEL
```
**10. Architecture After.**
```
dispatch_registry.py: DispatchRegistry(registry, kind).get(key,*a,**kw) / async unload(key)
 ├─ detection/ocr/inpainting/upscaling/colorization/translators: get_X = reg.get ; unload = reg.unload
 └─ each keeps its own prepare/dispatch (divergent — untouched)
det_batch_forward_default(batch, device, model)  ── model threaded explicitly; NO global MODEL anywhere in detection
test_dispatch_registry.py (5) + test_det_forward_default.py (2)
```
**11. Refactor list.**
| Seam | Commit (pre-rebase) | Change |
|------|---------------------|--------|
| S22a | `bd788b5` | `DispatchRegistry` + wire detector/ocr/inpainter/upscaler/colorizer |
| S22b | `cc8785d` | fold `translators/__init__.py` onto the registry |
| #188 global | `f5d60bc` | thread model in `detection/default.py` (kill global) |
| #188 global | `859506d` | finish in `dbnet_convnext` + delete `craft` dead global |
| docs | `dc04369` | DONE.md Lane A + full-stack E2E record |

**12. Metrics.** 13 files, +201 / −72; dispatch trio 6→1 (`dispatch_registry.py` 33 LOC); global `MODEL` removed from 3 detection files; +2 test files / 7 cases. Suite 342 pass (was 335 on main) / 0 new fail. Prior E2E byte-exact (2 patches).

**13. Technical Debt Removed.** 6 copies of the dispatch get/cache/unload trio; the detection global-`MODEL` concurrency hazard (2 files) + 1 dead global; the test blind spot on dispatch caching + detector forward numerics.

**14. Risk Reduction.** Concurrency hazard on the detection hot path eliminated (no shared mutable global); dispatch behaviour pinned by 5 cases (lazy-once, arg-forwarding, exact ValueError, unload-reinstantiate, unknown-key no-op) and the forward transform by 2 (NHWC→NCHW + sigmoid, real torch). Byte-identical ⇒ no translation-quality regression (E2E byte-exact).

**15. Developer Experience Impact.** A dispatch cache/unload change is now one edit in `DispatchRegistry`, not 6 hand-synced copies; the detector forward is testable with a fake net (no model download); the resume tracker now shows the #188 model-lifecycle half complete.

**16. Future Opportunities.** Remaining #187/#188: **S12** `PipelineParams` value-object (🔒 #192) and the **translator base-abstraction half** of #188 (`BaseGPTTranslator`, xhigh). `prepare`/`dispatch` could later share more if their divergence is ever paid down (currently load-bearing, left explicit).

**17. Lessons Learned.** Fold the mechanism, keep policy per-module: the get/cache/unload trio is identical (→ registry) but `prepare`/`dispatch` genuinely diverge (→ stay inline). Killing a global is safest when the replacement is threaded explicitly and pinned by a transform test. A code-complete branch that fell behind main lands cleanly when the two streams are disjoint (render vs dispatch) — rebase + full-suite is enough proof.

**18. KPI.** Byte-identical 100% (units + prior E2E byte-exact) · regressions 0 (342 pass) · dispatch boilerplate 6→1 · detection globals removed 3→0 · new coverage +7 cases · #188 model-lifecycle half complete (S3/S4/S20/S21/S22) · remaining: S12 (🔒#192) + BaseGPTTranslator.

*Validation:* `test_dispatch_registry` + `test_det_forward_default` + full suite (342 pass / 0 new fail on rebased main) + prior full-stack production-tunnel E2E (byte-exact patches). *Risk/rollback:* byte-identical; revert = drop the branch. *Links:* #188, #187, resume `docs/reports/mit-refactor-progress.md`.

## 2026-06-11 — #193 harden --start-instance worker lifecycle (port-collision + orphan cleanup)

Operational reliability fix for the two-port `--start-instance` model. Unlike the byte-identical refactors above this is a **behaviour change** (it adds a startup guard that can fail loudly and hardens shutdown), so it's scoped tightly: the happy path is preserved, only the failure/shutdown paths change. Full 18-section template ([[feedback-impact-report]]).

**1. What changed.** New `server/worker_lifecycle.py` (pure stdlib): `port_is_free(host, port)` (plain bind), `ensure_worker_port_free(worker_host, worker_port, front_port)` (raises a clear RuntimeError naming both ports + "free BOTH"), `terminate_process(proc, timeout)` (terminate → wait → kill escalation; idempotent on None/exited). `server/main.py`: `start_translator_client_proc` pre-checks the worker port, prints front+worker PIDs, and registers `atexit.register(terminate_process, proc)`; the signal handler and `__main__` (now `try/finally`) route through `terminate_process`. New `test/test_worker_lifecycle.py` (8) + a `MIT/README.md` "Worker lifecycle" section.

**2. Results.** A stale/orphaned worker on `P+1` is now **reported loudly at startup** instead of hanging the front forever on a `/register` that never comes; a graceful stop (Ctrl+C / SIGTERM) reliably terminates the worker via the atexit backstop (uvicorn overrides our signal handlers, so atexit is what actually fires). 8 unit pass; full suite **350 / 18 pre-existing async / 0 new fail**. Live entrypoint test: front 5003 while the running worker held 5004 raised the RuntimeError immediately, **before any ML load**.

**3. Expected performance gain %.** **No runtime perf change** on the happy path (same launch). The win is **operational**: it removes the repeated "kill front → orphan on 5004 → restart serves old code / hangs" cycle — minutes saved per dev/restart, and a class of "why is it serving stale code" confusion eliminated. Not measurable as CPU/latency.

**4. Benefits.** Restarts are deterministic (port-busy is reported, not silently hung); the worker can't outlive a graceful front stop; front+worker PIDs are logged for manual cleanup; the lifecycle logic is unit-tested without spawning a real worker; README documents the two-port model so the next operator doesn't relearn it.

**5. Purpose.** Kill the operational debt the issue calls out: the inline launch had no port-collision check, no PID tracking, and no orphan cleanup, and uvicorn silently overrode the only shutdown handler — so every MIT restart risked an orphan serving old code (hit repeatedly during render-parity dev, and again this session when a Store-python worker lingered).

**6. Why we changed it + architectural impact.** The launch was inline in `start_translator_client_proc` with a single signal handler that uvicorn clobbers. Architecturally the lifecycle moves into a small, pure, tested `worker_lifecycle` module, and shutdown is now defence-in-depth (signal handler + atexit + `__main__` finally, all idempotent) rather than a single fragile handler. Startup gains a fail-fast precondition.

**7. Problems before the refactor.** No worker-port collision check → the subprocess fails to bind and the front hangs forever on `/register`; uvicorn overrides the SIGINT/SIGTERM handlers → Ctrl+C leaks the worker; `__main__` only cleaned up `except Exception` (not on normal shutdown); no PID logging; the two-port restart procedure was undocumented (tribal knowledge in a memory file).

**8. Goals.** Detect a busy worker port at startup and report it (not hang); reliably stop the worker on a graceful front stop; track/log the worker PID; document the two-port lifecycle + restart; keep the happy-path launch unchanged; make the logic unit-testable without spawning a worker.

**9. Architecture Before.**
```
start_translator_client_proc(host, port, nonce, params):
    Popen(worker on port)          # no port-free check -> silent bind failure / hang
    register(...)
    signal SIGINT/SIGTERM -> proc.terminate()   # OVERRIDDEN by uvicorn at run() -> leaks on Ctrl+C
__main__: try: uvicorn.run() except Exception: proc.terminate()   # not on normal exit
```
**10. Architecture After.**
```
worker_lifecycle.py: port_is_free / ensure_worker_port_free (raise, name both ports) / terminate_process (term->kill, idempotent)
start_translator_client_proc:
    ensure_worker_port_free('127.0.0.1', port, params.port)   # fail loud, not hang
    Popen(worker); print front+worker PIDs; register(...)
    atexit.register(terminate_process, proc)                  # reliable backstop (survives uvicorn)
    signal SIGINT/SIGTERM -> terminate_process(proc)
__main__: try: uvicorn.run() finally: terminate_process(proc)
README: "Worker lifecycle (two-port model)" — restart kills BOTH ports
```
**11. Refactor list.**
| Piece | Where | Change |
|-------|-------|--------|
| port check | `worker_lifecycle.port_is_free` / `ensure_worker_port_free` | startup fail-fast on a busy worker port |
| cleanup | `worker_lifecycle.terminate_process` | terminate→kill escalation, idempotent |
| wiring | `server/main.py` | pre-check + PID log + atexit + signal + `__main__` finally |
| tests | `test/test_worker_lifecycle.py` | 8 cases, no worker spawned |
| docs | `MIT/README.md` | two-port lifecycle + restart steps |

**12. Metrics.** +1 module (`worker_lifecycle.py`, ~60 LOC) + 8 tests; `server/main.py` ~+15/−5 (port-check, PID print, atexit, finally); README +1 section. Suite 350 pass (342 → +8) / 0 new fail. Live collision test: fail-fast before ML load.

**13. Technical Debt Removed.** No-collision-check launch (hang-forever failure mode); uvicorn-clobbered single shutdown handler (worker leak on Ctrl+C); `except Exception`-only cleanup; undocumented two-port restart; untestable inline lifecycle.

**14. Risk Reduction.** Eliminates the orphaned-worker-serves-old-code class of bug at the source (loud collision report + reliable graceful cleanup). Residual: **force-kill (SIGKILL / `Stop-Process -Force`) cannot be caught** — documented in the README (restart must free BOTH ports), the honest limit of any in-process cleanup.

**15. Developer Experience Impact.** A restart that hits a stale worker now prints exactly what's wrong and how to fix it (free both ports) instead of hanging; front+worker PIDs are logged; the README section replaces tribal knowledge. The lifecycle is unit-testable, so future changes are guarded.

**16. Future Opportunities.** A `--stop` / pidfile-based single-command supervisor (the issue's optional "single stop cleans both"); parent-death detection so a force-killed front still reaps the worker (Windows job objects / POSIX `prctl(PR_SET_PDEATHSIG)`); auto-reclaim a stale worker on startup instead of erroring. All deferred (current scope = report + graceful cleanup, the high-value 80%).

**17. Lessons Learned.** uvicorn installs its own signal handlers at `run()`, so any handler registered before it is silently overridden — `atexit` (plus a `finally`) is the reliable cleanup hook, not `signal`. A fail-fast precondition with a message that names the fix ("free BOTH ports") beats a silent hang. Extracting the lifecycle into a pure stdlib module made it unit-testable without spawning a worker (fast, deterministic). ASCII-only operator messages avoid Windows-console mojibake.

**18. KPI.** Hang-on-collision eliminated (fail-fast, message names both ports + the fix) · graceful-stop orphan eliminated (atexit backstop) · +8 unit cases (no worker spawned) · 0 regressions (350 pass) · two-port restart documented · residual force-kill limit documented. Behaviour change (not byte-identical): happy path preserved.

*Validation:* `test_worker_lifecycle` (8) + full suite (350 pass / 0 new fail) + live entrypoint collision test (raised before ML load). *Risk/rollback:* behaviour change on failure/shutdown paths only; revert = drop the branch. *Links:* #193.

## 2026-06-11 — #192 config-parse seam (parse_and_validate_config) + scope decision

The valuable, safe slice of the remaining #192 config-hygiene work: one shared config-parse seam + a Pydantic-v2 migration. The audit's most useful output was deciding what NOT to do (load_dotenv, bare-excepts) — surfaced first below. Full 18-section template ([[feedback-impact-report]]).

**1. What changed.** Added `parse_and_validate_config(config: str) -> Config` to `config.py` (uses `Config.model_validate_json`); rewired the 11 scattered `Config.parse_raw` call sites (server/main.py ×10 + batch_runner.py ×1) + 2 tests to it; dropped the now-unused `Config` import from main.py; new `test/test_config_parse.py` (3). **Deliberately did NOT** change `load_dotenv` (deferred) or the bare-excepts (intentional).

**2. Results.** One parse/validate entry point for every endpoint instead of 11 copies; `parse_raw` (deprecated, removed in Pydantic v3) → `model_validate_json` everywhere (the ~13 deprecation warnings on parse go away). Byte-identical for valid configs: `test_config_parse` pins `parse_and_validate_config(j) == Config.parse_raw(j)`. Full suite **353 / 18 pre-existing async / 0 new fail**.

**3. Expected performance gain %.** **0% runtime.** Same parse, called through one function; the v2 method produces the identical Config. Value is maintainability (single validation point) + v3-readiness, not speed.

**4. Benefits.** Validation/error policy for the config now has one home (future tightening lands once, not 11×); the deprecation is gone (v3-ready); the seam is unit-pinned including an equality check against the legacy path; the audit documented two non-changes so they aren't re-opened.

**5. Purpose.** Satisfy the #192 "one config parse/validate path shared by all endpoints" criterion without churning the risky/low-ROI parts the issue also listed — pay down the real debt, leave the correct-as-is code alone (north star).

**6. Why we changed it + architectural impact.** 11 identical `Config.parse_raw` calls is a copy-paste seam with no single place to add validation or migrate the API. The seam centralises it. Architecturally minor (one function + call-site rewire), but it's the carriage point a future config-validation policy or error-shaping would attach to.

**7. Problems before the refactor.** 11 duplicated parse calls; the deprecated `parse_raw` API across all of them (v3 breakage waiting); no single validation seam; (per the issue) load_dotenv import side-effect + bare-excepts — **audited and found load_dotenv high-risk/low-ROI and the bare-excepts intentional**, so left as documented known-state.

**8. Goals.** One shared parse seam; migrate off deprecated `parse_raw`; prove byte-identical for valid configs; don't touch correct-but-flagged code (bare-excepts) or take import-order risk for low ROI (load_dotenv); keep the suite green.

**9. Architecture Before.**
```
server/main.py:    Config.parse_raw(config)   ×10   (deprecated API, no shared seam)
server/batch_runner.py: Config.parse_raw(config_str)
test_image_model_config.py: Config.parse_raw(...) ×2
manga_translator/__init__.py:5  load_dotenv()        # import side-effect (flagged)
manga_translator.py:  7× bare except Exception        # flagged — but all intentional
```
**10. Architecture After.**
```
config.py:  parse_and_validate_config(config) -> Config   # one seam, model_validate_json (v2)
 └─ server/main.py ×10 · batch_runner.py · test_image_model_config.py  all call it
test_config_parse.py: representative-config · ==legacy-parse_raw · invalid-raises
load_dotenv: UNCHANGED (import-order risk > ROI; documented)
bare-excepts: UNCHANGED (intentional broad catches; documented)
```
**11. Refactor list.**
| Piece | Where | Change |
|-------|-------|--------|
| seam | `config.py` `parse_and_validate_config` | one parse+validate fn, `model_validate_json` |
| rewire | server/main.py ×10, batch_runner.py ×1 | call the seam; drop unused `Config` import |
| tests | test_config_parse.py (new) + test_image_model_config.py | seam == legacy parse_raw; invalid raises |
| audit | DONE.md / this report | load_dotenv deferred; bare-excepts intentional (documented) |

**12. Metrics.** +1 fn (~10 LOC) + 3 tests; 11 call sites + 2 tests rewired; 1 unused import removed; ~13 parse deprecation warnings eliminated. Suite 353 (350 → +3) / 0 new fail.

**13. Technical Debt Removed.** 11 duplicated parse calls → 1 seam; deprecated `parse_raw` API (v3 breakage) eliminated; the "no single config-parse path" gap closed; the audit converted two vague "todo: refactor" flags into a documented decision.

**14. Risk Reduction.** v3 won't break config parsing (off the deprecated API); a future config-validation change can't drift across 11 sites. The migration is pinned byte-identical (== legacy). Deliberately avoided the two risk sources the issue flagged (import-order via load_dotenv; semantic drift via narrowing intentional excepts).

**15. Developer Experience Impact.** A config-validation tweak is one edit at the seam; the parse path is greppable (`parse_and_validate_config`) instead of 11 `parse_raw`; no more deprecation-warning noise in test output.

**16. Future Opportunities.** `load_dotenv` → explicit `initialize()` (needs every entrypoint audited for import-time env reads — high-risk, only if a real test-determinism problem appears). Validate `target_lang` against `VALID_LANGUAGES` / convert to enum (the inline config.py todos). S12 `PipelineParams` value-object (#187). All deferred by design.

**17. Lessons Learned.** The highest-value review output can be "don't do this": the bare-excepts read as debt in the issue but are load-bearing broad catches (log-never-crash / best-effort / ignore_errors) — narrowing them is negative-value, so the right move is to document them as intentional. Pin an API migration with an equality test against the old path (`new(j) == old(j)`) so "behaviour-preserving" is proven, not asserted.

**18. KPI.** Single config-parse seam (11→1) · deprecated `parse_raw` removed (v3-ready) · byte-identical (==legacy test) · 0 regressions (353 pass) · 2 flagged items audited + documented as deliberate non-changes (load_dotenv risk, intentional excepts) · #192 criteria met except the documented load_dotenv deferral.

*Validation:* `test_config_parse` (3, incl. ==legacy) + `test_image_model_config` (2, rewired) + full suite (353 / 0 new fail). *Risk/rollback:* behaviour-preserving for valid configs; revert = drop the branch. *Links:* #192 (advanced; load_dotenv deferred).

## 2026-06-11 — #191 remove vendored SD/LDM inpainter + ctd/YOLOv5 detector (~14.4k LOC)

The largest single cleanup of the tech-debt batch: delete two unused, unmaintained vendored upstream subsystems. Gated on a roadmap check (the dev's condition) before any deletion. Full 18-section template ([[feedback-impact-report]]).

**1. What changed.** Deleted the SD/LDM inpainter (`inpainting/ldm/**` ~11.7k LOC + `guided_ldm_inpainting.py` / `inpainting_sd.py` / `sd_hack.py` / `booru_tagger.py` + 2 SD yaml configs) and the ComicTextDetector + vendored YOLOv5 (`detection/ctd.py` + `detection/ctd_utils/**` ~2.3k LOC, GPL). Rewired the enums (`Inpainter.sd`, `Detector.ctd`), the `INPAINTERS`/`DETECTORS` registries, the imports, the `<option value="sd">` web-UI entry, and dropped the SD-exclusive `open_clip_torch` dep. New `test/test_registry_trim.py`.

**2. Results.** **−14,405 LOC** across 56 files. Production path untouched (Backend sends `lama_large` + default/dbnet; `sd`/`ctd` were never sent and Backend has zero refs). Registries build clean with no dangling imports (verified by smoke). Full suite **357 / 18 pre-existing async / 0 new failures**.

**3. Expected performance gain %.** **No runtime change** (the removed code was never on the production path). The win is **maintenance + supply-chain**: ~14.4k LOC of vendored ML code (the largest CUDA/torch-upgrade liability in MIT) and a **GPL** dependency (YOLOv5) are gone — smaller clone, faster CI checkout, no GPL-compatibility question, no manual diffing on torch upgrades.

**4. Benefits.** Removes the single biggest vendored-code maintenance burden; resolves the YOLOv5 GPL license concern; shrinks the import/attack surface; aligns the codebase with the chosen roadmap (Flux-via-diffusers + ultralytics-YOLO) by clearing the superseded baggage first; the trim is pinned so it can't silently regress on an upstream re-sync.

**5. Purpose.** Pay down the vendored-code debt the issue flags: ~14k LOC of CompVis-LDM + GPL-YOLOv5 carried from upstream, unused by MangaDock (lama_large + DBNet), with stale deps and license ambiguity.

**6. Why we changed it + architectural impact.** Vendored ML subsystems rot (manual CUDA/torch diffs, no upstream fix flow) and the YOLOv5 GPL is a real license-compat risk. Architecturally the inpainter/detector dispatch shrinks to the maintained set; the seam (DispatchRegistry from S22) made the removal a registry-entry + enum delete, not surgery. Roadmap-aligned: MangaTranslator (our reference) uses Flux/diffusers + ultralytics, so this clears the old path the new one replaces.

**7. Problems before the refactor.** ~11.7k LOC vendored CompVis LDM + ~2.3k LOC vendored YOLOv5 (GPL); both selectable but unused in production; stale deps (`open_clip_torch`); CUDA/torch upgrades required hand-diffing the vendored code; a GPL-vs-project-license question left open.

**8. Goals.** Remove both subsystems without touching the production path; verify the removal doesn't block the MangaTranslator roadmap (the dev's explicit condition); keep the remaining inpainters/detectors intact; pin the trim with a test; byte-identical production render.

**9. Architecture Before.**
```
INPAINTERS: default(aot) · lama_large · lama_mpe · sd(StableDiffusion→guided_ldm→ldm/** ~11.7k) · none · original
DETECTORS:  default(DBNet) · dbconvnext · ctd(ComicText→ctd_utils/** incl. GPL yolov5 ~2.3k) · craft · paddle · none
deps: ... open_clip_torch (SD-only) ...
```
**10. Architecture After.**
```
INPAINTERS: default(aot) · lama_large · lama_mpe · none · original          [sd + ldm/** gone]
DETECTORS:  default(DBNet) · dbconvnext · craft · paddle · none             [ctd + ctd_utils/** gone]
deps: open_clip_torch removed (kornia/einops/omegaconf/transformers kept — used elsewhere)
test/test_registry_trim.py pins: sd/ctd absent, production set intact
roadmap: Flux/diffusers + ultralytics YOLO (replacements, added fresh when needed)
```
**11. Refactor list.**
| Piece | Change |
|-------|--------|
| SD files | delete ldm/** + guided_ldm + inpainting_sd + sd_hack + booru_tagger + 2 yaml |
| SD wiring | drop `Inpainter.sd` (enum + INPAINTERS) + import + web-UI option + `open_clip_torch` dep |
| ctd files | delete ctd.py + ctd_utils/** (incl. GPL yolov5) |
| ctd wiring | drop `Detector.ctd` (enum + DETECTORS) + import |
| docs | PIPELINE.md §3.1 + §5 + mit-hidden-capabilities + DONE.md + this report |
| test | test_registry_trim.py (4) |

**12. Metrics.** −14,405 LOC / 56 files; 2 enum members + 2 registry entries + 2 imports + 1 web-UI option + 1 dep removed; +4 pinning tests. Suite 357 (353 → +4) / 0 new fail. 1 GPL dependency eliminated.

**13. Technical Debt Removed.** ~11.7k LOC vendored CompVis LDM; ~2.3k LOC vendored YOLOv5 (GPL); the `open_clip_torch` SD-only dep; the CUDA/torch hand-diff burden on the vendored ML; the unresolved GPL-license question; two selectable-but-unused pipeline options.

**14. Risk Reduction.** Eliminates a GPL-compatibility liability and the largest vendored-ML maintenance surface. Production is byte-identical (removed code never on the Backend path; verified zero Backend refs + import smoke). The trim is pinned, so an upstream re-sync that reintroduces sd/ctd fails the test instead of silently dragging the baggage back.

**15. Developer Experience Impact.** Smaller repo + clone + CI checkout; torch/CUDA upgrades no longer require diffing vendored LDM; no GPL question hanging over the detector; the inpainter/detector option lists are now exactly what's actually supported.

**16. Future Opportunities.** Add Flux inpainting via `diffusers` + ultralytics-YOLO detection fresh (the roadmap path) if/when wanted — cleanly, not on top of the old vendored code. Optionally delete the now-dead, unrelated `inpainting_attn.py` (left out of #191 scope). Audit other vendored dirs for similar trims.

**17. Lessons Learned.** Gate a big irreversible-feeling deletion on the actual roadmap, not assumption: checking MangaTranslator's `requirements.txt` (diffusers + ultralytics) turned "might we need SD/ctd later?" into a definite "the roadmap replaces them." Verify exclusivity before deleting shared-looking dirs (confirmed `ctd_utils` is ctd-only, `booru_tagger` is SD-only, `open_clip_torch` is SD-only) and keep deps that are used elsewhere (kornia/einops). The S22 DispatchRegistry seam made a 14k-LOC removal a few enum/registry edits.

**18. KPI.** −14,405 LOC (largest batch cleanup) · 1 GPL dep removed · 0 regressions (357 pass) · production byte-identical (zero Backend refs + smoke) · roadmap-aligned (Flux/diffusers + ultralytics replace the removed) · trim pinned (4 tests).

*Validation:* import smoke (registries build, no dangling imports) + `test_registry_trim` (4) + full suite (357 / 0 new fail) + roadmap check (MangaTranslator uses diffusers/Flux + ultralytics, not the vendored LDM/YOLOv5). *Risk/rollback:* byte-identical production; revert = restore the branch (large diff, but git-clean). *Links:* #191, roadmap `C:\Github\MangaDock\MangaTranslator`.

## 2026-06-11 — #187 S12 PipelineParams value-object (last god-object seam → #187 CLOSED)

The final seam of the MIT god-object decomposition: extract `parse_init_params`' field/device/raise logic into a `PipelineParams` value-object, closing #187 (all S1-S26 landed) and the MIT tech-debt category (6/6). Byte-identical, TDD red→green. Full 18-section template ([[feedback-impact-report]]).

**1. What changed.** `pipeline_params.py` gained a `PipelineParams` dataclass (13 fields + `using_gpu` property) + `from_params(params, batch_concurrent)` — the verbatim extraction of the constructor's parsing (device computation, gpu-limited promotion, cuda/mps-availability raise, `batch_concurrent` auto-disable, field parsing). `manga_translator.py`'s `parse_init_params` now delegates to it and assigns `self.X = pp.X`. New: 8 characterization tests (torch availability mocked).

**2. Results.** The constructor's ~35-line parsing block is now a testable value-object; `parse_init_params` is a thin assignment list. Byte-identical (the logic is a verbatim move). TDD: 8 tests RED → GREEN. `test_pipeline_params.py` 11 pass; full suite **365 / 18 pre-existing async / 0 new fail**. **#187 closed → MIT tech-debt category 6/6.**

**3. Expected performance gain %.** **0% runtime — byte-identical.** Same parsing, same device logic, same raise; only the carriage moved. No latency/VRAM change.

**4. Benefits.** The device/`using_gpu`/gpu-limited/raise logic — previously only reachable by constructing a full `MangaTranslator` — is now unit-testable in isolation with mocked torch availability (8 cases pin every branch); the constructor is thinner; #187 is finally complete (the decomposition's last seam).

**5. Purpose.** Close out #187: the last piece of breaking up the ~3000-line god object. S12 was deferred until #192 centralised config; with #192 done and the entanglement analysed as a self-contained method, the extraction is now safe.

**6. Why we changed it + architectural impact.** Param-parsing buried in a constructor (with a process-raising side effect + a property read mid-parse) is untestable without heavy construction. Architecturally the parsing becomes a value-object (`PipelineParams.from_params`) the constructor reads — the same "extract a pure-ish unit, delegate from the driver" pattern as the other 25 seams. `MangaTranslator.using_gpu` stays (reads `self.device`); `_is_gpu` mirrors it inside the value-object.

**7. Problems before the refactor.** ~35 lines of parsing inline in `__init__`/`parse_init_params`; device/`using_gpu`/gpu-limited/raise logic order-sensitive and only testable via full construction; the `batch_concurrent` validation read+mutated `self`; flagged "entangled" and deferred.

**8. Goals.** Byte-identical extraction; value-object unit-testable without constructing `MangaTranslator`; preserve the device logic, the raise, the batch_concurrent auto-disable, and the constructor foot-guns (`kernel_size` no-default); full suite green; close #187.

**9. Architecture Before.**
```
MangaTranslator.parse_init_params(params):
   self.verbose/use_mtpe/font_path/models_ttl/batch_size = params.get(...)
   if self.batch_concurrent and self.batch_size < 2: warn + self.batch_concurrent = False
   self.device = ... (use_gpu? mps/cuda : cpu); gpu-limited promotion; raise if no cuda/mps
   self.kernel_size/input_files/save_text/load_text = params.get(...)
   # only testable by constructing the whole god object
```
**10. Architecture After.**
```
pipeline_params.py:
   _is_gpu(device)                         # body of MangaTranslator.using_gpu
   @dataclass PipelineParams(13 fields; using_gpu property)
       from_params(params, batch_concurrent) -> PipelineParams   # the verbatim parse logic
MangaTranslator.parse_init_params(params):
   pp = PipelineParams.from_params(params, self.batch_concurrent); self.X = pp.X  (×13)
test_pipeline_params.py: 8 char cases (torch availability mocked) + 3 existing globals cases
```
**11. Refactor list.**
| Piece | Where | Change |
|-------|-------|--------|
| value-object | `pipeline_params.py` | `PipelineParams` dataclass + `from_params` + `_is_gpu` |
| delegate | `manga_translator.py` | `parse_init_params` → `from_params` + 13 assignments + import |
| tests | `test_pipeline_params.py` | +8 characterization cases |
| docs | progress tracker / PIPELINE §5 / DONE.md / this report | S12 ✅, #187 DONE |

**12. Metrics.** `pipeline_params.py` +~60 LOC (value-object); `manga_translator.py` ~−20 inline parsing → thin delegation; +8 tests. Suite 357 → **365** / 0 new fail. #187: 26/26 seams done.

**13. Technical Debt Removed.** The last inline parsing block of the god object; an untestable-without-construction device/raise path; the read+mutate-`self` batch_concurrent validation; the "S12 deferred" item on the resume tracker.

**14. Risk Reduction.** The device/gpu-limited/raise logic is now pinned by 8 unit cases (mocked availability) instead of being exercised only incidentally during construction; byte-identical ⇒ no behaviour regression (full suite constructs `MangaTranslator` and stays green).

**15. Developer Experience Impact.** Device-selection logic is editable + testable in one small module without spinning up the translator; the constructor reads as a field list; the decomposition tracker now shows #187 complete (no open seam to resume).

**16. Future Opportunities.** The inline `#todo: fix why is kernel size loaded in the constructor` is now isolated in `from_params` (easy to address later); `kernel_size`'s no-default foot-gun could get a default; `parse_init_params` could eventually be inlined into `__init__` since it's now trivial. All optional.

**17. Lessons Learned.** A "deferred — entangled" seam is often tractable once you read the actual entanglement: here the device/`using_gpu`/raise coupling was a self-contained method, and moving the raise into the value-object is byte-identical because a raising constructor yields an unusable object either way. Mock torch availability to make device-branch logic deterministic + fast to test. Keep foot-guns verbatim in a byte-identical pass (the `kernel_size` no-default).

**18. KPI.** #187 CLOSED (26/26 seams) · MIT tech-debt category **6/6** · byte-identical (verbatim move + suite green) · 0 regressions (365 pass) · +8 isolated tests for previously-construction-only logic · 1 cosmetic delta (logger name, documented).

*Validation:* TDD red→green; `test_pipeline_params.py` 11 pass (3 globals + 8 value-object) + full suite (365 / 0 new fail). *Risk/rollback:* byte-identical; revert = drop the branch. *Cosmetic delta:* the batch_concurrent warning logs under the `pipeline_params` logger name (same message/level/effect). *Links:* #187, #188, resume `docs/reports/mit-refactor-progress.md`.

## 2026-06-12 — `STORAGE_DRIVER` env: choose local-disk vs Cloudflare-R2 storage · PR #222

**1. What Changed.** `Backend/src/common/storage/storage.module.ts` — added a `STORAGE_DRIVER` env var that selects the storage backend explicitly, and extracted the selection into a pure, env-injectable `createStorageProvider(env, logger)`. New `storage.module.spec.ts`. `.env.example` documents the flag.

**2. Why.** The factory only auto-detected the backend from the presence of `WORKER_URL`/`WORKER_SECRET`, so a developer who keeps R2 creds in their env had **no way to force local disk** — and so hit the R2-only read path of #214 (`loadPageBytes` ENOENT on R2-stored uploaded pages) during local E2E.

**3. How.** `disk`|`local` → `DiskStorageProvider` (forced, even with R2 creds present); `r2`|`cloudflare` → `CloudflareR2StorageProvider` (clear error if creds missing); unset/empty → original auto-detect (R2 when both creds set, else disk). Case-insensitive + trimmed; unknown value throws listing the valid options.

**4. Scope.** One Backend module + its new spec + `.env.example`. No runtime path touched; no other module reads `WORKER_URL` independently (verified by grep across `src/`).

**5. Results / Perf.** Pure config-selection change; **0% runtime impact** on the request path. Existing deployments with no `STORAGE_DRIVER` are byte-for-byte unchanged (auto-detect branch preserved).

**6. Tests.** `storage.module.spec.ts` **11/11** — explicit-wins, aliases, case-insensitive, missing-creds error, unknown-driver error, and the backward-compatible auto-detect matrix. `page-source.spec.ts` still green. `tsc --noEmit` clean. Not user-facing (server config) → unit tests suffice, no Playwright.

**7. Backward Compatibility.** Fully preserved: unset `STORAGE_DRIVER` ⇒ identical auto-detect behaviour.

**8. Security.** No creds in logs (only the driver name is logged). Traversal/abuse surface unchanged (provider implementations untouched).

**9. Quality Gate.** CodeQL `Analyze (javascript-typescript)` + `Analyze (python)` both green. `/scrutinize` bilingual review, verdict **ship**.

**10. Review findings (`/scrutinize`).** One forward-looking coordination item (not a blocker for this PR): the `/r2-patches` URL-builder on @akkanop-x's unmerged storage-refactor branch must derive routing from the *selected provider* / `STORAGE_DRIVER`, not from raw `WORKER_URL` presence — otherwise `STORAGE_DRIVER=disk` + `WORKER_URL` set = split-brain (builds R2 URLs but stores to disk). Nothing on `main` does this yet.

**11. Ownership / Coordination.** `storage.module.ts` is in @akkanop-x's Cloudflare-R2/storage domain and he is about to rewrite it; the change is small + additive + backward-compatible so it folds in easily. Flagged in the PR for him to preserve `STORAGE_DRIVER` (or rename to his convention) during the refactor.

**12. Live verification.** With `STORAGE_DRIVER=disk` set in dev `.env`, boot logs `[StorageModule] storage backend: local disk (driver=disk)` and the One Punch-Man benchmark chapter (an R2-only uploaded chapter, normally #214-ENOENT) translates end-to-end through the tunnel with patches served from local disk.

**13. Benefits.** Unblocks local E2E of uploaded-version chapters without R2 creds/Worker; self-documenting intent in `.env`; a clean seam for the upcoming storage refactor.

**14. Risk Reduction.** Selection logic is now a pure function with 11 cases instead of an inline factory closure exercised only at boot.

**15. Developer Experience.** A dev can force local disk in one line; the chosen backend is logged on boot.

**16. Future Opportunities.** Graduating to a committed default + adding `STORAGE_DRIVER` to `env.validation.ts` for boot-time fail-fast (the factory already throws on unknown values).

**17. Lessons Learned.** "Force local in dev" had a 90% zero-code answer (unset the two creds); the explicit toggle is the 10% for ergonomics — worth it because the dev keeps R2 creds in their env.

**18. KPI.** PR #222 MERGED (main a7e7b3d→e9083ec) · 11/11 new tests · 0 runtime impact · backward-compatible · CodeQL green · /scrutinize ship.

*Links:* PR #222, #214 (R2 read-path bug it unblocks). Full session narrative incl. the render-parity dev-enablement + #168 SFX-OCR investigation (PaddleOCR-VL-1.5 / transformers-5.9 blocker) is in `DONE.md` 2026-06-12 and `MIT/BENCHMARK.md` (2026-06-12 scorecard).

---

## 2026-06-15 — Connect MIT to the Dashboard (live telemetry) + Dashboard OAuth (PRD #279 / ADR 018, ADR 019)

**1. What changed.** Exposed MIT's already-built observability primitives over HTTP and wired the standalone Dashboard to them with a real OAuth login. MIT: 4 new import-light modules (`status_snapshot`, `auth`, `status_hub`, `status_stream`) + `GET /status` / `GET /status/stream` (SSE) on the parent server, gated by a forwarded Supabase JWT; `myqueue.add_task` + `/register` push events. Dashboard: Supabase Google OAuth gate, an authenticated `/api/live` SSE proxy, `useLiveSnapshot` hook, and live telemetry on the overview (GPU util/temp/VRAM/power, CPU/disk, RAM) with a live/offline badge + MIT-status chip; mock fallback throughout.

**2. Results / outcome.** Live GPU/host/gateway/queue/worker telemetry reaches the Dashboard when a staff dev is signed in. Zero-trust verified end-to-end against **production Supabase**: no-token and garbage-token both 401 at MIT (MIT really calls Supabase `/auth/v1/user`), forwarded through the `/api/live` proxy. Real metrics confirmed on the dev box (`util/temp/VRAM/power`, RAM, disk 99.1%).

**3. Expected performance gain %.** N/A (new capability, not an optimization). Added load is bounded: one metric sample/3 s per open stream + a gateway probe throttled to ≤1/30 s; one Supabase round-trip per verification, re-validated only every 60 s on a stream. No effect on the translate pipeline (events come from parent-process seams; the worker pool is untouched).

**4. Benefits.** An incident is diagnosable from live data, not mock. Independent per-service verification with **no shared secret** (a Dashboard leak grants nothing reusable). **Zero new dependency** (httpx/psutil/nvidia-smi/@supabase/supabase-js — the last already used by the app Frontend). Event **push** with no event-tier loop. Graceful degradation to mock.

**5. Purpose.** Realize Phase-1 (1d metrics + 1f transport) of the Dev console for MIT — the "window into the box" when production can't be inspected, per ADR 018's production motivation.

**6. Why + architectural impact.** ADR 018 set the architecture (out-of-band aggregator, per-service streams, forward-JWT, no shared secret). This slice implements it for MIT and **refines one detail**: MIT verifies via Supabase `getUser` rather than local PyJWT — zero new dep, no JWT secret distributed to MIT, and robust to Supabase's new asymmetric `sb_publishable_…` keys (local HMAC could not verify them). The Dashboard's `/api/live` is the authenticated proxy that lets a browser (which can't set an `EventSource` auth header) reach MIT. ADR 019 records it.

**7. Problems before.** MIT's metrics/diagnostics modules were committed but unexposed; the Dashboard was 100% mock; there was no way for a dev to authenticate and pull live data.

**8. Goals.** SSE event-push (operator requirement) + sampled metrics; independent per-service auth surviving a Dashboard leak; MIT only (Backend/Frontend mid-refactor). All met.

**9. Architecture before.** Dashboard → `lib/services.ts` mock. MIT parent server: `/health` `/ready` `/queue-size` `/translate/*`; `metrics.py`/`diagnostics.py`/`translate_error.py` present but not routed; no auth for a console.

**10. Architecture after.** Browser ──OAuth──> session JWT ──fetch `/api/live`──> Next proxy ──forward JWT──> MIT `/status/stream`; MIT verifies independently (Supabase `getUser`) + gates to staff; SSE frames fold through `lib/snapshot.ts`; UI live-or-mock. Metric sampler loop lives at the source (MIT); events push via `StatusHub`.

**11. Change list.** MIT new: `server/status_snapshot.py`, `server/auth.py`, `server/status_hub.py`, `server/status_stream.py`. MIT modified: `server/main.py` (routes + `require_staff` + throttled probe + worker-up event), `server/myqueue.py` (enqueue event). Dashboard new: `lib/live.ts`, `lib/live-map.ts`, `lib/supabase.ts`, `components/auth-gate.tsx`, `components/use-live-snapshot.ts`, `app/api/live/route.ts`, `README.md`. Dashboard modified: `app/layout.tsx`, `app/page.tsx`, `components/shell.tsx`, `.env.example`/`.env.local`, `package.json`. Docs: ADR 019 (+ index), DONE.md, PIPELINE.md §5, MIT README.

**12. Metrics.** New tests: MIT 24 (snapshot 6 / auth 8 / hub 5 / stream 5), Dashboard 11 (live 6 / live-map 5). Suites green: MIT new 24/24, sibling import-light server 20/20, Dashboard 91/91. ~10 new files, ~6 edited, 1 dep added.

**13. Technical debt removed.** None removed; debt avoided — no PyJWT/JWT-secret plumbing in MIT; reused the committed `snapshot.ts` reducer and the existing metrics/diagnostics modules rather than new surface; events attach at parent-process seams (no god-object growth).

**14. Risk reduction.** Auth fails **closed** (None/unreachable → deny). The console lives on the parent server only — never the RCE-by-design worker. The SSE hub drops on a full queue so a stuck consumer can't block the translate path. Stream re-validates + closes on token expiry.

**15. Developer experience.** A dev signs in with Google and sees live GPU/host/gateway during an incident; offline/connecting/live is explicit on a badge; mock fallback means the dashboard never hard-fails.

**16. Future opportunities.** Supabase `staffLevel` claim hook to retire the id allowlist; Backend (#282) + Frontend (#283) `/status/stream` reusing the same forward-JWT proxy; per-stage worker event push; VRAM-per-model live attribution.

**17. Lessons learned.** Supabase's new asymmetric publishable keys make local-HMAC JWT verify a dead end — verifying via `getUser` is both simpler and the only scheme-agnostic option (and matches the Backend). The Supabase JS `getSession()` can stall in a headless context (navigator.locks) — the gate needs a splash timeout to never hang.

**18. KPI.** Branch pending review/commit · MIT 24/24 + Dashboard 91/91 + sibling 20/20 new/regression tests green · 0 translate-pipeline impact · zero-trust 401/403 verified against production Supabase · live metrics verified on-box · OAuth gate rendered. Remaining: a valid-token 200 needs a human Google sign-in + the dev's id in `MIT_STAFF_USER_IDS`.

*Links:* PRD #279, ADR 018, ADR 019. Provenance: PIPELINE.md §5, DONE.md 2026-06-15.

### Increment (2026-06-16) — `/service/mit` real-data wiring + `control_ms` + unified debug console

**1. What changed.** Finished the MIT↔Dashboard connection so the MIT *detail* page (`/service/mit`) reads live data instead of mock where MIT reports it. (a) MIT's gateway probe now times the `GET /models` control-plane call (`control_ms`) separately from the chat data-plane call (`latency_ms`) — `server/diagnostics.py` + `server/status_snapshot.py::_gateway_dict`. (b) New pure mapper `Dashboard/lib/live-panels.ts::liveGatewayProbe` turns the live gateway frame into the `GatewayDiagnosis` `GatewayProbe` (real control-vs-data split). (c) `app/service/[id]/page.tsx` overrides — only for `id==='mit'` and only when signed-in + live — the header status badge, the GPU/VRAM/queue telemetry cards, the VRAM-panel host total, and the GatewayDiagnosis probe; everything MIT doesn't instrument stays mock. (d) Unified debug console (`components/debug-console.tsx`, `lib/debug-log.ts`) aggregating Dashboard/Frontend/Backend/MIT log lines; GitHub auto-link (`components/github-auto-link.tsx`); recharts duplicate-key fix (`components/metric-card.tsx`).

**2. Results / perf.** No translate-pipeline impact (additive seams; the probe is throttled by `MIT_DIAG_INTERVAL_S`). The stream connects only on the MIT detail page (`useLiveSnapshot(id==='mit' ? token : null)`), so the other service pages open no extra SSE connection.

**3. Honesty boundary.** Live: status, GPU util/temp/power, VRAM used/total, queue depth + worker count, host VRAM total, gateway control/data split. Mock (MIT reports current values, not a history / doesn't instrument): GPU history charts, per-card sparklines, stage timing, quality, per-model VRAM breakdown, translate-queue job list, worker-lifecycle internals.

**4. Validation.** Dashboard `bun test` 101→**115** green (`liveGatewayProbe` +4); MIT `test_diagnostics` + `test_status_snapshot` **13** green (control_ms pinned at every hop: diagnostics → snapshot frame → `mapMitSnapshot` → `liveGatewayProbe`); touched files typecheck clean; `/service/mit` SSR 200 with no error overlay. Stack restarted clean — MIT :5013 (parent-only, 9arm gateway probe), Frontend :4000, Backend :4001.

**5. KPI.** Branch `feat/mit-dashboard`, pending review/commit · 115 + 13 tests green · 0 translate-pipeline impact · `control_ms` lights up the GatewayDiagnosis control-latency on this MIT restart.

### Increment (2026-06-16) — MIT-side telemetry instrumentation (queue · stage timing · worker lifecycle · per-model VRAM leak monitoring)

**1. What changed.** Made MIT *emit* real data for the `/service/mit` panels (Dashboard wiring that reads it is a later step). Per panel, instrumented the real source where one exists; removed what has none. New seams, all worker-reported via a new internal channel.

**2. Real sources added.** (a) **Queue jobs** — `TaskQueue.jobs_snapshot()` → `queue.jobs[]` (parent-side, real now). (b) **Stage timing** — `webhook.make_telemetry_hook` times each pipeline stage (gap between consecutive stage starts) → `POST /internal/telemetry` (`X-Nonce`) → `stages[]`. (c) **Worker lifecycle** — worker sends `os.getpid()` at registration, parent stamps `registered_at` → `workers.detail[]` (pid/uptime). (d) **Per-model VRAM leak monitoring** — Tier 1: worker's `torch.cuda.memory_allocated/reserved` → `vram.{allocated_mb,reserved_mb}` (reserved climbing while allocated flat = leak); Tier 2: `ModelUnloader` (the #188 unload seam) measures freed-per-unload, `VramTracker` learns each model's footprint from its largest clean release and flags an unload that frees far less → `vram.models[].{footprint_mb,freed_mb,leaked}`.

**3. Design choices (Karpathy-reviewed).** (i) Quality/run-summary **removed** — the marquee fields (parity %, tokens) have no real source; kept the dashboard honest rather than fake them. (ii) Per-model VRAM footprint is **learned from unloads, not measured at load** — touch sites are pre-load and post-load deltas are activation-noisy, so the unload-learned footprint is simpler and robust (zero load-site instrumentation). (iii) Surfaced + corrected a wrong push-back: per-model VRAM *is* worth it because the use case is leak detection (a model not releasing VRAM), not nominal-size display.

**4. Architecture / risk.** All worker→parent over `POST /internal/telemetry` (fire-and-forget, same `X-Nonce` auth as `/register`); `telemetry_store.apply()` dispatches `stage`/`vram`; `build_snapshot` carries the new sections only when non-empty (lean; the Dashboard reducer ignores unknown keys). Zero translate-pipeline impact — additive seams, never raise. Worker data → empty in the parent-only dashboard MIT until a GPU worker runs + translates. Hooking the #188 `ModelUnloader` cleanly is the direct payoff of the ~3.4k-line god-object decomposition.

**5. Validation / KPI.** Full MIT suite **519 passed / 0 new failures** (19 pre-existing: 18 async-config + `test_registry_trim` from flux-inpainter PR #277); ~25 new import-light tests (<1s). New modules: `server/{telemetry_store,queue_view,worker_view}` + `manga_translator/{vram_tracker,vram_probe}`. Pending: Dashboard wiring to render `vram`/`stages`/`queue.jobs`/`workers.detail`. Provenance: PIPELINE.md §5, DONE.md 2026-06-16.

### Increment (2026-06-17) — Dashboard wiring: `/service/mit` real data on every graph/panel (or "No Data")

**1. What changed.** The MIT detail page graphs were still mock (only GPU util/VRAM/queue *numbers* were live). Wired the Dashboard half so every graph/panel reads real MIT telemetry or shows an explicit "No Data". (a) `lib/live-series.ts` — a pure rolling per-metric accumulator (MIT sends current values per SSE frame; the dashboard buffers each frame → live charts). (b) `lib/live-map.ts` exposes `stages`/`vram`/`queueJobs`/`workersDetail`; `use-live-snapshot.ts` keeps the rolling `series` + stamps event arrival time. (c) 8 components gained a live prop + a "No Data" placeholder (mock path kept for the shared cards/log-stream). (d) `page.tsx` maps the live telemetry into each panel's shape.

**2. Approach (ultracode).** Foundation (accumulator + live-map + use-live-snapshot) done inline by the main loop — the coupled core. A workflow then fanned out the 8 component edits in parallel (each isolated, returning its exact prop signature); the main loop integrated `page.tsx` to match + verified the build. 1 of 8 agents hit a transient 500 → redone by hand.

**3. Honesty boundary.** Live now: GPU util/VRAM/temp/power/fan + CPU usage sparklines, GpuDetail (4 of 7 charts), worker pid/uptime, gateway. Live after a translate: stage timing, VRAM-by-model(+leak badge), queue jobs, logs (real timestamps). No Data (no MIT source): pages/min, CPU temp, Graphics/CPU clock, quality panel.

**4. Ops.** Killed a stale 14-Jun full MIT worker (orphaned `python3.11.exe` on :5004 holding ~3.9 GB VRAM — the worker-restart-gotcha); relaunched a full GPU worker on :5013 so the worker telemetry flows. No translate-pipeline change.

**5. Validation / KPI.** Dashboard typecheck clean (touched files), `bun test` **130 pass / 0 fail**, `/service/mit` SSR 200 no error overlay. New modules: `lib/live-series.ts` (+5 tests), `lib/mit-console.ts` (+10 tests). Same-day follow-ups: real wall-clock x-axis on the graphs (`seriesT` → `times` prop); `mit@console` made a functional read-only live console (`runMitCommand` over the status snapshot — no shell, no mutating control). Provenance: DONE.md 2026-06-17.

---

# 2026-06-14 — refactor(Backend): split MangaCatalog/Landing/GeminiModelCatalog out of books.service (#231, PRD #228 step 6)

**1. Type.** Behaviour-preserving structural refactor (god-file decomposition), final step of PRD #228.

**2. Trigger.** `books.service.ts` still fused three non-MIT domains (Gemini model selection, MangaDex catalog passthrough + search, landing assembly + Gemini text translation) into the same class as the MIT chain — untestable in isolation, and the stale-cache fallback was duplicated verbatim.

**3. Change (before → after).**
- before: 841-line `BooksService` holding model selection (`getAvailableGeminiModels`/`filterAvailableGeminiModels`/`getMangaModels`/`getDescriptionModels`), catalog passthroughs + `searchBooks`/`findTitleIdsByAltName`, and `getLandingBooks`/`translateDescription`/`translateMangaEpisode`/`enhanceLanding`/`applyForceLocalLanding`/`patchLandingCacheIfNeeded` — with two byte-identical stale-cache fallback blocks inline.
- after: three units — `GeminiModelCatalog` (injected env+clock), `MangaCatalogService` (mangaDex/supabase/cache), `LandingService` (cache/imageCache/mangaDex/geminiCatalog/backendOrigin/env) — constructed via `new` in the BooksService constructor; `BooksService` is a thin facade of delegators with every public signature unchanged. The two fallback blocks collapse into one `serveStale()`.

**4. Seams / commits.** 6a `15e4837` GeminiModelCatalog · 6b `127ee43` MangaCatalogService · 6c `959b1bd` LandingService. One seam = one commit; build (whole backend) green at each.

**5. Byte-identical proof.** Method bodies moved verbatim (only `process.env`→`this.env`, `Date.now()`→`this.now()`, `this.backendOrigin` getter→`backendOrigin()` callback). Spies preserved: BooksService keeps `getMangaModels` (books-models spy) + `translateMangaEpisode` (books-translate spec) delegators. Existing books characterization net stays green unchanged. `serveStale` is the one intended dedup (the two blocks were verbatim-identical → same result).

**6. Performance.** Neutral — same call graph, one extra method hop per delegated call (negligible).

**7. Quality / metrics.** `books.service.ts` 841 → **376 lines** (quartered from its 1834-line start). +3 modules, +17 isolated unit cases (6 gemini env/clock + 5 catalog search/alt-name + 6 landing serveStale/description). Full backend suite **513 → 530 pass / 0 fail**.

**8. Tech debt removed.** Model selection, catalog search, and landing assembly are now editable + testable without the MIT stack; the duplicated stale-cache fallback is gone; `GeminiModelCatalog` selection is deterministic under an injected clock.

**9. Risk / rollback.** Byte-identical; rollback = revert the 3 commits. No money/auth/MIT-protocol surface touched. `BooksModule` unchanged (units are `new`-constructed, not DI providers).

**10. Notes.** Two pre-existing unused imports (`fs`/`path`) left in place per the surgical rule (own-orphans only) — they belong to cleanup issue #240. `MangaCatalogService` deliberately holds real search/alt-name logic rather than being a redundant forwarder over `MangaDexService`.

**11. KPI.** PRD #228 CLOSED — all 6 steps landed (#229/#230/#232/#233/#234/#231) · god file 1834 → 376 (−79%) · byte-identical · 0 regressions (530 pass) · +17 isolated tests.

*Validation:* `npm run build` (whole backend) + `npx jest` full suite 530/0 per seam. *Links:* #228, #231, branch `dept/backend`.

---

# 2026-06-18 — refactor(Backend): split mit-batch-orchestrator.service.ts — transport/stream vs job-state (#294)

**1. Type.** Behaviour-preserving structural refactor (god-file decomposition) on the live-translation hot path. ADR [017](../adr/017-mit-batch-transport-jobstate-seam.md).

**2. Trigger.** `mit-batch-orchestrator.service.ts` was 1010 LOC (largest backend file) mixing four concerns — job-state lifecycle, listener fan-out, MIT transport + NDJSON stream, webhook callback. The NDJSON stream-read loop (`_runMitBatch`) was the riskiest, most nested part and had **zero direct test coverage**: it could only be exercised by constructing the whole service.

**3. Change (before → after).**
- before: one `MitBatchOrchestrator` class owning `startOrAttachBatchJob`/`finalize`/`maybeComplete` + `deliver`/`removeBatchListener`/`notifyBatchProgress` + `_runMitBatch` (image fetch → multipart POST → NDJSON read loop → per-page persist → retry-missing) + `_retryMissingPagesIndividually` + `handleMitCallback`, with the NDJSON chunk parsing inlined and env-helper delegators (`buildMitConfig`/`imageModelKey`/`patchCacheKey`/`mitCallbackOrigin`).
- after: four files — `mit-batch-ndjson.ts` (pure `parseNdjsonChunk(chunk, carry) → {events, carry}`), `mit-batch-stream.ts` (`MitBatchStream` = `run` + `_retryMissingPagesIndividually` + `mitCallbackOrigin`, constructed with `(MitClient, MitBatchDeps)`), `mit-batch-types.ts` (shared `PatchEntry`/`PageResult`/`BatchPageListener`/`MitBatchDeps`), and `mit-batch-orchestrator.service.ts` as the job-state machine delegating transport via `this.stream.run(...)`. Public API unchanged; `books.service` untouched.

**4. Seams / commits.** 1 `6c76169` characterization net (test-only) · 2 `367d9f1` pure `parseNdjsonChunk` wired into the loop · 3 `6eb9394` extract shared types · 4 `b4a2416` move transport → `MitBatchStream`. One seam = one commit; tsc + full books suite green at each.

**5. Byte-identical proof.** The read loop is lifted verbatim (only `this.patchCacheKey/buildMitConfig/imageModelKey` → direct `mit-config` calls, behaviour-identical). A 12-case characterization net added **first** (commit 1, against the pre-split code) locks the stream path — clean/multi-chunk/carry/keep-alive/malformed/non-numeric-pageIndex/stream-error/all-error dead-worker-guard/stream-drop-retry/submit-throws/202-async/handleMitCallback idempotency+persist-fail — and stays green identically through commits 2–4. Preserved landmines: the `deliver` "caller may be gone" catches, the shared "NDJSON parse failed" log (malformed line **and** persist throw), the dead-worker guard, the no-signal-on-submitBatch note, persist-fail-as-error.

**6. Performance.** Neutral — same call graph; the decoder does the same split/parse the inline loop did. One extra method hop (`stream.run`) per batch.

**7. Quality / metrics.** `mit-batch-orchestrator.service.ts` **1010 → 557 LOC** (−45%). +3 modules (decoder, stream, types). New tests: `mit-batch-ndjson.spec.ts` (12 chunk-boundary cases), `mit-batch-stream.spec.ts` (6 isolation cases), `mit-batch-orchestrator.characterization.spec.ts` (12). Full books suite **214 → 244 pass / 0 fail**; whole backend **595 / 0 fail**; tsc clean.

**8. Tech debt removed.** The NDJSON state machine (previously untestable without the full service) is now a pure function tested with strings; the transport is testable in isolation with a faked `MitClient`; the env-helper delegators that only wrapped `mit-config` are gone from the orchestrator.

**9. Risk / rollback.** Byte-identical; rollback = revert the 4 commits (each leaves the suite green). No money/auth surface; `handleMitCallback`'s wire contract and the MIT webhook protocol are untouched. **Live E2E (One-Punch benchmark via tunnel, 3-layer cache cleared) is to run before merge**, per the agreed gate.

**10. Notes.** One cosmetic delta — transport logs carry the `MitBatchStream` logger context (`[BatchPatches]` message strings unchanged). `readWithTimeout` still never `clearTimeout`s its race-loser timer (pre-existing dangling-timer, left verbatim) — flagged in ADR 017 as a behind-a-flag follow-up. Memory `project_backend_pre_existing_test_failures` (16 fails) is stale: backend is 595/0.

**11. KPI.** #294 implemented · god file 1010 → 557 (−45%) · byte-identical (characterization net green ×4 commits) · 0 regressions (595 pass) · +30 tests (12 decoder + 6 stream + 12 characterization) · 1 cosmetic delta (logger name, documented).

*Validation:* TDD characterization-first; `npx tsc --noEmit` clean + `npx jest src/books` 244/0 per commit + full backend 595/0. *Risk/rollback:* byte-identical; revert = drop the 4 commits. *Links:* #294, #292, ADR 017, branch `refactor/294-mit-batch-stream`.

---

# 2026-06-18 — refactor(Frontend): decompose MangaReader + BookDetailModal, slice 1 (#302)

**1. Type.** Behaviour-preserving extraction-by-concern of two god-components; first slice of the #292 frontend tech-debt PRD.

**2. Trigger.** `BookDetailModal.tsx` (1355 LOC) buried the chapter-access gating (coin-unlock, money-adjacent) in inline closures over component state — untestable. `MangaReader.tsx` (1789 LOC) inlined the chapter-list fetch in a `useEffect`. Both files force a whole-file read to change anything.

**3. Change (before → after).**
- before: `isChapterReadable`/`isChapterCoinLocked`/`getUnavailableChapterLabel` were inline closures in BookDetailModal; the chapter-list fetch+merge+sort was an inline effect in MangaReader; the HWID `apiFetch` was MangaReader-local.
- after: `app/lib/chapterAccess.ts` — pure `chapterAccess(ch, { unlockedVersions }) → { coinLocked, readable, unavailableLabel }` (unit-tested); `app/hooks/useChapters.ts` — `useChapters(mangaId)` owning the fetch and returning the list; `app/lib/apiFetch.ts` — the single HWID-tagged fetch. BookDetailModal calls `chapterAccess`; MangaReader uses `useChapters` + imports `apiFetch`.

**4. Seams / commits.** c1 chapterAccess pure fn + tests · c2 BookDetailModal consumes it · c3 useChapters + shared apiFetch · zoomLevel pure math slice. One seam = one commit; tsc + bun lib tests green at each.

**5. Byte-identical proof.** chapterAccess preserves the predicates' exact early-return order + labels; the only real input is `unlockedVersions` (the issue's illustrative `balance` is unused). The fetch effect is lifted verbatim into the hook; `apiFetch` moved verbatim. Render-loop label is still read only when `!readable`. No component-test harness yet → the pure logic is unit-tested; the byte-identical wiring is covered by `tsc` + manual walkthrough.

**6. Performance.** Neutral — same calls; the chapter row computes one `chapterAccess` object instead of three closure calls (one extra object alloc per row, negligible).

**7. Quality / metrics.** BookDetailModal **1355 → 1324** (−31); MangaReader **1789 → 1739** (−50). +4 modules (chapterAccess / useChapters / apiFetch / zoomLevel). +22 bun cases (chapterAccess 16 + zoomLevel 6; lib suite 55 → 77 / 0 fail). `npx tsc --noEmit` clean; 0 new lint errors.

**8. Tech debt removed.** The money-adjacent coin-unlock gating is now a pure, exhaustively-tested function instead of component closures; the chapter fetch is isolated from the reader's viewport/zoom/translation concerns; the HWID fetch has a single source.

**9. Risk / rollback.** Byte-identical; rollback = revert the commits. No backend/wallet/unlock surface touched. Manual reader + detail/coin-unlock + zoom walkthrough was the verification net (no component harness) — passed before merge.

**10. Notes.** Slice 1 of #302 plus the pure zoom-level math slice. The full `useReaderZoom()` hook is deliberately deferred — the zoom/pan cluster is entangled with the continuous-scroll machinery (pageRefs/lenis/viewport-sync) and there is no component test harness, so a big byte-identical move needs its own plan. `useTranslationStream`/Turnstile remain follow-ups. No ADR (routine extraction, matches #299/#300/#301).

**11. KPI.** #302 slice 1 · two god-components −81 LOC combined · chapterAccess + zoomLevel pure + 22 tests · byte-identical · 0 regressions (bun 77/0, tsc clean).

*Validation:* `bun test app/lib` 77/0 + `npx tsc --noEmit` clean per commit; manual walkthrough passed before merge. *Links:* #302, #292, branch `refactor/302-frontend-decompose`.

---

# 2026-06-30 — feat(MIT): width-squeeze fills tall balloon height (#183/#175; builds on #430/#431, ADR 023→024)

**1. Type.** Render-quality behaviour change in the MIT bubble-fit sizing path; opt-in via `MIT_BUBBLE_AREA_FIT` (already on per ADR 023). Targeted stopgap of the source-agnostic wrap (PRD #434).

**2. Trigger.** After ADR 023 made balloon dialogue fill its balloon, a **tall, not-wide** balloon still rendered as 2 wide lines + a vertical gap: the fit picked the largest font that wraps without force-breaking a word, then rendered at full balloon width, and the font could not grow further (the no-mid-word-break guard caps it). Surfaced on Gal Yome no Himitsu EN ch1 p4 ("PEOPLE FROM OTHER DEPARTMENTS…"); user-flagged the same on Thai targets ("ตัวเล็กแค่ 2 บรรทัด ทั้งๆ ที่ประโยคยาว").

**3. Change (before → after).**
- before: `_bubble_fit_font_size(region, bubble_wh, …) → font`; the caller rendered the wrapped block at the full balloon width.
- after: pure `squeeze_width(measure_h, full_w, min_w, box_h, factor=0.9)` (MangaTranslator `layout_engine.py` ×0.90 step) narrows the wrap column until the block would exceed the box height or hit the longest-token floor; `_bubble_fit_font_size` → `_bubble_fit_layout` returns `(font, block_w, block_h)`; both bubble-fit callers (occ==1, occ>1) centre the squeezed block. Font is unchanged — width is traded for line count.

**4. Seam / commit.** One pure helper in `render_overlap.py` + one call site in `_bubble_fit_layout`. TDD: `squeeze_width` tests RED→GREEN first. Commit 94bab61 on `worktree-feat-mit-font-s1` (PR #433).

**5. Byte-identical proof.** `squeeze_width` is invoked only inside `_bubble_fit_layout`; `clean_layout` and legacy paths untouched → render golden/guard suites **byte-identical**. No-op by design when text already fills the height or the longest word ≈ balloon width.

**6. Performance.** Negligible — the squeeze loop is ≤ ~30 `calc_horizontal` re-wraps per bubble-fit region at constant font (log-bounded by factor 0.9 from full width to floor), only on the bubble-fit path.

**7. Quality / metrics.** Gal Yome EN p4 tall balloon 2 wide → **6 narrow lines** filling height; One-Punch JA→EN dialogue/narration/SFX **unchanged**. `test_render_overlap.py` 33 → **36** (+3: narrows-a-tall-box / noop-when-full / stops-at-floor).

**8. Tech debt.** The fill-height layout decision is now a pure, unit-tested function rather than implicit in the render loop. Residual: scoped to dialogue-in-balloon; narration/captions + horizontal-source wrap generally stay in the flag-gated, A/B-decided source-agnostic path (PRD #434 / research #435), which reuses `squeeze_width` as-is.

**9. Risk / rollback.** Revert the call in `_bubble_fit_layout` → ADR-023 full-width rendering; paths outside bubble-fit are byte-identical. No money/auth surface.

**10. KPI.** #183/#175 residual closed · tall balloon 2 → 6 lines · +3 unit tests (36/0) · golden byte-identical · 0 regressions (One-Punch unchanged) · ADR 024.

*Validation:* TDD; `pytest test/test_render_overlap.py` 36/0; render golden/guard byte-identical; benchmark via real backend config (MIT_BUBBLE_AREA_FIT=1) Gal Yome + One-Punch. *Risk/rollback:* revert the squeeze call. *Links:* #183, #175, #434, #435, ADR 023, ADR 024, branch `worktree-feat-mit-font-s1`.

---

# 2026-06-30 — fix(MIT): clean-layout narration scales by page resolution, not per-region crop (#175)

**1. Type.** Render-quality bug fix in the MIT clean-layout sizing path; patch-path crop-vs-page (same class as #175 bubble-fit, but the clean-layout branch).

**2. Trigger.** Full-chapter Gal Yome EN→Thai benchmark: narration/caption rendered tiny while dialogue in the same panel was normal-sized (user: "ทำไมตัวเล็กทั้งที่มีตัวขนาดปกติอยู่ด้วย").

**3. Change (before → after).**
- before: `_clean_layout_dst` used the per-region **crop** `img.shape` for `clean_layout_font_size`'s `processing_scale` (+ wrap-width clamp + max wrap height). Crop = full-res but tiny area → `processing_scale` floored at 0.5 → narration ≈17px (3× under the designed 35px).
- after: thread the full-**page** shape (`PatchRenderer.img_w/img_h`) via `patch_ctx.page_shape` → `stages` → `dispatch` → `resize_regions_to_font_size` → `_clean_layout_dst`; use it for the three page-relative quantities. `page_shape=None` (full-page path) → falls back to `img.shape` → byte-identical.

**4. Seam / commit.** One value (`page_shape`) threaded with `=None` defaults through 4 functions + set once on the patch Context. Commit 70c6bf1 on `worktree-feat-mit-font-s1`.

**5. Byte-identical proof.** Full-page render path never sets `ctx.page_shape` → `None` → `_clean_layout_dst` uses `img.shape` (= the page) exactly as before. Render golden/guard suites byte-identical. Bubble-fit + legacy paths untouched.

**6. Performance.** Neutral — same call count; one extra tuple on the Context.

**7. Quality / metrics.** Narration ~17px → ~35px on a 3 MP page (≈2×, the designed size). `test_render_overlap.py` 37 → **38** (+1 page-vs-crop pin); stages kwargs characterization updated for the new kwarg.

**8. Tech debt.** Closes the clean-layout half of the patch-path crop-vs-page bug (#175 fixed the bubble-fit half via box height). Residual: the rw/bw discriminator still *routes* some narration-in-large-bubble to clean-layout — separate concern.

**9. Risk / rollback.** Pass `page_shape=None` (or revert the thread) → crop-scaled clean-layout; all other paths byte-identical. No money/auth surface.

**10. KPI.** #175 clean-layout sizing fixed · narration ~2× (designed size) · +1 unit pin (38/0) · golden byte-identical · 0 regressions · ADR 025.

*Validation:* TDD pin + stages characterization; `pytest test/test_render_overlap.py test/test_render_golden.py test/test_stages.py test/test_patch_renderer.py` green; E2E Gal Yome EN ch1 p14 → Thai (narration readable, no crash/oversize). *Risk/rollback:* `page_shape=None`. *Links:* #175, ADR 023/024/025, branch `worktree-feat-mit-font-s1`.

---

# 2026-06-30 — fix(MIT): gate SFX rescue on det_sfx provenance, not a ≤4-char heuristic (#278)

**1. Type.** Correctness + perf fix in the MIT SFX vision-rescue gate (PR #277 review follow-up).

**2. Trigger.** User-flagged: normal short text detected/rescued as SFX. The rescue fired for ANY ≤4-char region in a ≥60×60 box → short dialogue ("HUH?", "おい") misread as onomatopoeia + a ~1–2 s gateway round-trip per such region on every translate.

**3. Change (before → after).**
- before: `if vlm_rescue and len(region.text.strip()) <= 4:` then area/min-side check → rescue.
- after: pure `should_rescue_sfx(text, from_sfx_detection, w, h, vlm_rescue)` — gate on **det_sfx provenance** (`region.from_sfx_detection`, ≤4 chars), tight ≤2-char fallback when det_sfx is off. Provenance threaded: `Quadrilateral.is_sfx` (set by `merge_sfx_detections`) → `textline_merge` (any SFX textline → region) → `TextBlock.from_sfx_detection`. Plus: ENG prompt `==` byte-identity; `sanitize_sfx` non-Latin refusal guard; jieba lazy-dict documented.

**4. Seam / commit.** One pure gate (`should_rescue_sfx`) + a boolean flag threaded through 3 classes with `False` defaults. Commit 8cbd930.

**5. Byte-identical proof.** `is_sfx`/`from_sfx_detection` default `False` → when det_sfx never fires the flag is absent and the tight ≤2 fallback is the only change to the gate; render golden untouched. ENG prompt pinned byte-identical with `==`.

**6. Performance.** Positive — removes the per-region vision-gateway round-trip (~1–2 s) for every short non-SFX region (previously on every translate).

**7. Quality / metrics.** Deterministic benchmark: OLD rescued 5/7 representative regions, NEW 3 → 2 false-positive gateway calls eliminated, real SFX kept. `test_ocr_vlm` +9 (24/0).

**8. Tech debt.** Replaces a length proxy with the correct provenance signal; closes the major item of the #277 review follow-up (+ its 3 nits).

**9. Risk / rollback.** Loosen `should_rescue_sfx` back to `len ≤ 4` (ignore provenance) to restore old behaviour; flags default False → byte-identical when det_sfx off and no SFX detected. No money/auth surface.

**10. KPI.** #278 done (major + 3 nits) · 2 false-SFX/page-class eliminated · per-translate gateway latency reduced · +9 tests (24/0) · golden byte-identical · ADR 026 + benchmark report.

*Validation:* TDD `should_rescue_sfx`; `pytest test/test_ocr_vlm.py` 24/0; affected suites green; deterministic gate benchmark. *Risk/rollback:* revert the gate to length-only. *Links:* #278, #277, ADR 026, `docs/reports/benchmarks/2026-06-30-sfx-rescue-provenance-gate.md`, branch `worktree-feat-mit-font-s1`.

---

# 2026-07-02 — feat(MIT): reference_layout render engine (opt-in) + deterministic replay harness (#178/#462/#430)

**1. Type.** Render engine + test-harness feature; opt-in, production default byte-identical.

**2. Trigger.** Editing the shared MIT render kept regressing already-good targets (Thai fill ↔ One-Punch narration size), and the non-deterministic translator made worker A/B unreliable. A user-flagged demo defect: One-Punch narration blocks rendering far too big.

**3. Change (before → after).**
- *Harness:* `render_replay.py` (`serialize_regions`/`replay_clean_layout`) + `MIT_DUMP_REGIONS` dump hook → the clean-layout sizing is replayed offline & deterministically from committed fixtures; a parameterized safety-envelope test asserts every region stays in a two-sided box (spill ≤1.35×det, narration ≥0.6×flat, fill ≥0.9×flat).
- *Engine (`render.reference_layout`, default OFF):* `_reference_layout_intent` resolves box+anchor+fill+cap from one discriminator (`should_fill_demoted_bubble`: fill only if `interior_w/det_w ≤ 1.4`); `fit_to_box` = binary search + bounded upward re-scan (defeats word-wrap non-monotonicity that returned a tiny branch).

**4. Seam / commits.** New modules `reference_layout.py`, `render_replay.py`; `render.reference_layout` + `detector.det_bubble_synth` config flags; `~15` commits on `worktree-feat-mit-font-s1` (PR #433).

**5. Byte-identical proof.** `reference_layout` default OFF → dispatch golden byte-identical (in isolation); `MIT_DUMP_REGIONS`/`MIT_SIZING_TRACE` off → no-op.

**6. Performance.** N/A for production (flag off). Harness replay is calc_horizontal-bound (~minutes for the corpus) → the corpus envelope test is `slow`-marked.

**7. Quality / metrics.** Deterministic replay + live: One-Punch narration 32–44px spill ~2.3× → readable narrow columns (~flat), Thai dialogue still fills (69/28/50px). Discriminator ratio across 17 bubble regions / 4 fixtures cleanly separates (Thai 1.07–1.20 | 1.4 | One-Punch 1.61–3.43). Corrected finding: production render is in good shape; a "garble" was actually an LLM translation token ("JDB"), not render.

**8. Tech debt.** Merged `_reference_fit_box`+`_reference_cap` → one intent resolver; named constants. Remaining: promote decision (needs bigger corpus + multi-run flip check), calc_horizontal font-cache (test speed), Knuth-Plass line-break (#180).

**9. Risk / rollback.** Opt-in flag OFF → production unchanged. Discriminator threshold stability is the main risk before promotion (mitigated: 0.2 margin across the corpus + envelope guard). Drop the flag → zero effect.

**10. KPI.** narration-oversize cluster fixed + guarded · deterministic harness + 4-fixture corpus · two-sided envelope guard green · benchmark-endpoint + verify-before-claiming rules recorded · ADR 028 + 4 benchmark reports (`docs/reports/benchmarks/2026-07-02-*`).

*Validation:* TDD each increment; render golden byte-identical (flag off); reference_layout/replay suites green; live patch-path renders verified vs target. *Risk/rollback:* flag OFF default. *Links:* #178, #462, #430, ADR 028, `docs/prd/mit-render-defect-master-plan.md`, benchmarks `2026-07-02-*`, PR #433, branch `worktree-feat-mit-font-s1`.
## 2026-06-28 — Dashboard V2: Track A close-out + live-native leak fixes (PR #414)

### Track A review nits (#352, #353, #354) — closed

- **What & where:** `dashboardv2/components/dashboard.tsx` + `lib/{download,snapshot-export}.ts`. Commits `54182e0` (Track A base) / `f49cda2` (#354). Branch `feat/dashboard`.
- **Why / Before → After:**
  - **#352** focus-trap re-armed every 1s clock tick (`onClose` re-created each render) → keyboard focus snapped to Close every second. Fix: `closeNode = useCallback(…, [])` → stable identity → focus-trap effect runs only on open/close. *(Already implemented in Track A; verified + closed.)*
  - **#353** Export anchor `click()`'d without DOM-attach + synchronous `revokeObjectURL` → fragile across browsers. Fix: `lib/download.ts:triggerDownload` DOM-attach → click → remove → deferred revoke (`setTimeout 0`). *(Already implemented; verified + closed.)*
  - **#354** three nits: MIT-tab-on-nav = **remember last tab** (documented); skeletons unreachable in mock = **deferred to B4** (annotated); queue-depth chart **moved out of host-metrics** (`HOST_CHARTS`, queue ≠ host metric).
- **Validation:** `bun test` 74 pass, `tsc --noEmit` clean.
- **Risk / rollback:** mock-mode only; realtime (Track B/B4) deferred. **Links:** #352, #353, #354.

### Live-native leak fixes (PR #414, `/scrutinize` findings) — ADR 022

- **What & where:** new `dashboardv2/lib/overview-signals.ts` (`pipelineHeaderSummary`, `pctDelta`) + `dashboard.tsx`. Commit `fa64c90`. Branch `feat/dashboard` → **PR #414**.
- **Why:** a 3-agent `/scrutinize` pass found the live-native contract (ADR 022) breached — 4 hardcoded mock values rendered on the **live** path (the cardinal sin the epic forbids), invisible to the green unit suite.
- **Before → After:** (1) pipeline `total 95.0s · translate stalled` → derived from real `m.stages` or hidden; (2) GPU-util `−11.4%` delta → real first→last `pctDelta(series)`, badge hidden when no series; (3) hero `94%` success ring → gated behind `mock`; (4) vitals GPU/VRAM `0%` → `—` (No-Data) when `m.gpu` null.
- **Quality:** live console no longer fabricates incident state / success rate on real MIT.
- **Validation:** +8 golden tests for the derive libs → **82 pass / 0 fail**, `tsc --noEmit` clean. Full E2E via tunnel = **not run** (Track B realtime not wired; mock-mode only) — honest gap.
- **Risk / rollback:** pure additions + gating; mock path unchanged. **Links:** PR #414, ADR 022, PRD #304.
## 2026-06-29 — MIT: lazy package-import boundary → torch-free logic tests + blocking CI gate (#359)

**1. Type.** Tech-debt / perf + CI. Lazy-imports torch at the package boundary so pure-logic tests and the CI logic gate run without the multi-GB ML stack. ADR 029.

**2. Trigger.** `manga_translator/__init__.py` ran `from .manga_translator import *` and `utils/__init__.py` ran `from .inference import *`; both pull torch. So ANY import (even `from manga_translator.config import Config`) dragged in torch+cv2+transformers+diffusers — `mit-ci` had to install the full ML stack for a font-fit unit test and stayed `continue-on-error` (report-only), letting real breakage show green.

**3. Change (before → after).**
- before: eager `from .manga_translator import *` (package) + `from .inference import *` (utils); single `mit-ci` job installing torch + full requirements, `continue-on-error: true`, async tests failing (strict pytest-asyncio).
- after: PEP 562 `__getattr__` forwards public names lazily in both `__init__`s (importlib.import_module to avoid self-name recursion); `test/conftest.py` `collect_ignore`s the 12 torch-only modules when torch is absent; `asyncio_mode = auto`; `mit-ci.yml` = blocking `logic` job (lightweight install via a grep dep-filter, torch-free suite) + report-only `heavy` job (full ML).

**4. Seams / commits.** c1 package `__init__` lazy (+ characterization tests); c2 `utils/__init__` lazy; c3 CI split (conftest + pyproject + mit-ci.yml). Characterization-first; one concern per commit.

**5. Byte-identical proof.** Both `__getattr__`s are additive — no public name removed; `test_lazy_import.py` asserts (in a child interpreter) the consumed API resolves to the same objects as before. No star-import of either package exists, so dropping `*` is safe. Full suite 0 new failures vs baseline.

**6. Performance.** Logic tests/CI skip the ~20 s ML import + the multi-GB install. First attribute access (not import) now pays the ML cost — invisible to real runs, eliminated for logic runs.

**7. Quality / metrics.** torch-needing test files **27 → 12**; torch-free collection **338 → 413** tests; logic gate collects with **0 errors**, torch never imported (validated under a torch-absent import blocker). +5 characterization/torch-free tests. Full MIT suite 0 new failures (21 pre-existing).

**8. Tech debt removed.** Heavy deps now sit behind a lazy boundary instead of an eager package `__init__`; `mit-ci` can become a real blocking gate; the long-standing async-test config gap (`asyncio_mode`) is fixed.

**9. Risk / rollback.** Additive `__getattr__`s → rollback = restore the eager `import *`. **AFK-unvalidatable parts** (by design, validated by the PR's own `mit-ci` run): the grep dep-filter completeness + the logic gate's green status + `asyncio_mode=auto` making the async suites pass with pytest-asyncio installed. If the logic job goes red, drop the offending grep line / add the test to conftest's list.

**10. Notes.** Residual 12 heavy files = genuine model/translator tests + deeper transitive chains (`pipeline_params → ModelWrapper` top-import, dispatch registries) — a follow-up slice. The `heavy` job stays report-only until reliably green on a GPU-less runner.

**11. KPI.** #359 · lazy package boundary · 27→12 heavy files / 338→413 torch-free tests · 0 new failures · mit-ci logic gate torch-free + blocking-capable.

*Validation:* `pytest test/test_lazy_import.py` 5/0; full suite 0-new-fail; torch-absent blocker → 413 collect / 0 collection errors / torch never imported. *Links:* #359, #355, ADR 029, branch `worktree-ci-mit-lazy-torch`. CI dep-filter + flip validated by the PR's mit-ci run.

---
## 2026-07-04 — Master Plan 2 (Phase 0–3 autonomous) + deterministic real-page benchmark harness

**What / where.** `PR #532` (`fix/mit-mp2-p2-p5`): P2 cache-safety (`mit-batch-orchestrator.service.ts`), P5
config verify, P0 eval harness (`MIT/eval/translation_eval.py`), P7 contract+determinism gates
(`translators/numbered_contract.py`) + P7 concise-bubbles directive (`translators/config_gpt.py` +
`Backend MIT_CONCISE_BUBBLES`), and the deterministic render A/B harness (`MIT/tools/render_dump_ab.py`).

**Why.** Round-2 push toward human-level translation quality (epic #528). The load-bearing blocker was that
**every prior render comparison was confounded by translator non-determinism** — so no fix could be trusted.

**Before → after.**
- Render benchmark method: live 2-call A/B (non-deterministic, untrustworthy) → **dump-once + re-render-N-configs
  offline** (identical text, only the knob differs). Enabled by `MIT_DEBUG_RENDER_DUMP` + `render_dump_ab.py`.
- P2 cross-page context: enabling it cached a context-free page under a context-on key (#524) → orchestrator now
  sends the full ordered chapter when context on (byte-identical off).
- P7: no reproducibility gate → `is_deterministic_decode` + finding that prod runs `temp=0.5` (non-reproducible);
  numbered-contract normalizer (7/8→8/8 alignment on a dropped index).

**Perf Δ.** None on the default path (all changes flag-gated / byte-identical off). Harness runs offline (font
only, no ML) in <1s/config.

**Quality (benchmark-proven, the key outcome).** The user's narrow-bubble defect was deterministically
diagnosed as a **fundamental bubble-size × text-length limit**: neither `reference_layout` (P3, regresses the
narrow column) nor `bubble_area_fit` toggling nor P7 conciseness (measured 112 vs 110 chars — no help) fixes it;
**P1 readable-floor (already live) is the least-bad option.** The general narrow-bubble class is handled by P1.
So P3/P4 are correctly NOT promoted — an evidence-based decision, not a gap.

**Validation.** 195 tests green (129 MIT + 66 Backend); 4 committed real-page deterministic A/B benchmarks
(`docs/reports/benchmarks/2026-07-04-*`); root-cause diagnosis committed.

**Risk.** Low — all default-off/additive/docs/tools. The only production-logic change (#524 orchestrator) is
gated + characterization-net-green. **Remaining MP2 work is external-only** (merge #532 [security-gated for the
agent], ML models for P6/P11, human grading for P7-accuracy via #526, a repro fixture for P9, prod-enable
decisions) — documented in `docs/reports/mit-master-plan-2-status.md`.

## 2026-07-04 (b) — MP2 P7-accuracy LLM-judge + brainstorm-unblocked clusters (PR #533)

**What / where.** `PR #533` (`fix/mit-mp2-p2-p5`): `MIT/eval/llm_judge.py` + `run_llm_judge.py` (torch-free
LLM-judge over the #526 harness, reusing the `CUSTOM_OPENAI_*` endpoint) and 3 committed benchmarks
(`docs/reports/benchmarks/2026-07-04-{translation-eval-llmjudged,p7-conciseness-quality-ab,brainstorm-unblocked-clusters}.{md,png}`).

**Why.** The reviewers' #1 gap — translation *accuracy* — was previously "unmeasurable". A `/clink-brainstorm`
round found the first measurement was NOT blocked on a human: the endpoint + cached EN references already exist.

**Before → after.**
- Translation quality: "unmeasurable / asserted" → **measurable**. First real LLM-judged scorecard: baseline
  **1.70/2** over 35 bubbles (faithfulness 1.63 / cohesion 1.83 / style 1.63).
- **Refines the (a)-entry claim** that P7 conciseness is "no help": that was a *length* finding (112≈110 chars).
  A clean quality A/B shows `concise_bubbles` ON **improves LLM-judged quality** (overall 1.47→1.60,
  faithfulness 1.41→1.59) — it doesn't shorten, it phrases more faithfully → proven-good enable candidate
  (alongside P8 Knuth-Plass), still default-off.
- P6 SFX (model cached, `detect_sfx_boxes` verified, 4 boxes) and P9 (0-drop audit = terminal state) confirmed
  autonomously advanceable, not blocked.

**Perf Δ.** None — eval/benchmarks are offline tools; no production path touched.

**Quality / validation.** LLM-judged (lower-confidence than blind human grading — the gold standard remains
~100 bubbles + human). `translation_eval` suite 9/9 green; `llm_judge` import verified torch-free (logic-gate
safe). Every benchmark now ships a committed PNG per the benchmark rule.

**Risk.** Very low — additive eval/docs only, no runtime code. Cleanup in this PR: dropped a 1396-line worker
log that had leaked in (+ gitignore), relocated the proactive-clink-brainstorm memory to the canonical Obsidian
vault. **Remaining = user-gated:** merge #533 + prod-enable of the proven-good flags.

## 2026-07-10 — Tech-debt batch (6 PRs: #542/#544/#616/#617/#618/#620)

**Change.** Agent-owned tech-debt batch merged to `main`: two latent-bug fixes (`translation_store` utf-8 encoding #542; `readWithTimeout` dangling-timer leak #544), three test-suite fixes greening the report-only heavy-ML pytest job (#616/#617/#618), and a process-doc rule (#620). All TDD (RED demonstrated the concrete defect before GREEN) + `/scrutinize` (verdict ship, findings posted bilingual; one real finding — a self-wikilink in #621 — caught and fixed).

**Before → after.** heavy-ML CI: 3 pre-existing failures → 0. Windows Thai/CJK save-text: crash → round-trips. Batch NDJSON stream: ~90s timer leaked per chunk → released in `finally`. Pre-merge discipline: implicit → documented rule + dogfooded (#612 rebased onto post-#619 main before merge).

**Validation.** Per-PR logic-gate + heavy-ML CI green; #612 heavy-ML re-verified green after rebase. No production runtime behaviour changed (the one prod-file touch, #619's `flux_embed_cache` import relocation, is import-timing only, cached in `sys.modules`).

**Risk.** Low — five of six PRs are test/docs/IO-hardening; the encoding + timer fixes are additive-safe (no legacy non-ASCII files existed pre-fix; timer cleanup is a no-op when unset). Base-staleness verified disjoint for every merge (no clobber possible).

**Remaining.** #614 (load_dotenv extraction) + #615 (BaseGPTTranslator) filed as focused leftovers; CLAUDE.md copy of the #620 rule deferred to Stage B.
