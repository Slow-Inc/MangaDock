import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { VersionsService } from '../versions/versions.service';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  constructor(private readonly versionsService: VersionsService) {}

  /** Return the absolute directory where pages for a version are stored. */
  private versionDir(versionId: string): string {
    return path.join(process.cwd(), 'uploads', 'chapters', versionId);
  }

  /**
   * Persist one uploaded page file into the version's directory and register
   * its URL in the chapterVersions document.
   *
   * Called after multer has written the file to a temp path.
   */
  async addPage(
    versionId: string,
    translatorUid: string,
    tempFilePath: string,
    originalName: string,
  ): Promise<{ pageUrl: string; pageIndex: number }> {
    // Verify ownership — will throw if version not found or wrong owner
    const version = await this.versionsService.getVersion(versionId);
    if (version.translatorUid !== translatorUid) {
      fs.unlinkSync(tempFilePath);
      throw new BadRequestException('You do not own this chapter version');
    }
    if (version.status !== 'draft') {
      fs.unlinkSync(tempFilePath);
      throw new BadRequestException('Pages can only be added to draft versions');
    }

    const dir = this.versionDir(versionId);
    fs.mkdirSync(dir, { recursive: true });

    const pageIndex = version.pages.length;
    const ext = path.extname(originalName).toLowerCase() || '.jpg';
    const filename = `page_${String(pageIndex + 1).padStart(3, '0')}${ext}`;
    const destPath = path.join(dir, filename);
    fs.renameSync(tempFilePath, destPath);

    const pageUrl = `/uploads/chapters/${versionId}/${filename}`;
    const newPages = [...version.pages, pageUrl];
    await this.versionsService.setPages(versionId, translatorUid, newPages);

    this.logger.log(`Page ${filename} added to version ${versionId} (index ${pageIndex})`);
    return { pageUrl, pageIndex };
  }

  /**
   * Replace the entire pages array with a re-ordered list of existing page URLs.
   * Used to reorder pages in the studio editor.
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
    // Validate that the caller only supplies URLs that already belong to this version
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
    // Remove from Firestore
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
