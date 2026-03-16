import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, USER_KEY } from '../auth/auth.guard';
import { VersionsService } from './versions.service';
import type { SupabaseAuthUser } from '../auth/auth.types';
import type { VersionStatus } from './versions.types';

@Controller('versions')
export class VersionsController {
  constructor(private readonly versions: VersionsService) {}

  /** List published versions for a chapter (public — no auth required). */
  @Get('chapter/:chapterId')
  listByChapter(@Param('chapterId') chapterId: string) {
    return this.versions.listVersionsByChapter(chapterId);
  }

  /**
   * Get a single version by ID.
   * Public access is restricted to published versions only.
   * Authenticated owners can see their own draft/pending/rejected versions.
   */
  @Get(':versionId')
  async getVersion(
    @Param('versionId') versionId: string,
    @Req() req: Request & { [USER_KEY]?: SupabaseAuthUser },
  ) {
    const version = await this.versions.getVersion(versionId);
    if (version.status !== 'published') {
      // Require auth and ownership for non-published versions
      const caller = req[USER_KEY];
      if (!caller) {
        throw new NotFoundException(`Chapter version ${versionId} not found`);
      }
      if (caller.uid !== version.translatorUid) {
        throw new ForbiddenException('You do not have access to this version');
      }
    }
    return version;
  }

  /** List published versions for a specific translator (public). */
  @Get('translator/:uid')
  listByTranslatorPublic(@Param('uid') uid: string) {
    return this.versions.listPublishedVersionsByTranslator(uid);
  }

  // ── Authenticated routes ─────────────────────────────────────────────────

  /** List all versions (including drafts) for the currently signed-in translator. */
  @Get('me/versions')
  @UseGuards(AuthGuard)
  listMyVersions(@Req() req: Request & { [USER_KEY]: SupabaseAuthUser }) {
    return this.versions.listVersionsByTranslator(req[USER_KEY].uid);
  }

  /** Create a new draft chapter version. */
  @Post()
  @UseGuards(AuthGuard)
  createVersion(
    @Req() req: Request & { [USER_KEY]: SupabaseAuthUser },
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
    @Req() req: Request & { [USER_KEY]: SupabaseAuthUser },
    @Param('versionId') versionId: string,
    @Body() body: { description?: string; priceCoins?: number },
  ) {
    return this.versions.updateMetadata(versionId, req[USER_KEY].uid, body);
  }

  /** Submit a draft version for moderation or retract a rejected version to draft. */
  @Patch(':versionId/status')
  @UseGuards(AuthGuard)
  updateStatus(
    @Req() req: Request & { [USER_KEY]: SupabaseAuthUser },
    @Param('versionId') versionId: string,
    @Body() body: { status: VersionStatus },
  ) {
    return this.versions.updateStatus(versionId, req[USER_KEY].uid, body.status);
  }

  /** Delete a draft or rejected version. */
  @Delete(':versionId')
  @UseGuards(AuthGuard)
  deleteVersion(
    @Req() req: Request & { [USER_KEY]: SupabaseAuthUser },
    @Param('versionId') versionId: string,
  ) {
    return this.versions.deleteVersion(versionId, req[USER_KEY].uid);
  }
}
