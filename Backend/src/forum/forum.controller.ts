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
import { AuthGuard } from '../auth/auth.guard';
import { OptionalAuthGuard } from '../auth/optional-auth.guard';
import { CreatePostDto, CreateCommentDto, UpdatePostDto, UpdateCommentDto, UpdateBannerPositionDto, VoteDto } from './forum.dto';
import type { ForumCategory } from './forum.types';
import type { AuthenticatedRequest, MaybeAuthenticatedRequest } from '../auth/authenticated-request';

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
    @Req() req: MaybeAuthenticatedRequest,
    @Query('category') category?: ForumCategory,
    @Query('mangaId') mangaId?: string,
    @Query('sort') sort: 'new' | 'hot' = 'hot',
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.forumService.listPosts(
      category,
      mangaId,
      sort,
      Math.min(100, limit ? (parseInt(limit, 10) || 20) : 20),
      offset ? (parseInt(offset, 10) || 0) : 0,
      req.uid,
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
  async uploadBanner(@Req() req: AuthenticatedRequest, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');
    try {
      return await this.forumService.uploadBanner(req.uid, file.path, file.mimetype);
    } finally {
      fs.unlink(file.path, () => undefined);
    }
  }

  @Patch('profile/banner-position')
  @UseGuards(AuthGuard)
  async updateBannerPosition(@Req() req: AuthenticatedRequest, @Body() dto: UpdateBannerPositionDto) {
    return this.forumService.updateBannerPosition(req.uid, dto.position);
  }

  @Get('profile/:uid')
  @UseGuards(OptionalAuthGuard)
  async getPublicProfile(@Req() req: MaybeAuthenticatedRequest, @Param('uid') uid: string) {
    return this.forumService.getPublicProfile(uid, req.uid);
  }

  @Get('trending-manga')
  async getTrendingManga(@Query('limit') limit?: string) {
    return this.forumService.getTrendingManga(Math.min(20, limit ? (parseInt(limit, 10) || 5) : 5));
  }

  @Get('posts/:id')
  @UseGuards(OptionalAuthGuard)
  async getPost(@Req() req: MaybeAuthenticatedRequest, @Param('id') id: string) {
    return this.forumService.getPost(id, req.uid);
  }

  @Post('posts')
  @UseGuards(AuthGuard)
  async createPost(@Req() req: AuthenticatedRequest, @Body() dto: CreatePostDto) {
    return this.forumService.createPost(req.uid, dto);
  }

  @Delete('posts/:id')
  @UseGuards(AuthGuard)
  @HttpCode(204)
  async deletePost(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    await this.forumService.deletePost(req.uid, id);
  }

  @Delete('comments/:id')
  @UseGuards(AuthGuard)
  @HttpCode(204)
  async deleteComment(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    await this.forumService.deleteComment(req.uid, id);
  }

  @Patch('posts/:id')
  @UseGuards(AuthGuard)
  async updatePost(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: UpdatePostDto) {
    return this.forumService.updatePost(req.uid, id, dto);
  }

  @Patch('comments/:id')
  @UseGuards(AuthGuard)
  async updateComment(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: UpdateCommentDto) {
    return this.forumService.updateComment(req.uid, id, dto);
  }

  @Get('posts/:id/comments')
  @UseGuards(OptionalAuthGuard)
  async listComments(@Req() req: MaybeAuthenticatedRequest, @Param('id') id: string) {
    return this.forumService.listComments(id, req.uid);
  }

  @Post('comments')
  @UseGuards(AuthGuard)
  async createComment(@Req() req: AuthenticatedRequest, @Body() dto: CreateCommentDto) {
    return this.forumService.createComment(req.uid, dto);
  }

  @Post('vote')
  @UseGuards(AuthGuard)
  async vote(@Req() req: AuthenticatedRequest, @Body() dto: VoteDto) {
    return this.forumService.vote(req.uid, dto);
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
  async uploadImage(@Req() req: AuthenticatedRequest, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');
    try {
      return await this.forumService.uploadImage(req.uid, file.path, file.mimetype);
    } finally {
      fs.unlink(file.path, () => undefined);
    }
  }
}
