---
name: project-render-parity-direction
tags: ["project"]
description: ทิศทางที่ตัดสินแล้ว (2026-06-08) ให้ MIT render เหมือน MangaTranslator — narrow-column + supersampling + vertical จริง + SFX
metadata:
  type: project
---

User เทียบผลแปลของเรากับ meangrinch/MangaTranslator (หน้า benchmark One Punch-Man `ver:752fc515...`, JA→EN) แล้วตัดสินทิศทางปิด gap (2026-06-08):

1. **Line-break = narrow-column เหมือนเขา** — เลิก wrap ตาม bbox กว้างของ balloon, ไป wrap ตาม **safe interior ที่วัดจาก mask จริง** (distanceTransform + ray-cast, แบบ `calculate_centroid_expansion_box`) ให้อังกฤษ reflow เป็นคอลัมน์แคบตามรอยต้นฉบับญี่ปุ่น = ดูเป็นมังงะ **นี่คือรากของปัญหา "ดูเป็นย่อหน้า"** ไม่ใช่ขนาดฟอนต์
2. **Supersampling 4× เหมือนเขา** — render ที่ความละเอียดสูงแล้ว downscale (เขา max_font 16px + 4× → perceived size คุมได้, ขอบนุ่ม). เราตอนนี้ 1× + cap `h×0.5`→40-50px = ดูยักษ์ ทิศทาง: เพิ่ม supersampling ไม่ใช่แค่ cap 24
3. **Vertical แบบมังงะจริง** — ไม่ใช่ "คอลัมน์แคบแนวนอน" เฉยๆ แต่ stack ตัวอักษรแนวตั้งจริง (`_build_vertical_layout`) เมื่อ region สูงแคบ (aspect≥1.6, คำสั้น)
4. **SFX detector (#168) เอา** — AnimeText YOLO (`deepghs/AnimeText_yolo` ~400MB) opt-in ได้ เพราะ **VRAM เหลือ: เครื่อง dev ใช้ 5GB สูงสุด 7GB จาก 12GB** (มี headroom พอโหลด model ที่ 2)

**Why:** เห็น MangaTranslator คือ "as close to a human translator as possible" ([[project-translation-northstar]]) จริง — narrow-column + supersampling + vertical คือสิ่งที่ทำให้ของเขาดูเป็นมังงะ ของเราดูเป็น novel

**How to apply:** key insight = "wrap ตามอะไร สำคัญกว่าขนาดฟอนต์". ลำดับ: cheap wins ก่อน (cap size, center padding, wire #168 SFX) แล้วตามด้วยตัวโครงสร้าง (mask-aware narrow wrap + supersampling + vertical). มี doc ชำแหละเต็มกำลังทำที่ `docs/research/` (workflow translator-deep-dissection). เชื่อมกับ [[project-mangatranslator-study]]
