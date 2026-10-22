import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';

type DbError = { code?: string; message?: string } | null;

/** Supabase/Postgres codes that mean "there is no such row": `.single()` on zero rows, and an id that is not a uuid. */
const MISSING_ROW = new Set(['PGRST116', '22P02']);

/**
 * Throws the right failure for a single-row lookup that found nothing (#915): a 404 only when the row does not exist,
 * a 503 for any other database error — an outage used to read as "not found" to the user (and to the frontend, which
 * trusts a 404). Returns `never`, so `if (error || !row) lookupFailure(error, '…')` narrows `row` after it.
 */
export function lookupFailure(error: DbError, message: string): never {
  if (!error || (error.code && MISSING_ROW.has(error.code)))
    throw new NotFoundException(message);
  throw new ServiceUnavailableException('Database unavailable');
}
