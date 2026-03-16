import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { SupabaseAuthUser } from '../auth/auth.types';

@Injectable()
export class SupabaseService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseService.name);
  private supabaseClient!: SupabaseClient;

  onModuleInit() {
    const url = (process.env.SUPABASE_URL ?? '').trim();
    const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();

    if (!url || !serviceRoleKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
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
    const { data, error } = await this.supabaseClient.auth.getUser(accessToken);
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
      name: typeof metadata['full_name'] === 'string'
        ? metadata['full_name']
        : (typeof metadata['name'] === 'string' ? metadata['name'] : null),
      picture: typeof metadata['avatar_url'] === 'string'
        ? metadata['avatar_url']
        : (typeof metadata['picture'] === 'string' ? metadata['picture'] : null),
      providers,
    };
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
