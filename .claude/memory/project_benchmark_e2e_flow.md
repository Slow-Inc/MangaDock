---
name: project_benchmark_e2e_flow
description: How to run the One-Punch benchmark E2E (full-stack tunnel Reader + direct render) and its cache gotcha
metadata:
  type: project
---

วิธีรัน benchmark E2E (หน้า One-Punch ぬ-SFX = หน้าที่ MangaTranslator target `MIT/example_translation.jpg` แปล; source JP = `MangaTranslator/docs/images/example_original.jpg`):

**Full stack:** restart MIT worker บนโค้ดใหม่ (kill 5003+5004 by port owner ตาม [[project_mit_worker_restart_gotcha]]) → Backend :4001 → Frontend :4000 → cloudflared tunnel (`cloudflared tunnel run`, config `~/.cloudflared/config.yml`) → domain **`hayateotsu.space`** (→:4000), `api.hayateotsu.space` (→:4001).

**Reader path (Playwright ผ่าน tunnel domain — ห้าม localhost):** เปิด `https://hayateotsu.space` → ค้นหา "One-Punch" → การ์ด "One Punch-Man" (เปิด quick-view modal) → ปุ่ม **"อ่านตอนที่ Benchmark"** (ทีมตั้ง chapter 1-หน้าไว้แล้ว) → reader เปิดเป็น **overlay** (URL ไม่เปลี่ยน, ไม่ต้อง login) → toggle **"แปล → TH"** = dropdown → เลือก **→ EN** (ให้ตรง target อังกฤษ) → **"แปลหน้านี้"** → ~50s.

**Cache gotcha:** ถ้าหน้าแปลแล้ว (cached) toggle จะโชว์ "ดูฉบับแปล" ของเก่า **ไม่ re-translate** แม้ `npm run cache:reset` (มักลบ 0 patch) — frontend in-memory + browser cache ค้างหลายชั้น. ทางลัดที่ชี้ขาดกว่า: **direct render** `POST http://127.0.0.1:5003/translate/with-form/image` (image + config JSON) บน worker จริง = pipeline เดียวกับ Reader, เลี่ยง auth/cache ([[project_mit_launch_env]]). ใช้ direct render สำหรับ subtle/SFX changes, full Reader สำหรับ proof flow ทั้งระบบ.

**Knobs (Backend `.env`, live/gitignored)** — winning render config ที่ตรง target (2026-06-13): `MIT_EN_FONT=anime_ace_3.ttf` (เบากว่า comic shanns 2) · `MIT_BUBBLE_AREA_FIT` **OFF** (fill-balloon ทำ dialogue ใหญ่/ทับ) · `MIT_ANTI_OVERLAP=1` (clamp box vs neighbours กันทับ) · `MIT_FONT_SIZE_MAX=20` (cap narration/caption non-SFX กันล้น panel; SFX ยกเว้น) · `MIT_SUPERSAMPLING=4` · `MIT_PATCH_FEATHER=16`(#173) · `MIT_INPAINT_CONTEXT_PAD=256`(#249) · `MIT_SFX_DETECTOR=1`+`MIT_OCR_VLM_RESCUE=1`(#168) ; det/inpaint size ไม่ pin → #247 2560/2048. Rolling ctx(#159)=`MIT_CONTEXT_PAGES`>0 (batch only).

**⚠️ Cache-key bug:** translation cache key (`translate:manga-patches:v6:ver:<id>:<page>:<src>:<tgt>:default:hd`) **ไม่รวม render config** → เปลี่ยน .env knob ไม่ bust cache (เสิร์ฟผลเก่า). `npm run cache:reset` ก็ลบไม่ครบ (พลาด HD entry). ทางลัด: ลบ L3 file ตรงๆ `Backend/.cache/translate_manga-patches_..._<id>_..._hd.json` + `uploads/patches/*<id>*` แล้ว restart backend (เคลียร์ L1) ก่อน re-translate. ควร file issue ให้ใส่ config-hash ใน cache key.
