# Backend (NestJS API)

## Phase 5 development tests

`npm run test:phase5` builds the Backend and runs the isolated PostgreSQL, Nest HTTP and push-worker integration cases. `npm run test:phase5-db` runs only the migration/function tests. These use PGlite and simulated Redis/Expo boundaries; no production credentials are needed. See the [implementation and release record](../docs/reports/phase5-2026-10-24/README.md) before applying migrations or enabling push.

คำสั่ง `npm run test:phase5` build และทดสอบ PostgreSQL/Nest HTTP/Push worker ภายในเครื่อง ส่วน `npm run test:phase5-db` ตรวจเฉพาะ migration/function ใช้ PGlite และจำลอง Redis/Expo ไม่ต้องใช้ credentials จริง อ่าน[รายงานและขั้นตอนก่อนเปิดใช้](../docs/reports/phase5-2026-10-24/README.md) ก่อนลง migration หรือเปิด Push

Backend สำหรับ MangaDock ใช้ NestJS เป็น API และ orchestration layer ของระบบ

## เทคโนโลยี

- NestJS
- Supabase SDK
- Redis cache

## การตั้งค่า

1. ติดตั้งแพ็กเกจ

```bash
bun install
```

2. สร้างไฟล์ `.env`

```bash
cp .env.example .env
```

3. ใส่ค่าที่จำเป็นใน `.env`

Sensitive values ที่ต้องกรอกเอง:
- `GEMINI_API_KEY` — จาก Google AI Studio
- `SUPABASE_URL` — URL ของโปรเจกต์ Supabase
- `SUPABASE_SERVICE_ROLE_KEY` — Service role key ของ Supabase (ใช้ฝั่ง backend เท่านั้น)

```env
GEMINI_API_KEY=your-gemini-api-key

PORT=4001
FRONTEND_ORIGIN=http://localhost:4000
MANGA_TRANSLATOR_URL=http://localhost:5003
REDIS_HOST=localhost
REDIS_PORT=6379

SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

4. รัน Backend

```bash
bun run start:dev
```

API จะรันที่ http://localhost:4001

## Debugging — ล้าง translated-patch cache

ตอน debug ระบบแปล (MIT) cache ทุกชั้นจะ replay ผลเก่าแทนการแปลใหม่ ใช้คำสั่งนี้ล้างให้หมดในครั้งเดียว:

```bash
npm run cache:reset              # ลบจริง: Redis translate:manga-patches:* + L3 disk (.cache) + uploads/patches
npm run cache:reset -- --dry-run # ดูว่าจะลบอะไรก่อน ไม่แตะของจริง
```

ลบเฉพาะ namespace `translate:manga-patches:*` เท่านั้น — cache ของ forum/search/mangadex/glossary ไม่โดนแตะ (logic การเลือกถูก unit-test ใน `src/cache/translation-cache-reset.ts`) หลังรันให้ restart backend เพื่อล้าง L1 in-memory ด้วย
