<!-- lang:en -->
# ADR 029 — Native mobile discovery, tab navigation and shared reading history

**Status:** Accepted, 2026-10-03; implementation and API-boundary tests exist locally. Visual/live release acceptance is open.

**Area:** Mobile. [Approved PRD #724](https://github.com/Slow-Inc/MangaDock/issues/724), [S11 #735](https://github.com/Slow-Inc/MangaDock/issues/735), [S12 #736](https://github.com/Slow-Inc/MangaDock/issues/736), [S20 #744](https://github.com/Slow-Inc/MangaDock/issues/744).

## Context

The user selected a native Android application with the existing responsive mobile Frontend as the visual reference, preserving accounts, content, permissions and services. Phase 1 Reader/auth/payment controllers already exist. The next approved priority is Home and the original six mobile destinations while Phase 1 live acceptance remains open. Library and Community must not become WebView fallbacks or fabricated content.

ADR 014 governs browser traffic through the Next.js proxy. This decision adds a native client using the existing Mobile Backend Gateway and configured reachable API origin; it does not alter the browser proxy or shared bridge.

## Decision

- Render Home, releases, search, categories, library and Community with native components and Mobile-owned tokens/artwork derived from the responsive Frontend. Use existing catalog/feed/history endpoints. No new runtime dependency or service/schema/business-rule change.
- Keep navigation, discovery, personal data and Community behind small public stores that native views subscribe to. Home/listing/related and feed/post requests have independent cancellation/generation guards. Filter failures remain visible; obsolete results cannot change the selected screen. Back restores the last release/genre selection for its destination.
- Retain the existing Reader access gate when resuming history. Backend `lastPage` is written as a one-based page; convert once to the zero-based Viewer position before the first ready render. Missing Chapters leave details available for selection. A saved Chapter never grants paid entitlement or captcha clearance.
- Serialize authenticated history writes in arrival order, isolate queues/results by account identity, and merge only writes acknowledged after a history read began over that delayed read. Debounce normal page changes; flush the current position on Reader back, Chapter change and background transition. Failed saves remain visible and can be retried. Do not promise history durability across process termination, cross-device simultaneous writes, or offline operation without server acknowledgement.
- Read-only library/feed/post views are initial delivery, with complete mutation/social/account workflows retained as future slices. Publication, controller tests, source export and live/visual acceptance are separate statuses.

## Alternatives considered

1. Embed the existing web product: rejected by the user's native-only decision.
2. Duplicate business rules or extend Backend now: unnecessary for these existing contracts and outside the authorized native feature scope.
3. Introduce a broad navigation/data framework for this first set of screens: adds dependencies before route complexity requires them. A small tab store preserves destination/filter state and existing Reader/Wallet precedence.
4. Fire progress writes concurrently and optimistically display success: permits out-of-order shared history and masks failed saves. Serialized server-acknowledged writes have explicit failure behavior.

## Consequences

Mobile can progress independently of service changes and can exercise real modules through HTTP/OS boundary fixtures. Controller tests prove request/state behavior; they do not prove mobile visual fidelity, rich Community rendering or real authentication/payment/translation. Exact font metrics, populated emulator comparisons, physical-device checks and signed APK acceptance remain gates. Local env currently lacks the three required Mobile public variables; no secret file was copied or rewritten.

Rollback: revert Mobile navigation/discovery/personal/Community views and store wiring together; keep existing Backend data and Phase 1 services. This ADR supersedes no browser/server/translation ADR. [Execution evidence and resume instructions](../../Mobile/docs/2026-10-03-native-phase2-implementation.md).
<!-- lang:end -->

<!-- lang:th -->
# ADR 029 — Discovery, navigation และประวัติการอ่านร่วมของ Mobile native

**สถานะ:** Accepted วันที่ 2026-10-03 มี implementation และ tests ที่ขอบ API ในเครื่องแล้ว ยังเปิด acceptance ภาพและ release กับบริการจริง

**พื้นที่:** Mobile [PRD ที่อนุมัติ #724](https://github.com/Slow-Inc/MangaDock/issues/724), [S11 #735](https://github.com/Slow-Inc/MangaDock/issues/735), [S12 #736](https://github.com/Slow-Inc/MangaDock/issues/736), [S20 #744](https://github.com/Slow-Inc/MangaDock/issues/744)

## บริบท

ผู้ใช้เลือก Android native โดยใช้ responsive mobile ของ Frontend เดิมเป็นต้นแบบภาพและรักษาบัญชี เนื้อหา สิทธิ์และบริการเดิม มี controllers Reader/auth/payment Phase 1 แล้ว ลำดับที่อนุมัติถัดไปคือ Home และปลายทาง mobile หกเมนูเดิม ขณะที่ acceptance Phase 1 กับบริการจริงยังเปิดอยู่ รายการส่วนตัวและ Community ต้องไม่กลายเป็น WebView fallback หรือเนื้อหาที่สร้างขึ้นแทนข้อมูลจริง

ADR 014 กำหนดให้ traffic ของ browser ผ่าน Next.js proxy การตัดสินใจนี้เพิ่ม native client ที่ใช้ Mobile Backend Gateway เดิมกับ API origin ที่ตั้งให้เชื่อมต่อได้ ไม่เปลี่ยน browser proxy หรือ shared bridge

## การตัดสินใจ

- Render Home, releases, search, categories, library และ Community ด้วย native components พร้อม tokens/artwork ที่ Mobile ดูแลและนำจาก responsive Frontend ใช้ catalog/feed/history endpoints เดิม ไม่เพิ่ม runtime dependency หรือแก้บริการ/schema/กติกาธุรกิจ
- ซ่อน navigation, discovery, ข้อมูลส่วนตัวและ Community หลัง public stores ขนาดเล็กที่ native views subscribe คำขอ Home/listing/related และ feed/post มี cancellation/generation guards แยกกัน แสดง filter failures ให้เห็น ผลเก่าไม่เปลี่ยนหน้าที่เลือก และ Back คืน release/genre selection ล่าสุดของปลายทางนั้น
- คง access gate ของ Reader เดิมเมื่ออ่านต่อจากประวัติ เขียน `lastPage` ไป Backend เป็นเลขหน้าเริ่มที่หนึ่งแล้วแปลงครั้งเดียวเป็นตำแหน่ง Viewer เริ่มที่ศูนย์ก่อน ready render แรก หาก Chapter หายให้แสดงรายละเอียดเพื่อเลือกใหม่ Chapter ที่บันทึกไว้ไม่ให้สิทธิ์แบบชำระหรือ captcha clearance
- เรียง authenticated history writes ตามลำดับที่รับ แยก queues/results ตามบัญชี และผสานเฉพาะ writes ที่ได้รับ acknowledgement หลังเริ่ม history read ทับคำตอบ read ที่ช้า Debounce การเปลี่ยนหน้าปกติและส่งตำแหน่งปัจจุบันเมื่อ Back จาก Reader เปลี่ยน Chapter หรือเข้า background แสดง save failure และ retry ได้ ไม่รับประกันความคงทนของประวัติเมื่อ process ถูกปิด การเขียนพร้อมกันข้ามอุปกรณ์ หรือ offline หากยังไม่มี server acknowledgement
- การเปิดดู library/feed/post เป็นการส่งมอบเริ่มต้น งาน mutation/social/account ครบยังอยู่ใน slices ถัดไป แยกสถานะ publication, controller tests, source export และ acceptance ภาพ/บริการจริง

## ทางเลือกที่พิจารณา

1. ฝังเว็บเดิม: ไม่เลือกเพราะผู้ใช้ตัดสินใจเป็น native ทั้งหมด
2. ทำกติกาธุรกิจซ้ำหรือขยาย Backend ตอนนี้: ไม่จำเป็นสำหรับ contracts เดิมเหล่านี้และอยู่นอก scope ฟีเจอร์ native ที่อนุมัติ
3. เพิ่ม framework navigation/data ครอบคลุมตั้งแต่หน้าชุดแรก: เพิ่ม dependencies ก่อน route complexity ต้องใช้ Store ของ tabs ขนาดเล็กเก็บปลายทาง/filter และลำดับ Reader/Wallet เดิมได้
4. ส่ง progress writes พร้อมกันและแสดงว่าสำเร็จทันที: ทำให้ประวัติร่วมผิดลำดับและซ่อน save failures การเรียง writes และรอ server acknowledgement ทำให้ failure behavior ชัดเจน

## ผลตามมา

Mobile ทำต่อได้โดยไม่ต้องเปลี่ยนบริการและทดสอบ modules จริงผ่าน fixtures ที่ขอบ HTTP/OS ได้ Controller tests พิสูจน์คำขอและพฤติกรรม state แต่ไม่ยืนยันภาพ mobile, rich rendering ของ Community หรือ auth/payment/translation จริง ยังต้องตรวจ metrics ฟอนต์ ภาพ emulator ที่มีข้อมูล อุปกรณ์จริงและ acceptance ของ signed APK ปัจจุบัน env local ขาด public variables ของ Mobile สามตัว ไม่ได้คัดลอกหรือเขียนทับไฟล์ secrets

ย้อนกลับ: revert views และ store wiring ของ navigation/discovery/personal/Community ใน Mobile พร้อมกัน คงข้อมูล Backend และบริการ Phase 1 เดิม ADR นี้ไม่แทน ADR browser/server/translation ใด [หลักฐานและจุดทำต่อ](../../Mobile/docs/2026-10-03-native-phase2-implementation.md)
<!-- lang:end -->
