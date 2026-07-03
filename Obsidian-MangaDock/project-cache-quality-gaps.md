---
name: project-cache-quality-gaps
tags: ["project"]
description: Known quality gaps in the Multi-Layer Cache implementation — areas not yet covered that should be addressed before production
metadata: 
  node_type: memory
  type: project
  originSessionId: 0336d311-4db8-40cb-b407-e2515ced7e24
---

จุดอ่อนที่รู้ตัวหลังจบ Phase 2.4–2.5 (2026-05-29):

## 1. Redis service under-tested
`redis.service.spec.ts` มีแค่ 3 tests สำหรับ service ที่เป็น backbone ทั้งระบบ
**Why:** เราโฟกัสที่ layer สูงกว่า (orchestrator, recovery) แต่ข้าม base layer
**How to apply:** ถ้าจะเพิ่ม test ให้ cache ให้เริ่มที่ `redis.service.spec.ts` ก่อน — เพิ่ม tests สำหรับ `get`, `set`, `llen`, `scard`, reconnect behavior

## 2. ไม่มี integration test กับ Redis จริง
ทุก test mock Redis, L3, Supabase หมด — ถ้า Redis client มีพฤติกรรมแปลกๆ กับ key จริง (encoding, TTL edge cases, pipeline ordering) tests จะไม่จับได้
**Why:** ไม่มี test Redis instance ใน environment
**How to apply:** ถ้า setup test environment ได้ ควรมี `*.integration.spec.ts` อย่างน้อยสำหรับ `BatchSyncWorker` และ `CatastrophicRecoveryService`

## 3. `onReconnect` bug ผ่าน code review รอบแรก
fire-once callback ไม่ unregister — ถูกจับโดย `/scrutinize` ทีหลัง ไม่ใช่ตอน implementation
**Why:** stateful callback ที่มี side effect ข้ามรอบยาก reason about
**How to apply:** ทุกครั้งที่ register callback/listener ต้องถามตัวเองว่า "มี unregister ไหม?" และเขียน test สำหรับ second-call ด้วยเสมอ

## 4. Branch strategy — commit ตรง main
หลายครั้งที่ commit ตรง `main` แทน feature branch ทำให้ต้องสร้าง review branch ย้อนหลัง + conflict ตอน merge
**Why:** workflow ไม่มี discipline ชัดเจน
**How to apply:** ทุก task ที่มี Gemini review → branch ตั้งแต่ต้น → PR → merge เท่านั้น

## 5. Dead-letter ยังไม่มี ops runbook
`cache:dead_letter` inspectable ด้วย `SMEMBERS`, re-queue ด้วย `SMOVE cache:dead_letter cache:dirty <key>` แต่ยังไม่มีเอกสารที่ ops จะหาเจอตอน incident
**Why:** ออก scope ตอน implement
**How to apply:** ถ้าระบบ go production ควรเขียน runbook entry ก่อน launch
