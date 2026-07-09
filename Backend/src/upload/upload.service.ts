import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { VersionsService } from '../versions/versions.service';
import type { ChapterVersion } from '../versions/versions.types';
import {
  STORAGE_PROVIDER,
  type StorageProvider,
} from '../common/storage/storage-provider.interface';
import { saveValidatedImage } from '../common/storage/save-validated-image';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly versionsService: VersionsService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  private get db() {
    return this.supabase.client;
  }

  private versionDir(versionId: string): string {
    return `uploads/chapters/${versionId}`;
  }

  async addPage(
    versionId: string,
    translatorUid: string,
    tempFilePath: string,
  ): Promise<{ pageUrl: string; pageIndex: number }> {
    const { url: pageUrl, key } = await saveValidatedImage(
      this.storage,
      tempFilePath,
      this.versionDir(versionId),
      {
        rejectMessage:
          'Unsupported image format. Only JPEG, PNG, WebP and GIF are accepted.',
        storageErrorMessage: 'Failed to upload page to storage',
        storageErrorAsPlainError: true,
      },
    );
    const filename = key.split('/').pop()!;

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
        await this.storage.delete(key);
        throw new Error(`Failed to read chapter version: ${readError.message}`);
      }
      if (!versionRow) {
        await this.storage.delete(key);
        throw new NotFoundException(`Chapter version ${versionId} not found`);
      }
      if (versionRow.translator_uid !== translatorUid) {
        await this.storage.delete(key);
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

      const { data: updatedRows, error: updateError } =
        await query.select('version_id');

      if (updateError) {
        await this.storage.delete(key);
        throw new Error(`Failed to append page: ${updateError.message}`);
      }

      if ((updatedRows ?? []).length > 0) {
        this.logger.log(
          `Page ${filename} added to version ${versionId} (index ${pageIndex})`,
        );
        return { pageUrl, pageIndex };
      }
    }

    await this.storage.delete(key);
    throw new BadRequestException(
      'Concurrent update conflict, please retry upload',
    );
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
      throw new BadRequestException(
        'Reorder list must contain all existing pages',
      );
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
    const key = `${this.versionDir(versionId)}/${filename}`;
    try {
      await this.storage.delete(key);
      this.logger.log(`Deleted page ${filename} from version ${versionId}`);
    } catch {
      this.logger.warn(`Failed to delete file from storage: ${key}`);
    }
  }
}
