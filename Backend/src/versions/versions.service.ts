import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import * as path from 'path';
import { SupabaseService } from '../supabase/supabase.service';
import type { ChapterVersion, VersionStatus } from './versions.types';
import { STORAGE_PROVIDER, type StorageProvider } from '../common/storage/storage-provider.interface';

type ChapterVersionRow = {
  version_id: string;
  title_id: string;
  title_name: string;
  title_alt_name?: string;
  chapter_id: string;
  chapter_number: string;
  chapter_title: string;
  language: string;
  translator_uid: string;
  translator_name: string | null;
  status: VersionStatus;
  pages: string[];
  price_coins: number;
  quality_score: number;
  is_default: boolean;
  description: string | null;
  created_at: string | null;
  updated_at: string | null;
};

@Injectable()
export class VersionsService {
  private readonly logger = new Logger(VersionsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  private get db() {
    return this.supabase.client;
  }

  private versionDir(versionId: string): string {
    return `uploads/chapters/${versionId}`;
  }

  /**
   * During local multi-machine development, DB rows may exist without the
   * uploaded files being present on this backend instance yet.
   */
  private async isVersionAvailableOnBackend(row: ChapterVersionRow): Promise<boolean> {
    const pages = row.pages ?? [];
    if (pages.length === 0) return true;

    const expectedPrefix = `/uploads/chapters/${row.version_id}/`;
    // Collect the local filenames first — non-local URLs (future R2/worker
    // flow) are treated as available here.
    const localNames: string[] = [];
    for (const pageUrl of pages) {
      if (!pageUrl || typeof pageUrl !== 'string') return false;
      if (!pageUrl.startsWith(expectedPrefix)) continue;
      const filename = pageUrl.split('/').pop();
      if (!filename) return false;
      localNames.push(filename);
    }
    if (localNames.length === 0) return true;

    // One readdir per version instead of one stat per page (#149) — every
    // list endpoint maps every row, so per-page round-trips multiply fast
    // (and would be ~100ms each on the planned R2 adapter).
    try {
      const present = new Set(await this.storage.list(this.versionDir(row.version_id)));
      return localNames.every((name) => present.has(name));
    } catch {
      return false; // directory missing on this node
    }
  }

  private async mapRow(row: ChapterVersionRow): Promise<ChapterVersion> {
    return {
      versionId: row.version_id,
      titleId: row.title_id,
      titleName: row.title_name,
      titleAltName: row.title_alt_name,
      chapterId: row.chapter_id,
      chapterNumber: row.chapter_number,
      chapterTitle: row.chapter_title,
      language: row.language,
      translatorUid: row.translator_uid,
      translatorName: row.translator_name,
      status: row.status,
      pages: row.pages ?? [],
      priceCoins: row.price_coins ?? 0,
      qualityScore: row.quality_score ?? 0,
      isDefault: row.is_default ?? false,
      description: row.description ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      backendAvailable: await this.isVersionAvailableOnBackend(row),
    };
  }

  async createVersion(data: {
    titleId: string;
    titleName: string;
    titleAltName?: string;
    chapterId?: string;
    chapterNumber: string;
    chapterTitle: string;
    language: string;
    translatorUid: string;
    translatorName: string | null;
    description?: string;
    priceCoins?: number;
  }): Promise<ChapterVersion> {
    if (!data.titleId || !data.language || !data.translatorUid) {
      throw new BadRequestException('titleId, language, and translatorUid are required');
    }

    const chapterId = data.chapterId || crypto.randomUUID();

    const now = new Date().toISOString();
    const { data: inserted, error } = await this.db
      .from('chapter_versions')
      .insert({
        title_id: data.titleId,
        title_name: data.titleName ?? '',
        title_alt_name: data.titleAltName ?? '',
        chapter_id: chapterId,
        chapter_number: data.chapterNumber ?? '',
        chapter_title: data.chapterTitle ?? '',
        language: data.language,
        translator_uid: data.translatorUid,
        translator_name: data.translatorName ?? null,
        status: 'draft',
        pages: [],
        price_coins: data.priceCoins ?? 0,
        quality_score: 0,
        is_default: false,
        description: data.description?.trim() ?? null,
        created_at: now,
        updated_at: now,
      })
      .select('*')
      .single<ChapterVersionRow>();

    if (error || !inserted) {
      throw new Error(`Failed to create chapter version: ${error?.message ?? 'unknown error'}`);
    }

    this.logger.log(`Created chapter version ${inserted.version_id} for translator ${data.translatorUid}`);
    return await this.mapRow(inserted);
  }

  async getVersion(versionId: string): Promise<ChapterVersion> {
    const { data, error } = await this.db
      .from('chapter_versions')
      .select('*')
      .eq('version_id', versionId)
      .maybeSingle<ChapterVersionRow>();

    if (error) {
      throw new Error(`Failed to fetch chapter version: ${error.message}`);
    }
    if (!data) throw new NotFoundException(`Chapter version ${versionId} not found`);
    return await this.mapRow(data);
  }

  async listVersionsByChapter(chapterId: string): Promise<ChapterVersion[]> {
    const { data, error } = await this.db
      .from('chapter_versions')
      .select('*')
      .eq('chapter_id', chapterId)
      .eq('status', 'published')
      .order('quality_score', { ascending: false });

    if (error) {
      throw new Error(`Failed to list chapter versions: ${error.message}`);
    }

    return await Promise.all((data ?? []).map((row) => this.mapRow(row as ChapterVersionRow)));
  }

  async listVersionsByTitle(titleId: string): Promise<ChapterVersion[]> {
    const { data, error } = await this.db
      .from('chapter_versions')
      .select('*')
      .eq('title_id', titleId)
      .eq('status', 'published');

    if (error) {
      throw new Error(`Failed to list title versions: ${error.message}`);
    }

    const versions = await Promise.all((data ?? []).map((row) => this.mapRow(row as ChapterVersionRow)));
    return versions.sort((a, b) => (parseFloat(a.chapterNumber) || 0) - (parseFloat(b.chapterNumber) || 0));
  }

  async listVersionsByTranslator(translatorUid: string): Promise<ChapterVersion[]> {
    const { data, error } = await this.db
      .from('chapter_versions')
      .select('*')
      .eq('translator_uid', translatorUid)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      throw new Error(`Failed to list versions by translator: ${error.message}`);
    }

    return await Promise.all((data ?? []).map((row) => this.mapRow(row as ChapterVersionRow)));
  }

  async listPublishedVersionsByTranslator(translatorUid: string): Promise<Omit<ChapterVersion, 'pages'>[]> {
    const { data, error } = await this.db
      .from('chapter_versions')
      .select('*')
      .eq('translator_uid', translatorUid)
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      throw new Error(`Failed to list published versions by translator: ${error.message}`);
    }

    return await Promise.all((data ?? []).map(async (row) => {
      const version = await this.mapRow(row as ChapterVersionRow);
      const { pages: _pages, ...rest } = version;
      return rest;
    }));
  }

  async setPages(versionId: string, translatorUid: string, pages: string[]): Promise<void> {
    const version = await this.getVersion(versionId);
    if (version.translatorUid !== translatorUid) {
      throw new BadRequestException('You do not own this chapter version');
    }
    if (version.status !== 'draft' && version.status !== 'published') {
      throw new BadRequestException('Pages can only be updated on draft or published versions');
    }

    const { error } = await this.db
      .from('chapter_versions')
      .update({
        pages,
        updated_at: new Date().toISOString(),
      })
      .eq('version_id', versionId);

    if (error) {
      throw new Error(`Failed to update pages: ${error.message}`);
    }
  }

  async updateStatus(versionId: string, translatorUid: string, status: VersionStatus): Promise<void> {
    const version = await this.getVersion(versionId);
    if (version.translatorUid !== translatorUid) {
      throw new BadRequestException('You do not own this chapter version');
    }

    const allowedTransitions: Partial<Record<VersionStatus, VersionStatus[]>> = {
      draft: ['pending_moderation', 'published'],
      rejected: ['draft'],
      published: ['draft'],
    };

    if (!allowedTransitions[version.status]?.includes(status)) {
      throw new BadRequestException(`Cannot transition from ${version.status} to ${status}`);
    }
    if (status === 'pending_moderation' && version.pages.length === 0) {
      throw new BadRequestException('Cannot submit a version with no pages');
    }

    const { error } = await this.db
      .from('chapter_versions')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('version_id', versionId);

    if (error) {
      throw new Error(`Failed to update status: ${error.message}`);
    }

    this.logger.log(`Version ${versionId} status -> ${status}`);
  }

  async updateMetadata(
    versionId: string,
    translatorUid: string,
    data: { description?: string; priceCoins?: number; titleAltName?: string; chapterTitle?: string; chapterNumber?: string; },
  ): Promise<void> {
    const version = await this.getVersion(versionId);
    if (version.translatorUid !== translatorUid) {
      throw new BadRequestException('You do not own this chapter version');
    }
    if (version.status !== 'draft' && version.status !== 'published') {
      throw new BadRequestException('Metadata can only be updated on draft or published versions');
    }

    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (data.description !== undefined) update['description'] = data.description.trim().slice(0, 1000);
    if (data.titleAltName !== undefined) update['title_alt_name'] = data.titleAltName;
    if (data.chapterTitle !== undefined) update['chapter_title'] = data.chapterTitle;
    if (data.chapterNumber !== undefined) update['chapter_number'] = data.chapterNumber;
    if (data.priceCoins !== undefined) {
      if (data.priceCoins < 0) throw new BadRequestException('priceCoins cannot be negative');
      update['price_coins'] = Math.floor(data.priceCoins);
    }

    const { error } = await this.db
      .from('chapter_versions')
      .update(update)
      .eq('version_id', versionId);

    if (error) {
      throw new Error(`Failed to update metadata: ${error.message}`);
    }
  }

  async deleteVersion(versionId: string, translatorUid: string): Promise<void> {
    const version = await this.getVersion(versionId);
    if (version.translatorUid !== translatorUid) {
      throw new BadRequestException('You do not own this chapter version');
    }

    const pagesDir = this.versionDir(versionId);
    await this.storage.deleteDir(pagesDir);
    this.logger.log(`Deleted pages directory for version ${versionId}`);

    const { error } = await this.db
      .from('chapter_versions')
      .delete()
      .eq('version_id', versionId);

    if (error) {
      throw new Error(`Failed to delete chapter version: ${error.message}`);
    }

    this.logger.log(`Deleted chapter version ${versionId}`);
  }
}
