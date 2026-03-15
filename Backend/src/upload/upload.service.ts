import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { FirebaseService } from '../firebase/firebase.service';
import { VersionsService } from '../versions/versions.service';
import type { ChapterVersion } from '../versions/versions.types';

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
    private readonly firebase: FirebaseService,
    private readonly versionsService: VersionsService,
  ) {}

  /** Return the absolute directory where pages for a version are stored. */
  private versionDir(versionId: string): string {
    return path.join(process.cwd(), 'uploads', 'chapters', versionId);
  }

  /**
   * Persist one uploaded page file into the version's directory and atomically
   * append its URL to the chapterVersions document using a Firestore transaction.
   *
   * Called after multer has written the file to a temp path.
   * Performs a defensive MIME-type check in addition to the controller-level filter.
   */
  async addPage(
    versionId: string,
    translatorUid: string,
    tempFilePath: string,
    mimeType: string,
  ): Promise<{ pageUrl: string; pageIndex: number }> {
    // Validate MIME type (second layer of defence behind the controller filter)
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      fs.unlinkSync(tempFilePath);
      throw new BadRequestException('Unsupported image format. Only JPEG, PNG and WebP are accepted.');
    }

    const ext = MIME_TO_EXT[mimeType];
    // Use a UUID-based filename so concurrent uploads never collide
    const filename = `${crypto.randomUUID()}${ext}`;
    const dir = this.versionDir(versionId);
    fs.mkdirSync(dir, { recursive: true });
    const destPath = path.join(dir, filename);
    fs.renameSync(tempFilePath, destPath);

    const pageUrl = `/uploads/chapters/${versionId}/${filename}`;
    let pageIndex = 0;

    // Atomically append the URL inside a Firestore transaction so concurrent
    // uploads for the same version cannot produce duplicate indices or
    // overwrite each other's pages via last-write-wins.
    const versionRef = this.firebase.firestore.collection('chapterVersions').doc(versionId);
    await this.firebase.firestore.runTransaction(async (tx) => {
      const snap = await tx.get(versionRef);
      if (!snap.exists) {
        fs.unlinkSync(destPath);
        throw new NotFoundException(`Chapter version ${versionId} not found`);
      }
      const ver = snap.data() as ChapterVersion;
      if (ver.translatorUid !== translatorUid) {
        fs.unlinkSync(destPath);
        throw new BadRequestException('You do not own this chapter version');
      }
      if (ver.status !== 'draft') {
        fs.unlinkSync(destPath);
        throw new BadRequestException('Pages can only be added to draft versions');
      }
      const currentPages: string[] = ver.pages ?? [];
      pageIndex = currentPages.length;
      tx.update(versionRef, {
        pages: [...currentPages, pageUrl],
        updatedAt: new Date(),
      });
    });

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
