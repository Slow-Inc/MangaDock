import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import { FirebaseService } from '../firebase/firebase.service';
import type { ChapterVersion, VersionStatus } from './versions.types';

@Injectable()
export class VersionsService {
  private readonly logger = new Logger(VersionsService.name);

  constructor(private readonly firebase: FirebaseService) {}

  private get col() {
    return this.firebase.firestore.collection('chapterVersions');
  }

  /** Create a new chapter version (initially in draft state). */
  async createVersion(data: {
    titleId: string;
    titleName: string;
    titleAltName?: string;
    chapterId: string;
    chapterNumber: string;
    chapterTitle: string;
    language: string;
    translatorUid: string;
    translatorName: string | null;
    description?: string;
    priceCoins?: number;
  }): Promise<ChapterVersion> {
    if (!data.titleId || !data.chapterId || !data.language || !data.translatorUid) {
      throw new BadRequestException('titleId, chapterId, language, and translatorUid are required');
    }
    const ref = this.col.doc();
    const version: ChapterVersion = {
      versionId: ref.id,
      titleId: data.titleId,
      titleName: data.titleName ?? '',
      titleAltName: data.titleAltName ?? '',
      chapterId: data.chapterId,
      chapterNumber: data.chapterNumber ?? '',
      chapterTitle: data.chapterTitle ?? '',
      language: data.language,
      translatorUid: data.translatorUid,
      translatorName: data.translatorName ?? null,
      status: 'draft',
      pages: [],
      priceCoins: data.priceCoins ?? 0,
      qualityScore: 0,
      isDefault: false,
      description: data.description?.trim() ?? null,
      createdAt: admin.firestore.FieldValue.serverTimestamp() as unknown as FirebaseFirestore.Timestamp,
      updatedAt: admin.firestore.FieldValue.serverTimestamp() as unknown as FirebaseFirestore.Timestamp,
    };
    await ref.set(version);
    this.logger.log(`Created chapter version ${ref.id} for translator ${data.translatorUid}`);
    return { ...version, versionId: ref.id };
  }

  /** Get a single chapter version by ID. */
  async getVersion(versionId: string): Promise<ChapterVersion> {
    const snap = await this.col.doc(versionId).get();
    if (!snap.exists) throw new NotFoundException(`Chapter version ${versionId} not found`);
    return snap.data() as ChapterVersion;
  }

  /** List all published versions for a given title. */
  async listVersionsByTitle(titleId: string): Promise<ChapterVersion[]> {
    const snap = await this.col
      .where('titleId', '==', titleId)
      .where('status', '==', 'published')
      .get();
    return snap.docs.map((d) => d.data() as ChapterVersion).sort((a, b) => {
      // Sort by chapter number naturally (assuming strings like "1", "2", "2.1")
      const numA = parseFloat(a.chapterNumber) || 0;
      const numB = parseFloat(b.chapterNumber) || 0;
      return numA - numB;
    });
  }

  /** List all versions for a chapter (across languages and translators). */
  async listVersionsByChapter(chapterId: string): Promise<ChapterVersion[]> {
    const snap = await this.col
      .where('chapterId', '==', chapterId)
      .where('status', '==', 'published')
      .orderBy('qualityScore', 'desc')
      .get();
    return snap.docs.map((d) => d.data() as ChapterVersion);
  }

  /** List all versions created by a specific translator (all statuses — requires auth). */
  async listVersionsByTranslator(translatorUid: string): Promise<ChapterVersion[]> {
    const snap = await this.col
      .where('translatorUid', '==', translatorUid)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();
    return snap.docs.map((d) => d.data() as ChapterVersion);
  }

  /** List published versions for a translator, excluding page URLs (suitable for public display). */
  async listPublishedVersionsByTranslator(translatorUid: string): Promise<Omit<ChapterVersion, 'pages'>[]> {
    const snap = await this.col
      .where('translatorUid', '==', translatorUid)
      .where('status', '==', 'published')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();
    return snap.docs.map((d) => {
      const { pages: _pages, ...rest } = d.data() as ChapterVersion;
      return rest;
    });
  }

  /** Update the pages list of a draft version. */
  async setPages(versionId: string, translatorUid: string, pages: string[]): Promise<void> {
    const snap = await this.col.doc(versionId).get();
    if (!snap.exists) throw new NotFoundException(`Chapter version ${versionId} not found`);
    const ver = snap.data() as ChapterVersion;
    if (ver.translatorUid !== translatorUid) {
      throw new BadRequestException('You do not own this chapter version');
    }
    if (ver.status !== 'draft') {
      throw new BadRequestException('Pages can only be updated on draft versions');
    }
    await this.col.doc(versionId).update({
      pages,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  /** Change the status of a version (e.g. submit for moderation, publish, reject). */
  async updateStatus(versionId: string, translatorUid: string, status: VersionStatus): Promise<void> {
    const snap = await this.col.doc(versionId).get();
    if (!snap.exists) throw new NotFoundException(`Chapter version ${versionId} not found`);
    const ver = snap.data() as ChapterVersion;
    if (ver.translatorUid !== translatorUid) {
      throw new BadRequestException('You do not own this chapter version');
    }
    // Translators can only move draft -> published directly
    const allowedTransitions: Partial<Record<VersionStatus, VersionStatus[]>> = {
      draft: ['published'],
      rejected: ['draft'],
    };
    if (!allowedTransitions[ver.status]?.includes(status)) {
      throw new BadRequestException(`Cannot transition from ${ver.status} to ${status}`);
    }
    if (status === 'published' && ver.pages.length === 0) {
      throw new BadRequestException('Cannot publish a version with no pages');
    }
    await this.col.doc(versionId).update({
      status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    this.logger.log(`Version ${versionId} status → ${status}`);
  }

  /** Update metadata (description, priceCoins) on a draft version. */
  async updateMetadata(
    versionId: string,
    translatorUid: string,
    data: { description?: string; priceCoins?: number },
  ): Promise<void> {
    const snap = await this.col.doc(versionId).get();
    if (!snap.exists) throw new NotFoundException(`Chapter version ${versionId} not found`);
    const ver = snap.data() as ChapterVersion;
    if (ver.translatorUid !== translatorUid) {
      throw new BadRequestException('You do not own this chapter version');
    }
    if (ver.status !== 'draft') {
      throw new BadRequestException('Metadata can only be updated on draft versions');
    }
    const update: Record<string, any> = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (data.description !== undefined) update.description = data.description.trim().slice(0, 1000);
    if (data.priceCoins !== undefined) {
      if (data.priceCoins < 0) throw new BadRequestException('priceCoins cannot be negative');
      update.priceCoins = Math.floor(data.priceCoins);
    }
    await this.col.doc(versionId).update(update);
  }

  /** Delete a draft or rejected version and its uploaded pages on disk. */
  async deleteVersion(versionId: string, translatorUid: string): Promise<void> {
    const snap = await this.col.doc(versionId).get();
    if (!snap.exists) throw new NotFoundException(`Chapter version ${versionId} not found`);
    const ver = snap.data() as ChapterVersion;
    if (ver.translatorUid !== translatorUid) {
      throw new BadRequestException('You do not own this chapter version');
    }
    if (ver.status === 'published') {
      throw new BadRequestException('Published versions cannot be deleted');
    }
    // Delete uploaded pages from disk before removing the Firestore document
    const pagesDir = path.join(process.cwd(), 'uploads', 'chapters', versionId);
    if (fs.existsSync(pagesDir)) {
      fs.rmSync(pagesDir, { recursive: true, force: true });
      this.logger.log(`Deleted pages directory for version ${versionId}`);
    }
    await this.col.doc(versionId).delete();
    this.logger.log(`Deleted chapter version ${versionId}`);
  }
}
