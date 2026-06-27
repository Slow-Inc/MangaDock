# History Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `GET /users/me/history/export` CSV endpoint + Export button in MyList History tab (issue #327).

**Architecture:** Service method builds CSV from `user_history` table; NestJS controller sends raw `text/csv` response via `@Res()`; Frontend fetches with auth Bearer token, converts to Blob, triggers browser download.

**Tech Stack:** NestJS 11 (Backend), Next.js 16 + React 19 (Frontend), Jest (Backend tests), bun:test (Frontend tests not needed — only `bun run build` + `bun run lint`).

## Global Constraints

- No new DB columns — use existing `user_history` table columns: `title`, `subtitle` (→ lastChapter), `last_read_at` (stored as Unix ms number → ISO string)
- CSV column order: `title,lastChapter,lastReadAt` — exact header, no spaces
- `@Get('me/history/export')` must be declared **before** `@Delete('me/history/:id')` in `UsersController` to prevent NestJS route shadowing the literal string `"export"` as `:id`
- Response headers: `Content-Type: text/csv`, `Content-Disposition: attachment; filename="reading-history.csv"`
- All routes gated by existing `AuthGuard` — no new auth primitives
- Frontend: unauthenticated → do nothing (button only renders when `user` is set)
- CSV values wrapped in double-quotes; internal `"` escaped as `""`
- `bun run build` and `bun run lint` must pass

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Modify | `Backend/src/users/users.service.ts` | Add `exportHistory(uid)` method |
| Create | `Backend/src/users/users.service.spec.ts` | Unit tests for `exportHistory` |
| Modify | `Backend/src/users/users.controller.ts` | Add `GET me/history/export` route |
| Modify | `Frontend/app/mylist/page.tsx` | Add Export button in History tab |

---

## Task 1 — `UsersService.exportHistory` + unit tests

**Files:**
- Modify: `Backend/src/users/users.service.ts` (after `getHistory` at line 424)
- Create: `Backend/src/users/users.service.spec.ts`

**Interfaces:**
- Produces: `exportHistory(uid: string): Promise<string>` — returns complete CSV string including header row

- [ ] **Step 1: Write failing test**

Create `Backend/src/users/users.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { SupabaseService } from '../supabase/supabase.service';
import { STORAGE_PROVIDER } from '../common/storage/storage-provider.interface';

function makeSupabaseMock(rows: unknown[], error: unknown = null) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue({ data: rows, error }),
  };
  return {
    client: { from: jest.fn().mockReturnValue(chain) },
    _chain: chain,
  };
}

describe('UsersService.exportHistory', () => {
  let service: UsersService;
  let supabaseMock: ReturnType<typeof makeSupabaseMock>;

  async function build(rows: unknown[], error: unknown = null) {
    supabaseMock = makeSupabaseMock(rows, error);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: SupabaseService, useValue: supabaseMock },
        { provide: STORAGE_PROVIDER, useValue: {} },
      ],
    }).compile();
    service = module.get(UsersService);
  }

  it('returns header row when history is empty', async () => {
    await build([]);
    const csv = await service.exportHistory('uid-1');
    expect(csv).toBe('title,lastChapter,lastReadAt');
  });

  it('header row is first line', async () => {
    await build([{ title: 'A', subtitle: 'Ch 1', last_read_at: 1000 }]);
    const csv = await service.exportHistory('uid-1');
    const [header] = csv.split('\r\n');
    expect(header).toBe('title,lastChapter,lastReadAt');
  });

  it('row contains correct title, chapter, and ISO date', async () => {
    const ts = 1718000000000;
    await build([{ title: 'One Punch Man', subtitle: 'Chapter 180', last_read_at: ts }]);
    const csv = await service.exportHistory('uid-1');
    const lines = csv.split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe(`"One Punch Man","Chapter 180","${new Date(ts).toISOString()}"`);
  });

  it('escapes double-quotes in title', async () => {
    await build([{ title: 'He said "Hi"', subtitle: '', last_read_at: 0 }]);
    const csv = await service.exportHistory('uid-1');
    const [, row] = csv.split('\r\n');
    expect(row).toContain('"He said ""Hi"""');
  });

  it('multiple rows sorted by DB order (no re-sort in service)', async () => {
    await build([
      { title: 'A', subtitle: 'Ch 2', last_read_at: 2000 },
      { title: 'B', subtitle: 'Ch 1', last_read_at: 1000 },
    ]);
    const csv = await service.exportHistory('uid-1');
    const lines = csv.split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('"A"');
    expect(lines[2]).toContain('"B"');
  });

  it('throws when Supabase returns an error', async () => {
    await build([], { message: 'db error' });
    await expect(service.exportHistory('uid-1')).rejects.toThrow('Failed to export history');
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL (method not defined)**

```bash
cd Backend
npx jest src/users/users.service.spec.ts --no-coverage
```

Expected: `TypeError: service.exportHistory is not a function` or similar.

- [ ] **Step 3: Implement `exportHistory` in `users.service.ts`**

Add after `getHistory` (after line 424 — before `getPhotoHistory`):

```typescript
async exportHistory(uid: string): Promise<string> {
  const { data, error } = await this.db
    .from('user_history')
    .select('title, subtitle, last_read_at')
    .eq('uid', uid)
    .order('last_read_at', { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(`Failed to export history: ${error.message}`);
  }

  const escape = (v: unknown) => String(v ?? '').replace(/"/g, '""');

  const rows = (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return `"${escape(r['title'])}","${escape(r['subtitle'])}","${new Date(Number(r['last_read_at'] ?? 0)).toISOString()}"`;
  });

  return ['title,lastChapter,lastReadAt', ...rows].join('\r\n');
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx jest src/users/users.service.spec.ts --no-coverage
```

Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add Backend/src/users/users.service.ts Backend/src/users/users.service.spec.ts
git commit -m "feat(history-export): UsersService.exportHistory + unit tests (#327)"
```

---

## Task 2 — Controller route `GET /users/me/history/export`

**Files:**
- Modify: `Backend/src/users/users.controller.ts`

**Interfaces:**
- Consumes: `UsersService.exportHistory(uid: string): Promise<string>` from Task 1
- Produces: `GET /users/me/history/export` → `text/csv` response; 401 when unauthenticated (handled by existing `AuthGuard`)

- [ ] **Step 1: Add `Response` import and route**

At the top of `Backend/src/users/users.controller.ts`, add `Res` and `Response`:

```typescript
// Add Res to the existing @nestjs/common import:
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Res,           // ← add this
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Inject,
} from '@nestjs/common';
```

Add at the very top of the file (after existing imports):

```typescript
import type { Response } from 'express';
```

- [ ] **Step 2: Insert the export route — BEFORE `@Delete('me/history/:id')` at line 175**

Insert between `clearHistory` (ends ~line 173) and `removeHistoryItem` (starts line 175):

```typescript
  @Get('me/history/export')
  async exportHistory(
    @Req() req: Request & { [USER_KEY]: SupabaseAuthUser },
    @Res() res: Response,
  ) {
    const csv = await this.users.exportHistory(req[USER_KEY].uid);
    res
      .set('Content-Type', 'text/csv')
      .set('Content-Disposition', 'attachment; filename="reading-history.csv"')
      .send(csv);
  }
```

Full history section after edit (lines ~156–185):

```typescript
  // ── Reading history ──────────────────────────────────────────────────────
  @Get('me/history')
  getHistory(@Req() req: Request & { [USER_KEY]: SupabaseAuthUser }) {
    return this.users.getHistory(req[USER_KEY].uid);
  }

  @Post('me/history')
  upsertHistoryItem(
    @Req() req: Request & { [USER_KEY]: SupabaseAuthUser },
    @Body() body: Record<string, unknown>,
  ) {
    return this.users.upsertHistoryItem(req[USER_KEY].uid, body as Parameters<typeof this.users.upsertHistoryItem>[1]);
  }

  @Delete('me/history')
  clearHistory(@Req() req: Request & { [USER_KEY]: SupabaseAuthUser }) {
    return this.users.clearHistory(req[USER_KEY].uid);
  }

  @Get('me/history/export')
  async exportHistory(
    @Req() req: Request & { [USER_KEY]: SupabaseAuthUser },
    @Res() res: Response,
  ) {
    const csv = await this.users.exportHistory(req[USER_KEY].uid);
    res
      .set('Content-Type', 'text/csv')
      .set('Content-Disposition', 'attachment; filename="reading-history.csv"')
      .send(csv);
  }

  @Delete('me/history/:id')
  removeHistoryItem(
    @Req() req: Request & { [USER_KEY]: SupabaseAuthUser },
    @Param('id') id: string,
  ) {
    return this.users.removeHistoryItem(req[USER_KEY].uid, id);
  }
```

- [ ] **Step 3: Build to verify no TypeScript errors**

```bash
cd Backend
npm run build
```

Expected: exit 0, no errors.

- [ ] **Step 4: Commit**

```bash
git add Backend/src/users/users.controller.ts
git commit -m "feat(history-export): GET /users/me/history/export CSV endpoint (#327)"
```

---

## Task 3 — Frontend Export button in MyList History tab

**Files:**
- Modify: `Frontend/app/mylist/page.tsx`

**Interfaces:**
- Consumes: `GET /api/proxy/users/me/history/export` with `Authorization: Bearer <token>`
- Consumes: `supabase.auth.getSession()` from `"../lib/supabase"` to get access token
- Consumes: `user` from `AuthContext` (already in scope inside `MyListContent`)

- [ ] **Step 1: Add supabase import**

At the top of `Frontend/app/mylist/page.tsx`, add after existing imports:

```typescript
import { supabase } from "../lib/supabase";
```

- [ ] **Step 2: Add `handleExport` function inside `MyListContent`**

Add inside `MyListContent` (after the existing `startFadeOut` function, around line 350):

```typescript
  const handleExport = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch('/api/proxy/users/me/history/export', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'reading-history.csv';
    a.click();
    URL.revokeObjectURL(url);
  };
```

- [ ] **Step 3: Add Export button to the page header**

In the page header div (around line 358–365), add Export button that appears only when on the history tab and user is logged in:

```tsx
        <div className="mb-6 sm:mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
              รายการของฉัน
            </h1>
            <p className="mt-1 text-sm text-white/40">
              มังงะที่คุณบันทึก ถูกใจ และกำลังอ่าน
            </p>
          </div>
          {user && activeTab === "history" && history.length > 0 && (
            <button
              onClick={handleExport}
              className="shrink-0 rounded-xl border border-white/10 px-4 py-2 text-xs font-medium text-white/60 transition hover:border-white/30 hover:text-white active:scale-95"
            >
              Export CSV
            </button>
          )}
        </div>
```

The original header div to replace (lines 358–365):

```tsx
        {/* Page header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
            รายการของฉัน
          </h1>
          <p className="mt-1 text-sm text-white/40">
            มังงะที่คุณบันทึก ถูกใจ และกำลังอ่าน
          </p>
        </div>
```

- [ ] **Step 4: Lint + build**

```bash
cd Frontend
bun run lint
bun run build
```

Expected: exit 0, no unused-import or type errors.

- [ ] **Step 5: Manual smoke test**

1. Open `http://localhost:4000/mylist?tab=history`
2. Confirm Export CSV button visible (History tab, user logged in, history non-empty)
3. Click → browser downloads `reading-history.csv`
4. Open CSV — verify header row `title,lastChapter,lastReadAt` + correct data rows
5. Switch to Favorites tab → button disappears

- [ ] **Step 6: Commit**

```bash
git add Frontend/app/mylist/page.tsx
git commit -m "feat(history-export): Export CSV button in MyList History tab (#327)"
```

---

## Self-Review

**Spec coverage check (issue #327):**
- [x] `GET /users/me/history/export` returns valid CSV with header `title,lastChapter,lastReadAt` → Task 1+2
- [x] Each row: title, last chapter (subtitle), ISO date → Task 1 `exportHistory`
- [x] Unauthenticated → 401 → existing `AuthGuard` on controller, no change needed
- [x] Route does not conflict with `GET /users/me/history/:id` (no such route exists; placed before `DELETE /me/history/:id`) → Task 2 route ordering
- [x] Unit tests: header row present; rows contain fields → Task 1 spec file
- [x] Export button in MyList History tab → Task 3
- [x] Clicking triggers download named `reading-history.csv` → Task 3 `handleExport`
- [x] `bun run build` + `bun run lint` → Task 3 Step 4

**Placeholder scan:** None found.

**Type consistency:** `exportHistory(uid: string): Promise<string>` used consistently in service, spec, and controller.
