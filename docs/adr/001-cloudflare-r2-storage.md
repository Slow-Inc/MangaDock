# ADR 001 — Cloudflare R2 + Worker for Image Storage

**Status:** Accepted  
**Date:** 2026-06-08  

---

## Context

ปัจจุบัน MangaDock เก็บรูปภาพทั้งหมดบน disk ของ server ผ่าน `DiskStorageProvider`:

- `uploads/chapters/` — หน้ามังงะที่ translator อัปโหลด
- `uploads/patches/` — รูปผล AI translation (region-based)
- `uploads/avatars/` — รูปโปรไฟล์ผู้ใช้
- `uploads/forum/` — รูปในโพสต์คอมมูนิตี้
- `uploads/img-cache/` — cache รูปจาก CDN ภายนอก

ปัญหาที่เกิดจาก disk storage:

1. **Scalability** — disk โตตาม content ไม่สิ้นสุด, ต้อง mount volume ใหม่เมื่อเต็ม
2. **No CDN** — รูปทุกอันวิ่งผ่าน NestJS backend → latency สูงสำหรับ user ต่างประเทศ
3. **No image transformation** — frontend ต้องโหลดรูป full resolution แล้ว scale เอง
4. **Single point of failure** — server down = รูปทั้งหมดหายไป

---

## Decision

ย้าย storage ไปยัง **Cloudflare R2** (object storage) และ serve ผ่าน **Cloudflare Worker** ที่ `assets.2552667.xyz`

### Architecture

```
Upload path (write):
  Browser → Next.js proxy → NestJS (validate + auth) → R2 SDK → R2 bucket

Serve path (read):
  Browser → Cloudflare Worker (assets.2552667.xyz) → R2 bucket
               ↑ image transformation (resize, WebP, quality)

img-cache path:
  Cache miss: NestJS → fetch CDN → write R2 + INSERT Supabase (metadata)
  Cache hit:  Browser → Worker → R2 (serve ตาม r2_key ใน DB)
```

### Key decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Bucket count | 1 bucket (`mangadock-assets`) | path prefix แยก concern, env var เดียว |
| Bucket access | Private | Worker = single entry point, บังคับ cache headers |
| Migration | Feature flag (`STORAGE_PROVIDER=r2`) | rollback ได้ทันที |
| img-cache store | metadata ใน Supabase, binary ใน R2 | DB เบา, R2 serve ผ่าน Worker |
| Transform API | Query params `?w=&h=&fit=&q=&f=` | cacheable, ง่าย integrate กับ Next.js `<Image>` |
| Worker domain | `assets.2552667.xyz` (custom domain) | Cloudflare CDN edge cache เต็มรูปแบบ |

---

## Consequences

**ดี:**
- รูปถูก serve จาก Cloudflare edge ทั่วโลก — latency ลดลงมาก
- Image transformation (resize, WebP) ที่ edge — bandwidth ลด
- Disk บน server ไม่โตตาม content อีกต่อไป
- `StorageProvider` interface ไม่ต้องเปลี่ยน — แค่ swap implementation

**ต้องระวัง:**
- Cloudflare Image Resizing ต้องการ plan ที่รองรับ (Pro ขึ้นไป หรือ add-on)
- R2 มี free tier (10 GB storage, 1M Class A ops/month) แต่ต้องติดตาม usage
- img-cache เดิม (disk) ต้อง migrate ข้อมูลหรือ warm up cache ใหม่

**ไม่เปลี่ยน:**
- Upload flow ทั้งหมด (auth, MIME validation) ยังอยู่ใน NestJS
- Frontend upload API (`/api/proxy/upload/*`) ยังเหมือนเดิม
- Supabase schema สำหรับ chapter pages ยังเหมือนเดิม
