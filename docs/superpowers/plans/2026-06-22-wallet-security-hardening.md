# Wallet Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close 9 audited vulnerabilities in the MangaDock coin-wallet / topup / unlock system so coins can only be created by a verified PromptPay payment and only spent atomically.

**Architecture:** NestJS 11 backend. Money mutations go through `SECURITY DEFINER` Postgres RPCs (`add_coins_atomic`, `spend_coins_atomic`, new `purchase_unlock_atomic`). Topups are created via Xendit PromptPay QR and credited by an inbound Xendit webhook. The fix turns the webhook from "trust the payload" into "authenticate (static token + mandatory HMAC) → claim atomically → **actively re-verify with Xendit's API** → reconcile amount → credit", gates all dev/test mint endpoints behind a positive opt-in flag, bounds amounts, adds ledger-level idempotency, makes unlock purchase one atomic transaction, and rate-limits topup creation.

**Tech Stack:** NestJS 11, TypeScript, Jest, Supabase (Postgres 17, service-role client), Xendit Payments API (`api-version: 2024-11-11`), ioredis (`RedisService`, global).

## Global Constraints

- **Backend dir:** `Backend/`. Run all test/build commands from `Backend/`.
- **Single test file:** `npx jest <relative/path.spec.ts> --no-coverage`.
- **Money invariant:** 1 coin = 1 THB. A topup of N coins charges N THB; the webhook must credit exactly the verified settled amount.
- **Amount bounds:** `MIN_TOPUP_COINS = 20` (existing DB CHECK `coin_topups_amount_coins_check`), `MAX_TOPUP_COINS = 100000`. `balance` column is Postgres `INTEGER` (max 2,147,483,647) — never let a single mutation exceed `MAX_TOPUP_COINS`.
- **Revenue split:** platform 30 % `floor(price * 0.30)`, creator `price - platformShare`.
- **Dev/test mint endpoints** (`POST /wallet/topup`, `POST /wallet/topup/:id/simulate`): gated by `XENDIT_ALLOW_SIMULATE === 'true'` (fail-closed; default = blocked).
- **Webhook fail-closed:** in `NODE_ENV === 'production'` BOTH `XENDIT_WEBHOOK_TOKEN` and `XENDIT_WEBHOOK_SECRET` must be set, or the app refuses to boot (mirrors `resolveTurnstileConfig`).
- **SQL changes** are applied to the live DB via Supabase MCP `apply_migration` against project `eqgcnoljbiwosecydjqd` (name `mangadock`). `Backend/supabase-migration.sql` is **reference-only** (it does not auto-apply) but MUST be updated to match.
- **DB-migration safety:** every SQL task lists Risk / Backup / Rollback / Verify. Run the dup/pre-check query before any `CREATE UNIQUE INDEX`. Take a Supabase snapshot/backup before applying.
- TDD red-green-refactor. Commit after each task. Surgical changes only; match surrounding style.
- **Do not break existing tests.** Where a behavior change requires it, update the named tests exactly as specified.

---

## Vulnerability → Task map

| Vuln | Severity | Task(s) |
|------|----------|---------|
| V1 forged/unverified webhook → free coins | CRITICAL | 1 (boot guard), 2 (mandatory HMAC), 3 (active verify) |
| V2 no paid-amount validation | HIGH | 3 |
| V3 `simulateTopup` gated only by NODE_ENV | HIGH | 4 |
| V4 dev `POST /wallet/topup` unvalidated + no max | HIGH/MED | 4, 5 |
| V5 no ledger idempotency key + dead `numeric` overloads | MED | 6 |
| V6 revenue split not atomic | MED | 7 |
| V7 unlock allows non-published + insert-before-charge ordering | LOW/MED | 7, 8 |
| V8 non-constant-time webhook token compare | LOW | 2 |
| V9 no rate-limit on `topup/create` | LOW | 9 |

---

## File Structure

**New files**
- `Backend/src/wallet/xendit-webhook.config.ts` — pure, dependency-light webhook config resolver + `safeTokenEqual` constant-time helper (testable in isolation, mirrors `auth/turnstile.config.ts`).
- `Backend/src/wallet/xendit-webhook.config.spec.ts` — fail-closed matrix + token-compare tests.
- `Backend/src/wallet/topup-throttle.guard.ts` — per-uid Redis rate limiter for `POST /wallet/topup/create`.
- `Backend/src/wallet/topup-throttle.guard.spec.ts`.

**Modified files**
- `Backend/src/wallet/xendit.service.ts` — add `getPaymentRequest()`.
- `Backend/src/wallet/wallet.service.ts` — webhook auth + active verify + amount guards.
- `Backend/src/wallet/wallet.service.spec.ts` — updated/added webhook tests.
- `Backend/src/wallet/wallet.controller.ts` — dev-topup flag + DTO validation + throttle guard.
- `Backend/src/wallet/wallet.controller.spec.ts` — updated.
- `Backend/src/wallet/dto/create-topup.dto.ts` — add `@Max`.
- `Backend/src/wallet/wallet.module.ts` — register `TopupThrottleGuard`.
- `Backend/src/unlock/unlock.service.ts` — route purchase through `purchase_unlock_atomic`, add status guard.
- `Backend/src/unlock/unlock.service.spec.ts` — rewritten for RPC.
- `Backend/src/main.ts` — boot-time `resolveXenditWebhookConfig`.
- `Backend/.env.example` — document `XENDIT_WEBHOOK_SECRET`, `XENDIT_ALLOW_SIMULATE`.
- `Backend/supabase-migration.sql` — reference copy of new index + functions.

**Live DB (via Supabase MCP `apply_migration`)**
- Drop dead `numeric` overloads of `add_coins_atomic` / `spend_coins_atomic`.
- Add topup-scoped partial UNIQUE index on `wallet_transactions(reference_id)`.
- Create `purchase_unlock_atomic(...)`.

---

## Task 1 — Webhook config resolver + boot fail-closed (V1 infra)

**Files:**
- Create: `Backend/src/wallet/xendit-webhook.config.ts`
- Create: `Backend/src/wallet/xendit-webhook.config.spec.ts`
- Modify: `Backend/src/main.ts:59` (after the turnstile resolve)

**Interfaces:**
- Produces: `resolveXenditWebhookConfig(env?, logger?) => { token: string; secret: string | undefined; requireHmac: boolean }` (throws in production when token or secret is missing); `safeTokenEqual(a?: string, b?: string) => boolean` (constant-time).

- [ ] **Step 1: Write the failing test**

Create `Backend/src/wallet/xendit-webhook.config.spec.ts`:

```ts
import { resolveXenditWebhookConfig, safeTokenEqual } from './xendit-webhook.config';

describe('resolveXenditWebhookConfig', () => {
  const base = (over: Record<string, string | undefined>) =>
    ({ NODE_ENV: 'test', ...over }) as NodeJS.ProcessEnv;

  it('production: throws when XENDIT_WEBHOOK_TOKEN missing', () => {
    expect(() =>
      resolveXenditWebhookConfig(base({ NODE_ENV: 'production', XENDIT_WEBHOOK_SECRET: 's' })),
    ).toThrow(/XENDIT_WEBHOOK_TOKEN/);
  });

  it('production: throws when XENDIT_WEBHOOK_SECRET missing', () => {
    expect(() =>
      resolveXenditWebhookConfig(base({ NODE_ENV: 'production', XENDIT_WEBHOOK_TOKEN: 't' })),
    ).toThrow(/XENDIT_WEBHOOK_SECRET/);
  });

  it('production: requireHmac=true when both set', () => {
    const cfg = resolveXenditWebhookConfig(
      base({ NODE_ENV: 'production', XENDIT_WEBHOOK_TOKEN: 't', XENDIT_WEBHOOK_SECRET: 's' }),
    );
    expect(cfg).toEqual({ token: 't', secret: 's', requireHmac: true });
  });

  it('non-production: requireHmac follows secret presence', () => {
    expect(resolveXenditWebhookConfig(base({ XENDIT_WEBHOOK_TOKEN: 't' })).requireHmac).toBe(false);
    expect(
      resolveXenditWebhookConfig(base({ XENDIT_WEBHOOK_TOKEN: 't', XENDIT_WEBHOOK_SECRET: 's' })).requireHmac,
    ).toBe(true);
  });

  it('non-production: missing token resolves to empty string (dev allowed)', () => {
    expect(resolveXenditWebhookConfig(base({})).token).toBe('');
  });
});

describe('safeTokenEqual', () => {
  it('true for identical non-empty strings', () => {
    expect(safeTokenEqual('abc123', 'abc123')).toBe(true);
  });
  it('false for different strings (incl. different lengths)', () => {
    expect(safeTokenEqual('abc', 'abcd')).toBe(false);
    expect(safeTokenEqual('abc', 'xyz')).toBe(false);
  });
  it('false when either side is empty/undefined', () => {
    expect(safeTokenEqual(undefined, 'x')).toBe(false);
    expect(safeTokenEqual('x', undefined)).toBe(false);
    expect(safeTokenEqual('', '')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/wallet/xendit-webhook.config.spec.ts --no-coverage`
Expected: FAIL — `Cannot find module './xendit-webhook.config'`.

- [ ] **Step 3: Write minimal implementation**

Create `Backend/src/wallet/xendit-webhook.config.ts`:

```ts
import { createHash, timingSafeEqual } from 'crypto';

export interface XenditWebhookConfig {
  /** Static `x-callback-token` expected on every webhook. */
  token: string;
  /** HMAC-SHA256 secret; undefined only outside production. */
  secret: string | undefined;
  /** Whether the HMAC signature check is enforced. */
  requireHmac: boolean;
}

/**
 * Resolve Xendit webhook auth config from the environment — pure and
 * dependency-light so the fail-closed matrix is unit-testable in isolation
 * (mirrors {@link resolveTurnstileConfig}).
 *
 * Fail-closed in production: a missing static token or HMAC secret throws so a
 * misconfigured deploy crashes loudly at boot instead of silently accepting
 * forged `payment.succeeded` webhooks that mint coins for free.
 */
export function resolveXenditWebhookConfig(
  env: NodeJS.ProcessEnv = process.env,
  logger?: { error: (message: string) => void },
): XenditWebhookConfig {
  const isProd = env.NODE_ENV === 'production';
  const token = env.XENDIT_WEBHOOK_TOKEN?.trim();
  const secret = env.XENDIT_WEBHOOK_SECRET?.trim();

  if (isProd) {
    if (!token) {
      throw new Error(
        'XENDIT_WEBHOOK_TOKEN must be set in production. Refusing to start without webhook authentication.',
      );
    }
    if (!secret) {
      throw new Error(
        'XENDIT_WEBHOOK_SECRET must be set in production. Refusing to start without HMAC verification.',
      );
    }
    return { token, secret, requireHmac: true };
  }

  if (!token) {
    logger?.error('XENDIT_WEBHOOK_TOKEN is not set — webhook auth is disabled (non-production only).');
  }
  return { token: token ?? '', secret, requireHmac: !!secret };
}

/**
 * Constant-time string comparison. Hashes both inputs to a fixed 32-byte
 * digest first so `timingSafeEqual` never throws on length mismatch and the
 * length itself is not leaked via timing.
 */
export function safeTokenEqual(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/wallet/xendit-webhook.config.spec.ts --no-coverage`
Expected: PASS (all cases).

- [ ] **Step 5: Wire the boot guard into `main.ts`**

In `Backend/src/main.ts`, add the import near the other config import (line 10):

```ts
import { resolveXenditWebhookConfig } from './wallet/xendit-webhook.config';
```

Then immediately after the existing turnstile resolve (`main.ts:59`), add:

```ts
  // Fail-closed: refuse to boot in production without webhook token + HMAC
  // secret, so forged Xendit webhooks cannot mint coins (V1).
  resolveXenditWebhookConfig(process.env, new Logger('XenditWebhook'));
```

(`Logger` is already imported in `main.ts:3`.)

- [ ] **Step 6: Verify build + full webhook-config test**

Run: `npx jest src/wallet/xendit-webhook.config.spec.ts --no-coverage && npx tsc --noEmit -p tsconfig.json`
Expected: tests PASS, no TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add Backend/src/wallet/xendit-webhook.config.ts Backend/src/wallet/xendit-webhook.config.spec.ts Backend/src/main.ts
git commit -m "feat(wallet): fail-closed Xendit webhook config + constant-time token compare (V1/V8)"
```

---

## Task 2 — Constant-time token + mandatory HMAC in webhook (V8 + V1)

**Files:**
- Modify: `Backend/src/wallet/wallet.service.ts:291-322` (auth section of `processXenditWebhook`)
- Modify: `Backend/src/wallet/wallet.service.spec.ts` (add prod-HMAC tests)

**Interfaces:**
- Consumes: `safeTokenEqual` from Task 1.
- Produces: unchanged signature `processXenditWebhook(payload, token, rawBody?, signature?) => Promise<{ received: boolean }>`.

- [ ] **Step 1: Write the failing test**

In `Backend/src/wallet/wallet.service.spec.ts`, inside the existing `describe('processXenditWebhook — SSE emit + HMAC', ...)` block (after the `throws UnauthorizedException on invalid HMAC...` test, ~line 484), add:

```ts
    it('production: throws UnauthorizedException when secret is not configured', async () => {
      const ORIGINAL = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      delete process.env.XENDIT_WEBHOOK_SECRET;
      try {
        await expect(
          service.processXenditWebhook(
            { event: 'payment.succeeded', data: { payment_request_id: 'pr-prod', status: 'SUCCEEDED' } },
            WEBHOOK_TOKEN,
            Buffer.from('body'),
            'deadbeef',
          ),
        ).rejects.toThrow(UnauthorizedException);
      } finally {
        process.env.NODE_ENV = ORIGINAL;
      }
    });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/wallet/wallet.service.spec.ts -t "secret is not configured" --no-coverage`
Expected: FAIL — currently the missing secret causes the HMAC block to be skipped, so it does not throw.

- [ ] **Step 3: Write minimal implementation**

In `Backend/src/wallet/wallet.service.ts`, add the import (top of file, next to the crypto import on line 13):

```ts
import { resolveXenditWebhookConfig, safeTokenEqual } from './xendit-webhook.config';
```

Replace the auth block (`wallet.service.ts:297-322`) — i.e. the `// 1. Static token check` through the end of the HMAC `if (webhookSecret) { ... }` — with:

```ts
    // 1. Static token check (constant-time — V8)
    const expected = process.env.XENDIT_WEBHOOK_TOKEN;
    if (!safeTokenEqual(token, expected)) {
      throw new UnauthorizedException('Invalid webhook token');
    }

    // 2. HMAC-SHA256 check — MANDATORY in production (V1). Outside production it
    //    is enforced only when XENDIT_WEBHOOK_SECRET is configured.
    const webhookSecret = process.env.XENDIT_WEBHOOK_SECRET;
    const requireHmac = process.env.NODE_ENV === 'production';
    if (requireHmac && !webhookSecret) {
      throw new UnauthorizedException('Webhook secret not configured');
    }
    if (webhookSecret) {
      if (!rawBody || !signature) {
        throw new UnauthorizedException('Missing webhook signature');
      }
      if (!/^[0-9a-f]+$/i.test(signature)) {
        throw new UnauthorizedException('Invalid webhook signature');
      }
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
```

> Note: `resolveXenditWebhookConfig` is imported for the boot guard (Task 1) and is intentionally **not** called per-request here — the per-request checks above are the runtime enforcement; the boot guard guarantees prod is configured. Keep the import for `safeTokenEqual`. (If `resolveXenditWebhookConfig` is unused in this file after edits, drop it from the import to satisfy lint — keep only `safeTokenEqual`.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/wallet/wallet.service.spec.ts --no-coverage`
Expected: PASS — the new prod test passes; all existing webhook tests (wrong token, unset token, skip-HMAC-when-no-secret, invalid HMAC, missing rawBody) stay green because `safeTokenEqual` returns the same boolean as `!==` did.

- [ ] **Step 5: Commit**

```bash
git add Backend/src/wallet/wallet.service.ts Backend/src/wallet/wallet.service.spec.ts
git commit -m "feat(wallet): constant-time webhook token + mandatory HMAC in prod (V8/V1)"
```

---

## Task 3 — Active Xendit verification + amount reconciliation (V1 + V2)

**Files:**
- Modify: `Backend/src/wallet/xendit.service.ts` (add `getPaymentRequest`)
- Modify: `Backend/src/wallet/wallet.service.ts:341-372` (success path of `processXenditWebhook`)
- Modify: `Backend/src/wallet/wallet.service.spec.ts` (mock `getPaymentRequest` + new mismatch tests)

**Interfaces:**
- Produces: `XenditService.getPaymentRequest(paymentRequestId: string) => Promise<{ status: string; amount: number; currency: string }>`.
- Consumes (in `wallet.service`): `this.xenditService.getPaymentRequest(paymentId)`.

- [ ] **Step 1: Write the failing test for `getPaymentRequest`**

In `Backend/src/wallet/xendit.service.ts` there is no spec yet; create `Backend/src/wallet/xendit.service.spec.ts`:

```ts
import { XenditService } from './xendit.service';
import { InternalServerErrorException } from '@nestjs/common';

describe('XenditService.getPaymentRequest', () => {
  let service: XenditService;
  const realFetch = global.fetch;

  beforeEach(() => {
    service = new XenditService();
    process.env.XENDIT_SECRET_KEY = 'xnd_test_key';
  });
  afterEach(() => {
    global.fetch = realFetch;
  });

  it('returns status, amount and currency on 200', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'pr-1', status: 'SUCCEEDED', amount: 100, currency: 'THB' }),
    }) as any;

    const res = await service.getPaymentRequest('pr-1');
    expect(res).toEqual({ status: 'SUCCEEDED', amount: 100, currency: 'THB' });
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain('/payment_requests/pr-1');
  });

  it('throws InternalServerErrorException on non-ok response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => 'not found',
    }) as any;

    await expect(service.getPaymentRequest('pr-x')).rejects.toThrow(InternalServerErrorException);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/wallet/xendit.service.spec.ts --no-coverage`
Expected: FAIL — `service.getPaymentRequest is not a function`.

- [ ] **Step 3: Implement `getPaymentRequest`**

In `Backend/src/wallet/xendit.service.ts`, add this method to the `XenditService` class (after `createPromptPayCharge`, before `simulatePayment`):

```ts
  /**
   * Fetch the authoritative state of a payment request directly from Xendit.
   * Used to verify an inbound webhook before crediting coins (V1/V2) — the
   * webhook payload alone is never trusted.
   */
  async getPaymentRequest(
    paymentRequestId: string,
  ): Promise<{ status: string; amount: number; currency: string }> {
    const res = await fetch(
      `https://api.xendit.co/payment_requests/${encodeURIComponent(paymentRequestId)}`,
      {
        method: 'GET',
        headers: {
          Authorization: this.authHeader,
          'api-version': '2024-11-11',
        },
      },
    );

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.error(`Xendit get payment_request error ${res.status}: ${text}`);
      throw new InternalServerErrorException('Failed to verify payment');
    }

    const data = (await res.json()) as Record<string, any>;
    return {
      status: data.status as string,
      amount: Number(data.amount),
      currency: data.currency as string,
    };
  }
```

- [ ] **Step 4: Run the `getPaymentRequest` test to verify it passes**

Run: `npx jest src/wallet/xendit.service.spec.ts --no-coverage`
Expected: PASS.

- [ ] **Step 5: Write the failing webhook-verification tests**

In `Backend/src/wallet/wallet.service.spec.ts`:

5a. Add `getPaymentRequest` to the Xendit mock. Change line 38 from:

```ts
    mockXendit = { createPromptPayCharge: jest.fn(), simulatePayment: jest.fn() };
```
to:
```ts
    mockXendit = {
      createPromptPayCharge: jest.fn(),
      simulatePayment: jest.fn(),
      getPaymentRequest: jest.fn(),
    };
```
and update the type annotation on line 9:
```ts
  let mockXendit: { createPromptPayCharge: jest.Mock; simulatePayment: jest.Mock; getPaymentRequest: jest.Mock };
```

5b. Every existing test that reaches the credit path must now stub a matching verification. Add the indicated line to each:

- In `should credit coins on first succeeded webhook using data.payment_request_id` (claims `amount_coins: 100`), before the call to `service.processXenditWebhook`:
  ```ts
  mockXendit.getPaymentRequest.mockResolvedValue({ status: 'SUCCEEDED', amount: 100, currency: 'THB' });
  ```
- In `should throw and propagate error when addCoins RPC fails after atomic claim` (claims `amount_coins: 100`), add the same line:
  ```ts
  mockXendit.getPaymentRequest.mockResolvedValue({ status: 'SUCCEEDED', amount: 100, currency: 'THB' });
  ```
- In `emits SSE event with balance after successful payment` (claims `amount_coins: 100`):
  ```ts
  mockXendit.getPaymentRequest.mockResolvedValue({ status: 'SUCCEEDED', amount: 100, currency: 'THB' });
  ```
- In `skips HMAC check when XENDIT_WEBHOOK_SECRET is not set` (claims `amount_coins: 50`):
  ```ts
  mockXendit.getPaymentRequest.mockResolvedValue({ status: 'SUCCEEDED', amount: 50, currency: 'THB' });
  ```

5c. Add two new tests at the end of the `describe('processXenditWebhook — SSE emit + HMAC', ...)` block:

```ts
    it('SECURITY: reverts claim and refuses credit when Xendit amount mismatches', async () => {
      mockUpdateChain.maybeSingle.mockResolvedValue({
        data: { uid: 'u1', amount_coins: 100, status: 'paid' },
        error: null,
      });
      // Xendit says only 10 was actually paid → must NOT credit 100
      mockXendit.getPaymentRequest.mockResolvedValue({ status: 'SUCCEEDED', amount: 10, currency: 'THB' });

      await expect(
        service.processXenditWebhook(
          { event: 'payment.succeeded', data: { payment_request_id: 'pr-mm', status: 'SUCCEEDED' } },
          WEBHOOK_TOKEN,
        ),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockRpc).not.toHaveBeenCalled();          // no addCoins
      expect(mockWalletEvents.emit).not.toHaveBeenCalled();
      // claim reverted back to pending
      expect(mockChain.update).toHaveBeenCalledWith({ status: 'pending' });
    });

    it('SECURITY: reverts claim and refuses credit when Xendit status is not SUCCEEDED', async () => {
      mockUpdateChain.maybeSingle.mockResolvedValue({
        data: { uid: 'u1', amount_coins: 100, status: 'paid' },
        error: null,
      });
      mockXendit.getPaymentRequest.mockResolvedValue({ status: 'PENDING', amount: 100, currency: 'THB' });

      await expect(
        service.processXenditWebhook(
          { event: 'payment.succeeded', data: { payment_request_id: 'pr-ns', status: 'SUCCEEDED' } },
          WEBHOOK_TOKEN,
        ),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockRpc).not.toHaveBeenCalled();
      expect(mockChain.update).toHaveBeenCalledWith({ status: 'pending' });
    });
```

- [ ] **Step 6: Run to verify the new tests fail**

Run: `npx jest src/wallet/wallet.service.spec.ts -t "SECURITY" --no-coverage`
Expected: FAIL — the current code credits without verifying, so it neither throws nor reverts.

- [ ] **Step 7: Implement active verification in the success path**

In `Backend/src/wallet/wallet.service.ts`, replace the block from the atomic-claim success (`wallet.service.ts:360`, the `const { balance } = await this.addCoins(...)` call) — i.e. everything after the `if (!claimed) { ... return { received: true }; }` guard — with:

```ts
    // Active verification (V1/V2): the webhook payload is untrusted. Re-fetch the
    // authoritative payment state from Xendit and reconcile the settled amount
    // before crediting. On any mismatch or fetch failure, revert the claim back
    // to 'pending' so a genuine later webhook can retry, and refuse to credit.
    let verified: { status: string; amount: number; currency: string };
    try {
      verified = await this.xenditService.getPaymentRequest(paymentId);
    } catch (err) {
      await this.db
        .from('coin_topups')
        .update({ status: 'pending' })
        .eq('payment_id', paymentId)
        .eq('status', 'paid');
      this.logger.error(`Webhook verify failed (Xendit unreachable) for ${paymentId}: ${String(err)}`);
      throw new InternalServerErrorException('Payment verification failed');
    }

    if (verified.status !== 'SUCCEEDED' || Number(verified.amount) !== claimed.amount_coins) {
      await this.db
        .from('coin_topups')
        .update({ status: 'pending' })
        .eq('payment_id', paymentId)
        .eq('status', 'paid');
      this.logger.error(
        `SECURITY: webhook verification mismatch for ${paymentId} — ` +
          `xenditStatus=${verified.status} xenditAmount=${verified.amount} expected=${claimed.amount_coins}`,
      );
      throw new UnauthorizedException('Payment verification failed');
    }

    const { balance } = await this.addCoins(
      claimed.uid,
      claimed.amount_coins,
      'topup',
      'เติมเหรียญ MangaDock',
      paymentId,
    );

    // Emit SSE after addCoins succeeds — security ordering invariant
    this.walletEvents.emit(paymentId, { balance });

    return { received: true };
```

- [ ] **Step 8: Run the full wallet service suite**

Run: `npx jest src/wallet/wallet.service.spec.ts --no-coverage`
Expected: PASS — including the two new SECURITY tests and all updated success tests.

- [ ] **Step 9: Commit**

```bash
git add Backend/src/wallet/xendit.service.ts Backend/src/wallet/xendit.service.spec.ts Backend/src/wallet/wallet.service.ts Backend/src/wallet/wallet.service.spec.ts
git commit -m "feat(wallet): verify topup with Xendit API + reconcile amount before credit (V1/V2)"
```

---

## Task 4 — Gate dev/test mint endpoints behind a positive flag (V3 + V4)

**Files:**
- Modify: `Backend/src/wallet/wallet.service.ts:267-289` (`simulateTopup` gate)
- Modify: `Backend/src/wallet/wallet.controller.ts:37-48` (`POST /wallet/topup` gate + DTO)
- Modify: `Backend/src/wallet/wallet.service.spec.ts` (simulate test)
- Modify: `Backend/src/wallet/wallet.controller.spec.ts` (dev topup test)

**Interfaces:**
- Behavior: both dev/test endpoints throw `ForbiddenException` unless `process.env.XENDIT_ALLOW_SIMULATE === 'true'`.

- [ ] **Step 1: Write the failing test (simulate)**

In `Backend/src/wallet/wallet.service.spec.ts`, in `describe('simulateTopup', ...)`, replace the `ORIGINAL_NODE_ENV` setup (lines 261-265) and the production test (lines 276-280) with a flag-based version:

```ts
    const ORIGINAL_FLAG = process.env.XENDIT_ALLOW_SIMULATE;

    beforeEach(() => {
      process.env.XENDIT_ALLOW_SIMULATE = 'true';
    });
    afterEach(() => {
      if (ORIGINAL_FLAG === undefined) delete process.env.XENDIT_ALLOW_SIMULATE;
      else process.env.XENDIT_ALLOW_SIMULATE = ORIGINAL_FLAG;
    });
```

and the blocked test:

```ts
    it('should throw ForbiddenException when XENDIT_ALLOW_SIMULATE is not "true"', async () => {
      delete process.env.XENDIT_ALLOW_SIMULATE;
      await expect(service.simulateTopup('pay_1', 'u1')).rejects.toThrow(ForbiddenException);
      expect(mockXendit.simulatePayment).not.toHaveBeenCalled();
    });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest src/wallet/wallet.service.spec.ts -t "simulateTopup" --no-coverage`
Expected: FAIL — current gate keys off `NODE_ENV`, not the flag.

- [ ] **Step 3: Implement the simulate gate**

In `Backend/src/wallet/wallet.service.ts`, replace lines 271-273:

```ts
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('Simulate is not available in production');
    }
```
with:
```ts
    if (process.env.XENDIT_ALLOW_SIMULATE !== 'true') {
      throw new ForbiddenException('Simulate is not available');
    }
```

- [ ] **Step 4: Run to verify simulate passes**

Run: `npx jest src/wallet/wallet.service.spec.ts -t "simulateTopup" --no-coverage`
Expected: PASS.

- [ ] **Step 5: Write the failing test (dev topup controller)**

Open `Backend/src/wallet/wallet.controller.spec.ts` and locate the `topup` describe block. Replace its production-gate test with (and set the flag in its `beforeEach`/`afterEach` as above):

```ts
    it('throws ForbiddenException when XENDIT_ALLOW_SIMULATE is not "true"', async () => {
      delete process.env.XENDIT_ALLOW_SIMULATE;
      await expect(
        controller.topup({ [USER_KEY]: { uid: 'u1' } } as any, { amount: 50 }),
      ).rejects.toThrow(ForbiddenException);
    });
```

(If `wallet.controller.spec.ts` has no `topup` block yet, add a `describe('topup (dev)', ...)` with the above plus a happy-path test that sets `process.env.XENDIT_ALLOW_SIMULATE='true'` and asserts `wallet.addCoins` is called. Mock `WalletService.addCoins`.)

- [ ] **Step 6: Run to verify it fails**

Run: `npx jest src/wallet/wallet.controller.spec.ts -t "topup" --no-coverage`
Expected: FAIL — current gate keys off `NODE_ENV`.

- [ ] **Step 7: Implement the dev-topup gate + DTO validation**

In `Backend/src/wallet/wallet.controller.ts`, replace the `topup` handler (lines 37-48) with:

```ts
  // DEV/TEST ONLY — direct credit without payment. Fail-closed: blocked unless
  // XENDIT_ALLOW_SIMULATE=true (never set in production).
  @Post('topup')
  @UseGuards(AuthGuard)
  async topup(
    @Req() req: Request & { [USER_KEY]: SupabaseAuthUser },
    @Body(new ValidationPipe({ whitelist: true })) body: CreateTopupDto,
  ) {
    if (process.env.XENDIT_ALLOW_SIMULATE !== 'true') {
      throw new ForbiddenException('Direct topup is not available. Please use the payment gateway.');
    }
    return this.wallet.addCoins(req[USER_KEY].uid, body.amount, 'topup', 'เติมเหรียญ (ทดสอบ)');
  }
```

(`ForbiddenException`, `ValidationPipe`, `CreateTopupDto` are already imported in the controller.)

- [ ] **Step 8: Run to verify it passes + full controller suite**

Run: `npx jest src/wallet/wallet.controller.spec.ts --no-coverage`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add Backend/src/wallet/wallet.service.ts Backend/src/wallet/wallet.controller.ts Backend/src/wallet/wallet.service.spec.ts Backend/src/wallet/wallet.controller.spec.ts
git commit -m "feat(wallet): gate dev mint endpoints behind XENDIT_ALLOW_SIMULATE flag (V3/V4)"
```

---

## Task 5 — Bound topup amount (DTO max + service guards) (V4)

**Files:**
- Modify: `Backend/src/wallet/dto/create-topup.dto.ts`
- Modify: `Backend/src/wallet/wallet.service.ts:56-110` (`addCoins`/`spendCoins` guards)
- Modify: `Backend/src/wallet/wallet.service.spec.ts`

**Interfaces:**
- Constant: `MAX_TOPUP_COINS = 100000`.

- [ ] **Step 1: Write the failing test**

In `Backend/src/wallet/wallet.service.spec.ts`, add to `describe('addCoins', ...)`:

```ts
    it('should throw BadRequestException when amount exceeds MAX_TOPUP_COINS', async () => {
      await expect(service.addCoins('u1', 100001, 'topup')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when amount is not an integer', async () => {
      await expect(service.addCoins('u1', 10.5, 'topup')).rejects.toThrow(BadRequestException);
    });
```

and the same two cases to `describe('spendCoins', ...)` (swap `addCoins`→`spendCoins`, type `'buy'`).

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest src/wallet/wallet.service.spec.ts -t "exceeds MAX_TOPUP_COINS" --no-coverage`
Expected: FAIL — no upper bound / integer check today.

- [ ] **Step 3: Implement the guards**

In `Backend/src/wallet/wallet.service.ts`, add a module-level constant after the imports (above the `@Injectable()` class):

```ts
/** Hard upper bound per single coin mutation — bounds INTEGER-column overflow and abuse. */
export const MAX_TOPUP_COINS = 100000;
```

Replace the guard at the top of `addCoins` (lines 63-65):

```ts
    if (!amount || amount <= 0) {
      throw new BadRequestException('Amount must be greater than 0');
    }
```
with:
```ts
    if (!Number.isInteger(amount) || amount <= 0 || amount > MAX_TOPUP_COINS) {
      throw new BadRequestException(`Amount must be an integer between 1 and ${MAX_TOPUP_COINS}`);
    }
```

Apply the identical replacement to the guard at the top of `spendCoins` (lines 88-90).

- [ ] **Step 4: Add the DTO max**

In `Backend/src/wallet/dto/create-topup.dto.ts`, replace the whole file with:

```ts
import { IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { MAX_TOPUP_COINS } from '../wallet.service';

export class CreateTopupDto {
  @Type(() => Number)
  @IsInt()
  @Min(20)
  @Max(MAX_TOPUP_COINS)
  amount: number;
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx jest src/wallet/wallet.service.spec.ts --no-coverage && npx tsc --noEmit -p tsconfig.json`
Expected: tests PASS, no TS errors (watch for an import cycle warning — `dto` importing from `wallet.service` is one-directional and fine, but if the linter flags it, inline the literal `100000` in the DTO with a clarifying comment instead).

- [ ] **Step 6: Commit**

```bash
git add Backend/src/wallet/wallet.service.ts Backend/src/wallet/dto/create-topup.dto.ts Backend/src/wallet/wallet.service.spec.ts
git commit -m "feat(wallet): bound coin mutations to [1, 100000] integer (V4)"
```

---

## Task 6 — Ledger idempotency index + drop dead overloads (V5)

> **DB MIGRATION — risk & safety**
> - **Risk:** creating a UNIQUE index fails if duplicate `reference_id` topup rows already exist; dropping a function fails/regresses if something still calls that overload.
> - **Backup:** take a Supabase point-in-time/snapshot backup of project `eqgcnoljbiwosecydjqd` before applying (Dashboard → Database → Backups).
> - **Pre-check:** run the duplicate-detection query (Step 1) and confirm 0 rows before creating the index.
> - **Rollback:** `DROP INDEX IF EXISTS wallet_tx_topup_ref_uidx;` and re-create the dropped functions from `Backend/supabase-migration.sql`.
> - **Verify:** re-list indexes + functions (Step 5).

**Files:**
- Live DB via Supabase MCP `apply_migration` (project `eqgcnoljbiwosecydjqd`).
- Modify (reference-only): `Backend/supabase-migration.sql`.

- [ ] **Step 1: Pre-check for duplicate topup reference_ids**

Run via Supabase MCP `execute_sql` (project `eqgcnoljbiwosecydjqd`):

```sql
SELECT reference_id, count(*)
FROM wallet_transactions
WHERE type = 'topup' AND reference_id IS NOT NULL
GROUP BY reference_id
HAVING count(*) > 1;
```
Expected: **0 rows.** If any rows appear, STOP — investigate/deduplicate the historical double-credits before continuing (each duplicate is a real over-credit; do not silently drop).

- [ ] **Step 2: Confirm the dead overloads are not referenced**

The TypeScript always calls `add_coins_atomic` / `spend_coins_atomic` with `p_reference_id` (5 args, integer), resolving to the integer overloads. The `numeric` overloads (`add_coins_atomic(uuid,numeric,text,text)`, `spend_coins_atomic(uuid,numeric,text,text)`) are unreachable and broken (they `INSERT` into `wallet_transactions` without the NOT-NULL `balance_after`). Confirm no other caller passes numeric/4-arg:

Run `Grep` over the repo: pattern `add_coins_atomic|spend_coins_atomic`, glob `Backend/src/**/*.ts`.
Expected: only `wallet.service.ts` (5-arg integer calls) + spec files. If a 4-arg or numeric call exists, do not drop that overload.

- [ ] **Step 3: Apply the migration**

Run via Supabase MCP `apply_migration` (project `eqgcnoljbiwosecydjqd`, name `wallet_idempotency_and_cleanup`):

```sql
-- 1) Ledger idempotency for topup credits: a given Xendit payment_id can be
--    credited as a topup at most once (defense-in-depth behind the status-claim).
CREATE UNIQUE INDEX IF NOT EXISTS wallet_tx_topup_ref_uidx
  ON wallet_transactions (reference_id)
  WHERE type = 'topup' AND reference_id IS NOT NULL;

-- 2) Drop the dead, broken numeric overloads (omit NOT-NULL balance_after).
DROP FUNCTION IF EXISTS add_coins_atomic(uuid, numeric, text, text);
DROP FUNCTION IF EXISTS spend_coins_atomic(uuid, numeric, text, text);
```

- [ ] **Step 4: Update the reference SQL file**

In `Backend/supabase-migration.sql`, in the "ATOMIC RPC FUNCTIONS" section (around line 326), add a comment block documenting the topup-scoped unique index and noting the numeric overloads were dropped, and add the `CREATE UNIQUE INDEX ... wallet_tx_topup_ref_uidx ...` statement near the other index definitions (around line 228). (Reference-only; keep it consistent with live.)

- [ ] **Step 5: Verify**

Run via Supabase MCP `execute_sql`:

```sql
SELECT indexname FROM pg_indexes
WHERE schemaname='public' AND indexname='wallet_tx_topup_ref_uidx';

SELECT proname, pg_get_function_identity_arguments(oid) AS args
FROM pg_proc
WHERE proname IN ('add_coins_atomic','spend_coins_atomic')
ORDER BY proname, args;
```
Expected: the index exists; `add_coins_atomic` has only the `(uuid,integer,text,text)` and `(uuid,integer,text,text,text)` overloads (no `numeric`); `spend_coins_atomic` has only `(uuid,integer,text,text,text)`.

- [ ] **Step 6: Regression-run wallet suite + commit reference file**

Run: `npx jest src/wallet --no-coverage`
Expected: PASS (no code change; the integer RPC overloads still resolve).

```bash
git add Backend/supabase-migration.sql
git commit -m "feat(db): topup-scoped reference_id idempotency index + drop dead numeric RPC overloads (V5)"
```

---

## Task 7 — Atomic unlock purchase RPC (V6 + V7 ordering)

> **DB MIGRATION — risk & safety**
> - **Risk:** the new `purchase_unlock_atomic` performs the unlock-insert + buyer-debit + creator-credit in one transaction; a logic error could over/under-charge. It is additive (`CREATE OR REPLACE`), so creation itself is safe.
> - **Backup:** Supabase snapshot before applying (as Task 6).
> - **Rollback:** `DROP FUNCTION IF EXISTS purchase_unlock_atomic(uuid,uuid,integer,uuid,numeric,text);` and `git revert` the `unlock.service.ts` change to restore the previous (insert-then-split) flow.
> - **Verify:** SQL smoke test in Step 7 + TS unit tests.

**Files:**
- Live DB via Supabase MCP `apply_migration`.
- Modify: `Backend/src/unlock/unlock.service.ts:67-138` (`purchaseUnlock`)
- Modify: `Backend/src/unlock/unlock.service.spec.ts` (rewrite for RPC)
- Modify (reference-only): `Backend/supabase-migration.sql`.

**Interfaces:**
- Produces (DB): `purchase_unlock_atomic(p_uid uuid, p_version_id uuid, p_price integer, p_creator_uid uuid, p_platform_pct numeric, p_description text) RETURNS TABLE(balance integer, already_unlocked boolean, creator_share integer, platform_share integer)`. Raises `INSUFFICIENT_FUNDS` on debit failure (rolls back the whole txn).
- Consumes (TS): `this.db.rpc('purchase_unlock_atomic', {...})`.

- [ ] **Step 1: Apply the function migration**

Run via Supabase MCP `apply_migration` (project `eqgcnoljbiwosecydjqd`, name `purchase_unlock_atomic`):

```sql
CREATE OR REPLACE FUNCTION purchase_unlock_atomic(
  p_uid          uuid,
  p_version_id   uuid,
  p_price        integer,
  p_creator_uid  uuid,
  p_platform_pct numeric,
  p_description  text
)
RETURNS TABLE(balance integer, already_unlocked boolean, creator_share integer, platform_share integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rows            integer;
  v_balance         integer;
  v_creator_balance integer;
  v_platform_share  integer := 0;
  v_creator_share   integer := 0;
BEGIN
  -- Idempotent unlock (PK uid,version_id). If the row already exists, the user
  -- already paid — return without charging again.
  INSERT INTO unlocks (uid, version_id, price_paid)
  VALUES (p_uid, p_version_id, p_price)
  ON CONFLICT (uid, version_id) DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 0 THEN
    SELECT w.balance INTO v_balance FROM wallets w WHERE w.uid = p_uid;
    RETURN QUERY SELECT COALESCE(v_balance, 0), true, 0, 0;
    RETURN;
  END IF;

  -- Free chapter: granted, no ledger movement.
  IF p_price <= 0 THEN
    SELECT w.balance INTO v_balance FROM wallets w WHERE w.uid = p_uid;
    RETURN QUERY SELECT COALESCE(v_balance, 0), false, 0, 0;
    RETURN;
  END IF;

  -- Debit buyer atomically. NOT FOUND => insufficient funds => raise, which
  -- rolls back the unlock insert above (single transaction).
  INSERT INTO wallets (uid, balance) VALUES (p_uid, 0) ON CONFLICT (uid) DO NOTHING;
  UPDATE wallets
     SET balance = wallets.balance - p_price, updated_at = now()
   WHERE uid = p_uid AND wallets.balance >= p_price
   RETURNING wallets.balance INTO v_balance;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INSUFFICIENT_FUNDS';
  END IF;

  INSERT INTO wallet_transactions (uid, amount, type, balance_after, description, reference_id)
  VALUES (p_uid, -p_price, 'purchase', v_balance, p_description, p_version_id::text);

  -- Credit creator share (70% default). reference_id left NULL — rewards are
  -- guarded upstream by the unlocks PK, and topup idempotency index ignores nulls.
  v_platform_share := floor(p_price * p_platform_pct);
  v_creator_share  := p_price - v_platform_share;
  IF v_creator_share > 0 AND p_creator_uid IS NOT NULL THEN
    INSERT INTO wallets (uid, balance) VALUES (p_creator_uid, 0) ON CONFLICT (uid) DO NOTHING;
    UPDATE wallets
       SET balance = wallets.balance + v_creator_share, updated_at = now()
     WHERE uid = p_creator_uid
     RETURNING wallets.balance INTO v_creator_balance;
    INSERT INTO wallet_transactions (uid, amount, type, balance_after, description)
    VALUES (p_creator_uid, v_creator_share, 'reward', v_creator_balance, 'ส่วนแบ่งรายได้: ' || p_description);
  END IF;

  RETURN QUERY SELECT v_balance, false, v_creator_share, v_platform_share;
END;
$$;
```

- [ ] **Step 2: Write the failing TS tests (rewrite unlock spec)**

Replace `Backend/src/unlock/unlock.service.spec.ts` with:

```ts
import { UnlockService } from './unlock.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('UnlockService', () => {
  let service: UnlockService;
  let walletService: any;
  let mockChain: any;
  let mockRpc: jest.Mock;

  beforeEach(() => {
    mockChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn(),
    };
    mockRpc = jest.fn();
    const supabaseService = {
      client: { from: jest.fn().mockReturnValue(mockChain), rpc: mockRpc },
    } as any;
    walletService = { getBalance: jest.fn().mockResolvedValue(100) };
    service = new UnlockService(supabaseService, walletService);
  });

  describe('purchaseUnlock', () => {
    const publishedPaid = {
      version_id: 'v1', price_coins: 10, translator_uid: 'c1',
      title_name: 'Manga X', status: 'published',
    };

    it('charges and unlocks a published paid chapter via the atomic RPC', async () => {
      mockChain.maybeSingle.mockResolvedValueOnce({ data: publishedPaid, error: null });
      mockRpc.mockResolvedValue({
        data: [{ balance: 90, already_unlocked: false, creator_share: 7, platform_share: 3 }],
        error: null,
      });

      const res = await service.purchaseUnlock('u1', 'v1');
      expect(res).toEqual({ unlocked: true, pricePaid: 10, balance: 90 });
      expect(mockRpc).toHaveBeenCalledWith('purchase_unlock_atomic', expect.objectContaining({
        p_uid: 'u1', p_version_id: 'v1', p_price: 10, p_creator_uid: 'c1', p_platform_pct: 0.3,
      }));
    });

    it('returns alreadyUnlocked when the RPC reports a pre-existing unlock', async () => {
      mockChain.maybeSingle.mockResolvedValueOnce({ data: publishedPaid, error: null });
      mockRpc.mockResolvedValue({
        data: [{ balance: 100, already_unlocked: true, creator_share: 0, platform_share: 0 }],
        error: null,
      });

      const res = await service.purchaseUnlock('u1', 'v1');
      expect(res).toEqual({ alreadyUnlocked: true });
    });

    it('throws BadRequestException on INSUFFICIENT_FUNDS', async () => {
      mockChain.maybeSingle.mockResolvedValueOnce({ data: publishedPaid, error: null });
      mockRpc.mockResolvedValue({ data: null, error: { message: 'INSUFFICIENT_FUNDS' } });
      await expect(service.purchaseUnlock('u1', 'v1')).rejects.toThrow(BadRequestException);
    });

    it('unlocks a free published chapter without charging', async () => {
      mockChain.maybeSingle.mockResolvedValueOnce({
        data: { ...publishedPaid, price_coins: 0, translator_uid: 'c1' }, error: null,
      });
      mockRpc.mockResolvedValue({
        data: [{ balance: 100, already_unlocked: false, creator_share: 0, platform_share: 0 }],
        error: null,
      });
      const res = await service.purchaseUnlock('u1', 'v1');
      expect(res).toEqual({ unlocked: true, pricePaid: 0, balance: 100 });
    });

    it('throws NotFoundException when version does not exist', async () => {
      mockChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
      await expect(service.purchaseUnlock('u1', 'v1')).rejects.toThrow(NotFoundException);
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when paid version has no creator', async () => {
      mockChain.maybeSingle.mockResolvedValueOnce({
        data: { ...publishedPaid, translator_uid: null }, error: null,
      });
      await expect(service.purchaseUnlock('u1', 'v1')).rejects.toThrow(BadRequestException);
      expect(mockRpc).not.toHaveBeenCalled();
    });

    // V7 status guard is exercised in Task 8.
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx jest src/unlock/unlock.service.spec.ts --no-coverage`
Expected: FAIL — `purchaseUnlock` still uses the old insert-then-split flow / `processRevenueSplit`.

- [ ] **Step 4: Implement the RPC-based `purchaseUnlock`**

In `Backend/src/unlock/unlock.service.ts`, replace the entire `purchaseUnlock` method (lines 67-138) with:

```ts
  async purchaseUnlock(uid: string, versionId: string) {
    // Fetch chapter version (price, creator, title, status)
    const { data: version, error: versionError } = await this.db
      .from('chapter_versions')
      .select('version_id, price_coins, translator_uid, title_name, status')
      .eq('version_id', versionId)
      .maybeSingle();

    if (versionError) {
      throw new InternalServerErrorException(`Failed to fetch chapter version: ${versionError.message}`);
    }
    if (!version) {
      throw new NotFoundException(`Chapter version ${versionId} not found`);
    }

    const priceCoins = version.price_coins ?? 0;
    const creatorUid = version.translator_uid;
    const mangaTitle = version.title_name || 'Unknown Manga';
    if (priceCoins > 0 && !creatorUid) {
      throw new BadRequestException('Cannot purchase: Creator information is missing for this version.');
    }

    // Atomic: insert unlock + debit buyer + credit creator in ONE transaction (V6/V7).
    const { data, error } = await this.db.rpc('purchase_unlock_atomic', {
      p_uid: uid,
      p_version_id: versionId,
      p_price: priceCoins,
      p_creator_uid: creatorUid ?? null,
      p_platform_pct: 0.3,
      p_description: `ปลดล็อคตอน: ${mangaTitle}`,
    });

    if (error) {
      if (error.message?.includes('INSUFFICIENT_FUNDS')) {
        throw new BadRequestException('Insufficient balance');
      }
      throw new InternalServerErrorException(`Failed to unlock chapter: ${error.message}`);
    }

    const row = Array.isArray(data) ? data[0] : (data as any);
    if (row?.already_unlocked) {
      return { alreadyUnlocked: true };
    }

    this.logger.log(`User ${uid} unlocked version ${versionId} for ${priceCoins} coins`);
    return { unlocked: true, pricePaid: priceCoins, balance: row?.balance };
  }
```

Leave `isUnlocked` and `getUnlockedVersions` unchanged (still used by the `check`/`title` endpoints).

> Note: `processRevenueSplit` in `wallet.service.ts` is now unused by the unlock path but remains a tested public API; leave it in place (do not orphan `spendCoins`). Add a one-line doc comment above it: `// NOTE: superseded for unlocks by purchase_unlock_atomic; kept for ad-hoc/admin use.`

- [ ] **Step 5: Run to verify TS tests pass**

Run: `npx jest src/unlock/unlock.service.spec.ts --no-coverage`
Expected: PASS.

- [ ] **Step 6: Update the reference SQL file**

Add the full `purchase_unlock_atomic` definition (from Step 1) to `Backend/supabase-migration.sql` in the "ATOMIC RPC FUNCTIONS" section.

- [ ] **Step 7: SQL smoke test (live verify) — then commit**

Run via Supabase MCP `execute_sql` against a disposable/test row, OR confirm the function signature only (non-mutating):

```sql
SELECT proname, pg_get_function_identity_arguments(oid) AS args
FROM pg_proc WHERE proname = 'purchase_unlock_atomic';
```
Expected: one row, args `p_uid uuid, p_version_id uuid, p_price integer, p_creator_uid uuid, p_platform_pct numeric, p_description text`.

```bash
git add Backend/src/unlock/unlock.service.ts Backend/src/unlock/unlock.service.spec.ts Backend/src/wallet/wallet.service.ts Backend/supabase-migration.sql
git commit -m "feat(unlock): atomic purchase_unlock_atomic RPC — single-txn unlock+debit+credit (V6/V7)"
```

---

## Task 8 — Unlock published-status guard (V7)

**Files:**
- Modify: `Backend/src/unlock/unlock.service.ts` (`purchaseUnlock`)
- Modify: `Backend/src/unlock/unlock.service.spec.ts`

**Interfaces:**
- Behavior: purchasing a version whose `status` is not `'published'` throws `BadRequestException`.

- [ ] **Step 1: Write the failing test**

In `Backend/src/unlock/unlock.service.spec.ts`, inside `describe('purchaseUnlock', ...)`, add:

```ts
    it('throws BadRequestException when the version is not published', async () => {
      mockChain.maybeSingle.mockResolvedValueOnce({
        data: { version_id: 'v1', price_coins: 10, translator_uid: 'c1', title_name: 'X', status: 'draft' },
        error: null,
      });
      await expect(service.purchaseUnlock('u1', 'v1')).rejects.toThrow(BadRequestException);
      expect(mockRpc).not.toHaveBeenCalled();
    });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest src/unlock/unlock.service.spec.ts -t "not published" --no-coverage`
Expected: FAIL — no status check yet; the RPC is still called.

- [ ] **Step 3: Implement the status guard**

In `Backend/src/unlock/unlock.service.ts`, in `purchaseUnlock`, immediately after the `if (!version) { ... }` not-found check and before computing `priceCoins`, add:

```ts
    // V7: only live (published) versions are purchasable.
    if (version.status !== 'published') {
      throw new BadRequestException('This chapter version is not available for purchase.');
    }
```

- [ ] **Step 4: Run to verify it passes (full unlock suite)**

Run: `npx jest src/unlock/unlock.service.spec.ts --no-coverage`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add Backend/src/unlock/unlock.service.ts Backend/src/unlock/unlock.service.spec.ts
git commit -m "feat(unlock): reject purchase of non-published chapter versions (V7)"
```

---

## Task 9 — Rate-limit `POST /wallet/topup/create` (V9)

**Files:**
- Create: `Backend/src/wallet/topup-throttle.guard.ts`
- Create: `Backend/src/wallet/topup-throttle.guard.spec.ts`
- Modify: `Backend/src/wallet/wallet.module.ts` (register guard)
- Modify: `Backend/src/wallet/wallet.controller.ts:50-57` (apply guard)

**Interfaces:**
- Produces: `TopupThrottleGuard` (NestJS `CanActivate`) — allows `TOPUP_RL_MAX = 5` creations per `TOPUP_RL_WINDOW_SEC = 60` per uid; throws `HttpException(429)` over the limit; fails **open** if Redis is unavailable.
- Consumes: global `RedisService` (`incr`, `expire`).

- [ ] **Step 1: Write the failing test**

Create `Backend/src/wallet/topup-throttle.guard.spec.ts`:

```ts
import { TopupThrottleGuard } from './topup-throttle.guard';
import { USER_KEY } from '../auth/auth.guard';
import { HttpException } from '@nestjs/common';

const ctx = (uid: string) =>
  ({ switchToHttp: () => ({ getRequest: () => ({ [USER_KEY]: { uid } }) }) }) as any;

describe('TopupThrottleGuard', () => {
  it('allows requests under the limit', async () => {
    const redis = { incr: jest.fn().mockResolvedValue(1), expire: jest.fn().mockResolvedValue(undefined) };
    const guard = new TopupThrottleGuard(redis as any);
    await expect(guard.canActivate(ctx('u1'))).resolves.toBe(true);
    expect(redis.expire).toHaveBeenCalled(); // TTL set on the first hit
  });

  it('blocks with 429 once the limit is exceeded', async () => {
    const redis = { incr: jest.fn().mockResolvedValue(6), expire: jest.fn() };
    const guard = new TopupThrottleGuard(redis as any);
    await expect(guard.canActivate(ctx('u1'))).rejects.toThrow(HttpException);
  });

  it('fails open when Redis is unavailable (incr returns 0)', async () => {
    const redis = { incr: jest.fn().mockResolvedValue(0), expire: jest.fn() };
    const guard = new TopupThrottleGuard(redis as any);
    await expect(guard.canActivate(ctx('u1'))).resolves.toBe(true);
  });

  it('does not reset the TTL on subsequent hits', async () => {
    const redis = { incr: jest.fn().mockResolvedValue(2), expire: jest.fn() };
    const guard = new TopupThrottleGuard(redis as any);
    await guard.canActivate(ctx('u1'));
    expect(redis.expire).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest src/wallet/topup-throttle.guard.spec.ts --no-coverage`
Expected: FAIL — `Cannot find module './topup-throttle.guard'`.

- [ ] **Step 3: Implement the guard**

Create `Backend/src/wallet/topup-throttle.guard.ts`:

```ts
import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { RedisService } from '../cache/redis.service';
import { USER_KEY } from '../auth/auth.guard';

const TOPUP_RL_MAX = 5;
const TOPUP_RL_WINDOW_SEC = 60;

/**
 * Per-uid sliding-window-ish rate limiter for topup creation (each call hits the
 * live Xendit API). Fails OPEN when Redis is down (incr() returns 0) so a Redis
 * outage never blocks legitimate payment — abuse protection is best-effort.
 */
@Injectable()
export class TopupThrottleGuard implements CanActivate {
  constructor(private readonly redis: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const uid = req?.[USER_KEY]?.uid;
    if (!uid) return true; // AuthGuard runs first; if no uid, let it handle auth

    const key = `topup:create:rl:${uid}`;
    const count = await this.redis.incr(key);
    if (count === 0) return true; // Redis unavailable → fail open
    if (count === 1) {
      await this.redis.expire(key, TOPUP_RL_WINDOW_SEC);
    }
    if (count > TOPUP_RL_MAX) {
      throw new HttpException('Too many topup requests. Please wait a minute.', HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx jest src/wallet/topup-throttle.guard.spec.ts --no-coverage`
Expected: PASS.

- [ ] **Step 5: Register + apply the guard**

In `Backend/src/wallet/wallet.module.ts`, add `TopupThrottleGuard` to `providers`:

```ts
import { TopupThrottleGuard } from './topup-throttle.guard';
// ...
  providers: [WalletService, XenditService, WalletEventsService, TopupThrottleGuard],
```

In `Backend/src/wallet/wallet.controller.ts`, import the guard and apply it to the create endpoint (line 50-51). Change:

```ts
  @Post('topup/create')
  @UseGuards(AuthGuard)
```
to:
```ts
  @Post('topup/create')
  @UseGuards(AuthGuard, TopupThrottleGuard)
```
and add the import at the top: `import { TopupThrottleGuard } from './topup-throttle.guard';`

- [ ] **Step 6: Verify build + module wiring**

Run: `npx jest src/wallet --no-coverage && npx tsc --noEmit -p tsconfig.json`
Expected: PASS, no TS errors.

- [ ] **Step 7: Commit**

```bash
git add Backend/src/wallet/topup-throttle.guard.ts Backend/src/wallet/topup-throttle.guard.spec.ts Backend/src/wallet/wallet.module.ts Backend/src/wallet/wallet.controller.ts
git commit -m "feat(wallet): per-uid rate limit on topup/create, fail-open (V9)"
```

---

## Task 10 — Document env vars + final full-suite gate

**Files:**
- Modify: `Backend/.env.example`

- [ ] **Step 1: Document the new env vars**

In `Backend/.env.example`, in the "Xendit Payment Gateway" section (after line 126 `XENDIT_WEBHOOK_TOKEN=...`), add:

```bash
# HMAC-SHA256 secret for verifying webhook bodies. REQUIRED in production
# (the app refuses to boot without it) — without it forged webhooks could mint coins.
XENDIT_WEBHOOK_SECRET=your-xendit-webhook-hmac-secret

# Set to "true" ONLY in sandbox/dev to enable the simulate + direct-topup mint
# endpoints. MUST be unset (or any value != "true") in production.
XENDIT_ALLOW_SIMULATE=false
```

- [ ] **Step 2: Run the entire backend test suite**

Run: `npm test`
Expected: PASS. (If pre-existing unrelated failures appear, confirm they match the baseline recorded in `.claude/memory/project_backend_pre_existing_test_failures.md` — do not let this task introduce new failures.)

- [ ] **Step 3: Lint + build**

Run: `npm run lint && npm run build`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add Backend/.env.example
git commit -m "docs(wallet): document XENDIT_WEBHOOK_SECRET + XENDIT_ALLOW_SIMULATE (V1/V3)"
```

- [ ] **Step 5: Notify the developer**

```bash
pwsh -NoProfile -File scripts/notify.ps1 -Message "wallet security hardening V1-V9: all tasks committed, suite green"
```

---

## Deployment / Ops checklist (post-merge, before prod)

- [ ] Set `XENDIT_WEBHOOK_SECRET` in production (Xendit Dashboard → Webhooks → verification/signature settings) — boot will fail without it.
- [ ] Confirm `XENDIT_ALLOW_SIMULATE` is **unset** (or `false`) in all production environments.
- [ ] Confirm `XENDIT_WEBHOOK_TOKEN` is set in production.
- [ ] Verify the Xendit webhook is configured to send the `x-xendit-webhook-signature` header (required once the secret is set).
- [ ] Smoke-test one real sandbox topup end-to-end (create QR → simulate → webhook → balance increments exactly once).
- [ ] Confirm Supabase backup taken before Task 6/7 migrations; index + `purchase_unlock_atomic` present in prod DB.

---

## Self-Review

**Spec coverage:**
- V1 → Tasks 1 (boot fail-closed), 2 (mandatory HMAC + constant-time token), 3 (active Xendit verification). ✅
- V2 → Task 3 (amount reconciliation `verified.amount === claimed.amount_coins`). ✅
- V3 → Task 4 (`simulateTopup` behind `XENDIT_ALLOW_SIMULATE`). ✅
- V4 → Task 4 (dev `POST /wallet/topup` flag + DTO) + Task 5 (`@Max` + integer/upper-bound service guards). ✅
- V5 → Task 6 (topup-scoped unique index + drop dead numeric overloads). ✅
- V6 → Task 7 (`purchase_unlock_atomic` single-txn). ✅
- V7 → Task 7 (atomic ordering replaces insert-before-charge) + Task 8 (published-status guard). ✅
- V8 → Task 2 (`safeTokenEqual` constant-time). ✅
- V9 → Task 9 (`TopupThrottleGuard`). ✅

**Type/name consistency:** `MAX_TOPUP_COINS` (exported from `wallet.service.ts`, consumed by DTO); `safeTokenEqual` / `resolveXenditWebhookConfig` (Task 1 → used Task 2 + main.ts); `getPaymentRequest` returns `{status, amount, currency}` (Task 3 producer + consumer + tests align); `purchase_unlock_atomic` arg list identical in SQL (Task 7 Step 1), TS call (Step 4), and tests (Step 2); RPC return columns `{balance, already_unlocked, creator_share, platform_share}` consistent across function/test/consumer; `TopupThrottleGuard(RedisService)` constructor matches spec + module registration.

**Residual risk noted in plan:** active verification adds a synchronous Xendit GET on the webhook hot path (fail-closed: a Xendit outage delays — never fabricates — credit, and Xendit retries). The topup-scoped idempotency index is intentionally narrow (type='topup') to avoid colliding with per-version purchase/reward `reference_id`s.
