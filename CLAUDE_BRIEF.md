# CLAUDE_BRIEF.md — Phase 2 Cache Architecture (COMPLETED)

**Status: ✅ IMPLEMENTED** — Branch `feat/2-layer-cache-upgrade`, Commit `ad72574`
**Date completed: 2026-05-28**

---

## What Was Built

### ElectionService — Redis NX Lock
- `SET cache:leader {nodeId} NX PX 37500` สำหรับ acquisition
- `SET cache:leader {nodeId} XX PX 37500` สำหรับ renewal ทุก 15s
- ไม่มี metric scoring — lock owner คือ leader เสมอ
- ป้องกัน split-brain และ leader thrashing

### MetricsService — Observability Only
- Heartbeat ทุก 10s → `cluster_metrics:{nodeId}` (TTL 30s)
- ยิงทันทีตอน `onModuleInit()` (ก่อน interval)
- CPU sampling 500ms, freeMem, Supabase HEAD ping
- ข้อมูลเก็บไว้สำหรับ monitoring dashboard ใน Phase 3

### BatchSyncWorker — Reliable Queue
- `RPOPLPUSH cache:dirty cache:processing` (atomic move)
- `LREM cache:processing 1 {key}` หลัง sync สำเร็จ
- Crash recovery: `LRANGE cache:processing` → re-queue บน startup
- Leader-only guard อยู่ใน `flush()` method โดยตรง

### CacheOrchestratorService — Cleanup
- ลบ `DEFAULT_TTL_SEC` dead code
- ลบ `markDirty` จาก `setMangaCacheWithTiers` (permanent L1 = no-op)
- `set()` ยังคง write L1+L2 synchronous + enqueue dirty

---

## What Is Still Scaffolding (For Future Phases)

- `syncKey()` → `jsonCache.syncEntry()` คือ placeholder — ยังไม่มี Supabase RPC handler
- Cross-node L1 sync ผ่าน Pub/Sub ยังไม่ implement (Phase 3)
- Observability dashboard สำหรับ MetricsService data (Phase 3)

---

## Next CLAUDE_BRIEF

Gemini G-4 ควร generate brief สำหรับงานถัดไปใน Phase 2:
- Commercial Gateway (QR/PromptPay + HMAC Webhooks)
- Storage Scaling (Cloudflare R2 Migration)
- Security (2FA / Device Session Pinning)
