# Image Token Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ปิดช่องโหว่ image URL sharing โดยลด TTL จาก 4h → 30min, ผูก HWID เข้ากับ token (self-contained), และเพิ่ม Sec-Fetch-Site guard บน `/books/img-proxy` และ `/img-cache`

**Architecture:** Token format เปลี่ยนจาก `expiresAt.hmac` เป็น `expiresAt.hwidB64url.hmac` — HWID ฝังอยู่ใน token โดยตรงทำให้ backend validate ได้โดยไม่ต้องการ extra query param และ `<img src>` ไม่ต้องเปลี่ยน Frontend เพิ่ม `onError` handler ที่ refetch chapter pages เพื่อ refresh token อัตโนมัติเมื่อ expire ระหว่างอ่าน

**Tech Stack:** NestJS 11 (Backend), Next.js 16 + React 19 (Frontend), HMAC-SHA256 (crypto built-in), Jest (Backend tests), Bun test (Frontend tests)

## Global Constraints

- ไม่แตะ Profile images หรือ Community post images
- ไม่เปลี่ยน `<img>` เป็น `fetch()` + blob URL
- ไม่เพิ่ม watermark ในตอนนี้
- Cover images (`/books/manga/:id/cover`) ยังคง public (ไม่ต้อง guard)
- ต้อง backward-compatible กับ `IMAGE_TOKEN_SECRET` ที่ไม่ได้ set (no-op mode)
- `timingSafeEqual` ต้องใช้เสมอ — ห้ามเปรียบเทียบ string โดยตรง

---

### Task 1: อัปเดต image-token.ts — TTL 30min + HWID binding

**Files:**
- Modify: `Backend/src/books/image-token.ts`
- Modify: `Backend/src/books/image-token.spec.ts`

**Interfaces:**
- Produces: `generateToken(chapterId: string, hwid?: string): string | undefined`
- Produces: `validateToken(chapterId: string, token: string | undefined): boolean` (signature unchanged)
- Token format: `"${expiresAt}.${hwidB64url}.${hmacHex}"` — 3 parts split by `.`

- [ ] **Step 1: แก้ test ที่ต้องผ่านก่อน**

แทนที่ทั้งไฟล์ `Backend/src/books/image-token.spec.ts`:

```typescript
import * as crypto from 'crypto';

const SECRET = 'a'.repeat(64);
const HWID = 'test-hwid-abc';

beforeEach(() => {
  process.env.IMAGE_TOKEN_SECRET = SECRET;
  jest.resetModules();
});

afterEach(() => {
  delete process.env.IMAGE_TOKEN_SECRET;
  jest.resetModules();
});

function freshFns() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('./image-token') as typeof import('./image-token');
}

describe('generateToken', () => {
  it('returns a token with expiresAt ~30min from now', () => {
    const { generateToken: gen } = freshFns();
    const token = gen('ch-1', HWID)!;
    const parts = token.split('.');
    expect(parts).toHaveLength(3);
    const delta = parseInt(parts[0], 10) - Math.floor(Date.now() / 1000);
    expect(delta).toBeGreaterThan(30 * 60 - 5);
    expect(delta).toBeLessThanOrEqual(30 * 60);
  });

  it('embeds HWID in second segment (base64url)', () => {
    const { generateToken: gen } = freshFns();
    const token = gen('ch-1', HWID)!;
    const [, hwidEncoded] = token.split('.');
    expect(Buffer.from(hwidEncoded, 'base64url').toString()).toBe(HWID);
  });

  it('falls back to "anon" when hwid is undefined', () => {
    const { generateToken: gen } = freshFns();
    const token = gen('ch-1')!;
    const [, hwidEncoded] = token.split('.');
    expect(Buffer.from(hwidEncoded, 'base64url').toString()).toBe('anon');
  });

  it('returns undefined when IMAGE_TOKEN_SECRET is not set', () => {
    delete process.env.IMAGE_TOKEN_SECRET;
    const { generateToken: gen } = freshFns();
    expect(gen('ch-1', HWID)).toBeUndefined();
  });
});

describe('validateToken', () => {
  it('accepts a freshly generated token', () => {
    const { generateToken: gen, validateToken: val } = freshFns();
    const token = gen('ch-1', HWID)!;
    expect(val('ch-1', token)).toBe(true);
  });

  it('rejects a token for a different chapterId', () => {
    const { generateToken: gen, validateToken: val } = freshFns();
    const token = gen('ch-1', HWID)!;
    expect(val('ch-2', token)).toBe(false);
  });

  it('rejects a tampered hmac', () => {
    const { generateToken: gen, validateToken: val } = freshFns();
    const token = gen('ch-1', HWID)!;
    const tampered = token.slice(0, -4) + 'ffff';
    expect(val('ch-1', tampered)).toBe(false);
  });

  it('rejects a tampered HWID segment', () => {
    const { generateToken: gen, validateToken: val } = freshFns();
    const token = gen('ch-1', HWID)!;
    const [exp, , hmac] = token.split('.');
    const fakeHwid = Buffer.from('other-device').toString('base64url');
    expect(val('ch-1', `${exp}.${fakeHwid}.${hmac}`)).toBe(false);
  });

  it('rejects an expired token', () => {
    const { validateToken: val } = freshFns();
    const pastAt = Math.floor(Date.now() / 1000) - 1;
    const hwidEncoded = Buffer.from(HWID).toString('base64url');
    const hmac = crypto
      .createHmac('sha256', SECRET)
      .update(`ch-1:${pastAt}:${HWID}`)
      .digest('hex');
    expect(val('ch-1', `${pastAt}.${hwidEncoded}.${hmac}`)).toBe(false);
  });

  it('rejects old 2-part token format', () => {
    const { validateToken: val } = freshFns();
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;
    const hmac = crypto
      .createHmac('sha256', SECRET)
      .update(`ch-1:${expiresAt}`)
      .digest('hex');
    expect(val('ch-1', `${expiresAt}.${hmac}`)).toBe(false);
  });

  it('returns true (skip) when IMAGE_TOKEN_SECRET is not set', () => {
    delete process.env.IMAGE_TOKEN_SECRET;
    const { validateToken: val } = freshFns();
    expect(val('ch-1', undefined)).toBe(true);
  });

  it('rejects missing token when secret is set', () => {
    const { validateToken: val } = freshFns();
    expect(val('ch-1', undefined)).toBe(false);
  });
});
```

- [ ] **Step 2: รัน test เพื่อยืนยันว่า fail**

```bash
cd Backend && npx jest src/books/image-token.spec.ts --no-coverage
```

Expected: หลาย test fail เพราะ format ยังเป็น 2-part

- [ ] **Step 3: แก้ image-token.ts**

แทนที่ทั้งไฟล์ `Backend/src/books/image-token.ts`:

```typescript
import * as crypto from 'crypto';

const SECRET = process.env.IMAGE_TOKEN_SECRET;
const TTL_SECONDS = 30 * 60; // 30 minutes

export function generateToken(chapterId: string, hwid?: string): string | undefined {
  if (!SECRET) return undefined;
  const h = hwid || 'anon';
  const expiresAt = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  const hwidEncoded = Buffer.from(h).toString('base64url');
  const hmac = crypto
    .createHmac('sha256', SECRET)
    .update(`${chapterId}:${expiresAt}:${h}`)
    .digest('hex');
  return `${expiresAt}.${hwidEncoded}.${hmac}`;
}

export function validateToken(
  chapterId: string,
  token: string | undefined,
): boolean {
  if (!SECRET) return true;
  if (!token || !chapterId) return false;
  const firstDot = token.indexOf('.');
  if (firstDot < 0) return false;
  const lastDot = token.lastIndexOf('.');
  if (firstDot === lastDot) return false; // old 2-part format — reject
  const expiresAt = parseInt(token.slice(0, firstDot), 10);
  if (isNaN(expiresAt) || Math.floor(Date.now() / 1000) > expiresAt) return false;
  const hwidEncoded = token.slice(firstDot + 1, lastDot);
  const hmac = token.slice(lastDot + 1);
  let h: string;
  try {
    h = Buffer.from(hwidEncoded, 'base64url').toString();
    if (!h) return false;
  } catch {
    return false;
  }
  const expected = crypto
    .createHmac('sha256', SECRET)
    .update(`${chapterId}:${expiresAt}:${h}`)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(
      Buffer.from(hmac, 'hex'),
      Buffer.from(expected, 'hex'),
    );
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: รัน test เพื่อยืนยัน pass**

```bash
cd Backend && npx jest src/books/image-token.spec.ts --no-coverage
```

Expected: PASS ทุก test

- [ ] **Step 5: Commit**

```bash
git add Backend/src/books/image-token.ts Backend/src/books/image-token.spec.ts
git commit -m "feat(security): harden image token — TTL 30min + HWID binding"
```

---

### Task 2: เพิ่ม Sec-Fetch-Site check ใน ImageTokenGuard

**Files:**
- Modify: `Backend/src/books/image-token.guard.ts`

**Interfaces:**
- Consumes: `validateToken` จาก Task 1
- Guard ปฏิเสธ request ที่มี `Sec-Fetch-Site: cross-site` header

- [ ] **Step 1: แก้ image-token.guard.ts**

แทนที่ทั้งไฟล์:

```typescript
import {
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { validateToken } from './image-token';

export class ImageTokenGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    const fetchSite = req.headers['sec-fetch-site'];
    if (fetchSite === 'cross-site') {
      throw new UnauthorizedException('cross-origin image access denied');
    }
    const t = req.query.t as string | undefined;
    const cid = req.query.cid as string | undefined;
    if (!validateToken(cid ?? '', t))
      throw new UnauthorizedException('invalid image token');
    return true;
  }
}
```

- [ ] **Step 2: รัน test ของ img-cache.controller เพื่อให้แน่ใจว่าไม่แตก**

```bash
cd Backend && npx jest src/common/storage/img-cache.controller.spec.ts --no-coverage
```

Expected: PASS (mock guard ใน spec ไม่กระทบ)

- [ ] **Step 3: Commit**

```bash
git add Backend/src/books/image-token.guard.ts
git commit -m "feat(security): block cross-site image requests via Sec-Fetch-Site guard"
```

---

### Task 3: ส่ง HWID ใน books.controller getMangaChapterPages

**Files:**
- Modify: `Backend/src/books/books.controller.ts` (line 159–167)

**Interfaces:**
- Consumes: `generateToken(chapterId, hwid)` จาก Task 1
- HWID อ่านจาก `x-hardware-id` header (เหมือน `uid` ที่มีอยู่แล้ว)

- [ ] **Step 1: แก้บรรทัด generateToken ใน getMangaChapterPages**

ใน `Backend/src/books/books.controller.ts` หาบรรทัด:
```typescript
const uid = (req?.headers?.['x-hardware-id'] as string) || 'anon';
```
และบรรทัด:
```typescript
return { ...result, imageToken: generateToken(chapterId) };
```

แก้เฉพาะบรรทัด return เป็น:
```typescript
return { ...result, imageToken: generateToken(chapterId, uid) };
```

(ใช้ `uid` ที่มีอยู่แล้วในบรรทัดก่อนหน้าซึ่ง fallback เป็น `'anon'` อยู่แล้ว)

- [ ] **Step 2: รัน lint**

```bash
cd Backend && npm run lint -- --fix
```

Expected: ไม่มี error

- [ ] **Step 3: Commit**

```bash
git add Backend/src/books/books.controller.ts
git commit -m "feat(security): bind image token to HWID at generation"
```

---

### Task 4: Frontend — token refresh on image error

**Files:**
- Modify: `Frontend/app/components/reader/PageRenderer.tsx`
- Modify: `Frontend/app/components/MangaReader.tsx`

**Interfaces:**
- `PageRendererProps` เพิ่ม: `onImageError?: () => void`
- `onImageError` ถูก wired กับ `onError` บน `<img>` หลัก (ไม่ใช่ patch overlay)

- [ ] **Step 1: เพิ่ม onImageError prop ใน PageRenderer**

ใน `Frontend/app/components/reader/PageRenderer.tsx`:

เพิ่มใน `PageRendererProps` interface (หลัง `setImgLoading`):
```typescript
onImageError?: () => void;
```

เพิ่ม `onImageError` ใน destructure ของ `PageRendererImpl`:
```typescript
onImageError,
```

แล้วเพิ่ม `onError={onImageError}` บน `<img>` หลัก **ทั้ง 2 mode** (continuous และ paged) — เฉพาะ img ที่แสดงหน้า manga ไม่ใช่ patch overlay:

**Continuous mode** — img บรรทัด 91:
```tsx
<img
  ref={(el) => { pageRefs.current[i] = el; }}
  data-page-idx={i}
  src={showTranslation && translatedPages.has(i) ? translatedPages.get(i)! : src}
  alt={`หน้า ${i + 1}`}
  draggable={false}
  loading="lazy"
  className="w-full select-none"
  onError={onImageError}
/>
```

**Paged mode** — img บรรทัด 186:
```tsx
<img
  key={showTranslation && translatedPages.has(page) ? `tr-${pages[page]}` : pages[page]}
  src={showTranslation && translatedPages.has(page) ? translatedPages.get(page)! : pages[page]}
  alt={`หน้า ${page + 1}`}
  draggable={false}
  className={`block max-h-[calc(100vh-120px)] max-w-full transition-opacity duration-200 ${imgLoading ? "opacity-0" : "opacity-100"}`}
  onLoad={() => setImgLoading(false)}
  onLoadStart={() => setImgLoading(true)}
  onError={onImageError}
/>
```

- [ ] **Step 2: เพิ่ม handleImgError ใน MangaReader.tsx**

ใน `Frontend/app/components/MangaReader.tsx` เพิ่ม import `useRef` และ `useCallback` (ถ้ายังไม่มี) แล้วเพิ่ม hook หลัง useMemo ของ `pages`:

```typescript
const tokenRefreshingRef = useRef(false);
const handleImgError = useCallback(() => {
  if (tokenRefreshingRef.current || !currentChapterId || !clearanceToken) return;
  tokenRefreshingRef.current = true;
  const _params = new URLSearchParams();
  if (localStorage.getItem('imgCacheForceLocal') === '1') _params.set('forceLocal', 'true');
  if (mangaId) _params.set('mangaId', mangaId);
  const _q = _params.size > 0 ? `?${_params.toString()}` : '';
  apiFetch(`${API_BASE}/books/chapters/${currentChapterId}/pages${_q}`, {
    headers: { 'x-captcha-clearance': clearanceToken },
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((d: ChapterPages | null) => { if (d) setData(d); })
    .catch(() => {})
    .finally(() => { tokenRefreshingRef.current = false; });
}, [currentChapterId, clearanceToken, mangaId]);
```

แล้วส่ง `onImageError={handleImgError}` ไปยัง `<PageRenderer ... onImageError={handleImgError} />` ใน JSX

- [ ] **Step 3: รัน TypeScript check**

```bash
cd Frontend && bun run build 2>&1 | head -40
```

Expected: ไม่มี type error ใหม่

- [ ] **Step 4: Commit**

```bash
git add Frontend/app/components/reader/PageRenderer.tsx Frontend/app/components/MangaReader.tsx
git commit -m "feat(security): auto-refresh image token on 401/error in reader"
```

---

### Task 5: อัปเดต books.types.ts comment

**Files:**
- Modify: `Backend/src/books/books.types.ts` (comment บรรทัด imageToken)

- [ ] **Step 1: อัปเดต comment**

หาบรรทัด:
```typescript
/** HMAC-signed token (chapterId + 4h TTL) for gating image bytes on /img-cache/* and img-proxy. */
```

แก้เป็น:
```typescript
/** HMAC-signed token (chapterId + HWID + 30min TTL) for gating image bytes on /img-cache/* and img-proxy. */
```

- [ ] **Step 2: Commit**

```bash
git add Backend/src/books/books.types.ts
git commit -m "docs: update imageToken comment — 30min TTL + HWID binding"
```

---

### Task 6: รัน full test suite + lint

- [ ] **Step 1: รัน Backend tests ที่เกี่ยวข้อง**

```bash
cd Backend && npx jest src/books/image-token.spec.ts src/common/storage/img-cache.controller.spec.ts --no-coverage
```

Expected: PASS ทุก test

- [ ] **Step 2: รัน Backend lint**

```bash
cd Backend && npm run lint
```

Expected: ไม่มี error

- [ ] **Step 3: รัน Frontend build**

```bash
cd Frontend && bun run build
```

Expected: build สำเร็จ ไม่มี type error

---

## Verification (Manual Test หลัง implement)

1. **Normal flow**: เปิด chapter → รูปโหลดได้ปกติ (token 30 min ยังไม่ expire)
2. **Token refresh**: เปิด chapter แล้วรอ/simulate 401 → รูป reload อัตโนมัติ
3. **Sec-Fetch-Site block**: ลอง curl URL ตรงๆ พร้อม `-H "Sec-Fetch-Site: cross-site"` → ได้ 401
4. **HWID binding**: copy img URL จาก DevTools → URL ยังใช้ได้จากเครื่องเดิม แต่ HMAC ผูกกับ HWID ที่ generate ตอนนั้น
5. **No-secret mode**: ถ้าไม่ set `IMAGE_TOKEN_SECRET` → ทุก request ผ่าน (no-op)
