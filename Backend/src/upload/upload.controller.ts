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
import * as path from 'path';
import * as os from 'os';
import { AuthGuard, USER_KEY } from '../auth/auth.guard';
import { UploadService } from './upload.service';
import type { DecodedIdToken } from 'firebase-admin/auth';

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
        if (!file.mimetype.startsWith('image/')) {
          return cb(new BadRequestException('Only image files are allowed'), false);
        }
        cb(null, true);
      },
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          // Write to OS tmp first; UploadService moves it to the final location
          cb(null, os.tmpdir());
        },
        filename: (_req, file, cb) => {
          const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
          cb(null, `upload_${Date.now()}${ext}`);
        },
      }),
    }),
  )
  async uploadPage(
    @Req() req: Request & { [USER_KEY]: DecodedIdToken },
    @Param('versionId') versionId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file provided');
    return this.uploadService.addPage(
      versionId,
      req[USER_KEY].uid,
      file.path,
      file.originalname,
    );
  }

  /**
   * Reorder all pages in a draft version.
   * PUT /upload/versions/:versionId/pages
   * Body: { pages: string[] }  — ordered list of existing page URLs
   */
  @Put('versions/:versionId/pages')
  async reorderPages(
    @Req() req: Request & { [USER_KEY]: DecodedIdToken },
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
    @Req() req: Request & { [USER_KEY]: DecodedIdToken },
    @Param('versionId') versionId: string,
    @Body() body: { pageUrl: string },
  ) {
    if (!body?.pageUrl) throw new BadRequestException('pageUrl is required');
    await this.uploadService.deletePage(versionId, req[USER_KEY].uid, body.pageUrl);
    return { ok: true };
  }
}
