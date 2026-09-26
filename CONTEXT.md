<!-- lang:en -->
# MangaDock System Context

## Language

> **Canonical glossary = `UBIQUITOUS_LANGUAGE.md`** (root). The terms below are a local quick-reference for this document; if they ever disagree, `UBIQUITOUS_LANGUAGE.md` wins.

**L1 Cache**:
In-process cache optimized for latency — backed by `JsonCacheService` (in-memory + disk). Fast because no network hop. Warm-start optimization only; not authoritative for durability.
_Avoid_: local cache, memory cache, JSON cache

**L2 Cache**:
Distributed Redis cache — source of truth at runtime. Enables horizontal scaling by giving all nodes a shared view of data. Not the long-term authority; Supabase is.
_Avoid_: Redis cache, distributed cache, remote cache

**Dirty Key**:
A cache key that has been written to L1 + L2 but not yet persisted to Supabase. The term refers strictly to the persistence gap to the DB — not to any L1↔L2 inconsistency.
_Avoid_: stale key, unsynced key, pending key

**Dirty Queue** (`cache:dirty`):
The ordered backlog of Dirty Keys waiting for the Leader to flush to Supabase. A non-empty queue after a flush cycle is a warning signal, not a normal state.
_Avoid_: sync queue, work queue, flush queue

**Leader**:
The single node in the cluster permitted to flush the Dirty Queue to Supabase. Enforced by a Redis NX distributed lock. Exists to prevent concurrent Supabase writes (double-write, race conditions).
_Avoid_: master, primary, coordinator

**L3 Cache**:
Per-node JSON disk storage (`JsonCacheService` disk layer). Acts as (1) a local backup of L2 in case Redis is unavailable and (2) a batch buffer the Leader reads from before writing to Supabase. Each node writes its own L3 periodically from L2 at data-type-specific intervals. The Leader does one extra L2→L3 re-sync immediately before the Supabase write to ensure freshness.
_Avoid_: JSON cache, disk cache, file cache, L1 disk

**Write-behind**:
The pattern where data is written to L1 + L2 immediately (synchronous) and persisted to Supabase asynchronously by the Leader via L3. The durability window between cache write and DB persist is intentional.
_Avoid_: write-through, async write, lazy persist

**Flush Frequency**:
The per-data-type interval at which all nodes batch L2→L3. Critical or frequently-read data types use a shorter interval than quasi-static data. Determined at configuration time per feature type.
_Avoid_: batch interval, sync rate, TTL

### Example dialogue

> **Dev A:** "This key is dirty — do we need to re-fetch from Supabase?"
> **Dev B:** "No. Dirty doesn't mean stale. It means the Leader hasn't flushed it to Supabase yet. L2 has the freshest value."
>
> **Dev A:** "If the Leader crashes before flushing, does the Dirty Key survive?"
> **Dev B:** "Yes — the Dirty Queue in Redis survives. On restart the new Leader picks up from `cache:processing` and retries."

---

## Translation System Architecture — 2026-06-04

### Translation Paths

**Text Translation (Dialogue):**
Gemini API called directly from NestJS. Input: array of text lines. Output: translated lines. Cached permanently per line via SHA1 hash. User selects model from dropdown (persisted in localStorage).
_Avoid_: OCR translation, image translation, MIT translation

**Patch Translation (Image Overlay):**
MIT Python server processes a manga page image and returns per-region translated PNG patches. Each patch has normalized coordinates (0–1 fractions of image dimensions). Overlaid client-side on the original image. Cached 7 days per page.
_Avoid_: full-image translation, page replacement, rendered translation

**Batch Translation:**
Multiple pages sent to MIT in one request. Results stream back to frontend via SSE as each page completes. Architecture: fire-and-forget to MIT + webhook callback per page. See "Batch Job" below.
_Avoid_: bulk translation, parallel translation, chapter translation

### Glossary

**Patch:**
A translated text region returned as a PNG image with normalized bounding box (`xPct`, `yPct`, `wPct`, `hPct` — all 0–1 fractions of the original page dimensions). Rendered as an absolutely-positioned overlay on the original manga page image.
_Avoid_: translated region, overlay image, text replacement

**Batch Job:**
A translation job for an entire chapter. MIT processes pages asynchronously and calls a webhook per page when done. The frontend connects via SSE and receives results as they arrive.
_Avoid_: chapter job, bulk job, async job

**MIT (manga-image-translator):**
The open-source Python AI server that handles OCR, text region detection, inpainting, and Gemini-based translation for manga page images. Runs as a separate process. Communicates with NestJS via HTTP (single-page) or HTTP + webhook callback (batch).
_Avoid_: AI server, translation server, Python server

**Startup Retry:**
MIT loads ML models lazily on the first request. `translateMangaPagePatches` retries up to 30× with 5s delays (150s patience) for the main path; 3× for the fallback path.

### Option A' — Redis Pub/Sub Batch Architecture (planned)

Replaces `activeBatchJobs` Map with Redis pub/sub as coordination mechanism:
```
MIT → webhook → handleMitCallback
  → cache.set(cacheKey, patches)          // persist result
  → redis.publish("translate:{taskId}", pageIndex)  // notify SSE listeners

SSE handler:
  1. serve cached pages immediately
  2. fire-and-forget batch to MIT
  3. redis.subscribe("translate:{taskId}") → forward to client
```

Eliminates: job registry, race conditions, memory leaks, TOCTOU, 15-min timeout management.

---

## Cache Architecture (Phase 2) — 2026-05-28

### Truth Hierarchy
```
L1  JsonCacheService (in-memory)  — latency; in-process only; lost on restart
L2  Redis                         — source of truth at runtime; horizontal scaling
L3  L3DiskService (JSON disk)     — per-node backup; Leader buffer before Supabase
DB  Supabase                      — long-term authoritative source
```

### L1 — In-process Latency
`JsonCacheService` stores data in an in-memory Map only — **no disk I/O**. Writes alongside L2 on `set()` for in-process read consistency. Cross-node sync not yet implemented (Phase 3 via Redis Pub/Sub).

### L3 — Per-node Backup
`L3DiskService` owns all disk I/O (`write`, `readAll`). Written by:
- `L3BatchWriter` periodic batch from L2 per Flush Frequency per data type (every node)
- `BatchSyncWorker.syncKey()` Leader re-sync before Supabase write (Leader only)
Never writes in the `set()` path.

### Write-behind Pattern
```
set(key, data)
  → jsonCache.set(key, data)      // L1 sync (in-process, in-memory only)
  → redis.set(key, entry, ttl)    // L2 write (source of truth)
  → batchSync.markDirty(key)      // rpush cache:dirty

L3BatchWriter (all nodes):  L2 → L3DiskService.write()  per Flush Frequency
BatchSyncWorker (Leader):   L2 → L3DiskService.write()  → (future) Supabase
```

### Redis Lock-based Leader Election (Mutex)
```
Acquisition:  SET cache:leader {nodeId} NX PX 37500          → 'OK' = won
Renewal:      Lua CAS — GET; if match → SET NX PX 37500      → 'OK' = held, nil = lost
Release:      Lua CAS — GET; if match → DEL                  → 1 = released, 0 = already taken
Interval:     15s
TTL:          37,500ms (2.5× interval — survives 1 missed renewal)
```
Renewal and Release use Lua compare-and-swap to prevent lock theft.

### Node Heartbeat & Observability (MetricsService)
```
Fires:    immediately on onModuleInit() + every 10s
Key:      cluster_metrics:{nodeId}  (TTL 30s, stale threshold 35s)
Payload:  { nodeId, cpu, freeMem, latency, timestamp }
Purpose:  Observability / future monitoring dashboard — NOT used for election
```

### Reliable Dirty Queue (BatchSyncWorker)
```
Write:    rpush cache:dirty {key}                       // markDirty()
Consume:  rpoplpush cache:dirty cache:processing        // atomic move
Ack:      lrem cache:processing 1 {key}                 // after sync success
Recover:  lrange cache:processing → rpush cache:dirty   // on startup (crash recovery)
Batch:    max 100 keys per 5s flush, leader-only
```
`cache:processing` should be empty at all times in normal operation — non-empty after a flush cycle = WARN signal.

### Module Graph
```
AppModule
  ├── CacheModule (@Global)
  │     ├── imports: StatusModule
  │     ├── RedisService (exported)
  │     ├── L3DiskService
  │     ├── L3BatchWriter          — periodic L2→L3, all nodes
  │     ├── JsonCacheService       — L1 in-memory only
  │     ├── CacheOrchestratorService (exported)
  │     ├── ImageCacheService (exported)
  │     └── BatchSyncWorker        — Leader dirty-queue drain → L3
  │           └── depends on: ElectionService (from StatusModule)
  └── StatusModule
        ├── MetricsService (exported) — heartbeat
        ├── ElectionService (exported) — NX lock + Lua CAS
        └── StatusService — SSE health events
```
<!-- lang:end -->

<!-- lang:th -->
# MangaDock System Context — ภาษาไทย

## คำศัพท์ระบบ Cache

**L1 Cache**:
Cache ภายใน process เพิ่มประสิทธิภาพด้าน latency — รองรับด้วย `JsonCacheService` (in-memory) ไม่มี network hop จึงเร็วมาก เป็น warm-start optimization เท่านั้น ไม่ใช่ authoritative
_หลีกเลี่ยง_: local cache, memory cache, JSON cache

**L2 Cache**:
Redis cache แบบ distributed — source of truth ขณะ runtime ทำให้ horizontal scaling ได้โดยให้ทุก node มองข้อมูลร่วมกัน ไม่ใช่ authority ระยะยาว; Supabase คือ
_หลีกเลี่ยง_: Redis cache, distributed cache, remote cache

**Dirty Key**:
Cache key ที่เขียนลง L1 + L2 แล้วแต่ยังไม่ persist ลง Supabase คำนี้อ้างถึงช่องว่าง persistence ไปยัง DB โดยเฉพาะ ไม่ใช่ความไม่สอดคล้องกันระหว่าง L1↔L2
_หลีกเลี่ยง_: stale key, unsynced key, pending key

**Dirty Queue** (`cache:dirty`):
backlog ลำดับของ Dirty Key ที่รอ Leader flush ไป Supabase queue ที่ไม่ว่างหลัง flush cycle คือสัญญาณเตือน ไม่ใช่สถานะปกติ
_หลีกเลี่ยง_: sync queue, work queue, flush queue

**Leader**:
node เดียวในคลัสเตอร์ที่ได้รับอนุญาตให้ flush Dirty Queue ไป Supabase ควบคุมด้วย Redis NX distributed lock มีไว้ป้องกัน concurrent Supabase writes
_หลีกเลี่ยง_: master, primary, coordinator

**L3 Cache**:
JSON disk storage ต่อ node (`L3DiskService`) ทำหน้าที่ (1) backup local ของ L2 กรณี Redis unavailable และ (2) batch buffer ที่ Leader อ่านก่อนเขียน Supabase แต่ละ node เขียน L3 เองเป็นระยะจาก L2 ตาม Flush Frequency ต่อ data type
_หลีกเลี่ยง_: JSON cache, disk cache, file cache, L1 disk

**Write-behind**:
รูปแบบที่เขียนข้อมูลลง L1 + L2 ทันที (synchronous) และ persist ลง Supabase แบบ asynchronous โดย Leader ผ่าน L3 ช่องว่างระยะเวลาระหว่าง cache write และ DB persist เป็นสิ่งตั้งใจ
_หลีกเลี่ยง_: write-through, async write, lazy persist

**Flush Frequency**:
ช่วงเวลาต่อ data type ที่ทุก node batch L2→L3 data type ที่ critical หรืออ่านบ่อยใช้ช่วงสั้นกว่า quasi-static กำหนดตาม config ต่อ feature type
_หลีกเลี่ยง_: batch interval, sync rate, TTL

---

## สถาปัตยกรรมระบบแปลภาษา — 2026-06-04

### เส้นทางการแปล

**Text Translation (บทสนทนา):**
เรียก Gemini API โดยตรงจาก NestJS รับข้อมูล: array ของ text line คืนผล: บรรทัดที่แปลแล้ว Cache ถาวรต่อบรรทัดผ่าน SHA1 hash ผู้ใช้เลือก model จาก dropdown (บันทึกใน localStorage)
_หลีกเลี่ยง_: OCR translation, image translation, MIT translation

**Patch Translation (Image Overlay):**
MIT Python server ประมวลผลรูปหน้ามังงะและคืน PNG patch ที่แปลแล้วต่อบริเวณ แต่ละ patch มีพิกัด normalized (0–1 fractions ของขนาดภาพ) วางทับ client-side บนรูปต้นฉบับ Cache 7 วันต่อหน้า
_หลีกเลี่ยง_: full-image translation, page replacement, rendered translation

**Batch Translation:**
ส่งหลายหน้าไปยัง MIT ในคำขอเดียว ผลสตรีมกลับมายัง frontend ผ่าน SSE เมื่อแต่ละหน้าเสร็จ สถาปัตยกรรม: fire-and-forget ไปยัง MIT + webhook callback ต่อหน้า

### คำศัพท์เพิ่มเติม

**MIT (manga-image-translator):**
Python AI server แบบ open-source ที่จัดการ OCR, ตรวจจับบริเวณข้อความ, inpainting และแปลด้วย Gemini สำหรับหน้ามังงะ รันเป็น process แยก สื่อสารกับ NestJS ผ่าน HTTP (single-page) หรือ HTTP + webhook callback (batch)
_หลีกเลี่ยง_: AI server, translation server, Python server

---

## สถาปัตยกรรม Cache (Phase 2) — 2026-05-28

### Truth Hierarchy
```
L1  JsonCacheService (in-memory)  — latency; ใน process เท่านั้น; หายเมื่อ restart
L2  Redis                         — source of truth ขณะ runtime; horizontal scaling
L3  L3DiskService (JSON disk)     — backup ต่อ node; Leader buffer ก่อน Supabase
DB  Supabase                      — authoritative source ระยะยาว
```

### L1 — In-process Latency
`JsonCacheService` เก็บข้อมูลใน in-memory Map เท่านั้น — **ไม่มี disk I/O** เขียนพร้อม L2 บน `set()` เพื่อ in-process read consistency cross-node sync ยังไม่ implement (Phase 3 via Redis Pub/Sub)

### L3 — Per-node Backup
`L3DiskService` รับผิดชอบ disk I/O ทั้งหมด (`write`, `readAll`) เขียนโดย:
- `L3BatchWriter` periodic batch จาก L2 ตาม Flush Frequency ต่อ data type (ทุก node)
- `BatchSyncWorker.syncKey()` Leader re-sync ก่อน Supabase write (Leader เท่านั้น)
ไม่เขียนใน `set()` path เด็ดขาด

### Write-behind Pattern
```
set(key, data)
  → jsonCache.set(key, data)      // L1 sync (in-process, in-memory only)
  → redis.set(key, entry, ttl)    // L2 write (source of truth)
  → batchSync.markDirty(key)      // rpush cache:dirty

L3BatchWriter (all nodes):  L2 → L3DiskService.write()  ต่อ Flush Frequency
BatchSyncWorker (Leader):   L2 → L3DiskService.write()  → (อนาคต) Supabase
```

### Leader Election ด้วย Redis Lock (Mutex)
```
Acquisition:  SET cache:leader {nodeId} NX PX 37500          → 'OK' = ชนะ
Renewal:      Lua CAS — GET; ถ้าตรงกัน → SET NX PX 37500    → 'OK' = ยังถือ, nil = เสีย
Release:      Lua CAS — GET; ถ้าตรงกัน → DEL                → 1 = ปล่อย, 0 = ถูกแย่งไป
Interval:     15s
TTL:          37,500ms (2.5× interval — รอดได้หาก renewal พลาด 1 ครั้ง)
```
Renewal และ Release ใช้ Lua compare-and-swap เพื่อป้องกัน lock theft

### Node Heartbeat & Observability (MetricsService)
```
ยิงทันที: onModuleInit() + ทุก 10s
Key:      cluster_metrics:{nodeId}  (TTL 30s, stale threshold 35s)
Payload:  { nodeId, cpu, freeMem, latency, timestamp }
วัตถุประสงค์: Observability / monitoring dashboard — ไม่ใช้ตัดสิน leadership
```

### Reliable Dirty Queue (BatchSyncWorker)
```
Write:    rpush cache:dirty {key}                       // markDirty()
Consume:  rpoplpush cache:dirty cache:processing        // atomic move
Ack:      lrem cache:processing 1 {key}                 // หลัง sync สำเร็จ
Recover:  lrange cache:processing → rpush cache:dirty   // เมื่อ startup (crash recovery)
Batch:    max 100 keys ต่อ 5s flush, leader เท่านั้น
```
`cache:processing` ควร empty ตลอดในสภาวะปกติ — non-empty หลัง flush cycle = สัญญาณ WARN
<!-- lang:end -->
