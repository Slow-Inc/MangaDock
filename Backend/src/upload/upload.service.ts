import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { VersionsService } from '../versions/versions.service';

/** Allowed image MIME types for page uploads. */
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

/** Map allowed MIME type to canonical file extension. */
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly versionsService: VersionsService,
  ) {}

  private get db() {
    return this.supabase.client;
  }

  /** Return the absolute directory where pages for a version are stored. */
  private versionDir(versionId: string): string {
    return path.join(process.cwd(), 'uploads', 'chapters', versionId);
  }

  /**
   * Persist one uploaded page file and atomically append its URL to the
   * chapter_versions row using a PostgreSQL read-then-update pattern.
   */
  async addPage(
    versionId: string,
    translatorUid: string,
    tempFilePath: string,
    mimeType: string,
  ): Promise<{ pageUrl: string; pageIndex: number }> {
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      fs.unlinkSync(tempFilePath);
      throw new BadRequestException('Unsupported image format. Only JPEG, PNG and WebP are accepted.');
    }

    const ext = MIME_TO_EXT[mimeType];
    const filename = `${crypto.randomUUID()}${ext}`;
    const dir = this.versionDir(versionId);
    fs.mkdirSync(dir, { recursive: true });
    const destPath = path.join(dir, filename);
    fs.renameSync(tempFilePath, destPath);

    const pageUrl = `/uploads/chapters/${versionId}/${filename}`;

    // Read current version row
    const { data: ver, error } = await this.db
      .from('chapter_versions')
      .select('*')
      .eq('version_id', versionId)
      .single();

    if (error || !ver) {
      fs.unlinkSync(destPath);
      throw new NotFoundException(`Chapter version ${versionId} not found`);
    }
    if (ver.translator_uid !== translatorUid) {
      fs.unlinkSync(destPath);
      throw new BadRequestException('You do not own this chapter version');
    }
    if (ver.status !== 'draft') {
      fs.unlinkSync(destPath);
      throw new BadRequestException('Pages can only be added to draft versions');
    }

    const currentPages: string[] = ver.pages ?? [];
    const pageIndex = currentPages.length;

    const { error: updateErr } = await this.db
      .from('chapter_versions')
      .update({
        pages: [...currentPages, pageUrl],
        updated_at: new Date().toISOString(),
      })
      .eq('version_id', versionId);

    if (updateErr) {
      fs.unlinkSync(destPath);
      throw new BadRequestException(updateErr.message);
    }

    this.logger.log(`Page ${filename} added to version ${versionId} (index ${pageIndex})`);
    return { pageUrl, pageIndex };
  }

  /**
   * Replace the entire pages array with a re-ordered list of existing page URLs.
   */
  async reorderPages(
    versionId: string,
    translatorUid: string,
    orderedUrls: string[],
  ): Promise<void> {
    const version = await this.versionsService.getVersion(versionId);
    if (version.translatorUid !== translatorUid) {
      throw new BadRequestException('You do not own this chapter version');
    }
    if (version.status !== 'draft') {
      throw new BadRequestException('Pages can only be reordered on draft versions');
    }
    const existingSet = new Set(version.pages);
    for (const url of orderedUrls) {
      if (!existingSet.has(url)) {
        throw new BadRequestException(`Unknown page URL: ${url}`);
      }
    }
    if (orderedUrls.length !== version.pages.length) {
      throw new BadRequestException('Reorder list must contain all existing pages');
    }
    await this.versionsService.setPages(versionId, translatorUid, orderedUrls);
  }

  /**
   * Delete a specific page by URL and remove it from the version's page list.
   */
  async deletePage(
    versionId: string,
    translatorUid: string,
    pageUrl: string,
  ): Promise<void> {
    const version = await this.versionsService.getVersion(versionId);
    if (version.translatorUid !== translatorUid) {
      throw new BadRequestException('You do not own this chapter version');
    }
    if (version.status !== 'draft') {
      throw new BadRequestException('Pages can only be deleted from draft versions');
    }
    if (!version.pages.includes(pageUrl)) {
      throw new NotFoundException(`Page not found in version ${versionId}`);
    }
    const newPages = version.pages.filter((p) => p !== pageUrl);
    await this.versionsService.setPages(versionId, translatorUid, newPages);
    // Remove from disk
    const filename = pageUrl.split('/').pop()!;
    const filePath = path.join(this.versionDir(versionId), filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      this.logger.log(`Deleted page ${filename} from version ${versionId}`);
    }
  }
}
