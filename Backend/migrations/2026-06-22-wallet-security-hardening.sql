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
