# Reading Progress — DB Migration + API Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the `user_history` table and `POST /users/me/history` endpoint to persist the last-read page index and chapter ID per manga, so the frontend can later implement a "อ่านต่อจากหน้า N" resume experience.

**Architecture:** Two new nullable columns (`last_page`, `last_chapter_id`) are added to the existing `user_history` Supabase table via a migration. `UsersService.upsertHistoryItem()` accepts two new optional fields and writes them; `getHistory()` maps them back in the response. The controller is untouched — it already passes the raw body through. The change is fully backward-compatible: callers that omit the new fields get `null` back, identical to the previous behaviour.

**Tech Stack:** NestJS 11, Supabase MCP (`apply_migration`), Jest (`npx jest`), TypeScript.

## Global Constraints

- No new NestJS dependencies
- No changes to `users.controller.ts` — it already passes `body` directly to the service
- All new fields are optional / nullable — never break callers that omit them
- Test file: `Backend/src/users/users.service.spec.ts` (create new — none exists)
- Run tests with: `cd Backend && npx jest src/users/users.service.spec.ts --no-coverage`
- Build check: `cd Backend && npm run build`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `Backend/src/users/users.service.ts` | **Modify** | Add `lastPage?` + `lastChapterId?` to upsert input type; map to/from DB columns |
| `Backend/src/users/users.service.spec.ts` | **Create** | Unit tests for `upsertHistoryItem` and `getHistory` — new fields round-trip + backward-compat |
| Supabase migration (via MCP) | **Apply** | Add `last_page INTEGER` and `last_chapter_id TEXT` columns to `user_history` |

---

## Task 1 — Supabase migration

**Files:**
- Apply via Supabase MCP `apply_migration` tool

**Interfaces:**
- Produces: `user_history` table gains `last_page INTEGER NULL` and `last_chapter_id TEXT NULL` columns

- [ ] **Step 1: Apply the migration**

Use the Supabase MCP `apply_migration` tool with:

```sql
ALTER TABLE user_history
  ADD COLUMN IF NOT EXISTS last_page INTEGER,
  ADD COLUMN IF NOT EXISTS last_chapter_id TEXT;
```

Migration name: `add_reading_progress_to_user_history`

Expected: migration applied without error; columns visible in table schema.

- [ ] **Step 2: Verify columns exist**

Use Supabase MCP `execute_sql`:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'user_history'
  AND column_name IN ('last_page', 'last_chapter_id');
```

Expected: 2 rows returned, both `is_nullable = YES`.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(users): add last_page + last_chapter_id columns to user_history"
```

---

## Task 2 — Extend `UsersService` (TDD)

**Files:**
- Create: `Backend/src/users/users.service.spec.ts`
- Modify: `Backend/src/users/users.service.ts` lines 341–424

**Interfaces:**
- Consumes: migration from Task 1 (columns exist in DB)
- Produces:
  - `UsersService.upsertHistoryItem(uid, item)` — `item` gains `lastPage?: number | null` and `lastChapterId?: string | null`
  - `UsersService.getHistory(uid)` response entries gain `lastPage: number | null` and `lastChapterId: string | null`

- [ ] **Step 1: Write the failing tests**

Create `Backend/src/users/users.service.spec.ts`:

```typescript
import { UsersService } from './users.service';

describe('UsersService — reading history', () => {
  let service: UsersService;
  let mockChain: any;
  let mockUpsert: jest.Mock;

  const baseItem = {
    id: 'manga-1',
    title: 'One Piece',
    thumbnail: 'https://example.com/cover.jpg',
    lastReadAt: 1700000000000,
  };

  beforeEach(() => {
    mockUpsert = jest.fn().mockResolvedValue({ error: null });
    mockChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      upsert: mockUpsert,
    };

    const supabaseService = {
      client: { from: jest.fn().mockReturnValue(mockChain) },
    } as any;

    service = new UsersService(supabaseService);
  });

  // ── upsertHistoryItem ──────────────────────────────────────────────────

  describe('upsertHistoryItem', () => {
    it('writes lastPage and lastChapterId to the DB when provided', async () => {
      await service.upsertHistoryItem('u1', {
        ...baseItem,
        lastPage: 7,
        lastChapterId: 'ch-42',
      });
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({ last_page: 7, last_chapter_id: 'ch-42' }),
        expect.anything(),
      );
    });

    it('writes null for lastPage and lastChapterId when omitted (backward-compat)', async () => {
      await service.upsertHistoryItem('u1', baseItem);
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({ last_page: null, last_chapter_id: null }),
        expect.anything(),
      );
    });

    it('throws when Supabase returns an error', async () => {
      mockUpsert.mockResolvedValue({ error: { message: 'DB error' } });
      await expect(
        service.upsertHistoryItem('u1', baseItem),
      ).rejects.toThrow('Failed to upsert history item');
    });
  });

  // ── getHistory ─────────────────────────────────────────────────────────

  describe('getHistory', () => {
    it('maps last_page and last_chapter_id from DB row to camelCase', async () => {
      mockChain.limit = jest.fn().mockResolvedValue({
        data: [
          {
            manga_id: 'manga-1', title: 'One Piece', subtitle: '',
            thumbnail: 'https://example.com/cover.jpg',
            authors: [], description: '', published_date: '',
            categories: [], average_rating: 0, ratings_count: 0,
            last_read_at: 1700000000000,
            last_page: 7,
            last_chapter_id: 'ch-42',
          },
        ],
        error: null,
      });

      const result = await service.getHistory('u1');
      expect(result[0].lastPage).toBe(7);
      expect(result[0].lastChapterId).toBe('ch-42');
    });

    it('returns null for lastPage and lastChapterId when DB columns are null', async () => {
      mockChain.limit = jest.fn().mockResolvedValue({
        data: [
          {
            manga_id: 'manga-1', title: 'One Piece', subtitle: '',
            thumbnail: 'https://example.com/cover.jpg',
            authors: [], description: '', published_date: '',
            categories: [], average_rating: 0, ratings_count: 0,
            last_read_at: 1700000000000,
            last_page: null,
            last_chapter_id: null,
          },
        ],
        error: null,
      });

      const result = await service.getHistory('u1');
      expect(result[0].lastPage).toBeNull();
      expect(result[0].lastChapterId).toBeNull();
    });

    it('throws when Supabase returns an error', async () => {
      mockChain.limit = jest.fn().mockResolvedValue({
        data: null, error: { message: 'DB error' },
      });
      await expect(service.getHistory('u1')).rejects.toThrow('Failed to fetch history');
    });
  });
});
```

- [ ] **Step 2: Run tests — verify FAIL**

```bash
cd Backend && npx jest src/users/users.service.spec.ts --no-coverage
```

Expected: FAIL — `last_page` / `last_chapter_id` not in upsert call; `lastPage` / `lastChapterId` undefined in getHistory result.

- [ ] **Step 3: Update `upsertHistoryItem` in `users.service.ts`**

Replace the method signature and upsert object (lines 341–370):

```typescript
async upsertHistoryItem(
  uid: string,
  item: {
    id: string; title: string; subtitle?: string; thumbnail: string;
    authors?: string[]; description?: string; publishedDate?: string;
    categories?: string[]; averageRating?: number; ratingsCount?: number;
    lastReadAt: number;
    lastPage?: number | null;
    lastChapterId?: string | null;
  },
) {
  const { error } = await this.db.from('user_history').upsert({
    uid,
    manga_id: item.id,
    title: item.title ?? '',
    subtitle: item.subtitle ?? '',
    thumbnail: item.thumbnail ?? '',
    authors: item.authors ?? [],
    description: item.description ?? '',
    published_date: item.publishedDate ?? '',
    categories: item.categories ?? [],
    average_rating: item.averageRating ?? 0,
    ratings_count: item.ratingsCount ?? 0,
    last_read_at: item.lastReadAt ?? Date.now(),
    last_page: item.lastPage ?? null,
    last_chapter_id: item.lastChapterId ?? null,
  }, {
    onConflict: 'uid,manga_id',
  });

  if (error) {
    throw new Error(`Failed to upsert history item: ${error.message}`);
  }
}
```

- [ ] **Step 4: Update `getHistory` mapping in `users.service.ts`**

In `getHistory()` (lines 408–423), add the two new fields to the return object:

```typescript
return (data ?? []).map((row) => {
  const item = row as Record<string, unknown>;
  return {
    id: String(item['manga_id'] ?? ''),
    title: String(item['title'] ?? ''),
    subtitle: String(item['subtitle'] ?? ''),
    thumbnail: String(item['thumbnail'] ?? ''),
    authors: (item['authors'] as string[] | null) ?? [],
    description: String(item['description'] ?? ''),
    publishedDate: String(item['published_date'] ?? ''),
    categories: (item['categories'] as string[] | null) ?? [],
    averageRating: Number(item['average_rating'] ?? 0),
    ratingsCount: Number(item['ratings_count'] ?? 0),
    lastReadAt: Number(item['last_read_at'] ?? 0),
    lastPage: item['last_page'] != null ? Number(item['last_page']) : null,
    lastChapterId: item['last_chapter_id'] != null ? String(item['last_chapter_id']) : null,
  };
});
```

- [ ] **Step 5: Run tests — verify PASS**

```bash
cd Backend && npx jest src/users/users.service.spec.ts --no-coverage
```

Expected: 6 tests PASS.

- [ ] **Step 6: Build check**

```bash
cd Backend && npm run build 2>&1 | tail -20
```

Expected: build succeeds with no TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add Backend/src/users/users.service.ts Backend/src/users/users.service.spec.ts
git commit -m "feat(users): extend upsertHistoryItem + getHistory with lastPage/lastChapterId"
```

---

## Self-Review

### Spec coverage
- [x] Supabase migration adds `last_page` + `last_chapter_id` → Task 1
- [x] `POST /users/me/history` accepts new optional fields → Task 2 Step 3 (controller unchanged — passes body directly)
- [x] `GET /users/me/history` returns new fields → Task 2 Step 4
- [x] Backward-compat: omitted fields → null → Task 2 tests "when omitted"
- [x] Existing behaviour unchanged → Task 2 "throws when Supabase returns error" tests

### Placeholder scan
None — all steps contain actual code.

### Type consistency
- `lastPage?: number | null` defined in upsertHistoryItem signature (Step 3), written as `last_page: item.lastPage ?? null` ✓
- `lastChapterId?: string | null` defined in upsertHistoryItem signature (Step 3), written as `last_chapter_id: item.lastChapterId ?? null` ✓
- `getHistory` returns `lastPage: number | null` (Step 4); test asserts `result[0].lastPage` ✓
- `getHistory` returns `lastChapterId: string | null` (Step 4); test asserts `result[0].lastChapterId` ✓
- `mockChain.limit` mock pattern matches wallet.service.spec.ts prior art ✓
