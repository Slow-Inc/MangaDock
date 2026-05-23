import { 
  Body, 
  Controller, 
  Get, 
  Param, 
  Post, 
  Query, 
  Req, 
  UseGuards 
} from '@nestjs/common';
import { ForumService } from './forum.service';
import { AuthGuard, USER_KEY, OptionalAuthGuard } from '../auth/auth.guard';
import { type CreatePostDto, type CreateCommentDto, type VoteDto, type ForumCategory } from './forum.types';
import type { SupabaseAuthUser } from '../auth/auth.types';

@Controller('forum')
export class ForumController {
  constructor(private readonly forumService: ForumService) {}

  @Get('posts')
  @UseGuards(OptionalAuthGuard)
  async listPosts(
    @Req() req: any,
    @Query('category') category?: ForumCategory,
    @Query('mangaId') mangaId?: string,
    @Query('sort') sort: 'new' | 'hot' = 'new',
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const user = req[USER_KEY] as SupabaseAuthUser | undefined;
    return this.forumService.listPosts(
      category, 
      mangaId, 
      sort,
      limit ? parseInt(limit) : 20, 
      offset ? parseInt(offset) : 0,
      user?.uid
    );
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
}
