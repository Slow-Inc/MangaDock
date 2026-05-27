# MangaDock System Context

## Cache Architecture (Phase 2) — Implemented 2026-05-28

### L2-Centric Architecture
Redis (L2) คือ Source of Truth ณ Runtime — ทุก `set()` เขียนลง Redis ก่อน L1 (JsonCache in-memory + disk) รับข้อมูลโดยตรงจาก `set()` เพื่อ in-process consistency

### L1 Read Mirror
`JsonCacheService` เป็น in-memory + file-backed cache (`.cache/*.json`) ทำหน้าที่เป็น L1 fallback เมื่อ Redis ไม่พร้อม การ sync ข้าม node ยังไม่ implement — กำหนดไว้สำหรับ Phase 3 ผ่าน Redis Pub/Sub

### Write-behind Pattern
```
set(key, data)
  → jsonCache.set(key, data)      // L1 sync (in-process)
  → redis.set(key, entry, ttl)    // L2 write (source of truth)
  → batchSync.markDirty(key)      // rpush cache:dirty
```
Leader node drain dirty queue ทุก 5s → `syncKey` → `jsonCache.syncEntry`

### Redis Lock-based Leader Election (Mutex)
```
Acquisition:  SET cache:leader {nodeId} NX PX 37500  → 'OK' = won
Renewal:      SET cache:leader {nodeId} XX PX 37500  → 'OK' = held, null = lost
Interval:     15s
TTL:          37,500ms (2.5× interval — survives 1 missed renewal)
```
ป้องกัน split-brain: Redis เป็น single source of truth สำหรับ ownership ป้องกัน leader thrashing: lock holder ไม่สูญเสียตำแหน่งเพราะ CPU สูงจากการทำงาน

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

### Sync Target (Current — Scaffolding)
`syncKey()` → `jsonCache.syncEntry()` อัปเดต L1 disk persistence เท่านั้น Supabase RPC handlers จะเพิ่มทีละ feature type (wallet, stats, etc.) ใน Phase 2 ถัดไป

### Module Graph
```
AppModule
  ├── CacheModule (@Global)
  │     ├── imports: StatusModule
  │     ├── RedisService (exported)
  │     ├── JsonCacheService
  │     ├── CacheOrchestratorService (exported)
  │     ├── ImageCacheService (exported)
  │     └── BatchSyncWorker
  │           └── depends on: ElectionService (from StatusModule)
  └── StatusModule
        ├── MetricsService (exported) — heartbeat
        ├── ElectionService (exported) — NX lock
        └── StatusService — SSE health events
```
