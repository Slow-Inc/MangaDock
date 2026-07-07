# Payment & Unlock Correctness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the two money-correctness defects in the backend — a paid top-up whose credit step fails must not silently lose the user's coins (FR-1), and a chapter unlock must charge the price/status read inside the atomic transaction, not a stale value trusted from the caller (FR-2).

**Architecture:** FR-1 is a surgical change to the Xendit webhook handler: wrap the post-claim `addCoins` call so a credit failure reverts the `paid` claim back to `pending` (letting a Xendit retry re-process), relying on the existing DB-level topup idempotency index to prevent double-credit. FR-2 moves price/status/creator reads from `unlock.service.ts` into the `purchase_unlock_atomic` Postgres function so the debit cannot use a value that changed between the read and the transaction; the TS caller stops passing `p_price` and maps RPC-raised errors to HTTP exceptions.

**Tech Stack:** NestJS 11, TypeScript, Jest (unit), Supabase Postgres (plpgsql `SECURITY DEFINER` RPCs), Supabase MCP `apply_migration` for schema/function changes.

## Global Constraints

- Work in worktree branch `worktree-backend-audit-fixes`; all paths below are relative to the worktree root.
- All commands run from `Backend/` unless stated. Single-file test runner: `npx jest <path> --no-coverage` (per CLAUDE.md).
- Money-path changes MUST keep the existing webhook security invariants intact: constant-time token check, mandatory HMAC in production, active re-verification against Xendit before credit, SSE emitted only after a successful credit.
- Postgres function/schema changes are applied via Supabase MCP `apply_migration` (NOT by editing `Backend/supabase-migration.sql`, which is reference-only per CLAUDE.md). Update `supabase-migration.sql` afterward only to keep the reference in sync.
- Do not weaken or remove existing tests; update them only where the corrected behavior intentionally changes an assertion, and say so in the commit message.
- TDD: write the failing test first, watch it fail, implement, watch it pass, commit. Frequent small commits.

---

## Preflight (once, before Task 1)

- [ ] **Install deps + confirm clean baseline**

Run (from `Backend/`):
```bash
npm install
npx jest src/wallet/wallet.service.spec.ts src/unlock/unlock.service.spec.ts --no-coverage
```
Expected: both suites PASS (this is the pre-change baseline). If anything fails before you change code, stop and report — do not start on a red baseline.

---

## Task 1: FR-1 — Revert the top-up claim when crediting fails

**Files:**
- Modify: `Backend/src/wallet/wallet.service.ts:402-414` (the post-verification credit block in `processXenditWebhook`)
- Test: `Backend/src/wallet/wallet.service.spec.ts` (update one existing test ~385-400; add two new tests)

**Interfaces:**
- Consumes: `private revertClaim(paymentId: string): Promise<void>` (already defined at `wallet.service.ts:296-305` — sets `coin_topups.status` from `paid` back to `pending`); `addCoins(uid, amount, type, description, referenceId)` (line 60); `getBalance(uid)` (line 33); `walletEvents.emit(paymentId, { balance })`.
- Produces: no signature change. `processXenditWebhook(...)` still returns `{ received: boolean }`. Behavior change only: on credit failure the claim is reverted and the original error rethrown; on the DB topup-idempotency unique violation the call returns `{ received: true }` (already credited).

**Background (why this is safe):** `addCoins` resolves to the 5-arg `add_coins_atomic` overload (`supabase-migration.sql:375`), which writes `wallet_transactions.reference_id = paymentId`. The partial unique index `wallet_tx_topup_ref_uidx` (`supabase-migration.sql:230-232`) guarantees a given `payment_id` is credited as a topup at most once. So reverting the claim and letting Xendit retry cannot double-credit: a retry either credits cleanly (first attempt never committed) or hits the unique violation (first attempt did commit) — which Step 5 below treats as success.

- [ ] **Step 1: Update the existing "addCoins fails" test to assert the claim is reverted**

In `Backend/src/wallet/wallet.service.spec.ts`, replace the test currently at ~385-400 (`'should throw and propagate error when addCoins RPC fails after atomic claim'`) with this stronger version:

```ts
    it('reverts the claim to pending and rethrows when addCoins fails after the atomic claim', async () => {
      // Atomic claim succeeds (status -> paid), Xendit verification passes, but the credit RPC fails.
      mockUpdateChain.maybeSingle.mockResolvedValue({
        data: { uid: 'u1', amount_coins: 100, status: 'paid' },
        error: null,
      });
      mockXendit.getPaymentRequest.mockResolvedValue({ status: 'SUCCEEDED', amount: 100, currency: 'THB' });
      mockRpc.mockResolvedValue({ data: null, error: { message: 'RPC down' } });

      await expect(
        service.processXenditWebhook(succeededPayload('pr-credit-fail'), WEBHOOK_TOKEN),
      ).rejects.toThrow();

      // Claim was taken (paid) and then reverted (pending) so a Xendit retry can re-process.
      expect(mockChain.update).toHaveBeenCalledWith({ status: 'paid' });
      expect(mockChain.update).toHaveBeenCalledWith({ status: 'pending' });
      expect(mockWalletEvents.emit).not.toHaveBeenCalled();
    });
```

- [ ] **Step 2: Add a test for the idempotency-violation-as-success path**

Add this test directly after the one from Step 1:

```ts
    it('returns received:true without reverting when the credit hits the topup idempotency unique index', async () => {
      mockUpdateChain.maybeSingle.mockResolvedValue({
        data: { uid: 'u1', amount_coins: 100, status: 'paid' },
        error: null,
      });
      mockXendit.getPaymentRequest.mockResolvedValue({ status: 'SUCCEEDED', amount: 100, currency: 'THB' });
      // add_coins_atomic raises the partial unique index violation -> already credited once.
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'duplicate key value violates unique constraint "wallet_tx_topup_ref_uidx"' },
      });
      // getBalance re-read after detecting the duplicate
      mockChain.maybeSingle.mockResolvedValue({ data: { balance: 250 }, error: null });

      const result = await service.processXenditWebhook(succeededPayload('pr-dup-credit'), WEBHOOK_TOKEN);

      expect(result).toEqual({ received: true });
      expect(mockChain.update).not.toHaveBeenCalledWith({ status: 'pending' }); // NOT reverted
      expect(mockWalletEvents.emit).toHaveBeenCalledWith('pr-dup-credit', { balance: 250 });
    });
```

- [ ] **Step 3: Run the two tests and verify they fail**

Run:
```bash
npx jest src/wallet/wallet.service.spec.ts --no-coverage -t "addCoins fails after the atomic claim"
npx jest src/wallet/wallet.service.spec.ts --no-coverage -t "topup idempotency unique index"
```
Expected: FAIL — the current code does not revert on failure (so `update` with `{ status: 'pending' }` was never called) and does not special-case the duplicate-key error.

- [ ] **Step 4: Implement the revert-on-failure + idempotency-as-success logic**

In `Backend/src/wallet/wallet.service.ts`, replace the credit block (currently lines 402-414):

```ts
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

with:

```ts
    let balance: number;
    try {
      ({ balance } = await this.addCoins(
        claimed.uid,
        claimed.amount_coins,
        'topup',
        'เติมเหรียญ MangaDock',
        paymentId,
      ));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // DB-level topup idempotency (wallet_tx_topup_ref_uidx) means this payment was
      // already credited once. Treat as success: do NOT revert, re-read the balance, emit.
      if (/duplicate key|wallet_tx_topup_ref_uidx/i.test(msg)) {
        const current = await this.getBalance(claimed.uid);
        this.walletEvents.emit(paymentId, { balance: current });
        return { received: true };
      }
      // Genuine credit failure: revert the claim so a Xendit retry re-processes it,
      // then rethrow so Xendit receives a 5xx and retries.
      await this.revertClaim(paymentId);
      this.logger.error(
        `Webhook credit failed after claim for ${paymentId}: ${msg} — claim reverted to pending for retry`,
      );
      throw err;
    }

    // Emit SSE after addCoins succeeds — security ordering invariant
    this.walletEvents.emit(paymentId, { balance });

    return { received: true };
```

- [ ] **Step 5: Run the full wallet suite and verify green**

Run:
```bash
npx jest src/wallet/wallet.service.spec.ts --no-coverage
```
Expected: PASS (all tests, including the two updated/added and the pre-existing SECURITY revert tests at ~514-571 which already assert revert on verify-mismatch/unreachable).

- [ ] **Step 6: Commit**

```bash
git add Backend/src/wallet/wallet.service.ts Backend/src/wallet/wallet.service.spec.ts
git commit -m "fix(wallet): revert topup claim when credit fails (FR-1)

A credit failure after the atomic paid-claim previously left the topup
stuck 'paid' with no coins, and Xendit retries skipped it — permanent
coin loss. Now revert to pending so retry re-processes; the existing
wallet_tx_topup_ref_uidx index prevents double-credit, so a duplicate-key
error is treated as already-credited.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: FR-2 — Read price/status inside `purchase_unlock_atomic`

**Files:**
- DB (via Supabase MCP `apply_migration`, migration name `unlock_atomic_internal_price_v8`): redefine `purchase_unlock_atomic` with a new signature that reads price/status/creator internally.
- Modify: `Backend/src/unlock/unlock.service.ts:67-114` (`purchaseUnlock`)
- Modify (reference sync): `Backend/supabase-migration.sql:443-512`
- Test: `Backend/src/unlock/unlock.service.spec.ts` (rewrite the `purchaseUnlock` block)

**Interfaces:**
- Consumes: Supabase `db.rpc('purchase_unlock_atomic', {...})`.
- Produces: new RPC signature `purchase_unlock_atomic(p_uid uuid, p_version_id uuid, p_platform_pct numeric, p_description_prefix text)` returning `TABLE(balance integer, already_unlocked boolean, creator_share integer, platform_share integer, price_paid integer)`. RPC raises `VERSION_NOT_FOUND`, `NOT_PUBLISHED`, `CREATOR_MISSING`, or `INSUFFICIENT_FUNDS`. `purchaseUnlock(uid, versionId)` still returns `{ alreadyUnlocked: true }` or `{ unlocked: true, pricePaid, balance }`.

- [ ] **Step 1: Apply the migration that moves the reads inside the function**

Use Supabase MCP `apply_migration` with name `unlock_atomic_internal_price_v8` and this SQL. Note `CREATE OR REPLACE` cannot change a function's argument list, so the old 6-arg overload is dropped first.

```sql
-- FR-2: re-read price/status/creator INSIDE the txn so a concurrent price change or
-- unpublish between the caller's SELECT and the debit can no longer be exploited.
DROP FUNCTION IF EXISTS purchase_unlock_atomic(uuid, uuid, integer, uuid, numeric, text);

CREATE OR REPLACE FUNCTION purchase_unlock_atomic(
  p_uid                uuid,
  p_version_id         uuid,
  p_platform_pct       numeric,
  p_description_prefix text
)
RETURNS TABLE(balance integer, already_unlocked boolean, creator_share integer, platform_share integer, price_paid integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rows            integer;
  v_balance         integer;
  v_creator_balance integer;
  v_platform_share  integer := 0;
  v_creator_share   integer := 0;
  v_price           integer;
  v_status          text;
  v_creator_uid     uuid;
  v_title_name      text;
  v_description     text;
BEGIN
  -- Authoritative read inside the transaction — caller is not trusted for price/status.
  SELECT cv.price_coins, cv.status, cv.translator_uid, cv.title_name
    INTO v_price, v_status, v_creator_uid, v_title_name
    FROM chapter_versions cv
   WHERE cv.version_id = p_version_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'VERSION_NOT_FOUND';
  END IF;
  IF v_status <> 'published' THEN
    RAISE EXCEPTION 'NOT_PUBLISHED';
  END IF;
  v_price := COALESCE(v_price, 0);
  IF v_price > 0 AND v_creator_uid IS NULL THEN
    RAISE EXCEPTION 'CREATOR_MISSING';
  END IF;
  v_description := p_description_prefix || COALESCE(v_title_name, 'Unknown Manga');

  INSERT INTO unlocks (uid, version_id, price_paid)
  VALUES (p_uid, p_version_id, v_price)
  ON CONFLICT (uid, version_id) DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 0 THEN
    SELECT w.balance INTO v_balance FROM wallets w WHERE w.uid = p_uid;
    RETURN QUERY SELECT COALESCE(v_balance, 0), true, 0, 0, v_price;
    RETURN;
  END IF;

  IF v_price <= 0 THEN
    SELECT w.balance INTO v_balance FROM wallets w WHERE w.uid = p_uid;
    RETURN QUERY SELECT COALESCE(v_balance, 0), false, 0, 0, 0;
    RETURN;
  END IF;

  INSERT INTO wallets (uid, balance) VALUES (p_uid, 0) ON CONFLICT (uid) DO NOTHING;
  UPDATE wallets
     SET balance = wallets.balance - v_price, updated_at = now()
   WHERE uid = p_uid AND wallets.balance >= v_price
   RETURNING wallets.balance INTO v_balance;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INSUFFICIENT_FUNDS';
  END IF;

  INSERT INTO wallet_transactions (uid, amount, type, balance_after, description, reference_id)
  VALUES (p_uid, -v_price, 'purchase', v_balance, v_description, p_version_id::text);

  v_platform_share := floor(v_price * p_platform_pct);
  v_creator_share  := v_price - v_platform_share;
  IF v_creator_share > 0 AND v_creator_uid IS NOT NULL THEN
    INSERT INTO wallets (uid, balance) VALUES (v_creator_uid, 0) ON CONFLICT (uid) DO NOTHING;
    UPDATE wallets
       SET balance = wallets.balance + v_creator_share, updated_at = now()
     WHERE uid = v_creator_uid
     RETURNING wallets.balance INTO v_creator_balance;
    INSERT INTO wallet_transactions (uid, amount, type, balance_after, description)
    VALUES (v_creator_uid, v_creator_share, 'reward', v_creator_balance, 'ส่วนแบ่งรายได้: ' || v_description);
  END IF;

  RETURN QUERY SELECT v_balance, false, v_creator_share, v_platform_share, v_price;
END;
$$;

-- Re-revoke PUBLIC execute on the new signature (service_role / backend only).
REVOKE EXECUTE ON FUNCTION purchase_unlock_atomic(uuid, uuid, numeric, text) FROM anon, authenticated, PUBLIC;
```

Expected: migration applies cleanly. Verify with a read-only check (Supabase MCP `execute_sql`):
```sql
SELECT pg_get_function_identity_arguments(oid)
FROM pg_proc WHERE proname = 'purchase_unlock_atomic';
```
Expected single row: `p_uid uuid, p_version_id uuid, p_platform_pct numeric, p_description_prefix text`.

- [ ] **Step 2: Rewrite the unlock-service unit tests for the new contract**

Replace the entire `describe('purchaseUnlock', ...)` block in `Backend/src/unlock/unlock.service.spec.ts` (lines 24-94) with:

```ts
  describe('purchaseUnlock', () => {
    it('unlocks a published paid chapter via the atomic RPC (no pre-SELECT)', async () => {
      mockRpc.mockResolvedValue({
        data: [{ balance: 90, already_unlocked: false, creator_share: 7, platform_share: 3, price_paid: 10 }],
        error: null,
      });

      const res = await service.purchaseUnlock('u1', 'v1');
      expect(res).toEqual({ unlocked: true, pricePaid: 10, balance: 90 });
      // No price/creator trusted from the caller anymore.
      expect(mockRpc).toHaveBeenCalledWith('purchase_unlock_atomic', expect.objectContaining({
        p_uid: 'u1', p_version_id: 'v1', p_platform_pct: 0.3, p_description_prefix: 'ปลดล็อคตอน: ',
      }));
      expect(mockRpc.mock.calls[0][1]).not.toHaveProperty('p_price');
      // No version pre-read round-trip.
      expect(mockChain.maybeSingle).not.toHaveBeenCalled();
    });

    it('returns alreadyUnlocked when the RPC reports a pre-existing unlock', async () => {
      mockRpc.mockResolvedValue({
        data: [{ balance: 100, already_unlocked: true, creator_share: 0, platform_share: 0, price_paid: 10 }],
        error: null,
      });
      const res = await service.purchaseUnlock('u1', 'v1');
      expect(res).toEqual({ alreadyUnlocked: true });
    });

    it('unlocks a free published chapter without charging', async () => {
      mockRpc.mockResolvedValue({
        data: [{ balance: 100, already_unlocked: false, creator_share: 0, platform_share: 0, price_paid: 0 }],
        error: null,
      });
      const res = await service.purchaseUnlock('u1', 'v1');
      expect(res).toEqual({ unlocked: true, pricePaid: 0, balance: 100 });
    });

    it('throws BadRequestException on INSUFFICIENT_FUNDS', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'INSUFFICIENT_FUNDS' } });
      await expect(service.purchaseUnlock('u1', 'v1')).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when the RPC raises VERSION_NOT_FOUND', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'VERSION_NOT_FOUND' } });
      await expect(service.purchaseUnlock('u1', 'v1')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when the RPC raises NOT_PUBLISHED', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'NOT_PUBLISHED' } });
      await expect(service.purchaseUnlock('u1', 'v1')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when the RPC raises CREATOR_MISSING', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'CREATOR_MISSING' } });
      await expect(service.purchaseUnlock('u1', 'v1')).rejects.toThrow(BadRequestException);
    });
  });
```

- [ ] **Step 3: Run the unlock tests and verify they fail**

Run:
```bash
npx jest src/unlock/unlock.service.spec.ts --no-coverage
```
Expected: FAIL — current `purchaseUnlock` still does the pre-SELECT, still sends `p_price`/`p_creator_uid`, and doesn't map `VERSION_NOT_FOUND`/`NOT_PUBLISHED`/`CREATOR_MISSING`.

- [ ] **Step 4: Refactor `purchaseUnlock` to drop the pre-SELECT and map RPC errors**

Replace the body of `purchaseUnlock` in `Backend/src/unlock/unlock.service.ts` (lines 67-114) with:

```ts
  async purchaseUnlock(uid: string, versionId: string) {
    const { data, error } = await this.db.rpc('purchase_unlock_atomic', {
      p_uid: uid,
      p_version_id: versionId,
      p_platform_pct: 0.3,
      p_description_prefix: 'ปลดล็อคตอน: ',
    });

    if (error) {
      const msg = error.message ?? '';
      if (msg.includes('INSUFFICIENT_FUNDS')) {
        throw new BadRequestException('Insufficient balance');
      }
      if (msg.includes('VERSION_NOT_FOUND')) {
        throw new NotFoundException(`Chapter version ${versionId} not found`);
      }
      if (msg.includes('NOT_PUBLISHED')) {
        throw new BadRequestException('Chapter is not available for purchase');
      }
      if (msg.includes('CREATOR_MISSING')) {
        throw new BadRequestException('Cannot purchase: Creator information is missing for this version.');
      }
      throw new InternalServerErrorException(`Failed to unlock chapter: ${msg}`);
    }

    const row = Array.isArray(data) ? data[0] : (data as any);
    if (row?.already_unlocked) {
      return { alreadyUnlocked: true };
    }

    this.logger.log(`User ${uid} unlocked version ${versionId} for ${row?.price_paid} coins`);
    return { unlocked: true, pricePaid: row?.price_paid, balance: row?.balance };
  }
```

- [ ] **Step 5: Run the unlock tests and verify green**

Run:
```bash
npx jest src/unlock/unlock.service.spec.ts --no-coverage
```
Expected: PASS (all 7 tests).

- [ ] **Step 6: Sync the reference SQL file**

Update `Backend/supabase-migration.sql:443-512` so the `purchase_unlock_atomic` definition and its `REVOKE` line match the migration applied in Step 1 (new signature, internal reads, `price_paid` column). This file is reference-only — it documents the live schema; keep it accurate.

- [ ] **Step 7: Run both money suites together**

Run:
```bash
npx jest src/wallet/wallet.service.spec.ts src/unlock/unlock.service.spec.ts --no-coverage
```
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add Backend/src/unlock/unlock.service.ts Backend/src/unlock/unlock.service.spec.ts Backend/supabase-migration.sql
git commit -m "fix(unlock): read price/status inside purchase_unlock_atomic (FR-2)

Price, publish status, and creator are now re-read inside the atomic
transaction instead of being read in unlock.service and trusted as
p_price. A concurrent price change or unpublish between read and debit
can no longer cause a stale charge or a purchase of an unpublished
chapter. New RPC signature drops p_price; errors are raised by the
function and mapped to HTTP exceptions.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Verification (whole plan)

- [ ] From `Backend/`, run the full unit suite and confirm green:
```bash
npm test
```
Expected: all suites PASS (no regression elsewhere). If anything outside wallet/unlock fails, investigate before declaring done.
- [ ] Confirm the live function signature is the new one (Step 1 verify query).
- [ ] Sanity-check the FR-1 invariant by re-reading `processXenditWebhook`: SSE is still emitted only after a successful (or already-credited) outcome, and never on the revert path.

---

## Self-Review notes (author)

- **Spec coverage:** FR-1 → Task 1; FR-2 → Task 2. Both PRD Tier-1 requirements covered. The PRD open question "revertClaim vs idempotent RPC" is resolved in favor of revertClaim (the helper already exists) plus reliance on the existing `wallet_tx_topup_ref_uidx` index for double-credit safety — documented in Task 1 Background.
- **Type consistency:** RPC return shape `{ balance, already_unlocked, creator_share, platform_share, price_paid }` is used identically in the SQL `RETURNS TABLE`, the test fixtures, and `purchaseUnlock`'s `row?.price_paid` / `row?.balance` reads. Error tokens `VERSION_NOT_FOUND` / `NOT_PUBLISHED` / `CREATOR_MISSING` / `INSUFFICIENT_FUNDS` match between the `RAISE EXCEPTION` statements and the `msg.includes(...)` checks.
- **No placeholders:** every code/SQL/test step contains the full content to paste.
- **HITL flags:** Task 2 Step 1 (migration) is the one human-in-the-loop step — it mutates the live Postgres function and must be applied via Supabase MCP with care (see rollback below).

## Rollback

- FR-1: revert the `wallet.service.ts` commit; no schema change involved.
- FR-2: re-apply the original 6-arg `purchase_unlock_atomic` from `Backend/supabase-migration.sql:443-505` (drop the new 4-arg overload first), and revert the `unlock.service.ts` commit. Because the old reference SQL is preserved in git history, this restores the prior behavior exactly.
