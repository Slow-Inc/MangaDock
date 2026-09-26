# Frontend E2E Visual Survey (Playwright, production tunnel)

> ต่างจาก fragment อื่นที่ provenance = commit SHA — อันนี้เป็น**สถานะ UI จริงที่สังเกตได้เฉพาะตอนรัน**
> (design, layout, behavior, live translate output) provenance คือ **frontend commit ที่ deploy อยู่ตอน
> ทดสอบ + timestamp** ไม่ใช่ diff โค้ด รอบหน้าต้องรัน Playwright ซ้ำเสมอถ้าต้องการอัปเดต (ข้อมูลนี้
> re-observe ไม่ได้จาก git diff อย่างเดียว)

- **frontend_commit_at_test:** `efdf9c3c2b0874503e84b3d69568667f5c7d2c7f` (HEAD ของ `perf/mit-layout-fit-and-merge` ตอนทดสอบ)
- **tested_via:** `https://hayateotsu.space/` (cloudflared tunnel, ตาม frontend-testing skill — ไม่ใช่ localhost)
- **test_date:** 2026-07-04
- **screenshot location:** `.playwright-mcp/*.png` ใน repo root (untracked, ดู filename ต่อ flow ด้านล่าง)

---

### Flow 1: Homepage → Search → Book Detail Modal
- **screenshot:** `page-2026-07-04T07-34-58-186Z.png` (search results), modal capture inline
- **url:** `/search?q=Otome Game`
- **findings:**
  - Dark theme ทั้งเว็บ, navbar: โลโก้ MangaDock + nav (หน้าหลัก/อ่านต่อ/หนังสือทั้งหมด/รายการชื่นชอบ/คอมมูนิตี้/หมวดหมู่) + search icon + ปุ่ม "เข้าสู่ระบบ"
  - หน้า search มี filter chip ครบ: แหล่งข้อมูล, ภาษา (ทุกภาษา/ไทย/English/日本語), สถานะ, ปี (range), หมวดหมู่ (tag cloud 15+ ตัว) — filter UI ซับซ้อนกว่าที่คาด
  - **Book detail เปิดเป็น modal overlay** (ไม่ใช่ page navigation) — พื้นหลัง blur/dim, ตรงกับที่ agent สำรวจโค้ดพบว่า `/book/<id>` อ่านจาก `sessionStorage` (เข้าตรงไม่ได้ ต้องคลิกผ่าน UI)
  - Modal มี: ปก, ชื่อเรื่อง, ปี+tag, ปุ่ม CTA "ดูตอนทั้งหมด" + bookmark icon, คำอธิบาย (มีลิงก์ novel ต้นฉบับ), แถวปกแยกเล่ม, รายการตอนพร้อม flag ภาษา (EN/ไทย) ต่อตอน

### Flow 2: Chapter-locked state (real economy UX, ไม่ใช่แค่โค้ด)
- **findings:** เจอมังงะที่ตอนทั้งหมด**ล็อค** จริง — ปุ่มมี class `opacity-50 cursor-not-allowed` + label "ล็อค" ต่อท้ายชื่อตอน คลิกไม่ได้จริง (ไม่ใช่แค่ disabled attribute, ยืนยันด้วยการคลิกแล้วไม่มีอะไรเกิดขึ้น) — ตรงกับ Chapter Unlock economy ที่เอกสารอธิบายไว้ ควรใช้ screenshot นี้เป็นภาพประกอบ war-story เรื่อง unlock/wallet ได้เลย

### Flow 3: Reader — original vs translated comparison (สำคัญที่สุด)
- **manga:** Otome Game Sekai wa Mob ni Kibishii Sekai desu (Kyouwakoku-hen), ตอนที่ 1, หน้า 10/61
- **screenshots:** original = `page-2026-07-04T07-38-07-339Z.png`, translated = `page-2026-07-04T07-39-10-423Z.png`
- **findings:**
  - Reader UI: title bar ซ้ายบน, page counter "N / M" กลางบน, ขวาบน = quality badge "HD" + ตัวเลือกภาษาแปล + view-mode icon + zoom % + ปิด, thumbnail strip เลขหน้าล่างสุด, next/prev arrow ข้าง — คลิก 1 ใน 3 ของจอ (ซ้าย/ขวา) = เปลี่ยนหน้า
  - **หน้า 1 ของเล่มที่ทดสอบเป็นหน้าเครดิต scanlation group** ("APHRODITE SCANS" พร้อมลิงก์ Discord) — ยืนยันว่า source เป็น scanlation/MangaDex ตามที่เอกสาร positioning ระบุไว้ (demo data ไม่ใช่ licensed content)
  - กดปุ่ม "แปลหน้านี้" → toast แสดง**เวลานับถอยหลังจริง** ("กำลังแปลหน้า 10 · 16 วิ") พร้อมคำอธิบาย "กำลังโหลดโมเดล AI — หน้าแรกใช้เวลา ~1 นาที" — UX ที่ตั้งความคาดหวังให้ผู้ใช้ก่อนบอก error ดี
  - **แปลเสร็จใน ~45-60 วินาที** (cold model load) patch overlay ทับตำแหน่งเดิมถูกต้องทุกกล่อง (bubble-tagged, ไม่ใช่ whole-image) เทียบ layout ตรงกันแม่นยำ
  - **สังเกตข้อจำกัดที่เอกสารเคยบันทึกไว้แบบสดๆ**: narration/caption box บางกล่อง (เช่น "THIS SCUMBAG IS PLAYING INTENSE TRAUMAS...") ข้อความไทยที่ patch เข้าไปมีขนาดเล็กกว่ากล่องพูดปกติมาก อ่านยากกว่าที่ควร — ตรงกับ "font-floor ที่คำนวณจาก crop เล็ก" และ "EN-source wrap parity" ที่ research doc ระบุไว้เป็น known gap — **นี่คือหลักฐานภาพจริงของ known limitation ที่มีอยู่แล้ว เอาไปทำ before/after slide ได้ทันที**

### Flow 4: Community Forum
- **screenshot:** `page-2026-07-04T07-40-38-321Z.png`
- **findings:**
  - Layout: sidebar ซ้าย (ค้นหาโพสต์, Feeds: หน้าแรก/ยอดนิยม, Topics: ทั่วไป/ประกาศ/สปอยล์/อัปเดตมังงะ, Communities, กฎ 3 ข้อ) + feed หลัก + ปุ่ม "+ สร้างโพสต์ใหม่" มุมขวาบน + toggle มุมมอง grid/list + HOT/NEW sort
  - **เจอรูปโพสต์ที่พังจริง**: `naturalWidth: 0` ทั้งที่ `complete: true` (โหลดเสร็จแต่ภาพ broken ไม่ใช่แค่ lazy-load) — โพสต์ทดสอบของ admin "ทดสอบ R2" รูปที่ 1 เสีย ควรเช็คว่าเป็นไฟล์ทดสอบเก่าที่ลบไปแล้วหรือ bug จริงของ R2 pipeline (ไฟล์อื่นที่โหลดสำเร็จมี naturalWidth ปกติ เช่น 960, 352 — ยืนยันว่าไม่ใช่ปัญหา systemic)

### Flow 5: Simulations Hub — ยืนยันตรงกับโค้ด 100%
- **screenshot:** `page-2026-07-04T07-41-23-989Z.png`
- **findings:**
  - **ยืนยันภาพจริงตรงกับที่ agent อ่านโค้ดเจอเป๊ะ**: 9 domain (Cache Read 5, Cache Write 2, Translation 3, Authentication 3, Chapter Unlock 3, Real-Time SSE 2, Asset Serving 2, Upload 2, MIT ML Pipeline 3) = 25 scenario รวม — ตัวเลขในสไลด์ presentation-master-outline.md ถูกต้อง ไม่ต้องแก้
  - Design: flow diagram แบบ node-box + arrow (Request→L1 Memory→L2 Redis→L3 Disk→Supabase) สีบอกสถานะ (active=เหลือง), step counter, Play/prev/next, คำอธิบายสองภาษาใต้ diagram, legend สี, grid สรุปจำนวน scenario ต่อ domain ท้ายหน้า
  - เจอ sidebar เอกสารโชว์ root MD scratch files (dd2/dd3/ee/g3/gg/m2/m3/mm/modal-cta ฯลฯ) ที่ยืนยันไปแล้วว่าเป็น Playwright dump ไม่มีเนื้อหา — **ควรพิจารณาซ่อนจาก nav จริงเพื่อความเรียบร้อยของ docs hub ที่กรรมการอาจเปิดดู** (ไม่ใช่ bug แต่เป็น polish opportunity)

### Flow 6: Login Modal
- **findings:** modal 2 tab (เข้าสู่ระบบ/สมัครสมาชิก), split-pane — ซ้าย email/password form + "ลืมรหัสผ่าน?" + ปุ่ม login, ขวา OAuth (Google/Facebook) + ลิงก์ ToS/Privacy — ดีไซน์ตรงกับที่ agent อ่านโค้ด `AuthContext.tsx` เจอ (popup+postMessage OAuth flow)

---

## สรุปสำหรับใช้ในสไลด์/เล่มรายงาน

1. **screenshot ที่ดีที่สุดสำหรับสไลด์ #10 (Live demo)**: reader translated state (`page-2026-07-04T07-39-10-423Z.png`) — โชว์ patch overlay ทำงานจริง
2. **screenshot ที่ดีที่สุดสำหรับ "ข้อจำกัด" slide**: narration-box เล็ก ในภาพเดียวกัน — หลักฐานภาพจริงของ known gap ไม่ต้องพึ่งคำอธิบายลอยๆ
3. **screenshot ที่ดีที่สุดสำหรับสไลด์ Simulations Hub (#5)**: `page-2026-07-04T07-41-23-989Z.png` — ยืนยันตัวเลข 25 scenario/9 domain ตรงกับโค้ด
4. **Bug ใหม่ที่เจอ (ไม่ใช่แค่เพื่อสไลด์)**: รูปโพสต์ forum พังจริง 1 รูป — ควรเช็คว่าเป็น test data เก่าหรือ bug จริง ก่อนสอบ

## ที่ยังไม่ได้ทำ (ถ้าต้องการ coverage เพิ่ม)
- Studio page (ต้อง login ถึงจะเข้าได้ลึก — ยังไม่ได้ login ทดสอบ)
- Wallet/topup UI (ต้อง login)
- แปลทั้งตอน (SSE progress) — ทดสอบแค่ "แปลหน้านี้" (single POST) ไม่ได้ทดสอบ SSE progress bar ของการแปลทั้งเล่ม
- Mobile viewport (ทดสอบแค่ desktop 1536×~800 default)
