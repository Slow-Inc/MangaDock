import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, USER_KEY } from '../auth/auth.guard';
import { VersionsService } from './versions.service';
import type { DecodedIdToken } from 'firebase-admin/auth';
import type { VersionStatus } from './versions.types';

@Controller('versions')
export class VersionsController {
  constructor(private readonly versions: VersionsService) {}

  /** List published versions for a chapter (public — no auth required). */
  @Get('chapter/:chapterId')
  listByChapter(@Param('chapterId') chapterId: string) {
    return this.versions.listVersionsByChapter(chapterId);
  }

  /** Get a single version by ID (public). */
  @Get(':versionId')
  getVersion(@Param('versionId') versionId: string) {
    return this.versions.getVersion(versionId);
  }

  /** List all versions uploaded by a specific translator (public). */
  @Get('translator/:uid')
  listByTranslator(@Param('uid') uid: string) {
    return this.versions.listVersionsByTranslator(uid);
  }

  // ── Authenticated routes ─────────────────────────────────────────────────

  /** Create a new draft chapter version. */
  @Post()
  @UseGuards(AuthGuard)
  createVersion(
    @Req() req: Request & { [USER_KEY]: DecodedIdToken },
    @Body()
    body: {
      titleId: string;
      titleName: string;
      chapterId: string;
      chapterNumber: string;
      chapterTitle: string;
      language: string;
      description?: string;
      priceCoins?: number;
    },
  ) {
    const token = req[USER_KEY];
    return this.versions.createVersion({
      ...body,
      translatorUid: token.uid,
      translatorName: token.name ?? null,
    });
  }

  /** Update metadata (description, priceCoins) on a draft version. */
  @Patch(':versionId')
  @UseGuards(AuthGuard)
  updateMetadata(
    @Req() req: Request & { [USER_KEY]: DecodedIdToken },
    @Param('versionId') versionId: string,
    @Body() body: { description?: string; priceCoins?: number },
  ) {
    return this.versions.updateMetadata(versionId, req[USER_KEY].uid, body);
  }

  /** Submit a draft version for moderation or retract a rejected version to draft. */
  @Patch(':versionId/status')
  @UseGuards(AuthGuard)
  updateStatus(
    @Req() req: Request & { [USER_KEY]: DecodedIdToken },
    @Param('versionId') versionId: string,
    @Body() body: { status: VersionStatus },
  ) {
    return this.versions.updateStatus(versionId, req[USER_KEY].uid, body.status);
  }

  /** Delete a draft or rejected version. */
  @Delete(':versionId')
  @UseGuards(AuthGuard)
  deleteVersion(
    @Req() req: Request & { [USER_KEY]: DecodedIdToken },
    @Param('versionId') versionId: string,
  ) {
    return this.versions.deleteVersion(versionId, req[USER_KEY].uid);
  }
}
