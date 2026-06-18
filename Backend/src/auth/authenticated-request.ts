import type { Request } from 'express';
import type { SupabaseAuthUser } from './auth.types';

/** For handlers behind AuthGuard — req.supabaseUser and req.uid are always present. */
export interface AuthenticatedRequest extends Request {
  supabaseUser: SupabaseAuthUser;
  uid: string;
}

/** For handlers behind OptionalAuthGuard — user may be absent on public routes. */
export interface MaybeAuthenticatedRequest extends Request {
  supabaseUser?: SupabaseAuthUser;
  uid?: string;
}
