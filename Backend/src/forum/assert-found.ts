import { NotFoundException } from '@nestjs/common';

type DbError = { code?: string; message?: string } | null;

/** Supabase/Postgres codes that mean "there is no such row": `.single()` on zero rows, and an id that is not a uuid. */
const MISSING_ROW = new Set(['PGRST116', '22P02']);

/**
 * Throws the right failure for a single-row lookup that found nothing (#915): a 404 only when the row does not exist.
 * Any other database error used to read as "not found" to the user (and to the frontend, which trusts a 404); it is now
 * a plain error naming Supabase, which AllExceptionsFilter already turns into the app's database-down signal — 503 with
 * code SUPABASE_OFFLINE (the frontend's Supabase toast) — and logs with the Postgres code and message.
 * Returns `never`, so `if (error || !row) lookupFailure(error, '…')` narrows `row` after it.
 */
export function lookupFailure(error: DbError, message: string): never {
  if (!error || (error.code && MISSING_ROW.has(error.code)))
    throw new NotFoundException(message);
  throw new Error(
    `Supabase lookup failed (${error.code || 'no code'}): ${error.message || 'unknown error'}`,
  );
}
