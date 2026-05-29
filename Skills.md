# METABOOKS BACKEND ENGINEERING STANDARD (T4-STANDARD)
You must strictly adhere to these backend engineering pillars 
before writing, altering, or generating any server-side logic.

## 1. IDEMPOTENT PIPELINES
- All async image processing tasks must be idempotent.
- ALWAYS check task state in Redis/Supabase before creating 
  new MIT Server tasks. Prevent redundant AI compute at all costs.
- Task state transitions must be atomic and follow strictly:
  `pending → processing → completed | failed`
- Never update task state without reading current state first.

## 2. WEBHOOK INTEGRITY (MIT Server Callbacks)
- All incoming Webhooks from MIT Server must be verified via 
  HMAC Signature before processing.
- Webhook handlers must be idempotent — duplicate callbacks 
  for the same task_id must be safely ignored.
- If no Webhook received within TTL threshold, mark task 
  as `failed` and push to Dead Letter Queue (DLQ).
- DLQ tasks must trigger alert when depth exceeds threshold.

## 3. 2-LAYER CACHE INTEGRITY
- Strict hierarchy: L1 (In-Memory) → L2 (Redis) → Supabase.
- Every state mutation must propagate L1 → L2 correctly.
- Graceful Shutdown: catch `SIGTERM` and `SIGINT`, flush all 
  volatile L1 data to Redis before process exit. No exceptions.
- Max retry for Redis write on shutdown: 3 attempts with 
  exponential backoff before logging critical error.

## 4. CLOUDFLARE WORKER MEMORY CONTRACT
- NEVER buffer entire image in Worker memory.
- ALL R2 uploads must use streaming `.put()` only.
- Every `.put()` call MUST include:
  - `contentType`: correct MIME type
  - `cacheControl`: "public, max-age=31536000"
- Multipart upload required for files > 100MB.

## 5. ZERO-TRUST ASSET PROTECTION
- Reverse proxy endpoints must verify:
  - Hardware Device Fingerprint (from Cloudflared Verify)
  - `Referer` header against allowlist
  - `User-Agent` against known bot signatures
- Direct R2 URLs must never be exposed to client.
- 1-Hour Verification Window state must be checked on 
  every asset request — no exceptions.

## 6. OBSERVABILITY STANDARD
- Every cross-service call must emit structured log:
  `{ timestamp, service, task_id, event, duration_ms, status }`
- Errors must always include context:
  `{ error_code, message, service_origin, task_id }`
- Never log raw image data or user PII.

## 7. MIT SERVER TROUBLESHOOTING & RECOVERY
- **Port Conflict (Errno 10048):** On Windows, if MIT fails to 
  bind to port 5003, use `netstat -ano | findstr :5003` to find 
  the PID and `taskkill /F /PID <PID>` to kill it before restarting.
- **Missing Dependencies (Python 3.13+):** Certain packages like 
  `pydensecrf` and `pydantic-core` may fail to compile on Python 
  3.13 due to C API changes.
  - Mitigation: Always use a stable `venv` with Python 3.12.
  - Patching: If `pydensecrf` is missing, ensure 
    `manga_translator/mask_refinement/text_mask_utils.py` 
    has the `try-except` fallback to avoid `ModuleNotFoundError`.
- **Git Ignore & Rollback:** The `lib/` and `venv/` folders are 
  ignored by Git. A `git checkout` or rollback will NOT restore 
  these. If `ModuleNotFoundError: No module named '...lib'` 
  occurs, manually restore the `lib` folder or its stubs.
- **Internal Path Handling:** Always ensure `sys.path` or 
  `PYTHONPATH` includes the project root before importing 
  `manga_translator`.

## 8. UI/UX PRINCIPLES (META-DESIGN)
- **Liquid Glass Sticky Navigation:** For pages with long content,
  navigation elements must be `sticky` or `fixed` for constant 
  accessibility.
- **Visual Style:** Use "Liquid Glass" effect — semi-transparent 
  background (`bg-white/10` or `bg-black/20`), background blur 
  (`backdrop-blur-md`), and rounded corners (`rounded-full` or 
  `rounded-2xl`).
- **Z-Index Management:** Sticky elements must use appropriate 
  `z-index` (e.g., `z-40`) — above content, below global overlays.
- **Robust Sidebar Layout:** Use multi-column Grid (`lg:grid-cols-12`)
  or Flexbox with defined widths (`w-[320px]`). Never use simple 
  percentage grids.
- **Premium Iconography:** NEVER use emojis for any UI element — 
  in code or in the interface. Replace with high-fidelity SVG icons 
  enhanced with Glow Effects and category-specific color palettes.
- **Smooth Interaction Standard:** All interactive elements must use 
  `.smooth-hover` (0.18s) or `.smooth-hover-fast` (0.08s) with 
  `cubic-bezier(0.4, 0, 0.2, 1)`.
- **User-Centric Feedback & Empathy:** Every asynchronous operation 
  (fetches, form submissions, AI translations) MUST have an immediate 
  loading state (Skeleton or Spinner) and a clear success/error 
  feedback (Toasts). Focus on reducing "Perceived Latency" by 
  optimizing UI response time.
- **Optimistic UI Updates:** For instant-feel interactions (voting, 
  liking, bookmarking), the UI must reflect the new state IMMEDIATELY 
  before the server response. Implement a robust rollback mechanism to 
  revert the UI and notify the user if the backend call fails.
- **Volatile Frontend Caching:** Reduce system load by implementing 
  in-memory caching for API responses (e.g., Manga Detail, Trending). 
  This cache should persist during client-side navigation but reset 
  on a full website refresh to ensure data eventual consistency 
  without over-complicating state management.

## 9. DEVELOPMENT WORKFLOW & OPERATIONAL RULES

### Service Start Commands
| Service | Command |
|---|---|
| Backend (NestJS) | `bun run start:dev` |
| Frontend (Next.js) | `bun run dev` |
| MIT Server | `.\MIT\run-server.bat` |

### Mandatory Post-Edit Checklist
After EVERY code change, you must perform these steps in order:

1. **Update Documentation** — Sync all related documents and 
   in-code comments to reflect the change. Never leave docs stale.

2. **Check Logs** — Verify logs from the affected service after 
   every edit. If any error or warning appears, fix it immediately 
   before proceeding to the next task.

3. **MIT Server Restart** — If any MIT Server file was modified, 
   manually restart via `.\MIT\run-server.bat`. MIT Server has 
   NO auto-restart mechanism. Changes will not apply until 
   manually restarted.

4. **No Emojis in Code** — Never use emojis anywhere in source 
   code, comments, log messages, or variable names. Use descriptive 
   text, SVG icons, or structured labels instead.