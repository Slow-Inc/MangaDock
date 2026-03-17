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
import type { ChapterVersion } from '../versions/versions.types';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
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

  private versionDir(versionId: string): string {
    return path.join(process.cwd(), 'uploads', 'chapters', versionId);
  }

  async addPage(
    versionId: string,
    translatorUid: string,
    tempFilePath: string,
    mimeType: string,
  ): Promise<{ pageUrl: string; pageIndex: number }> {
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      fs.unlinkSync(tempFilePath);
      throw new BadRequestException('Unsupported image format. Only JPEG, PNG, WebP and GIF are accepted.');
    }

    const ext = MIME_TO_EXT[mimeType];
    const filename = `${crypto.randomUUID()}${ext}`;
    const dir = this.versionDir(versionId);
    fs.mkdirSync(dir, { recursive: true });
    const destPath = path.join(dir, filename);
    fs.renameSync(tempFilePath, destPath);

    const pageUrl = `/uploads/chapters/${versionId}/${filename}`;

    let pageIndex = -1;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const { data: versionRow, error: readError } = await this.db
        .from('chapter_versions')
        .select('translator_uid, status, pages, updated_at')
        .eq('version_id', versionId)
        .maybeSingle<{
          translator_uid: string;
          status: ChapterVersion['status'];
          pages: string[];
          updated_at: string | null;
        }>();

      if (readError) {
        fs.unlinkSync(destPath);
        throw new Error(`Failed to read chapter version: ${readError.message}`);
      }
      if (!versionRow) {
        fs.unlinkSync(destPath);
        throw new NotFoundException(`Chapter version ${versionId} not found`);
      }
      if (versionRow.translator_uid !== translatorUid) {
        fs.unlinkSync(destPath);
        throw new BadRequestException('You do not own this chapter version');
      }

      const currentPages = versionRow.pages ?? [];
      pageIndex = currentPages.length;
      const nextPages = [...currentPages, pageUrl];

      let query = this.db
        .from('chapter_versions')
        .update({
          pages: nextPages,
          updated_at: new Date().toISOString(),
        })
        .eq('version_id', versionId)
        .eq('translator_uid', translatorUid);

      if (versionRow.updated_at) {
        query = query.eq('updated_at', versionRow.updated_at);
      }

      const { data: updatedRows, error: updateError } = await query.select('version_id');

      if (updateError) {
        fs.unlinkSync(destPath);
        throw new Error(`Failed to append page: ${updateError.message}`);
      }

      if ((updatedRows ?? []).length > 0) {
        this.logger.log(`Page ${filename} added to version ${versionId} (index ${pageIndex})`);
        return { pageUrl, pageIndex };
      }
    }

    fs.unlinkSync(destPath);
    throw new BadRequestException('Concurrent update conflict, please retry upload');
  }

  async reorderPages(
    versionId: string,
    translatorUid: string,
    orderedUrls: string[],
  ): Promise<void> {
    const version = await this.versionsService.getVersion(versionId);
    if (version.translatorUid !== translatorUid) {
      throw new BadRequestException('You do not own this chapter version');
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

  async deletePage(
    versionId: string,
    translatorUid: string,
    pageUrl: string,
  ): Promise<void> {
    const version = await this.versionsService.getVersion(versionId);
    if (version.translatorUid !== translatorUid) {
      throw new BadRequestException('You do not own this chapter version');
    }
    if (!version.pages.includes(pageUrl)) {
      throw new NotFoundException(`Page not found in version ${versionId}`);
    }

    const newPages = version.pages.filter((p) => p !== pageUrl);
    await this.versionsService.setPages(versionId, translatorUid, newPages);

    const filename = pageUrl.split('/').pop()!;
    const filePath = path.join(this.versionDir(versionId), filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      this.logger.log(`Deleted page ${filename} from version ${versionId}`);
    }
  }
}
