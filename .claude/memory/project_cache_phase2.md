---
name: project-cache-phase2
description: "Multi-layer cache hardening phases 2.1–2.3 — what's done, what's pending"
metadata: 
  node_type: memory
  type: project
  originSessionId: 0336d311-4db8-40cb-b407-e2515ced7e24
---

Phase 2 Cache Hardening สมบูรณ์แล้ว (merged ทั้งหมด ณ พ.ค. 2026)

**Done:**
- PR #39: L1-first reads, cross-node invalidation (pub/sub + nodeId), LRU 10k entries, L2 recovery with L1 vs L3 timestamp merge
- PR #49 (Phase 2.1): randomUUID nodeId, pipeline L2 recovery 500 keys/chunk, Supabase RPC upsert_cache_entry
- PR #50 (Phase 2.2): L1 clear on reconnect, L3 write watchdog (CRITICAL at 3 failures), dirty fallback file
- PR #55 (Phase 2.3): append-only dirty_fallback.txt, LRU sizeCalculation + maxSize 50MB, election 5s/12.5s TTL

**Test count progression:** 225 → 240 → 245

**Remaining open issues:**
- #38: Catastrophic Recovery — L1+L2 both fail: L3 vs Supabase → bootstrap L2 → L1 (ต้อง grill ก่อน)
- Frontend: Pass `?mangaId=` param on chapter pages fetch (manga_id stored as '' in chapter_daily_stats)

**Why:** #38 ต้องการ grill เพราะ scope ยังไม่ชัด — L3 vs Supabase tie-breaking, trigger condition, partial failure handling
**How to apply:** เริ่ม /grill-me ก่อนสร้าง PRD สำหรับ #38
