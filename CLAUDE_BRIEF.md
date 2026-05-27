# CLAUDE_BRIEF.md — Phase 2 Cache Architecture

**Last updated: 2026-05-28**

---

## ✅ Phase 2a — Leader Election & Reliable Queue (COMPLETED)

**Branch:** `feat/2-layer-cache-upgrade` | **Commit:** `c5bd110`

### Built
- **ElectionService** — Redis NX Lock: `SET NX PX` acquisition, Lua CAS renewal (prevents lock theft), `DEL` on graceful shutdown, fires immediately on startup
- **MetricsService** — Observability heartbeat: CPU/mem/latency → `cluster_metrics:{nodeId}` every 10s; fires immediately on init
- **BatchSyncWorker** — Reliable dirty queue: `RPOPLPUSH` atomic move, `LREM` ack, `LRANGE` crash recovery, `Set<string>` dedup, leader-only flush guard inside `flush()` method
- **CacheOrchestratorService** — write-behind `set()`: L1 sync + L2 write + `markDirty()`; removed dead code

### Still Scaffolding
- `syncKey()` → `jsonCache.syncEntry()` คือ placeholder — ยังไม่มี Supabase RPC handler
- Cross-node L1 Pub/Sub sync — Phase 3
- Observability dashboard สำหรับ MetricsService data — Phase 3

---

## 🔵 Phase 2b — L3 Batch Layer (IN PROGRESS)

**Issues:** #13 → #14 → #15 (serial dependency)

### Architecture Discovery (from grill session 2026-05-28)

**Truth hierarchy ที่ถูกต้อง:**
```
L1  (JsonCacheService in-memory)  — latency, in-process only
L2  (Redis)                       — source of truth at runtime, horizontal scaling
L3  (JSON disk)                   — per-node backup + Leader buffer before Supabase
DB  (Supabase)                    — long-term authoritative source
```

**Bug ที่พบ:** `JsonCacheService.set()` เรียก `writeToDisk()` ทุกครั้ง — L1 update บ่อยมากเพราะต้อง realtime cross-node conflict prevention ทำให้ disk I/O overflow มหาศาล

**Design ที่ถูก:** L3 เขียนโดย periodic batch จาก L2 เท่านั้น (`L3BatchWriter`) และ Leader re-sync L2→L3 ก่อน Supabase write

### Issues #13–15 Scope

| Issue | Module | Blocked by |
|---|---|---|
| #13 | `L3DiskService` — extract disk I/O จาก `JsonCacheService` | None |
| #14 | `L3BatchWriter` — periodic L2→L3 batch ทุก node | #13 |
| #15 | Wire `L3DiskService` เข้า `BatchSyncWorker.syncKey()` | #13, #14 |

### Recovery Hierarchy (to implement with first Supabase handler)
1. L1 in-memory → warm L2 (Redis ว่างหลัง restart)
2. L3 JSON disk vs Supabase timestamp → winner rebuild L2→L1
3. Supabase only (ถ้า L3 เสียหาย)

---

## Next After Phase 2b

Gemini G-4 ควร generate brief สำหรับงานถัดไปใน Phase 2c:
- Commercial Gateway (QR/PromptPay + HMAC Webhooks) — Issue planned
- Storage Scaling (Cloudflare R2 Migration) — Issue planned
- Security (2FA / Device Session Pinning) — Issue planned
- Supabase write handlers ตัวแรก (wallet หรือ stats) — implement พร้อม recovery hierarchy
