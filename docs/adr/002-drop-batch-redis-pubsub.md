# ADR 002 — Drop the batch-translate Redis pub/sub (single-node)

**Status:** Accepted  
**Date:** 2026-06-14  
**Context:** #228 / #234 (MitBatchOrchestrator decomposition, sub-seam S5a)

---

## Context

batch MIT translation (full-chapter) fan-out ภายใน `BooksService` มี `redis.publish` 2 จุด —
ใน `handleMitCallback` (webhook path) และใน `notify` closure ของ `startOrAttachBatchJob`
(stream path) — เพื่อ broadcast แต่ละหน้าที่แปลเสร็จไปยัง channel `translate:<jobKey>`
ตั้งใจไว้สำหรับ **cross-instance fan-out** (horizontal scale: latecomer ที่ต่อมาอีก instance
จะรับ page ผ่าน Redis)

ปัญหา:

1. **ไม่มีใคร subscribe จริง** — subscribe side เป็น no-op: `const unsubscribeRedis = (() => {})`.
   publish จึงยิงเข้า channel ที่ไม่มี subscriber บนเครื่องเดียวกัน
2. **Deployment เป็น single-node** — original caller ถูกส่งตรงผ่าน `job.originalListener`,
   latecomer บน instance เดียวกันผ่าน `job.listeners` Set ทั้งสองทางไม่พึ่ง Redis เลย
3. **Publish 2 จุด semantics ไม่ตรงกัน** — webhook ใช้ `await redis.publish` + error-log เมื่อ
   ได้ `false`; stream ใช้ `void redis.publish` (fire-and-forget) = drift
4. **Test ค้ำ feature ตาย** — `books-pubsub-batch.spec.ts` ทดสอบ Redis pub/sub และเป็น
   **16 baseline failures** ที่ค้างมานาน (Redis/timing flaky, ~57s)

Deletion test: ลบ publish ทั้งสอง + no-op ออก → behavior บน single-node **identical**
(การส่ง page ทั้งหมดผ่าน listener ตรง ไม่มี path ไหนพึ่ง Redis) ⇒ เป็น dead path

## Decision

ลบ batch-translate Redis pub/sub ออกทั้งหมด:

- ลบ `redis.publish` ทั้ง 2 จุด + `unsubscribeRedis` no-op + การเรียกใน `finally`
- ลบ `@Optional() redis: RedisService` constructor param + import ออกจาก `BooksService`
  (ไม่มี usage อื่นเหลือ)
- ลบ `books-pubsub-batch.spec.ts` (ทดสอบ feature ที่ถูกลบ)

**ขอบเขต:** ลบเฉพาะ batch pub/sub `RedisService` **ยังเป็น provider** (จาก `CacheModule`)
ที่ cache layer และ module อื่นใช้อยู่ — ไม่แตะ

**เงื่อนไขกลับทิศ:** เมื่อใดต้อง scale เป็น multi-node ให้ re-introduce subscriber **จริง**
(ไม่ใช่ no-op) พร้อม multi-node integration test — ไม่ใช่แค่เปิด publish กลับ

## Consequences

**ดี:**
- baseline test เหลือ **0 fail** (จาก 16), suite เร็วขึ้น ~63s → ~13s
- batch fan-out path ง่ายลง ไม่มี dead path / dual publish semantics
- เปิดทาง S5b (`deliver()` sink) ที่ไม่ต้อง model Redis ในการรวม fan-out

**ต้องระวัง:**
- single-node assumption ชัดเจนขึ้น — บน multi-node ตอนนี้ latecomer ข้าม instance จะไม่ได้
  page (ไม่ใช่ regression: เดิม subscribe เป็น no-op อยู่แล้ว ก็ไม่เคยได้)
- coverage บางส่วนของ replay-on-attach / latecomer fan-out ที่อยู่ใน pubsub spec ถูกลบไป →
  จะ re-cover ใน **S5e** (`MitBatchOrchestrator` spec ตาม #234 AC: replay-on-attach,
  complete-via-stream, complete-via-webhook)

**ไม่เปลี่ยน:**
- single-node behavior byte-identical — characterization net (batch-registry / batch-cancel /
  progress / batch-webhook / retry) เขียวครบหลังลบ
- SSE batch endpoint + MIT webhook controller behavior ไม่เปลี่ยน
- `RedisService` ยังถูกใช้ใน cache layer (`CacheOrchestratorService`)
