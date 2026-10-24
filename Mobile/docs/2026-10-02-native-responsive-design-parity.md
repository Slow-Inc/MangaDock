# Native port of the existing mobile design

2026-10-03 follow-up: [Phase 2 ledger](2026-10-03-native-phase2-implementation.md) records Home/hero/Continue Reading, the original six navigation destinations, releases/categories/related and initial library/Community views. The new screens export successfully but have no emulator/web comparison yet. The screenshots below remain Phase 1 evidence.

ติดตามวันที่ 2026-10-03: [Ledger Phase 2](2026-10-03-native-phase2-implementation.md) บันทึก Home/hero/อ่านต่อ, navigation หกปลายทางเดิม, releases/หมวดหมู่/related และ views เริ่มต้นของรายการส่วนตัว/Community หน้าชุดใหม่ export สำเร็จแต่ยังไม่มีภาพเทียบ emulator/web ภาพด้านล่างยังเป็นหลักฐาน Phase 1

## EN

**Decision:** the user confirmed that native must reuse the existing responsive mobile design. Root [DESIGN.md](../../DESIGN.md) supplies tokens and identity; the actual mobile branches in Frontend supply layout, content order, and interactions. Port these to React Native components. This supersedes the temporary purple native visual shell, not the phased feature plan or API contracts.

| Native surface | Existing reference | Port in this pass |
| --- | --- | --- |
| App frame | `globals.css`, `Navbar.tsx`, `MangaDockLogo.tsx` | Deep Space background, 64dp top bar, original logo, account and amber balance controls |
| Search | `search/page.tsx`, `MangaGrid.tsx` | Stacked mobile search controls, white search CTA, two portrait-cover columns, 2:3 covers, 12dp horizontal / 24dp vertical gaps, compact metadata |
| Detail | `BookDetailModal.tsx` mobile branch | Centered 144dp cover, subdued blurred artwork, centered title/tags, white first-chapter CTA, synopsis and compact chapter rows with language/price |
| Sign in | `LoginModal.tsx` mobile branch | Dark sheet vocabulary, social providers before email, divider, compact inputs, blue sign-in CTA |
| Topup | `TopupModal.tsx`, `useTopupCreate.ts` | Amber balance/selection, the same six amount presets, custom amount, white QR panel and status/cancel actions |
| Reader | `MangaReader.tsx` | Black content canvas, compact page/chapter navigation, reading settings and translation options disclosed on demand |

**Coverage:** this pass changes Phase 1 presentation. Discovery/Home, categories, collections and Community stay in approved Phase 2; Studio/staff stay in Phase 3. The web's six-destination bottom navigation must be ported alongside those destinations, preserving the mobile order and labels. Do not replace it with newly invented native tabs or dead navigation buttons. A complete app-level visual-parity claim requires those later surfaces too.

**Native adaptations:** preserve safe areas, keyboard scrolling and minimum 44dp touch targets. Grid covers retain equal widths on an incomplete final row; wide screens use three columns. QR size fits narrow devices. Platform text scaling remains enabled. Android currently uses system font fallback, including Thai glyphs; an explicitly bundled Noto Sans Thai family, exact font metrics, blur/elevation matching and a full web-versus-native screenshot comparison remain acceptance work. No new runtime package was installed.

**Assets:** the original `Frontend/public/MangaDock.svg` is rasterized unchanged for native Image. Small UI glyphs are pre-rasterized vectors; no embedded SVG document or WebView. `node scripts/render-design-assets.cjs` regenerates assets with the Frontend's existing development-only `sharp`; native consumes the committed PNGs and never imports Frontend code.

**Evidence:** Mobile tests 88/88, typecheck and Android Hermes export passed (697 modules, 2.5MB). The already-installed emulator app rendered the new logo and sign-in layout after a developer-menu reload. [Previous native sign-in](screenshots/native-login-before.png) and [updated native sign-in](screenshots/native-login-after.png) are actual Android captures, not mockups. They do not prove pixel equality with the web reference.

The [native offline search capture](screenshots/native-search-offline.png) confirms the compact top bar/search layout and a readable connection error; a failed request does not display a successful zero-result count.

**Limits / resume:** real search reached `10.0.2.2:4001` but the Backend was unavailable. An agent-started Backend watch failed environment validation for `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` and was stopped; no Backend source or credentials were changed in this pass. Populated search/detail, wallet and Reader visuals still need a reachable configured Backend and their relevant account/captcha flows. The previously installed debug APK was used with updated JS; no new signed APK was built. Resume by configuring the existing Backend, reloading the debug app, then capturing each corresponding mobile web/native screen at the same width and text scale.

## TH

**การตัดสินใจ:** ผู้ใช้ยืนยันว่า native ต้องใช้ design responsive mobile เดิม [DESIGN.md](../../DESIGN.md) ให้ tokens และอัตลักษณ์ ส่วน mobile branches จริงใน Frontend ให้ layout ลำดับเนื้อหาและ interaction แปลงสิ่งเหล่านี้เป็น React Native แทน visual shell สีม่วงชั่วคราว โดยคงแผนแบ่ง phase และ API contracts เดิม

| หน้าจอ native | แหล่งอ้างอิงเดิม | สิ่งที่ port รอบนี้ |
| --- | --- | --- |
| กรอบแอป | `globals.css`, `Navbar.tsx`, `MangaDockLogo.tsx` | พื้นหลัง Deep Space, top bar 64dp, โลโก้เดิม, ปุ่มบัญชีและยอดเหรียญ amber |
| ค้นหา | `search/page.tsx`, `MangaGrid.tsx` | ช่องค้นหาเรียงแนวตั้งบนมือถือ, CTA สีขาว, ปกสองคอลัมน์สัดส่วน 2:3, ช่องว่างแนวนอน 12dp / แนวตั้ง 24dp, metadata กระชับ |
| รายละเอียด | mobile branch ของ `BookDetailModal.tsx` | ปกกลาง 144dp, ภาพพื้นหลัง blur จาง, ชื่อ/แท็กกลาง, CTA อ่านตอนแรกสีขาว, เรื่องย่อและแถวตอนกระชับพร้อมภาษา/ราคา |
| เข้าสู่ระบบ | mobile branch ของ `LoginModal.tsx` | รูปแบบ sheet สีเข้ม, social providers ก่อนอีเมล, divider, inputs กระชับ, CTA เข้าสู่ระบบสีน้ำเงิน |
| เติมเงิน | `TopupModal.tsx`, `useTopupCreate.ts` | ยอด/ตัวเลือกสี amber, presets หกจำนวนเดิม, จำนวนกำหนดเอง, กรอบ QR สีขาวและ actions สถานะ/ยกเลิก |
| Reader | `MangaReader.tsx` | canvas ดำ, navigation หน้า/ตอนกระชับ, เปิด settings การอ่านและตัวเลือกแปลเมื่อต้องใช้ |

**ขอบเขต:** รอบนี้ปรับการแสดงผล Phase 1 ส่วน Discovery/Home, หมวด, รายการส่วนตัว และ Community อยู่ Phase 2 ที่อนุมัติไว้; Studio/staff อยู่ Phase 3 ต้อง port bottom navigation หกปลายทางของเว็บพร้อมหน้าที่เกี่ยวข้อง โดยรักษาลำดับ/ชื่อ mobile เดิม ไม่แทนด้วย native tabs ที่คิดใหม่หรือปุ่มที่ไม่มีหน้าปลายทาง การอ้าง visual parity ทั้งแอปต้องมีหน้าภายหลังเหล่านี้ด้วย

**การปรับสำหรับ native:** รักษา safe areas, การเลื่อนเมื่อ keyboard เปิด และ touch targets อย่างน้อย 44dp ปกแถวสุดท้ายที่ไม่เต็มยังมีความกว้างเท่ากัน จอกว้างใช้สามคอลัมน์ QR ย่อให้พอดีเครื่องจอแคบ และยังเปิด platform text scaling อยู่ Android ใช้ system font fallback รวม glyph ไทยในตอนนี้; การ bundle Noto Sans Thai โดยตรง, metrics ฟอนต์ที่ตรง, blur/elevation และการเทียบ screenshot เว็บกับ native ครบทุกหน้าต้องตรวจตอน acceptance ไม่มี runtime package เพิ่ม

**Assets:** rasterize `Frontend/public/MangaDock.svg` เดิมโดยไม่เปลี่ยน artwork เพื่อใช้กับ native Image ไอคอนเล็กเป็น vector ที่ rasterize ไว้ ไม่ฝังเอกสาร SVG หรือ WebView สร้าง assets ใหม่ด้วย `node scripts/render-design-assets.cjs` โดยใช้ `sharp` ที่ Frontend มีอยู่เฉพาะตอนพัฒนา ส่วน native ใช้ PNG ใน repo และไม่ import โค้ด Frontend

**หลักฐาน:** Mobile tests 88/88, typecheck และ Android Hermes export ผ่าน (697 modules, 2.5MB) แอปที่ติดตั้งอยู่บน emulator render โลโก้และลำดับ Login ใหม่จริงหลัง reload ใน dev menu ภาพ [Login native ก่อนปรับ](screenshots/native-login-before.png) และ [หลังปรับ](screenshots/native-login-after.png) capture จาก Android จริง ไม่ใช่ mockup และไม่ได้พิสูจน์ว่าตรงกับเว็บทุก pixel

[ภาพค้นหา native ขณะ offline](screenshots/native-search-offline.png) ยืนยัน layout top bar/ค้นหากระชับและข้อความเชื่อมต่อผิดพลาดที่อ่านได้ โดยคำขอล้มเหลวไม่แสดงยอดศูนย์เรื่องเหมือนค้นหาสำเร็จ

**ข้อจำกัด / ทำต่อ:** การค้นหาจริงเรียก `10.0.2.2:4001` แต่ Backend ไม่พร้อม ตอน agent ลองเปิด Backend watch พบ environment validation ขาด `SUPABASE_URL` และ `SUPABASE_SERVICE_ROLE_KEY` จึงหยุด process ที่เปิดเอง ไม่แก้ source Backend หรือ credentials รอบนี้ ยังต้องตรวจภาพผลค้นหาที่มีข้อมูล/รายละเอียด Wallet และ Reader ด้วย Backend ที่ตั้งค่าและเข้าถึงได้ พร้อม flow บัญชี/captcha ที่เกี่ยวข้อง ใช้ debug APK ที่ติดตั้งก่อนแล้วโหลด JS ใหม่ ไม่ได้ build signed APK ใหม่ ทำต่อโดยตั้งค่า Backend เดิม reload debug app แล้ว capture หน้าเว็บ mobile/native ที่ตรงกันด้วยความกว้างและ text scale เดียวกัน
# 2026-10-04 implementation extension / การต่อ implementation

EN: The original references below remain authoritative. Native source now also covers collections/history/actions, reviews/comments/reports, profiles/banner/follows, account/security/activity/statistics, complete Community CRUD/replies/votes/live notices, Studio and existing staff actions. See [current feature/source mapping](2026-10-04-native-full-implementation.md). No new populated web/native capture is claimed; prior screenshots below retain their original limited scope. Staff adapts the existing desktop actions/tokens because current Frontend has no matching mobile management layout. Exact bundled font metrics, live device interactions and visual replacement acceptance remain open.

TH: ต้นแบบเดิมด้านล่างยังเป็นหลัก Source native เพิ่ม collections/history/actions รีวิว/ความคิดเห็น/รายงาน profiles/banner/follows บัญชี/security/activity/statistics Community CRUD/replies/votes/live notices ครบ Studio และ actions ทีมงานเดิม ดู [mapping ฟีเจอร์/source ปัจจุบัน](2026-10-04-native-full-implementation.md) ไม่อ้างภาพ populated web/native ใหม่ screenshots เดิมด้านล่างยังมีขอบเขตจำกัดเดิม ทีมงานแปลง actions/tokens desktop เพราะ Frontend ปัจจุบันไม่มี layout จัดการ mobile ที่ตรงกัน ยังเปิด font metrics interactions อุปกรณ์จริงและ visual replacement acceptance
