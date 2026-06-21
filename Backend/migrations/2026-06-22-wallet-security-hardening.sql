-- ============================================================================
-- STAGED MIGRATION: wallet-security-hardening (V5)
-- Target project : eqgcnoljbiwosecydjqd (Supabase)
-- Staged by      : Claude Code agent — 2026-06-22
-- Apply via      : Supabase Dashboard → SQL Editor  OR  Supabase MCP apply_migration
--
-- ⚠️  TAKE A BACKUP FIRST (Dashboard → Database → Backups → Point-in-time/snapshot)
--     before running any statement below.
-- ============================================================================


-- ─── PRE-CHECK (run this FIRST, confirm 0 rows before applying) ───────────────
--
-- Each row returned is a duplicate topup reference_id — a real historical
-- over-credit. DO NOT silently discard duplicates; investigate and remediate
-- before creating the unique index (which will FAIL if any duplicates exist).
--
-- SELECT reference_id, count(*)
-- FROM wallet_transactions
-- WHERE type = 'topup' AND reference_id IS NOT NULL
-- GROUP BY reference_id
-- HAVING count(*) > 1;
--
-- Expected result: 0 rows.
-- If any rows are returned → STOP. Do not proceed until resolved.
-- ─────────────────────────────────────────────────────────────────────────────


-- ─── DDL (apply once pre-check confirms 0 rows) ──────────────────────────────

-- 1) Ledger idempotency for topup credits: a given Xendit payment_id can be
--    credited as a topup at most once (defense-in-depth behind the status-claim).
CREATE UNIQUE INDEX IF NOT EXISTS wallet_tx_topup_ref_uidx
  ON wallet_transactions (reference_id)
  WHERE type = 'topup' AND reference_id IS NOT NULL;

-- 2) Drop the dead, broken numeric overloads (they omit the NOT-NULL
--    balance_after column and are unreachable — TypeScript always calls the
--    5-arg integer overloads via named parameters).
DROP FUNCTION IF EXISTS add_coins_atomic(uuid, numeric, text, text);
DROP FUNCTION IF EXISTS spend_coins_atomic(uuid, numeric, text, text);

-- ─────────────────────────────────────────────────────────────────────────────


-- ─── VERIFY (run after applying, confirm expected results) ───────────────────
--
-- Query 1 — index exists:
-- SELECT indexname FROM pg_indexes
-- WHERE schemaname = 'public' AND indexname = 'wallet_tx_topup_ref_uidx';
-- Expected: 1 row  →  wallet_tx_topup_ref_uidx
--
-- Query 2 — no numeric overloads remain:
-- SELECT proname, pg_get_function_identity_arguments(oid) AS args
-- FROM pg_proc
-- WHERE proname IN ('add_coins_atomic', 'spend_coins_atomic')
-- ORDER BY proname, args;
-- Expected rows (no numeric variants):
--   add_coins_atomic   | p_uid uuid, p_amount integer, p_type text, p_description text
--   add_coins_atomic   | p_uid uuid, p_amount integer, p_type text, p_description text, p_reference_id text
--   spend_coins_atomic | p_uid uuid, p_amount integer, p_type text, p_description text, p_reference_id text
-- ─────────────────────────────────────────────────────────────────────────────


-- ─── ROLLBACK (if needed) ────────────────────────────────────────────────────
--
-- DROP INDEX IF EXISTS wallet_tx_topup_ref_uidx;
--
-- Then re-create the dropped numeric overloads from Backend/supabase-migration.sql
-- (search for "numeric overloads" — they were removed from that file as of
-- 2026-06-22, so restore from git history:
--   git show HEAD~1:Backend/supabase-migration.sql | grep -A 30 "numeric overload")
-- ─────────────────────────────────────────────────────────────────────────────


-- ===== Task 7: atomic unlock purchase =====
-- Applied via: Supabase Dashboard → SQL Editor  OR  Supabase MCP apply_migration
-- ⚠️  TAKE A BACKUP before applying (Dashboard → Database → Backups → snapshot).
-- Risk: additive (CREATE OR REPLACE) — safe to create; logic handles over/under-charge atomically.

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

-- ─── VERIFY (run after applying, confirm expected result) ─────────────────────
--
-- SELECT proname, pg_get_function_identity_arguments(oid) AS args
-- FROM pg_proc WHERE proname = 'purchase_unlock_atomic';
--
-- Expected: 1 row
--   args = p_uid uuid, p_version_id uuid, p_price integer, p_creator_uid uuid, p_platform_pct numeric, p_description text
--
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── ROLLBACK for Task 7 (if needed) ─────────────────────────────────────────
--
-- DROP FUNCTION IF EXISTS purchase_unlock_atomic(uuid,uuid,integer,uuid,numeric,text);
-- Then git revert the unlock.service.ts change to restore the insert-then-split flow.
--
-- ─────────────────────────────────────────────────────────────────────────────
