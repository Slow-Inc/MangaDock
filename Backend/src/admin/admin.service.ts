import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { ROLE } from '../users/users.service';

// ── Shared types ──────────────────────────────────────────────────────────────

export interface AdminStats {
  totalUsers: number;
  newUsersToday: number;
  activePosts: number;
  transactionsToday: { count: number; coinSum: number };
  recentBans: Array<{ uid: string; displayName: string; bannedAt: string }>;
}

export interface AdminUser {
  uid: string;
  email: string;
  displayName: string;
  role: number;
  plan: string;
  trustScore: number;
  joinedAt: string;
  banned: boolean;
  bannedAt: string | null;
}

export interface AdminUserDetail extends AdminUser {
  ratingAvg: number;
  walletBalance: number;
  postCount: number;
}

export interface AdminPost {
  id: string;
  title: string;
  authorUid: string;
  authorName: string;
  category: string;
  createdAt: string;
  pinned: boolean;
  commentCount: number;
}

export interface AdminTransaction {
  id: string;
  uid: string;
  type: string;
  amount: number;
  balanceAfter: number;
  description: string;
  referenceId: string | null;
  createdAt: string;
}

export interface AdminListUsersQuery {
  page?: number;
  limit?: number;
  search?: string;
  role?: number;
  plan?: string;
  banned?: boolean;
}

export interface AdminListPostsQuery {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  authorUid?: string;
}

export interface AdminListTxQuery {
  page?: number;
  limit?: number;
  uid?: string;
  type?: string;
  from?: string;
  to?: string;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private readonly supabase: SupabaseService) {}

  private get db() {
    return this.supabase.client;
  }

  // ── Overview ────────────────────────────────────────────────────────────────

  async getStats(): Promise<AdminStats> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString();

    const [totalRes, newTodayRes, postsRes, txRes, bansRes] = await Promise.all(
      [
        this.db.from('profiles').select('*', { count: 'exact', head: true }),
        this.db
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', todayIso),
        this.db
          .from('forum_posts')
          .select('*', { count: 'exact', head: true })
          .is('deleted_at', null),
        this.db
          .from('wallet_transactions')
          .select('amount')
          .gte('created_at', todayIso),
        this.db
          .from('profiles')
          .select('uid, display_name, banned_at')
          .not('banned_at', 'is', null)
          .order('banned_at', { ascending: false })
          .limit(10),
      ],
    );

    const txData: Array<{ amount: number }> = txRes.data ?? [];

    return {
      totalUsers: totalRes.count ?? 0,
      newUsersToday: newTodayRes.count ?? 0,
      activePosts: postsRes.count ?? 0,
      transactionsToday: {
        count: txData.length,
        coinSum: txData.reduce((s, t) => s + (t.amount ?? 0), 0),
      },
      recentBans: (bansRes.data ?? []).map((r: any) => ({
        uid: r.uid,
        displayName: r.display_name ?? '',
        bannedAt: r.banned_at,
      })),
    };
  }

  // ── Users ────────────────────────────────────────────────────────────────────

  async listUsers(
    q: AdminListUsersQuery,
  ): Promise<{ users: AdminUser[]; total: number }> {
    const page = Math.max(1, q.page ?? 1);
    const limit = Math.min(100, Math.max(1, q.limit ?? 20));
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = this.db
      .from('profiles')
      .select(
        'uid, email, display_name, role, plan, trust_score, created_at, banned_at',
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })
      .range(from, to);

    if (q.search) {
      query = query.or(
        `email.ilike.%${q.search}%,display_name.ilike.%${q.search}%`,
      );
    }
    if (q.role !== undefined) query = query.eq('role', q.role);
    if (q.plan) query = query.eq('plan', q.plan);
    if (q.banned === true) query = query.not('banned_at', 'is', null);
    if (q.banned === false) query = query.is('banned_at', null);

    const { data, count, error } = await query;
    if (error)
      throw new InternalServerErrorException(
        `Failed to list users: ${error.message}`,
      );

    return {
      users: (data ?? []).map((r: any) => this.mapUser(r)),
      total: count ?? 0,
    };
  }

  async getUserDetail(uid: string): Promise<AdminUserDetail> {
    const [profileRes, walletRes, postCountRes] = await Promise.all([
      this.db
        .from('profiles')
        .select(
          'uid, email, display_name, role, plan, trust_score, rating_avg, created_at, banned_at',
        )
        .eq('uid', uid)
        .maybeSingle<any>(),
      this.db
        .from('wallets')
        .select('balance')
        .eq('uid', uid)
        .maybeSingle<{ balance: number }>(),
      this.db
        .from('forum_posts')
        .select('*', { count: 'exact', head: true })
        .eq('author_uid', uid)
        .is('deleted_at', null),
    ]);

    if (!profileRes.data) throw new NotFoundException('User not found');

    return {
      ...this.mapUser(profileRes.data),
      ratingAvg: profileRes.data.rating_avg ?? 0,
      walletBalance: walletRes.data?.balance ?? 0,
      postCount: postCountRes.count ?? 0,
    };
  }

  async changeRole(
    adminUid: string,
    targetUid: string,
    role: number,
  ): Promise<void> {
    if (role >= ROLE.ADMIN) {
      throw new BadRequestException(
        'Cannot set role to ADMIN or higher via this endpoint',
      );
    }

    const { data: target } = await this.db
      .from('profiles')
      .select('role')
      .eq('uid', targetUid)
      .maybeSingle<{ role: number }>();

    if (!target) throw new NotFoundException('User not found');
    if (target.role >= ROLE.ADMIN) {
      throw new ForbiddenException(
        'Cannot modify users with ADMIN role or higher',
      );
    }

    const fromRole = target.role;

    const { error } = await this.db
      .from('profiles')
      .update({ role })
      .eq('uid', targetUid);
    if (error)
      throw new InternalServerErrorException(
        `Failed to change role: ${error.message}`,
      );

    this.logger.warn(
      `Admin ${adminUid} changed role of ${targetUid} to ${role}`,
    );
    void this.logAudit(adminUid, 'change_role', 'user', targetUid, undefined, {
      from: fromRole,
      to: role,
    });
  }

  async banUser(adminUid: string, targetUid: string): Promise<void> {
    const { data: target } = await this.db
      .from('profiles')
      .select('role')
      .eq('uid', targetUid)
      .maybeSingle<{ role: number }>();

    if (!target) throw new NotFoundException('User not found');
    if (target.role >= ROLE.ADMIN) {
      throw new ForbiddenException(
        'Cannot ban users with ADMIN role or higher',
      );
    }

    const { error: authError } =
      await this.supabase.client.auth.admin.updateUserById(targetUid, {
        ban_duration: '876600h',
      });
    if (authError)
      throw new InternalServerErrorException(
        `Failed to ban user: ${authError.message}`,
      );

    const { error } = await this.db
      .from('profiles')
      .update({ banned_at: new Date().toISOString() })
      .eq('uid', targetUid);
    if (error)
      throw new InternalServerErrorException(
        `Failed to record ban: ${error.message}`,
      );

    this.logger.warn(`Admin ${adminUid} banned user ${targetUid}`);
    void this.logAudit(adminUid, 'ban_user', 'user', targetUid);
  }

  async unbanUser(adminUid: string, targetUid: string): Promise<void> {
    const { error: authError } =
      await this.supabase.client.auth.admin.updateUserById(targetUid, {
        ban_duration: 'none',
      });
    if (authError)
      throw new InternalServerErrorException(
        `Failed to unban user: ${authError.message}`,
      );

    const { error } = await this.db
      .from('profiles')
      .update({ banned_at: null })
      .eq('uid', targetUid);
    if (error)
      throw new InternalServerErrorException(
        `Failed to clear ban: ${error.message}`,
      );

    this.logger.warn(`Admin ${adminUid} unbanned user ${targetUid}`);
    void this.logAudit(adminUid, 'unban_user', 'user', targetUid);
  }

  async adjustWallet(
    adminUid: string,
    targetUid: string,
    delta: number,
    reason: string,
  ): Promise<{ balance: number }> {
    if (delta === 0) throw new BadRequestException('Delta must be non-zero');

    const rpcName = delta > 0 ? 'add_coins_atomic' : 'spend_coins_atomic';

    const { data, error } = await this.db.rpc(rpcName, {
      p_uid: targetUid,
      p_amount: Math.abs(delta),
      p_type: delta > 0 ? 'topup' : 'purchase',
      p_description: reason,
      p_reference_id: null,
    });

    if (error) {
      if (error.message?.includes('INSUFFICIENT_FUNDS')) {
        throw new BadRequestException('Insufficient funds');
      }
      throw new InternalServerErrorException(
        `Failed to adjust wallet: ${error.message}`,
      );
    }

    const balance: number = data?.balance ?? 0;
    this.logger.warn(
      `Admin ${adminUid} adjusted wallet of ${targetUid} by ${delta > 0 ? '+' : ''}${delta}: "${reason}" → balance ${balance}`,
    );
    return { balance };
  }

  // ── Content ──────────────────────────────────────────────────────────────────

  async listPosts(
    q: AdminListPostsQuery,
  ): Promise<{ posts: AdminPost[]; total: number }> {
    const page = Math.max(1, q.page ?? 1);
    const limit = Math.min(100, Math.max(1, q.limit ?? 20));
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = this.db
      .from('forum_posts')
      .select(
        'id, title, author_uid, category, created_at, pinned, author:profiles(display_name), comments:forum_comments(count)',
        { count: 'exact' },
      )
      .is('deleted_at', null)
      .is('comments.deleted_at', null)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (q.search) {
      query = query.or(`title.ilike.%${q.search}%,content.ilike.%${q.search}%`);
    }
    if (q.category) query = query.eq('category', q.category);
    if (q.authorUid) query = query.eq('author_uid', q.authorUid);

    const { data, count, error } = await query;
    if (error)
      throw new InternalServerErrorException(
        `Failed to list posts: ${error.message}`,
      );

    return {
      posts: (data ?? []).map((p: any) => ({
        id: p.id,
        title: p.title,
        authorUid: p.author_uid,
        authorName: p.author?.display_name ?? '',
        category: p.category,
        createdAt: p.created_at,
        pinned: p.pinned ?? false,
        commentCount: p.comments?.[0]?.count ?? 0,
      })),
      total: count ?? 0,
    };
  }

  async adminDeletePost(adminUid: string, id: string): Promise<void> {
    const { data: existing } = await this.db
      .from('forum_posts')
      .select('id')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle<{ id: string }>();

    if (!existing) throw new NotFoundException('Post not found');

    const { error } = await this.db
      .from('forum_posts')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error)
      throw new InternalServerErrorException(
        `Failed to delete post: ${error.message}`,
      );
    this.logger.warn(`Admin ${adminUid} deleted post ${id}`);
    void this.logAudit(adminUid, 'delete_post', 'post', id);
  }

  async pinPost(id: string, pinned: boolean): Promise<void> {
    const { error } = await this.db
      .from('forum_posts')
      .update({ pinned })
      .eq('id', id)
      .is('deleted_at', null);

    if (error)
      throw new InternalServerErrorException(
        `Failed to update pin: ${error.message}`,
      );
  }

  // ── Transactions ─────────────────────────────────────────────────────────────

  async listTransactions(
    q: AdminListTxQuery,
  ): Promise<{ transactions: AdminTransaction[]; total: number }> {
    const page = Math.max(1, q.page ?? 1);
    const limit = Math.min(100, Math.max(1, q.limit ?? 20));
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = this.db
      .from('wallet_transactions')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (q.uid) query = query.eq('uid', q.uid);
    if (q.type) query = query.eq('type', q.type);
    if (q.from) query = query.gte('created_at', q.from);
    if (q.to) query = query.lte('created_at', q.to);

    const { data, count, error } = await query;
    if (error)
      throw new InternalServerErrorException(
        `Failed to list transactions: ${error.message}`,
      );

    return {
      transactions: (data ?? []).map((r: any) => this.mapTransaction(r)),
      total: count ?? 0,
    };
  }

  async getTransaction(id: string): Promise<AdminTransaction> {
    const { data, error } = await this.db
      .from('wallet_transactions')
      .select('*')
      .eq('id', id)
      .maybeSingle<any>();

    if (error)
      throw new InternalServerErrorException(
        `Failed to get transaction: ${error.message}`,
      );
    if (!data) throw new NotFoundException('Transaction not found');

    return this.mapTransaction(data);
  }

  // ── Audit log ────────────────────────────────────────────────────────────────

  async getAuditLogs(opts: {
    limit: number;
    offset: number;
    action?: string;
    actorUid?: string;
  }) {
    let query = this.db
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .range(opts.offset, opts.offset + opts.limit - 1);

    if (opts.action) query = query.eq('action', opts.action);
    if (opts.actorUid) query = query.eq('actor_uid', opts.actorUid);

    const { data, error } = await query;
    if (error)
      throw new InternalServerErrorException(
        `Failed to fetch audit logs: ${error.message}`,
      );
    return data ?? [];
  }

  /**
   * Insert an entry into audit_logs.
   * Signature matches UsersService.logAuditEvent so callers can use either.
   * Errors are swallowed — a logging failure must never break the caller.
   */
  async logAudit(
    actorUid: string,
    action: string,
    targetType?: string,
    targetId?: string,
    ip?: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    try {
      const { error } = await this.db.from('audit_logs').insert({
        actor_uid: actorUid,
        action,
        target_type: targetType ?? null,
        target_id: targetId ?? null,
        ip: ip ?? null,
        metadata: metadata ?? null,
      });
      if (error) {
        this.logger.warn(`[AuditLog] insert failed: ${error.message}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`[AuditLog] unexpected error: ${msg}`);
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private mapUser(r: any): AdminUser {
    return {
      uid: r.uid,
      email: r.email ?? '',
      displayName: r.display_name ?? '',
      role: r.role ?? 0,
      plan: r.plan ?? 'free',
      trustScore: r.trust_score ?? 0,
      joinedAt: r.created_at,
      banned: r.banned_at != null,
      bannedAt: r.banned_at ?? null,
    };
  }

  private mapTransaction(r: any): AdminTransaction {
    return {
      id: r.id,
      uid: r.uid,
      type: r.type,
      amount: r.amount,
      balanceAfter: r.balance_after,
      description: r.description ?? '',
      referenceId: r.reference_id ?? null,
      createdAt: r.created_at,
    };
  }
}
