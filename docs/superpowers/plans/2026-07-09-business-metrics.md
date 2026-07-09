# Business Metrics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 4 Prometheus counters (chapter reads, chapter unlocks, coins spent, coins added) to the NestJS backend, exposed automatically on the existing `GET /metrics` endpoint.

**Architecture:** A new `BusinessMetricsService` holds 4 `prom-client` Counters and is exported from `MetricsModule`. The 3 domain modules (`BooksModule`, `UnlockModule`, `WalletModule`) import `MetricsModule` to gain access, and their respective controller/services inject `BusinessMetricsService` and call the appropriate record method at the success point of each operation.

**Tech Stack:** NestJS 11, prom-client (already installed), Jest

## Global Constraints

- No labels on any counter — global counters only (no manga_id / user_id cardinality)
- `recordRead()` is called in `BooksController`, not `BooksService` — keeps it co-located with the existing `StatsIncrementService.recordChapterView()` call and avoids enlarging the already-large `BooksService`
- `recordUnlock()` increments both `chapter_unlocks_total` (+1) and `coins_spent_total` (+pricePaid) — the DB RPC deducts coins directly, `WalletService.spendCoins()` is a separate path and NOT called for unlocks (no double-counting)
- All instrumentation is fire-and-forget; failures must never throw to callers
- Test file: `npx jest <path> --no-coverage` run from `Backend/`

---

### Task 1: Create `BusinessMetricsService` + unit tests + update `MetricsModule`

**Files:**
- Create: `Backend/src/metrics/business-metrics.service.ts`
- Create: `Backend/src/metrics/business-metrics.service.spec.ts`
- Modify: `Backend/src/metrics/metrics.module.ts`

**Interfaces:**
- Produces: `BusinessMetricsService` with methods:
  - `recordRead(): void`
  - `recordUnlock(pricePaid: number): void`
  - `recordCoinsSpent(amount: number): void`
  - `recordCoinsAdded(amount: number): void`

- [ ] **Step 1: Write the failing unit tests**

Create `Backend/src/metrics/business-metrics.service.spec.ts`:

```typescript
import { BusinessMetricsService } from './business-metrics.service';
import { Counter } from 'prom-client';

jest.mock('prom-client', () => ({
  Counter: jest.fn().mockImplementation(() => ({ inc: jest.fn() })),
}));

describe('BusinessMetricsService', () => {
  let service: BusinessMetricsService;
  let reads: { inc: jest.Mock };
  let unlocks: { inc: jest.Mock };
  let spent: { inc: jest.Mock };
  let added: { inc: jest.Mock };

  beforeEach(() => {
    (Counter as jest.Mock).mockClear();
    service = new BusinessMetricsService();
    // Counter instantiation order matches field declaration order in the service
    [reads, unlocks, spent, added] = (Counter as jest.Mock).mock.instances as any[];
  });

  it('recordRead() calls chapterReadsTotal.inc(1)', () => {
    service.recordRead();
    expect(reads.inc).toHaveBeenCalledWith(1);
  });

  it('recordUnlock(5) increments chapterUnlocksTotal by 1 and coinsSpentTotal by 5', () => {
    service.recordUnlock(5);
    expect(unlocks.inc).toHaveBeenCalledWith(1);
    expect(spent.inc).toHaveBeenCalledWith(5);
  });

  it('recordCoinsSpent(10) increments coinsSpentTotal by 10', () => {
    service.recordCoinsSpent(10);
    expect(spent.inc).toHaveBeenCalledWith(10);
  });

  it('recordCoinsAdded(100) increments coinsAddedTotal by 100', () => {
    service.recordCoinsAdded(100);
    expect(added.inc).toHaveBeenCalledWith(100);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd Backend && npx jest src/metrics/business-metrics.service.spec.ts --no-coverage
```

Expected: FAIL — "Cannot find module './business-metrics.service'"

- [ ] **Step 3: Create `BusinessMetricsService`**

Create `Backend/src/metrics/business-metrics.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { Counter } from 'prom-client';

@Injectable()
export class BusinessMetricsService {
  private readonly chapterReadsTotal = new Counter({
    name: 'mangadock_chapter_reads_total',
    help: 'Total chapter page fetches served successfully',
  });

  private readonly chapterUnlocksTotal = new Counter({
    name: 'mangadock_chapter_unlocks_total',
    help: 'Total new chapter unlock purchases',
  });

  private readonly coinsSpentTotal = new Counter({
    name: 'mangadock_coins_spent_total',
    help: 'Total coins spent across all paths',
  });

  private readonly coinsAddedTotal = new Counter({
    name: 'mangadock_coins_added_total',
    help: 'Total coins credited to wallets',
  });

  recordRead(): void {
    this.chapterReadsTotal.inc(1);
  }

  recordUnlock(pricePaid: number): void {
    this.chapterUnlocksTotal.inc(1);
    this.coinsSpentTotal.inc(pricePaid);
  }

  recordCoinsSpent(amount: number): void {
    this.coinsSpentTotal.inc(amount);
  }

  recordCoinsAdded(amount: number): void {
    this.coinsAddedTotal.inc(amount);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd Backend && npx jest src/metrics/business-metrics.service.spec.ts --no-coverage
```

Expected: PASS — 4 tests green

- [ ] **Step 5: Add `BusinessMetricsService` to `MetricsModule` providers + exports**

Edit `Backend/src/metrics/metrics.module.ts` — replace the full file:

```typescript
import { Module, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { MetricsMiddleware } from './metrics.middleware';
import { BusinessMetricsService } from './business-metrics.service';

@Module({
  controllers: [MetricsController],
  providers: [BusinessMetricsService],
  exports: [BusinessMetricsService],
})
export class MetricsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(MetricsMiddleware)
      .exclude({ path: 'metrics', method: RequestMethod.GET })
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
```

- [ ] **Step 6: Commit**

```bash
cd Backend && git add src/metrics/business-metrics.service.ts src/metrics/business-metrics.service.spec.ts src/metrics/metrics.module.ts
git commit -m "feat(metrics): add BusinessMetricsService with 4 business counters"
```

---

### Task 2: Wire read counter in `BooksModule` + `BooksController`

**Files:**
- Modify: `Backend/src/books/books.module.ts` (add `MetricsModule` to imports)
- Modify: `Backend/src/books/books.controller.ts` (inject `BusinessMetricsService`; call `recordRead()`)
- Modify: `Backend/src/books/books-stats.spec.ts` (pass mock `biz` to constructor — 3rd arg)

**Interfaces:**
- Consumes: `BusinessMetricsService.recordRead(): void` from Task 1

- [ ] **Step 1: Update `books-stats.spec.ts` to pass mock `biz` as 3rd constructor arg**

The existing test constructs `BooksController(books, stats)`. Adding a 3rd DI arg breaks this test. Add a stub `biz` mock.

Edit `Backend/src/books/books-stats.spec.ts` — replace `makeController`:

```typescript
function makeBiz() {
  return { recordRead: jest.fn() };
}

function makeController(books = makeBooks(), stats = makeStats(), biz = makeBiz()) {
  return {
    ctrl: new BooksController(books as any, stats as unknown as StatsIncrementService, biz as any),
    books,
    stats,
    biz,
  };
}
```

- [ ] **Step 2: Run existing stats tests to confirm they still pass (with mock biz stub)**

```bash
cd Backend && npx jest src/books/books-stats.spec.ts --no-coverage
```

Expected: FAIL — "Expected 2 arguments, but got 3" (TypeScript error, since BooksController constructor still only has 2 params)

This is expected — we'll fix the controller next.

- [ ] **Step 3: Inject `BusinessMetricsService` in `BooksController` constructor and call `recordRead()`**

Edit `Backend/src/books/books.controller.ts`:

1. Add import at top (after `StatsIncrementService` import):
```typescript
import { BusinessMetricsService } from '../metrics/business-metrics.service';
```

2. Add 3rd constructor parameter:
```typescript
constructor(
  private readonly booksService: BooksService,
  private readonly statsIncrement: StatsIncrementService,
  private readonly biz: BusinessMetricsService,
) {}
```

3. In `getMangaChapterPages` (around line 159), add `this.biz.recordRead()` right after the existing `statsIncrement` call:
```typescript
void this.statsIncrement.recordChapterView(chapterId, mangaId ?? '', uid, date);
this.biz.recordRead();
return result;
```

- [ ] **Step 4: Add `MetricsModule` to `BooksModule` imports**

Edit `Backend/src/books/books.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { BooksController } from './books.controller';
import { MitWebhookController } from './mit-webhook.controller';
import { PatchesController } from './patches.controller';
import { BooksService } from './books.service';
import { MangaDexService } from './mangadex.service';
import { MitClient } from './mit-client';
import { LlmService } from './llm.service';
import { StatusModule } from '../status/status.module';
import { CacheModule } from '../cache/cache.module';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [StatusModule, CacheModule, MetricsModule],
  controllers: [BooksController, MitWebhookController, PatchesController],
  providers: [BooksService, MangaDexService, MitClient, LlmService],
  exports: [BooksService],
})
export class BooksModule {}
```

- [ ] **Step 5: Run both stats tests to verify they pass**

```bash
cd Backend && npx jest src/books/books-stats.spec.ts --no-coverage
```

Expected: PASS — 3 tests green

- [ ] **Step 6: Commit**

```bash
cd Backend && git add src/books/books.module.ts src/books/books.controller.ts src/books/books-stats.spec.ts
git commit -m "feat(metrics): wire chapter read counter in BooksController"
```

---

### Task 3: Wire unlock counter in `UnlockModule` + `UnlockService`

**Files:**
- Modify: `Backend/src/unlock/unlock.module.ts` (add `MetricsModule` to imports)
- Modify: `Backend/src/unlock/unlock.service.ts` (inject `BusinessMetricsService`; call `recordUnlock()`)

**Interfaces:**
- Consumes: `BusinessMetricsService.recordUnlock(pricePaid: number): void` from Task 1

- [ ] **Step 1: Inject `BusinessMetricsService` in `UnlockService`**

Edit `Backend/src/unlock/unlock.service.ts`:

1. Add import after existing imports:
```typescript
import { BusinessMetricsService } from '../metrics/business-metrics.service';
```

2. Update constructor (add 3rd param):
```typescript
constructor(
  private readonly supabase: SupabaseService,
  private readonly walletService: WalletService,
  private readonly biz: BusinessMetricsService,
) {}
```

3. In `purchaseUnlock()`, after the `if (row?.already_unlocked)` early-return block (around line 97), add the `recordUnlock` call:

Before (lines 92–98):
```typescript
const row = Array.isArray(data) ? data[0] : (data as any);
if (row?.already_unlocked) {
  return { alreadyUnlocked: true };
}

this.logger.log(`User ${uid} unlocked version ${versionId} for ${row?.price_paid} coins`);
return { unlocked: true, pricePaid: row?.price_paid, balance: row?.balance };
```

After:
```typescript
const row = Array.isArray(data) ? data[0] : (data as any);
if (row?.already_unlocked) {
  return { alreadyUnlocked: true };
}

this.logger.log(`User ${uid} unlocked version ${versionId} for ${row?.price_paid} coins`);
this.biz.recordUnlock(row?.price_paid ?? 0);
return { unlocked: true, pricePaid: row?.price_paid, balance: row?.balance };
```

- [ ] **Step 2: Add `MetricsModule` to `UnlockModule` imports**

Edit `Backend/src/unlock/unlock.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { UnlockController } from './unlock.controller';
import { UnlockService } from './unlock.service';
import { WalletModule } from '../wallet/wallet.module';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [WalletModule, MetricsModule],
  controllers: [UnlockController],
  providers: [UnlockService],
})
export class UnlockModule {}
```

- [ ] **Step 3: Run lint to verify no TypeScript errors**

```bash
cd Backend && npm run lint
```

Expected: 0 errors (warnings acceptable)

- [ ] **Step 4: Commit**

```bash
cd Backend && git add src/unlock/unlock.module.ts src/unlock/unlock.service.ts
git commit -m "feat(metrics): wire chapter unlock + coins_spent counters in UnlockService"
```

---

### Task 4: Wire coins counters in `WalletModule` + `WalletService`

**Files:**
- Modify: `Backend/src/wallet/wallet.module.ts` (add `MetricsModule` to imports)
- Modify: `Backend/src/wallet/wallet.service.ts` (inject `BusinessMetricsService`; call `recordCoinsAdded/Spent()`)

**Interfaces:**
- Consumes:
  - `BusinessMetricsService.recordCoinsAdded(amount: number): void` from Task 1
  - `BusinessMetricsService.recordCoinsSpent(amount: number): void` from Task 1

- [ ] **Step 1: Inject `BusinessMetricsService` in `WalletService`**

Edit `Backend/src/wallet/wallet.service.ts`:

1. Add import after existing imports:
```typescript
import { BusinessMetricsService } from '../metrics/business-metrics.service';
```

2. Update constructor (add 4th param):
```typescript
constructor(
  private readonly supabase: SupabaseService,
  private readonly xenditService: XenditService,
  private readonly walletEvents: WalletEventsService,
  private readonly biz: BusinessMetricsService,
) {}
```

3. In `addCoins()`, after the RPC call and before `return` (around line 93–96):

Before:
```typescript
const newBalance: number = Array.isArray(data) ? data[0]?.balance : (data as any)?.balance;
this.logger.log(`Added ${amount} coins (${type}) to user ${uid}, new balance: ${newBalance}`);
return { balance: newBalance };
```

After:
```typescript
const newBalance: number = Array.isArray(data) ? data[0]?.balance : (data as any)?.balance;
this.logger.log(`Added ${amount} coins (${type}) to user ${uid}, new balance: ${newBalance}`);
this.biz.recordCoinsAdded(amount);
return { balance: newBalance };
```

4. In `spendCoins()`, after the RPC call and before `return` (around line 122–125):

Before:
```typescript
const newBalance: number = Array.isArray(data) ? data[0]?.balance : (data as any)?.balance;
this.logger.log(`Spent ${amount} coins for user ${uid}, new balance: ${newBalance}`);
return { balance: newBalance };
```

After:
```typescript
const newBalance: number = Array.isArray(data) ? data[0]?.balance : (data as any)?.balance;
this.logger.log(`Spent ${amount} coins for user ${uid}, new balance: ${newBalance}`);
this.biz.recordCoinsSpent(amount);
return { balance: newBalance };
```

- [ ] **Step 2: Add `MetricsModule` to `WalletModule` imports**

Edit `Backend/src/wallet/wallet.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { XenditService } from './xendit.service';
import { WalletEventsService } from './wallet-events.service';
import { TopupThrottleGuard } from './topup-throttle.guard';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [MetricsModule],
  controllers: [WalletController],
  providers: [WalletService, XenditService, WalletEventsService, TopupThrottleGuard],
  exports: [WalletService],
})
export class WalletModule {}
```

- [ ] **Step 3: Run full backend unit tests**

```bash
cd Backend && npm test -- --no-coverage
```

Expected: All existing tests pass. No new failures.

- [ ] **Step 4: Run lint**

```bash
cd Backend && npm run lint
```

Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
cd Backend && git add src/wallet/wallet.module.ts src/wallet/wallet.service.ts
git commit -m "feat(metrics): wire coins_added and coins_spent counters in WalletService"
```

---

## Integration Smoke Test

After all 4 tasks complete, verify the 4 counters appear in `GET /metrics`:

1. Start backend: `npm run start:dev` (from `Backend/`)
2. Fetch a chapter page (triggers `recordRead`)
3. Purchase an unlock (triggers `recordUnlock`)
4. Do a coin topup webhook (triggers `recordCoinsAdded`)
5. Curl the metrics endpoint:

```bash
curl http://localhost:4001/metrics | grep mangadock_chapter
curl http://localhost:4001/metrics | grep mangadock_coins
```

Expected output includes:
```
mangadock_chapter_reads_total 1
mangadock_chapter_unlocks_total 1
mangadock_coins_spent_total <price>
mangadock_coins_added_total <amount>
```
