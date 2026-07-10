---
name: frontend-testing
description: Test/verify the MangaDock frontend in a real browser with Playwright, always through https://hayateotsu.space/ (cloudflared tunnel), never localhost. Use when asked to test, verify, screenshot, or drive the frontend/Reader UI, or to reproduce a UI bug end-to-end.
---

# MangaDock Frontend Testing (Playwright via Production Tunnel)

## กฎหลัก

**เปิดผ่าน `https://hayateotsu.space/` เสมอ — ห้ามใช้ localhost:4000**
ทีมพัฒนาโดยรัน cloudflared tunnel ตลอด (`cloudflared tunnel run`) ดังนั้น tunnel คือสภาพแวดล้อมที่ใกล้ production ที่สุด (Cloudflare cache/headers/proxy มีผลจริง — เคยจับบั๊กที่ localhost ไม่แสดงอาการมาแล้ว)

## Pre-flight (เช็คก่อนเริ่มทุกครั้ง)

```powershell
Invoke-RestMethod http://localhost:4001/books/translate/mit-health   # backend ขึ้น + เห็น MIT
Invoke-WebRequest http://localhost:5003/ready -SkipHttpErrorCheck    # 200=พร้อม, 503 starting=โหลดโมเดล, 503 workers_unreachable=worker ตาย
Invoke-WebRequest https://hayateotsu.space/ -Method Head             # tunnel มีชีวิต
```
- tunnel ล่ม → บอก user ให้รัน `cloudflared tunnel run` (ห้าม fallback ไป localhost เงียบๆ)
- MIT ล่ม → สตาร์ทจาก `MIT/`: `.\.venv\Scripts\python.exe -u server/main.py --host 0.0.0.0 --port 5003 --use-gpu --start-instance` (เช็ค commit memory ว่าง ≥15GB ก่อน — ดู memory ทีม)

## Navigation gotchas

- **ห้ามเปิด `/book/<id>` ตรงๆ** — หน้านี้อ่าน `sessionStorage["mb:book:<id>"]` จะเจอ "ไม่พบข้อมูลหนังสือ" ต้องคลิกผ่าน UI: หน้าแรก → "Top 10 หนังสือที่น่าอ่านวันนี้" / "มังงะยอดนิยม" / ช่องค้นหา
- เปิดตอน: คลิกปุ่ม "ตอนที่ N ..." → รอข้อความ "กำลังโหลดหน้ามังงะ..." หาย
- เปลี่ยนหน้าใน Reader: ปุ่ม "หน้าถัดไป" (มี 2 ตัว ใช้ตัวสุดท้ายใน DOM); ตัวนับรูปแบบ `"10 / 18"`. กระโดดหน้า: แถบเลขล่าง (`button` ที่ `textContent` ตรง `'4'`) — **แต่เริ่มที่ 2** (หน้าปัจจุบันไม่มีปุ่ม); ย้อนหน้า 1 ใช้ปุ่ม `aria-label="หน้าก่อนหน้า"`
- ปุ่มแปล: เมนูแปล → "แปลหน้านี้" (POST เดี่ยว ไม่มี SSE) / "แปลทั้งตอน" (SSE + progress) / "หยุดแปล"
- หา element ด้วยข้อความไทยผ่าน `browser_evaluate` ทนกว่า ref ที่เปลี่ยนทุก snapshot:
  `[...document.querySelectorAll('button')].find(b => b.textContent?.includes('แปลทั้งตอน'))`

### Recipe: เปิดมังงะ → แปล → ตรวจ (ผ่าน playwright, ใช้ได้จริง 2026-06-08)

คลิกอาจโดน strict-mode (เจอหลาย element) หรือ "not visible" → **ใช้ `browser_evaluate` คลิกตัวที่ `offsetParent!==null` เองทนกว่า**

```js
// 1. ค้นหา (search bar อยู่หน้าไหนก็ได้)
//    type → input[placeholder="ค้นหาหนังสือ..."]  submit:true → ไป /search?q=...
// 2. ผลค้นหาเป็น card (ไม่ใช่ <a href="/book">) — คลิก div การ์ด:
document.querySelector('div.group.flex.flex-col.gap-2.text-left').click();   // เปิด BookDetailModal
// 3. ใน modal กดอ่านตอน (ปุ่ม CTA ตัวใหญ่อาจ not-visible → เลือกตัวที่เห็น):
[...document.querySelectorAll('button')].find(b => /อ่านตอนที่\s*1/.test(b.textContent||'') && b.offsetParent!==null).click();
// 4. รอ reader: wait_for textGone "กำลังโหลดหน้ามังงะ"; ยืนยันด้วยตัวนับ body.match(/\b\d+\s*\/\s*\d+\b/)
// 5. แปลหน้าปัจจุบัน:
[...document.querySelectorAll('button')].find(b => /^แปลหน้านี้/.test((b.textContent||'').trim()) && b.offsetParent!==null).click();
```
- Reader เปิดเป็น **overlay** — URL ยังเป็น `/search?q=...` (ไม่เปลี่ยน) อย่าใช้ URL ตัดสินว่า reader เปิดแล้ว ใช้ตัวนับ `N / M` แทน
- รอแปลเสร็จ: **อย่า `Start-Sleep` ยาว** (harness บล็อก) — poll backend log ด้วย bash until-loop หา `[MangaPatches] ... page=<idx> → N patches` (idx = หน้า−1)

## เปรียบเทียบ original ↔ ฉบับแปล (test dimension ที่ขาดบ่อย — **บังคับทำ**)

การแปล "ไม่ error" ไม่ได้แปลว่าถูก — **ต้องเทียบ layout/ตำแหน่ง/เนื้อหากับหน้า original เสมอ** (บั๊ก stale-cache 2026-06-08 จับได้เพราะ user เทียบ original↔แปลแล้วเห็นกล่องบนเพี้ยน ไม่ใช่เพราะ log)

- **original (untranslated):** ดู reader ก่อนกดแปล หรือกดปุ่ม "ต้นฉบับ" สลับกลับ — จำ layout (จำนวนกล่อง, ตำแหน่ง, ขนาดสัมพัทธ์)
- **เทียบ:** จำนวน patch ตรงจำนวนบับเบิล/กล่องจริงไหม · แต่ละ patch อยู่ตรงกล่องที่ถูกต้องไหม · ข้อความตรงกล่องตรงความหมายไหม · มี patch ซ้อน/หาย/เพี้ยนขนาดไหม
- screenshot ทั้งสองสถานะแล้วดูด้วยตา — เลขอย่างเดียวไม่พอ (วัด `getBoundingClientRect()` + **`naturalWidth/Height`** ของ overlay ทุกตัว ดู §ถัดไป)

## ตรวจ patch overlay ของการแปล

- overlay = `img[aria-hidden]` ที่ `src` มี `/patches/` — อ่าน rect ด้วย `getBoundingClientRect()`
- **ชื่อไฟล์ patch ซ้ำเดิมทุกการแปล + `max-age=14400`** → browser/CF อาจโชว์ patch เก่าค้าง; force fresh: set `img.src = src.split('?')[0] + '?r=' + Date.now()`
- **วิธีจับ stale-cache (พิสูจน์แล้ว 2026-06-08):** ถ้า overlay ดูเพี้ยน ให้เทียบ **`naturalHeight` ที่ browser โหลด (ของเก่า) vs `naturalHeight` ของไฟล์จริงบน disk** (โหลด `new Image()` ด้วย `?bust=`+เวลา). ต่างกัน = browser cache ของเก่าค้าง ไม่ใช่บั๊กการแปล. เคส #170: r0 browser โชว์ natH=1492 (แถบเก่า) แต่ disk = 587 (bubble ใหม่) → bubble-seg ถูก, แค่ cache เก่าค้าง.
  - สาเหตุราก: `p.url` ของ patch overlay (`MangaReader.tsx`) **ไม่มี cache-bust param** → re-translate ที่เปลี่ยน geometry แต่ชื่อไฟล์เดิม = client เห็นของเก่าถึง 4 ชม. fix จริง = เติม `?v=<mtime/hash>` ตอนสร้าง url
- ถ้าเคย set `style.visibility='hidden'` เพื่อถ่าย before/after ต้อง restore เสมอ (เคยพลาดมาแล้ว)

## ล้าง cache การแปลให้สะอาดจริง (3 ชั้น + browser)

1. ลบไฟล์: `Backend/uploads/patches/<chapterId>/*.png`
2. ลบ L3: `Backend/.cache/*manga-patches*.json`
3. restart backend (ล้าง L1 in-memory): kill PID ที่ฟัง :4001 → `node --enable-source-maps dist\main` จาก `Backend/` (แก้โค้ด backend ต้อง `npm run build` ก่อน — มันรัน dist ไม่ใช่ watch)
4. browser cache ของ patch URL — bust ตามหัวข้อบน

## Test data ที่ใช้ประจำ

- มังงะทดสอบ: **Otome Game Sekai wa Mob ni Kibishii Sekai desu** (อยู่ Top 10 อันดับ ~3)
- ตอนที่ 2 "Towards Determination" = chapter `3f6eb04c-eae4-49ba-8cd5-281bf81f0818` (18 หน้า; หน้า 10 = index 9 คือหน้าที่ใช้สืบสวนบั๊กโทนสี #156)
- **Kouchuugun Shikan Boukensha ni Naru** ตอน 1 "Emergency Landing" = chapter `083f60ad-4bb1-4888-b2d0-0f92811e2984` (38 หน้า; ค้นด้วย "Kouchuugun"). หน้า 1/4/5 = caption-box เยอะ → reference สำหรับ bubble-seg #170 / scattered-clump. หน้า 1 (English→Thai): bubble-seg off = 2 patch แถบยักษ์ (451×1489, 649×1492), on = 7 patch อันละกล่อง (aspect 0.67–0.86)
