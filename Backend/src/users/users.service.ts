import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

export type UserRole = 'user' | 'translator' | 'creator' | 'admin';
export type UserPlan = 'free' | 'premium' | 'pro';

export type FavoriteItem = {
  id: string;
  title: string;
  thumbnail: string;
  addedAt: admin.firestore.Timestamp | Date;
  // Extended book metadata
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

  constructor(private readonly firebase: FirebaseService) {}

  private userDoc(uid: string) {
    return this.firebase.firestore.collection('users').doc(uid);
  }

  /** Upsert user profile on login.
   * 
   * IMPORTANT: displayName and photoURL are NEVER overwritten on existing documents.
   * This prevents OAuth providers (Google, Facebook) from silently replacing the
   * user’s custom display name / profile photo every time they sign in.
   * Explicit profile changes go through updateUserProfile() instead.
   */
  async upsertUser(uid: string, data: { email?: string; displayName?: string; photoURL?: string }) {
    const ref = this.userDoc(uid);
    const snap = await ref.get();

    if (!snap.exists) {
      // First login — create the document with all provider-supplied fields
      await ref.set({
        uid,
        email: data.email ?? null,
        displayName: data.displayName ?? null,
        photoURL: data.photoURL ?? null,
        role: 'user',
        plan: 'free',
        trustScore: 0,
        ratingAvg: 0,
        ratingCount: 0,
        country: null,
        preferredLanguage: null,
        bio: null,
        translatorLanguages: [],
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      this.logger.log(`Created user: ${uid}`);
    } else {
      // Subsequent login — only sync the email address (it can change) and the
      // timestamp. displayName and photoURL are owned by the user, not the provider.
      // However, if they are currently null (e.g. old accounts created before a fix),
      // fill them in from the provider data as a one-time migration.
      const existing = snap.data()!;
      const update: Record<string, any> = {
        email: data.email ?? null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      if (!existing.displayName && data.displayName) {
        update.displayName = data.displayName;
      }
      if (!existing.photoURL && data.photoURL) {
        update.photoURL = data.photoURL;
      }
      await ref.update(update);
      this.logger.log(`Upserted user (profile preserved): ${uid}`);
    }
  }

  /** Explicitly update the user’s display name and/or photo URL.
   * Called when the user changes their profile in the app, not on every login.
   */
  async updateUserProfile(uid: string, data: { displayName?: string; photoURL?: string }) {
    const ref = this.userDoc(uid);
    const update: Record<string, any> = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (data.displayName !== undefined) update.displayName = data.displayName;
    if (data.photoURL !== undefined) update.photoURL = data.photoURL;
    await ref.update(update);
    this.logger.log(`Updated profile for user: ${uid}`);
  }

  async getProfile(uid: string): Promise<UserProfile> {
    const snap = await this.userDoc(uid).get();
    if (!snap.exists) throw new NotFoundException('User not found');
    const data = snap.data()!;

    const favsSnap = await this.userDoc(uid).collection('favorites').orderBy('addedAt', 'desc').get();
    const favorites: FavoriteItem[] = favsSnap.docs.map((d) => d.data() as FavoriteItem);

    return {
      uid: data['uid'],
      email: data['email'] ?? null,
      displayName: data['displayName'] ?? null,
      photoURL: data['photoURL'] ?? null,
      role: (data['role'] as UserRole) ?? 'user',
      plan: (data['plan'] as UserPlan) ?? 'free',
      trustScore: data['trustScore'] ?? 0,
      ratingAvg: data['ratingAvg'] ?? 0,
      ratingCount: data['ratingCount'] ?? 0,
      country: data['country'] ?? null,
      preferredLanguage: data['preferredLanguage'] ?? null,
      bio: data['bio'] ?? null,
      translatorLanguages: data['translatorLanguages'] ?? [],
      favorites,
    };
  }

  async addFavorite(uid: string, item: {
    id: string; title: string; thumbnail: string;
    authors?: string[]; description?: string; categories?: string[];
    publishedDate?: string; averageRating?: number; ratingsCount?: number;
  }) {
    if (!item.id) throw new BadRequestException('id is required');
    const ref = this.userDoc(uid).collection('favorites').doc(item.id);
    await ref.set({
      id: item.id,
      title: item.title,
      thumbnail: item.thumbnail ?? '',
      authors: item.authors ?? [],
      description: item.description ?? '',
      categories: item.categories ?? [],
      publishedDate: item.publishedDate ?? '',
      averageRating: item.averageRating ?? 0,
      ratingsCount: item.ratingsCount ?? 0,
      addedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    this.logger.log(`User ${uid} added favorite: ${item.id}`);
  }

  async removeFavorite(uid: string, itemId: string) {
    await this.userDoc(uid).collection('favorites').doc(itemId).delete();
    this.logger.log(`User ${uid} removed favorite: ${itemId}`);
  }

  async getFavorites(uid: string): Promise<FavoriteItem[]> {
    const snap = await this.userDoc(uid).collection('favorites').orderBy('addedAt', 'desc').get();
    return snap.docs.map((d) => d.data() as FavoriteItem);
  }

  async addLiked(uid: string, itemId: string) {
    if (!itemId) throw new BadRequestException('id is required');
    const ref = this.userDoc(uid).collection('liked').doc(itemId);
    await ref.set({
      id: itemId,
      likedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    this.logger.log(`User ${uid} liked: ${itemId}`);
  }

  async removeLiked(uid: string, itemId: string) {
    await this.userDoc(uid).collection('liked').doc(itemId).delete();
    this.logger.log(`User ${uid} unliked: ${itemId}`);
  }

  async getLiked(uid: string): Promise<string[]> {
    const snap = await this.userDoc(uid).collection('liked').get();
    return snap.docs.map((d) => d.id);
  }

  // ── Reading history ────────────────────────────────────────────────────────
  async upsertHistoryItem(
    uid: string,
    item: {
      id: string; title: string; subtitle?: string; thumbnail: string;
      authors?: string[]; description?: string; publishedDate?: string;
      categories?: string[]; averageRating?: number; ratingsCount?: number;
      lastReadAt: number;
    },
  ) {
    const ref = this.userDoc(uid).collection('history').doc(item.id);
    await ref.set({ ...item }, { merge: true });
  }

  async removeHistoryItem(uid: string, itemId: string) {
    await this.userDoc(uid).collection('history').doc(itemId).delete();
  }

  async clearHistory(uid: string) {
    const snap = await this.userDoc(uid).collection('history').get();
    const batch = this.firebase.firestore.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    this.logger.log(`Cleared history for user: ${uid}`);
  }

  async getHistory(uid: string) {
    const snap = await this.userDoc(uid)
      .collection('history')
      .orderBy('lastReadAt', 'desc')
      .limit(50)
      .get();
    return snap.docs.map((d) => d.data());
  }

  // ── Photo history ─────────────────────────────────────────────────────────
  async getPhotoHistory(uid: string): Promise<string[]> {
    const snap = await this.userDoc(uid).get();
    if (!snap.exists) return [];
    return (snap.data()!['photoHistory'] as string[]) ?? [];
  }

  async updatePhotoHistory(uid: string, photos: string[]): Promise<void> {
    // Social CDN URLs (FB, Google) must never be dropped by the slot limit —
    // Facebook badge detection relies entirely on finding fbcdn/fbsbx URL in history.
    const isSocialCdn = (url: string) =>
      url.includes('lh3.googleusercontent.com') ||
      url.includes('fbcdn.net') ||
      url.includes('fbsbx.com');
    const socialUrls = photos.filter(isSocialCdn);          // always kept (max 2 in practice)
    const uploadedUrls = photos.filter(u => !isSocialCdn(u)).slice(0, 6); // limit uploaded only
    const sliced = [...socialUrls, ...uploadedUrls];
    await this.userDoc(uid).set(
      { photoHistory: sliced },
      { merge: true },
    );
    // Fire-and-forget GC: delete any avatar files on disk that are no longer
    // referenced in this user's photo history or current photoURL.
    this.gcAvatars(uid, sliced).catch((err) =>
      this.logger.warn(`GC avatar failed for ${uid}: ${err?.message}`),
    );
  }

  /**
   * Mark the Firebase Auth user as emailVerified=true via Admin SDK.
   * Safe to call for social providers (Facebook) that have already verified
   * the email on their side — prevents Google "Trusted Provider" override.
   */
  async markEmailVerified(uid: string): Promise<void> {
    await this.firebase.auth.updateUser(uid, { emailVerified: true });
    this.logger.log(`Marked emailVerified=true for user: ${uid}`);
  }

  /** Delete all user data (Firestore docs + avatar files on disk). */
  async deleteUserAccount(uid: string): Promise<void> {
    // Delete subcollections first (Firestore doesn't auto-cascade)
    for (const col of ['favorites', 'liked', 'history']) {
      const snap = await this.userDoc(uid).collection(col).get();
      if (snap.docs.length > 0) {
        const batch = this.firebase.firestore.batch();
        snap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    }
    // Delete main user document
    await this.userDoc(uid).delete();
    // Delete all uploaded avatar files for this user
    const avatarsDir = path.join(process.cwd(), 'uploads', 'avatars');
    if (fs.existsSync(avatarsDir)) {
      const files = fs.readdirSync(avatarsDir).filter((f) => f.startsWith(`${uid}_`));
      files.forEach((f) => fs.unlinkSync(path.join(avatarsDir, f)));
    }
    this.logger.log(`Deleted all data for user: ${uid}`);
  }

  /**
   * Garbage-collects avatar files on disk for a specific user.
   * Deletes any file under uploads/avatars/ that starts with `uid_` but is
   * not referenced in the provided photo history OR the user's current photoURL
   * stored in Firestore.
   */
  private async gcAvatars(uid: string, referencedUrls: string[]): Promise<void> {
    const avatarsDir = path.join(process.cwd(), 'uploads', 'avatars');
    if (!fs.existsSync(avatarsDir)) return;

    // Also protect the user's current active photoURL (may not be in history yet)
    const snap = await this.userDoc(uid).get();
    const currentPhotoURL: string = snap.exists
      ? ((snap.data()!['photoURL'] as string) ?? '')
      : '';

    // Build set of filenames still in use
    const referenced = new Set<string>();
    for (const url of [...referencedUrls, currentPhotoURL]) {
      if (url && url.includes('/uploads/avatars/')) {
        const filename = url.split('/uploads/avatars/').pop();
        if (filename) referenced.add(filename);
      }
    }

    // Scan disk for files that belong to this user
    const files = fs.readdirSync(avatarsDir).filter((f) => f.startsWith(`${uid}_`));
    for (const file of files) {
      if (!referenced.has(file)) {
        fs.unlinkSync(path.join(avatarsDir, file));
        this.logger.log(`GC: deleted orphaned avatar ${file}`);
      }
    }
  }

  // ── Translator / Creator roles ────────────────────────────────────────────

  /** Upgrade the user's role to 'translator'. Idempotent — safe to call multiple times. */
  async becomeTranslator(
    uid: string,
    data: { bio?: string; translatorLanguages?: string[] },
  ): Promise<void> {
    const ref = this.userDoc(uid);
    const snap = await ref.get();
    if (!snap.exists) throw new NotFoundException('User not found');
    const current = snap.data()!;
    // Admins and creators keep their existing role; users are promoted to translator.
    const currentRole: UserRole = (current['role'] as UserRole) ?? 'user';
    const newRole: UserRole = currentRole === 'user' ? 'translator' : currentRole;
    const update: Record<string, any> = {
      role: newRole,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (data.bio !== undefined) update.bio = data.bio.trim().slice(0, 500);
    if (data.translatorLanguages !== undefined) {
      update.translatorLanguages = data.translatorLanguages.slice(0, 10);
    }
    await ref.update(update);
    this.logger.log(`User ${uid} became translator (role: ${newRole})`);
  }

  /** Update translator-specific profile fields (bio, languages). */
  async updateTranslatorProfile(
    uid: string,
    data: { bio?: string; translatorLanguages?: string[]; country?: string; preferredLanguage?: string },
  ): Promise<void> {
    const ref = this.userDoc(uid);
    const snap = await ref.get();
    if (!snap.exists) throw new NotFoundException('User not found');
    const currentRole: UserRole = (snap.data()!['role'] as UserRole) ?? 'user';
    if (currentRole === 'user') {
      throw new ForbiddenException('Only translators or creators can update translator profile');
    }
    const update: Record<string, any> = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (data.bio !== undefined) update.bio = data.bio.trim().slice(0, 500);
    if (data.translatorLanguages !== undefined) {
      update.translatorLanguages = data.translatorLanguages.slice(0, 10);
    }
    if (data.country !== undefined) update.country = data.country;
    if (data.preferredLanguage !== undefined) update.preferredLanguage = data.preferredLanguage;
    await ref.update(update);
    this.logger.log(`Translator profile updated for user: ${uid}`);
  }

  /** Return the public-facing translator profile (no PII). */
  async getPublicTranslatorProfile(uid: string): Promise<PublicTranslatorProfile> {
    const snap = await this.userDoc(uid).get();
    if (!snap.exists) throw new NotFoundException('User not found');
    const data = snap.data()!;
    const role: UserRole = (data['role'] as UserRole) ?? 'user';
    if (role !== 'translator' && role !== 'creator' && role !== 'admin') {
      throw new NotFoundException('Translator not found');
    }
    return {
      uid: data['uid'],
      displayName: data['displayName'] ?? null,
      photoURL: data['photoURL'] ?? null,
      bio: data['bio'] ?? null,
      translatorLanguages: data['translatorLanguages'] ?? [],
      trustScore: data['trustScore'] ?? 0,
      ratingAvg: data['ratingAvg'] ?? 0,
      ratingCount: data['ratingCount'] ?? 0,
      country: data['country'] ?? null,
    };
  }
}
