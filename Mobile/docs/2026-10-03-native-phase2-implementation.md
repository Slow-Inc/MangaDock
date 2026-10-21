# Current checkpoint / สถานะปัจจุบัน

2026-10-04: Later Phase 2/3 source and review fixes are recorded in [full feature/acceptance mapping](2026-10-04-native-full-implementation.md) and [completion ledger](2026-10-03-native-completion-ledger.md). 218 tests, typecheck and post-fix Hermes export passed; live/visual/signed device acceptance remains open. Earlier delivery details below are historical checkpoints.

TH: งาน source Phase 2/3 และแก้ review ล่าสุดดู mapping/ledger ข้างต้น ผ่าน 218 tests/typecheck/Hermes export หลังแก้ ยังเปิด acceptance live/visual/signed-device ข้อมูลด้านล่างเป็น checkpoint เดิม

<!-- lang:en -->
# Native Phase 2 — discovery, navigation and initial personal/community flows

Date: 2026-10-03. Status: local implementation and source verification complete for this first delivery; live/visual acceptance open. This is not completion of Phase 2 or full native replacement.

## Approved direction and publication

The user approved continuing from `$grill-me` through `$to-prd`, `$to-issues` and `$tdd`, reusing the already reviewed full-parity scope. The selected next priority was Home/discovery with the original mobile navigation while Phase 1 live acceptance remains open. Product behavior, accounts and services stay the same; use the actual responsive mobile Frontend and `DESIGN.md` as the reference. No embedded WebView fallback.

The exact new native PRD was absent from GitHub before publication. The old hybrid parent #113 and its closed children describe the earlier direction and were preserved. GitHub CLI publication succeeded: [PRD #724](https://github.com/Slow-Inc/MangaDock/issues/724), 29 slices #725–#753, each with a full English/Thai body, real parent/blocker links and visual acceptance criteria. AFK slices use `ready-for-agent`; HITL use `ready-for-human`. [Resumable receipts](native-migration-publish/published.json). All issues remain open; no parent edits, issue closure, commit, PR or merge.

## Delivered locally

- Home with the existing mobile hero/portrait cards, Top 10, server landing rows, visible stale/offline status and retry; six native destinations in the original order: Home, All Books, Community, Search, Categories, My List.
- Releases with four existing tabs, tags and 28-item page requests; 18 original genre choices; related manga on native details. Independent request guards protect Home/listing/related data. Back restores each destination's release/genre selection and page.
- Existing favorites/follows/liked/history reads. Liked IDs resolve through existing manga details in groups of at most four. Guests see a login prompt; account transitions abort requests and clear private state without deleting server records.
- Continue Reading on Home and history cards resumes the saved Chapter and one-based Page through the existing catalog and Reader gates. Position is supplied before the first ready render. Paid Chapters remain gated; unavailable Chapters leave details for a new selection.
- Server-acknowledged progress writes to the existing history endpoint, serialized so an older request cannot finish after a newer one. A delayed history read cannot replace a newly acknowledged position. Normal page changes debounce 750ms; Back, Chapter changes and background transitions send the current position. Failed saves show retry. No offline/process-kill/cross-device durability guarantee is added.
- Read-only Community new/hot feeds, category and controller-level manga filters, pagination, post details, spoiler reveal and a native manga reference. Late feed/post responses and account changes cannot restore obsolete/private state; errors remain visible with retry/back.
- Four additional PNG navigation icons derived from the original Navbar; existing logo/tokens reused. No new runtime dependency. Feature source changes remain in Mobile; Frontend/Backend/MIT/shared bridge and business rules are preserved. The earlier separately requested Backend compilation fix remains a separate change.

## TDD and verification

Real Mobile modules and real Supabase SDK are used through public interfaces. Fixtures replace external HTTP/auth/OS boundaries; internal controllers are not mocked. Incremental cycles covered discovery payloads and filters, response races/cancellation/retry, tab Back, account isolation, history save/resume and feed/post navigation.

This continuation observed failing behavior assertions for private history restored after sign-out, concurrent page writes reaching the server together, and an old read restoring Page 7 after Page 8 had been acknowledged; each then passed after its minimal fix. The first progress-write/navigation-selection additions failed at the missing public operation before implementation. Paid/missing-Chapter tests characterize the existing access behavior with the new resume flow; they are not claimed as manufactured RED cycles.

| Check | Evidence |
| --- | --- |
| Mobile full suite | `npm.cmd test`: **121/121 passed**, exit 0; 33 additional tests over the preceding 88-test checkpoint |
| Discovery/navigation/personal/community | 11 / 3 / 11 / 8 tests respectively; controlled external APIs, actual SDK/controllers |
| TypeScript | `npm.cmd run typecheck`: passed, exit 0 |
| Android Hermes source export | `npm.cmd exec -- expo export --platform android --output-dir dist/native-phase2 --clear`: passed, exit 0; **709 modules / 2.6MB / 10 assets** |
| Local SDK | Earlier same-day original x86_64 Gradle debug assembly passed; ignored `android/local.properties` points to the installed SDK |
| Live environment gate | `npm.cmd run validate:env`: exit 1; required public API URL, Supabase URL and anon key are missing |
| Visual/device acceptance | New Phase 2 views not yet inspected on emulator; no new signed beta or full physical acceptance |

Source export works independently of service credentials and does not prove that the app can initialize, load real data or match the web pixels. The 2026-10-02 login/offline-search screenshots belong to Phase 1, not this delivery. Performance, memory and exact Thai font metrics have not been measured.

## Remaining slices and gates

- [S11 #735](https://github.com/Slow-Inc/MangaDock/issues/735): populated web/native comparisons, text scale, viewport/layout, navigation/filters/recommendations and device acceptance. Do not close on controller tests alone.
- [S12 #736](https://github.com/Slow-Inc/MangaDock/issues/736): native collection mutations, history removal/clear/export and complete cross-device refresh/visual acceptance. Initial read/save/resume flow is implemented.
- [S20 #744](https://github.com/Slow-Inc/MangaDock/issues/744): trending, author/profile and complete manga-discussion navigation, rich post/markdown parity and live/render acceptance. Initial feed/post read flow is implemented; raw content is currently native Text.
- S13–S19: reviews/comments/reports, public profiles/follows, check-in, notifications, preferences/statistics, account recovery/linking/security and Wallet history remain subsequent Phase 2 delivery.
- S21–S22: post creation/edit/delete/upload, replies/votes/reports and authenticated Community SSE remain subsequent delivery.
- Phase 3 S23–S28: Studio, publishing/earnings and role-gated management; S29 complete replacement review. Existing Phase 1 OAuth/captcha/TOTP/MIT/payment and signed/physical beta gates remain open.

## Environment and resume here

Mobile's current private `.env` contains Backend configuration keys and lacks `EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Backend's local `.env` is absent and port 4001 was unavailable at this checkpoint. No values were printed, no private file was moved/overwritten, and no service-role credential was put into public variables. Configure Mobile from [`.env.example`](../.env.example) using the reachable existing Backend and Supabase public anon/publishable key; keep Backend secrets in its private environment. Required service URLs/credentials remain user setup, not inferred from elapsed time.

An attempt to start Metro with temporary smoke-test credentials was rejected by automatic approval review, which supplied only “blocked by policy.” It was not retried through a different launcher/env file. Ordinary Android source export succeeded without those credentials. No agent-started live Metro/Backend process was left running.

After configuring the private environments, run `npm.cmd run validate:env`, start the existing Backend, then `npm.cmd run android` from Mobile. Compare Home/hero/Continue Reading, all four releases tabs, categories/related, library and Community with the corresponding Frontend at the same viewport/text scale. Exercise Back, sign-out, failed/retried saves and actual guarded Reader restoration. Capture actual native/web outputs before claiming visual parity. Continue the remaining slice criteria without duplicating PRD/issues. [ADR 029](../../docs/adr/029-mobile-native-discovery-navigation-and-history.md).
<!-- lang:end -->

<!-- lang:th -->
# Native Phase 2 — discovery, navigation และ flows เริ่มต้นของข้อมูลส่วนตัว/Community

วันที่: 2026-10-03 สถานะ: implementation ในเครื่องและการตรวจ source สำหรับการส่งมอบชุดแรกนี้เสร็จแล้ว ยังเปิด acceptance ภาพ/บริการจริง ไม่ใช่ Phase 2 เสร็จครบหรือแทนผลิตภัณฑ์ native ทั้งหมดแล้ว

## ทิศทางที่อนุมัติและการเผยแพร่

ผู้ใช้อนุมัติทำต่อจาก `$grill-me` ผ่าน `$to-prd`, `$to-issues` และ `$tdd` โดยใช้ scope parity ครบที่ review แล้ว ลำดับถัดไปที่เลือกคือ Home/discovery พร้อม navigation mobile เดิม ขณะที่ acceptance Phase 1 กับบริการจริงยังเปิดอยู่ คงพฤติกรรมผลิตภัณฑ์ บัญชีและบริการ ใช้ responsive mobile ของ Frontend จริงและ `DESIGN.md` เป็นต้นแบบ ไม่มี embedded WebView fallback

ก่อนเผยแพร่ยังไม่มี PRD native ใหม่ที่ชื่อและ scope ตรงกันบน GitHub ส่วน parent hybrid #113 และ children ที่ปิดแล้วเป็นทิศทางเก่าและคงไว้ เผยแพร่ผ่าน GitHub CLI สำเร็จ: [PRD #724](https://github.com/Slow-Inc/MangaDock/issues/724), slices 29 งาน #725–#753 ทุกงานมี English/Thai bodies เต็ม ลิงก์ parent/blockers จริงและเกณฑ์ตรวจภาพ AFK ใช้ `ready-for-agent`; HITL ใช้ `ready-for-human` [ผลการเผยแพร่ที่ทำต่อได้](native-migration-publish/published.json) ทุก issue ยังเปิดอยู่ ไม่แก้ parent ปิด issue ทำ commit/PR หรือ merge

## สิ่งที่ส่งมอบในเครื่อง

- Home พร้อม hero/การ์ดปกแนวตั้งตาม mobile เดิม, Top 10, rows จาก server, สถานะ stale/offline และ retry มีปลายทาง native หกเมนูตามลำดับเดิม: Home, หนังสือทั้งหมด, Community, ค้นหา, หมวดหมู่, รายการของฉัน
- Releases สี่แท็บเดิมพร้อม tags และคำขอหน้าละ 28 รายการ หมวดหมู่เดิม 18 หมวด และมังงะที่เกี่ยวข้องในหน้ารายละเอียด native มี request guards แยก Home/listing/related และ Back คืน release/genre selection กับหน้าของปลายทางนั้น
- อ่านรายการโปรด/ติดตาม/ถูกใจ/ประวัติเดิม รายการถูกใจที่เป็น IDs แปลงผ่านรายละเอียดมังงะเดิมครั้งละไม่เกินสี่คำขอ ผู้ใช้ guest เห็นคำเชิญ login การเปลี่ยนบัญชี abort คำขอและล้าง state ส่วนตัวโดยไม่ลบข้อมูล server
- “อ่านต่อ” บน Home และการ์ดประวัติเปิด Chapter และเลขหน้าเริ่มที่หนึ่งที่บันทึกไว้ผ่าน catalog/Reader gates เดิม ส่งตำแหน่งก่อน ready render แรก ตอนแบบชำระยังต้องผ่าน gate หาก Chapter หายให้แสดงรายละเอียดเพื่อเลือกใหม่
- บันทึก progress ไป history endpoint เดิมโดยรอ server acknowledgement และเรียงคำขอไม่ให้คำขอเก่าเสร็จหลังคำขอใหม่ History read ที่ช้าไม่แทนตำแหน่งที่เพิ่งบันทึกสำเร็จ Debounce การเปลี่ยนหน้าปกติ 750ms; Back, เปลี่ยน Chapter และเข้า background ส่งตำแหน่งปัจจุบัน แสดง save failure พร้อม retry ไม่เพิ่มการรับประกัน offline/process-kill/การเขียนพร้อมกันข้ามอุปกรณ์
- เปิดดู Community feeds new/hot, หมวดหมู่และ manga filters ระดับ controller, pagination, รายละเอียด post, เปิด spoiler และลิงก์มังงะ native ผล feed/post ช้าและการเปลี่ยนบัญชีไม่คืน state เก่า/ส่วนตัว แสดง errors พร้อม retry/back
- เพิ่ม navigation PNG สี่ไอคอนจาก Navbar เดิม ใช้โลโก้/tokens เดิม ไม่เพิ่ม runtime dependency Source ฟีเจอร์อยู่ใน Mobile คง Frontend/Backend/MIT/shared bridge และกติกาธุรกิจ ส่วน Backend compilation fix ที่ผู้ใช้ขอก่อนหน้าเป็นอีก change แยกกัน

## TDD และการตรวจ

ใช้ modules Mobile จริงกับ Supabase SDK จริงผ่าน public interfaces Fixtures แทนเฉพาะขอบ HTTP/auth/OS ภายนอก ไม่ mock controllers ภายใน ทำ cycles ทีละพฤติกรรมสำหรับ discovery payloads/filters, response races/cancellation/retry, Back ของ tabs, การแยกบัญชี, history save/resume และ feed/post navigation

รอบนี้เห็น behavior assertions fail จริงเมื่อ history ส่วนตัวกลับมาหลัง sign-out, page writes สองคำขอไป server พร้อมกัน และ read เก่าคืน Page 7 หลัง Page 8 ได้รับ acknowledgement แล้ว จากนั้นแต่ละข้อผ่านหลังแก้แบบเล็กที่สุด การเพิ่ม progress-write/navigation-selection ครั้งแรก fail เพราะยังไม่มี public operation ก่อน implement ส่วน tests ของ paid/missing Chapter ตรวจพฤติกรรม access เดิมร่วมกับ resume flow ใหม่ ไม่อ้างว่าเป็น RED ที่สร้างขึ้น

| การตรวจ | หลักฐาน |
| --- | --- |
| Mobile suite ทั้งหมด | `npm.cmd test`: **121/121 ผ่าน**, exit 0 เพิ่ม 33 tests จาก checkpoint ก่อนหน้า 88 tests |
| Discovery/navigation/personal/community | 11 / 3 / 11 / 8 tests ตามลำดับ ใช้ API ภายนอกที่ควบคุมและ SDK/controllers จริง |
| TypeScript | `npm.cmd run typecheck`: ผ่าน exit 0 |
| Android Hermes source export | `npm.cmd exec -- expo export --platform android --output-dir dist/native-phase2 --clear`: ผ่าน exit 0; **709 modules / 2.6MB / 10 assets** |
| SDK เฉพาะเครื่อง | คำสั่ง Gradle debug assembly x86_64 เดิมผ่านก่อนหน้านี้ในวันเดียวกัน; `android/local.properties` ที่ ignore ชี้ SDK ที่ติดตั้ง |
| เกณฑ์ environment จริง | `npm.cmd run validate:env`: exit 1 ขาด public API URL, Supabase URL และ anon key ที่จำเป็น |
| Acceptance ภาพ/อุปกรณ์ | ยังไม่ตรวจ views Phase 2 ใหม่บน emulator ไม่มี signed beta ใหม่หรือ acceptance เครื่องจริงครบ |

Source export ทำได้โดยไม่ต้องมี credentials ของบริการ และไม่พิสูจน์ว่าแอป initialize ได้ โหลดข้อมูลจริงได้หรือภาพตรงเว็บ Screenshots Login/ค้นหา offline วันที่ 2026-10-02 เป็น Phase 1 ไม่ใช่ชุดนี้ ยังไม่ได้วัด performance, memory หรือ metrics ฟอนต์ไทยโดยตรง

## Slices และเกณฑ์ที่เหลือ

- [S11 #735](https://github.com/Slow-Inc/MangaDock/issues/735): เทียบเว็บ/native ที่มีข้อมูลจริง ตรวจ text scale, viewport/layout, navigation/filters/recommendations และ acceptance อุปกรณ์ ไม่ปิดงานจาก controller tests อย่างเดียว
- [S12 #736](https://github.com/Slow-Inc/MangaDock/issues/736): mutations รายการ native, ลบ/ล้าง/export ประวัติ และ refresh ข้ามอุปกรณ์/acceptance ภาพครบ มี read/save/resume flow เริ่มต้นแล้ว
- [S20 #744](https://github.com/Slow-Inc/MangaDock/issues/744): trending, author/profile และ navigation บทสนทนามังงะครบ, rich post/markdown parity และ acceptance บริการจริง/ภาพ มี feed/post read flow เริ่มต้นแล้ว ปัจจุบันเนื้อหาดิบแสดงด้วย native Text
- S13–S19: reviews/comments/reports, public profiles/follows, check-in, notifications, preferences/statistics, account recovery/linking/security และ Wallet history ยังเป็นงาน Phase 2 ถัดไป
- S21–S22: สร้าง/แก้/ลบ/upload post, replies/votes/reports และ Community SSE ที่ยืนยันตัวตนยังเป็นงานถัดไป
- Phase 3 S23–S28: Studio, publishing/earnings และ management ตาม role; S29 review การแทนผลิตภัณฑ์ครบ ยังเปิด gates Phase 1 ของ OAuth/captcha/TOTP/MIT/payment และ signed/physical beta เดิม

## Environment และทำต่อจากตรงนี้

`.env` ส่วนตัวปัจจุบันของ Mobile มีชื่อ config Backend แต่ขาด `EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` ส่วน `.env` local ของ Backend ไม่มี และ port 4001 ไม่พร้อม ณ checkpoint นี้ ไม่พิมพ์ values ไม่ย้าย/เขียนทับไฟล์ส่วนตัว และไม่ใส่ service-role credential ใน public variables ให้ตั้ง Mobile จาก [`.env.example`](../.env.example) ด้วย Backend เดิมที่เชื่อมต่อได้กับ key public anon/publishable ของ Supabase เก็บ secrets ของ Backend ใน environment ส่วนตัวของ Backend URLs/credentials ที่จำเป็นยังเป็นการตั้งค่าของผู้ใช้ ไม่อนุมานจากเวลาที่ผ่านไป

การพยายามเปิด Metro ด้วย smoke-test credentials ชั่วคราวถูก automatic approval review ปฏิเสธ โดยแจ้งเพียง “blocked by policy” ไม่ได้ลองใหม่ผ่าน launcher/env file อื่น Android source export ตามปกติสำเร็จโดยไม่ใช้ credentials เหล่านั้น ไม่มี process Metro/Backend สำหรับบริการจริงที่ agent เปิดเองเหลือรันอยู่

หลังตั้ง environments ส่วนตัว ให้รัน `npm.cmd run validate:env`, เปิด Backend เดิมแล้วรัน `npm.cmd run android` จาก Mobile เทียบ Home/hero/อ่านต่อ, releases ทั้งสี่แท็บ, หมวดหมู่/related, รายการส่วนตัวและ Community กับ Frontend ที่ viewport/text scale เดียวกัน ทดสอบ Back, sign-out, save failure/retry และ guarded Reader restoration จริง Capture ภาพ native/web จริงก่อนอ้าง visual parity แล้วทำเกณฑ์ slices ที่เหลือต่อโดยไม่สร้าง PRD/issues ซ้ำ [ADR 029](../../docs/adr/029-mobile-native-discovery-navigation-and-history.md)
<!-- lang:end -->
