import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string;
  read: boolean;
  createdAt: string;
};

type NotifRow = {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string;
  read: boolean;
  created_at: string;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly supabase: SupabaseService) {}

  private get db() {
    return this.supabase.client;
  }

  private map(row: NotifRow): NotificationItem {
    return {
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      link: row.link,
      read: row.read,
      createdAt: row.created_at,
    };
  }

  async getNotifications(uid: string, limit = 30): Promise<NotificationItem[]> {
    const { data, error } = await this.db
      .from('notifications')
      .select('id, type, title, body, link, read, created_at')
      .eq('uid', uid)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`Failed to fetch notifications: ${error.message}`);
    return (data ?? []).map((r) => this.map(r as NotifRow));
  }

  async getUnreadCount(uid: string): Promise<number> {
    const { count, error } = await this.db
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('uid', uid)
      .eq('read', false);

    if (error) throw new Error(`Failed to count notifications: ${error.message}`);
    return count ?? 0;
  }

  async markRead(uid: string, id: string): Promise<void> {
    const { error } = await this.db
      .from('notifications')
      .update({ read: true })
      .eq('uid', uid)
      .eq('id', id);

    if (error) throw new Error(`Failed to mark notification read: ${error.message}`);
  }

  async markAllRead(uid: string): Promise<void> {
    const { error } = await this.db
      .from('notifications')
      .update({ read: true })
      .eq('uid', uid)
      .eq('read', false);

    if (error) throw new Error(`Failed to mark all notifications read: ${error.message}`);
  }

  async createNotification(
    uid: string,
    data: { type: string; title: string; body: string; link: string },
  ): Promise<void> {
    const { error } = await this.db.from('notifications').insert({
      uid,
      type: data.type,
      title: data.title,
      body: data.body ?? '',
      link: data.link ?? '',
    });

    if (error) throw new Error(`Failed to create notification: ${error.message}`);
    this.logger.log(`Notification created for user ${uid}: ${data.type}`);
  }
}
