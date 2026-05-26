import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Sse,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as os from 'os';
import * as crypto from 'crypto';
import * as fs from 'fs';
import { Observable, merge, interval } from 'rxjs';
import { map } from 'rxjs/operators';
import { ForumService } from './forum.service';
import { ForumEventsService } from './forum-events.service';
import { AuthGuard, USER_KEY } from '../auth/auth.guard';
import { OptionalAuthGuard } from '../auth/optional-auth.guard';
import { type CreatePostDto, type CreateCommentDto, type UpdatePostDto, type UpdateCommentDto, type UpdateBannerPositionDto, type VoteDto, type ForumCategory } from './forum.types';
import type { SupabaseAuthUser } from '../auth/auth.types';

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

interface MessageEvent { data: object }

@Controller('forum')
export class ForumController {
  constructor(
    private readonly forumService: ForumService,
    private readonly forumEvents: ForumEventsService,
  ) {}

  @Sse('posts/:id/stream')
  streamPost(@Param('id') postId: string): Observable<MessageEvent> {
    return merge(
      this.forumEvents.getPostStream(postId),
      interval(25_000).pipe(map(() => ({ data: { type: 'heartbeat' } }))),
    );
  }

  @Sse('feed/stream')
  streamFeed(): Observable<MessageEvent> {
    return merge(
      this.forumEvents.getFeedStream(),
      interval(25_000).pipe(map(() => ({ data: { type: 'heartbeat' } }))),
    );
  }

  @Get('posts')
  @UseGuards(OptionalAuthGuard)
  async listPosts(
    @Req() req: any,
    @Query('category') category?: ForumCategory,
    @Query('mangaId') mangaId?: string,
    @Query('sort') sort: 'new' | 'hot' = 'hot',
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const user = req[USER_KEY] as SupabaseAuthUser | undefined;
    return this.forumService.listPosts(
      category,
      mangaId,
      sort,
      Math.min(100, limit ? (parseInt(limit, 10) || 20) : 20),
      offset ? (parseInt(offset, 10) || 0) : 0,
      user?.uid
    );
  }

  @Post('profile/banner')
  @UseGuards(AuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
          return cb(new BadRequestException('Only JPEG, PNG, WebP and GIF are allowed'), false);
        }
        cb(null, true);
      },
      storage: diskStorage({
        destination: (_req, _file, cb) => cb(null, os.tmpdir()),
        filename: (_req, _file, cb) => cb(null, `banner_${crypto.randomUUID()}`),
      }),
    }),
  )
  async uploadBanner(@Req() req: any, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');
    const user = req[USER_KEY] as SupabaseAuthUser;
    try {
      return await this.forumService.uploadBanner(user.uid, file.path, file.mimetype);
    } finally {
      fs.unlink(file.path, () => undefined);
    }
  }

  @Patch('profile/banner-position')
  @UseGuards(AuthGuard)
  async updateBannerPosition(@Req() req: any, @Body() dto: UpdateBannerPositionDto) {
    const user = req[USER_KEY] as SupabaseAuthUser;
    return this.forumService.updateBannerPosition(user.uid, dto.position);
  }

  @Get('profile/:uid')
  @UseGuards(OptionalAuthGuard)
  async getPublicProfile(@Req() req: any, @Param('uid') uid: string) {
    const viewer = req[USER_KEY] as SupabaseAuthUser | undefined;
    return this.forumService.getPublicProfile(uid, viewer?.uid);
  }

  @Get('trending-manga')
  async getTrendingManga(@Query('limit') limit?: string) {
    return this.forumService.getTrendingManga(Math.min(20, limit ? (parseInt(limit, 10) || 5) : 5));
  }

  @Get('posts/:id')
  @UseGuards(OptionalAuthGuard)
  async getPost(@Req() req: any, @Param('id') id: string) {
    const user = req[USER_KEY] as SupabaseAuthUser | undefined;
    return this.forumService.getPost(id, user?.uid);
  }

  @Post('posts')
  @UseGuards(AuthGuard)
  async createPost(@Req() req: any, @Body() dto: CreatePostDto) {
    const user = req[USER_KEY] as SupabaseAuthUser;
    return this.forumService.createPost(user.uid, dto);
  }

  @Delete('posts/:id')
  @UseGuards(AuthGuard)
  @HttpCode(204)
  async deletePost(@Req() req: any, @Param('id') id: string) {
    const user = req[USER_KEY] as SupabaseAuthUser;
    await this.forumService.deletePost(user.uid, id);
  }

  @Delete('comments/:id')
  @UseGuards(AuthGuard)
  @HttpCode(204)
  async deleteComment(@Req() req: any, @Param('id') id: string) {
    const user = req[USER_KEY] as SupabaseAuthUser;
    await this.forumService.deleteComment(user.uid, id);
  }

  @Patch('posts/:id')
  @UseGuards(AuthGuard)
  async updatePost(@Req() req: any, @Param('id') id: string, @Body() dto: UpdatePostDto) {
    const user = req[USER_KEY] as SupabaseAuthUser;
    return this.forumService.updatePost(user.uid, id, dto);
  }

  @Patch('comments/:id')
  @UseGuards(AuthGuard)
  async updateComment(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateCommentDto) {
    const user = req[USER_KEY] as SupabaseAuthUser;
    return this.forumService.updateComment(user.uid, id, dto);
  }

  @Get('posts/:id/comments')
  @UseGuards(OptionalAuthGuard)
  async listComments(@Req() req: any, @Param('id') id: string) {
    const user = req[USER_KEY] as SupabaseAuthUser | undefined;
    return this.forumService.listComments(id, user?.uid);
  }

  @Post('comments')
  @UseGuards(AuthGuard)
  async createComment(@Req() req: any, @Body() dto: CreateCommentDto) {
    const user = req[USER_KEY] as SupabaseAuthUser;
    return this.forumService.createComment(user.uid, dto);
  }

  @Post('vote')
  @UseGuards(AuthGuard)
  async vote(@Req() req: any, @Body() dto: VoteDto) {
    const user = req[USER_KEY] as SupabaseAuthUser;
    return this.forumService.vote(user.uid, dto);
  }

  @Post('upload-image')
  @UseGuards(AuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
          return cb(new BadRequestException('Only JPEG, PNG, WebP and GIF are allowed'), false);
        }
        cb(null, true);
      },
      storage: diskStorage({
        destination: (_req, _file, cb) => cb(null, os.tmpdir()),
        filename: (_req, _file, cb) => cb(null, `forum_img_${crypto.randomUUID()}`),
      }),
    }),
  )
  async uploadImage(@Req() req: any, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');
    const user = req[USER_KEY] as SupabaseAuthUser;
    try {
      return await this.forumService.uploadImage(user.uid, file.path, file.mimetype);
    } finally {
      fs.unlink(file.path, () => undefined);
    }
  }
}
