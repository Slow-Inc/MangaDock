---
name: project-dev-commit-memory
description: เครื่อง dev commit memory ตึง — Qwen3 โหลดไม่ขึ้น (OSError 1455) ถ้าไม่ปิดโปรแกรมอื่นก่อน
metadata:
  type: project
---

เครื่อง dev หลัก (RAM 47.7GB + pagefile 28GB = commit limit ~76GB) ปกติมี commit charge ~60GB+ จากโปรแกรมพื้นหลัง (Discord/WSL/browser/Code/node) — ตอน MIT โหลด Qwen3.5-4B อาจชน limit → `OSError 1455 (paging file too small)` ที่ `safe_open` แล้ว worker process ตายเงียบ

อาการที่เห็นจากภายนอก: VRAM พุ่ง ~11GB แล้วตกเหลือ 1-2GB ทันที, batch translate "เสร็จ" เร็วผิดปกติ (~2s/หน้า) โดยทุกหน้า error "Translation service is starting up"

**Why:** incident 2026-06-06 — batch 20 หน้าเสร็จใน 40s แต่ไม่มีคำแปล root cause คือ worker ตายตั้งแต่โหลด translation model แต่ทุก layer (MIT batch loop → backend webhook → frontend) รายงานเป็น success

**How to apply:** ก่อนทดสอบ translator features เช็ค commit memory ว่าง (ควร >15GB ก่อนสตาร์ท MIT) — ปิด WSL (`wsl --shutdown`) / Discord ถ้าจำเป็น; `/ready` ของ MIT ตอนนี้ probe worker `/health` จริงแล้ว: 503 `workers_unreachable` = worker ตาย, 503 `starting` = ยังโหลดอยู่
