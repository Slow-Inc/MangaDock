# Default Avatar Design

**Date:** 2026-07-19  
**Status:** Approved  
**Scope:** Backend-only, single function change

## Problem

Users without a profile photo (`profiles.photo_url = null`) see a letter-initial fallback in the UI. This value is never persisted — each component renders the fallback independently. There is no stored "default" avatar for these users.

## Solution

When `upsertUser()` would save `photo_url = null`, substitute a DiceBear-generated URL instead. The URL is deterministic (seeded by UID), unique per user, and stored in `profiles.photo_url` exactly like a real photo URL. All downstream UI receives it through the existing `fetchBackendProfile()` flow — no frontend changes required.

**DiceBear URL pattern:**
```
https://api.dicebear.com/9.x/thumbs/svg?seed=<uid>
```
`api.dicebear.com` is already in `next.config.ts` `remotePatterns`.

## Scope

### In scope
- New users get a default avatar on first login
- Existing users with `photo_url = null` get it on their next login
- Unit test covering the null-photo_url → DiceBear case

### Out of scope
- SQL migration for existing null rows (user chose login-triggered only)
- Frontend changes
- Style configurability (thumbs style is fixed)

## Architecture

**Only file changed:** `Backend/src/users/users.service.ts` — `upsertUser()`

Current logic (simplified):
```
resolvedPhotoUrl = socialCdnUrl from provider data, or null
upsert profiles set photo_url = resolvedPhotoUrl (may be null)
```

New logic:
```
resolvedPhotoUrl = socialCdnUrl from provider data, or null
finalPhotoUrl = resolvedPhotoUrl ?? `https://api.dicebear.com/9.x/thumbs/svg?seed=${uid}`
upsert profiles set photo_url = finalPhotoUrl (never null)
```

## Invariants preserved

- Users with a custom-uploaded photo are unaffected: the existing guard that never overwrites a non-social-CDN URL stays in place. DiceBear URLs are not social CDN URLs, so on the next login they will NOT be overwritten — the user's custom photo stays.
- Users with a Google/Facebook photo are unaffected: social provider resolution runs first; DiceBear fallback only applies when that resolves to null.
- Upload flow unchanged: `PATCH /users/me` always overwrites `photo_url`, replacing the DiceBear URL with the real upload.

## Testing

Add to `Backend/src/users/users.service.spec.ts`:
- Case: user has no social provider photo and `photo_url` is currently null → `upsertUser()` saves DiceBear URL
- Existing cases: all pass unchanged
