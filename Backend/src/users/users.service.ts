import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import * as fs from 'fs';
import * as path from 'path';

export type UserRole = 'user' | 'translator' | 'creator' | 'admin';
export type UserPlan = 'free' | 'premium' | 'pro';

export type FavoriteItem = {
  id: string;
  title: string;
  thumbnail: string;
  addedAt: string | Date;
  authors?: string[];
  description?: string;
  categories?: string[];
  publishedDate?: string;
  averageRating?: number;
  ratingsCount?: number;
};

export type UserProfile = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: UserRole;
  plan: UserPlan;
  trustScore: number;
  ratingAvg: number;
  ratingCount: number;
  country: string | null;
  preferredLanguage: string | null;
  bio: string | null;
  translatorLanguages: string[];
  favorites: FavoriteItem[];
};

export type PublicTranslatorProfile = {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
  bio: string | null;
  translatorLanguages: string[];
  trustScore: number;
  ratingAvg: number;
  ratingCount: number;
  country: string | null;
};

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly supabase: SupabaseService) {}

  private get db() {
    return this.supabase.client;
  }

  /** Upsert user profile on login. displayName and photoURL are NEVER overwritten on existing docs. */
  async upsertUser(uid: string, data: { email?: string; displayName?: string; photoURL?: string }) {
    const { data: existing } = await this.db
      .from('profiles')
      .select('*')
      .eq('uid', uid)
      .single();

    if (!existing) {
      const { error } = await this.db.from('profiles').insert({
        uid,
        email: data.email ?? null,
        display_name: data.displayName ?? null,
        photo_url: data.photoURL ?? null,
        role: 'user',
        plan: 'free',
        trust_score: 0,
        rating_avg: 0,
        rating_count: 0,
        country: null,
        preferred_language: null,
        bio: null,
        translator_languages: [],
        photo_history: [],
      });
      if (error) throw new BadRequestException(error.message);
      this.logger.log(`Created user: ${uid}`);
    } else {
      const update: Record<string, any> = {
        email: data.email ?? null,
        updated_at: new Date().toISOString(),
      };
      if (!existing.display_name && data.displayName) {
        update.display_name = data.displayName;
      }
      if (!existing.photo_url && data.photoURL) {
        update.photo_url = data.photoURL;
      }
      const { error } = await this.db.from('profiles').update(update).eq('uid', uid);
      if (error) throw new BadRequestException(error.message);
      this.logger.log(`Upserted user (profile preserved): ${uid}`);
    }
  }

  /** Explicitly update the user's display name and/or photo URL. */
  async updateUserProfile(uid: string, data: { displayName?: string; photoURL?: string }) {
    const update: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (data.displayName !== undefined) update.display_name = data.displayName;
    if (data.photoURL !== undefined) update.photo_url = data.photoURL;
    const { error } = await this.db.from('profiles').update(update).eq('uid', uid);
    if (error) throw new BadRequestException(error.message);
    this.logger.log(`Updated profile for user: ${uid}`);
  }

  async getProfile(uid: string): Promise<UserProfile> {
    const { data: row, error } = await this.db
      .from('profiles')
      .select('*')
      .eq('uid', uid)
      .single();

    if (error || !row) throw new NotFoundException('User not found');

    const { data: favRows } = await this.db
      .from('favorites')
      .select('*')
      .eq('uid', uid)
      .order('added_at', { ascending: false });

    const favorites: FavoriteItem[] = (favRows ?? []).map((f: any) => ({
      id: f.item_id,
      title: f.title,
      thumbnail: f.thumbnail ?? '',
      authors: f.authors ?? [],
      description: f.description ?? '',
      categories: f.categories ?? [],
      publishedDate: f.published_date ?? '',
      averageRating: f.average_rating ?? 0,
      ratingsCount: f.ratings_count ?? 0,
      addedAt: f.added_at,
    }));

    return {
      uid: row.uid,
      email: row.email ?? null,
      displayName: row.display_name ?? null,
      photoURL: row.photo_url ?? null,
      role: (row.role as UserRole) ?? 'user',
      plan: (row.plan as UserPlan) ?? 'free',
      trustScore: row.trust_score ?? 0,
      ratingAvg: row.rating_avg ?? 0,
      ratingCount: row.rating_count ?? 0,
      country: row.country ?? null,
      preferredLanguage: row.preferred_language ?? null,
      bio: row.bio ?? null,
      translatorLanguages: row.translator_languages ?? [],
      favorites,
    };
  }

  async addFavorite(uid: string, item: {
    id: string; title: string; thumbnail: string;
    authors?: string[]; description?: string; categories?: string[];
    publishedDate?: string; averageRating?: number; ratingsCount?: number;
  }) {
    if (!item.id) throw new BadRequestException('id is required');
    const { error } = await this.db.from('favorites').upsert({
      uid,
      item_id: item.id,
      title: item.title,
      thumbnail: item.thumbnail ?? '',
      authors: item.authors ?? [],
      description: item.description ?? '',
      categories: item.categories ?? [],
      published_date: item.publishedDate ?? '',
      average_rating: item.averageRating ?? 0,
      ratings_count: item.ratingsCount ?? 0,
      added_at: new Date().toISOString(),
    }, { onConflict: 'uid,item_id' });
    if (error) throw new BadRequestException(error.message);
    this.logger.log(`User ${uid} added favorite: ${item.id}`);
  }

  async removeFavorite(uid: string, itemId: string) {
    await this.db.from('favorites').delete().eq('uid', uid).eq('item_id', itemId);
    this.logger.log(`User ${uid} removed favorite: ${itemId}`);
  }

  async getFavorites(uid: string): Promise<FavoriteItem[]> {
    const { data: rows } = await this.db
      .from('favorites')
      .select('*')
      .eq('uid', uid)
      .order('added_at', { ascending: false });

    return (rows ?? []).map((f: any) => ({
      id: f.item_id,
      title: f.title,
      thumbnail: f.thumbnail ?? '',
      authors: f.authors ?? [],
      description: f.description ?? '',
      categories: f.categories ?? [],
      publishedDate: f.published_date ?? '',
      averageRating: f.average_rating ?? 0,
      ratingsCount: f.ratings_count ?? 0,
      addedAt: f.added_at,
    }));
  }

  async addLiked(uid: string, itemId: string) {
    if (!itemId) throw new BadRequestException('id is required');
    const { error } = await this.db.from('liked_items').upsert({
      uid,
      item_id: itemId,
      liked_at: new Date().toISOString(),
    }, { onConflict: 'uid,item_id' });
    if (error) throw new BadRequestException(error.message);
    this.logger.log(`User ${uid} liked: ${itemId}`);
  }

  async removeLiked(uid: string, itemId: string) {
    await this.db.from('liked_items').delete().eq('uid', uid).eq('item_id', itemId);
    this.logger.log(`User ${uid} unliked: ${itemId}`);
  }

  async getLiked(uid: string): Promise<string[]> {
    const { data: rows } = await this.db
      .from('liked_items')
      .select('item_id')
      .eq('uid', uid);
    return (rows ?? []).map((r: any) => r.item_id);
  }

  // -- Reading history
  async upsertHistoryItem(
    uid: string,
    item: {
      id: string; title: string; subtitle?: string; thumbnail: string;
      authors?: string[]; description?: string; publishedDate?: string;
      categories?: string[]; averageRating?: number; ratingsCount?: number;
      lastReadAt: number;
    },
  ) {
    const { error } = await this.db.from('reading_history').upsert({
      uid,
      item_id: item.id,
      title: item.title,
      subtitle: item.subtitle ?? '',
      thumbnail: item.thumbnail,
      authors: item.authors ?? [],
      description: item.description ?? '',
      published_date: item.publishedDate ?? '',
      categories: item.categories ?? [],
      average_rating: item.averageRating ?? 0,
      ratings_count: item.ratingsCount ?? 0,
      last_read_at: item.lastReadAt,
    }, { onConflict: 'uid,item_id' });
    if (error) throw new BadRequestException(error.message);
  }

  async removeHistoryItem(uid: string, itemId: string) {
    await this.db.from('reading_history').delete().eq('uid', uid).eq('item_id', itemId);
  }

  async clearHistory(uid: string) {
    await this.db.from('reading_history').delete().eq('uid', uid);
    this.logger.log(`Cleared history for user: ${uid}`);
  }

  async getHistory(uid: string) {
    const { data: rows } = await this.db
      .from('reading_history')
      .select('*')
      .eq('uid', uid)
      .order('last_read_at', { ascending: false })
      .limit(50);

    return (rows ?? []).map((r: any) => ({
      id: r.item_id,
      title: r.title,
      subtitle: r.subtitle,
      thumbnail: r.thumbnail,
      authors: r.authors,
      description: r.description,
      publishedDate: r.published_date,
      categories: r.categories,
      averageRating: r.average_rating,
      ratingsCount: r.ratings_count,
      lastReadAt: r.last_read_at,
    }));
  }

  // -- Photo history
  async getPhotoHistory(uid: string): Promise<string[]> {
    const { data: row } = await this.db
      .from('profiles')
      .select('photo_history')
      .eq('uid', uid)
      .single();

    if (!row) return [];
    return (row.photo_history as string[]) ?? [];
  }

  async updatePhotoHistory(uid: string, photos: string[]): Promise<void> {
    const isSocialCdn = (url: string) =>
      url.includes('lh3.googleusercontent.com') ||
      url.includes('fbcdn.net') ||
      url.includes('fbsbx.com');
    const socialUrls = photos.filter(isSocialCdn);
    const uploadedUrls = photos.filter(u => !isSocialCdn(u)).slice(0, 6);
    const sliced = [...socialUrls, ...uploadedUrls];

    const { error } = await this.db
      .from('profiles')
      .update({ photo_history: sliced })
      .eq('uid', uid);

    if (error) throw new BadRequestException(error.message);

    this.gcAvatars(uid, sliced).catch((err) =>
      this.logger.warn(`GC avatar failed for ${uid}: ${err?.message}`),
    );
  }

  /** Mark email as verified -- not needed for Supabase (handled by auth layer). */
  async markEmailVerified(_uid: string): Promise<void> {
    this.logger.log(`markEmailVerified called (no-op for Supabase)`);
  }

  /** Delete all user data (DB rows + avatar files on disk). */
  async deleteUserAccount(uid: string): Promise<void> {
    await this.db.from('favorites').delete().eq('uid', uid);
    await this.db.from('liked_items').delete().eq('uid', uid);
    await this.db.from('reading_history').delete().eq('uid', uid);
    await this.db.from('profiles').delete().eq('uid', uid);

    const avatarsDir = path.join(process.cwd(), 'uploads', 'avatars');
    if (fs.existsSync(avatarsDir)) {
      const files = fs.readdirSync(avatarsDir).filter((f) => f.startsWith(`${uid}_`));
      files.forEach((f) => fs.unlinkSync(path.join(avatarsDir, f)));
    }
    this.logger.log(`Deleted all data for user: ${uid}`);
  }

  private async gcAvatars(uid: string, referencedUrls: string[]): Promise<void> {
    const avatarsDir = path.join(process.cwd(), 'uploads', 'avatars');
    if (!fs.existsSync(avatarsDir)) return;

    const { data: row } = await this.db
      .from('profiles')
      .select('photo_url')
      .eq('uid', uid)
      .single();

    const currentPhotoURL: string = row?.photo_url ?? '';

    const referenced = new Set<string>();
    for (const url of [...referencedUrls, currentPhotoURL]) {
      if (url && url.includes('/uploads/avatars/')) {
        const filename = url.split('/uploads/avatars/').pop();
        if (filename) referenced.add(filename);
      }
    }

    const files = fs.readdirSync(avatarsDir).filter((f) => f.startsWith(`${uid}_`));
    for (const file of files) {
      if (!referenced.has(file)) {
        fs.unlinkSync(path.join(avatarsDir, file));
        this.logger.log(`GC: deleted orphaned avatar ${file}`);
      }
    }
  }

  // -- Translator / Creator roles

  async becomeTranslator(
    uid: string,
    data: { bio?: string; translatorLanguages?: string[] },
  ): Promise<void> {
    const { data: row, error } = await this.db
      .from('profiles')
      .select('role')
      .eq('uid', uid)
      .single();

    if (error || !row) throw new NotFoundException('User not found');
    const currentRole: UserRole = (row.role as UserRole) ?? 'user';
    const newRole: UserRole = currentRole === 'user' ? 'translator' : currentRole;
    const update: Record<string, any> = {
      role: newRole,
      updated_at: new Date().toISOString(),
    };
    if (data.bio !== undefined) update.bio = data.bio.trim().slice(0, 500);
    if (data.translatorLanguages !== undefined) {
      update.translator_languages = data.translatorLanguages.slice(0, 10);
    }
    await this.db.from('profiles').update(update).eq('uid', uid);
    this.logger.log(`User ${uid} became translator (role: ${newRole})`);
  }

  async updateTranslatorProfile(
    uid: string,
    data: { bio?: string; translatorLanguages?: string[]; country?: string; preferredLanguage?: string },
  ): Promise<void> {
    const { data: row, error } = await this.db
      .from('profiles')
      .select('role')
      .eq('uid', uid)
      .single();

    if (error || !row) throw new NotFoundException('User not found');
    const currentRole: UserRole = (row.role as UserRole) ?? 'user';
    if (currentRole === 'user') {
      throw new ForbiddenException('Only translators or creators can update translator profile');
    }
    const update: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (data.bio !== undefined) update.bio = data.bio.trim().slice(0, 500);
    if (data.translatorLanguages !== undefined) {
      update.translator_languages = data.translatorLanguages.slice(0, 10);
    }
    if (data.country !== undefined) update.country = data.country;
    if (data.preferredLanguage !== undefined) update.preferred_language = data.preferredLanguage;
    await this.db.from('profiles').update(update).eq('uid', uid);
    this.logger.log(`Translator profile updated for user: ${uid}`);
  }

  async getPublicTranslatorProfile(uid: string): Promise<PublicTranslatorProfile> {
    const { data: row, error } = await this.db
      .from('profiles')
      .select('*')
      .eq('uid', uid)
      .single();

    if (error || !row) throw new NotFoundException('User not found');
    const role: UserRole = (row.role as UserRole) ?? 'user';
    if (role !== 'translator' && role !== 'creator' && role !== 'admin') {
      throw new NotFoundException('Translator not found');
    }
    return {
      uid: row.uid,
      displayName: row.display_name ?? null,
      photoURL: row.photo_url ?? null,
      bio: row.bio ?? null,
      translatorLanguages: row.translator_languages ?? [],
      trustScore: row.trust_score ?? 0,
      ratingAvg: row.rating_avg ?? 0,
      ratingCount: row.rating_count ?? 0,
      country: row.country ?? null,
    };
  }
}
