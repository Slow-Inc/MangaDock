# Cloudflare R2 + Worker — Implementation Guide

อ้างอิง: [ADR 001](./adr/001-cloudflare-r2-storage.md)

---

## สารบัญ

1. [Prerequisites](#1-prerequisites)
2. [ตั้งค่า R2 Bucket](#2-ตั้งค่า-r2-bucket)
3. [Backend — R2StorageProvider](#3-backend--r2storageprovider)
4. [Backend — StorageModule (feature flag)](#4-backend--storagemodule-feature-flag)
5. [Backend — img-cache DB migration](#5-backend--img-cache-db-migration)
6. [Cloudflare Worker](#6-cloudflare-worker)
7. [Frontend — image URL helper](#7-frontend--image-url-helper)
8. [Environment Variables Reference](#8-environment-variables-reference)
9. [Migration Steps](#9-migration-steps)
10. [Rollback](#10-rollback)

---

## 1. Prerequisites

- Cloudflare account ที่มี domain `2552667.xyz` อยู่ใน Cloudflare DNS (orange cloud)
- Cloudflare plan ที่รองรับ **Image Resizing** (Pro ขึ้นไป หรือ Image Resizing add-on)
  - ถ้ายังไม่มี: Worker serve รูปได้ปกติ แต่ `?w=&f=` params จะถูก ignore
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) `>= 3.x`
- Node.js `>= 18`

```bash
npm install -g wrangler
wrangler login
```

---

## 2. ตั้งค่า R2 Bucket

### สร้าง bucket

```bash
wrangler r2 bucket create mangadock-assets
```

### สร้าง R2 API Token (สำหรับ NestJS backend)

1. ไปที่ Cloudflare Dashboard → **R2 → Manage R2 API Tokens**
2. สร้าง token ด้วย permission: **Object Read & Write** สำหรับ bucket `mangadock-assets`
3. บันทึก:
   - Account ID (หน้า dashboard ขวาบน)
   - Access Key ID
   - Secret Access Key

> **อย่า commit credentials ลง git เด็ดขาด** — ใส่ใน `.env` เท่านั้น

---

## 3. Backend — R2StorageProvider

ติดตั้ง AWS S3 SDK (R2 รองรับ S3-compatible API):

```bash
cd Backend
npm install @aws-sdk/client-s3 @aws-sdk/lib-storage
```

สร้างไฟล์ `Backend/src/common/storage/r2-storage.provider.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { StorageProvider } from './storage-provider.interface';

@Injectable()
export class R2StorageProvider implements StorageProvider {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly logger = new Logger(R2StorageProvider.name);

  constructor(private readonly config: ConfigService) {
    const accountId = config.getOrThrow<string>('R2_ACCOUNT_ID');
    this.bucket = config.getOrThrow<string>('R2_BUCKET_NAME');

    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.getOrThrow<string>('R2_ACCESS_KEY_ID'),
        secretAccessKey: config.getOrThrow<string>('R2_SECRET_ACCESS_KEY'),
      },
    });
  }

  async put(
    key: string,
    data: Buffer | string | Readable,
    options?: { contentType?: string },
  ): Promise<void> {
    if (data instanceof Readable) {
      const upload = new Upload({
        client: this.client,
        params: {
          Bucket: this.bucket,
          Key: key,
          Body: data,
          ContentType: options?.contentType,
        },
      });
      await upload.done();
    } else {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: data,
          ContentType: options?.contentType,
        }),
      );
    }
  }

  async get(key: string): Promise<Buffer> {
    const { Body } = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    if (!Body) throw new Error(`R2: object not found — ${key}`);
    const chunks: Buffer[] = [];
    for await (const chunk of Body as AsyncIterable<Uint8Array>) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  async deleteDir(prefix: string): Promise<void> {
    const keys = await this.list(prefix);
    await Promise.all(keys.map((k) => this.delete(k)));
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return true;
    } catch {
      return false;
    }
  }

  async list(prefix: string): Promise<string[]> {
    const keys: string[] = [];
    let token: string | undefined;
    do {
      const res = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ContinuationToken: token,
        }),
      );
      for (const obj of res.Contents ?? []) {
        if (obj.Key) keys.push(obj.Key);
      }
      token = res.NextContinuationToken;
    } while (token);
    return keys;
  }

  // no-op — R2 ไม่มี concept ของ directory
  async ensureDir(_path: string): Promise<void> {}
}
```

---

## 4. Backend — StorageModule (feature flag)

แก้ไข `Backend/src/common/storage/storage.module.ts`:

```typescript
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { STORAGE_PROVIDER } from './storage-provider.interface';
import { DiskStorageProvider } from './disk-storage.provider';
import { R2StorageProvider } from './r2-storage.provider';

@Global()
@Module({
  providers: [
    {
      provide: STORAGE_PROVIDER,
      useFactory: (config: ConfigService) => {
        const provider = config.get<string>('STORAGE_PROVIDER', 'disk');
        return provider === 'r2'
          ? new R2StorageProvider(config)
          : new DiskStorageProvider();
      },
      inject: [ConfigService],
    },
  ],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}
```

เปิด R2 ด้วยการตั้ง env var:
```bash
STORAGE_PROVIDER=r2
```

---

## 5. Backend — img-cache DB migration

เพิ่ม table ใน Supabase สำหรับ img-cache metadata:

```sql
-- apply via Supabase MCP: apply_migration
CREATE TABLE IF NOT EXISTS img_cache (
  url_hash  TEXT PRIMARY KEY,          -- SHA-256 ของ original URL
  r2_key    TEXT NOT NULL,             -- key ใน R2 bucket (uploads/img-cache/...)
  mime_type TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,     -- TTL สำหรับ eviction
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS img_cache_expires_idx ON img_cache (expires_at);
```

`ImageCacheService` ต้อง update ให้:
1. ตรวจ `img_cache` table ก่อน (cache hit) → return R2 public URL ผ่าน Worker
2. Cache miss → download → `storage.put(r2Key, buffer)` → `INSERT img_cache`

---

## 6. Cloudflare Worker

### โครงสร้างไฟล์

```
cloudflare-worker/
├── wrangler.toml
├── package.json
└── src/
    └── index.ts
```

### `wrangler.toml`

```toml
name = "mangadock-assets"
main = "src/index.ts"
compatibility_date = "2024-01-01"

routes = [
  { pattern = "assets.2552667.xyz/*", zone_name = "2552667.xyz" }
]

[[r2_buckets]]
binding = "BUCKET"
bucket_name = "mangadock-assets"
```

### `src/index.ts`

```typescript
export interface Env {
  BUCKET: R2Bucket;
}

const CACHE_TTL = 60 * 60 * 24 * 365; // 1 ปี (immutable assets)

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const url = new URL(request.url);
    const key = decodeURIComponent(url.pathname.slice(1)); // ตัด leading /

    if (!key) return new Response('Not Found', { status: 404 });

    // ตรวจ ETag cache
    const object = await env.BUCKET.get(key, {
      onlyIf: request.headers,
      range: request.headers,
    });

    if (object === null) {
      return new Response('Not Found', { status: 404 });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('Cache-Control', `public, max-age=${CACHE_TTL}, immutable`);
    headers.set('ETag', object.httpEtag);
    headers.set('Access-Control-Allow-Origin', '*');

    if ('status' in object && object.status === 304) {
      return new Response(null, { status: 304, headers });
    }

    // ถ้ามี transform params และ account รองรับ Image Resizing
    const w = url.searchParams.get('w');
    const h = url.searchParams.get('h');
    const fit = url.searchParams.get('fit') ?? 'scale-down';
    const q = url.searchParams.get('q') ?? '85';
    const f = url.searchParams.get('f') ?? 'auto';

    const needsTransform = w || h || f !== 'auto';

    if (needsTransform) {
      // ดึงรูปจาก R2 แล้วส่งผ่าน Cloudflare Image Resizing
      // หมายเหตุ: ต้องการ Image Resizing feature บน Cloudflare account
      const imageRequest = new Request(`https://assets.2552667.xyz/${key}?no-transform`, {
        headers: { 'cf-no-transform': '1' },
      });
      return fetch(imageRequest, {
        cf: {
          image: {
            ...(w ? { width: parseInt(w) } : {}),
            ...(h ? { height: parseInt(h) } : {}),
            fit: fit as 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad',
            quality: parseInt(q),
            format: f as 'auto' | 'webp' | 'avif',
          },
        },
      });
    }

    return new Response(object.body as ReadableStream, { headers });
  },
};
```

### Deploy

```bash
cd cloudflare-worker
npm install
wrangler deploy
```

---

## 7. Frontend — image URL helper

สร้างไฟล์ `Frontend/app/lib/assetUrl.ts`:

```typescript
const USE_CF_WORKER = process.env.NEXT_PUBLIC_USE_CF_WORKER === 'true';
const CF_WORKER_URL = process.env.NEXT_PUBLIC_CF_WORKER_URL ?? '';

export interface ImageTransformOptions {
  w?: number;
  h?: number;
  fit?: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad';
  q?: number;
  f?: 'auto' | 'webp' | 'avif';
}

/**
 * แปลง relative upload path เป็น URL ที่ถูกต้อง
 *
 * ถ้า NEXT_PUBLIC_USE_CF_WORKER=true → ชี้ไปที่ Cloudflare Worker
 * ถ้าไม่ → ใช้ /api/proxy/... (backend proxy เดิม)
 */
export function assetUrl(
  path: string,
  transform?: ImageTransformOptions,
): string {
  if (!path) return '';

  // ถ้าเป็น absolute URL อยู่แล้ว (http/https) → return ตรงๆ
  if (path.startsWith('http')) return path;

  // normalize: /uploads/... หรือ uploads/...
  const normalized = path.startsWith('/') ? path.slice(1) : path;

  if (USE_CF_WORKER && CF_WORKER_URL) {
    const url = new URL(`${CF_WORKER_URL}/${normalized}`);
    if (transform?.w) url.searchParams.set('w', String(transform.w));
    if (transform?.h) url.searchParams.set('h', String(transform.h));
    if (transform?.fit) url.searchParams.set('fit', transform.fit);
    if (transform?.q) url.searchParams.set('q', String(transform.q));
    if (transform?.f) url.searchParams.set('f', transform.f);
    return url.toString();
  }

  return `/api/proxy/${normalized}`;
}
```

ใช้ใน component:

```tsx
import { assetUrl } from '../lib/assetUrl';

// รูปปกติ
<img src={assetUrl(chapter.coverUrl)} />

// resize สำหรับ thumbnail
<img src={assetUrl(book.thumbnail, { w: 300, f: 'webp' })} />

// avatar
<img src={assetUrl(user.photoURL, { w: 80, h: 80, fit: 'cover', f: 'webp' })} />
```

---

## 8. Environment Variables Reference

### `Backend/.env`

```bash
# Storage provider: disk (default) | r2
STORAGE_PROVIDER=r2

# Cloudflare R2 credentials (S3-compatible)
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_BUCKET_NAME=mangadock-assets

# Public URL ที่ใช้ build URL ของรูปใน backend (เช่น PatchStore)
R2_PUBLIC_URL=https://assets.2552667.xyz
```

### `Frontend/.env`

```bash
# เปิด/ปิด Cloudflare Worker image serving
NEXT_PUBLIC_USE_CF_WORKER=true
NEXT_PUBLIC_CF_WORKER_URL=https://assets.2552667.xyz
```

### `cloudflare-worker/wrangler.toml`

Worker ใช้ R2 binding โดยตรง ไม่ต้องการ credentials ในไฟล์ config

---

## 9. Migration Steps

### Phase 1 — Setup (ไม่กระทบ production)

1. สร้าง R2 bucket: `wrangler r2 bucket create mangadock-assets`
2. สร้าง R2 API Token จาก Cloudflare Dashboard
3. Deploy Worker: `cd cloudflare-worker && wrangler deploy`
4. ตรวจสอบ DNS: `assets.2552667.xyz` ชี้ไปที่ Worker ถูกต้อง
5. Apply Supabase migration (img_cache table)

### Phase 2 — Backend switch (staging ก่อน)

1. ตั้ง env vars ใน staging server:
   ```bash
   STORAGE_PROVIDER=r2
   R2_ACCOUNT_ID=...
   R2_ACCESS_KEY_ID=...
   R2_SECRET_ACCESS_KEY=...
   R2_BUCKET_NAME=mangadock-assets
   R2_PUBLIC_URL=https://assets.2552667.xyz
   ```
2. Restart backend
3. ทดสอบ upload รูปใหม่ → ตรวจว่าปรากฏที่ `assets.2552667.xyz/uploads/...`
4. ทดสอบ resize: `https://assets.2552667.xyz/uploads/.../file.jpg?w=400&f=webp`

### Phase 3 — Frontend switch

1. ตั้ง env vars ใน Frontend:
   ```bash
   NEXT_PUBLIC_USE_CF_WORKER=true
   NEXT_PUBLIC_CF_WORKER_URL=https://assets.2552667.xyz
   ```
2. Replace image URLs ที่ hardcode `/api/proxy/uploads/` ให้ใช้ `assetUrl()` helper

### Phase 4 — Migrate existing files (optional)

รูปเก่าที่อยู่บน disk ยังเข้าถึงได้ผ่าน `/api/proxy/uploads/` เดิม
ถ้าต้องการย้ายทั้งหมดไป R2:

```bash
# ตัวอย่าง script sync disk → R2
wrangler r2 object put mangadock-assets/uploads/ --file ./uploads/ --recursive
```

> ไม่จำเป็นต้องทำทันที — รูปเก่าเข้าถึงผ่าน proxy เดิมได้จนกว่าจะ migrate

---

## 10. Rollback

ถ้าพบปัญหาหลัง switch ไป R2:

```bash
# Backend: กลับไป disk
STORAGE_PROVIDER=disk  # แล้ว restart

# Frontend: กลับไป proxy เดิม
NEXT_PUBLIC_USE_CF_WORKER=false  # แล้ว rebuild
```

ไม่มีข้อมูลสูญหาย — รูปที่ upload ไป R2 ยังอยู่, รูปเก่าบน disk ยังอยู่ครบ
