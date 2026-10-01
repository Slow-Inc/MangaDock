# Profile Avatar Intermittent Loading Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** แก้รูปโปรไฟล์โหลดบ้างไม่โหลดบ้าง โดย (A) refresh social CDN URL ทุก login, (B) เพิ่ม `unoptimized`+`onError` ใน `<Image>` avatar ทุกจุด, (C) ตรวจ `remotePatterns`

**Architecture:** เพิ่ม exported `isSocialCdnUrl()` helper ใน frontend `avatarUpload.ts` และ module-level ใน backend `users.service.ts` เพื่อ detect URL ที่ expire ได้ จากนั้น `upsertUser()` ใช้ logic นี้ตัดสินว่าจะ refresh หรือ guard อย่างไร และ community `<Image>` components ใช้ helper นี้ set `unoptimized` + handler `onError`

**Tech Stack:** NestJS (backend), Next.js 16 + React 19 (frontend), Jest (backend tests), bun:test (frontend tests)

## Global Constraints

- ห้าม overwrite `photo_url` ที่เป็น uploaded avatar (`/uploads/avatars/`) ด้วย OAuth URL
- `isSocialCdnUrl` ต้อง detect: `lh3.googleusercontent.com`, `fbcdn.net`, `fbsbx.com`, `graph.facebook.com`
- `onError` fallback: ซ่อน `<Image>` (display:none) ไม่ใช่ throw
- ทุก commit ต้อง test ผ่านก่อน

---

## File Map

| File | Action | หน้าที่ |
|------|--------|--------|
| `Backend/src/users/users.service.ts` | Modify | เพิ่ม `isSocialCdnUrl()` export + แก้ `upsertUser()` |
| `Backend/src/users/users.service.spec.ts` | Modify | เพิ่ม test สำหรับ `isSocialCdnUrl` + `upsertUser` photo logic |
| `Frontend/app/lib/avatarUpload.ts` | Modify | เพิ่ม `isSocialCdnUrl()` export |
| `Frontend/app/lib/avatarUpload.test.ts` | Modify | เพิ่ม test สำหรับ `isSocialCdnUrl` |
| `Frontend/app/community/p/[id]/page.tsx` | Modify | เพิ่ม `unoptimized` + `onError` ใน `<Image>` author avatar |
| `Frontend/app/community/profile/[uid]/page.tsx` | Modify | เพิ่ม `unoptimized` + `onError` ใน `<Image>` profile photo |
| `Frontend/next.config.ts` | Check/Modify | ตรวจ `remotePatterns` ครอบ Facebook subdomain |

---

## Task 1: Backend — `isSocialCdnUrl` export + `upsertUser` photo refresh

**Files:**
- Modify: `Backend/src/users/users.service.ts`
- Test: `Backend/src/users/users.service.spec.ts`

**Interfaces:**
- Produces: `export function isSocialCdnUrl(url: string): boolean` (module-level, ก่อน class)

---

- [ ] **Step 1: เขียน failing tests**

เปิด `Backend/src/users/users.service.spec.ts` เพิ่ม import และ describe block ใหม่ **ด้านบนสุดของไฟล์** (ก่อน `describe('UsersService.exportHistory')` ที่มีอยู่):

```ts
import { isSocialCdnUrl } from './users.service';
```

แล้วเพิ่ม describe block:

```ts
describe('isSocialCdnUrl', () => {
  it('returns true for Google photo URL', () => {
    expect(isSocialCdnUrl('https://lh3.googleusercontent.com/a/abc=s96-c')).toBe(true);
  });

  it('returns true for fbcdn URL (scontent-region.fbcdn.net)', () => {
    expect(isSocialCdnUrl('https://scontent-bkk1-1.fbcdn.net/v/photo.jpg')).toBe(true);
  });

  it('returns true for fbsbx URL', () => {
    expect(isSocialCdnUrl('https://platform-lookaside.fbsbx.com/photo.jpg')).toBe(true);
  });

  it('returns true for graph.facebook.com URL', () => {
    expect(isSocialCdnUrl('https://graph.facebook.com/1234/picture')).toBe(true);
  });

  it('returns false for uploaded avatar path', () => {
    expect(isSocialCdnUrl('/uploads/avatars/uid_abc123.jpg')).toBe(false);
  });

  it('returns false for full uploaded avatar URL', () => {
    expect(isSocialCdnUrl('https://api.hayateotsu.space/uploads/avatars/uid_abc123.jpg')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isSocialCdnUrl('')).toBe(false);
  });
});
```

- [ ] **Step 2: รัน tests เพื่อยืนยันว่า FAIL**

```bash
cd Backend
npx jest src/users/users.service.spec.ts --no-coverage
```

Expected: FAIL ด้วย `isSocialCdnUrl is not a function` (ยังไม่มี export)

---

- [ ] **Step 3: เพิ่ม `isSocialCdnUrl` export ใน `users.service.ts`**

เปิด `Backend/src/users/users.service.ts` เพิ่ม function นี้ **ก่อน `@Injectable()` decorator** (บรรทัดก่อน class `UsersService`):

```ts
/** Returns true if the URL is from a social OAuth CDN (Google, Facebook).
 *  These URLs carry signed tokens that expire — they must be refreshed on
 *  every login rather than written once and cached forever. */
export function isSocialCdnUrl(url: string): boolean {
  return (
    url.includes('lh3.googleusercontent.com') ||
    url.includes('fbcdn.net') ||
    url.includes('fbsbx.com') ||
    url.includes('graph.facebook.com')
  );
}
```

- [ ] **Step 4: รัน tests เพื่อยืนยันว่า PASS**

```bash
npx jest src/users/users.service.spec.ts --no-coverage
```

Expected: `isSocialCdnUrl` describe block ผ่านทั้ง 7 test; `exportHistory` block ยังผ่านเหมือนเดิม

---

- [ ] **Step 5: แก้ `upsertUser()` — photo_url refresh logic**

ใน `Backend/src/users/users.service.ts` หา block นี้ (บรรทัดประมาณ 186-195):

```ts
    if (data.photoURL) {
      const { error } = await this.db
        .from('profiles')
        .update({ photo_url: data.photoURL })
        .eq('uid', uid)
        .is('photo_url', null);
      if (error) {
        throw new Error(`Failed to backfill photo URL: ${error.message}`);
      }
    }
```

แทนด้วย:

```ts
    if (data.photoURL) {
      if (isSocialCdnUrl(data.photoURL)) {
        // Social CDN URLs (Google lh3, Facebook fbcdn) carry signed tokens that
        // expire. Refresh on every login — but only when the stored URL is also
        // social CDN or null; never overwrite a custom uploaded avatar.
        const { data: existing } = await this.db
          .from('profiles')
          .select('photo_url')
          .eq('uid', uid)
          .maybeSingle<{ photo_url: string | null }>();

        const currentUrl = existing?.photo_url ?? null;
        if (currentUrl === null || isSocialCdnUrl(currentUrl)) {
          const { error } = await this.db
            .from('profiles')
            .update({ photo_url: data.photoURL })
            .eq('uid', uid);
          if (error) {
            throw new Error(`Failed to refresh photo URL: ${error.message}`);
          }
        }
      } else {
        // Non-social URL (uploaded avatar): original behavior — only write when null.
        const { error } = await this.db
          .from('profiles')
          .update({ photo_url: data.photoURL })
          .eq('uid', uid)
          .is('photo_url', null);
        if (error) {
          throw new Error(`Failed to backfill photo URL: ${error.message}`);
        }
      }
    }
```

- [ ] **Step 6: รัน tests อีกครั้งเพื่อยืนยันไม่ regression**

```bash
npx jest src/users/users.service.spec.ts --no-coverage
```

Expected: ทุก test ผ่าน (ทั้ง `isSocialCdnUrl` block และ `exportHistory` block)

- [ ] **Step 7: Commit**

```bash
cd Backend
git add src/users/users.service.ts src/users/users.service.spec.ts
git commit -m "fix(users): refresh social CDN photo_url on every login instead of once

Google (lh3.googleusercontent.com) and Facebook (fbcdn.net) URLs carry
signed tokens that expire. Previously photo_url was only written when null,
so stored URLs went stale. Now we refresh when the stored value is also a
social CDN URL (never when it's an uploaded avatar)."
```

---

## Task 2: Frontend — `isSocialCdnUrl` export + tests

**Files:**
- Modify: `Frontend/app/lib/avatarUpload.ts`
- Test: `Frontend/app/lib/avatarUpload.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1 (independent helper)
- Produces: `export function isSocialCdnUrl(url: string): boolean`

---

- [ ] **Step 1: เขียน failing tests**

เปิด `Frontend/app/lib/avatarUpload.test.ts` เพิ่ม import และ describe block **หลัง** `describe("resolveAvatarUrl")` ที่มีอยู่:

```ts
import { resolveAvatarUrl, isSocialCdnUrl } from "./avatarUpload";
```

(อัปเดต import บรรทัดบนสุดให้รวม `isSocialCdnUrl` ด้วย)

แล้วเพิ่ม describe block:

```ts
describe("isSocialCdnUrl", () => {
  test("returns true for Google lh3 URL", () => {
    expect(isSocialCdnUrl("https://lh3.googleusercontent.com/a/abc=s96-c")).toBe(true);
  });

  test("returns true for fbcdn URL with region subdomain", () => {
    expect(isSocialCdnUrl("https://scontent-bkk1-1.fbcdn.net/v/photo.jpg")).toBe(true);
  });

  test("returns true for fbsbx URL", () => {
    expect(isSocialCdnUrl("https://platform-lookaside.fbsbx.com/photo.jpg")).toBe(true);
  });

  test("returns true for graph.facebook.com URL", () => {
    expect(isSocialCdnUrl("https://graph.facebook.com/1234/picture")).toBe(true);
  });

  test("returns false for uploaded avatar relative path", () => {
    expect(isSocialCdnUrl("/uploads/avatars/uid_abc.jpg")).toBe(false);
  });

  test("returns false for proxied upload URL", () => {
    expect(isSocialCdnUrl("/api/proxy/uploads/avatars/uid_abc.jpg")).toBe(false);
  });

  test("returns false for empty string", () => {
    expect(isSocialCdnUrl("")).toBe(false);
  });
});
```

- [ ] **Step 2: รัน tests เพื่อยืนยันว่า FAIL**

```bash
cd Frontend
bun test app/lib/avatarUpload.test.ts
```

Expected: FAIL ด้วย `isSocialCdnUrl is not exported`

---

- [ ] **Step 3: เพิ่ม `isSocialCdnUrl` ใน `avatarUpload.ts`**

เปิด `Frontend/app/lib/avatarUpload.ts` เพิ่มที่ **ท้ายไฟล์**:

```ts
/** Returns true if the URL is from a social OAuth CDN (Google, Facebook).
 *  Used to decide whether to skip Next.js image optimization (social CDN
 *  URLs may redirect through domains not in remotePatterns). */
export function isSocialCdnUrl(url: string): boolean {
  return (
    url.includes('lh3.googleusercontent.com') ||
    url.includes('fbcdn.net') ||
    url.includes('fbsbx.com') ||
    url.includes('graph.facebook.com')
  );
}
```

- [ ] **Step 4: รัน tests เพื่อยืนยันว่า PASS**

```bash
bun test app/lib/avatarUpload.test.ts
```

Expected: ทุก test ผ่าน (ทั้ง `resolveAvatarUrl` และ `isSocialCdnUrl` blocks)

- [ ] **Step 5: Commit**

```bash
cd Frontend
git add app/lib/avatarUpload.ts app/lib/avatarUpload.test.ts
git commit -m "feat(avatarUpload): export isSocialCdnUrl helper for social CDN detection"
```

---

## Task 3: Frontend — `unoptimized`+`onError` ใน community `<Image>` + ตรวจ next.config.ts

**Files:**
- Modify: `Frontend/app/community/p/[id]/page.tsx`
- Modify: `Frontend/app/community/profile/[uid]/page.tsx`
- Check/Modify: `Frontend/next.config.ts`

**Interfaces:**
- Consumes: `isSocialCdnUrl` จาก `../../lib/avatarUpload` (Task 2)

---

- [ ] **Step 1: แก้ `p/[id]/page.tsx` — post author avatar**

เปิด `Frontend/app/community/p/[id]/page.tsx`

เพิ่ม import (หา import block บนสุดของไฟล์ เพิ่มบรรทัดนี้):
```ts
import { isSocialCdnUrl } from '../../../lib/avatarUpload';
```

หา block นี้ (ประมาณบรรทัด 305-313):
```tsx
              <div className="w-6 h-6 rounded-full bg-white/10 overflow-hidden shrink-0 border border-white/5">
                {post.authorPhotoUrl && (
                  <Image 
                    src={post.authorPhotoUrl} 
                    alt={post.authorName || 'user'} 
                    width={24} 
                    height={24}
                    className="object-cover"
                  />
                )}
```

แทนด้วย:
```tsx
              <div className="w-6 h-6 rounded-full bg-white/10 overflow-hidden shrink-0 border border-white/5">
                {post.authorPhotoUrl && (
                  <Image 
                    src={post.authorPhotoUrl} 
                    alt={post.authorName || 'user'} 
                    width={24} 
                    height={24}
                    className="object-cover"
                    unoptimized={isSocialCdnUrl(post.authorPhotoUrl)}
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                )}
```

- [ ] **Step 2: แก้ `profile/[uid]/page.tsx` — profile photo**

เปิด `Frontend/app/community/profile/[uid]/page.tsx`

เพิ่ม import (ใส่ใกล้ import อื่นๆ):
```ts
import { isSocialCdnUrl } from '../../../lib/avatarUpload';
```

หา block นี้ (ประมาณบรรทัด 359-365):
```tsx
              {profile.photoUrl ? (
                <Image
                  src={profile.photoUrl}
                  alt={profile.displayName ?? "user"}
                  width={96}
                  height={96}
                  className="object-cover w-full h-full"
```

เพิ่ม 2 props หลัง `className`:
```tsx
              {profile.photoUrl ? (
                <Image
                  src={profile.photoUrl}
                  alt={profile.displayName ?? "user"}
                  width={96}
                  height={96}
                  className="object-cover w-full h-full"
                  unoptimized={isSocialCdnUrl(profile.photoUrl)}
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
```

- [ ] **Step 3: ตรวจ `next.config.ts` remotePatterns สำหรับ Facebook**

เปิด `Frontend/next.config.ts` ตรวจว่ามี patterns เหล่านี้ครบ:

```ts
{ protocol: "https", hostname: "*.fbcdn.net" },           // ครอบ scontent-bkk1-1.fbcdn.net ✓
{ protocol: "https", hostname: "platform-lookaside.fbsbx.com" },  // fbsbx ✓
{ protocol: "https", hostname: "graph.facebook.com" },    // graph ✓
{ protocol: "https", hostname: "lh3.googleusercontent.com" },  // Google ✓
```

ถ้าครบแล้วไม่ต้องแก้ ถ้าขาด pattern ใดให้เพิ่มใน `remotePatterns` array

**หมายเหตุ:** `*.fbcdn.net` ใน Next.js ครอบ 1 subdomain level — `scontent-bkk1-1.fbcdn.net` มี subdomain เดียว (`scontent-bkk1-1`) จึงครอบได้ถูกต้อง

- [ ] **Step 4: รัน lint เพื่อตรวจ TypeScript errors**

```bash
cd Frontend
bun lint
```

Expected: ไม่มี error ใหม่

- [ ] **Step 5: Manual verify — รูปโหลดได้และ fallback ทำงาน**

1. เปิด `http://localhost:4000/community` (หรือ tunnel URL)
2. ดู forum post ที่มี author ใช้ Google/Facebook avatar → ต้องโหลดได้
3. เปิด community post detail page (`/community/p/[id]`) → author avatar ต้องโหลดได้
4. เปิด profile page (`/community/profile/[uid]`) → profile photo ต้องโหลดได้
5. จำลอง broken image: เปิด DevTools → Network → Block request URL ที่เป็น social CDN → reload → ต้องไม่เห็น broken image icon (เห็น placeholder circle แทน)

- [ ] **Step 6: Commit**

```bash
cd Frontend
git add app/community/p/[id]/page.tsx app/community/profile/[uid]/page.tsx next.config.ts
git commit -m "fix(community): add unoptimized+onError to social CDN avatar Images

Facebook CDN URLs (fbcdn.net) require unoptimized=true because they
redirect through domains not handled by Next.js optimizer. onError hides
the broken <img> element gracefully instead of showing broken-image icon."
```

---

## Verification Checklist (after all tasks)

- [ ] `npx jest src/users/users.service.spec.ts --no-coverage` — ผ่าน
- [ ] `bun test app/lib/avatarUpload.test.ts` — ผ่าน  
- [ ] `bun lint` — ผ่าน
- [ ] Login ด้วย Google account → เปิด Supabase → `profiles.photo_url` ถูก update เป็น URL ใหม่
- [ ] Forum post author avatar โหลดได้
- [ ] Profile page photo โหลดได้
- [ ] Broken URL แสดง placeholder (ไม่มี broken image icon)
