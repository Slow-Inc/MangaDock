---
name: feedback-benchmark-patch-not-image-endpoint
tags: ["feedback"]
description: Benchmark MIT render via /translate/with-form/patches (production path), NEVER /translate/with-form/image — the image endpoint does not tag speech bubbles, so bubble/sizing conclusions from it are artifacts
metadata:
  type: feedback
---

เวลา benchmark คุณภาพการ render ของ MIT (bubble fill, font sizing, overflow, under-fill) ให้ยิงผ่าน **`POST /translate/with-form/patches`** (path ที่ Backend production ใช้จริง) แล้ว composite patches ที่ได้กลับลงภาพต้นฉบับ — **ห้ามใช้ `POST /translate/with-form/image`** สำหรับอะไรที่เกี่ยวกับ bubble/ขนาด

**Why:** `/translate/with-form/image` → `get_ctx` → full-page `translate()` ซึ่ง **ไม่เคยเรียก `_tag_regions_with_bubbles`** (call site เดียวอยู่ใน `translate_patches` เท่านั้น). ผลคือทุก region ได้ `has_bubble=False` → dialogue ในบับเบิลถูกปฏิบัติเป็น narration → เห็น under-fill/oversize ที่**ไม่ใช่พฤติกรรม production**. 2026-07-02 เสีย effort ทั้ง session ไล่แก้ "Thai under-fill" + "detection-bound" ที่จริงเป็น artifact ของ endpoint นี้ล้วนๆ. บน patch path จริง det_bubble_seg tag บับเบิลครบ (4 balloons 3/3; 5 balloons 3/6) และ dialogue **fill บับเบิลปกติ**.

**How to apply:**
- patch JSON = `{img_width, img_height, patches:[{x,y,w,h,img_b64}]}`; composite = paste `img_b64` (PNG RGBA) ที่ `(x,y)` ลงภาพเดิม (เปิดไฟล์ JSON ด้วย `encoding='utf-8'`).
- ยืนยัน bubble tagging จาก log `[BubbleSeg] N balloons, X/Y regions tagged (+Z classical-fallback)` — ถ้าไม่เห็น line นี้ = ยิงผิด endpoint หรือ det_bubble_seg ปิด.
- ก่อนสรุปว่า defect "จริง" ต้องเห็นบน patch path; ผลจาก image endpoint ใช้ verify wiring ได้อย่างเดียว ไม่ใช่คุณภาพ.

เกี่ยวข้อง: [[project-benchmark-e2e-flow]] · [[project-render-knob-gating]] · [[project-mit-175-dialogue-path]] · [[feedback-verify-before-claiming]] · [[project-mit-translate-nondeterministic]]
