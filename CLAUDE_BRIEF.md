<!-- lang:en -->
# CLAUDE_BRIEF.md — Phase 2 Cache Architecture

**Last updated: 2026-05-28**

---

## Phase 2a — Leader Election & Reliable Queue (COMPLETED)

**Branch:** `feat/2-layer-cache-upgrade` | **Commit:** `c5bd110`

### Built
- **ElectionService** — Redis NX Lock: `SET NX PX` acquisition, Lua CAS renewal (prevents lock theft), `DEL` on graceful shutdown, fires immediately on startup
- **MetricsService** — Observability heartbeat: CPU/mem/latency → `cluster_metrics:{nodeId}` every 10s; fires immediately on init
- **BatchSyncWorker** — Reliable dirty queue: `RPOPLPUSH` atomic move, `LREM` ack, `LRANGE` crash recovery, `Set<string>` dedup, leader-only flush guard inside `flush()` method
- **CacheOrchestratorService** — write-behind `set()`: L1 sync + L2 write + `markDirty()`; removed dead code

### Still Scaffolding
- `syncKey()` → `jsonCache.syncEntry()` is a placeholder — no Supabase RPC handler yet
- Cross-node L1 Pub/Sub sync — Phase 3
- Observability dashboard for MetricsService data — Phase 3

---

## Phase 2b — L3 Batch Layer (IN PROGRESS)

**Issues:** #13 → #14 → #15 (serial dependency)

### Architecture Discovery (from grill session 2026-05-28)

**Correct truth hierarchy:**
```
L1  (JsonCacheService in-memory)  — latency, in-process only
L2  (Redis)                       — source of truth at runtime, horizontal scaling
L3  (JSON disk)                   — per-node backup + Leader buffer before Supabase
DB  (Supabase)                    — long-term authoritative source
```

**Bug found:** `JsonCacheService.set()` called `writeToDisk()` on every write — L1 updates are very frequent (real-time cross-node conflict prevention) causing massive disk I/O overflow.

**Correct design:** L3 written only by periodic batch from L2 (`L3BatchWriter`) and Leader re-sync L2→L3 before Supabase write.

### Issues #13–15 Scope

| Issue | Module | Blocked by |
|---|---|---|
| #13 | `L3DiskService` — extract disk I/O from `JsonCacheService` | None |
| #14 | `L3BatchWriter` — periodic L2→L3 batch on all nodes | #13 |
| #15 | Wire `L3DiskService` into `BatchSyncWorker.syncKey()` | #13, #14 |

### Recovery Hierarchy (to implement with first Supabase handler)
1. L1 in-memory → warm L2 (Redis empty after restart)
2. L3 JSON disk vs Supabase timestamp → winner rebuilds L2→L1
3. Supabase only (if L3 is corrupted)

---

## Next After Phase 2b

Upcoming Phase 2c work:
- Commercial Gateway (QR/PromptPay + HMAC Webhooks) — Issue planned
- Storage Scaling (Cloudflare R2 Migration) — Issue planned
- Security (2FA / Device Session Pinning) — Issue planned
- First Supabase write handlers (wallet or stats) — implement alongside recovery hierarchy
<!-- lang:end -->

<!-- lang:th -->
# CLAUDE_BRIEF.md — สถาปัตยกรรม Cache Phase 2

**อัปเดตล่าสุด: 2026-05-28**

---

## Phase 2a — Leader Election & Reliable Queue (เสร็จแล้ว)

**Branch:** `feat/2-layer-cache-upgrade` | **Commit:** `c5bd110`

### สร้างเสร็จแล้ว
- **ElectionService** — Redis NX Lock: acquisition ด้วย `SET NX PX`, Lua CAS renewal (ป้องกัน lock theft), `DEL` ตอน graceful shutdown, ยิงทันทีเมื่อ startup
- **MetricsService** — Observability heartbeat: CPU/mem/latency → `cluster_metrics:{nodeId}` ทุก 10s; ยิงทันทีเมื่อ init
- **BatchSyncWorker** — Reliable dirty queue: `RPOPLPUSH` atomic move, `LREM` ack, `LRANGE` crash recovery, `Set<string>` dedup, leader-only flush guard ภายใน method `flush()`
- **CacheOrchestratorService** — write-behind `set()`: L1 sync + L2 write + `markDirty()`; ลบ dead code

### ยังเป็น Scaffolding
- `syncKey()` → `jsonCache.syncEntry()` คือ placeholder — ยังไม่มี Supabase RPC handler
- Cross-node L1 Pub/Sub sync — Phase 3
- Observability dashboard สำหรับ MetricsService data — Phase 3

---

## Phase 2b — L3 Batch Layer (กำลังดำเนินการ)

**Issues:** #13 → #14 → #15 (ขึ้นต่อกันแบบลำดับ)

### Architecture Discovery (จาก grill session 2026-05-28)

**Truth hierarchy ที่ถูกต้อง:**
```
L1  (JsonCacheService in-memory)  — latency, in-process เท่านั้น
L2  (Redis)                       — source of truth ขณะ runtime, horizontal scaling
L3  (JSON disk)                   — per-node backup + Leader buffer ก่อน Supabase
DB  (Supabase)                    — long-term authoritative source
```

**Bug ที่พบ:** `JsonCacheService.set()` เรียก `writeToDisk()` ทุกครั้ง — L1 update บ่อยมากเพราะต้อง realtime cross-node conflict prevention ทำให้ disk I/O overflow มหาศาล

**Design ที่ถูก:** L3 เขียนโดย periodic batch จาก L2 เท่านั้น (`L3BatchWriter`) และ Leader re-sync L2→L3 ก่อน Supabase write

### ขอบเขต Issues #13–15

| Issue | Module | ขึ้นต่อจาก |
|---|---|---|
| #13 | `L3DiskService` — extract disk I/O จาก `JsonCacheService` | ไม่มี |
| #14 | `L3BatchWriter` — periodic L2→L3 batch ทุก node | #13 |
| #15 | Wire `L3DiskService` เข้า `BatchSyncWorker.syncKey()` | #13, #14 |

### Recovery Hierarchy (implement พร้อมกับ Supabase handler ตัวแรก)
1. L1 in-memory → warm L2 (Redis ว่างหลัง restart)
2. L3 JSON disk vs Supabase timestamp → winner rebuild L2→L1
3. Supabase เท่านั้น (ถ้า L3 เสียหาย)

---

## งานถัดไปหลัง Phase 2b

งานใน Phase 2c:
- Commercial Gateway (QR/PromptPay + HMAC Webhooks) — วางแผน Issue ไว้
- Storage Scaling (Cloudflare R2 Migration) — วางแผน Issue ไว้
- Security (2FA / Device Session Pinning) — วางแผน Issue ไว้
- Supabase write handlers ตัวแรก (wallet หรือ stats) — implement พร้อม recovery hierarchy
<!-- lang:end -->
