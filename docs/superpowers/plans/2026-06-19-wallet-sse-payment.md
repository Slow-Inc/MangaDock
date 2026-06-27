# Wallet SSE Payment Confirmation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace 3-second polling with SSE push so TopupModal transitions to SUCCESS immediately when Xendit fires the payment webhook — on both dev (simulate) and production.

**Architecture:** A new `WalletEventsService` holds one RxJS `Subject` per `paymentId`; the existing `processXenditWebhook` emits on it after crediting coins; a new `@Sse()` controller endpoint subscribes with ownership check and auto-closes on expiry. The frontend uses `fetch + ReadableStream` (never `EventSource`) so the JWT stays in `Authorization` header.

**Tech Stack:** NestJS 11 · RxJS · Node.js `crypto` (built-in) · Next.js 16 · TypeScript

## Global Constraints

- JWT must be in `Authorization: Bearer <token>` header — never in a query param
- SSE stream verifies `coin_topups.uid === jwt.uid` before subscribing (ownership check)
- SSE stream auto-closes when `expires_at` elapses — no dangling connections
- SSE stream completes after emitting exactly **one** `payment.paid` event
- `processXenditWebhook` emits SSE only **after** DB `UPDATE status='paid'` succeeds
- `simulateTopup` unchanged — Xendit simulate → webhook → SSE (same as production)
- HMAC check is optional: skip gracefully when `XENDIT_WEBHOOK_SECRET` env var is absent (sandbox)
- `main.ts` needs **no changes** — `req.rawBody` is already saved by the existing `json({ verify })` middleware
- SSE wire format: `data: {"event":"payment.paid","balance":<N>}\n\n`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `Backend/src/wallet/wallet-events.service.ts` | **Create** | In-memory RxJS Subject per paymentId |
| `Backend/src/wallet/wallet-events.service.spec.ts` | **Create** | Unit tests for WalletEventsService |
| `Backend/src/wallet/wallet.module.ts` | **Modify** | Add WalletEventsService to providers |
| `Backend/src/wallet/wallet.service.ts` | **Modify** | Add `getTopupExpiry()` + update `processXenditWebhook()` |
| `Backend/src/wallet/wallet.service.spec.ts` | **Modify** | Add WalletEventsService mock + new test cases |
| `Backend/src/wallet/wallet.controller.ts` | **Modify** | Update `xenditWebhook` + add `@Sse()` stream endpoint |
| `Frontend/app/lib/studioApi.ts` | **Modify** | Add `subscribeTopupStream()` helper |
| `Frontend/app/components/TopupModal.tsx` | **Modify** | Replace `setInterval` polling with SSE `useEffect` |

---

### Task 1: WalletEventsService

**Files:**
- Create: `Backend/src/wallet/wallet-events.service.ts`
- Create: `Backend/src/wallet/wallet-events.service.spec.ts`
- Modify: `Backend/src/wallet/wallet.module.ts`

**Interfaces — Produces:**
- `WalletEventsService.stream$(paymentId: string): Observable<{ balance: number }>`
- `WalletEventsService.emit(paymentId: string, data: { balance: number }): void`

- [ ] **Step 1: Write failing tests**

Create `Backend/src/wallet/wallet-events.service.spec.ts`:

```typescript
import { WalletEventsService } from './wallet-events.service';

describe('WalletEventsService', () => {
  let service: WalletEventsService;

  beforeEach(() => {
    service = new WalletEventsService();
  });

  it('stream$ emits value and completes when emit() is called', (done) => {
    const values: { balance: number }[] = [];
    service.stream$('pay-123').subscribe({
      next: (v) => values.push(v),
      complete: () => {
        expect(values).toEqual([{ balance: 500 }]);
        done();
      },
    });
    service.emit('pay-123', { balance: 500 });
  });

  it('emit on unknown paymentId does nothing', () => {
    expect(() => service.emit('unknown', { balance: 0 })).not.toThrow();
  });

  it('internal subject is cleaned up after emit — second emit is a no-op', () => {
    service.stream$('pay-789').subscribe();
    service.emit('pay-789', { balance: 100 });
    expect(() => service.emit('pay-789', { balance: 200 })).not.toThrow();
  });
});
```

- [ ] **Step 2: Run tests — verify FAIL**

```bash
cd Backend && npx jest src/wallet/wallet-events.service.spec.ts --no-coverage
```
Expected: `Cannot find module './wallet-events.service'`

- [ ] **Step 3: Create WalletEventsService**

Create `Backend/src/wallet/wallet-events.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';

@Injectable()
export class WalletEventsService {
  private readonly subjects = new Map<string, Subject<{ balance: number }>>();

  private getOrCreate(paymentId: string): Subject<{ balance: number }> {
    if (!this.subjects.has(paymentId)) {
      this.subjects.set(paymentId, new Subject<{ balance: number }>());
    }
    return this.subjects.get(paymentId)!;
  }

  stream$(paymentId: string): Observable<{ balance: number }> {
    return this.getOrCreate(paymentId).asObservable();
  }

  emit(paymentId: string, data: { balance: number }): void {
    const sub = this.subjects.get(paymentId);
    if (!sub) return;
    sub.next(data);
    sub.complete();
    this.subjects.delete(paymentId);
  }
}
```

- [ ] **Step 4: Run tests — verify PASS**

```bash
cd Backend && npx jest src/wallet/wallet-events.service.spec.ts --no-coverage
```
Expected: 3 tests PASS

- [ ] **Step 5: Register in wallet.module.ts**

Replace `Backend/src/wallet/wallet.module.ts` entirely:

```typescript
import { Module } from '@nestjs/common';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { XenditService } from './xendit.service';
import { WalletEventsService } from './wallet-events.service';

@Module({
  controllers: [WalletController],
  providers: [WalletService, XenditService, WalletEventsService],
  exports: [WalletService],
})
export class WalletModule {}
```

- [ ] **Step 6: Commit**

```bash
cd Backend
git add src/wallet/wallet-events.service.ts src/wallet/wallet-events.service.spec.ts src/wallet/wallet.module.ts
git commit -m "feat(wallet): WalletEventsService — in-memory RxJS Subject per paymentId"
```

---

### Task 2: Webhook HMAC verification + SSE emit

**Files:**
- Modify: `Backend/src/wallet/wallet.service.ts`
- Modify: `Backend/src/wallet/wallet.service.spec.ts`
- Modify: `Backend/src/wallet/wallet.controller.ts`

**Interfaces — Consumes:** `WalletEventsService.emit()` (Task 1)

**Interfaces — Produces:**
- `WalletService` constructor: 3rd arg `walletEvents: WalletEventsService`
- `WalletService.processXenditWebhook(payload, token, rawBody?, signature?): Promise<{ received: boolean }>`

- [ ] **Step 1: Write failing tests**

In `Backend/src/wallet/wallet.service.spec.ts`, make these changes:

**A) Add `mockWalletEvents` to outer scope** (after `let mockXendit` line):
```typescript
let mockWalletEvents: { emit: jest.Mock };
```

**B) In the top-level `beforeEach`, add init + update constructor call:**
```typescript
// Add inside beforeEach, before `service = ...`:
mockWalletEvents = { emit: jest.fn() };

// Change the service instantiation line from:
service = new WalletService(supabaseService, mockXendit as any);
// To:
service = new WalletService(supabaseService, mockXendit as any, mockWalletEvents as any);
```

**C) Add new describe block at the end of the file** (before closing `}`):
```typescript
  describe('processXenditWebhook — SSE emit + HMAC', () => {
    const WEBHOOK_TOKEN = 'test-webhook-token';

    beforeEach(() => {
      process.env.XENDIT_WEBHOOK_TOKEN = WEBHOOK_TOKEN;
      mockWalletEvents.emit.mockClear();
    });

    afterEach(() => {
      delete process.env.XENDIT_WEBHOOK_TOKEN;
      delete process.env.XENDIT_WEBHOOK_SECRET;
    });

    it('emits SSE event with balance after successful payment', async () => {
      mockChain.maybeSingle.mockResolvedValue({
        data: { status: 'pending', uid: 'u1', amount_coins: 100 },
        error: null,
      });
      mockRpc.mockResolvedValue({ data: [{ balance: 350 }], error: null });

      await service.processXenditWebhook(
        { event: 'payment.succeeded', data: { payment_request_id: 'pr-sse', status: 'SUCCEEDED' } },
        WEBHOOK_TOKEN,
      );

      expect(mockWalletEvents.emit).toHaveBeenCalledWith('pr-sse', { balance: 350 });
    });

    it('does NOT emit SSE on payment.failed', async () => {
      await service.processXenditWebhook(
        { event: 'payment.failed', data: { payment_request_id: 'pr-fail', status: 'FAILED' } },
        WEBHOOK_TOKEN,
      );
      expect(mockWalletEvents.emit).not.toHaveBeenCalled();
    });

    it('does NOT emit SSE when already paid (idempotency)', async () => {
      mockChain.maybeSingle.mockResolvedValue({
        data: { status: 'paid', uid: 'u1', amount_coins: 100 },
        error: null,
      });
      await service.processXenditWebhook(
        { event: 'payment.succeeded', data: { payment_request_id: 'pr-dup', status: 'SUCCEEDED' } },
        WEBHOOK_TOKEN,
      );
      expect(mockWalletEvents.emit).not.toHaveBeenCalled();
    });

    it('skips HMAC check when XENDIT_WEBHOOK_SECRET is not set', async () => {
      delete process.env.XENDIT_WEBHOOK_SECRET;
      mockChain.maybeSingle.mockResolvedValue({
        data: { status: 'pending', uid: 'u1', amount_coins: 50 },
        error: null,
      });
      mockRpc.mockResolvedValue({ data: [{ balance: 50 }], error: null });

      await expect(
        service.processXenditWebhook(
          { event: 'payment.succeeded', data: { payment_request_id: 'pr-nohmac', status: 'SUCCEEDED' } },
          WEBHOOK_TOKEN,
          Buffer.from('body'),
          'any-sig',
        ),
      ).resolves.toEqual({ received: true });
    });

    it('throws UnauthorizedException on invalid HMAC when XENDIT_WEBHOOK_SECRET is set', async () => {
      process.env.XENDIT_WEBHOOK_SECRET = 'secret-key';
      await expect(
        service.processXenditWebhook(
          { event: 'payment.succeeded', data: { payment_request_id: 'pr-1', status: 'SUCCEEDED' } },
          WEBHOOK_TOKEN,
          Buffer.from('{"body":true}'),
          'deadbeef',
        ),
      ).rejects.toThrow(UnauthorizedException);
      expect(mockWalletEvents.emit).not.toHaveBeenCalled();
    });
  });

  describe('getTopupExpiry', () => {
    it('returns expiresAt and status for owned pending topup', async () => {
      mockChain.maybeSingle.mockResolvedValue({
        data: { expires_at: '2026-06-19T10:00:00Z', status: 'pending' },
        error: null,
      });
      const result = await service.getTopupExpiry('pay-1', 'u1');
      expect(result).toEqual({ expiresAt: '2026-06-19T10:00:00Z', status: 'pending' });
    });

    it('throws NotFoundException when topup not found or uid mismatch', async () => {
      mockChain.maybeSingle.mockResolvedValue({ data: null, error: null });
      await expect(service.getTopupExpiry('pay-x', 'u1')).rejects.toThrow(NotFoundException);
    });
  });
```

- [ ] **Step 2: Run tests — verify FAIL**

```bash
cd Backend && npx jest src/wallet/wallet.service.spec.ts --no-coverage 2>&1 | tail -20
```
Expected: constructor arity error or missing method errors

- [ ] **Step 3: Update WalletService — constructor + getTopupExpiry**

In `Backend/src/wallet/wallet.service.ts`:

**A) Update the import line for crypto** (existing has `randomUUID`):
```typescript
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
```

**B) Add `WalletEventsService` import** after existing imports:
```typescript
import { WalletEventsService } from './wallet-events.service';
```

**C) Replace the constructor:**
```typescript
constructor(
  private readonly supabase: SupabaseService,
  private readonly xenditService: XenditService,
  private readonly walletEvents: WalletEventsService,
) {}
```

**D) Add `getTopupExpiry` method** (after `getBalance`):
```typescript
async getTopupExpiry(
  paymentId: string,
  uid: string,
): Promise<{ expiresAt: string; status: string }> {
  const { data, error } = await this.db
    .from('coin_topups')
    .select('expires_at, status')
    .eq('payment_id', paymentId)
    .eq('uid', uid)
    .maybeSingle();

  if (error) throw new InternalServerErrorException(`Failed to fetch topup: ${error.message}`);
  if (!data) throw new NotFoundException('Topup not found');
  return { expiresAt: data.expires_at, status: data.status };
}
```

- [ ] **Step 4: Update processXenditWebhook — add HMAC check + SSE emit**

In `Backend/src/wallet/wallet.service.ts`, replace the `processXenditWebhook` method signature and first block:

```typescript
async processXenditWebhook(
  payload: Record<string, any>,
  token: string,
  rawBody?: Buffer,
  signature?: string,
): Promise<{ received: boolean }> {
  // 1. Static token check
  const expected = process.env.XENDIT_WEBHOOK_TOKEN;
  if (!expected || !token || token !== expected) {
    throw new UnauthorizedException('Invalid webhook token');
  }

  // 2. Optional HMAC-SHA256 check (skip if XENDIT_WEBHOOK_SECRET not configured)
  const webhookSecret = process.env.XENDIT_WEBHOOK_SECRET;
  if (webhookSecret && rawBody && signature) {
    const computed = createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
    let valid = false;
    try {
      const a = Buffer.from(computed, 'hex');
      const b = Buffer.from(signature, 'hex');
      valid = a.length === b.length && timingSafeEqual(a, b);
    } catch {
      valid = false;
    }
    if (!valid) throw new UnauthorizedException('Invalid webhook signature');
  }

  // (rest of method unchanged until the final payment.succeeded block)
```

Then at the end of the `payment.succeeded` block, replace the final lines:

```typescript
  // Was: await this.addCoins(...); ... return { received: true };
  // Replace with:
  const { balance } = await this.addCoins(
    data.uid,
    data.amount_coins,
    'topup',
    'เติมเหรียญ MangaDock',
    paymentId,
  );

  const { error: updateError } = await this.db
    .from('coin_topups')
    .update({ status: 'paid' })
    .eq('payment_id', paymentId);

  if (updateError) {
    throw new InternalServerErrorException(
      `Failed to update topup status: ${updateError.message}`,
    );
  }

  // Emit SSE only after DB update succeeds
  this.walletEvents.emit(paymentId, { balance });

  return { received: true };
```

- [ ] **Step 5: Update xenditWebhook controller endpoint**

In `Backend/src/wallet/wallet.controller.ts`, update the `xenditWebhook` method:

```typescript
@Post('xendit/webhook')
async xenditWebhook(
  @Req() req: Request & { rawBody?: Buffer },
  @Body() body: Record<string, any>,
  @Headers('x-callback-token') token: string,
  @Headers('x-xendit-webhook-signature') signature: string,
) {
  return this.wallet.processXenditWebhook(body, token, (req as any).rawBody, signature);
}
```

> Note: `req.rawBody` is already populated by the existing `json({ verify })` middleware in `main.ts` — no changes to main.ts needed.

- [ ] **Step 6: Run all wallet tests — verify PASS**

```bash
cd Backend && npx jest src/wallet/wallet.service.spec.ts src/wallet/wallet-events.service.spec.ts --no-coverage
```
Expected: all tests PASS

- [ ] **Step 7: Commit**

```bash
cd Backend
git add src/wallet/wallet.service.ts src/wallet/wallet.service.spec.ts src/wallet/wallet.controller.ts
git commit -m "feat(wallet): HMAC webhook signature verification + SSE emit on payment.succeeded"
```

---

### Task 3: SSE stream endpoint

**Files:**
- Modify: `Backend/src/wallet/wallet.controller.ts`

**Interfaces — Consumes:**
- `WalletService.getTopupExpiry(paymentId, uid): Promise<{ expiresAt: string; status: string }>` (Task 2)
- `WalletService.getBalance(uid): Promise<number>` (existing)
- `WalletEventsService.stream$(paymentId): Observable<{ balance: number }>` (Task 1)

- [ ] **Step 1: Add SSE endpoint to wallet.controller.ts**

**A) Add imports** at the top of `Backend/src/wallet/wallet.controller.ts`:
```typescript
import { MessageEvent, Sse } from '@nestjs/common';
import { EMPTY, Observable, of, timer } from 'rxjs';
import { map, takeUntil } from 'rxjs/operators';
import { WalletEventsService } from './wallet-events.service';
```

**B) Update controller constructor** to inject `WalletEventsService`:
```typescript
constructor(
  private readonly wallet: WalletService,
  private readonly walletEvents: WalletEventsService,
) {}
```

**C) Add SSE endpoint** (place after `getTopupStatus` endpoint):
```typescript
@Sse('topup/:paymentId/stream')
@UseGuards(AuthGuard)
async streamTopupStatus(
  @Req() req: Request & { [USER_KEY]: SupabaseAuthUser },
  @Param('paymentId') paymentId: string,
): Promise<Observable<MessageEvent>> {
  const uid = req[USER_KEY].uid;

  // Ownership check — throws NotFoundException if uid mismatch
  const topup = await this.wallet.getTopupExpiry(paymentId, uid);

  // Already paid before client connected (race condition) — emit immediately
  if (topup.status === 'paid') {
    const balance = await this.wallet.getBalance(uid);
    return of({
      data: JSON.stringify({ event: 'payment.paid', balance }),
    } as MessageEvent);
  }

  // Expired or cancelled — close immediately with no events
  if (topup.status !== 'pending') {
    return EMPTY;
  }

  // Auto-close when QR expires
  const msUntilExpiry = Math.max(
    new Date(topup.expiresAt).getTime() - Date.now(),
    1000,
  );

  return this.walletEvents.stream$(paymentId).pipe(
    map(
      ({ balance }) =>
        ({
          data: JSON.stringify({ event: 'payment.paid', balance }),
        }) as MessageEvent,
    ),
    takeUntil(timer(msUntilExpiry)),
  );
}
```

- [ ] **Step 2: Build backend — verify no TypeScript errors**

```bash
cd Backend && npm run build 2>&1 | tail -20
```
Expected: build succeeds with no errors

- [ ] **Step 3: Commit**

```bash
cd Backend
git add src/wallet/wallet.controller.ts
git commit -m "feat(wallet): SSE endpoint GET /wallet/topup/:paymentId/stream"
```

---

### Task 4: Frontend SSE integration

**Files:**
- Modify: `Frontend/app/lib/studioApi.ts`
- Modify: `Frontend/app/components/TopupModal.tsx`

**Interfaces — Consumes:** `GET /api/proxy/wallet/topup/:paymentId/stream` (Task 3)

**Interfaces — Produces:** `subscribeTopupStream(token, paymentId, onPaid, onError): () => void`

- [ ] **Step 1: Add subscribeTopupStream to studioApi.ts**

Append to the end of `Frontend/app/lib/studioApi.ts`:

```typescript
export function subscribeTopupStream(
  token: string,
  paymentId: string,
  onPaid: (balance: number) => void,
  onError: (err: Error) => void,
): () => void {
  const controller = new AbortController();

  (async () => {
    let res: Response;
    try {
      res = await fetch(
        `/api/proxy/wallet/topup/${encodeURIComponent(paymentId)}/stream`,
        {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        },
      );
    } catch (e: any) {
      if (e?.name !== 'AbortError') onError(e instanceof Error ? e : new Error(String(e)));
      return;
    }

    if (!res.ok || !res.body) {
      onError(new Error(`SSE ${res.status}`));
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          try {
            const payload = JSON.parse(line.slice(5).trim()) as {
              event: string;
              balance: number;
            };
            if (payload.event === 'payment.paid') onPaid(payload.balance);
          } catch {
            // malformed SSE line — skip
          }
        }
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') onError(e instanceof Error ? e : new Error(String(e)));
    }
  })();

  return () => controller.abort();
}
```

- [ ] **Step 2: Update TopupModal.tsx imports**

In `Frontend/app/components/TopupModal.tsx`, change the studioApi import line from:
```typescript
import { createTopup, getTopupStatus, cancelTopup, simulateTopup } from "../lib/studioApi";
```
To:
```typescript
import { createTopup, cancelTopup, simulateTopup, subscribeTopupStream } from "../lib/studioApi";
```

- [ ] **Step 3: Remove polling useEffect from TopupModal.tsx**

Delete the entire polling `useEffect` block (~lines 87-107):
```typescript
// DELETE THIS ENTIRE BLOCK:
useEffect(() => {
  if (screen !== 'QR_DISPLAY' || !paymentId) return;
  const poll = async () => {
    try {
      const token = await getIdToken();
      if (!token) return;
      const result = await getTopupStatus(token, paymentId);
      if (result.status === 'paid') {
        const newBalance = result.balance ?? 0;
        setSuccessBalance(newBalance);
        onSuccess(newBalance);
        window.dispatchEvent(new CustomEvent("mb:coin-balance-update", { detail: { balance: newBalance } }));
        setScreen("SUCCESS");
      } else if (result.status === 'expired') {
        setScreen("QR_EXPIRED");
      }
    } catch {
      // silent — will retry next tick
    }
  };
  const id = setInterval(poll, 3000);
  return () => clearInterval(id);
}, [screen, paymentId, getIdToken, onSuccess]);
```

- [ ] **Step 4: Add SSE useEffect in its place**

Add the following `useEffect` where the polling block was:
```typescript
// SSE — receive payment confirmation push from server
useEffect(() => {
  if (screen !== "QR_DISPLAY" || !paymentId) return;

  let cleanup: (() => void) | null = null;

  getIdToken().then((token) => {
    if (!token) return;
    cleanup = subscribeTopupStream(
      token,
      paymentId,
      (balance) => {
        setSuccessBalance(balance);
        onSuccess(balance);
        window.dispatchEvent(
          new CustomEvent("mb:coin-balance-update", { detail: { balance } }),
        );
        setScreen("SUCCESS");
      },
      () => {
        // silent — QR expiry countdown already handles timeout UX
      },
    );
  });

  return () => {
    cleanup?.();
  };
}, [screen, paymentId, getIdToken, onSuccess]);
```

- [ ] **Step 5: Verify TypeScript build**

```bash
cd Frontend && bun run build 2>&1 | tail -30
```
Expected: build succeeds with no type errors

- [ ] **Step 6: Run backend tests — verify no regressions**

```bash
cd Backend && npx jest src/wallet/ --no-coverage
```
Expected: all tests PASS

- [ ] **Step 7: Commit**

```bash
cd Frontend
git add app/lib/studioApi.ts app/components/TopupModal.tsx
git commit -m "feat(Frontend): replace topup polling with SSE push — subscribeTopupStream"
```

---

## Self-Review

### Spec coverage
- [x] `WalletEventsService` — RxJS Subject per paymentId, auto-complete after emit → Task 1
- [x] SSE endpoint with `AuthGuard` + ownership check → Task 3
- [x] SSE auto-close on expiry (`takeUntil(timer(...))`) → Task 3
- [x] SSE complete after 1 event (`Subject.complete()` in `emit()`) → Task 1
- [x] HMAC check optional (skip if env var absent) → Task 2 Step 4
- [x] emit **after** DB UPDATE succeeds, never before → Task 2 Step 4
- [x] JWT in `Authorization` header, never query param → Task 4 Step 1
- [x] `simulateTopup` unchanged → not in plan (correct)
- [x] `main.ts` unchanged — rawBody already wired → noted in Task 2 Step 5

### Type consistency
- `WalletEventsService.stream$(paymentId: string)` defined Task 1, used Task 3 ✓
- `WalletEventsService.emit(paymentId: string, { balance: number })` Task 1, used Task 2 ✓
- `WalletService.getTopupExpiry(paymentId, uid)` → `{ expiresAt: string; status: string }` defined Task 2, consumed Task 3 ✓
- SSE wire `{"event":"payment.paid","balance":N}` — emitted Task 3, parsed Task 4 ✓
- `subscribeTopupStream` returns `() => void` — called as `cleanup = subscribeTopupStream(...)`, `cleanup?.()` ✓

### Placeholder scan — none found
