# Backend (NestJS API)

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
