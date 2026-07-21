import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { isValidHardwareId } from '../common/middleware/hardware-id.middleware';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import * as path from 'path';
import { AuthGuard, USER_KEY } from '../auth/auth.guard';
import { UsersService } from './users.service';
import type { SupabaseAuthUser } from '../auth/auth.types';
import {
  STORAGE_PROVIDER,
  type StorageProvider,
} from '../common/storage/storage-provider.interface';

@Controller('users')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(
    private readonly users: UsersService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  /** Called after login — creates/updates user doc (never overwrites displayName/photoURL) */
  @Post('me')
  async upsertMe(@Req() req: Request & { [USER_KEY]: SupabaseAuthUser }) {
    const token = req[USER_KEY];
    await this.users.upsertUser(token.uid, {
      email: token.email,
      displayName: token.name,
      photoURL: token.picture,
    });
    return { ok: true };
  }

  /** Explicit profile update — always overwrites displayName and/or photoURL */
  @Patch('me')
  async updateMyProfile(
    @Req() req: Request & { [USER_KEY]: SupabaseAuthUser },
    @Body() body: { displayName?: string; photoURL?: string },
  ) {
    await this.users.updateUserProfile(req[USER_KEY].uid, body);
    return { ok: true };
  }

  @Get('me')
  getMe(@Req() req: Request & { [USER_KEY]: SupabaseAuthUser }) {
    return this.users.getProfile(req[USER_KEY].uid);
  }

  @Delete('me')
  async deleteMe(@Req() req: Request & { [USER_KEY]: SupabaseAuthUser }) {
    await this.users.deleteUserAccount(req[USER_KEY].uid);
    return { ok: true };
  }

  @Get('me/favorites')
  getFavorites(@Req() req: Request & { [USER_KEY]: SupabaseAuthUser }) {
    return this.users.getFavorites(req[USER_KEY].uid);
  }

  @Post('me/favorites')
  addFavorite(
    @Req() req: Request & { [USER_KEY]: SupabaseAuthUser },
    @Body()
    body: {
      id: string;
      title: string;
      thumbnail: string;
      authors?: string[];
      description?: string;
      categories?: string[];
      publishedDate?: string;
      averageRating?: number;
      ratingsCount?: number;
    },
  ) {
    return this.users.addFavorite(req[USER_KEY].uid, body);
  }

  @Delete('me/favorites/:id')
  removeFavorite(
    @Req() req: Request & { [USER_KEY]: SupabaseAuthUser },
    @Param('id') id: string,
  ) {
    return this.users.removeFavorite(req[USER_KEY].uid, id);
  }

  @Delete('me/avatar')
  async deleteAvatar(
    @Req() req: Request & { [USER_KEY]: SupabaseAuthUser },
    @Body() body: { filename: string },
  ) {
    const uid = req[USER_KEY].uid;
    const filename = body?.filename ?? '';
    // Safety: filename must start with the user's uid to prevent deleting other users' files
    if (!filename || !filename.startsWith(`${uid}_`)) {
      throw new BadRequestException('Invalid filename');
    }
    const key = `uploads/avatars/${filename}`;
    await this.storage.delete(key);
    return { ok: true };
  }

  @Post('me/avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          return cb(
            new BadRequestException('Only image files are allowed'),
            false,
          );
        }
        cb(null, true);
      },
      storage: memoryStorage(),
    }),
  )
  async uploadAvatar(
    @Req() req: Request & { [USER_KEY]: SupabaseAuthUser },
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file provided');

    const uid = req[USER_KEY].uid;
    const ext = path.extname(file.originalname) || '.jpg';
    const filename = `${uid}_${Date.now()}${ext}`;
    const key = `uploads/avatars/${filename}`;

    await this.storage.put(key, file.buffer, { contentType: file.mimetype });

    return { url: `/${key}` };
  }

  @Get('me/liked')
  getLiked(@Req() req: Request & { [USER_KEY]: SupabaseAuthUser }) {
    return this.users.getLiked(req[USER_KEY].uid);
  }

  @Post('me/liked/:id')
  addLiked(
    @Req() req: Request & { [USER_KEY]: SupabaseAuthUser },
    @Param('id') id: string,
  ) {
    return this.users.addLiked(req[USER_KEY].uid, id);
  }

  @Delete('me/liked/:id')
  removeLiked(
    @Req() req: Request & { [USER_KEY]: SupabaseAuthUser },
    @Param('id') id: string,
  ) {
    return this.users.removeLiked(req[USER_KEY].uid, id);
  }

  // ── Reading history ──────────────────────────────────────────────────────
  @Get('me/history')
  getHistory(@Req() req: Request & { [USER_KEY]: SupabaseAuthUser }) {
    return this.users.getHistory(req[USER_KEY].uid);
  }

  @Post('me/history')
  upsertHistoryItem(
    @Req() req: Request & { [USER_KEY]: SupabaseAuthUser },
    @Body() body: Record<string, unknown>,
  ) {
    return this.users.upsertHistoryItem(
      req[USER_KEY].uid,
      body as Parameters<typeof this.users.upsertHistoryItem>[1],
    );
  }

  @Delete('me/history')
  clearHistory(@Req() req: Request & { [USER_KEY]: SupabaseAuthUser }) {
    return this.users.clearHistory(req[USER_KEY].uid);
  }

  @Get('me/history/export')
  async exportHistory(
    @Req() req: Request & { [USER_KEY]: SupabaseAuthUser },
    @Res() res: Response,
  ) {
    const csv = await this.users.exportHistory(req[USER_KEY].uid);
    res
      .set('Content-Type', 'text/csv')
      .set('Content-Disposition', 'attachment; filename="reading-history.csv"')
      .send(csv);
  }

  @Delete('me/history/:id')
  removeHistoryItem(
    @Req() req: Request & { [USER_KEY]: SupabaseAuthUser },
    @Param('id') id: string,
  ) {
    return this.users.removeHistoryItem(req[USER_KEY].uid, id);
  }

  @Post('me/mark-email-verified')
  async markEmailVerified(
    @Req() req: Request & { [USER_KEY]: SupabaseAuthUser },
  ) {
    const token = req[USER_KEY];
    // Only mark verified when the account has a social provider that guarantees
    // the email — never for pure email/password accounts without social login
    const hasSocialProvider =
      token.providers.includes('google') ||
      token.providers.includes('facebook');
    if (!hasSocialProvider) {
      return { ok: false, reason: 'no_social_provider' };
    }
    await this.users.markEmailVerified(token.uid);
    return { ok: true };
  }

  // ── Photo history ────────────────────────────────────────────────────────
  @Get('me/photo-history')
  getPhotoHistory(@Req() req: Request & { [USER_KEY]: SupabaseAuthUser }) {
    return this.users.getPhotoHistory(req[USER_KEY].uid);
  }

  @Post('me/photo-history')
  updatePhotoHistory(
    @Req() req: Request & { [USER_KEY]: SupabaseAuthUser },
    @Body() body: { photos: string[] },
  ) {
    if (!Array.isArray(body?.photos))
      throw new BadRequestException('photos must be an array');
    return this.users.updatePhotoHistory(req[USER_KEY].uid, body.photos);
  }

  // ── Translator profile ───────────────────────────────────────────────────

  /** Upgrade current user's role to 'translator' and optionally set bio/languages. */
  @Post('me/become-translator')
  async becomeTranslator(
    @Req() req: Request & { [USER_KEY]: SupabaseAuthUser },
    @Body() body: { bio?: string; translatorLanguages?: string[] },
  ) {
    await this.users.becomeTranslator(req[USER_KEY].uid, body ?? {});
    return { ok: true };
  }

  /** Update translator-specific profile fields (bio, languages, country, etc.). */
  @Patch('me/translator-profile')
  async updateTranslatorProfile(
    @Req() req: Request & { [USER_KEY]: SupabaseAuthUser },
    @Body()
    body: {
      bio?: string;
      translatorLanguages?: string[];
      country?: string;
      preferredLanguage?: string;
    },
  ) {
    await this.users.updateTranslatorProfile(req[USER_KEY].uid, body ?? {});
    return { ok: true };
  }

  /** Record the calling device on login — fire-and-forget from AuthContext. */
  @Post('me/record-device')
  async recordDevice(
    @Req() req: Request & { [USER_KEY]: SupabaseAuthUser },
    @Headers('x-hardware-id') hwid: string,
    @Headers('user-agent') userAgent: string,
  ) {
    if (!isValidHardwareId(hwid)) return { ok: false };
    await this.users.recordDeviceAndAlert(
      req[USER_KEY].uid,
      hwid,
      userAgent ?? 'unknown',
    );
    return { ok: true };
  }
}
