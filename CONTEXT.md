# MangaDock System Context

## Language

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
The single node in the cluster permitted to flush the Dirty Queue to Supabase. Enforced by a Redis NX distributed lock. Exists to prevent concurrent Supabase writes (double-write, race conditions). Elected ahead of the Supabase write path being implemented.
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

## Cache Architecture (Phase 2) — 2026-05-28

### Truth Hierarchy
```
L1  JsonCacheService (in-memory)  — latency; in-process only; lost on restart
L2  Redis                         — source of truth at runtime; horizontal scaling
L3  L3DiskService (JSON disk)     — per-node backup; Leader buffer before Supabase
DB  Supabase                      — long-term authoritative source
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
Renewal และ Release ใช้ Lua compare-and-swap เพื่อป้องกัน lock theft: node ที่ reconnect หลัง TTL หมดจะไม่ overwrite/delete lock ของ node ใหม่ที่ได้ lock ไปแล้ว

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
`cache:processing` ควร empty ตลอดในสภาวะปกติ — non-empty หลัง flush cycle = WARN signal

### Sync Target (Leader flush path)
`syncKey()` → `L3DiskService.write(key, entry)` — Leader re-syncs L2→L3 เพื่อให้ L3 fresh ก่อน Supabase write Supabase RPC handlers จะเพิ่มทีละ feature type (wallet, stats, etc.) ใน Phase 2c

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
