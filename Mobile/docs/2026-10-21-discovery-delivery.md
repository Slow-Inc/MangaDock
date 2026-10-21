# Discovery UI delivery — 2026-10-21

## Result and scope

Smooth the hero cover shade, align Top 10 covers/ranks, and bound the hero on
tablet-sized windows. The delivery branch is `fix/mobile-discovery-ui-20261021`,
based on the latest native branch commit `ef301fb`, including its strict/optional
JSON and repeated-pinch fixes. API, authentication, catalog, reader and their
tests have no changes relative to that base. No dependency or schema changes.

Hero cover width is the minimum of 88% of its page, 320dp, and the width of a
2:3 cover occupying 60% of window height. Carousel pages and scroll offsets
still use the full available viewport width. The 20 shade strips are replaced
by a continuous gradient. Ranked cards align at the top; each number is anchored
to a 144dp cover frame rather than variable metadata height.

## Verification

| Check | Result |
| --- | --- |
| Mobile regression suite | 235/235 passed, including latest upstream JSON/pinch regressions |
| TypeScript / environment | Passed |
| Formatting / diff whitespace | Passed after formatting the touched source |
| Lockfile | npm ci dry-run passed |
| Repository tooling | 58/58 passed |
| Android build | ARM64 + x86_64 release build, vital lint included, 320 tasks, 1m56s |
| Galaxy Z Flip4 / Android16 | Install-r, launch, home, carousel dot selection, categories, 2-column catalog, return home passed |
| Tablet portrait emulator | 1600×2560px at320dpi (800×1280dp): home, dots, categories, 3-column grid passed |
| Tablet landscape emulator | 2560×1600px at320dpi (1280×800dp): same UI checks plus return home passed |
| Hero geometry | Phone866×1299px; tablet640×960px in both orientations |
| Top10 / font150 | Earlier physical sweep verified all10 ranks at font1.0/1.5; layout code retained; font1.0 restored |

Installed APK SHA-256 matches the same final artifact on phone and emulator.
Independent review traced paging, rank layout, native gradient support and
unchanged press/navigation paths; no blocking source regression was found.
The reviewer raised short-window title/shade overlap for future testing; phone
orientation remains portrait, and tested tablet windows are at least800dp tall.

Images: [phone](screenshots/native-discovery-phone-2026-10-21.png),
[tablet portrait](screenshots/native-discovery-tablet-portrait-2026-10-21.png),
[tablet landscape](screenshots/native-discovery-tablet-landscape-2026-10-21.png).

## Live-service limitations and discarded probes

Search submits and remains pending; entering book details/reader remains blocked
by `versions/title/:id`. Direct local book-detail and chapter probes returned200,
while the versions endpoint exceeded20s. A direct authenticated Data API probe
also timed out, and SQL through the independent Supabase connector failed with
connection timeout. Project metadata reported ACTIVE_HEALTHY despite this;
database logs included SQLSTATE57014 cancellations. The database cause is not
fully established. This does not certify live reader, OAuth, payments or MIT.
No substitute/fake response, database mutation, key change or remote restart
was used to make a test pass. The local backend is retained at the user's request.

The original ARM64-only APK could install but not load its native library on
the x86 emulator. The final build includes x86_64 and runs successfully. An
initial phone carousel probe missed its expected slide during autoplay; the
final probe reselected the requested dots and observed both actual slides.
The portrait search-result probe failed and is recorded as blocked, not passed.
Documentation prepend conflicts during transfer onto ef301fb preserved both
the upstream and local histories. A safety stash remains local.

## Artifact and rollback

`Mobile/build/apk/2026-10-21/MangaDock-0.1.0-discovery-responsive-arm64-x86_64.apk`
is 43,448,516 bytes; SHA-256:
`0edfb3115f49428902c2871584c25b5de47e682105267c6f5a66925a55d0b2ac`.
Version0.1.0/code1, existing Android Debug signing, local LAN/dev CAPTCHA config;
internal QA only. No store or production release, no tablet hardware/iOS claim.
Runtime performance is not measured. Revert this source change to restore the
upstream presentation without changing its business logic. Logs/XML and helper
scripts are local in `qa/discovery-release-20261021/`; APK/private env/raw logs
are excluded from source staging.

## ผลลัพธ์และขอบเขต

แก้เงาปก Hero ให้ต่อเนื่อง จัดปก/เลข Top10 ให้ตรงแนว และจำกัดขนาด Hero บนจอ
tablet branch ส่งมอบคือ `fix/mobile-discovery-ui-20261021` ต่อจาก `ef301fb`
ล่าสุด ซึ่งมีแก้ JSON แบบจำเป็น/ไม่จำเป็นและ pinch ซ้ำแล้ว โค้ด API/auth/catalog/
reader และ tests เดิมไม่ต่างจากฐานนี้ ไม่เพิ่ม dependency หรือเปลี่ยน schema

ความกว้างปกเลือกค่าต่ำสุดระหว่าง88%ของหน้า,320dp และปก2:3ที่สูง60%ของหน้าต่าง
ระยะหน้า carousel/การเลื่อนยังใช้ความกว้าง viewport เต็ม เปลี่ยนเงา20แถบเป็น
gradient ต่อเนื่อง จัดการ์ดอันดับชิดบน และยึดเลขกับกรอบปก144dpแทนความสูงข้อความ

## ผลตรวจ

Mobile235/235รวมกรณี JSON/pinch ล่าสุดผ่าน TypeScript/env/format/diffผ่าน
lockfile dry-runผ่าน tooling58/58ผ่าน Android buildรวมvital lintผ่าน320tasks/1m56s
รองรับARM64+x86_64 Z Flip4 Android16ติดตั้งแบบอัปเดต/เปิด/หน้าแรก/จุดสลับปก/
หมวดหมู่/กริด2คอลัมน์/กลับหน้าหลักผ่าน Emulator tabletแนวตั้ง1600×2560px320dpi
(800×1280dp) และแนวนอน2560×1600px320dpi(1280×800dp) ผ่านหน้าแรก/จุดสลับปก/
หมวดหมู่/กริด3คอลัมน์ แนวนอนกลับหน้าหลักผ่าน ปกบนมือถือ866×1299px และtablet
640×960pxทั้งสองแนว ชุดTop10ก่อนหน้ายืนยันครบ10อันดับทั้งฟอนต์1.0/1.5 คงโค้ด
จัดแนวเดิมและคืนฟอนต์1.0แล้ว hashที่ติดตั้งบนทั้งสองเครื่องตรง artifactสุดท้าย

Reviewerแยกตรวจpaging/กรอบอันดับ/native gradient/การกดเปิดเดิม ไม่พบข้อบกพร่อง
sourceที่ต้องหยุดส่งมอบ มีข้อสังเกตให้ตรวจชื่อกับเงาในหน้าต่างเตี้ยเพิ่มเติม
มือถือยังตั้งportraitและtabletที่ตรวจสูงอย่างน้อย800dp รูปจริงตามลิงก์ด้านบน

## ข้อจำกัดบริการสดและการทดลองที่ไม่นับผ่าน

ส่งคำค้นแล้วค้างรอข้อมูล การเข้ารายละเอียด/readerยังติดversions/title/:id
ตรวจbackendในเครื่องแล้วรายละเอียดหนังสือและตอนตอบ200 แต่versionsเกิน20วินาที
Data APIที่ยืนยันตัวตนตรงก็timeout และSQLผ่านSupabase connectorอีกเส้นทางมี
connection timeout แม้metadataโครงการรายงานACTIVE_HEALTHY logมีSQLSTATE57014
ยังไม่สรุปต้นเหตุฐานข้อมูลทั้งหมด และไม่รับรองreader/OAuth/payment/MITสด
ไม่ใช้ข้อมูลปลอมหรือแก้ฐานข้อมูล/key/restartระยะไกลให้testsผ่าน คงbackendเครื่องนี้
ตามผู้ใช้สั่ง

APKARM64เดิมติดตั้งบนemulatorx86ได้แต่โหลดnative libraryไม่ได้ จึงbuildรวมx86_64
แล้วรันผ่าน Probeสลับปกมือถือครั้งแรกพลาดจังหวะautoplay จึงเลือกจุดซ้ำและยืนยัน
ภาพทั้งสองจริงในprobeสุดท้าย ส่วนsearchแนวตั้งไม่ผ่านและบันทึกblockedตรงไปตรงมา
ตอนย้ายฐานมีconflictเฉพาะส่วนเพิ่มต้นเอกสาร เก็บทั้งประวัติupstreamและlocalไว้
และเก็บstashสำรองในเครื่อง

## Artifactและย้อนกลับ

APK/path/hash/ขนาด43,448,516bytesตรงตามด้านบน version0.1.0/code1เซ็นdebugเดิม
ใช้LAN/dev CAPTCHAสำหรับQAภายใน ไม่ใช่store/production ไม่อ้างtabletจริง/iOS
ไม่วัดความเร็วหรือหน่วยความจำ ย้อนsourceเฉพาะชุดนี้เพื่อคืนหน้าตาupstreamโดยคง
business logicเดิม หลักฐานดิบและhelperอยู่qa/discovery-release-20261021ในเครื่อง
ไม่stageAPK/private env/raw logs
