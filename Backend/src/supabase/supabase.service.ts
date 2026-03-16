import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export type SupabaseUser = {
  uid: string;
  email?: string;
  name?: string;
  picture?: string;
  app_metadata?: Record<string, any>;
  user_metadata?: Record<string, any>;
};

@Injectable()
export class SupabaseService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseService.name);
  private adminClient: SupabaseClient;

  onModuleInit() {
    const url = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceKey) {
      throw new Error(
        'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment variables',
      );
    }

    this.adminClient = createClient(url, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    this.logger.log(`Supabase Admin initialized — URL: ${url}`);
  }

  /** The admin (service-role) client — bypasses RLS, full access. */
  get client(): SupabaseClient {
    return this.adminClient;
  }

  /** Verify a Supabase access token and return the user. */
  async verifyToken(accessToken: string): Promise<SupabaseUser> {
    const { data, error } = await this.adminClient.auth.getUser(accessToken);
    if (error || !data?.user) {
      throw new Error(error?.message ?? 'Invalid token');
    }
    const u = data.user;
    return {
      uid: u.id,
      email: u.email,
      name:
        (u.user_metadata?.full_name as string) ??
        (u.user_metadata?.name as string) ??
        undefined,
      picture:
        (u.user_metadata?.avatar_url as string) ??
        (u.user_metadata?.picture as string) ??
        undefined,
      app_metadata: u.app_metadata,
      user_metadata: u.user_metadata,
    };
  }

  /** Look up a user by email via admin auth API. Returns null if not found. */
  async getUserByEmail(email: string) {
    const { data, error } = await this.adminClient.auth.admin.listUsers();
    if (error) throw error;
    return data.users.find((u) => u.email === email) ?? null;
  }
}
