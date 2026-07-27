import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export type UserProfile = {
  uid: string;
  displayName: string | null;
  photoUrl: string | null;
};

type ProfileRow = { uid: string; display_name: string | null; photo_url: string | null };

@Injectable()
export class UserFollowsService {
  private readonly logger = new Logger(UserFollowsService.name);

  constructor(private readonly supabase: SupabaseService) {}

  private get db() {
    return this.supabase.client;
  }

  private mapProfile(row: ProfileRow): UserProfile {
    return { uid: row.uid, displayName: row.display_name, photoUrl: row.photo_url };
  }

  async follow(followerUid: string, followingUid: string): Promise<void> {
    if (followerUid === followingUid) return;
    const { error } = await this.db
      .from('user_follows')
      .upsert({ follower_uid: followerUid, following_uid: followingUid }, { onConflict: 'follower_uid,following_uid' });
    if (error) throw new Error(`Failed to follow: ${error.message}`);
    this.logger.log(`${followerUid} followed ${followingUid}`);
  }

  async unfollow(followerUid: string, followingUid: string): Promise<void> {
    const { error } = await this.db
      .from('user_follows')
      .delete()
      .eq('follower_uid', followerUid)
      .eq('following_uid', followingUid);
    if (error) throw new Error(`Failed to unfollow: ${error.message}`);
  }

  async isFollowing(followerUid: string, followingUid: string): Promise<boolean> {
    const { data } = await this.db
      .from('user_follows')
      .select('follower_uid')
      .eq('follower_uid', followerUid)
      .eq('following_uid', followingUid)
      .maybeSingle();
    return !!data;
  }

  async getFollowing(uid: string): Promise<UserProfile[]> {
    const { data, error } = await this.db
      .from('user_follows')
      .select('profiles!user_follows_following_uid_fkey(uid, display_name, photo_url)')
      .eq('follower_uid', uid)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to get following: ${error.message}`);
    return (data ?? [])
      .map((r) => (r as { profiles: ProfileRow | null }).profiles)
      .filter(Boolean)
      .map((p) => this.mapProfile(p as ProfileRow));
  }

  async getFollowers(uid: string): Promise<UserProfile[]> {
    const { data, error } = await this.db
      .from('user_follows')
      .select('profiles!user_follows_follower_uid_fkey(uid, display_name, photo_url)')
      .eq('following_uid', uid)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to get followers: ${error.message}`);
    return (data ?? [])
      .map((r) => (r as { profiles: ProfileRow | null }).profiles)
      .filter(Boolean)
      .map((p) => this.mapProfile(p as ProfileRow));
  }

  async getCounts(uid: string): Promise<{ followers: number; following: number }> {
    const [followersRes, followingRes] = await Promise.all([
      this.db.from('user_follows').select('follower_uid', { count: 'exact', head: true }).eq('following_uid', uid),
      this.db.from('user_follows').select('following_uid', { count: 'exact', head: true }).eq('follower_uid', uid),
    ]);
    return {
      followers: followersRes.count ?? 0,
      following: followingRes.count ?? 0,
    };
  }
}
