import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as path from 'path';
import { SupabaseService } from '../supabase/supabase.service';
import { STORAGE_PROVIDER, type StorageProvider } from '../common/storage/storage-provider.interface';

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

type ProfileRow = {
  uid: string;
  email: string | null;
  display_name: string | null;
  photo_url: string | null;
  role: UserRole | null;
  plan: UserPlan | null;
  trust_score: number | null;
  rating_avg: number | null;
  rating_count: number | null;
  country: string | null;
  preferred_language: string | null;
  bio: string | null;
  translator_languages: string[] | null;
  photo_history: string[] | null;
};

type FavoriteRow = {
  manga_id: string;
  title: string;
  thumbnail: string;
  added_at: string;
  authors: string[] | null;
  description: string | null;
  categories: string[] | null;
  published_date: string | null;
  average_rating: number | null;
  ratings_count: number | null;
};

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly supabase: SupabaseService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  private get db() {
    return this.supabase.client;
  }

  private get avatarsDir() {
    return 'uploads/avatars';
  }

  private isNotFound(error: { code?: string } | null): boolean {
    return error?.code === 'PGRST116';
  }

  private mapFavorite(row: FavoriteRow): FavoriteItem {
    return {
      id: row.manga_id,
      title: row.title,
      thumbnail: row.thumbnail ?? '',
      addedAt: row.added_at,
      authors: row.authors ?? [],
      description: row.description ?? '',
      categories: row.categories ?? [],
      publishedDate: row.published_date ?? '',
      averageRating: row.average_rating ?? 0,
      ratingsCount: row.ratings_count ?? 0,
    };
  }

  private mapProfile(row: ProfileRow, favorites: FavoriteItem[]): UserProfile {
    return {
      uid: row.uid,
      email: row.email ?? null,
      displayName: row.display_name ?? null,
      photoURL: row.photo_url ?? null,
      role: row.role ?? 'user',
      plan: row.plan ?? 'free',
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

  async upsertUser(uid: string, data: { email?: string | null; displayName?: string | null; photoURL?: string | null }) {
    const now = new Date().toISOString();

    // Atomic create-if-missing (INSERT ... ON CONFLICT (uid) DO NOTHING). Removes the
    // read-then-write window that let concurrent logins race into a duplicate-key error.
    // Preserve-fields (role/plan/trust_score/…) rely on their NOT NULL column defaults.
    const { error: createError } = await this.db.from('profiles').upsert(
      {
        uid,
        email: data.email ?? null,
        display_name: data.displayName ?? null,
        photo_url: data.photoURL ?? null,
        created_at: now,
        updated_at: now,
      },
      { onConflict: 'uid', ignoreDuplicates: true },
    );
    if (createError) {
      throw new Error(`Failed to create user profile: ${createError.message}`);
    }

    // Refresh email on every login; each statement is idempotent so there is no race.
    const { error: emailError } = await this.db
      .from('profiles')
      .update({ email: data.email ?? null, updated_at: now })
      .eq('uid', uid);
    if (emailError) {
      throw new Error(`Failed to upsert user profile: ${emailError.message}`);
    }

    // Backfill display_name / photo_url only when still empty — never overwrite a value
    // the user already has. The `.is(col, null)` filter makes this a no-op otherwise.
    if (data.displayName) {
      const { error } = await this.db
        .from('profiles')
        .update({ display_name: data.displayName })
        .eq('uid', uid)
        .is('display_name', null);
      if (error) {
        throw new Error(`Failed to backfill display name: ${error.message}`);
      }
    }
    if (data.photoURL) {
      const { error } = await this.db
        .from('profiles')
        .update({ photo_url: data.photoURL })
        .eq('uid', uid)
        .is('photo_url', null);
      if (error) {
        throw new Error(`Failed to backfill photo URL: ${error.message}`);
      }
    }

    this.logger.log(`Upserted user (profile preserved): ${uid}`);
  }

  async updateUserProfile(uid: string, data: { displayName?: string; photoURL?: string }) {
    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (data.displayName !== undefined) update['display_name'] = data.displayName;
    if (data.photoURL !== undefined) update['photo_url'] = data.photoURL;

    const { error } = await this.db.from('profiles').update(update).eq('uid', uid);
    if (error) {
      throw new Error(`Failed to update user profile: ${error.message}`);
    }
    this.logger.log(`Updated profile for user: ${uid}`);
  }

  async getProfile(uid: string): Promise<UserProfile> {
    // The profile and favorites lookups are independent — run them in parallel.
    const [
      { data: profile, error: profileError },
      { data: favoritesRows, error: favoritesError },
    ] = await Promise.all([
      this.db.from('profiles').select('*').eq('uid', uid).maybeSingle<ProfileRow>(),
      this.db.from('user_favorites').select('*').eq('uid', uid).order('added_at', { ascending: false }),
    ]);

    if (profileError && !this.isNotFound(profileError)) {
      throw new Error(`Failed to fetch profile: ${profileError.message}`);
    }
    if (!profile) {
      throw new NotFoundException('User not found');
    }
    if (favoritesError) {
      throw new Error(`Failed to fetch favorites: ${favoritesError.message}`);
    }

    const favorites = (favoritesRows ?? []).map((row) => this.mapFavorite(row as FavoriteRow));
    return this.mapProfile(profile, favorites);
  }

  async addFavorite(uid: string, item: {
    id: string; title: string; thumbnail: string;
    authors?: string[]; description?: string; categories?: string[];
    publishedDate?: string; averageRating?: number; ratingsCount?: number;
  }) {
    if (!item.id) throw new BadRequestException('id is required');

    const { error } = await this.db.from('user_favorites').upsert({
      uid,
      manga_id: item.id,
      title: item.title,
      thumbnail: item.thumbnail ?? '',
      authors: item.authors ?? [],
      description: item.description ?? '',
      categories: item.categories ?? [],
      published_date: item.publishedDate ?? '',
      average_rating: item.averageRating ?? 0,
      ratings_count: item.ratingsCount ?? 0,
      added_at: new Date().toISOString(),
    }, {
      onConflict: 'uid,manga_id',
    });

    if (error) {
      throw new Error(`Failed to add favorite: ${error.message}`);
    }
    this.logger.log(`User ${uid} added favorite: ${item.id}`);
  }

  async removeFavorite(uid: string, itemId: string) {
    const { error } = await this.db
      .from('user_favorites')
      .delete()
      .eq('uid', uid)
      .eq('manga_id', itemId);

    if (error) {
      throw new Error(`Failed to remove favorite: ${error.message}`);
    }
    this.logger.log(`User ${uid} removed favorite: ${itemId}`);
  }

  async getFavorites(uid: string): Promise<FavoriteItem[]> {
    const { data, error } = await this.db
      .from('user_favorites')
      .select('*')
      .eq('uid', uid)
      .order('added_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch favorites: ${error.message}`);
    }

    return (data ?? []).map((row) => this.mapFavorite(row as FavoriteRow));
  }

  async addLiked(uid: string, itemId: string) {
    if (!itemId) throw new BadRequestException('id is required');

    const { error } = await this.db.from('user_liked').upsert({
      uid,
      manga_id: itemId,
      liked_at: new Date().toISOString(),
    }, {
      onConflict: 'uid,manga_id',
    });

    if (error) {
      throw new Error(`Failed to add liked item: ${error.message}`);
    }
    this.logger.log(`User ${uid} liked: ${itemId}`);
  }

  async removeLiked(uid: string, itemId: string) {
    const { error } = await this.db
      .from('user_liked')
      .delete()
      .eq('uid', uid)
      .eq('manga_id', itemId);

    if (error) {
      throw new Error(`Failed to remove liked item: ${error.message}`);
    }
    this.logger.log(`User ${uid} unliked: ${itemId}`);
  }

  async getLiked(uid: string): Promise<string[]> {
    const { data, error } = await this.db
      .from('user_liked')
      .select('manga_id')
      .eq('uid', uid);

    if (error) {
      throw new Error(`Failed to fetch liked items: ${error.message}`);
    }

    return (data ?? []).map((row) => String((row as { manga_id: string }).manga_id));
  }

  async upsertHistoryItem(
    uid: string,
    item: {
      id: string; title: string; subtitle?: string; thumbnail: string;
      authors?: string[]; description?: string; publishedDate?: string;
      categories?: string[]; averageRating?: number; ratingsCount?: number;
      lastReadAt: number;
      lastPage?: number | null;
      lastChapterId?: string | null;
    },
  ) {
    const { error } = await this.db.from('user_history').upsert({
      uid,
      manga_id: item.id,
      title: item.title ?? '',
      subtitle: item.subtitle ?? '',
      thumbnail: item.thumbnail ?? '',
      authors: item.authors ?? [],
      description: item.description ?? '',
      published_date: item.publishedDate ?? '',
      categories: item.categories ?? [],
      average_rating: item.averageRating ?? 0,
      ratings_count: item.ratingsCount ?? 0,
      last_read_at: item.lastReadAt ?? Date.now(),
      last_page: item.lastPage ?? null,
      last_chapter_id: item.lastChapterId ?? null,
    }, {
      onConflict: 'uid,manga_id',
    });

    if (error) {
      throw new Error(`Failed to upsert history item: ${error.message}`);
    }
  }

  async removeHistoryItem(uid: string, itemId: string) {
    const { error } = await this.db
      .from('user_history')
      .delete()
      .eq('uid', uid)
      .eq('manga_id', itemId);

    if (error) {
      throw new Error(`Failed to remove history item: ${error.message}`);
    }
  }

  async clearHistory(uid: string) {
    const { error } = await this.db
      .from('user_history')
      .delete()
      .eq('uid', uid);

    if (error) {
      throw new Error(`Failed to clear history: ${error.message}`);
    }
    this.logger.log(`Cleared history for user: ${uid}`);
  }

  async getHistory(uid: string) {
    const { data, error } = await this.db
      .from('user_history')
      .select('*')
      .eq('uid', uid)
      .order('last_read_at', { ascending: false })
      .limit(50);

    if (error) {
      throw new Error(`Failed to fetch history: ${error.message}`);
    }

    return (data ?? []).map((row) => {
      const item = row as Record<string, unknown>;
      return {
        id: String(item['manga_id'] ?? ''),
        title: String(item['title'] ?? ''),
        subtitle: String(item['subtitle'] ?? ''),
        thumbnail: String(item['thumbnail'] ?? ''),
        authors: (item['authors'] as string[] | null) ?? [],
        description: String(item['description'] ?? ''),
        publishedDate: String(item['published_date'] ?? ''),
        categories: (item['categories'] as string[] | null) ?? [],
        averageRating: Number(item['average_rating'] ?? 0),
        ratingsCount: Number(item['ratings_count'] ?? 0),
        lastReadAt: Number(item['last_read_at'] ?? 0),
        lastPage: item['last_page'] != null ? Number(item['last_page']) : null,
        lastChapterId: item['last_chapter_id'] != null ? String(item['last_chapter_id']) : null,
      };
    });
  }

  async exportHistory(uid: string): Promise<string> {
    const { data, error } = await this.db
      .from('user_history')
      .select('title, subtitle, last_read_at')
      .eq('uid', uid)
      .order('last_read_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to export history: ${error.message}`);
    }

    // CSV-injection guard: prefix a leading '=', '+', '-', or '@' with a single
    // quote so spreadsheet apps treat the cell as text, not a formula. Escaping
    // (double the quotes) runs after, so the quoting stays intact.
    const escape = (v: unknown) => {
      const s = String(v ?? '');
      const guarded = /^[=+\-@]/.test(s) ? `'${s}` : s;
      return guarded.replace(/"/g, '""');
    };

    const rows = (data ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      return `"${escape(r['title'])}","${escape(r['subtitle'])}","${r['last_read_at'] != null ? new Date(Number(r['last_read_at'])).toISOString() : ''}"`;
    });

    return ['title,lastChapter,lastReadAt', ...rows].join('\r\n');
  }

  async getPhotoHistory(uid: string): Promise<string[]> {
    const { data, error } = await this.db
      .from('profiles')
      .select('photo_history')
      .eq('uid', uid)
      .maybeSingle<{ photo_history: string[] | null }>();

    if (error && !this.isNotFound(error)) {
      throw new Error(`Failed to fetch photo history: ${error.message}`);
    }
    if (!data) return [];
    return data.photo_history ?? [];
  }

  async updatePhotoHistory(uid: string, photos: string[]): Promise<void> {
    const isSocialCdn = (url: string) =>
      url.includes('lh3.googleusercontent.com') ||
      url.includes('fbcdn.net') ||
      url.includes('fbsbx.com');

    const socialUrls = photos.filter(isSocialCdn);
    const uploadedUrls = photos.filter((url) => !isSocialCdn(url)).slice(0, 6);
    const sliced = [...socialUrls, ...uploadedUrls];

    const { error } = await this.db
      .from('profiles')
      .update({
        photo_history: sliced,
        updated_at: new Date().toISOString(),
      })
      .eq('uid', uid);

    if (error) {
      throw new Error(`Failed to update photo history: ${error.message}`);
    }

    this.gcAvatars(uid, sliced).catch((err) =>
      this.logger.warn(`GC avatar failed for ${uid}: ${err?.message}`),
    );
  }

  async markEmailVerified(uid: string): Promise<void> {
    await this.supabase.markEmailVerified(uid);
    this.logger.log(`Marked email verified for user: ${uid}`);
  }

  async deleteUserAccount(uid: string): Promise<void> {
    // Child tables are independent of each other — delete them in parallel.
    // They FK-reference profiles(uid), so the parent row must be deleted AFTER them.
    const tables = ['user_favorites', 'user_liked', 'user_history'];
    const results = await Promise.all(
      tables.map((table) => this.db.from(table).delete().eq('uid', uid)),
    );
    results.forEach(({ error }, i) => {
      if (error) {
        throw new Error(`Failed to delete ${tables[i]}: ${error.message}`);
      }
    });

    const { error: profileError } = await this.db.from('profiles').delete().eq('uid', uid);
    if (profileError) {
      throw new Error(`Failed to delete profile: ${profileError.message}`);
    }

    const files = await this.storage.list(this.avatarsDir);
    const userFiles = files.filter((f) => f.startsWith(`${uid}_`));
    await Promise.all(
      userFiles.map((file) => this.storage.delete(`${this.avatarsDir}/${file}`)),
    );

    this.logger.log(`Deleted all data for user: ${uid}`);
  }

  private async gcAvatars(uid: string, referencedUrls: string[]): Promise<void> {
    const { data } = await this.db
      .from('profiles')
      .select('photo_url')
      .eq('uid', uid)
      .maybeSingle<{ photo_url: string | null }>();

    const currentPhotoURL = data?.photo_url ?? '';

    const referenced = new Set<string>();
    for (const url of [...referencedUrls, currentPhotoURL]) {
      if (url && url.includes('/uploads/avatars/')) {
        const filename = url.split('/uploads/avatars/').pop();
        if (filename) referenced.add(filename);
      }
    }

    const files = await this.storage.list(this.avatarsDir);
    const userFiles = files.filter((f) => f.startsWith(`${uid}_`));
    for (const file of userFiles) {
      if (!referenced.has(file)) {
        await this.storage.delete(`${this.avatarsDir}/${file}`);
        this.logger.log(`GC: deleted orphaned avatar ${file}`);
      }
    }
  }

  async becomeTranslator(
    uid: string,
    data: { bio?: string; translatorLanguages?: string[] },
  ): Promise<void> {
    const { data: existing, error: existingError } = await this.db
      .from('profiles')
      .select('role')
      .eq('uid', uid)
      .maybeSingle<{ role: UserRole | null }>();

    if (existingError) {
      throw new Error(`Failed to fetch user role: ${existingError.message}`);
    }
    if (!existing) throw new NotFoundException('User not found');

    const currentRole = existing.role ?? 'user';
    const newRole: UserRole = currentRole === 'user' ? 'translator' : currentRole;

    const update: Record<string, unknown> = {
      role: newRole,
      updated_at: new Date().toISOString(),
    };
    if (data.bio !== undefined) update['bio'] = data.bio.trim().slice(0, 500);
    if (data.translatorLanguages !== undefined) {
      update['translator_languages'] = data.translatorLanguages.slice(0, 10);
    }

    const { error } = await this.db.from('profiles').update(update).eq('uid', uid);
    if (error) {
      throw new Error(`Failed to update translator role: ${error.message}`);
    }

    this.logger.log(`User ${uid} became translator (role: ${newRole})`);
  }

  async updateTranslatorProfile(
    uid: string,
    data: { bio?: string; translatorLanguages?: string[]; country?: string; preferredLanguage?: string },
  ): Promise<void> {
    const { data: existing, error: existingError } = await this.db
      .from('profiles')
      .select('role')
      .eq('uid', uid)
      .maybeSingle<{ role: UserRole | null }>();

    if (existingError) {
      throw new Error(`Failed to fetch user role: ${existingError.message}`);
    }
    if (!existing) throw new NotFoundException('User not found');

    const currentRole = existing.role ?? 'user';
    if (currentRole === 'user') {
      throw new ForbiddenException('Only translators or creators can update translator profile');
    }

    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (data.bio !== undefined) update['bio'] = data.bio.trim().slice(0, 500);
    if (data.translatorLanguages !== undefined) {
      update['translator_languages'] = data.translatorLanguages.slice(0, 10);
    }
    if (data.country !== undefined) update['country'] = data.country;
    if (data.preferredLanguage !== undefined) update['preferred_language'] = data.preferredLanguage;

    const { error } = await this.db.from('profiles').update(update).eq('uid', uid);
    if (error) {
      throw new Error(`Failed to update translator profile: ${error.message}`);
    }

    this.logger.log(`Translator profile updated for user: ${uid}`);
  }

  async getPublicTranslatorProfile(uid: string): Promise<PublicTranslatorProfile> {
    const { data, error } = await this.db
      .from('profiles')
      .select('*')
      .eq('uid', uid)
      .maybeSingle<ProfileRow>();

    if (error && !this.isNotFound(error)) {
      throw new Error(`Failed to fetch public translator profile: ${error.message}`);
    }
    if (!data) {
      throw new NotFoundException('User not found');
    }

    const role = data.role ?? 'user';
    if (role !== 'translator' && role !== 'creator' && role !== 'admin') {
      throw new NotFoundException('Translator not found');
    }

    return {
      uid: data.uid,
      displayName: data.display_name ?? null,
      photoURL: data.photo_url ?? null,
      bio: data.bio ?? null,
      translatorLanguages: data.translator_languages ?? [],
      trustScore: data.trust_score ?? 0,
      ratingAvg: data.rating_avg ?? 0,
      ratingCount: data.rating_count ?? 0,
      country: data.country ?? null,
    };
  }
}
