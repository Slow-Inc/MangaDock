import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import type { SupabaseAuthUser } from '../auth/auth.types';

const VERIFY_CACHE_TTL_MS = 60_000;
const VERIFY_CACHE_MAX = 5_000;

@Injectable()
export class SupabaseService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseService.name);
  private supabaseClient!: SupabaseClient;

  // Token-hash cache: key = SHA-256(token), value = cached identity + expiry.
  // Raw tokens are NEVER stored; only their hash.
  private readonly tokenCache = new Map<
    string,
    { user: SupabaseAuthUser; expiresAt: number }
  >();

  // Single-flight registry: prevents N parallel first-hits from making N
  // getUser round-trips for the same token.
  private readonly inFlight = new Map<string, Promise<SupabaseAuthUser>>();

  onModuleInit() {
    const url = (process.env.SUPABASE_URL ?? '').trim();
    const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();

    if (!url || !serviceRoleKey) {
      throw new Error(
        'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required',
      );
    }

    this.supabaseClient = createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    this.logger.log(`Supabase initialized: ${url}`);
  }

  get client(): SupabaseClient {
    return this.supabaseClient;
  }

  async verifyAccessToken(accessToken: string): Promise<SupabaseAuthUser> {
    // Key is a SHA-256 hash of the token — raw token never stored, never logged.
    const key = createHash('sha256').update(accessToken).digest('hex');

    // 1. Cache hit path.
    const hit = this.tokenCache.get(key);
    if (hit) {
      if (Date.now() < hit.expiresAt) {
        return hit.user;
      }
      this.tokenCache.delete(key); // lazy expiry
    }

    // 2. Single-flight: coalesce concurrent first-hits for the same token.
    const pending = this.inFlight.get(key);
    if (pending) {
      return pending;
    }

    // 3. Cache miss: fetch from Supabase, cache on success only.
    const p = (async () => {
      const user = await this.fetchUser(accessToken); // throws on invalid — NOT cached
      const ttl = Math.min(
        VERIFY_CACHE_TTL_MS,
        this.tokenExpMsRemaining(accessToken),
      );
      if (ttl > 0) {
        if (this.tokenCache.size >= VERIFY_CACHE_MAX) {
          // Evict oldest entry (Map preserves insertion order).
          this.tokenCache.delete(this.tokenCache.keys().next().value);
        }
        this.tokenCache.set(key, { user, expiresAt: Date.now() + ttl });
      }
      return user;
    })();

    this.inFlight.set(key, p);
    try {
      return await p;
    } finally {
      // Always clean up, whether p resolved or rejected.
      this.inFlight.delete(key);
    }
  }

  /** Calls Supabase getUser and maps the result to SupabaseAuthUser.
   *  Throws 'Invalid or expired token' on any failure so callers get a
   *  consistent error without leaking Supabase internals.
   */
  private async fetchUser(token: string): Promise<SupabaseAuthUser> {
    const { data, error } = await this.supabaseClient.auth.getUser(token);
    if (error || !data.user) {
      throw new Error('Invalid or expired token');
    }

    const providers = (data.user.identities ?? [])
      .map((identity) => identity.provider)
      .filter((provider): provider is string => typeof provider === 'string');

    const metadata = data.user.user_metadata ?? {};

    return {
      uid: data.user.id,
      email: data.user.email ?? null,
      name:
        typeof metadata['full_name'] === 'string'
          ? metadata['full_name']
          : typeof metadata['name'] === 'string'
            ? metadata['name']
            : null,
      picture:
        typeof metadata['avatar_url'] === 'string'
          ? metadata['avatar_url']
          : typeof metadata['picture'] === 'string'
            ? metadata['picture']
            : null,
      providers,
    };
  }

  /** Reads the `exp` claim from the JWT payload (no signature verification —
   *  the token is already validated by getUser; we only bound the cache TTL).
   *  Returns ms remaining until expiry, or VERIFY_CACHE_TTL_MS on parse failure.
   */
  private tokenExpMsRemaining(token: string): number {
    try {
      const seg = token.split('.')[1];
      if (!seg) return VERIFY_CACHE_TTL_MS;
      const payload = JSON.parse(
        Buffer.from(seg, 'base64url').toString(),
      ) as Record<string, unknown>;
      const exp = payload['exp'];
      if (typeof exp === 'number' && isFinite(exp)) {
        return exp * 1000 - Date.now();
      }
    } catch {
      // parse failure → fall back to TTL cap
    }
    return VERIFY_CACHE_TTL_MS;
  }

  async markEmailVerified(uid: string): Promise<void> {
    const { error } = await this.supabaseClient.auth.admin.updateUserById(uid, {
      email_confirm: true,
    });
    if (error) {
      throw new Error(`Failed to mark email verified: ${error.message}`);
    }
  }
}
