# ADR 033: Phase 5 retention and durable push delivery

Status: Accepted for source implementation; deployment and remote-device acceptance pending.

## Context

The existing Phase 5 branch already contains the Expo client and its device-registration contract (ADR 032). Web follows, saved manga, history and notifications exist, but there is no following/ranked feed, shareable custom collection, or server push pipeline. The user authorized implementation on this existing branch.

## Decision

- Add a bounded `retention` module. PostgreSQL filters and ranks live community posts before paging. Following is chronological; personalized ranking uses followed authors, the caller's saved/read manga, net votes and age decay. Reuse `PostCard`, auth, API proxy, themes and the manga selector. No shared personalized cache or ML service.
- Collections default to private. The API derives owners from verified auth. A single SQL statement checks read visibility and reads items; writes are owner-scoped. Parent-row locks protect quotas (100 lists/account; 200 manga/list). Direct anon/authenticated table access and server RPC execution are revoked; service_role is the API boundary. Public reads are anonymous and reveal only explicitly public lists.
- Implement ADR 032's PUT/DELETE contract without changing the Mobile client. Device and token binding is serialized in a small database transaction; cleanup matches owner/device/token. Binding UUID snapshots prevent an old queued event or receipt from acting on a new owner. Per-account event preferences are rechecked at claim time.
- Follow insertion and local chapter-version publication insert inbox notifications and per-device outbox entries in the originating transaction. Repeated follow upserts and version republishing do not announce twice. Existing published versions are marked without backfilling notifications.
- Use a separate Redis sorted-set dispatch queue, reconstructed from durable PostgreSQL due rows. Independent workers claim with database leases/`SKIP LOCKED`; no cache leader participates. Retries stop at five attempts per stage or 24 hours. Tickets move to a delayed receipt stage; invalid registrations are removed only for the original binding. PostgreSQL stores dead/skipped/delivered outcomes; a bounded Redis dead list is an operational aid.
- Keep server and native rollout disabled by default. Expo requests use fixed URLs, optional server-only enhanced-security credentials, generic lock-screen copy, and deadlines. A successful receipt means provider acceptance, not proof of display. Ambiguous network/process failures can duplicate delivery.

## Alternatives considered

Extending the forum monolith or creating separate copies of cards/auth adds maintenance cost; this module attaches at existing boundaries instead. In-memory ranking of one fetched page gives incorrect global ordering. Public database policies expose a second access path to private collections, so reads stay behind the API. Redis-only delivery loses work after eviction or a popped-job crash. Building a new broker, trained recommender, or replacing the Expo client is unnecessary.

## Consequences

Source and local full-stack behavior can be verified without production credentials. Migrations must be applied once, in order, against the real schema before release. Following currently covers public community posts (including manga-update posts); local chapter publication drives push, while external MangaDex polling is not added. Ranking can change between offset pages; the UI deduplicates IDs and refreshes when switching modes. Collection web URLs work independently of native routes; native collection screens/deep links remain separate work. In-flight pushes cannot be recalled after submission, and owner/device/token cleanup cannot distinguish a same-owner/same-token ABA re-registration without extending the client protocol. Production retention housekeeping and throughput validation remain operational acceptance tasks.

## ภาษาไทย

สถานะ: รับการออกแบบและทำ source แล้ว ยังรอ migration/deploy และรับ Push บนเครื่องจริง

บริบท: branch Phase 5 มี Expo client และสัญญาลงทะเบียนอุปกรณ์ตาม ADR 032 แล้ว ผู้ใช้อนุญาตให้พัฒนาต่อบน branch เดิม แต่ยังขาด Feed, คอลเลกชันแชร์ได้ และท่อส่ง Backend

การตัดสินใจ: แยกโมดูล retention ใช้ PostgreSQL กรองและจัดอันดับโพสต์ก่อนแบ่งหน้า Following เรียงเวลา ส่วนสำหรับคุณใช้ผู้เขียนที่ติดตาม เรื่องที่บัญชีนั้นบันทึกหรืออ่าน คะแนนโหวตสุทธิและอายุโพสต์ ใช้ UI/Auth/proxy/tokens เดิม ไม่เพิ่ม ML หรือ cache ส่วนตัวร่วมกัน คอลเลกชันเริ่มเป็นส่วนตัว ตรวจเจ้าของจาก Auth และตรวจสิทธิ์อ่านพร้อมดึงรายการใน SQL เดียว ล็อกแถวป้องกัน quota เกิน ปิดสิทธิ์ตาราง/RPC สำหรับ anon/authenticated โดยให้ API ใช้ service_role

ทำสัญญา PUT/DELETE เดิมของ Mobile ลงทะเบียน device/token แบบ transaction พร้อม binding UUID กัน event/receipt เก่าแก้เจ้าของใหม่ การติดตามและเผยแพร่เวอร์ชันตอนในระบบสร้าง inbox/outbox ใน transaction เดียว ไม่แจ้งซ้ำจาก upsert หรือเผยแพร่เวอร์ชันเดิม ใช้ Redis queue แยกและ PostgreSQL lease รองรับหลาย worker โดยไม่ใช้ cache leader ลองซ้ำไม่เกินห้าครั้งต่อ stage หรือ 24 ชั่วโมง ตรวจ receipt ภายหลัง และลบ token เสียเฉพาะ binding เดิม ปิด rollout ทั้งสองฝั่งเป็นค่าเริ่มต้น ข้อความ lock screen ไม่ใส่ข้อมูลส่วนตัว ไม่อ้างส่งถึงเครื่องแบบ exactly-once

ทางเลือก: ไม่ขยาย forum monolith ไม่คัดลอก UI/Auth ไม่จัดอันดับเฉพาะหน้าที่โหลดมา ไม่เปิดเส้นทางฐานข้อมูลตรงสำหรับคอลเลกชัน ไม่พึ่ง Redis อย่างเดียว และไม่เพิ่ม broker/model/client ใหม่

ผลตามมา: ทดสอบ source และ full-stack ภายในเครื่องได้ก่อนใช้ credentials จริง ต้องเทียบ schema และลง migration ตามลำดับก่อน release Feed ครอบคลุมโพสต์สาธารณะ; Push ตอนใหม่มาจาก chapter_versions ภายในระบบ ยังไม่เพิ่ม polling MangaDex อันดับอาจเปลี่ยนระหว่างหน้า UI กัน ID ซ้ำและโหลดใหม่เมื่อเปลี่ยนโหมด ลิงก์คอลเลกชันเปิดเว็บได้ ส่วนหน้าจอ/deep link Native ยังแยกงาน Push ที่ส่งออกไปแล้วเรียกคืนไม่ได้ และ cleanup สัญญาเดิมแยกกรณีกลับมาบัญชีเดิม/token เดิมไม่ได้หากไม่เพิ่ม version ใน client ยังต้องรับผล throughput และวาง housekeeping บน production
