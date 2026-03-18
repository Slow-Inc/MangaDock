import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Param,
  Post,
  Put,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';
import { AuthGuard, USER_KEY } from '../auth/auth.guard';
import { UploadService } from './upload.service';
import type { SupabaseAuthUser } from '../auth/auth.types';

/** Allowlist of accepted MIME types for page uploads. */
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

@Controller('upload')
@UseGuards(AuthGuard)
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  /**
   * Upload a single page image to a chapter version.
   * The page is appended at the end of the current page list.
   * POST /upload/versions/:versionId/pages
   */
  @Post('versions/:versionId/pages')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB per page
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
          return cb(
            new BadRequestException('Only JPEG, PNG, WebP and GIF images are allowed'),
            false,
          );
        }
        cb(null, true);
      },
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          // Write to OS tmp first; UploadService moves it to the final location
          cb(null, os.tmpdir());
        },
        filename: (_req, _file, cb) => {
          // Use a UUID so concurrent in-flight files cannot collide in tmpdir
          cb(null, `upload_${crypto.randomUUID()}`);
        },
      }),
    }),
  )
  async uploadPage(
    @Req() req: Request & { [USER_KEY]: SupabaseAuthUser },
    @Param('versionId') versionId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file provided');
    return this.uploadService.addPage(
      versionId,
      req[USER_KEY].uid,
      file.path,
      file.mimetype,
    );
  }

  /**
   * Reorder all pages in a draft version.
   * PUT /upload/versions/:versionId/pages
   * Body: { pages: string[] }  — ordered list of existing page URLs
   */
  @Put('versions/:versionId/pages')
  async reorderPages(
    @Req() req: Request & { [USER_KEY]: SupabaseAuthUser },
    @Param('versionId') versionId: string,
    @Body() body: { pages: string[] },
  ) {
    if (!Array.isArray(body?.pages)) throw new BadRequestException('pages must be an array');
    await this.uploadService.reorderPages(versionId, req[USER_KEY].uid, body.pages);
    return { ok: true };
  }

  /**
   * Delete a single page from a draft version.
   * DELETE /upload/versions/:versionId/pages
   * Body: { pageUrl: string }
   */
  @Delete('versions/:versionId/pages')
  async deletePage(
    @Req() req: Request & { [USER_KEY]: SupabaseAuthUser },
    @Param('versionId') versionId: string,
    @Body() body: { pageUrl: string },
  ) {
    if (!body?.pageUrl) throw new BadRequestException('pageUrl is required');
    await this.uploadService.deletePage(versionId, req[USER_KEY].uid, body.pageUrl);
    return { ok: true };
  }
}
