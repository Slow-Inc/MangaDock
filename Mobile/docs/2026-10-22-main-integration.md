# Native Mobile integration into main — 2026-10-22

## Scope and decisions

Integrate `feat/mobile-native-phase4` at `ef301fb9f928808a4656edcba6887dccb4d48196` with main at `cb1f7d951a6cb06f6f60e218c80cda3e93cf85dd`. This brings the native client, existing-service adapters, migration records and PR #782 physical-QA fixes into main. The responsive mobile design remains the reference; this does not certify full parity with subsequent web redesigns.

The five conflicted files were three Backend profile-join services and two historical reports. Retain normalization of Supabase joined profiles as object/array/null instead of main's type-assertion-only workaround. The three resolved services match the reviewed native branch. Preserve both histories in DONE and the impact report; every original main line was verified to survive in order. Unconflicted current-main work remains intact. There is no integration diff in Frontend, MIT or Mobile/shared; immutable QR source digests match 10/10.

ภาษาไทย: รวม native Phase 4 และการแก้ QA จาก PR #782 เข้ากับ main ตาม SHA ด้านบน ใช้ responsive mobile เดิมเป็นต้นแบบ แต่ยังไม่รับรองความตรงกับเว็บที่ปรับแบบภายหลัง แก้ conflict ห้าไฟล์ โดยเก็บการแปลง profiles แบบ object/array/null ใน Backend ทั้งสาม service และเก็บประวัติเอกสารทั้งสองฝั่งครบ ตรวจว่าบรรทัดเดิมของ main ยังอยู่ตามลำดับ ไม่มี diff ส่วน Frontend, MIT หรือ Mobile/shared และ hash vendor QR ตรง 10/10

## Fresh verification of the combined tree

- Mobile: 235/235 tests, TypeScript and environment validation pass.
- Backend: build and focused lint pass; full Jest 98 suites / 1,014 tests pass.
- Repository tooling: 58/58 tests pass.
- No replacement APK, new physical-device acceptance or live MIT/payment acceptance was performed in this integration pass. Earlier artifact/device reports describe their own source revisions only.
- GitHub CI and final landing state must be read from the integration PR; this pre-commit report does not claim a merge has already happened.

ภาษาไทย: ตรวจ tree รวมใหม่ Mobile 235/235, TypeScript/env ผ่าน Backend build/lint ผ่าน Jest ครบ 98 suites / 1,014 tests และ tooling 58/58 รอบนี้ยังไม่สร้าง APK ทดแทนหรือรับผลเครื่องจริง/MIT/payment เพิ่ม หลักฐานอุปกรณ์เดิมใช้กับ revision ของตัวเอง ผล CI และสถานะ merge สุดท้ายให้ดู PR รวม รายงานก่อน commit นี้ไม่ได้อ้างว่า merge แล้ว

## Remaining work and resume point

1. Draft PR #860 (discovery hero, cover alignment and tablet layout) is excluded. Its report still has incomplete search and details-to-Reader live-service acceptance; those are historical observations, not a new outage diagnosis here.
2. Build an APK from the accepted main revision, then repeat physical regression checks including strict JSON errors and pinch lift/rejoin. Complete live-service, MIT, payment/roles and distribution/signing acceptance before claiming production readiness.
3. Broader UX requests remain: search filters, Community metadata/fallback, root-tab Back, margins, continue-reading metadata, orientation and compact Reader controls. The bounded chapter list is included through #782.
4. Six unrelated uncommitted operational documents in the user's original checkout are preserved and excluded: DONE.md, Mobile/README.md, the completion ledger, acceptance checklist, system-impact report and the untracked 2026-10-20-public-https-apk.md. Reconcile these separately; do not overwrite that checkout.

ภาษาไทย: ยังแยก draft #860 เรื่อง hero/ปก/tablet ไว้ รายงานของ draft ยังรับผล search และ details เข้า Reader ไม่ครบ ต้องสร้าง APK จาก main ที่รับแล้วและทดสอบเครื่องจริงซ้ำ รวม error JSON และ pinch ยก/วางนิ้ว พร้อมรับบริการจริง MIT/payment/roles และการแจกจ่าย/ลงนามก่อนใช้คำว่าพร้อม production งาน UX อื่นตามข้อ 3 ยังอยู่ เอกสารค้างหกไฟล์ใน checkout เดิมตามข้อ 4 เก็บไว้ครบและไม่รวมใน PR นี้

## Review and operational notes

The integration review found no new actionable issue in the resolved seams: service normalization has object/array/null regression coverage, current-main Backend tests pass, and native runtime files retain the previously reviewed source. Automated tests do not establish visual or physical acceptance. Rollback is a normal revert of the integration PR, with a new APK if one was distributed; no database migration or provider configuration is applied by this integration.

Tokensave context did not return within the bounded attempt; the SQLite fallback database was absent. Used targeted reads and Git comparison. A read-only conflict preview's overbroad regex was corrected before any mutation; the resolution script's initial wrong-directory attempt failed before writes, then ran from the repository root. No changes resulted from those failed attempts. Resume with PR CI/review and exact-head landing, then the remaining acceptance items above.

ภาษาไทย: review รอยต่อไม่พบประเด็นใหม่ที่ต้องแก้ tests ครอบคลุม profiles สามรูปแบบ Backend main ผ่านครบ และ runtime native คง source ที่ review แล้ว Tests ไม่ยืนยันภาพหรือเครื่องจริง หากย้อนกลับให้ revert PR และสร้าง APK ใหม่เมื่อเคยแจก ไม่มี migration หรือการตั้ง provider ในรอบนี้ Tokensave ไม่ตอบภายในเวลาที่จำกัดและไม่มีฐาน SQLite จึงอ่านเฉพาะจุด/เทียบ Git แก้ regex สำหรับ preview ก่อนเขียน และแก้ working directory หลัง script ล้มก่อนเขียน ไม่มีผลข้างเคียงจากสองครั้งนั้น จุดทำต่อคือ CI/review และ merge head ที่ตรวจแล้ว จากนั้นทำ acceptance ที่เหลือ
