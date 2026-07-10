---
name: project-mit-175-dialogue-path
tags: ["project"]
description: #175 dialogue-too-small + ปาร์ตี้ล้น แก้แล้วด้วย bubble_area_fit(bounded)+display_sfx; One-Punch benchmark หลอกตา
metadata:
  type: project
---

#175 ("text ≪ bubble" + "ปาร์ตี้ ใหญ่ล้น") **แก้แล้ว** (2026-06-30, PR #433 branch `worktree-feat-mit-font-s1`).

**Root cause:** `resize_regions_to_font_size` มี 3 ทาง — clean_layout (#263) จัดเฉพาะ non-balloon/narration, bubble_fit (#166) เคยปิด (`MIT_BUBBLE_AREA_FIT=0`), dialogue balloon → legacy length-ratio → เล็กจิ๋วบน EN-source. และ `is_sfx` (det_sfx YOLO) **ตายแล้ว ไม่เคย set** → `sfx_rescued` (len(src)≤4 heuristic) เป็นตัวเดียวที่ทำให้ entered display regime [10,64] → in-bubble text ("DRINKING PARTY") โต ~64px ล้น.

**Fix:** (1) เปิด `MIT_BUBBLE_AREA_FIT=1` (.env + .env.example, ADR 023 supersede decision OFF เดิม) — dialogue เต็ม bubble ด้วย bounded binary-search-fit [8,16]×√MP + anti_overlap (S2 #430). (2) pure `display_sfx(sfx_rescued, is_sfx, has_bubble)` ใน render_overlap.py — region มี bubble_box = dialogue ไม่ใช่ display SFX; เฉพาะ free-floating (ไม่มี bubble) ถึงได้ [10,64]+cap-exempt (S3 #431). wire 3 จุดใน rendering/__init__.py (bubble-fit bounds, legacy cap, box-scale).

**Validation:** test_render_overlap.py 25 green; full MIT 458 passed 0 new fail; golden/guard byte-identical. E2E Reader (prod config): Gal Yome EN→TH p4 dialogue เต็ม; One-Punch JA→EN ไม่ regress (free SFX "GULP"/"NEH" ใหญ่ตามเดิม — has_bubble=False พิสูจน์ gate ถูก). **อย่าเชื่อ One-Punch benchmark อย่างเดียว — JP narration เข้า clean_layout เลยหลอกตา; ต้องเทียบ EN-dialogue ด้วยเสมอ.**

**Residual → S4/#432:**
1. **stylized in-bubble word** ที่ SFX YOLO แยกเป็น region ไม่ associate bubble (ไม่มี bubble_box) ยังโตกว่าเพื่อนได้ = detection/merge ไม่ใช่ sizing.
2. **narration wrap กว้าง (เปิด bubble_area_fit แล้ว regress):** top narration/caption ถูก segmentation ตีเป็น bubble ใหญ่ → เข้า Branch 1 (bubble-fit) → wrap ตามความกว้าง bubble (กว้าง) แทน clean_layout ที่ wrap ตาม footprint ต้นฉบับ (แคบ). A/B พิสูจน์: bfit OFF narration แคบ✅, bfit ON กว้าง❌. dialogue ปกติ.
   - **Discriminator (วัดจริง 2026-06-30, One-Punch + Gal Yome, debug `[#179dbg]` ที่ rendering/__init__.py:226):** อัตราส่วน `rw/bw` = (ความกว้าง text footprint region.xyxy) / (ความกว้าง bubble_box). **dialogue ที่ต้อง fill: rw/bw ≈ 0.88–0.90** (Gal "อะคูสติกส์" 284/323, "ไม่สนใจ" 524/584). **narration ที่ต้อง wrap แคบ: rw/bw ≈ 0.40–0.59** (OPM "WHAT SHOULD" 175/295, "THIS BRAT" 128/318). short dialogue (HUH 24/80=0.30, HMPH 31/80) ก็ rw/bw ต่ำ แต่ส่ง clean_layout ได้ (clean_wrap_width floor 11%=88px → บรรทัดเดียว).
   - **Fix ครั้งหน้า:** ใน Branch 1 (rendering/__init__.py:229) เพิ่มเงื่อนไข route ไป clean_layout เมื่อ `rw/bw < ~0.72` (text ไม่เต็มความกว้าง bubble = narration/caption/short). threshold tuned จาก 2 หน้า — re-verify เพิ่ม. ("ปาร์ตี้" occ=3 ไม่ sole-occupant ไม่เข้า Branch 1 อยู่แล้ว.) **อย่า route Gal dialogue ไป clean_layout** (จะกลับไปเล็กเพราะ clean_layout ใช้ fixed font ไม่ fill).
3. **"อ้างอิง original line-break" ทำงานแค่ JP-source (ยืนยันโค้ด 2026-06-30):** กลไก = `_clean_layout_dst` (rendering/__init__.py:187) `wrap_w = clean_wrap_width(x2f-x1f, img_w)` คือ wrap ตาม **ความกว้าง bbox ของ source region**. JP source = แนวตั้ง → bbox แคบ → คอลัมน์แคบตรง original ✅. **EN source = แนวนอน → bbox กว้าง → wrap กว้าง ไม่ตรง original ❌**. bubble_fit path ก็ wrap ตาม bubble width (fill) ไม่ใช่ line-break original. → กลไกอ้างอิง "ความกว้างกล่อง" ไม่ใช่ "โครงสร้างบรรทัดจริง" บังเอิญตรงเฉพาะ JP แนวตั้ง. **Fix:** EN-source ต้องใช้ source line-structure (จำนวนบรรทัด/median line-width ของ original) แทน bbox width รวม; หรือ derive narrow column จาก source height/aspect. กระทบทุกการแปลจาก EN-source.

**Test data:** Gal Yome EN version = chapter `78e4caf1` (30 หน้า); Thai version = `a81eccd7` (29 หน้า). เลือก version จาก **BookDetailModal → filter chip "EN"** ใต้ "ตอนทั้งหมด" (ไม่ใช่ปุ่ม target lang). patch `ANY__THA__...` = source auto→Thai.

related: [[project-render-knob-gating]] [[project-mit-translate-nondeterministic]]
