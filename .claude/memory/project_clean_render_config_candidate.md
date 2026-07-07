---
name: project_clean_render_config_candidate
description: config ที่ render Gal Yome EN p4 แล้วไม่มี overflow (bubble_area_fit OFF) — candidate ที่อาจดีกว่า production ต้อง A/B deterministic ก่อนใช้จริง
metadata: 
  node_type: memory
  type: project
  originSessionId: a585a091-2cbc-480b-bda9-3eefd1f2336f
---

**2026-07-04:** ตอน render Gal Yome EN page 4 (ds3) เทียบ config, พบว่า config ที่ **ไม่มี `bubble_area_fit`** render บับเบิลออกมา **ไม่ overflow เลย** (ต่างจาก production ที่เปิด `bubble_area_fit` แล้วบับเบิล acoustics ล้น) — user ให้บันทึกไว้เพราะอาจเป็น config ที่ดีกว่า.

**config ที่ render "ไม่มี defect" (= `image-1783122736297.jpg` / `2026-07-04-readable-floor-realpage.png`, ผ่าน direct `POST /translate/with-form/patches`):**
```json
{"render": {"clean_layout": true, "supersampling": 4, "font_size_minimum": -1},
 "detector": {"det_bubble": true, "detection_size": 2048},
 "translator": {"target_lang": "THA"}}
```
จุดต่างชี้ขาดจาก production = **ไม่มี `bubble_area_fit`** (production เปิด ON, ดู [[project_benchmark_e2e_flow]]).

**ทำไมอาจดี:** ไม่มี `bubble_area_fit` → ข้อความไม่โตเติมบับเบิล → ไม่ oversize/ล้นบับเบิลแคบ (defect overflow ที่ user เห็น).

**⚠️ อย่าเพิ่งเอาไป production ทันที — เป็น tradeoff ที่ต้องพิสูจน์:**
- `bubble_area_fit` ถูกเปิด ON **เพราะ**ตอนปิด dialogue EN เคย **เล็กมาก** (legacy length-ratio path) บนหน้าอื่น (memory [[project_benchmark_e2e_flow]]) → ปิดอาจแก้ overflow หน้านี้ แต่ regress dialogue เล็กหน้าอื่น.
- รูปที่เทียบยัง confounded (แปลคนละรอบ + หน้าเดียว) → ยังไม่พิสูจน์ว่าดีกว่าทั้ง chapter.

**How to apply:** ต้อง **deterministic A/B** (ตรึงคำแปล, render หน้าเดิม `bubble_area_fit ON vs OFF` + protected pages Gal Yome/One-Punch) ก่อนตัดสิน. ทางเลือกที่ควรเทียบด้วย = **`reference_layout:true`** (wired แล้วบน origin/main: config.py:193 + stages.py:84-85) — mask-aware sizing ที่ bound ข้อความในบับเบิล = เป้าหมายเดียวกับ "หยุด overflow" แต่ไม่ทำ dialogue เล็ก. อาจเป็นคำตอบที่ดีกว่าการปิด bubble_area_fit เฉยๆ. ผูกกับ MP2 P3 (mask-aware-sizing).
