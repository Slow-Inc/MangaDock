<!-- lang:en -->
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
- **Git Ignore & Rollback:** The `lib/` and `venv/` folders are 
  ignored by Git. A `git checkout` or rollback will NOT restore 
  these.

## 8. UI/UX PRINCIPLES (META-DESIGN)
- **Liquid Glass Sticky Navigation:** For pages with long content,
  navigation elements must be `sticky` or `fixed` for constant 
  accessibility.
- **Visual Style:** Use "Liquid Glass" effect — semi-transparent 
  background (`bg-white/10` or `bg-black/20`), background blur 
  (`backdrop-blur-md`), and rounded corners.
- **Premium Iconography:** NEVER use emojis for any UI element — 
  in code or in the interface. Replace with high-fidelity SVG icons.
- **Smooth Interaction Standard:** All interactive elements must use 
  `.smooth-hover` (0.18s) or `.smooth-hover-fast` (0.08s).
- **Optimistic UI Updates:** For instant-feel interactions (voting, 
  liking, bookmarking), the UI must reflect the new state IMMEDIATELY 
  before the server response.

## 9. DEVELOPMENT WORKFLOW & OPERATIONAL RULES

### Service Start Commands
| Service | Command |
|---|---|
| Backend (NestJS) | `bun run start:dev` |
| Frontend (Next.js) | `bun run dev` |
| MIT Server | `.\MIT\run-server.bat` |

### Mandatory Post-Edit Checklist
After EVERY code change, perform these steps in order:

1. **Update Documentation** — Sync all related documents to reflect the change.
2. **Check Logs** — Verify logs from the affected service after every edit.
3. **MIT Server Restart** — If any MIT Server file was modified, restart manually via `.\MIT\run-server.bat`. MIT has NO auto-restart mechanism.
4. **No Emojis in Code** — Never use emojis anywhere in source code, comments, or log messages.
<!-- lang:end -->

<!-- lang:th -->
# มาตรฐานวิศวกรรม Backend ของ METABOOKS (T4-STANDARD)
คุณต้องยึดมั่นใน engineering pillar เหล่านี้อย่างเคร่งครัด
ก่อนเขียน แก้ไข หรือสร้าง logic ฝั่ง server ใดๆ

## 1. IDEMPOTENT PIPELINES
- งาน async ประมวลผลภาพทั้งหมดต้องเป็น idempotent
- ตรวจสอบสถานะงานใน Redis/Supabase เสมอก่อนสร้างงาน MIT Server ใหม่ ป้องกัน AI compute ซ้ำซ้อนทุกกรณี
- การเปลี่ยน task state ต้องเป็น atomic และเป็นไปตาม: `pending → processing → completed | failed`
- ห้ามอัปเดต task state โดยไม่อ่าน current state ก่อน

## 2. WEBHOOK INTEGRITY (MIT Server Callbacks)
- Webhook ขาเข้าจาก MIT Server ทั้งหมดต้อง verify ด้วย HMAC Signature ก่อนประมวลผล
- Webhook handler ต้องเป็น idempotent — callback ซ้ำสำหรับ task_id เดียวกันต้องถูก ignore อย่างปลอดภัย
- ถ้าไม่ได้รับ Webhook ภายใน TTL threshold ให้ mark task เป็น `failed` และส่งไป Dead Letter Queue (DLQ)
- DLQ tasks ต้องทริกเกอร์ alert เมื่อ depth เกิน threshold

## 3. 2-LAYER CACHE INTEGRITY
- ลำดับชั้นเข้มงวด: L1 (In-Memory) → L2 (Redis) → Supabase
- ทุก state mutation ต้องส่งต่อ L1 → L2 อย่างถูกต้อง
- Graceful Shutdown: จับ `SIGTERM` และ `SIGINT`, flush data L1 volatile ทั้งหมดไปยัง Redis ก่อนปิด process ไม่มีข้อยกเว้น
- Max retry สำหรับ Redis write ตอน shutdown: 3 ครั้งพร้อม exponential backoff ก่อน log critical error

## 4. CLOUDFLARE WORKER MEMORY CONTRACT
- ห้าม buffer รูปภาพทั้งหมดใน Worker memory เด็ดขาด
- R2 upload ทั้งหมดต้องใช้ streaming `.put()` เท่านั้น
- ทุกการเรียก `.put()` ต้องมี:
  - `contentType`: MIME type ที่ถูกต้อง
  - `cacheControl`: "public, max-age=31536000"
- ต้องใช้ Multipart upload สำหรับไฟล์ > 100MB

## 5. ZERO-TRUST ASSET PROTECTION
- Reverse proxy endpoint ต้อง verify:
  - Hardware Device Fingerprint (จาก Cloudflared Verify)
  - header `Referer` กับ allowlist
  - `User-Agent` กับ bot signature ที่รู้จัก
- Direct R2 URL ต้องไม่เคยเปิดเผยให้ client
- ต้องตรวจสอบสถานะ 1-Hour Verification Window ในทุก asset request

## 6. OBSERVABILITY STANDARD
- ทุก cross-service call ต้อง emit structured log:
  `{ timestamp, service, task_id, event, duration_ms, status }`
- Error ต้องมี context เสมอ:
  `{ error_code, message, service_origin, task_id }`
- ห้าม log raw image data หรือ user PII

## 7. MIT SERVER TROUBLESHOOTING & RECOVERY
- **Port Conflict (Errno 10048):** บน Windows ถ้า MIT ไม่สามารถ bind port 5003 ใช้ `netstat -ano | findstr :5003` เพื่อหา PID และ `taskkill /F /PID <PID>` ก่อน restart
- **Missing Dependencies (Python 3.13+):** Package บางตัวเช่น `pydensecrf` และ `pydantic-core` อาจ compile ไม่ได้บน Python 3.13
  - แนะนำ: ใช้ `venv` ที่เสถียรกับ Python 3.12 เสมอ
- **Git Ignore & Rollback:** โฟลเดอร์ `lib/` และ `venv/` ถูก ignore โดย Git การ `git checkout` หรือ rollback จะไม่คืนค่าสิ่งเหล่านี้

## 8. หลักการ UI/UX (META-DESIGN)
- **Liquid Glass Sticky Navigation:** สำหรับหน้าที่มีเนื้อหายาว navigation element ต้องเป็น `sticky` หรือ `fixed`
- **Visual Style:** ใช้ effect "Liquid Glass" — background โปร่งแสง (`bg-white/10` หรือ `bg-black/20`), blur พื้นหลัง (`backdrop-blur-md`) และมุมโค้ง
- **Premium Iconography:** ห้ามใช้ emoji สำหรับ UI element ใดๆ — ในโค้ดหรือใน interface แทนด้วย SVG ความละเอียดสูง
- **Smooth Interaction Standard:** ทุก interactive element ต้องใช้ `.smooth-hover` (0.18s) หรือ `.smooth-hover-fast` (0.08s)
- **Optimistic UI Updates:** สำหรับ interaction ที่ต้องการความรู้สึก instant (โหวต, ถูกใจ, bookmark) UI ต้องสะท้อนสถานะใหม่ทันทีก่อนได้รับ response จาก server

## 9. กระบวนการพัฒนาและกฎการดำเนินงาน

### คำสั่งเริ่ม Service
| Service | คำสั่ง |
|---|---|
| Backend (NestJS) | `bun run start:dev` |
| Frontend (Next.js) | `bun run dev` |
| MIT Server | `.\MIT\run-server.bat` |

### Checklist บังคับหลังแก้ไข
หลัง code change ทุกครั้ง ต้องทำตามลำดับดังนี้:

1. **อัปเดตเอกสาร** — ซิงค์เอกสารทุกส่วนที่เกี่ยวข้องให้สะท้อนการเปลี่ยนแปลง
2. **ตรวจ Log** — verify log จาก service ที่ได้รับผลกระทบหลังแก้ทุกครั้ง
3. **Restart MIT Server** — ถ้าแก้ไขไฟล์ MIT ต้อง restart ด้วยตนเองผ่าน `.\MIT\run-server.bat` MIT ไม่มีกลไก auto-restart
4. **ห้ามใช้ Emoji ในโค้ด** — ห้ามใช้ emoji ใน source code, comment หรือ log message ใดๆ
<!-- lang:end -->
