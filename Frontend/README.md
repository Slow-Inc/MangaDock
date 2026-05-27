# Frontend (Next.js + TailwindCSS)

Landing Page สำหรับ MangaDock ในสไตล์ Netflix + Glassmorphism

## เทคโนโลยี

- Next.js (App Router)
- TailwindCSS v4
- TypeScript

## การตั้งค่า

1. ติดตั้งแพ็กเกจ

```bash
bun install
```

2. สร้างไฟล์ `.env`

```bash
cp .env.example .env
```

3. กรอกค่าที่จำเป็นใน `.env`

Supabase config (ดูจาก Supabase Dashboard → Project Settings → API):

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

ตั้งค่า backend URL:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:4001
INTERNAL_API_URL=http://localhost:4001
```

ค่าเสริมสำหรับ Cloudflare Worker/R2 และ Turnstile:

```env
NEXT_PUBLIC_CF_WORKER_URL=
NEXT_PUBLIC_USE_CF_WORKER=false
NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA
```

4. รัน Frontend

```bash
bun run dev
```

เปิดเว็บที่ http://localhost:4000

## Authentication

Frontend ใช้ Supabase Client SDK สำหรับ authentication (Google OAuth) และส่ง Supabase session token ไปยัง backend ที่แต่ละ request ผ่าน `Authorization: Bearer <token>` header
