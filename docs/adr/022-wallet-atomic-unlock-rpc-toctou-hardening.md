# ADR 022 — Wallet: Atomic Unlock RPC (TOCTOU hardening) + Topup Idempotency Index

**Status:** Accepted — 2026-07-02
**Deciders:** akkanop-x, Claude Code agent
**Links:** PR #463 (`feat/wallet-security-hardening`), commit `72502dd`

---

## Context

The wallet module handles real-money payments (Xendit PromptPay QR) that credit coin balances and debit them when unlocking paid chapters. Two security gaps existed:

1. **Double-topup credit** — Xendit can retry a `payment.succeeded` webhook. The application-level check (`WHERE status = 'pending'`) was a claim-then-update with a race window between read and write. No DB-level deduplication existed.

2. **TOCTOU at purchase** — The original `unlock.service.ts` performed a pre-SELECT on `chapter_versions` to fetch `price_coins` and `translator_uid`, then passed those values to a 6-arg `purchase_unlock_atomic(p_uid, p_version_id, p_price, p_creator_uid, p_platform_pct, p_description)`. A concurrent price change or unpublish between the app-read and the DB-write could allow a buyer to pay a stale (lower) price, or unlock a chapter that was unpublished in the intervening time.

---

## Decision

### 1. `wallet_tx_topup_ref_uidx` — unique partial index

```sql
CREATE UNIQUE INDEX IF NOT EXISTS wallet_tx_topup_ref_uidx
  ON wallet_transactions (reference_id)
  WHERE type = 'topup' AND reference_id IS NOT NULL;
```

Any attempt to insert a second `topup` row with the same `reference_id` (= Xendit `payment_request_id`) raises a unique-constraint violation. The application maps this error to a silent idempotent return (already credited). Defense-in-depth behind the atomic claim UPDATE.

### 2. `purchase_unlock_atomic` — 4-arg self-contained RPC

Replace the 6-arg caller-trusted signature with a 4-arg version that re-reads `price_coins`, `status`, and `translator_uid` from `chapter_versions` **inside the same transaction**:

```sql
CREATE OR REPLACE FUNCTION purchase_unlock_atomic(
  p_uid                uuid,
  p_version_id         uuid,
  p_platform_pct       numeric,
  p_description_prefix text
)
RETURNS TABLE(balance integer, already_unlocked boolean,
              creator_share integer, platform_share integer, price_paid integer)
```

The function raises `VERSION_NOT_FOUND`, `NOT_PUBLISHED`, or `CREATOR_MISSING` before touching any ledger rows. The application never supplies price or creator — it cannot inject a stale or manipulated value.

The old 6-arg overload is dropped (`DROP FUNCTION IF EXISTS purchase_unlock_atomic(uuid,uuid,integer,uuid,numeric,text)`) to prevent Postgres from resolving named-param calls to the wrong overload.

---

## Alternatives Considered

| Alternative | Reason rejected |
|-------------|----------------|
| Application-level re-fetch before purchase | Still has a TOCTOU window (read → debit is not atomic) |
| Optimistic locking (`version` column on `chapter_versions`) | Additional schema change; still requires app-level retry logic; more complex than moving the read inside the txn |
| Keep 6-arg RPC, add `LOCK TABLE` | Serialises all unlocks; unacceptable throughput impact |
| Idempotency via Redis SET NX before DB write | Redis is not durable; a crash between Redis write and DB write loses idempotency guarantee; DB unique index is the only durable guard |

---

## Consequences

**Positive:**
- Double-topup credit: impossible at DB level regardless of retry pattern
- TOCTOU at purchase: eliminated — price and status are read inside the transaction
- `purchase_unlock_atomic` is simpler to call (4 args, no price/creator trust required)
- Dead `add_coins_atomic(uuid, numeric, text, text)` and `spend_coins_atomic(uuid, numeric, text, text)` numeric overloads removed

**Negative / trade-offs:**
- `purchase_unlock_atomic` now does an extra SELECT on `chapter_versions` per unlock call (sub-millisecond; acceptable)
- Migration must be applied before the 4-arg TypeScript caller is deployed; old 6-arg code would fail against the new signature (window is limited to deploy time)

**Rollback:**
```sql
DROP INDEX IF EXISTS wallet_tx_topup_ref_uidx;
DROP FUNCTION IF EXISTS purchase_unlock_atomic(uuid, uuid, numeric, text);
-- Then redeploy the prior unlock.service.ts that used the 6-arg signature
```
