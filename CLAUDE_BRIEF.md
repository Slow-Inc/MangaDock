# CLAUDE_BRIEF.md — Phase 2 Architecture Implementation (Refined)

## Task
Implement the Phase 2 L2-Centric Cache Architecture with Redis Lock-based Election and Reliable Write-behind Batching.

## Minimum Context
- **Cache Architecture:** Refactor current write-through to a Write-behind pattern using Redis as the primary L2 store.
- **Leader Election:** Use **Redis NX Lock** (`SET cache:leader {nodeId} NX PX 20000`) for true Mutex. Do not use scoring for leadership.
- **Metrics:** Gather CPU, Mem, and Supabase Latency via `MetricsService` for **Observability only**.
- **Reliability:** Use the **Reliable Queue pattern** (`RPOPLPUSH`) to prevent data loss during sync.

## Specific Implementation Steps (Ranked by Priority)

### 🔴 Critical (Correctness)
1. **Election Service (`election.service.ts`):** 
   - Replace metric-based scoring with Redis NX Lock.
   - Lock should be held for 20s and extended every interval.
2. **Metrics Service (`metrics.service.ts`):** 
   - Trigger `publishMetrics()` immediately in `onModuleInit()` to avoid initial 10s-25s lag.
   - Change Supabase latency check from `GET` to `HEAD` request.
3. **Batch Sync Worker (`batch-sync.worker.ts`):** 
   - Replace `lpop` logic with `RPOPLPUSH cache:dirty cache:processing`.
   - Only remove from `cache:processing` after successful Supabase RPC sync.

### 🟡 Major (Performance & Stability)
4. **Election Service Config:** Increase `METRICS_STALE_MS` to `35000` to provide a safety margin for write latency.
5. **Cache Orchestrator (`cache-orchestrator.service.ts`):** 
   - Remove `markDirty` call from `setMangaCacheWithTiers`. (Permanent manga cache doesn't need dirty tracking).

### 🟢 Nit (Cleanup)
6. **Cleanup:** Remove unused `DEFAULT_TTL_SEC` in `CacheOrchestratorService`.

## Constraints
- **T4-STANDARD:** All database updates via Supabase must be idempotent.
- **No Over-engineering:** Do not add BullMQ or Edge Functions; stick to native Redis primitives as planned.

## Relevant Code Snippet
```typescript
// Proposed Lock Pattern
async acquireLeaderLock(nodeId: string): Promise<boolean> {
  const result = await this.redis.set('cache:leader', nodeId, 'PX', 20000, 'NX');
  return result === 'OK';
}

// Proposed Reliable Queue Pattern
// LMOVE or RPOPLPUSH (depending on Redis version)
const keyToSync = await this.redis.rpoplpush('cache:dirty', 'cache:processing');
```
