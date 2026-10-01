# Image Protection Design

**Date:** 2026-07-21  
**Branch:** feat/image-protection  
**Status:** Approved

## Problem

Manga page images served via `/img-cache/**` can be downloaded by:
- Casual users: right-click → Save Image As
- Determined users: DevTools Network tab → copy URL → paste in new browser tab (works for 30 min while token is valid)

## Threat Model

| Vector | Target user | In scope? |
|---|---|---|
| Right-click → Save Image As | Casual | ✅ |
| DevTools → paste URL in address bar | Determined | ✅ |
| curl with stolen token | Scripted | ⚠️ partially (HMAC still required) |
| Screenshot | Anyone | ❌ (impossible in web) |

## Approach: B — Frontend right-click prevention + Sec-Fetch-Mode guard

### Existing protection (not changed)
- `draggable={false}` on all images
- `select-none` CSS class
- HWID middleware (`X-Hardware-Id` required on chapter routes)
- `ImageTokenGuard`: HMAC-SHA256 `?t=&cid=` on `/img-cache/**`, TTL 30 min, HWID-bound

### New: Frontend — right-click prevention

**File:** `Frontend/app/components/reader/PageRenderer.tsx`

Add `onContextMenu={(e) => e.preventDefault()}` to manga page `<img>` elements only:
- Continuous mode: the per-page `<img>` (not patch overlay imgs)
- Paged mode: the single current-page `<img>` (not patch overlay imgs)

Patch overlay `<img>` and UI buttons are NOT affected.

### New: Backend — Sec-Fetch-Mode check

**File:** `Backend/src/books/image-token.guard.ts`

Before the existing HMAC validation, add:

```typescript
const fetchMode = req.headers['sec-fetch-mode'];
if (fetchMode === 'navigate') return false;
```

| Sec-Fetch-Mode value | Scenario | Result |
|---|---|---|
| `navigate` | Paste URL in browser address bar | 403 Forbidden |
| `no-cors` | `<img>` tag browser load (legitimate) | Passes → HMAC validated |
| absent | curl / server-to-server | Passes → HMAC validated |

`Sec-Fetch-Mode` is a browser-enforced Fetch Metadata header — JavaScript cannot spoof it. Direct URL navigation always sends `navigate`.

## What is NOT in scope

- Watermark / steganography
- Canvas-based rendering (too large a change, performance risk)
- Shortened TTL (stays at 30 min)
- Blocking curl (requires Referer check, too fragile for SSR)

## Files changed

| File | Change |
|---|---|
| `Frontend/app/components/reader/PageRenderer.tsx` | Add `onContextMenu` to 2 `<img>` blocks |
| `Backend/src/books/image-token.guard.ts` | Add `Sec-Fetch-Mode` check (3 lines) |

## Tests

| Test | Location |
|---|---|
| `ImageTokenGuard` — navigate mode rejected | `Backend/src/books/image-token.guard.spec.ts` |
| `ImageTokenGuard` — no-cors passes | same |
| `ImageTokenGuard` — absent header passes | same (existing) |
