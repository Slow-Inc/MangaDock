# Native chapter list aligned with the web — 2026-10-20

## Outcome / ผลลัพธ์

The user approved the bounded chapter-list design, cancelled before implementation, then explicitly resumed it. Native book details now use the existing web chapter list as the layout reference: a separate scrolling area limited to half the window height, capped at320dp, compact rows, and page-count/price metadata. The outer page reaches reviews without traversing all83 chapters. Product/auth/payment behavior is unchanged.

ผู้ใช้อนุมัติรูปแบบรายการตอน ยกเลิกก่อนลงมือ แล้วสั่งให้ทำต่ออย่างชัดเจน ตอนนี้ Native ใช้รูปแบบจากเว็บ: รายการเลื่อนภายในสูงไม่เกินครึ่งจอและไม่เกิน320dp แถวกระชับพร้อมภาษา แหล่งที่มา และจำนวนหน้าหรือราคา เลื่อนหน้าหลักถึงรีวิวได้โดยไม่ต้องผ่าน83ตอน คงพฤติกรรมอ่าน/auth/payment เดิม

References: `Frontend/app/components/ChapterList.tsx` (50vh/320px viewport, language and pages/price labels) and existing Mobile design tokens. This slice does not add web language filters, grouped chapter versions or change the Native full-screen detail route.

ต้นแบบคือ ChapterList ของเว็บและ design tokens เดิม งานนี้ยังไม่เพิ่มตัวกรองภาษา/การจัดกลุ่มเวอร์ชันของเว็บ และคงหน้ารายละเอียด Native แบบเต็มจอ

## Implementation / สิ่งที่เปลี่ยน

- `NativeChapterList.tsx` owns the bounded viewport, nested Android scrolling, compact accessible rows, busy/empty states and touch feedback. All chapters remain selectable. Long titles/source names are visually truncated while the accessibility label retains the full row identity.
- `NativeReadingView.tsx` delegates its chapter section to that component. Selection still calls the existing `run → reader.open`; CAPTCHA/unlock checks remain in Reader.
- `catalog.ts` carries optional MangaDex `pageCount` and derives Studio counts from the `pages` array already returned by `versions/title`. No extra HTTP call or server change. Missing/zero counts display the same “พร้อมอ่าน” fallback as the web; paid rows show coins.

ภาษาไทย: แยก component รายการตอนที่จำกัดความสูง เปิด nested scrolling ทั้งด้านในและหน้าหลัก แสดง busy/empty/touch feedback และ accessibility label เต็ม เลือกตอนด้วย flow เดิม เพิ่มชนิดข้อมูลจำนวนหน้าจาก MangaDex และคำนวณ Studio จาก pages ใน response เดิม ไม่ยิง API เพิ่มหรือแก้ server ถ้าไม่มีจำนวนหน้าแสดง “พร้อมอ่าน” ตามเว็บ ส่วนตอนมีราคาแสดงเหรียญ

## Verification / การตรวจสอบ

- **234/234 Mobile tests**, TypeScript and touched-source/test formatting pass. New regressions first failed on missing bounded viewport and Studio page count, then passed after implementation. Tests cover83 entries and opening the final one, counts/source identity, paid/unknown metadata, busy suppression and an empty list.
- Android `assembleRelease` including vital lint passes:316 tasks,39s. Existing warnings only. No checks suppressed. Independent reviewer traced selection/access gates, count mapping, nested scrolling and responsive metadata; no actionable finding.
- Galaxy Z Flip4 / Android16: real book has83 chapters. List bounds stayed `[60,901]–[1020,1861]` (960px/320dp) and review heading remained at y1921 while an inner swipe changed visible rows1–4 to4–7. Scrolling to the end exposes chapter68.5; selecting it passes the hosted development CAPTCHA and opens Reader at `68.5 · 1/15`.
- At system font scale1.5, long titles wrap/truncate within their row while page badges remain visible. The initial font probe captured Chrome/Reader gate rather than chapters; it is not acceptance evidence. Retried with an explicit native book deep link, inspected the actual chapter screenshot, then restored and read back font scale1.0. Narrower devices and iOS were not tested.

ภาษาไทย: Mobile234/234, TypeScript และ format ผ่าน มี red→green สำหรับ viewport และจำนวนหน้า Studio ตรวจรายการ83ตอน เปิดตอนสุดท้าย ข้อมูลราคา/แหล่งที่มา busy และ empty Android build รวม vital lint ผ่าน316tasks/39s reviewer ไม่พบสิ่งต้องแก้ เครื่องจริงกรอบรายการสูง960px/320dp เลื่อนรายการด้านในโดยหัวข้อรีวิวยังอยู่ที่เดิม ไปตอนสุดท้าย68.5แล้วผ่าน CAPTCHA เข้า Reader หน้า1/15ได้ ทดสอบฟอนต์150% แล้วป้ายจำนวนหน้ายังอยู่ในแถว ช่วงแรกจับผิดหน้าจึงไม่นับเป็นหลักฐาน ทดสอบใหม่ผ่าน deep link จนได้ภาพ Native จริงและคืนฟอนต์1.0พร้อมอ่านค่ากลับ ไม่อ้างผลบนเครื่องแคบกว่านี้หรือ iOS

Tracked screenshots: [normal font](screenshots/native-chapters-bounded-2026-10-20.png), [150% font](screenshots/native-chapters-large-font-2026-10-20.png). Raw XML/device captures remain local in `qa/review-fixes/chapter-*`; logs in `qa/chapter-parity-*.log`.

ภาพสองแบบอยู่ใน repo ตามลิงก์ ส่วน XML/ภาพดิบ/logs อยู่ใน qa ของเครื่อง ไม่รวม credentials หรือภาพโปรไฟล์บัญชี

## QA artifact / ไฟล์ทดสอบ

- `Mobile/build/apk/2026-10-20/MangaDock-0.1.0-native-chapter-list-arm64.apk`
- SHA256 `db33b7c15aef8b33d1d461b38f7f872fe1d215c2d1c047e9f09b2571ed6bc441`;27,763,873 bytes. Installed `base.apk` SHA256 matches.
- Version0.1.0/code1, ARM64, same existing Android Debug signing. Existing session retained through `install -r`. LAN API and development CAPTCHA configuration unchanged; internal QA only.

ไฟล์ APK/hash ตรงกับที่ติดตั้ง เก็บ session เดิม ใช้ version/code และ debug key เดิมพร้อม LAN/dev CAPTCHA สำหรับทดสอบภายใน คงไฟล์ APK รอบก่อน

## Performance and limits / ประสิทธิภาพและข้อจำกัด

No speed/memory percentage is claimed. The existing list already rendered every row; this change retains that behavior in a bounded ScrollView and avoids nesting virtualized lists inside the parent ScrollView. No runtime dependency, backend or schema change. Overall book description length can still require outer scrolling. Existing release/MIT/payment/role acceptance gates remain separate. Roll back this UX commit to restore the former chapter layout without reverting B1–B6.

ไม่อ้างเปอร์เซ็นต์ความเร็ว/หน่วยความจำ รายการเดิม render ทุกแถวอยู่แล้ว คงวิธีนั้นใน ScrollView ที่จำกัดความสูง ไม่ซ้อน virtualized list ใน ScrollView ไม่เพิ่ม dependency หรือแก้ backend/schema เรื่องย่อยาวยังต้องเลื่อนหน้าหลัก และ gates release/MIT/payment/roles ยังแยกต่างหาก ย้อนเฉพาะ commit UX นี้เพื่อคืนรูปแบบเดิมได้โดยคง B1–B6
