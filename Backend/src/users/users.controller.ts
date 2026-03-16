import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { AuthGuard, USER_KEY } from '../auth/auth.guard';
import { UsersService } from './users.service';
import type { SupabaseUser } from '../supabase/supabase.service';

@Controller('users')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  /** Called after login — creates/updates user doc (never overwrites displayName/photoURL) */
  @Post('me')
  async upsertMe(@Req() req: Request & { [USER_KEY]: SupabaseUser }) {
    const user = req[USER_KEY];
    await this.users.upsertUser(user.uid, {
      email: user.email,
      displayName: user.name,
      photoURL: user.picture,
    });
    return { ok: true };
  }

  /** Explicit profile update — always overwrites displayName and/or photoURL */
  @Patch('me')
  async updateMyProfile(
    @Req() req: Request & { [USER_KEY]: SupabaseUser },
    @Body() body: { displayName?: string; photoURL?: string },
  ) {
    await this.users.updateUserProfile(req[USER_KEY].uid, body);
    return { ok: true };
  }

  @Get('me')
  getMe(@Req() req: Request & { [USER_KEY]: SupabaseUser }) {
    return this.users.getProfile(req[USER_KEY].uid);
  }

  @Delete('me')
  async deleteMe(@Req() req: Request & { [USER_KEY]: SupabaseUser }) {
    await this.users.deleteUserAccount(req[USER_KEY].uid);
    return { ok: true };
  }

  @Get('me/favorites')
  getFavorites(@Req() req: Request & { [USER_KEY]: SupabaseUser }) {
    return this.users.getFavorites(req[USER_KEY].uid);
  }

  @Post('me/favorites')
  addFavorite(
    @Req() req: Request & { [USER_KEY]: SupabaseUser },
    @Body() body: {
      id: string; title: string; thumbnail: string;
      authors?: string[]; description?: string; categories?: string[];
      publishedDate?: string; averageRating?: number; ratingsCount?: number;
    },
  ) {
    return this.users.addFavorite(req[USER_KEY].uid, body);
  }

  @Delete('me/favorites/:id')
  removeFavorite(
    @Req() req: Request & { [USER_KEY]: SupabaseUser },
    @Param('id') id: string,
  ) {
    return this.users.removeFavorite(req[USER_KEY].uid, id);
  }

  @Delete('me/avatar')
  deleteAvatar(
    @Req() req: Request & { [USER_KEY]: SupabaseUser },
    @Body() body: { filename: string },
  ) {
    const uid = req[USER_KEY].uid;
    const filename = body?.filename ?? '';
    if (!filename || !filename.startsWith(`${uid}_`)) {
      throw new BadRequestException('Invalid filename');
    }
    const filePath = path.join(process.cwd(), 'uploads', 'avatars', filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return { ok: true };
  }

  @Post('me/avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          return cb(new BadRequestException('Only image files are allowed'), false);
        }
        cb(null, true);
      },
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const dir = path.join(process.cwd(), 'uploads', 'avatars');
          fs.mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (req: any, file, cb) => {
          const uid = (req[USER_KEY] as SupabaseUser)?.uid ?? 'unknown';
          const ext = path.extname(file.originalname) || '.jpg';
          cb(null, `${uid}_${Date.now()}${ext}`);
        },
      }),
    }),
  )
  uploadAvatar(
    @Req() req: Request & { [USER_KEY]: SupabaseUser },
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file provided');
    return { url: `/uploads/avatars/${file.filename}` };
  }

  @Get('me/liked')
  getLiked(@Req() req: Request & { [USER_KEY]: SupabaseUser }) {
    return this.users.getLiked(req[USER_KEY].uid);
  }

  @Post('me/liked/:id')
  addLiked(
    @Req() req: Request & { [USER_KEY]: SupabaseUser },
    @Param('id') id: string,
  ) {
    return this.users.addLiked(req[USER_KEY].uid, id);
  }

  @Delete('me/liked/:id')
  removeLiked(
    @Req() req: Request & { [USER_KEY]: SupabaseUser },
    @Param('id') id: string,
  ) {
    return this.users.removeLiked(req[USER_KEY].uid, id);
  }

  // ── Reading history ──────────────────────────────────────────────────────
  @Get('me/history')
  getHistory(@Req() req: Request & { [USER_KEY]: SupabaseUser }) {
    return this.users.getHistory(req[USER_KEY].uid);
  }

  @Post('me/history')
  upsertHistoryItem(
    @Req() req: Request & { [USER_KEY]: SupabaseUser },
    @Body() body: Record<string, unknown>,
  ) {
    return this.users.upsertHistoryItem(req[USER_KEY].uid, body as Parameters<typeof this.users.upsertHistoryItem>[1]);
  }

  @Delete('me/history')
  clearHistory(@Req() req: Request & { [USER_KEY]: SupabaseUser }) {
    return this.users.clearHistory(req[USER_KEY].uid);
  }

  @Delete('me/history/:id')
  removeHistoryItem(
    @Req() req: Request & { [USER_KEY]: SupabaseUser },
    @Param('id') id: string,
  ) {
    return this.users.removeHistoryItem(req[USER_KEY].uid, id);
  }

  @Post('me/mark-email-verified')
  async markEmailVerified(@Req() req: Request & { [USER_KEY]: SupabaseUser }) {
    const user = req[USER_KEY];
    // Check if user has social provider via app_metadata
    const providers = user.app_metadata?.providers ?? [];
    const hasSocialProvider =
      providers.includes('google') || providers.includes('facebook');
    if (!hasSocialProvider) {
      return { ok: false, reason: 'no_social_provider' };
    }
    await this.users.markEmailVerified(user.uid);
    return { ok: true };
  }

  // ── Photo history ────────────────────────────────────────────────────────
  @Get('me/photo-history')
  getPhotoHistory(@Req() req: Request & { [USER_KEY]: SupabaseUser }) {
    return this.users.getPhotoHistory(req[USER_KEY].uid);
  }

  @Post('me/photo-history')
  updatePhotoHistory(
    @Req() req: Request & { [USER_KEY]: SupabaseUser },
    @Body() body: { photos: string[] },
  ) {
    if (!Array.isArray(body?.photos)) throw new BadRequestException('photos must be an array');
    return this.users.updatePhotoHistory(req[USER_KEY].uid, body.photos);
  }

  // ── Translator profile ───────────────────────────────────────────────────

  @Post('me/become-translator')
  async becomeTranslator(
    @Req() req: Request & { [USER_KEY]: SupabaseUser },
    @Body() body: { bio?: string; translatorLanguages?: string[] },
  ) {
    await this.users.becomeTranslator(req[USER_KEY].uid, body ?? {});
    return { ok: true };
  }

  @Patch('me/translator-profile')
  async updateTranslatorProfile(
    @Req() req: Request & { [USER_KEY]: SupabaseUser },
    @Body() body: { bio?: string; translatorLanguages?: string[]; country?: string; preferredLanguage?: string },
  ) {
    await this.users.updateTranslatorProfile(req[USER_KEY].uid, body ?? {});
    return { ok: true };
  }
}
