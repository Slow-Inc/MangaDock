# Design: Profile Avatar Intermittent Loading Fix

**Date:** 2026-07-18  
**Status:** Approved  
**Issue:** รูปโปรไฟล์โหลดบ้างไม่โหลดบ้าง (social CDN URL หมดอายุ + render config ไม่ครอบ)

---

## Root Causes (จาก Phase 2 Debug)

| ID | Root Cause | ผลกระทบ |
|----|-----------|---------|
| A | `upsertUser()` backfill `photo_url` ครั้งเดียวด้วย `.is('photo_url', null)` — URL Facebook/Google ที่เก่าไม่ถูก refresh | รูปของ user ที่ login นานแล้วหมดอายุ ทุก component ที่อ่านจาก `profiles.photo_url` ได้ URL ที่ตาย |
| B | Forum post / comment component render `authorPhotoUrl` ด้วย `<Image>` โดยไม่มี `unoptimized` สำหรับ Facebook URL | Next.js Image optimizer พยายาม optimize URL จาก `graph.facebook.com` ซึ่งเป็น redirect → 400 |
| C | `next.config.ts` ยังขาด fallback `onError` สำหรับ `<Image>` ทุกจุดที่แสดง avatar | เมื่อ URL ใดก็ตามโหลดไม่สำเร็จ ไม่มี graceful fallback → รูปหาย (blank) |

---

## Approach: Surgical 3-Point Fix

### Point A — Refresh `photo_url` on every OAuth login

**File:** `Backend/src/users/users.service.ts` — `upsertUser()`

**ปัจจุบัน:**
```ts
if (data.photoURL) {
  await this.db.from('profiles').update({ photo_url: data.photoURL })
    .eq('uid', uid).is('photo_url', null);  // เขียนครั้งเดียว!
}
```

**เป้าหมาย:**  
อัปเดต `photo_url` ทุก login เมื่อ URL ใหม่มาจาก social CDN (`lh3.googleusercontent.com`, `fbcdn.net`, `fbsbx.com`, `graph.facebook.com`) เท่านั้น — ไม่ทับ uploaded avatar (`/uploads/avatars/`)

Logic:
```
if incoming photoURL is social CDN URL:
    UPDATE profiles SET photo_url = photoURL
    WHERE uid = uid
      AND (photo_url IS NULL OR photo_url isSocialCDN)
    → อัปเดตเฉพาะเมื่อ existing URL เป็น social CDN หรือ null
    → ถ้า user เคย upload avatar เอง (/uploads/avatars/) จะไม่ถูกทับ
elif existing photo_url IS NULL:
    UPDATE profiles SET photo_url = photoURL WHERE uid = uid AND photo_url IS NULL
    (keep uploaded avatar untouched)
```

**Critical guard:** ต้องดึง `photo_url` ปัจจุบันก่อน update ด้วย `SELECT photo_url WHERE uid = uid` เพื่อตัดสินว่าควร overwrite หรือไม่ — ป้องกัน race ไม่ได้ แต่ acceptable เพราะ login event ไม่ concurrent

**Why:** Facebook CDN URL (scontent-*.fbcdn.net) มี signed token ใน path ที่หมดอายุ ทุก login OAuth จะได้ URL ใหม่ที่ valid — ต้อง persist ทันที

---

### Point B — `unoptimized` + `onError` fallback สำหรับ social avatar

**Files:** ทุก component ที่ render `authorPhotoUrl` หรือ `photoURL` จาก social CDN:
- `Frontend/app/community/p/[id]/page.tsx` (post detail, author photo)
- `Frontend/app/community/page.tsx` (post list)
- `Frontend/app/community/manga/[mangaId]/page.tsx` (manga forum)
- `Frontend/app/community/profile/[uid]/page.tsx` (profile page)

**Helper ที่จะเพิ่มใน `Frontend/app/lib/avatarUpload.ts`:**
```ts
export function isSocialCdnUrl(url: string): boolean {
  return (
    url.includes('lh3.googleusercontent.com') ||
    url.includes('fbcdn.net') ||
    url.includes('fbsbx.com') ||
    url.includes('graph.facebook.com')
  );
}
```

**Pattern สำหรับ `<Image>` avatar:**
```tsx
<Image
  src={authorPhotoUrl}
  alt={authorName}
  unoptimized={isSocialCdnUrl(authorPhotoUrl)}
  onError={(e) => { e.currentTarget.style.display = 'none'; }}
  ...
/>
```

`onError` ซ่อน `<Image>` ที่โหลดไม่ได้ → parent container (`div` ที่มี `bg-white/10`) จะแสดงเป็น empty placeholder circle (ไม่มี initial letter — community components ไม่มี pattern นั้น แต่ดีกว่า broken image icon) NavbarActions มี initial letter อยู่แล้วและไม่ต้องแก้

**Note:** `NavbarActions.tsx` มี `unoptimized` สำหรับ Facebook แล้ว (บรรทัด 103) — ไม่ต้องแก้

---

### Point C — ตรวจ `remotePatterns` Facebook subdomain

**File:** `Frontend/next.config.ts`

ตรวจสอบว่า `*.fbcdn.net` ครอบ `scontent-{region}-{N}.fbcdn.net` จริงไหม (Next.js wildcard = 1 subdomain level เท่านั้น → `scontent-bkk1-1.fbcdn.net` มี 1 subdomain level = ครอบแล้ว)

ถ้าพบว่ายังขาด domain ใด ให้เพิ่มเข้า `remotePatterns`

---

## Scope

| ทำ | ไม่ทำ |
|----|-------|
| Refresh OAuth avatar URL ทุก login | Migration backfill URL เก่าในฐานข้อมูล |
| `unoptimized` + `onError` fallback ใน forum components | เปลี่ยน storage model (เช่น download + re-upload) |
| ตรวจ/fix `remotePatterns` | เพิ่ม image proxy layer |

---

## Test Plan

1. **Backend unit test** — `upsertUser()` อัปเดต `photo_url` เมื่อ existing row มีค่าอยู่แล้วและ incoming URL เป็น social CDN
2. **Manual verify** — login ด้วย Facebook account, ดู `profiles.photo_url` ใน Supabase dashboard ว่า URL ถูก refresh
3. **Visual verify** — เปิด community page, ดู forum post ที่มี avatar จาก social provider ว่าโหลดได้
4. **Fallback verify** — จำลอง broken URL → ตรวจว่า initial letter แสดงแทน (ไม่มี broken image icon)

---

## Files Changed (summary)

| File | Change |
|------|--------|
| `Backend/src/users/users.service.ts` | logic refresh social CDN URL ใน `upsertUser()` |
| `Frontend/app/lib/avatarUpload.ts` | เพิ่ม `isSocialCdnUrl()` helper |
| `Frontend/app/community/p/[id]/page.tsx` | `unoptimized` + `onError` |
| `Frontend/app/community/page.tsx` | `unoptimized` + `onError` |
| `Frontend/app/community/manga/[mangaId]/page.tsx` | `unoptimized` + `onError` |
| `Frontend/app/community/profile/[uid]/page.tsx` | `unoptimized` + `onError` |
| `Frontend/next.config.ts` | ตรวจ/เพิ่ม fbcdn subdomain ถ้าขาด |
